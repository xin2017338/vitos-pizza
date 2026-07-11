import { describe, expect, it } from "vitest";
import { PermissionEvaluator } from "../src/permission-evaluator.ts";
import { SessionApprovals } from "../src/session-approvals.ts";

describe("permission-evaluator", () => {
	const evaluator = new PermissionEvaluator();
	const permission = {
		"*": "allow" as const,
		bash: {
			"*": "ask" as const,
			"git status": "allow" as const,
			"rm -rf *": "deny" as const,
		},
	};

	it("evaluates bash patterns with last-match-wins", () => {
		const allowed = evaluator.evaluateSurface(permission, "bash", "git status");
		const denied = evaluator.evaluateSurface(permission, "bash", "rm -rf /tmp");
		const asked = evaluator.evaluateSurface(permission, "bash", "npm install");

		expect(allowed.state).toBe("allow");
		expect(denied.state).toBe("deny");
		expect(asked.state).toBe("ask");
	});

	it("rewrites ask to allow in yolo mode", () => {
		const result = evaluator.evaluateSurface(
			permission,
			"bash",
			"npm install",
			"project",
			{
				yoloMode: true,
			},
		);
		expect(result.state).toBe("allow");
		expect(result.origin).toBe("yolo");
	});

	it("honors session approvals", () => {
		const approvals = new SessionApprovals();
		approvals.add("bash", "npm install");
		const result = evaluator.evaluateSurface(
			permission,
			"bash",
			"npm install",
			"project",
			{
				sessionApprovals: approvals,
			},
		);
		expect(result.state).toBe("allow");
		expect(result.origin).toBe("session");
	});
});
