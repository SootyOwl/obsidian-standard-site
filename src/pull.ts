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

/**
 * Escape a YAML scalar value by quoting it if necessary.
 * Handles colons, quotes, newlines, and other special characters.
 */
function escapeYamlScalar(value: string): string {
	// Check if the value needs quoting
	const needsQuoting = /[:#@\[\]\{\}|>*&!%`'"\\\r\n]/.test(value) ||
		value.trim() !== value ||
		value.startsWith('-') ||
		value.startsWith('?') ||
		/^(true|false|null|yes|no|on|off)$/i.test(value);

	if (!needsQuoting) {
		return value;
	}

	// Use double quotes and escape internal double quotes and backslashes
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
}

/**
 * Format a YAML array of strings.
 */
function formatYamlArray(items: string[]): string {
	return `[${items.map(item => escapeYamlScalar(item)).join(', ')}]`;
}

/**
 * Sanitize a path from a remote record to prevent path traversal.
 * Removes leading slashes, rejects parent directory segments, and validates characters.
 */
function sanitizePath(path: string): string {
	// Remove leading slash
	let sanitized = path.replace(/^\/+/, '');

	// Split into segments and validate each one
	const segments = sanitized.split('/');
	const validSegments: string[] = [];

	for (const segment of segments) {
		// Reject empty segments (double slashes)
		if (segment === '') continue;

		// Reject parent directory traversal
		if (segment === '..' || segment === '.') {
			throw new Error(`Invalid path segment in remote record: "${segment}"`);
		}

		// Reject segments with invalid characters (NUL bytes, control characters)
		if (/[\x00-\x1f\x7f]/.test(segment)) {
			throw new Error(`Invalid characters in path segment: "${segment}"`);
		}

		validSegments.push(segment);
	}

	return validSegments.join('/');
}

export function buildNoteFromRecord(input: PullRecordInput): PullResult {
	const { rkey, value } = input;

	// Build frontmatter
	const fmLines: string[] = ["---"];
	if (value.title) fmLines.push(`title: ${escapeYamlScalar(value.title)}`);
	fmLines.push("publish: true");
	fmLines.push(`rkey: ${rkey}`);
	if (value.description) fmLines.push(`description: ${escapeYamlScalar(value.description)}`);
	if (value.tags && value.tags.length > 0) {
		fmLines.push(`tags: ${formatYamlArray(value.tags)}`);
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
	const sanitizedPath = sanitizePath(docPath);
	const relativePath = sanitizedPath + ".md";

	return { frontmatter, body, relativePath };
}
