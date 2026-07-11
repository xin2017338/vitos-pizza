import { describe, expect, it } from "vitest";
import { runGatePipeline } from "../src/gates/pipeline.ts";
import { PermissionEvaluator } from "../src/permission-evaluator.ts";
import {
	patternForSessionApproval,
	SessionApprovals,
} from "../src/session-approvals.ts";

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
		web_read: "ask" as const,
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
		expect(result.surface).toBe("external_directory");
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

	it("honors session approval for web_read without re-asking", () => {
		const approvals = new SessionApprovals();
		const first = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "web_read",
				input: { url: "https://example.com/a" },
				cwd: "/workspace/project",
			},
			{ registeredTools: new Set(["web_read"]) },
		);
		expect(first.state).toBe("ask");
		approvals.add(
			first.surface,
			patternForSessionApproval(first.surface, first.matchedPattern ?? "*"),
		);

		const second = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "web_read",
				input: { url: "https://other.example/b" },
				cwd: "/workspace/project",
			},
			{
				registeredTools: new Set(["web_read"]),
				sessionApprovals: approvals,
			},
		);
		expect(second.state).toBe("allow");
		expect(second.origin).toBe("session");
	});

	it("honors session approval for external_directory across paths", () => {
		const approvals = new SessionApprovals();
		const first = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "read",
				input: { path: "/etc/hosts" },
				cwd: "/workspace/project",
			},
			{ registeredTools: new Set(["read"]) },
		);
		expect(first.state).toBe("ask");
		approvals.add(
			first.surface,
			patternForSessionApproval(first.surface, first.matchedPattern ?? "*"),
		);

		const second = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "read",
				input: { path: "/tmp/other" },
				cwd: "/workspace/project",
			},
			{
				registeredTools: new Set(["read"]),
				sessionApprovals: approvals,
			},
		);
		expect(second.state).toBe("allow");
	});

	it("honors session approval for bash ask patterns", () => {
		const approvals = new SessionApprovals();
		const first = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "bash",
				input: { command: "npm install" },
				cwd: "/workspace/project",
			},
			{ registeredTools: new Set(["bash"]) },
		);
		expect(first.state).toBe("ask");
		approvals.add(
			first.surface,
			patternForSessionApproval(first.surface, first.matchedPattern ?? "*"),
		);

		const second = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "bash",
				input: { command: "npm test" },
				cwd: "/workspace/project",
			},
			{
				registeredTools: new Set(["bash"]),
				sessionApprovals: approvals,
			},
		);
		expect(second.state).toBe("allow");
	});
});
