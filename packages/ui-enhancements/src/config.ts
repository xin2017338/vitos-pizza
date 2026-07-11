import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface UiEnhancementsSettings {
	toolsCollapsedByDefault: boolean;
	showExpandHint: boolean;
	welcomeHeader: boolean;
	borderStatusBar: boolean;
}

export const DEFAULT_UI_ENHANCEMENTS_SETTINGS: UiEnhancementsSettings = {
	toolsCollapsedByDefault: true,
	showExpandHint: true,
	welcomeHeader: true,
	borderStatusBar: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readJson(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

function extractUiSettings(
	raw: unknown,
): Partial<UiEnhancementsSettings> | undefined {
	if (!isRecord(raw)) return undefined;
	const ui = raw.ui;
	if (!isRecord(ui)) return undefined;
	return ui as Partial<UiEnhancementsSettings>;
}

function mergeSettings(
	base: UiEnhancementsSettings,
	partial?: Partial<UiEnhancementsSettings>,
): UiEnhancementsSettings {
	if (!partial) return base;
	return {
		toolsCollapsedByDefault:
			partial.toolsCollapsedByDefault ?? base.toolsCollapsedByDefault,
		showExpandHint: partial.showExpandHint ?? base.showExpandHint,
		welcomeHeader: partial.welcomeHeader ?? base.welcomeHeader,
		borderStatusBar: partial.borderStatusBar ?? base.borderStatusBar,
	};
}

export function loadUiEnhancementsSettings(
	cwd: string,
	overrides?: Partial<UiEnhancementsSettings>,
): UiEnhancementsSettings {
	let merged = { ...DEFAULT_UI_ENHANCEMENTS_SETTINGS };

	const globalPath = join(homedir(), ".pi", "agent", "settings.json");
	if (existsSync(globalPath)) {
		merged = mergeSettings(merged, extractUiSettings(readJson(globalPath)));
	}

	const projectPath = join(cwd, ".pi", "settings.json");
	if (existsSync(projectPath)) {
		merged = mergeSettings(merged, extractUiSettings(readJson(projectPath)));
	}

	if (overrides) {
		merged = mergeSettings(merged, overrides);
	}

	return merged;
}
