export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function deriveDocumentPath(
	filePath: string,
	publishRoot: string,
	slugOverride?: string
): string {
	if (slugOverride) {
		const slug = slugOverride.startsWith("/") ? slugOverride : `/${slugOverride}`;
		return slug;
	}

	// Remove publish root prefix
	const root = publishRoot.replace(/\/$/, "");
	let relative = filePath;
	if (root && relative.startsWith(root + "/")) {
		relative = relative.slice(root.length + 1);
	} else if (root && relative.startsWith(root)) {
		relative = relative.slice(root.length);
	}

	// Remove .md extension
	relative = relative.replace(/\.md$/, "");

	// Split into directory parts and filename
	const parts = relative.split("/");
	const filename = parts.pop() || "";
	const dirs = parts;

	// Slugify the filename
	const slug = slugify(filename);

	// Reconstruct path
	const dirPath = dirs.length > 0 ? dirs.join("/") + "/" : "";
	return `/${dirPath}${slug}`;
}
