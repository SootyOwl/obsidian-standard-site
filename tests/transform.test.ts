import { describe, it, expect } from "vitest";
import { transformObsidianMarkdown, type ResolvedWikilink } from "../src/transform";

const noopResolver = (_target: string) => null;

describe("transformObsidianMarkdown", () => {
	describe("comments", () => {
		it("removes Obsidian comments", () => {
			const input = "Before %%secret comment%% after";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("Before  after");
		});
		it("removes multiline comments", () => {
			const input = "Before\n%%\nmultiline\ncomment\n%%\nafter";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("Before\n\nafter");
		});
	});

	describe("highlights", () => {
		it("converts highlights to <mark> tags", () => {
			const input = "This is ==highlighted== text";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("This is <mark>highlighted</mark> text");
		});
		it("handles multiple highlights", () => {
			const input = "==one== and ==two==";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("<mark>one</mark> and <mark>two</mark>");
		});
	});

	describe("embeds", () => {
		it("removes image embeds", () => {
			const input = "Before\n![[image.png]]\nafter";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("Before\n\nafter");
		});
		it("removes embeds with alt text", () => {
			const input = "Before\n![[document.pdf|My PDF]]\nafter";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("Before\n\nafter");
		});
	});

	describe("callouts", () => {
		it("converts callouts to plain blockquotes", () => {
			const input = "> [!note] Title\n> Content here";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("> **Title**\n> Content here");
		});
		it("converts callouts without title", () => {
			const input = "> [!warning]\n> Be careful";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe("> \n> Be careful");
		});
	});

	describe("passthrough", () => {
		it("preserves standard markdown", () => {
			const input = "# Heading\n\n**bold** and *italic*\n\n- list item\n\n```js\ncode\n```";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe(input);
		});
		it("preserves GFM tables", () => {
			const input = "| a | b |\n|---|---|\n| 1 | 2 |";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe(input);
		});
		it("preserves standard links", () => {
			const input = "[text](https://example.com)";
			expect(transformObsidianMarkdown(input, noopResolver).text).toBe(input);
		});
	});

	describe("wikilinks", () => {
		const resolver = (target: string): ResolvedWikilink | null => {
			const published: Record<string, ResolvedWikilink> = {
				"My Other Post": { path: "/blog/my-other-post" },
				"recipes/Pasta": { path: "/recipes/pasta" },
			};
			return published[target] ?? null;
		};

		it("resolves published wikilinks to markdown links", () => {
			const input = "Check out [[My Other Post]]";
			expect(transformObsidianMarkdown(input, resolver).text).toBe("Check out [My Other Post](/blog/my-other-post)");
		});
		it("resolves wikilinks with display text", () => {
			const input = "Check out [[My Other Post|this post]]";
			expect(transformObsidianMarkdown(input, resolver).text).toBe("Check out [this post](/blog/my-other-post)");
		});
		it("converts unpublished wikilinks to plain text", () => {
			const input = "See [[Unpublished Draft]]";
			expect(transformObsidianMarkdown(input, resolver).text).toBe("See Unpublished Draft");
		});
		it("converts unpublished wikilinks with display text to plain text", () => {
			const input = "See [[Unpublished Draft|my draft]]";
			expect(transformObsidianMarkdown(input, resolver).text).toBe("See my draft");
		});
		it("resolves subpath wikilinks", () => {
			const input = "Make [[recipes/Pasta]]";
			expect(transformObsidianMarkdown(input, resolver).text).toBe("Make [Pasta](/recipes/pasta)");
		});
		it("handles multiple wikilinks in one line", () => {
			const input = "[[My Other Post]] and [[Unpublished Draft]]";
			expect(transformObsidianMarkdown(input, resolver).text).toBe("[My Other Post](/blog/my-other-post) and Unpublished Draft");
		});
	});

	describe("references", () => {
		it("returns empty references when no wikilinks have URIs", () => {
			const resolver = (target: string): ResolvedWikilink | null => {
				if (target === "My Post") return { path: "/my-post" };
				return null;
			};
			const result = transformObsidianMarkdown("See [[My Post]]", resolver);
			expect(result.references).toEqual([]);
		});
		it("collects references from resolved wikilinks with URIs", () => {
			const resolver = (target: string): ResolvedWikilink | null => {
				if (target === "My Post") return { path: "/my-post", uri: "at://did:plc:abc/site.standard.document/xyz" };
				return null;
			};
			const result = transformObsidianMarkdown("See [[My Post]]", resolver);
			expect(result.references).toEqual([{ uri: "at://did:plc:abc/site.standard.document/xyz" }]);
		});
		it("collects multiple references", () => {
			const resolver = (target: string): ResolvedWikilink | null => {
				const map: Record<string, ResolvedWikilink> = {
					"Post A": { path: "/post-a", uri: "at://did:plc:abc/site.standard.document/aaa" },
					"Post B": { path: "/post-b", uri: "at://did:plc:abc/site.standard.document/bbb" },
				};
				return map[target] ?? null;
			};
			const result = transformObsidianMarkdown("[[Post A]] and [[Post B]]", resolver);
			expect(result.references).toEqual([
				{ uri: "at://did:plc:abc/site.standard.document/aaa" },
				{ uri: "at://did:plc:abc/site.standard.document/bbb" },
			]);
		});
		it("does not collect references for unresolved wikilinks", () => {
			const result = transformObsidianMarkdown("[[Unknown]]", noopResolver);
			expect(result.references).toEqual([]);
		});
		it("returns empty references when no wikilinks present", () => {
			const result = transformObsidianMarkdown("No links here", noopResolver);
			expect(result.references).toEqual([]);
		});
	});
});
