import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadPermissionPreset,
	loadProjectConfig,
	saveProjectConfig,
} from "@vitos-pizza/permission-system/mode-api";
import { describe, expect, it } from "vitest";
import { applyAgentMode } from "../src/apply-mode.ts";

describe("apply-mode", () => {
	it("emits apply-preset without writing project config", () => {
		const cwd = mkdtempSync(join(tmpdir(), "agent-mode-"));
		mkdirSync(join(cwd, ".pi", "extensions", "pi-permission-system"), {
			recursive: true,
		});
		saveProjectConfig(cwd, {
			yoloMode: false,
			agentMode: "agent",
			permission: { "*": "ask", write: "allow" },
		});
		const before = loadProjectConfig(cwd);

		const emitted: Array<{ preset: string; agentMode?: string }> = [];
		applyAgentMode("plan", {
			emitApplyPreset: (payload) => {
				emitted.push(payload);
			},
		});

		expect(emitted).toEqual([{ preset: "plan", agentMode: "plan" }]);
		expect(loadProjectConfig(cwd)).toEqual(before);
	});

	it("maps execute mode to yolo preset in the emit payload", () => {
		const emitted: Array<{ preset: string; agentMode?: string }> = [];
		applyAgentMode("execute", {
			emitApplyPreset: (payload) => {
				emitted.push(payload);
			},
		});
		expect(emitted).toEqual([{ preset: "yolo", agentMode: "execute" }]);
	});

	it("loadPermissionPreset returns plan permissions without needing cwd", () => {
		const preset = loadPermissionPreset("plan");
		expect(preset.permission?.write).toBe("deny");
		expect(preset.yoloMode).toBe(false);
	});
});
