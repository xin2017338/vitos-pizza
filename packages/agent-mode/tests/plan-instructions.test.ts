import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PermissionEvaluator } from "../../permission-system/src/permission-evaluator.ts";
import { sanitizeSkillPromptBlocks } from "../../permission-system/src/sanitizers/skill-prompt.ts";
import {
	PLAN_INSTRUCTIONS,
	PLAN_MODE_ENDED_MESSAGE,
	PLAN_MODE_MESSAGE,
	PLAN_MODE_TOOLS,
} from "../src/plan-instructions.ts";

const presetsDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../permission-system/presets",
);

describe("plan-instructions", () => {
	it("lists subagent tooling for plan mode", () => {
		expect(PLAN_MODE_TOOLS).toContain("subagent");
		expect(PLAN_MODE_TOOLS).toContain("question");
		expect(PLAN_MODE_TOOLS).toContain("web_search");
		expect(PLAN_MODE_TOOLS).toContain("web_read");
	});

	it("allows an optional short Next footer and structured questions", () => {
		expect(PLAN_INSTRUCTIONS).toContain("**Next**");
		expect(PLAN_INSTRUCTIONS).toContain("optional");
		expect(PLAN_INSTRUCTIONS).toContain("2–3 bullets max");
		expect(PLAN_INSTRUCTIONS).toContain("question");
		expect(PLAN_INSTRUCTIONS).toContain("parallel scouts");
		expect(PLAN_INSTRUCTIONS).toContain("available anytime in plan");
		expect(PLAN_INSTRUCTIONS).toContain("scout, and planner");
		expect(PLAN_INSTRUCTIONS).toContain("when clarification would help");
		expect(PLAN_MODE_MESSAGE).toContain("optionally a short **Next** footer");
		expect(PLAN_MODE_MESSAGE).toContain("Parallel scouts");
		expect(PLAN_MODE_MESSAGE).toContain("question");
		expect(PLAN_MODE_MESSAGE).toContain("available anytime in plan");
		expect(PLAN_MODE_MESSAGE).toContain("use when helpful");
	});

	it("defines a clear plan-ended signal for leaving plan mode", () => {
		expect(PLAN_MODE_ENDED_MESSAGE).toContain("[PLAN MODE ENDED]");
		expect(PLAN_MODE_ENDED_MESSAGE).toMatch(/write/i);
		expect(PLAN_MODE_ENDED_MESSAGE).toMatch(/bash/i);
		expect(PLAN_MODE_ENDED_MESSAGE).toContain("[PLAN MODE ACTIVE]");
	});

	it("plan preset keeps subagents skill in the system prompt", () => {
		const planPreset = JSON.parse(
			readFileSync(join(presetsDir, "plan.json"), "utf8"),
		) as { permission: Record<string, unknown> };

		const prompt = [
			"# System",
			"",
			"## Skill: subagents",
			"Use scout and planner.",
		].join("\n");

		const evaluator = new PermissionEvaluator();
		const result = sanitizeSkillPromptBlocks(
			prompt,
			planPreset.permission as never,
			evaluator,
			{},
		);

		expect(result.prompt).toContain("## Skill: subagents");
		expect(result.entries).toHaveLength(1);
	});
});
