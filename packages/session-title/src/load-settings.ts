import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type AutoTitleSettings,
	DEFAULT_AUTO_TITLE_SETTINGS,
} from "./types.ts";

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

function extractAutoTitle(
	raw: unknown,
): Partial<AutoTitleSettings> | undefined {
	if (!isRecord(raw)) return undefined;
	const session = raw.session;
	if (!isRecord(session)) return undefined;
	const autoTitle = session.autoTitle;
	if (!isRecord(autoTitle)) return undefined;
	return autoTitle as Partial<AutoTitleSettings>;
}

function mergeSettings(
	base: AutoTitleSettings,
	partial?: Partial<AutoTitleSettings>,
): AutoTitleSettings {
	if (!partial) return base;
	return {
		enabled: partial.enabled ?? base.enabled,
		model: partial.model ?? base.model,
		minCharsForLlm: partial.minCharsForLlm ?? base.minCharsForLlm,
		fastRules: partial.fastRules ?? base.fastRules,
		maxInputChars: partial.maxInputChars ?? base.maxInputChars,
		maxOutputTokens: partial.maxOutputTokens ?? base.maxOutputTokens,
		timeoutMs: partial.timeoutMs ?? base.timeoutMs,
		maxTitleLength: partial.maxTitleLength ?? base.maxTitleLength,
	};
}

export function loadAutoTitleSettings(
	cwd: string,
	overrides?: Partial<AutoTitleSettings>,
): AutoTitleSettings {
	let merged = { ...DEFAULT_AUTO_TITLE_SETTINGS };

	const globalPath = join(homedir(), ".pi", "agent", "settings.json");
	if (existsSync(globalPath)) {
		merged = mergeSettings(merged, extractAutoTitle(readJson(globalPath)));
	}

	const projectPath = join(cwd, ".pi", "settings.json");
	if (existsSync(projectPath)) {
		merged = mergeSettings(merged, extractAutoTitle(readJson(projectPath)));
	}

	if (overrides) {
		merged = mergeSettings(merged, overrides);
	}

	return merged;
}
