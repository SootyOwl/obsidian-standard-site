import { describe, it, expect } from "vitest";
import { deriveDocumentPath, slugify } from "../src/paths";

describe("slugify", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(slugify("My First Post")).toBe("my-first-post");
	});

	it("removes special characters", () => {
		expect(slugify("Hello, World! (2026)")).toBe("hello-world-2026");
	});

	it("collapses multiple hyphens", () => {
		expect(slugify("too   many   spaces")).toBe("too-many-spaces");
	});

	it("trims leading/trailing hyphens", () => {
		expect(slugify("--leading-and-trailing--")).toBe("leading-and-trailing");
	});
});

describe("deriveDocumentPath", () => {
	it("derives path from file path relative to publish root", () => {
		expect(deriveDocumentPath("blog/my-post.md", "")).toBe("/blog/my-post");
	});

	it("derives path from file in publish root", () => {
		expect(deriveDocumentPath("publish/blog/my-post.md", "publish")).toBe("/blog/my-post");
	});

	it("derives path from file at root", () => {
		expect(deriveDocumentPath("my-post.md", "")).toBe("/my-post");
	});

	it("slugifies the filename portion", () => {
		expect(deriveDocumentPath("blog/My First Post.md", "")).toBe("/blog/my-first-post");
	});

	it("uses slug override when provided", () => {
		expect(deriveDocumentPath("blog/my-post.md", "", "custom-slug")).toBe("/custom-slug");
	});

	it("handles nested folders", () => {
		expect(deriveDocumentPath("blog/tech/deep/post.md", "")).toBe("/blog/tech/deep/post");
	});

	it("handles publish root with trailing slash", () => {
		expect(deriveDocumentPath("publish/post.md", "publish/")).toBe("/post");
	});
});
