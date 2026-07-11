import { describe, expect, it } from "vitest";
import {
	requestSubagentRun,
	startSubagentRpcServer,
} from "../src/rpc/client.ts";
import { SUBAGENTS_RPC_RUN } from "../src/rpc/channels.ts";
import { createSubagentRuntime } from "../src/runtime.ts";
import type { SubagentRuntime } from "../src/runtime.ts";

describe("subagent rpc", () => {
	it("returns a run reply over pi.events", async () => {
		const handlers = new Map<string, Array<(payload: unknown) => void>>();
		const events = {
			emit(channel: string, payload: unknown) {
				for (const handler of handlers.get(channel) ?? []) handler(payload);
			},
			on(channel: string, handler: (payload: unknown) => void) {
				const list = handlers.get(channel) ?? [];
				list.push(handler);
				handlers.set(channel, list);
				return () => {
					handlers.set(
						channel,
						(handlers.get(channel) ?? []).filter((entry) => entry !== handler),
					);
				};
			},
		};

		const runtime: SubagentRuntime = {
			async execute() {
				return {
					content: [{ type: "text" as const, text: "ok" }],
					details: {
						mode: "single" as const,
						agentScope: "both" as const,
						projectAgentsDir: null,
						results: [],
					},
				};
			},
			async wait() {
				return { completed: [], timedOut: false, activeRemaining: 0 };
			},
			listAsync() {
				return [];
			},
		};

		startSubagentRpcServer(events, runtime);

		const result = await requestSubagentRun(
			events,
			{ agent: "scout", task: "hello" },
			{ timeoutMs: 1000 },
		);

		expect(result?.content[0]).toMatchObject({ type: "text", text: "ok" });
		expect(handlers.has(SUBAGENTS_RPC_RUN)).toBe(true);
	});
});

describe("createSubagentRuntime", () => {
	it("reports missing session context", async () => {
		const runtime = createSubagentRuntime({
			getContext: () => null,
		});
		const result = await runtime.execute({ agent: "scout", task: "x" });
		expect(result.content[0]).toMatchObject({
			type: "text",
			text: "Subagent runtime is not bound to an active session.",
		});
	});
});
