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

export function buildNoteFromRecord(input: PullRecordInput): PullResult {
	const { rkey, value } = input;

	// Build frontmatter
	const fmLines: string[] = ["---"];
	if (value.title) fmLines.push(`title: ${value.title}`);
	fmLines.push("publish: true");
	fmLines.push(`rkey: ${rkey}`);
	if (value.description) fmLines.push(`description: ${value.description}`);
	if (value.tags && value.tags.length > 0) {
		fmLines.push(`tags: [${value.tags.join(", ")}]`);
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

	// Derive file path from document path
	const docPath = value.path || "/untitled";
	const relativePath = docPath.replace(/^\//, "") + ".md";

	return { frontmatter, body, relativePath };
}
