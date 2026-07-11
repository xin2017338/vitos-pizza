import { runBackend } from "./backends/registry.ts";
import { getActiveBackends } from "./config.ts";
import type { SearchResult } from "./types.ts";

export interface SearchFallbackResult {
	results: SearchResult[];
	backend: string;
	errors: string[];
}

export async function runSearchWithFallback(
	query: string,
	numResults: number,
	options: {
		backend?: string;
		signal?: AbortSignal;
	},
): Promise<SearchFallbackResult> {
	const requested = options.backend ?? "auto";
	const errors: string[] = [];

	if (requested !== "auto") {
		const results = await runBackend(
			requested,
			query,
			numResults,
			options.signal,
		);
		if (results.length === 0) {
			throw new Error(`${requested} returned no results`);
		}
		return { results, backend: requested, errors };
	}

	const backends = getActiveBackends();
	for (const backend of backends) {
		try {
			const results = await runBackend(
				backend,
				query,
				numResults,
				options.signal,
			);
			if (results.length > 0) {
				return { results, backend, errors };
			}
			errors.push(`${backend}: returned no results`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`${backend}: ${message}`);
		}
	}

	throw new Error(
		`All search backends failed:\n${errors.map((entry) => `- ${entry}`).join("\n")}`,
	);
}
