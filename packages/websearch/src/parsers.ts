import type { SearchResult } from "./types.ts";

export function parseTavily(
	data: Record<string, unknown>,
	numResults: number,
): SearchResult[] {
	const rawResults = data.results;
	const results = Array.isArray(rawResults) ? rawResults : [];
	return results.slice(0, numResults).map((r) => ({
		title: (r.title as string) || "",
		url: (r.url as string) || "",
		snippet: ((r.content as string) || "").slice(0, 500),
		content: r.content as string | undefined,
	}));
}

export function parseBrave(
	data: Record<string, unknown>,
	numResults: number,
): SearchResult[] {
	const web = data.web;
	if (!web || typeof web !== "object") {
		return [];
	}
	const rawResults = (web as Record<string, unknown>).results;
	const results = Array.isArray(rawResults) ? rawResults : [];
	return results.slice(0, numResults).map((r) => ({
		title: (r.title as string) || "",
		url: (r.url as string) || "",
		snippet: ((r.description as string) || "").slice(0, 500),
	}));
}

export function parseFirecrawl(
	data: Record<string, unknown>,
	numResults: number,
): SearchResult[] {
	const rawData = data.data;
	let results: Array<Record<string, unknown>> = [];
	if (Array.isArray(rawData)) {
		results = rawData;
	} else if (typeof rawData === "object" && rawData !== null) {
		const obj = rawData as Record<string, unknown>;
		results = Array.isArray(obj.web) ? obj.web : [];
		if (results.length === 0 && Array.isArray(obj.news)) {
			results = obj.news as Array<Record<string, unknown>>;
		}
	} else if (Array.isArray(data.results)) {
		results = data.results;
	}
	return results.slice(0, numResults).map((r) => ({
		title: (r.title as string) || "",
		url: (r.url as string) || "",
		snippet: ((r.description as string) || (r.snippet as string) || "").slice(
			0,
			500,
		),
	}));
}

export function parseExaMcpItems(
	items: Array<Record<string, unknown>>,
): SearchResult[] {
	return items.map((item) => ({
		title: (item.title as string) || "",
		url: (item.url as string) || "",
		snippet: (
			(item.snippet as string) ||
			(item.description as string) ||
			(item.content as string) ||
			""
		).slice(0, 500),
		content: item.content as string | undefined,
	}));
}
