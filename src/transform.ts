export type WikilinkResolver = (target: string) => string | null;

export function transformObsidianMarkdown(
	markdown: string,
	resolveWikilink: WikilinkResolver
): string {
	let result = markdown;

	// Remove multiline comments: %%\n...\n%%
	result = result.replace(/%%\n[\s\S]*?\n%%/g, "");

	// Remove inline comments: %%...%%
	result = result.replace(/%%.*?%%/g, "");

	// Convert highlights: ==text== → <mark>text</mark>
	result = result.replace(/==(.*?)==/g, "<mark>$1</mark>");

	// Remove embeds: ![[...]] (whole line if alone, inline otherwise)
	result = result.replace(/!\[\[.*?\]\]/g, "");

	// Convert callouts: > [!type] Title → > **Title**
	result = result.replace(/^(>\s*)\[!(\w+)\][^\S\n]*(.*)/gm, (_match, prefix, _type, title) => {
		return title ? `${prefix}**${title}**` : `${prefix}`;
	});

	// Resolve wikilinks: [[target|display]] or [[target]]
	result = result.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, display) => {
		const resolvedPath = resolveWikilink(target);
		const text = display || target.split("/").pop() || target;
		if (resolvedPath) {
			return `[${text}](${resolvedPath})`;
		}
		return text;
	});

	return result;
}
