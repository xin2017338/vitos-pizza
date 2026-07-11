import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BackendConfig, SearchConfig } from "./types.ts";
import { getAgentDir } from "./utils.ts";

export const DEFAULT_CONFIG: SearchConfig = {
	defaultBackend: "auto",
	reader: "jina",
	backends: {
		exa_mcp: { enabled: true },
		firecrawl: { enabled: true },
	},
};

export const FALLBACK_ENV_MAP: Record<string, string> = {
	tavily: "SEARCH_TAVILY_API_KEY",
	brave: "SEARCH_BRAVE_API_KEY",
	firecrawl: "SEARCH_FIRECRAWL_API_KEY",
};

export let config: SearchConfig = structuredClone(DEFAULT_CONFIG);

let activeBackendsList: string[] = [];
let configCacheTime = 0;
const CONFIG_TTL_MS = 10_000;

function mergeBackends(
	globalBackends: Record<string, BackendConfig>,
	projectBackends: Record<string, BackendConfig>,
): Record<string, BackendConfig> {
	const merged = { ...globalBackends };
	for (const [key, value] of Object.entries(projectBackends)) {
		merged[key] = { ...merged[key], ...value };
	}
	return merged;
}

export function loadConfig(cwd: string): SearchConfig {
	const globalPath = join(getAgentDir(), "extensions", "search.json");
	const projectPath = join(cwd, ".pi", "search.json");

	let loaded: SearchConfig = structuredClone(DEFAULT_CONFIG);

	if (existsSync(globalPath)) {
		try {
			const global = JSON.parse(
				readFileSync(globalPath, "utf8"),
			) as SearchConfig;
			loaded = {
				...loaded,
				...global,
				backends: mergeBackends(loaded.backends ?? {}, global.backends ?? {}),
			};
		} catch {
			// ignore invalid global config
		}
	}

	const preProjectBackends = { ...(loaded.backends ?? {}) };

	if (existsSync(projectPath)) {
		try {
			const project = JSON.parse(
				readFileSync(projectPath, "utf8"),
			) as SearchConfig;
			loaded = {
				...loaded,
				...project,
				backends: project.backends
					? mergeBackends(preProjectBackends, project.backends)
					: preProjectBackends,
			};
		} catch {
			// ignore invalid project config
		}
	}

	for (const [backend, envVar] of Object.entries(FALLBACK_ENV_MAP)) {
		const envValue = process.env[envVar];
		if (!envValue?.trim()) continue;
		const existing = loaded.backends?.[backend];
		if (existing?.enabled === false) continue;
		loaded.backends ??= {};
		loaded.backends[backend] = {
			...existing,
			enabled: existing?.enabled ?? true,
		};
	}

	return loaded;
}

export function refreshConfig(cwd: string, force = false): string[] {
	const now = Date.now();
	if (!force && now - configCacheTime < CONFIG_TTL_MS) {
		return activeBackendsList;
	}

	config = loadConfig(cwd);
	configCacheTime = now;

	activeBackendsList = Object.entries(config.backends ?? {})
		.filter(([, backendConfig]) => backendConfig?.enabled)
		.map(([name]) => name);

	if (activeBackendsList.length === 0) {
		activeBackendsList = ["exa_mcp", "firecrawl"];
	}

	if (config.defaultBackend && config.defaultBackend !== "auto") {
		if (activeBackendsList.includes(config.defaultBackend)) {
			activeBackendsList = [
				config.defaultBackend,
				...activeBackendsList.filter((name) => name !== config.defaultBackend),
			];
		}
	}

	return activeBackendsList;
}

export function getActiveBackends(): string[] {
	return activeBackendsList;
}
