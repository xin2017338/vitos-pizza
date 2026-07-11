import { parseTavily } from "../parsers.ts";
import type { SearchResult } from "../types.ts";
import { sanitizeError, timeoutSignal } from "../utils.ts";

export async function searchTavily(
	query: string,
	numResults: number,
	apiKey: string,
	signal?: AbortSignal,
): Promise<{ results: SearchResult[] }> {
	const response = await fetch("https://api.tavily.com/search", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			query,
			max_results: Math.min(numResults, 20),
			include_answer: false,
		}),
		signal: timeoutSignal(signal),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Tavily ${sanitizeError(response.status, text)}`);
	}

	const data = (await response.json()) as Record<string, unknown>;
	return { results: parseTavily(data, numResults) };
}
