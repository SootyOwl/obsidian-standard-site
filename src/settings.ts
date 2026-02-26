import { App, PluginSettingTab, Setting } from "obsidian";
import type StandardSitePlugin from "./main";

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

		new Setting(containerEl)
			.setName("Publication name")
			.setDesc("The name of your blog/publication")
			.addText((text) =>
				text
					.setPlaceholder("My Blog")
					.setValue(this.plugin.settings.publicationName)
					.onChange(async (value) => {
						this.plugin.settings.publicationName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Publication description")
			.setDesc("A short description of your publication (optional)")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.publicationDescription)
					.onChange(async (value) => {
						this.plugin.settings.publicationDescription = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Publication URL")
			.setDesc("Your blog URL if you have one (optional)")
			.addText((text) =>
				text
					.setPlaceholder("https://myblog.com")
					.setValue(this.plugin.settings.publicationUrl)
					.onChange(async (value) => {
						this.plugin.settings.publicationUrl = value;
						await this.plugin.saveSettings();
					})
			);

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

		// Status
		if (this.plugin.settings.publicationUri) {
			containerEl.createEl("h3", { text: "Status" });
			containerEl.createEl("p", {
				text: `Publication URI: ${this.plugin.settings.publicationUri}`,
				cls: "setting-item-description",
			});
		}
	}
}
