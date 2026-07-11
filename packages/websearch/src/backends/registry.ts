import { config } from "../config.ts";
import { resolveBackendKey } from "../credentials.ts";
import type { BackendRunner, SearchResult } from "../types.ts";
import { MISSING_KEY_HELP } from "../utils.ts";
import { searchBrave } from "./brave.ts";
import { searchExaMCP } from "./exa-mcp.ts";
import { searchFirecrawl } from "./firecrawl.ts";
import { searchTavily } from "./tavily.ts";

export const BACKEND_DEFS: Record<string, BackendRunner> = {
	exa_mcp: {
		needsKey: false,
		optionalKey: false,
		label: "Exa MCP",
		search: async (query, numResults, { signal }) => {
			const result = await searchExaMCP(query, numResults, signal);
			return {
				results: result.results.map((entry) => ({
					...entry,
					backend: "exa_mcp",
				})),
			};
		},
	},
	firecrawl: {
		needsKey: false,
		optionalKey: true,
		label: "Firecrawl",
		search: async (query, numResults, { key, signal }) => {
			const result = await searchFirecrawl(query, numResults, key, signal);
			return {
				results: result.results.map((entry) => ({
					...entry,
					backend: "firecrawl",
				})),
			};
		},
	},
	tavily: {
		needsKey: true,
		optionalKey: false,
		label: "Tavily",
		search: async (query, numResults, { key, signal }) => {
			if (!key) {
				throw new Error(`Tavily backend not configured. ${MISSING_KEY_HELP}`);
			}
			const result = await searchTavily(query, numResults, key, signal);
			return {
				results: result.results.map((entry) => ({
					...entry,
					backend: "tavily",
				})),
			};
		},
	},
	brave: {
		needsKey: true,
		optionalKey: false,
		label: "Brave",
		search: async (query, numResults, { key, signal }) => {
			if (!key) {
				throw new Error(`Brave backend not configured. ${MISSING_KEY_HELP}`);
			}
			const result = await searchBrave(query, numResults, key, signal);
			return {
				results: result.results.map((entry) => ({
					...entry,
					backend: "brave",
				})),
			};
		},
	},
};

export async function runBackend(
	backend: string,
	query: string,
	numResults: number,
	signal?: AbortSignal,
): Promise<SearchResult[]> {
	const def = BACKEND_DEFS[backend];
	if (!def) {
		throw new Error(`Unknown backend: ${backend}`);
	}

	let key: string | undefined;
	if (def.needsKey || def.optionalKey) {
		key = resolveBackendKey(backend, config);
		if (def.needsKey && !key) {
			throw new Error(
				`${def.label} backend not configured. ${MISSING_KEY_HELP}`,
			);
		}
	}

	const result = await def.search(query, numResults, { key, signal });
	return result.results;
}
