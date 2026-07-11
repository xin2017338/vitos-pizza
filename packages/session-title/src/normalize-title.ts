import { truncateInput } from "./truncate-input.ts";

export function normalizeTitle(title: string, maxLength = 48): string {
	const cleaned = title
		.trim()
		.replace(/^["']+|["']+$/g, "")
		.trim()
		.replace(/\s+/g, " ");
	if (!cleaned) return "";
	if ([...cleaned].length <= maxLength) return cleaned;
	return [...cleaned].slice(0, maxLength).join("").trim();
}

export function fallbackTitleFromPrompt(
	prompt: string,
	maxLength = 48,
): string {
	const snippet = truncateInput(prompt, maxLength);
	return normalizeTitle(snippet, maxLength);
}
