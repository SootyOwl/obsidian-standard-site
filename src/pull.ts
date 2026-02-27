export interface PullRecordInput {
	rkey: string;
	value: {
		title?: string;
		path?: string;
		description?: string;
		tags?: string[];
		publishedAt?: string;
		textContent?: string;
		content?: {
			$type: string;
			text?: string;
			flavor?: string;
		};
	};
}

export interface PullResult {
	frontmatter: string;
	body: string;
	relativePath: string;
}

function yamlEscape(str: string): string {
	if (
		/[\\":#{}\[\],&*?|>!%@`'\t\n\r]/.test(str) ||
		str.trim() !== str ||
		str.startsWith("-") ||
		str.startsWith("?") ||
		/^(true|false|null|yes|no|on|off)$/i.test(str)
	) {
		return '"' + str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
	}
	return str;
}

function sanitizePath(path: string): string {
	const sanitized = path.replace(/^\/+/, "");
	const segments = sanitized.split("/").filter((s) => s !== "");
	for (const segment of segments) {
		if (segment === ".." || segment === ".") {
			throw new Error(`Invalid path segment in remote record: "${segment}"`);
		}
		if (/[\x00-\x1f\x7f]/.test(segment)) {
			throw new Error(`Invalid characters in path segment: "${segment}"`);
		}
	}
	return segments.join("/");
}

export function buildNoteFromRecord(input: PullRecordInput): PullResult {
	const { rkey, value } = input;

	// Build frontmatter
	const fmLines: string[] = ["---"];
	if (value.title) fmLines.push(`title: ${yamlEscape(value.title)}`);
	fmLines.push("publish: true");
	fmLines.push(`rkey: ${rkey}`);
	if (value.description) fmLines.push(`description: ${yamlEscape(value.description)}`);
	if (value.tags && value.tags.length > 0) {
		fmLines.push(`tags: [${value.tags.map((t) => yamlEscape(t)).join(", ")}]`);
	}
	if (value.publishedAt) fmLines.push(`date: ${value.publishedAt}`);
	fmLines.push("---");

	const frontmatter = fmLines.join("\n");

	// Extract body
	let body = "";
	if (value.content && value.content.$type === "at.markpub.markdown" && value.content.text) {
		body = value.content.text;
	} else if (value.textContent) {
		body = value.textContent;
	}

	// Derive file path from document path (sanitize against path traversal)
	const docPath = value.path || "/untitled";
	const sanitizedPath = sanitizePath(docPath);
	const relativePath = sanitizedPath + ".md";

	return { frontmatter, body, relativePath };
}
