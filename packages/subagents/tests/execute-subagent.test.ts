import { describe, expect, it, vi } from "vitest";
import { buildSubagentDetails, executeSubagent } from "../src/execute-subagent.ts";
import type { AgentConfig } from "../src/agents.ts";

vi.mock("../src/run-agent.ts", () => ({
	runSingleAgent: vi.fn(async (input) => ({
		agent: input.agentName,
		agentSource: "builtin" as const,
		task: input.task,
		exitCode: 0,
		messages: [
			{
				role: "assistant",
				content: [{ type: "text", text: `output:${input.task}` }],
				api: "test",
				provider: "test",
				model: "test",
				usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 },
				stopReason: "stop",
				timestamp: Date.now(),
			},
		],
		stderr: "",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0,
			contextTokens: 2,
			turns: 1,
		},
		step: input.step,
	})),
}));

vi.mock("../src/agents.ts", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/agents.ts")>();
	return {
		...actual,
		discoverAgents: () => ({
			agents: [
				{
					name: "scout",
					description: "scout",
					systemPrompt: "scout",
					source: "builtin",
					filePath: "/scout.md",
				},
				{
					name: "planner",
					description: "planner",
					systemPrompt: "planner",
					source: "builtin",
					filePath: "/planner.md",
				},
			] satisfies AgentConfig[],
			projectAgentsDir: null,
			builtinAgentsDir: "/agents",
		}),
	};
});

describe("executeSubagent", () => {
	it("rejects invalid mode combinations", async () => {
		const result = await executeSubagent(
			{ agent: "scout", task: "a", chain: [{ agent: "scout", task: "b" }] },
			{ cwd: process.cwd() },
		);
		expect(result.content[0]).toMatchObject({ type: "text" });
		expect((result.content[0] as { text: string }).text).toContain("Invalid parameters");
	});

	it("passes {previous} through chain steps", async () => {
		const result = await executeSubagent(
			{
				chain: [
					{ agent: "scout", task: "first" },
					{ agent: "planner", task: "plan from {previous}" },
				],
			},
			{ cwd: process.cwd() },
		);
		expect(result.details?.mode).toBe("chain");
		expect(result.details?.results).toHaveLength(2);
		expect((result.content[0] as { text: string }).text).toContain("output:plan from output:first");
	});
});

describe("buildSubagentDetails", () => {
	it("builds details with mode and scope", () => {
		const details = buildSubagentDetails("single", "both", null, []);
		expect(details.mode).toBe("single");
		expect(details.agentScope).toBe("both");
	});
});
