import { App, PluginSettingTab, Setting } from "obsidian";
import type StandardSitePlugin from "./main";
import { StandardSiteClient } from "./atproto";

export interface StandardSiteSettings {
	handle: string;
	appPassword: string;
	pdsUrl: string;
	publicationName: string;
	publicationDescription: string;
	publicationUrl: string;
	publicationUri: string;
	publishRoot: string;
	pullFolder: string;
}

export const DEFAULT_SETTINGS: StandardSiteSettings = {
	handle: "",
	appPassword: "",
	pdsUrl: "https://bsky.social",
	publicationName: "",
	publicationDescription: "",
	publicationUrl: "",
	publicationUri: "",
	publishRoot: "",
	pullFolder: "",
};

export class StandardSiteSettingTab extends PluginSettingTab {
	plugin: StandardSitePlugin;

	constructor(app: App, plugin: StandardSitePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Standard.site Publisher" });

		// Auth section
		containerEl.createEl("h3", { text: "Authentication" });

		new Setting(containerEl)
			.setName("ATProto handle")
			.setDesc("Your handle (e.g. alice.bsky.social)")
			.addText((text) =>
				text
					.setPlaceholder("alice.bsky.social")
					.setValue(this.plugin.settings.handle)
					.onChange(async (value) => {
						this.plugin.settings.handle = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("App password")
			.setDesc("Generate one at Settings → App Passwords in your ATProto client")
			.addText((text) => {
				text
					.setPlaceholder("xxxx-xxxx-xxxx-xxxx")
					.setValue(this.plugin.settings.appPassword)
					.onChange(async (value) => {
						this.plugin.settings.appPassword = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("PDS URL")
			.setDesc("Personal Data Server URL (default: https://bsky.social)")
			.addText((text) =>
				text
					.setPlaceholder("https://bsky.social")
					.setValue(this.plugin.settings.pdsUrl)
					.onChange(async (value) => {
						this.plugin.settings.pdsUrl = value;
						await this.plugin.saveSettings();
					})
			);

		// Publication section
		containerEl.createEl("h3", { text: "Publication" });

		this.renderPublicationPicker(containerEl);

		// Vault section
		containerEl.createEl("h3", { text: "Vault" });

		new Setting(containerEl)
			.setName("Publish root folder")
			.setDesc("Vault folder for published notes (leave empty for vault root)")
			.addText((text) =>
				text
					.setPlaceholder("publish")
					.setValue(this.plugin.settings.publishRoot)
					.onChange(async (value) => {
						this.plugin.settings.publishRoot = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Pull folder")
			.setDesc("Where to save notes pulled from ATProto (defaults to publish root)")
			.addText((text) =>
				text
					.setPlaceholder("publish")
					.setValue(this.plugin.settings.pullFolder)
					.onChange(async (value) => {
						this.plugin.settings.pullFolder = value;
						await this.plugin.saveSettings();
					})
			);

	}

	private renderPublicationPicker(containerEl: HTMLElement) {
		const wrapper = containerEl.createDiv();
		const { handle, appPassword, pdsUrl } = this.plugin.settings;

		if (!handle || !appPassword) {
			new Setting(wrapper)
				.setName("Active publication")
				.setDesc("Set your handle and app password above to load publications.");
			return;
		}

		const loadingSetting = new Setting(wrapper)
			.setName("Active publication")
			.setDesc("Loading publications...");

		const client = new StandardSiteClient(pdsUrl);
		client.login(handle, appPassword).then(async () => {
			const publications = await client.listPublications();
			wrapper.empty();

			const setting = new Setting(wrapper)
				.setName("Active publication")
				.setDesc("Select which publication to publish to");

			setting.addDropdown((dropdown) => {
				for (const pub of publications) {
					const rkey = client.extractRkey(pub.uri);
					dropdown.addOption(pub.uri, pub.value.name || rkey);
				}
				dropdown.addOption("__new__", "+ Create new...");

				if (this.plugin.settings.publicationUri) {
					dropdown.setValue(this.plugin.settings.publicationUri);
				}

				dropdown.onChange(async (value) => {
					if (value === "__new__") {
						newPubWrapper.style.display = "";
						return;
					}
					newPubWrapper.style.display = "none";
					this.plugin.settings.publicationUri = value;
					await this.plugin.saveSettings();
				});
			});

			// "Create new" inline fields
			const newPubWrapper = wrapper.createDiv();
			newPubWrapper.style.display = "none";

			let newName = "";
			new Setting(newPubWrapper)
				.setName("New publication name")
				.addText((text) =>
					text.setPlaceholder("My Cooking Blog").onChange((v) => { newName = v; })
				);

			new Setting(newPubWrapper)
				.addButton((btn) =>
					btn.setButtonText("Create publication").setCta().onClick(async () => {
						if (!newName.trim()) return;
						try {
							const ref = await client.createPublication({
								$type: "site.standard.publication",
								url: this.plugin.settings.publicationUrl ||
									`https://bsky.app/profile/${this.plugin.settings.handle}`,
								name: newName.trim(),
							});
							this.plugin.settings.publicationUri = ref.uri;
							await this.plugin.saveSettings();
							this.display(); // re-render settings
						} catch (e: any) {
							console.error("Failed to create publication:", e);
						}
					})
				);
		}).catch(() => {
			wrapper.empty();
			new Setting(wrapper)
				.setName("Active publication")
				.setDesc("Could not connect — check your handle and app password.");
		});
	}
}
