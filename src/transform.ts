export interface ResolvedWikilink {
	path: string;
	uri?: string;
}

export type WikilinkResolver = (target: string) => ResolvedWikilink | null;

export interface TransformResult {
	text: string;
	references: Array<{ uri: string }>;
}

export function transformObsidianMarkdown(
	markdown: string,
	resolveWikilink: WikilinkResolver
): TransformResult {
	let result = markdown;
	const references: Array<{ uri: string }> = [];

	result = result.replace(/%%\n[\s\S]*?\n%%/g, "");
	result = result.replace(/%%.*?%%/g, "");
	result = result.replace(/==(.*?)==/g, "<mark>$1</mark>");
	result = result.replace(/!\[\[.*?\]\]/g, "");
	result = result.replace(/^(>\s*)\[!(\w+)\][^\S\n]*(.*)/gm, (_match, prefix, _type, title) => {
		return title ? `${prefix}**${title}**` : `${prefix}`;
	});
	result = result.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, display) => {
		const resolved = resolveWikilink(target);
		const text = display || target.split("/").pop() || target;
		if (resolved) {
			if (resolved.uri) {
				references.push({ uri: resolved.uri });
			}
			return `[${text}](${resolved.path})`;
		}
		return text;
	});

	return { text: result, references };
}
