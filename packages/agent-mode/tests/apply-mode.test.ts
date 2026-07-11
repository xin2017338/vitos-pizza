import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectConfig } from "@vitos-pizza/permission-system/mode-api";
import { applyAgentMode } from "../src/apply-mode.ts";

describe("apply-mode", () => {
	it("persists agentMode and matching preset", () => {
		const cwd = mkdtempSync(join(tmpdir(), "agent-mode-"));
		applyAgentMode(cwd, "plan");
		const config = loadProjectConfig(cwd);
		expect(config.agentMode).toBe("plan");
		expect(config.permission?.write).toBe("deny");
		expect(config.yoloMode).toBe(false);
	});

	it("writes execute mode with yolo preset permissions", () => {
		const cwd = mkdtempSync(join(tmpdir(), "agent-mode-"));
		applyAgentMode(cwd, "execute");
		const config = loadProjectConfig(cwd);
		expect(config.agentMode).toBe("execute");
		expect(config.permission?.bash).toEqual({
			"*": "allow",
			"rm -rf *": "deny",
		});

		const raw = JSON.parse(
			readFileSync(
				join(cwd, ".pi", "extensions", "pi-permission-system", "config.json"),
				"utf8",
			),
		) as { agentMode?: string };
		expect(raw.agentMode).toBe("execute");
	});
});
