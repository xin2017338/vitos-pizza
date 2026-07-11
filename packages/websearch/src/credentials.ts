import { FALLBACK_ENV_MAP } from "./config.ts";
import type { SearchConfig } from "./types.ts";

export function resolveBackendKey(
	backend: string,
	searchConfig: SearchConfig,
): string | undefined {
	const backendConfig = searchConfig.backends?.[backend];
	const configured = backendConfig?.apiKey?.trim();
	if (configured) {
		if (/^[A-Z][A-Z0-9_]*$/.test(configured)) {
			return process.env[configured]?.trim() || undefined;
		}
		return configured;
	}

	const envVar = FALLBACK_ENV_MAP[backend];
	if (envVar) {
		return process.env[envVar]?.trim() || undefined;
	}

	return undefined;
}

export function hasConfiguredKey(
	backend: string,
	searchConfig: SearchConfig,
): boolean {
	const backendConfig = searchConfig.backends?.[backend];
	if (backendConfig?.apiKey?.trim()) {
		return true;
	}
	const envVar = FALLBACK_ENV_MAP[backend];
	return Boolean(envVar && process.env[envVar]?.trim());
}
