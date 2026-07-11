import { describe, expect, it } from "vitest";
import {
	QUESTION_RPC_PROMPT,
	QUESTION_RPC_PROMPT_REPLY_PREFIX,
	questionReplyChannel,
} from "../src/forwarding/channels.ts";
import {
	forwardQuestionPrompt,
	startQuestionRpcServer,
} from "../src/forwarding/forwarder.ts";

describe("question forwarding", () => {
	it("forwards prompts over the event bus", async () => {
		const handlers = new Map<string, Array<(payload: unknown) => void>>();
		const events = {
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
					handlers.set(
						channel,
						(handlers.get(channel) ?? []).filter((item) => item !== handler),
					);
				};
			},
		};

		startQuestionRpcServer(events, async (payload) => ({
			question: payload.question,
			options: payload.options.map((o) => o.label),
			answer: payload.options[0]?.label ?? null,
			wasCustom: false,
			cancelled: false,
			responderSessionId: "parent",
			respondedAt: Date.now(),
		}));

		const response = await forwardQuestionPrompt({
			events,
			requesterSessionId: "child",
			targetSessionId: "parent",
			params: {
				question: "Which approach?",
				options: [{ label: "A" }, { label: "B" }],
			},
			timeoutMs: 1000,
		});

		expect(response?.answer).toBe("A");
		expect(handlers.has(QUESTION_RPC_PROMPT)).toBe(true);
		expect(
			[...handlers.keys()].some((key) =>
				key.startsWith(QUESTION_RPC_PROMPT_REPLY_PREFIX),
			),
		).toBe(true);
		expect(questionReplyChannel("test-id")).toBe(
			`${QUESTION_RPC_PROMPT_REPLY_PREFIX}test-id`,
		);
	});
});
