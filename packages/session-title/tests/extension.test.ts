import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerSessionTitle } from "../extensions/index.ts";
import { DEFAULT_AUTO_TITLE_SETTINGS } from "../src/types.ts";

function flushPromises() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function createMockPi() {
	const handlers = new Map<
		string,
		(event: unknown, ctx: ExtensionContext) => void
	>();
	return {
		handlers,
		on: vi.fn(
			(
				event: string,
				handler: (event: unknown, ctx: ExtensionContext) => void,
			) => {
				handlers.set(event, handler);
			},
		),
		getSessionName: vi.fn(() => undefined),
		setSessionName: vi.fn(),
	};
}

function createMockCtx(): ExtensionContext {
	return {
		cwd: process.cwd(),
		model: { provider: "test", id: "test-model" } as ExtensionContext["model"],
		modelRegistry: {
			find: vi.fn(),
			getApiKeyAndHeaders: vi.fn(async () => ({
				ok: true,
				apiKey: "test-key",
			})),
		} as unknown as ExtensionContext["modelRegistry"],
	} as ExtensionContext;
}

const agentEndEvent = {
	type: "agent_end",
	messages: [
		{
			role: "user",
			content: [{ type: "text", text: "fix login bug" }],
			timestamp: 1,
		},
		{
			role: "assistant",
			content: [{ type: "text", text: "I'll inspect the auth module first." }],
			api: "openai-responses",
			provider: "openai",
			model: "gpt-4o",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 2,
		},
	],
};

describe("registerSessionTitle", () => {
	it("does not block agent_end while title agent is pending", async () => {
		const pi = createMockPi();
		let resolveRun: ((value: string | null) => void) | undefined;
		const run = vi.fn(
			() =>
				new Promise<string | null>((resolve) => {
					resolveRun = resolve;
				}),
		);

		const harness = registerSessionTitle(pi as never, {
			loadSettings: () => DEFAULT_AUTO_TITLE_SETTINGS,
			createAgent: () => ({ run }),
		});

		const ctx = createMockCtx();
		harness.handlers.agent_end?.(agentEndEvent, ctx);

		expect(pi.setSessionName).not.toHaveBeenCalled();
		expect(run).toHaveBeenCalledOnce();

		resolveRun?.("Fix login bug");
		await flushPromises();

		expect(pi.setSessionName).toHaveBeenCalledWith("Fix login bug");
	});

	it("skips setSessionName for fast-rejected input", () => {
		const pi = createMockPi();
		const run = vi.fn(async () => "Should not run");

		const harness = registerSessionTitle(pi as never, {
			loadSettings: () => DEFAULT_AUTO_TITLE_SETTINGS,
			createAgent: () => ({ run }),
		});

		harness.handlers.agent_end?.(
			{
				...agentEndEvent,
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "你好" }],
						timestamp: 1,
					},
					{
						role: "assistant",
						content: [{ type: "text", text: "你好！" }],
						api: "openai-responses",
						provider: "openai",
						model: "gpt-4o",
						usage: {
							input: 1,
							output: 1,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 2,
							cost: {
								input: 0,
								output: 0,
								cacheRead: 0,
								cacheWrite: 0,
								total: 0,
							},
						},
						stopReason: "stop",
						timestamp: 2,
					},
				],
			},
			createMockCtx(),
		);
		expect(run).not.toHaveBeenCalled();
		expect(pi.setSessionName).not.toHaveBeenCalled();
	});

	it("allows a later task message after fast reject", () => {
		const pi = createMockPi();
		const run = vi.fn(async () => "Later title");
		const harness = registerSessionTitle(pi as never, {
			loadSettings: () => DEFAULT_AUTO_TITLE_SETTINGS,
			createAgent: () => ({ run }),
		});
		const ctx = createMockCtx();

		harness.handlers.agent_end?.(
			{
				...agentEndEvent,
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "你好" }],
						timestamp: 1,
					},
					{
						role: "assistant",
						content: [{ type: "text", text: "你好！" }],
						api: "openai-responses",
						provider: "openai",
						model: "gpt-4o",
						usage: {
							input: 1,
							output: 1,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 2,
							cost: {
								input: 0,
								output: 0,
								cacheRead: 0,
								cacheWrite: 0,
								total: 0,
							},
						},
						stopReason: "stop",
						timestamp: 2,
					},
				],
			},
			ctx,
		);
		harness.handlers.agent_end?.(agentEndEvent, ctx);

		expect(run).toHaveBeenCalledOnce();
	});
});
