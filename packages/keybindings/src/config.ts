import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";
import type {
	MergedShortcutConfig,
	ResolvedShortcutBinding,
	ShortcutBindingSource,
	ShortcutBindingsConfig,
} from "./types.ts";

function loadJsonConfig(path: string): ShortcutBindingsConfig {
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		return parsed as ShortcutBindingsConfig;
	} catch {
		return {};
	}
}

function normalizeKeys(value: KeyId | KeyId[] | undefined): KeyId[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

function mergeLayer(
	current: Map<string, ResolvedShortcutBinding>,
	layer: ShortcutBindingsConfig,
	source: ShortcutBindingSource,
): Map<string, ResolvedShortcutBinding> {
	const next = new Map(current);
	for (const [actionId, keys] of Object.entries(layer)) {
		const normalized = normalizeKeys(keys);
		if (normalized.length === 0) {
			next.delete(actionId);
			continue;
		}
		next.set(actionId, { actionId, keys: normalized, source });
	}
	return next;
}

export function mergeShortcutConfigs(
	preset: ShortcutBindingsConfig,
	global: ShortcutBindingsConfig,
	project: ShortcutBindingsConfig,
): MergedShortcutConfig {
	let bindings = new Map<string, ResolvedShortcutBinding>();
	bindings = mergeLayer(bindings, preset, "preset");
	bindings = mergeLayer(bindings, global, "global");
	bindings = mergeLayer(bindings, project, "project");
	return { bindings };
}

export function loadShortcutConfigFiles(paths: {
	presetPath: string;
	globalPath: string;
	projectPath: string;
}): MergedShortcutConfig {
	const preset = loadJsonConfig(paths.presetPath);
	const global = loadJsonConfig(paths.globalPath);
	const project = loadJsonConfig(paths.projectPath);
	return mergeShortcutConfigs(preset, global, project);
}

export function resolveShortcutConfigPaths(
	presetPath: string,
	agentDir: string,
	cwd: string,
): {
	presetPath: string;
	globalPath: string;
	projectPath: string;
} {
	return {
		presetPath,
		globalPath: join(agentDir, "vitos-shortcuts.json"),
		projectPath: join(cwd, CONFIG_DIR_NAME, "vitos-shortcuts.json"),
	};
}
