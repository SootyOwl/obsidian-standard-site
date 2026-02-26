import { describe, it, expect } from "vitest";
import { transformObsidianMarkdown } from "../src/transform";

// The resolveWikilink callback: given a link target, returns the published
// path if the note is published, or null if not.
const noopResolver = (_target: string) => null;

describe("transformObsidianMarkdown", () => {
	describe("comments", () => {
		it("removes Obsidian comments", () => {
			const input = "Before %%secret comment%% after";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe("Before  after");
		});

		it("removes multiline comments", () => {
			const input = "Before\n%%\nmultiline\ncomment\n%%\nafter";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe("Before\n\nafter");
		});
	});

	describe("highlights", () => {
		it("converts highlights to <mark> tags", () => {
			const input = "This is ==highlighted== text";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(
				"This is <mark>highlighted</mark> text"
			);
		});

		it("handles multiple highlights", () => {
			const input = "==one== and ==two==";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(
				"<mark>one</mark> and <mark>two</mark>"
			);
		});
	});

	describe("embeds", () => {
		it("removes image embeds", () => {
			const input = "Before\n![[image.png]]\nafter";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe("Before\n\nafter");
		});

		it("removes embeds with alt text", () => {
			const input = "Before\n![[document.pdf|My PDF]]\nafter";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe("Before\n\nafter");
		});
	});

	describe("callouts", () => {
		it("converts callouts to plain blockquotes", () => {
			const input = "> [!note] Title\n> Content here";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(
				"> **Title**\n> Content here"
			);
		});

		it("converts callouts without title", () => {
			const input = "> [!warning]\n> Be careful";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(
				"> \n> Be careful"
			);
		});
	});

	describe("passthrough", () => {
		it("preserves standard markdown", () => {
			const input = "# Heading\n\n**bold** and *italic*\n\n- list item\n\n```js\ncode\n```";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(input);
		});

		it("preserves GFM tables", () => {
			const input = "| a | b |\n|---|---|\n| 1 | 2 |";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(input);
		});

		it("preserves standard links", () => {
			const input = "[text](https://example.com)";
			expect(transformObsidianMarkdown(input, noopResolver)).toBe(input);
		});
	});
});
