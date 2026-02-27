import type { DocumentRecord, NoteFrontmatter, BlobRef } from "./types";
import { buildDocumentRecord } from "./types";
import { transformObsidianMarkdown, type WikilinkResolver } from "./transform";
import { markdownToPlainText } from "./plaintext";
import { deriveDocumentPath } from "./paths";

export interface PublishConfig {
	siteUri: string;
	publishRoot: string;
}

export interface PrepareInput {
	filePath: string;
	frontmatter: NoteFrontmatter;
	body: string;
	config: PublishConfig;
	resolveWikilink: WikilinkResolver;
	existingPublishedAt?: string;
	coverImage?: BlobRef;
}

export interface PrepareResult {
	record: DocumentRecord;
	isUpdate: boolean;
	rkey?: string;
}

export function prepareNoteForPublish(input: PrepareInput): PrepareResult {
	const { filePath, frontmatter, body, config, resolveWikilink, existingPublishedAt, coverImage } = input;

	// Derive title
	const title = frontmatter.title || filePath.replace(/\.md$/, "").split("/").pop() || "Untitled";

	// Derive path
	const path = deriveDocumentPath(filePath, config.publishRoot, frontmatter.slug);

	// Transform markdown
	const { text: transformedMarkdown, references } = transformObsidianMarkdown(body, resolveWikilink);

	// Extract plain text from transformed markdown
	const plainText = markdownToPlainText(transformedMarkdown);

	// Determine timestamps
	const isUpdate = !!frontmatter.rkey;
	const publishedAt = existingPublishedAt || new Date().toISOString();
	const updatedAt = isUpdate ? new Date().toISOString() : undefined;

	// Build record
	const record = buildDocumentRecord({
		siteUri: config.siteUri,
		title,
		path,
		description: frontmatter.description,
		tags: frontmatter.tags,
		publishedAt,
		updatedAt,
		markdown: transformedMarkdown,
		plainText,
		coverImage,
		references,
	});

	return {
		record,
		isUpdate,
		rkey: frontmatter.rkey,
	};
}

export function extractRkeyFromUri(uri: string): string {
	const parts = uri.split("/");
	return parts[parts.length - 1]!;
}
