import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PermissionEvaluator } from "../../permission-system/src/permission-evaluator.ts";
import { sanitizeSkillPromptBlocks } from "../../permission-system/src/sanitizers/skill-prompt.ts";
import { PLAN_MODE_TOOLS } from "../src/plan-instructions.ts";

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
