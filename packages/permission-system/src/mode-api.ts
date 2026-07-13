import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectConfigPath } from "./config-paths.ts";
import { loadConfigFile, saveConfigFile } from "./policy-loader.ts";
import type { ExtensionConfig } from "./types.ts";

export type PermissionPresetName = "default" | "plan" | "yolo";

export const PERMISSION_RELOAD_CONFIG_EVENT = "permission-system:reload-config";

export const PERMISSION_APPLY_PRESET_EVENT = "permission-system:apply-preset";

export type PermissionApplyPresetPayload = {
	preset: PermissionPresetName;
	agentMode?: "agent" | "plan" | "execute";
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const PRESETS_DIR = join(moduleDir, "..", "presets");

export function loadProjectConfig(cwd: string): ExtensionConfig {
	const path = getProjectConfigPath(cwd);
	if (!existsSync(path)) {
		return { permission: { "*": "ask" } };
	}
	return loadConfigFile(path);
}

export function saveProjectConfig(cwd: string, config: ExtensionConfig): void {
	saveConfigFile(getProjectConfigPath(cwd), config);
}

export function loadPermissionPreset(
	preset: PermissionPresetName,
): ExtensionConfig {
	const presetPath = join(PRESETS_DIR, `${preset}.json`);
	return loadConfigFile(presetPath);
}

export function applyPermissionPreset(
	cwd: string,
	preset: PermissionPresetName,
): ExtensionConfig {
	const presetConfig = loadPermissionPreset(preset);
	const existing = loadProjectConfig(cwd);
	const next: ExtensionConfig = {
		...existing,
		yoloMode: presetConfig.yoloMode ?? false,
		permission: presetConfig.permission ?? { "*": "ask" },
	};
	saveProjectConfig(cwd, next);
	return next;
}
