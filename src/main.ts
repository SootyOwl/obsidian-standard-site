import { Plugin } from "obsidian";

export default class StandardSitePlugin extends Plugin {
	async onload() {
		console.log("Standard.site plugin loaded");
	}

	onunload() {
		console.log("Standard.site plugin unloaded");
	}
}
