import { Plugin } from "obsidian";
import {
	type StandardSiteSettings,
	DEFAULT_SETTINGS,
	StandardSiteSettingTab,
} from "./settings";

export default class StandardSitePlugin extends Plugin {
	settings: StandardSiteSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StandardSiteSettingTab(this.app, this));
		console.log("Standard.site plugin loaded");
	}

	onunload() {
		console.log("Standard.site plugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
