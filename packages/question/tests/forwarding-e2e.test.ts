import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	forwardQuestionPrompt,
	startQuestionRpcServer,
} from "../src/forwarding/forwarder.ts";
import { startQuestionFileWatcher } from "../src/forwarding/file-watcher.ts";
import { SUBAGENT_CHILD_ENV } from "../src/parent-session.ts";

// ── helpers ──

function createEventBus() {
	const handlers = new Map<string, Array<(payload: unknown) => void>>();
	return {
		handlers,
		events: {
			emit(channel: string, payload: unknown) {
				for (const handler of handlers.get(channel) ?? []) {
					handler(payload);
				}
			},
			on(channel: string, handler: (payload: unknown) => void) {
				const list = handlers.get(channel) ?? [];
				list.push(handler);
				handlers.set(channel, list);
				return () => {
					const updated = (handlers.get(channel) ?? []).filter(
						(h) => h !== handler,
					);
					handlers.set(channel, updated);
				};
			},
		},
	};
}

describe("forwarding e2e — single question", () => {
	it("RPC roundtrip for single question", async () => {
		const { events } = createEventBus();

		// Parent side: RPC server
		startQuestionRpcServer(events, async (payload) => {
			return {
				question: payload.question,
				options: payload.options?.map((o) => o.label) ?? [],
				answer: payload.options?.[0]?.label ?? null,
				wasCustom: false,
				cancelled: false,
				responderSessionId: "parent",
				respondedAt: Date.now(),
			};
		});

		// Child side: forward prompt
		const response = await forwardQuestionPrompt({
			events,
			requesterSessionId: "child",
			targetSessionId: "parent",
			params: {
				question: "Pick one",
				options: [{ label: "Option A" }, { label: "Option B" }],
			},
			timeoutMs: 1000,
		});

		expect(response).not.toBeNull();
		expect(response?.answer).toBe("Option A");
		expect(response?.cancelled).toBe(false);
	});

	it("RPC timeout returns null", async () => {
		const { events } = createEventBus();
		// No RPC server registered — should timeout

		const response = await forwardQuestionPrompt({
			events,
			requesterSessionId: "child",
			targetSessionId: "parent",
			params: {
				question: "Pick one",
				options: [{ label: "A" }, { label: "B" }],
			},
			timeoutMs: 100, // short timeout
		});

		expect(response).toBeNull();
	});

	it("file-based roundtrip", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "question-e2e-"));
		const agentDir = join(tmpDir, "agent");
		const sessionId = "parent-session";

		const stop = startQuestionFileWatcher({
			agentDir,
			sessionId,
			responderSessionId: "parent",
			pollIntervalMs: 50,
			showQuestion: async (params) => {
				const single = params as {
					question: string;
					options: Array<{ label: string }>;
				};
				return {
					question: single.question,
					options: single.options.map((o) => o.label),
					answer: single.options[1]?.label ?? null,
					wasCustom: false,
					cancelled: false,
					responderSessionId: "parent",
					respondedAt: Date.now(),
				};
			},
		});

		// Child side: write request, then poll for response
		const response = await forwardQuestionPrompt({
			agentDir,
			requesterSessionId: "child",
			targetSessionId: sessionId,
			params: {
				question: "File-based question?",
				options: [{ label: "Yes" }, { label: "No" }],
			},
			timeoutMs: 2000,
		});

		stop();
		expect(response).not.toBeNull();
		expect(response?.answer).toBe("No");

		// Cleanup
		const { rmSync } = await import("node:fs");
		rmSync(tmpDir, { recursive: true, force: true });
	});
});

describe("forwarding e2e — multi question", () => {
	it("RPC roundtrip for multi question", async () => {
		const { events } = createEventBus();

		startQuestionRpcServer(events, async (payload) => {
			return {
				questions: payload.questions,
				answers: {
					q1: { answer: "Microservices", wasCustom: false, index: 1 },
					q2: { answer: "Custom input", wasCustom: true },
				},
				cancelled: false,
				responderSessionId: "parent",
				respondedAt: Date.now(),
			};
		});

		const response = await forwardQuestionPrompt({
			events,
			requesterSessionId: "child",
			targetSessionId: "parent",
			params: {
				questions: [
					{
						id: "q1",
						title: "Arch",
						question: "Which arch?",
						options: [
							{ label: "Microservices" },
							{ label: "Monolith" },
						],
					},
					{
						id: "q2",
						title: "Other",
						question: "Anything else?",
						options: [{ label: "Yes" }, { label: "No" }],
					},
				],
			},
			timeoutMs: 1000,
		});

		expect(response).not.toBeNull();
		expect(response?.answers?.q1?.answer).toBe("Microservices");
		expect(response?.answers?.q1?.index).toBe(1);
		expect(response?.answers?.q2?.answer).toBe("Custom input");
		expect(response?.answers?.q2?.wasCustom).toBe(true);
		expect(response?.cancelled).toBe(false);
	});

	it("RPC cancelled returns empty answers", async () => {
		const { events } = createEventBus();

		startQuestionRpcServer(events, async () => {
			return {
				answers: {},
				cancelled: true,
				responderSessionId: "parent",
				respondedAt: Date.now(),
			};
		});

		const response = await forwardQuestionPrompt({
			events,
			requesterSessionId: "child",
			targetSessionId: "parent",
			params: {
				questions: [
					{
						question: "Q?",
						options: [{ label: "A" }, { label: "B" }],
					},
				],
			},
			timeoutMs: 1000,
		});

		expect(response).not.toBeNull();
		expect(response?.cancelled).toBe(true);
	});

	it("file-based roundtrip for multi question", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "question-multi-e2e-"));
		const agentDir = join(tmpDir, "agent");
		const sessionId = "parent-session";

		const stop = startQuestionFileWatcher({
			agentDir,
			sessionId,
			responderSessionId: "parent",
			pollIntervalMs: 50,
			showQuestion: async () => {
				return {
					answers: {
						q1: { answer: "TypeScript", wasCustom: false, index: 1 },
					},
					cancelled: false,
					responderSessionId: "parent",
					respondedAt: Date.now(),
				};
			},
		});

		const response = await forwardQuestionPrompt({
			agentDir,
			requesterSessionId: "child",
			targetSessionId: sessionId,
			params: {
				questions: [
					{
						id: "q1",
						question: "Language?",
						options: [
							{ label: "TypeScript" },
							{ label: "Python" },
						],
					},
				],
			},
			timeoutMs: 2000,
		});

		stop();
		expect(response).not.toBeNull();
		expect(response?.answers?.q1?.answer).toBe("TypeScript");

		const { rmSync } = await import("node:fs");
		rmSync(tmpDir, { recursive: true, force: true });
	});
});

