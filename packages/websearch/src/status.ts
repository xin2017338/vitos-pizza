import { fetchExaMCP } from "./backends/exa-mcp.ts";
import { fetchFirecrawl } from "./backends/firecrawl.ts";
import { resolveBackendKey } from "./credentials.ts";
import { readWithJina } from "./readers/jina.ts";
import type { SearchConfig } from "./types.ts";

export async function readUrlWithFallback(
	url: string,
	searchConfig: SearchConfig,
	signal?: AbortSignal,
): Promise<{ title: string; url: string; content: string; reader: string }> {
	const reader = searchConfig.reader ?? "jina";
	const errors: string[] = [];

	if (reader === "exa_mcp") {
		try {
			const result = await fetchExaMCP(url, signal);
			return { ...result, reader: "exa_mcp" };
		} catch (error) {
			errors.push(
				`exa_mcp: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	} else {
		try {
			const result = await readWithJina(url, searchConfig, signal);
			return { ...result, reader: "jina" };
		} catch (error) {
			errors.push(
				`jina: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	try {
		const firecrawlKey = resolveBackendKey("firecrawl", searchConfig);
		const result = await fetchFirecrawl(url, firecrawlKey, signal);
		return { ...result, reader: "firecrawl" };
	} catch (error) {
		errors.push(
			`firecrawl: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (reader !== "exa_mcp") {
		try {
			const result = await fetchExaMCP(url, signal);
			return { ...result, reader: "exa_mcp" };
		} catch (error) {
			errors.push(
				`exa_mcp: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	throw new Error(
		`All web_read backends failed:\n${errors.map((entry) => `- ${entry}`).join("\n")}`,
	);
}

export function normalizeUrl(url: string): string {
	return url.startsWith("http://") || url.startsWith("https://")
		? url
		: `https://${url}`;
}

export function buildSearchStatus(
	searchConfig: SearchConfig,
	activeBackends: string[],
): string {
	const lines = [
		"# Web Search Status",
		"",
		`Default backend: ${searchConfig.defaultBackend ?? "auto"}`,
		`Reader: ${searchConfig.reader ?? "jina"}`,
		"",
		"## Active backends",
	];

	if (activeBackends.length === 0) {
		lines.push("- (none)");
	} else {
		for (const backend of activeBackends) {
			const keyState =
				backend === "exa_mcp"
					? "no key required"
					: backend === "firecrawl"
						? resolveBackendKey("firecrawl", searchConfig)
							? "key configured"
							: "keyless"
						: resolveBackendKey(backend, searchConfig)
							? "key configured"
							: "missing key";
			lines.push(`- ${backend}: enabled (${keyState})`);
		}
	}

	lines.push("", "Config paths:");
	lines.push("- Global: ~/.pi/agent/extensions/search.json");
	lines.push("- Project: .pi/search.json");

	return lines.join("\n");
}
