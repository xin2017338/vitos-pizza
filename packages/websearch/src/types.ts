export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	content?: string;
	backend?: string;
}

export interface BackendConfig {
	enabled?: boolean;
	apiKey?: string;
}

export interface SearchConfig {
	defaultBackend?: string;
	reader?: "jina" | "exa_mcp";
	backends?: Record<string, BackendConfig>;
}

export interface BackendRunner {
	needsKey: boolean;
	optionalKey: boolean;
	label: string;
	search: (
		query: string,
		numResults: number,
		options: { key?: string; signal?: AbortSignal },
	) => Promise<{ results: SearchResult[] }>;
}
