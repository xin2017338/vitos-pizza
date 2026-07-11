import { describe, expect, it } from "vitest";
import { decideSchedule } from "../src/should-schedule.ts";

const baseCtx = {
	hasSessionName: false,
	inFlight: false,
	fastRules: true,
	minCharsForLlm: 4,
};

describe("decideSchedule", () => {
	it("skips commands and existing names", () => {
		expect(decideSchedule("/hello", baseCtx)).toBe("skip");
		expect(
			decideSchedule("fix bug", { ...baseCtx, hasSessionName: true }),
		).toBe("skip");
	});

	it("fast-rejects short greetings", () => {
		expect(decideSchedule("你好", baseCtx)).toBe("fastReject");
	});

	it("schedules task-like prompts", () => {
		expect(decideSchedule("修复登录 bug", baseCtx)).toBe("schedule");
	});

	it("fast-rejects punctuation-only prompts", () => {
		expect(decideSchedule("???", baseCtx)).toBe("fastReject");
	});
});
