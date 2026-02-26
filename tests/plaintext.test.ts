import { describe, it, expect } from "vitest";
import { markdownToPlainText } from "../src/plaintext";

describe("markdownToPlainText", () => {
	it("strips headings", () => {
		expect(markdownToPlainText("# Heading\n\nParagraph")).toBe("Heading\n\nParagraph");
	});

	it("strips bold and italic", () => {
		expect(markdownToPlainText("**bold** and *italic*")).toBe("bold and italic");
	});

	it("strips links, keeps text", () => {
		expect(markdownToPlainText("[click here](https://example.com)")).toBe("click here");
	});

	it("strips inline code backticks", () => {
		expect(markdownToPlainText("Use `console.log`")).toBe("Use console.log");
	});

	it("strips code blocks, keeps content", () => {
		expect(markdownToPlainText("```js\nconst x = 1;\n```")).toBe("const x = 1;");
	});

	it("strips images", () => {
		expect(markdownToPlainText("![alt](url)")).toBe("alt");
	});

	it("strips <mark> tags", () => {
		expect(markdownToPlainText("<mark>highlighted</mark>")).toBe("highlighted");
	});

	it("preserves list content", () => {
		expect(markdownToPlainText("- item one\n- item two")).toBe("item one\nitem two");
	});

	it("preserves blockquote content", () => {
		expect(markdownToPlainText("> quoted text")).toBe("quoted text");
	});
});
