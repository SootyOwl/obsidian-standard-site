import { describe, it, expect } from "vitest";
import {
	type PublicationRecord,
	type DocumentRecord,
	type MarkpubMarkdown,
	type NoteFrontmatter,
	type BlobRef,
	buildDocumentRecord,
} from "../src/types";

describe("buildDocumentRecord", () => {
	it("builds a complete document record from note data", () => {
		const record = buildDocumentRecord({
			siteUri: "at://did:plc:abc123/site.standard.publication/self",
			title: "My Post",
			path: "/blog/my-post",
			description: "A short excerpt",
			tags: ["blog", "tech"],
			publishedAt: "2026-02-26T12:00:00.000Z",
			markdown: "# My Post\n\nHello world",
			plainText: "My Post\n\nHello world",
		});

		expect(record.$type).toBe("site.standard.document");
		expect(record.site).toBe("at://did:plc:abc123/site.standard.publication/self");
		expect(record.title).toBe("My Post");
		expect(record.path).toBe("/blog/my-post");
		expect(record.description).toBe("A short excerpt");
		expect(record.tags).toEqual(["blog", "tech"]);
		expect(record.publishedAt).toBe("2026-02-26T12:00:00.000Z");
		expect(record.textContent).toBe("My Post\n\nHello world");
		expect(record.content).toEqual({
			$type: "at.markpub.markdown",
			text: "# My Post\n\nHello world",
			flavor: "GFM",
		});
	});

	it("omits optional fields when not provided", () => {
		const record = buildDocumentRecord({
			siteUri: "at://did:plc:abc123/site.standard.publication/self",
			title: "Minimal Post",
			path: "/minimal",
			publishedAt: "2026-02-26T12:00:00.000Z",
			markdown: "Content",
			plainText: "Content",
		});

		expect(record.description).toBeUndefined();
		expect(record.tags).toBeUndefined();
	});

	it("includes updatedAt when provided", () => {
		const record = buildDocumentRecord({
			siteUri: "at://did:plc:abc123/site.standard.publication/self",
			title: "Updated Post",
			path: "/updated",
			publishedAt: "2026-02-26T12:00:00.000Z",
			updatedAt: "2026-02-27T12:00:00.000Z",
			markdown: "Updated content",
			plainText: "Updated content",
		});

		expect(record.updatedAt).toBe("2026-02-27T12:00:00.000Z");
	});

	it("includes coverImage when provided", () => {
		const coverImage: BlobRef = {
			$type: "blob",
			ref: { $link: "bafyreia..." },
			mimeType: "image/png",
			size: 1024,
		};
		const record = buildDocumentRecord({
			siteUri: "at://did:plc:abc123/site.standard.publication/self",
			title: "Post with Cover",
			path: "/cover",
			publishedAt: "2026-02-26T12:00:00.000Z",
			markdown: "Content",
			plainText: "Content",
			coverImage,
		});

		expect(record.coverImage).toEqual(coverImage);
	});

	it("omits coverImage when not provided", () => {
		const record = buildDocumentRecord({
			siteUri: "at://did:plc:abc123/site.standard.publication/self",
			title: "No Cover",
			path: "/no-cover",
			publishedAt: "2026-02-26T12:00:00.000Z",
			markdown: "Content",
			plainText: "Content",
		});

		expect(record.coverImage).toBeUndefined();
	});
});
