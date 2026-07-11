import type { Message } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { deriveProgress, formatToolArgs } from "../src/progress.ts";
import { subagentResultIsRunning } from "../src/render.ts";
import { emptyUsage } from "../src/utils.ts";

function assistantToolCall(
	name: string,
	args: Record<string, unknown>,
	timestamp = 1000,
): Message {
	return {
		role: "assistant",
		content: [
			{
				type: "toolCall",
				id: "call-1",
				name,
				arguments: args,
			},
		],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-5",
		usage: {
			input: 10,
			output: 5,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 15,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp,
	};
}

function toolResult(
	toolName: string,
	text: string,
	timestamp = 2000,
): Message {
	return {
		role: "toolResult",
		toolCallId: "call-1",
		toolName,
		content: [{ type: "text", text }],
		isError: false,
		timestamp,
	};
}

function assistantText(text: string, timestamp = 3000): Message {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-5",
		usage: {
			input: 20,
			output: 40,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 60,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp,
	};
}

describe("deriveProgress", () => {
	it("tracks current tool, recent tools, and tool results", () => {
		const messages: Message[] = [
			assistantToolCall("grep", { pattern: "subagent", path: "packages" }),
		];
		const usage = emptyUsage();
		usage.input = 10;
		usage.output = 5;

		const running = deriveProgress(messages, usage, {
			isRunning: true,
			startedAt: Date.now() - 5000,
			pendingTool: {
				name: "grep",
				args: { pattern: "subagent" },
				startedAt: Date.now() - 1000,
			},
		});

		expect(running.status).toBe("running");
		expect(running.currentTool).toBe("grep");
		expect(running.recentTools.length).toBeGreaterThan(0);
		expect(running.recentTools[running.recentTools.length - 1]?.tool).toBe("grep");

		const withResult = deriveProgress(
			[...messages, toolResult("grep", "packages/subagents/src/render.ts")],
			usage,
			{ isRunning: true, startedAt: Date.now() - 5000 },
		);
		expect(withResult.toolCount).toBe(1);
		expect(withResult.recentOutput.some((line) => line.includes("render.ts"))).toBe(
			true,
		);
	});

	it("marks complete when not running", () => {
		const messages: Message[] = [
			assistantToolCall("read", { path: "README.md" }),
			toolResult("read", "# Hello"),
			assistantText("# Code Context\n\nDone."),
		];
		const usage = emptyUsage();
		usage.input = 30;
		usage.output = 50;

		const done = deriveProgress(messages, usage, {
			isRunning: false,
			startedAt: Date.now() - 10_000,
		});

		expect(done.status).toBe("complete");
		expect(done.toolCount).toBe(1);
		expect(done.recentOutput.some((line) => line.includes("Code Context"))).toBe(true);
	});

	it("marks failed when requested", () => {
		const progress = deriveProgress([], emptyUsage(), {
			isRunning: false,
			startedAt: Date.now() - 1000,
			failed: true,
		});
		expect(progress.status).toBe("failed");
	});
});

describe("formatToolArgs", () => {
	it("formats key=value pairs", () => {
		expect(formatToolArgs({ pattern: "scout", path: "packages" })).toContain(
			"pattern=scout",
		);
	});
});

describe("subagentResultIsRunning", () => {
	it("detects partial streaming results", () => {
		expect(
			subagentResultIsRunning(
				{
					content: [{ type: "text", text: "(running...)" }],
					details: {
						mode: "single",
						agentScope: "both",
						projectAgentsDir: null,
						results: [
							{
								agent: "scout",
								agentSource: "builtin",
								task: "scan",
								exitCode: 0,
								messages: [],
								stderr: "",
								usage: emptyUsage(),
								progress: {
									status: "running",
									recentTools: [],
									recentOutput: [],
									toolCount: 0,
									tokens: 0,
									durationMs: 100,
									startedAt: Date.now(),
								},
							},
						],
					},
				},
				{ expanded: false, isPartial: true },
			),
		).toBe(true);
	});

	it("detects parallel placeholders", () => {
		expect(
			subagentResultIsRunning({
				content: [{ type: "text", text: "Parallel: 0/2 done" }],
				details: {
					mode: "parallel",
					agentScope: "both",
					projectAgentsDir: null,
					results: [
						{
							agent: "scout",
							agentSource: "builtin",
							task: "a",
							exitCode: -1,
							messages: [],
							stderr: "",
							usage: emptyUsage(),
						},
					],
				},
			}),
		).toBe(true);
	});
});
