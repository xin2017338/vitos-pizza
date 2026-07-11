import { describe, expect, it } from "vitest";
import {
	formatAgentModeStatusText,
	isAgentModeChangedPayload,
} from "../src/mode-events.ts";

describe("mode-events", () => {
	it("formats status text", () => {
		expect(formatAgentModeStatusText("plan")).toBe("mode: plan");
	});

	it("validates changed payloads", () => {
		expect(
			isAgentModeChangedPayload({
				mode: "execute",
				label: "execute",
				color: "warning",
			}),
		).toBe(true);
		expect(isAgentModeChangedPayload({ mode: "bad" })).toBe(false);
	});
});
