export function parseTitleResponse(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (trimmed.toUpperCase() === "SKIP") return null;
	return trimmed;
}
