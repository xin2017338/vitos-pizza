import { parseFirecrawl } from "../parsers.ts";
import type { SearchResult } from "../types.ts";
import { sanitizeError, timeoutSignal } from "../utils.ts";

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

function buildHeaders(apiKey?: string): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (apiKey) {
		headers.Authorization = `Bearer ${apiKey}`;
	}
	return headers;
}

export async function searchFirecrawl(
	query: string,
	numResults: number,
	apiKey: string | undefined,
	signal?: AbortSignal,
): Promise<{ results: SearchResult[] }> {
	const response = await fetch(FIRECRAWL_SEARCH_URL, {
		method: "POST",
		headers: buildHeaders(apiKey),
		body: JSON.stringify({
			query,
			limit: Math.min(numResults, 20),
		}),
		signal: timeoutSignal(signal),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Firecrawl ${sanitizeError(response.status, text)}`);
	}

	const data = (await response.json()) as Record<string, unknown>;
	return { results: parseFirecrawl(data, numResults) };
}

export async function fetchFirecrawl(
	url: string,
	apiKey: string | undefined,
	signal?: AbortSignal,
): Promise<{ title: string; url: string; content: string }> {
	const response = await fetch(FIRECRAWL_SCRAPE_URL, {
		method: "POST",
		headers: buildHeaders(apiKey),
		body: JSON.stringify({
			url,
			formats: ["markdown"],
		}),
		signal: timeoutSignal(signal),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Firecrawl ${sanitizeError(response.status, text)}`);
	}

	const data = (await response.json()) as Record<string, unknown>;
	const payload = data.data;
	if (!payload || typeof payload !== "object") {
		throw new Error(`Firecrawl scrape returned no content for ${url}`);
	}
	const record = payload as Record<string, unknown>;
	const metadata =
		(record.metadata as Record<string, unknown> | undefined) ?? {};
	const content =
		(record.markdown as string) ||
		(record.content as string) ||
		(record.text as string) ||
		"";

	if (!content.trim()) {
		throw new Error(`Firecrawl scrape returned empty content for ${url}`);
	}

	return {
		title: (metadata.title as string) || "",
		url: (metadata.sourceURL as string) || url,
		content,
	};
}
