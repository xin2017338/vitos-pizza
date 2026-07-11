import { describe, expect, it } from "vitest";
import {
	AGENT_MODES,
	cycleAgentMode,
	inferAgentMode,
	isAgentMode,
	PRESET_BY_MODE,
} from "../src/modes.ts";

describe("modes", () => {
	it("cycles agent → plan → execute → agent", () => {
		expect(cycleAgentMode("agent")).toBe("plan");
		expect(cycleAgentMode("plan")).toBe("execute");
		expect(cycleAgentMode("execute")).toBe("agent");
	});

	it("maps modes to permission presets", () => {
		expect(PRESET_BY_MODE.agent).toBe("default");
		expect(PRESET_BY_MODE.plan).toBe("plan");
		expect(PRESET_BY_MODE.execute).toBe("yolo");
	});

	it("validates agent mode strings", () => {
		for (const mode of AGENT_MODES) {
			expect(isAgentMode(mode)).toBe(true);
		}
		expect(isAgentMode("careful")).toBe(false);
	});

	it("prefers persisted agentMode over preset detection", () => {
		expect(
			inferAgentMode({
				agentMode: "agent",
				permission: { "*": "deny" },
			}),
		).toBe("agent");
	});
});
