import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FlatPermissionConfig } from "./types.ts";

const PRESET_ORDER = ["yolo", "default", "plan"] as const;
export type PresetModeName = (typeof PRESET_ORDER)[number];

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			sorted[key] = canonicalize(record[key]);
		}
		return sorted;
	}
	return value;
}

function normalizePermission(
	permission: FlatPermissionConfig | undefined,
): string {
	return JSON.stringify(canonicalize(permission ?? {}));
}

export function detectPresetMode(
	permission: FlatPermissionConfig | undefined,
	presetsDir: string,
): PresetModeName | "custom" {
	if (!existsSync(presetsDir)) return "custom";

	const target = normalizePermission(permission);
	for (const mode of PRESET_ORDER) {
		const presetPath = join(presetsDir, `${mode}.json`);
		if (!existsSync(presetPath)) continue;
		try {
			const preset = JSON.parse(readFileSync(presetPath, "utf8")) as {
				permission?: FlatPermissionConfig;
			};
			if (normalizePermission(preset.permission) === target) {
				return mode;
			}
		} catch {
			// skip invalid preset
		}
	}

	return "custom";
}

export function listPresetModes(presetsDir: string): PresetModeName[] {
	if (!existsSync(presetsDir)) return [...PRESET_ORDER];
	return readdirSync(presetsDir)
		.filter((name) => name.endsWith(".json"))
		.map((name) => name.replace(/\.json$/, ""))
		.filter((name): name is PresetModeName =>
			(PRESET_ORDER as readonly string[]).includes(name),
		)
		.sort((a, b) => PRESET_ORDER.indexOf(a) - PRESET_ORDER.indexOf(b));
}
