import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectConfigPath } from "./config-paths.ts";
import { loadConfigFile, saveConfigFile } from "./policy-loader.ts";
import type { ExtensionConfig } from "./types.ts";

export type PermissionPresetName = "default" | "plan" | "yolo";

export const PERMISSION_RELOAD_CONFIG_EVENT = "permission-system:reload-config";

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const PRESETS_DIR = join(moduleDir, "..", "presets");

export function loadProjectConfig(cwd: string): ExtensionConfig {
	const path = getProjectConfigPath(cwd);
	if (!existsSync(path)) {
		return { permission: { "*": "ask" } };
	}
	return loadConfigFile(path);
}

export function saveProjectConfig(
	cwd: string,
	config: ExtensionConfig,
): void {
	saveConfigFile(getProjectConfigPath(cwd), config);
}

export function applyPermissionPreset(
	cwd: string,
	preset: PermissionPresetName,
): ExtensionConfig {
	const presetPath = join(PRESETS_DIR, `${preset}.json`);
	const presetConfig = loadConfigFile(presetPath);
	const existing = loadProjectConfig(cwd);
	const next: ExtensionConfig = {
		...existing,
		yoloMode: presetConfig.yoloMode ?? false,
		permission: presetConfig.permission ?? { "*": "ask" },
	};
	saveProjectConfig(cwd, next);
	return next;
}
