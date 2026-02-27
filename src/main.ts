import { Notice, Plugin, TFile } from "obsidian";
import {
	StandardSiteSettingTab,
	DEFAULT_SETTINGS,
	type StandardSiteSettings,
} from "./settings";
import { StandardSiteClient } from "./atproto";
import { prepareNoteForPublish, extractRkeyFromUri } from "./publish";
import { computeSyncDiff, type VaultNote, type PdsRecord } from "./sync";
import { deriveDocumentPath } from "./paths";
import type { NoteFrontmatter, PublicationRecord, BlobRef } from "./types";
import type { WikilinkResolver, ResolvedWikilink } from "./transform";
import { buildNoteFromRecord } from "./pull";

export default class StandardSitePlugin extends Plugin {
	settings: StandardSiteSettings = DEFAULT_SETTINGS;
	private client: StandardSiteClient | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StandardSiteSettingTab(this.app, this));

		this.addCommand({
			id: "publish-update-note",
			name: "Publish / Update note",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (checking) return true;
				this.publishOrUpdateNote(file);
				return true;
			},
		});

		this.addCommand({
			id: "unpublish-note",
			name: "Unpublish note",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (checking) return true;
				this.unpublishNote(file);
				return true;
			},
		});

		this.addCommand({
			id: "sync-all",
			name: "Sync all published notes",
			callback: () => this.syncAll(),
		});

		this.addCommand({
			id: "sync-from-atproto",
			name: "Sync from ATProto",
			callback: () => this.syncFromAtproto(),
		});

		this.addCommand({
			id: "add-publish-frontmatter",
			name: "Add publish frontmatter",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (checking) return true;
				this.addPublishFrontmatter(file);
				return true;
			},
		});

		// File menu items
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item.setTitle("Publish / Update to Standard.site")
							.setIcon("upload")
							.onClick(() => this.publishOrUpdateNote(file));
					});
					menu.addItem((item) => {
						item.setTitle("Unpublish from Standard.site")
							.setIcon("trash")
							.onClick(() => this.unpublishNote(file));
					});
					menu.addItem((item) => {
						item.setTitle("Add Standard.site frontmatter")
							.setIcon("file-plus")
							.onClick(() => this.addPublishFrontmatter(file));
					});
				}
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async getClient(): Promise<StandardSiteClient> {
		if (!this.settings.handle || !this.settings.appPassword) {
			throw new Error("Please configure your ATProto handle and app password in settings");
		}
		if (!this.client) {
			this.client = new StandardSiteClient(this.settings.pdsUrl);
			await this.client.login(this.settings.handle, this.settings.appPassword);
		}
		return this.client;
	}

	private async ensurePublication(): Promise<string> {
		if (this.settings.publicationUri) {
			return this.settings.publicationUri;
		}

		const client = await this.getClient();

		// Auto-select if exactly one exists
		const publications = await client.listPublications();
		if (publications.length === 1 && publications[0]) {
			this.settings.publicationUri = publications[0].uri;
			await this.saveSettings();
			return publications[0].uri;
		}

		throw new Error("Please select a publication in settings");
	}

	private async syncPublicationUrl(client: StandardSiteClient) {
		if (!this.settings.publicationUrl || !this.settings.publicationUri) return;
		const rkey = extractRkeyFromUri(this.settings.publicationUri);
		const existing = await client.getPublication(rkey);
		if (!existing) return;
		if (existing.value.url !== this.settings.publicationUrl) {
			const updatedRecord: PublicationRecord = {
				...existing.value,
				$type: "site.standard.publication",
				url: this.settings.publicationUrl,
			};
			await client.updatePublication(rkey, updatedRecord);
		}
	}

	private buildWikilinkResolver(did: string): WikilinkResolver {
		return (target: string): ResolvedWikilink | null => {
			const destFile = this.app.metadataCache.getFirstLinkpathDest(target, "");
			if (!destFile) return null;

			const cache = this.app.metadataCache.getFileCache(destFile);
			const frontmatter = cache?.frontmatter as NoteFrontmatter | undefined;
			if (!frontmatter?.publish) return null;

			const path = deriveDocumentPath(destFile.path, this.settings.publishRoot, frontmatter.slug);
			const uri = frontmatter.rkey
				? `at://${did}/site.standard.document/${frontmatter.rkey}`
				: undefined;

			return { path, uri };
		};
	}

	private getMimeType(filePath: string): string {
		const ext = filePath.split(".").pop()?.toLowerCase() || "";
		const mimeTypes: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			svg: "image/svg+xml",
			bmp: "image/bmp",
		};
		return mimeTypes[ext] || "application/octet-stream";
	}

	private async uploadCoverImage(client: StandardSiteClient, coverImagePath: string): Promise<BlobRef | undefined> {
		const imageFile = this.app.vault.getAbstractFileByPath(coverImagePath);
		if (!(imageFile instanceof TFile)) {
			console.warn(`Cover image not found: ${coverImagePath}`);
			return undefined;
		}
		const data = await this.app.vault.readBinary(imageFile);
		const mimeType = this.getMimeType(imageFile.extension);
		return await client.uploadBlob(new Uint8Array(data), mimeType);
	}

	private async publishOrUpdateNote(file: TFile) {
		try {
			const client = await this.getClient();
			const siteUri = await this.ensurePublication();
			await this.syncPublicationUrl(client);

			const content = await this.app.vault.read(file);
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = (cache?.frontmatter || {}) as NoteFrontmatter;

			if (!frontmatter.publish) {
				new Notice("Note does not have 'publish: true' in frontmatter");
				return;
			}

			// Strip frontmatter from body
			const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

			// Check for existing record to get publishedAt
			let existingPublishedAt: string | undefined;
			if (frontmatter.rkey) {
				const existing = await client.getDocument(frontmatter.rkey);
				if (existing) {
					existingPublishedAt = existing.value.publishedAt;
				}
			}

			// Upload cover image if specified
			let coverImage: BlobRef | undefined;
			if (frontmatter.coverImage) {
				coverImage = await this.uploadCoverImage(client, frontmatter.coverImage);
			}

			const { record, isUpdate, rkey } = prepareNoteForPublish({
				filePath: file.path,
				frontmatter,
				body,
				config: { siteUri, publishRoot: this.settings.publishRoot },
				resolveWikilink: this.buildWikilinkResolver(client.did),
				existingPublishedAt,
				coverImage,
			});

			let resultUri: string;
			if (isUpdate && rkey) {
				const ref = await client.updateDocument(rkey, record);
				resultUri = ref.uri;
				new Notice(`Updated: ${record.title}`);
			} else {
				const ref = await client.createDocument(record);
				resultUri = ref.uri;
				new Notice(`Published: ${record.title}`);
			}

			// Write rkey to frontmatter
			const newRkey = extractRkeyFromUri(resultUri);
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm.rkey = newRkey;
			});
		} catch (e: any) {
			new Notice(`Failed to publish: ${e.message}`);
			console.error("Standard.site publish error:", e);
		}
	}

	private async unpublishNote(file: TFile) {
		try {
			const client = await this.getClient();
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = (cache?.frontmatter || {}) as NoteFrontmatter;

			if (!frontmatter.rkey) {
				new Notice("Note has not been published (no rkey in frontmatter)");
				return;
			}

			await client.deleteDocument(frontmatter.rkey);

			// Remove rkey from frontmatter
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				delete fm.rkey;
			});

			new Notice(`Unpublished: ${file.basename}`);
		} catch (e: any) {
			new Notice(`Failed to unpublish: ${e.message}`);
			console.error("Standard.site unpublish error:", e);
		}
	}

	private async syncAll() {
		try {
			const client = await this.getClient();
			const siteUri = await this.ensurePublication();
			await this.syncPublicationUrl(client);

			const files = this.app.vault.getMarkdownFiles();
			let created = 0;
			let updated = 0;
			let failed = 0;

			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				const frontmatter = (cache?.frontmatter || {}) as NoteFrontmatter;

				if (!frontmatter.publish) continue;

				try {
					const content = await this.app.vault.read(file);
					const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

					let existingPublishedAt: string | undefined;
					if (frontmatter.rkey) {
						const existing = await client.getDocument(frontmatter.rkey);
						if (existing) {
							existingPublishedAt = existing.value.publishedAt;
						}
					}

					// Upload cover image if specified
					let coverImage: BlobRef | undefined;
					if (frontmatter.coverImage) {
						coverImage = await this.uploadCoverImage(client, frontmatter.coverImage);
					}

					const { record, isUpdate, rkey } = prepareNoteForPublish({
						filePath: file.path,
						frontmatter,
						body,
						config: { siteUri, publishRoot: this.settings.publishRoot },
						resolveWikilink: this.buildWikilinkResolver(client.did),
						existingPublishedAt,
						coverImage,
					});

					let resultUri: string;
					if (isUpdate && rkey) {
						const ref = await client.updateDocument(rkey, record);
						resultUri = ref.uri;
						updated++;
					} else {
						const ref = await client.createDocument(record);
						resultUri = ref.uri;
						created++;
					}

					const newRkey = extractRkeyFromUri(resultUri);
					await this.app.fileManager.processFrontMatter(file, (fm) => {
						fm.rkey = newRkey;
					});
				} catch (e: any) {
					failed++;
					console.error(`Failed to sync ${file.path}:`, e);
				}
			}

			new Notice(`Sync complete: ${created} published, ${updated} updated, ${failed} failed`);
		} catch (e: any) {
			new Notice(`Sync failed: ${e.message}`);
			console.error("Standard.site sync error:", e);
		}
	}

	private async syncFromAtproto() {
		try {
			const client = await this.getClient();
			const siteUri = await this.ensurePublication();
			const allRecords = await client.listDocuments();
			const pdsRecords: PdsRecord[] = allRecords
				.filter((r) => r.value.site === siteUri)
				.map((r) => ({
					uri: r.uri,
					rkey: client.extractRkey(r.uri),
					path: r.value.path || "",
					value: r.value,
				}));

			const files = this.app.vault.getMarkdownFiles();
			const vaultNotes: VaultNote[] = [];
			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				const fm = (cache?.frontmatter || {}) as NoteFrontmatter;
				if (!fm.publish) continue;
				vaultNotes.push({
					filePath: file.path,
					path: deriveDocumentPath(file.path, this.settings.publishRoot, fm.slug),
					rkey: fm.rkey,
				});
			}

			const diff = computeSyncDiff(vaultNotes, pdsRecords);

			const parts: string[] = [];
			if (diff.toCreate.length > 0) parts.push(`${diff.toCreate.length} untracked`);
			if (diff.toUpdate.length > 0) parts.push(`${diff.toUpdate.length} synced`);
			if (diff.orphans.length > 0) parts.push(`${diff.orphans.length} orphans on PDS`);

			new Notice(`Sync status: ${parts.join(", ") || "everything in sync"}`);

			// Log details
			for (const orphan of diff.orphans) {
				console.log(`Orphan on PDS: ${orphan.path} (rkey: ${orphan.rkey})`);
			}
			for (const note of diff.toCreate) {
				console.log(`Untracked in vault: ${note.filePath}`);
			}

			// Pull orphans into vault
			if (diff.orphans.length > 0) {
				const pullRoot = this.settings.pullFolder || this.settings.publishRoot || "";
				let pulled = 0;
				let skipped = 0;

				for (const orphan of diff.orphans) {
					const { frontmatter, body, relativePath } = buildNoteFromRecord({
						rkey: orphan.rkey,
						value: orphan.value,
					});

					const fullPath = pullRoot ? `${pullRoot}/${relativePath}` : relativePath;

					// Check if file already exists
					const existing = this.app.vault.getAbstractFileByPath(fullPath);
					if (existing) {
						console.log(`Skipping pull (file exists): ${fullPath}`);
						skipped++;
						continue;
					}

					// Ensure parent directory exists
					const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
					if (dir) {
						try {
							await this.app.vault.createFolder(dir);
						} catch {
							// Folder may already exist
						}
					}

					const noteContent = `${frontmatter}\n\n${body}`;
					await this.app.vault.create(fullPath, noteContent);
					pulled++;
				}

				if (pulled > 0 || skipped > 0) {
					new Notice(`Pulled ${pulled} notes from ATProto (${skipped} skipped — already exist)`);
				}
			}
		} catch (e: any) {
			new Notice(`Sync from ATProto failed: ${e.message}`);
			console.error("Standard.site sync-from error:", e);
		}
	}

	private async addPublishFrontmatter(file: TFile) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (fm.publish === undefined) fm.publish = true;
			if (fm.title === undefined) fm.title = file.basename;
			if (fm.description === undefined) fm.description = "";
			if (fm.tags === undefined) fm.tags = [];
			if (fm.slug === undefined) fm.slug = "";
			if (fm.coverImage === undefined) fm.coverImage = "";
		});
		new Notice("Added publish frontmatter");
	}

	onunload() {
		this.client = null;
	}
}
