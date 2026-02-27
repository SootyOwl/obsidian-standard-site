export interface BlobRef {
	$type: "blob";
	ref: { $link: string };
	mimeType: string;
	size: number;
}

export interface MarkpubMarkdown {
	$type: "at.markpub.markdown";
	text: string;
	flavor: "GFM" | "CommonMark";
	preferredRenderer?: string;
	extensions?: string[];
}

export interface DocumentRecord {
	$type: "site.standard.document";
	site: string;
	title: string;
	path?: string;
	description?: string;
	tags?: string[];
	publishedAt: string;
	updatedAt?: string;
	textContent?: string;
	content?: MarkpubMarkdown;
	coverImage?: BlobRef;
	bskyPostRef?: unknown;
	references?: Array<{ uri: string }>;
}

export interface PublicationRecord {
	$type: "site.standard.publication";
	url: string;
	name: string;
	description?: string;
	icon?: unknown;
	basicTheme?: unknown;
	preferences?: {
		showInDiscover?: boolean;
	};
}

export interface NoteFrontmatter {
	title?: string;
	publish?: boolean;
	tags?: string[];
	description?: string;
	slug?: string;
	rkey?: string;
	coverImage?: string;
}

export interface DocumentInput {
	siteUri: string;
	title: string;
	path: string;
	description?: string;
	tags?: string[];
	publishedAt: string;
	updatedAt?: string;
	markdown: string;
	plainText: string;
	coverImage?: BlobRef;
	references?: Array<{ uri: string }>;
}

export function buildDocumentRecord(input: DocumentInput): DocumentRecord {
	const record: DocumentRecord = {
		$type: "site.standard.document",
		site: input.siteUri,
		title: input.title,
		path: input.path,
		publishedAt: input.publishedAt,
		textContent: input.plainText,
		content: {
			$type: "at.markpub.markdown",
			text: input.markdown,
			flavor: "GFM",
		},
	};

	if (input.description) {
		record.description = input.description;
	}
	if (input.tags && input.tags.length > 0) {
		record.tags = input.tags;
	}
	if (input.updatedAt) {
		record.updatedAt = input.updatedAt;
	}
	if (input.coverImage) {
		record.coverImage = input.coverImage;
	if (input.references && input.references.length > 0) {
		record.references = input.references;
	}

	return record;
}
