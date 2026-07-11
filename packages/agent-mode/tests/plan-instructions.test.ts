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
		expect(PLAN_MODE_TOOLS).toContain("hypa_read");
		expect(PLAN_MODE_TOOLS).toContain("hypa_grep");
		expect(PLAN_MODE_TOOLS).toContain("hypa_find");
		expect(PLAN_MODE_TOOLS).toContain("hypa_ls");
		expect(PLAN_MODE_TOOLS).not.toContain("hypa_shell");
	});

	it("authoritative system instructions cover hard rules and optional Next", () => {
		expect(PLAN_INSTRUCTIONS).toMatch(/supersedes/i);
		expect(PLAN_INSTRUCTIONS).toContain("worker");
		expect(PLAN_INSTRUCTIONS).toMatch(/no write/i);
		expect(PLAN_INSTRUCTIONS).toContain("question");
		expect(PLAN_INSTRUCTIONS).toMatch(/Scout is optional/i);
		expect(PLAN_INSTRUCTIONS).toContain("hypa_read");
		expect(PLAN_INSTRUCTIONS).toContain("**Next**");
		expect(PLAN_INSTRUCTIONS).toContain("2–3");
		expect(PLAN_INSTRUCTIONS).toContain("/mode execute");
	});

	it("sticky reminder is short and forbids implementation", () => {
		expect(PLAN_MODE_MESSAGE).toContain("[PLAN MODE ACTIVE]");
		expect(PLAN_MODE_MESSAGE).toMatch(/Read-only/i);
		expect(PLAN_MODE_MESSAGE).toContain("worker");
		expect(PLAN_MODE_MESSAGE).toContain("question");
		expect(PLAN_MODE_MESSAGE).toContain("hypa_*");
		expect(PLAN_MODE_MESSAGE).toContain("**Next**");
		expect(PLAN_MODE_MESSAGE).not.toContain("```json");
	});

	it("plan preset allows hypa read tools and denies hypa_shell", () => {
		const planPreset = JSON.parse(
			readFileSync(join(presetsDir, "plan.json"), "utf8"),
		) as { permission: Record<string, string> };

		expect(planPreset.permission.hypa_read).toBe("allow");
		expect(planPreset.permission.hypa_grep).toBe("allow");
		expect(planPreset.permission.hypa_find).toBe("allow");
		expect(planPreset.permission.hypa_ls).toBe("allow");
		expect(planPreset.permission.hypa_shell).toBe("deny");
		expect(planPreset.permission.hypa_mcp_proxy).toBe("deny");
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
