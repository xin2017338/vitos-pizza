/**
 * @vitos-pizza/settings-preset — seed default Pi settings on first session start.
 *
 * Follows the same non-destructive pattern as the permission-system module:
 * only writes to project-level `.pi/settings.json` when neither global nor
 * project settings exist, so existing user configurations are never overwritten.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const presetsDir = join(moduleDir, "..", "presets");

function getGlobalSettingsPath(agentDir: string): string {
	return join(agentDir, "settings.json");
}

function getProjectSettingsPath(cwd: string): string {
	return join(cwd, ".pi", "settings.json");
}

function ensureDefaultSettings(cwd: string, agentDir: string): void {
	// Don't overwrite if the user already has project-level settings
	const projectPath = getProjectSettingsPath(cwd);
	if (existsSync(projectPath)) return;

	// Don't overwrite if the user already has global settings
	const globalPath = getGlobalSettingsPath(agentDir);
	if (existsSync(globalPath)) return;

	// Neither exists — seed the project with our preset
	const presetPath = join(presetsDir, "settings.json");
	if (!existsSync(presetPath)) return;

	mkdirSync(dirname(projectPath), { recursive: true });
	copyFileSync(presetPath, projectPath);
}

export default function (pi: ExtensionAPI) {
	const agentDir = getAgentDir();
	let seeded = false;

	pi.on("session_start", async (_event, ctx) => {
		if (seeded) return;
		seeded = true;

		ensureDefaultSettings(ctx.cwd, agentDir);
	});
}
