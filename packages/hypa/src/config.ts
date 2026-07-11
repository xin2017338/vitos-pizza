import { homedir } from "node:os";
import { join } from "node:path";

/** Default Hypa Pi extension config for Vito's Pizzeria (additive, no MCP). */
export const DEFAULT_HYPA_PI_CONFIG = {
	mode: "additive",
	mcpProxyEnabled: false,
} as const;

export type HypaPiConfig = {
	mode: string;
	mcpProxyEnabled: boolean;
	[key: string]: unknown;
};

/**
 * Resolve config path the same way @hypabolic/pi-hypa documents:
 * HYPA_PI_CONFIG, or ~/.hypa-pi/config.json. Empty / "none" means skip seeding.
 */
export function resolveHypaPiConfigPath(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string | null {
	const raw = env.HYPA_PI_CONFIG;
	if (raw !== undefined) {
		const trimmed = raw.trim();
		if (trimmed === "" || trimmed.toLowerCase() === "none") {
			return null;
		}
		return trimmed;
	}
	return join(home, ".hypa-pi", "config.json");
}

export function formatDefaultHypaPiConfig(): string {
	return `${JSON.stringify(DEFAULT_HYPA_PI_CONFIG, null, "\t")}\n`;
}