describe("forwarding e2e — subagent child poison RPC", () => {
	const originalChildEnv = process.env[SUBAGENT_CHILD_ENV];

	afterEach(() => {
		if (originalChildEnv === undefined) {
			delete process.env[SUBAGENT_CHILD_ENV];
		} else {
			process.env[SUBAGENT_CHILD_ENV] = originalChildEnv;
		}
	});

	it("skips poison cancelled RPC when PI_SUBAGENT_CHILD=1 and uses file reply", async () => {
		process.env[SUBAGENT_CHILD_ENV] = "1";

		const { events } = createEventBus();
		let poisonCalled = false;

		// Local no-UI RPC would previously short-circuit with cancelled.
		startQuestionRpcServer(events, async (payload) => {
			poisonCalled = true;
			return {
				question: payload.question,
				options: payload.options?.map((o) => o.label) ?? [],
				answer: null,
				cancelled: true,
				responderSessionId: "child",
				respondedAt: Date.now(),
			};
		});

		const tmpDir = mkdtempSync(join(tmpdir(), "question-poison-"));
		const agentDir = join(tmpDir, "agent");
		const sessionId = "parent-session";

		const stop = startQuestionFileWatcher({
			agentDir,
			sessionId,
			responderSessionId: "parent",
			pollIntervalMs: 50,
			showQuestion: async (params) => {
				const single = params as {
					question: string;
					options: Array<{ label: string }>;
				};
				return {
					question: single.question,
					options: single.options.map((o) => o.label),
					answer: "Blue",
					wasCustom: false,
					cancelled: false,
					responderSessionId: "parent",
					respondedAt: Date.now(),
				};
			},
		});

		const response = await forwardQuestionPrompt({
			events,
			agentDir,
			requesterSessionId: "child",
			targetSessionId: sessionId,
			params: {
				question: "Favorite color?",
				options: [{ label: "Red" }, { label: "Blue" }],
			},
			timeoutMs: 2000,
		});

		stop();
		expect(poisonCalled).toBe(false);
		expect(response).not.toBeNull();
		expect(response?.cancelled).toBe(false);
		expect(response?.answer).toBe("Blue");

		const { rmSync } = await import("node:fs");
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("null RPC handler does not emit; falls through to file reply", async () => {
		delete process.env[SUBAGENT_CHILD_ENV];

		const { events } = createEventBus();
		let handlerCalls = 0;
		let replyEmits = 0;

		const originalEmit = events.emit.bind(events);
		events.emit = (channel: string, payload: unknown) => {
			if (channel.startsWith("question:rpc:prompt:reply:")) {
				replyEmits += 1;
			}
			originalEmit(channel, payload);
		};

		startQuestionRpcServer(events, async () => {
			handlerCalls += 1;
			return null;
		});

		const tmpDir = mkdtempSync(join(tmpdir(), "question-null-rpc-"));
		const agentDir = join(tmpDir, "agent");
		const sessionId = "parent-session";

		const stop = startQuestionFileWatcher({
			agentDir,
			sessionId,
			responderSessionId: "parent",
			pollIntervalMs: 50,
			showQuestion: async (params) => {
				const single = params as {
					question: string;
					options: Array<{ label: string }>;
				};
				return {
					question: single.question,
					options: single.options.map((o) => o.label),
					answer: single.options[0]?.label ?? null,
					wasCustom: false,
					cancelled: false,
					responderSessionId: "parent",
					respondedAt: Date.now(),
				};
			},
		});

		const response = await forwardQuestionPrompt({
			events,
			agentDir,
			requesterSessionId: "child",
			targetSessionId: sessionId,
			params: {
				question: "Pick one",
				options: [{ label: "A" }, { label: "B" }],
			},
			timeoutMs: 3000,
		});

		stop();

		expect(handlerCalls).toBe(1);
		expect(replyEmits).toBe(0);
		expect(response).not.toBeNull();
		expect(response?.answer).toBe("A");
		expect(response?.cancelled).toBe(false);

		const { rmSync } = await import("node:fs");
		rmSync(tmpDir, { recursive: true, force: true });
	});
});
