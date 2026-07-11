import { describe, expect, it } from "vitest";
import { runGatePipeline } from "../src/gates/pipeline.ts";
import { PermissionEvaluator } from "../src/permission-evaluator.ts";

describe("gate pipeline", () => {
	const evaluator = new PermissionEvaluator();
	const permission = {
		"*": "allow" as const,
		path: {
			"*": "allow" as const,
			"*.env": "deny" as const,
		},
		bash: {
			"*": "ask" as const,
			"git status": "allow" as const,
		},
		external_directory: "ask" as const,
	};

	it("denies sensitive paths across tools", () => {
		const result = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "read",
				input: { path: ".env" },
				cwd: "/workspace/project",
			},
			{ registeredTools: new Set(["read"]) },
		);
		expect(result.state).toBe("deny");
	});

	it("asks for external paths", () => {
		const result = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "read",
				input: { path: "/etc/hosts" },
				cwd: "/workspace/project",
			},
			{ registeredTools: new Set(["read"]) },
		);
		expect(result.state).toBe("ask");
	});

	it("allows whitelisted bash commands", () => {
		const result = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "bash",
				input: { command: "git status" },
				cwd: "/workspace/project",
			},
			{ registeredTools: new Set(["bash"]) },
		);
		expect(result.state).toBe("allow");
	});
});
