import { describe, expect, it } from "vitest";
import {
	formatAgentModeSuffix,
	getAgentModeBadge,
	resetAgentModeBadgeForTests,
} from "../src/chrome/agent-mode-badge.ts";

describe("agent-mode-badge", () => {
	it("omits suffix for agent mode", () => {
		resetAgentModeBadgeForTests();
		expect(getAgentModeBadge()).toBeNull();
		const theme = {
			fg: (_color: string, text: string) => text,
		};
		expect(formatAgentModeSuffix(null, theme as never)).toBe("");
	});

	it("formats plan and execute suffixes", () => {
		const theme = {
			fg: (_color: string, text: string) => text,
		};
		expect(
			formatAgentModeSuffix(
				{ mode: "plan", label: "plan", color: "accent" },
				theme as never,
			),
		).toBe(" · plan");
		expect(
			formatAgentModeSuffix(
				{ mode: "execute", label: "execute", color: "warning" },
				theme as never,
			),
		).toBe(" · execute");
	});
});
