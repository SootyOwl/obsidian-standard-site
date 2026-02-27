import { describe, it, expect } from "vitest";
import { prepareNoteForPublish, extractRkeyFromUri } from "../src/publish";
import type { BlobRef } from "../src/types";

describe("prepareNoteForPublish", () => {
	const defaultConfig = {
		siteUri: "at://did:plc:abc123/site.standard.publication/self",
		publishRoot: "",
	};

	const noopResolver = (_target: string) => null;

	it("prepares a complete document record from note data", () => {
		const result = prepareNoteForPublish({
			filePath: "blog/my-post.md",
			frontmatter: {
				title: "My Post",
				publish: true,
				tags: ["blog", "tech"],
				description: "A short excerpt",
			},
			body: "# My Post\n\nHello ==world==",
			config: defaultConfig,
			resolveWikilink: noopResolver,
		});

		expect(result.record.title).toBe("My Post");
		expect(result.record.path).toBe("/blog/my-post");
		expect(result.record.tags).toEqual(["blog", "tech"]);
		expect(result.record.description).toBe("A short excerpt");
		expect(result.record.content).toEqual({
			$type: "at.markpub.markdown",
			text: "# My Post\n\nHello <mark>world</mark>",
			flavor: "GFM",
		});
		expect(result.record.textContent).toBe("My Post\n\nHello world");
	});

	it("uses filename as title when no title in frontmatter", () => {
		const result = prepareNoteForPublish({
			filePath: "my-post.md",
			frontmatter: { publish: true },
			body: "Some content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
		});

		expect(result.record.title).toBe("my-post");
	});

	it("uses slug override for path", () => {
		const result = prepareNoteForPublish({
			filePath: "blog/my-post.md",
			frontmatter: { title: "My Post", publish: true, slug: "custom-path" },
			body: "Content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
		});

		expect(result.record.path).toBe("/custom-path");
	});

	it("sets publishedAt to now for new posts", () => {
		const before = new Date().toISOString();
		const result = prepareNoteForPublish({
			filePath: "post.md",
			frontmatter: { title: "Post", publish: true },
			body: "Content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
		});
		const after = new Date().toISOString();

		expect(result.record.publishedAt >= before).toBe(true);
		expect(result.record.publishedAt <= after).toBe(true);
	});

	it("sets updatedAt for existing posts", () => {
		const result = prepareNoteForPublish({
			filePath: "post.md",
			frontmatter: { title: "Post", publish: true, rkey: "existing123" },
			body: "Updated content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
			existingPublishedAt: "2026-01-01T00:00:00.000Z",
		});

		expect(result.record.publishedAt).toBe("2026-01-01T00:00:00.000Z");
		expect(result.record.updatedAt).toBeDefined();
	});

	it("indicates create vs update based on rkey presence", () => {
		const newResult = prepareNoteForPublish({
			filePath: "post.md",
			frontmatter: { title: "Post", publish: true },
			body: "Content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
		});
		expect(newResult.isUpdate).toBe(false);

		const updateResult = prepareNoteForPublish({
			filePath: "post.md",
			frontmatter: { title: "Post", publish: true, rkey: "existing123" },
			body: "Content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
			existingPublishedAt: "2026-01-01T00:00:00.000Z",
		});
		expect(updateResult.isUpdate).toBe(true);
		expect(updateResult.rkey).toBe("existing123");
	});

	it("includes coverImage in record when provided", () => {
		const coverImage: BlobRef = {
			$type: "blob",
			ref: { $link: "bafyreia..." },
			mimeType: "image/png",
			size: 1024,
		};
		const result = prepareNoteForPublish({
			filePath: "post.md",
			frontmatter: { title: "Post with Cover", publish: true },
			body: "Content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
			coverImage,
		});

		expect(result.record.coverImage).toEqual(coverImage);
	});

	it("omits coverImage from record when not provided", () => {
		const result = prepareNoteForPublish({
			filePath: "post.md",
			frontmatter: { title: "Post", publish: true },
			body: "Content",
			config: defaultConfig,
			resolveWikilink: noopResolver,
		});

		expect(result.record.coverImage).toBeUndefined();
	});
});

describe("extractRkeyFromUri", () => {
	it("extracts rkey from AT-URI", () => {
		expect(extractRkeyFromUri("at://did:plc:abc/site.standard.document/xyz123")).toBe("xyz123");
	});
});
