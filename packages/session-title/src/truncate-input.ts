export function truncateInput(text: string, maxChars: number): string {
	const trimmed = text.trim();
	if (trimmed.length <= maxChars) return trimmed;
	const slice = trimmed.slice(0, maxChars);
	const lastSpace = slice.lastIndexOf(" ");
	if (lastSpace > maxChars * 0.6) {
		return slice.slice(0, lastSpace).trim();
	}
	return slice.trim();
}
