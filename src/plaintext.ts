export function markdownToPlainText(markdown: string): string {
	let text = markdown;

	// Remove code blocks, keep content
	text = text.replace(/```[\w]*\n([\s\S]*?)```/g, "$1");

	// Remove headings markers
	text = text.replace(/^#{1,6}\s+/gm, "");

	// Remove images, keep alt text
	text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

	// Remove links, keep text
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

	// Remove bold/italic
	text = text.replace(/\*\*\*(.*?)\*\*\*/g, "$1");
	text = text.replace(/\*\*(.*?)\*\*/g, "$1");
	text = text.replace(/\*(.*?)\*/g, "$1");

	// Remove inline code backticks
	text = text.replace(/`([^`]+)`/g, "$1");

	// Remove HTML tags (like <mark>)
	text = text.replace(/<[^>]+>/g, "");

	// Remove list markers
	text = text.replace(/^[\s]*[-*+]\s+/gm, "");
	text = text.replace(/^[\s]*\d+\.\s+/gm, "");

	// Remove blockquote markers
	text = text.replace(/^>\s?/gm, "");

	// Clean up extra blank lines
	text = text.replace(/\n{3,}/g, "\n\n");

	return text.trim();
}
