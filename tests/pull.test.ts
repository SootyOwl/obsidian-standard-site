import { describe, it, expect } from "vitest";
import { buildNoteFromRecord } from "../src/pull";

describe("buildNoteFromRecord", () => {
	it("builds frontmatter and body from a PDS record", () => {
		const result = buildNoteFromRecord({
			rkey: "abc123",
			value: {
				title: "Remote Post",
				path: "/blog/remote-post",
				description: "A post from the PDS",
				tags: ["imported"],
				publishedAt: "2026-02-26T12:00:00.000Z",
				textContent: "Plain text content",
				content: {
					$type: "at.markpub.markdown",
					text: "# Remote Post\n\nMarkdown content",
					flavor: "GFM",
				},
			},
		});

		expect(result.frontmatter).toContain("title: Remote Post");
		expect(result.frontmatter).toContain("publish: true");
		expect(result.frontmatter).toContain("rkey: abc123");
		expect(result.frontmatter).toContain("description: A post from the PDS");
		expect(result.body).toBe("# Remote Post\n\nMarkdown content");
	});

	it("falls back to textContent when no markdown content", () => {
		const result = buildNoteFromRecord({
			rkey: "abc123",
			value: {
				title: "Plain Post",
				path: "/plain-post",
				publishedAt: "2026-02-26T12:00:00.000Z",
				textContent: "Just plain text",
			},
		});

		expect(result.body).toBe("Just plain text");
	});

	it("derives filename from path", () => {
		const result = buildNoteFromRecord({
			rkey: "abc123",
			value: {
				title: "Nested Post",
				path: "/blog/tech/nested-post",
				publishedAt: "2026-02-26T12:00:00.000Z",
				textContent: "Content",
			},
		});

		expect(result.relativePath).toBe("blog/tech/nested-post.md");
	});

	it("handles root-level path", () => {
		const result = buildNoteFromRecord({
			rkey: "abc123",
			value: {
				title: "Root Post",
				path: "/root-post",
				publishedAt: "2026-02-26T12:00:00.000Z",
				textContent: "Content",
			},
		});

		expect(result.relativePath).toBe("root-post.md");
	});
});
