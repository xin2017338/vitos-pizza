import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	formatDefaultHypaPiConfig,
	resolveHypaPiConfigPath,
} from "./config.ts";

/**
 * Seed ~/.hypa-pi/config.json when missing. Never overwrites an existing file.
 * @returns true if a new file was written
 */
export function seedHypaPiConfigIfMissing(
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	const path = resolveHypaPiConfigPath(env);
	if (!path) return false;
	if (existsSync(path)) return false;

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, formatDefaultHypaPiConfig(), "utf8");
	return true;
}
