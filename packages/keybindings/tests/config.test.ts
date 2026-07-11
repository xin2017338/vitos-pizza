import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	loadShortcutConfigFiles,
	mergeShortcutConfigs,
} from "../src/config.ts";

describe("mergeShortcutConfigs", () => {
	it("merges preset, global, and project with project winning", () => {
		const merged = mergeShortcutConfigs(
			{ "permission.toggleYolo": "ctrl+shift+y" },
			{ "permission.toggleYolo": "f6", "permission.cycleMode": "ctrl+m" },
			{ "permission.cycleMode": "ctrl+shift+m" },
		);

		expect(merged.bindings.get("permission.toggleYolo")).toEqual({
			actionId: "permission.toggleYolo",
			keys: ["f6"],
			source: "global",
		});
		expect(merged.bindings.get("permission.cycleMode")).toEqual({
			actionId: "permission.cycleMode",
			keys: ["ctrl+shift+m"],
			source: "project",
		});
	});

	it("supports multiple keys per action", () => {
		const merged = mergeShortcutConfigs(
			{ "demo.action": ["ctrl+a", "f1"] },
			{},
			{},
		);

		expect(merged.bindings.get("demo.action")?.keys).toEqual(["ctrl+a", "f1"]);
	});

	it("removes bindings when a layer sets an empty array", () => {
		const merged = mergeShortcutConfigs(
			{ "demo.action": "ctrl+a" },
			{ "demo.action": [] },
			{},
		);

		expect(merged.bindings.has("demo.action")).toBe(false);
	});
});

describe("loadShortcutConfigFiles", () => {
	it("loads JSON files from disk", () => {
		const dir = mkdtempSync(join(tmpdir(), "vitos-shortcuts-"));
		const presetPath = join(dir, "preset.json");
		const globalPath = join(dir, "global.json");
		const projectPath = join(dir, "project.json");

		writeFileSync(
			presetPath,
			JSON.stringify({ "demo.action": "ctrl+1" }),
			"utf8",
		);
		writeFileSync(
			globalPath,
			JSON.stringify({ "demo.action": "ctrl+2" }),
			"utf8",
		);
		writeFileSync(
			projectPath,
			JSON.stringify({ "other.action": "ctrl+3" }),
			"utf8",
		);

		const merged = loadShortcutConfigFiles({
			presetPath,
			globalPath,
			projectPath,
		});

		expect(merged.bindings.get("demo.action")?.keys).toEqual(["ctrl+2"]);
		expect(merged.bindings.get("other.action")?.source).toBe("project");
	});
});
