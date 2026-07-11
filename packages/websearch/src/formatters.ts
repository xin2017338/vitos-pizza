import type { SearchResult } from "./types.ts";

export function formatSearchResults(
	query: string,
	results: SearchResult[],
	backend: string,
): string {
	const lines = [`# Web Search: ${query}`, "", `*Backend: ${backend}*`, ""];
	if (results.length === 0) {
		lines.push("No results found.");
		return lines.join("\n");
	}

	for (const [index, result] of results.entries()) {
		lines.push(`## ${index + 1}. ${result.title || "Untitled"}`);
		if (result.url) {
			lines.push(result.url);
		}
		if (result.snippet) {
			lines.push("");
			lines.push(result.snippet);
		}
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function formatReadResult(
	url: string,
	content: string,
	reader: string,
	title?: string,
): string {
	const lines = [
		`# Web Read: ${title || url}`,
		"",
		`*Reader: ${reader}*`,
		`*URL: ${url}*`,
		"",
		content.trim(),
	];
	return lines.join("\n").trimEnd();
}
