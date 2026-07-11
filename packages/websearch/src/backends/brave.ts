import { parseBrave } from "../parsers.ts";
import type { SearchResult } from "../types.ts";
import { sanitizeError, timeoutSignal } from "../utils.ts";

export async function searchBrave(
	query: string,
	numResults: number,
	apiKey: string,
	signal?: AbortSignal,
): Promise<{ results: SearchResult[] }> {
	const params = new URLSearchParams({
		q: query,
		count: String(Math.min(numResults, 20)),
	});
	const response = await fetch(
		`https://api.search.brave.com/res/v1/web/search?${params}`,
		{
			method: "GET",
			headers: {
				Accept: "application/json",
				"Accept-Encoding": "gzip",
				"X-Subscription-Token": apiKey,
			},
			signal: timeoutSignal(signal),
		},
	);

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Brave ${sanitizeError(response.status, text)}`);
	}

	const data = (await response.json()) as Record<string, unknown>;
	return { results: parseBrave(data, numResults) };
}
