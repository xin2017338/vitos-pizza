/**
 * @vitos-pizza/websearch — web search and URL reading for Vito's Pizzeria.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config, refreshConfig } from "../src/config.ts";
import { runSearchWithFallback } from "../src/dispatch.ts";
import { formatReadResult, formatSearchResults } from "../src/formatters.ts";
import {
	type WebReadInput,
	WebReadParams,
	type WebSearchInput,
	WebSearchParams,
} from "../src/schema.ts";
import {
	buildSearchStatus,
	normalizeUrl,
	readUrlWithFallback,
} from "../src/status.ts";
import { validateUrl } from "../src/utils.ts";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web using configured backends. Auto mode tries Exa MCP, Firecrawl, and optional keyed providers.",
		promptSnippet:
			"Search the web only when local context is insufficient for current external facts",
		promptGuidelines: [
			"Do not use web_search when the answer is already in the repo, conversation, or local tools (read/grep/find/ls)",
			"Use web_search only when you need current external facts, docs, or news that local context cannot provide",
			"Auto mode tries enabled backends in order; Exa MCP works without API keys",
			"Configure Tavily or Brave in .pi/search.json for higher-quality results",
		],
		parameters: WebSearchParams,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const input = params as WebSearchInput;
			refreshConfig(ctx.cwd);
			const numResults = Math.max(1, Math.min(input.numResults ?? 5, 20));
			const backend = input.backend ?? "auto";

			onUpdate?.({
				content: [{ type: "text", text: `*Searching: ${input.query}*` }],
				details: {},
			});
			ctx.ui.setStatus("search", `Searching: ${input.query}`);

			try {
				const result = await runSearchWithFallback(input.query, numResults, {
					backend,
					signal,
				});
				const text = formatSearchResults(
					input.query,
					result.results,
					result.backend,
				);
				return {
					content: [{ type: "text", text }],
					details: {
						backend: result.backend,
						resultCount: result.results.length,
						errors: result.errors,
					},
				};
			} finally {
				ctx.ui.setStatus("search", "");
			}
		},
	});

	pi.registerTool({
		name: "web_read",
		label: "Read Web Page",
		description:
			"Fetch a URL as markdown. Uses Jina Reader by default, then Firecrawl or Exa MCP as fallback.",
		promptSnippet: "Read content from a specific URL",
		promptGuidelines: [
			"Use web_read when you already have a URL and need the page content",
			"Prefer web_search first when you do not yet know which pages to open",
		],
		parameters: WebReadParams,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const input = params as WebReadInput;
			refreshConfig(ctx.cwd);
			const url = normalizeUrl(input.url);
			const ssrfError = validateUrl(url);
			if (ssrfError) {
				throw new Error(ssrfError);
			}

			onUpdate?.({
				content: [{ type: "text", text: `*Reading: ${url}*` }],
				details: {},
			});
			ctx.ui.setStatus("read", `Reading: ${url}`);

			try {
				const result = await readUrlWithFallback(url, config, signal);
				const text = formatReadResult(
					url,
					result.content,
					result.reader,
					result.title,
				);
				return {
					content: [{ type: "text", text }],
					details: {
						reader: result.reader,
						url: result.url,
						title: result.title,
					},
				};
			} finally {
				ctx.ui.setStatus("read", "");
			}
		},
	});

	pi.registerCommand("search-status", {
		description: "Show active web search backends and key status",
		handler: async (_args, ctx) => {
			const activeBackends = refreshConfig(ctx.cwd, true);
			ctx.ui.notify(buildSearchStatus(config, activeBackends), "info");
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		refreshConfig(ctx.cwd, true);
	});
}
