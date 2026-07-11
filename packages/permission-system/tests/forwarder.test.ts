import { describe, expect, it } from "vitest";
import {
	forwardPermissionPrompt,
	PERMISSION_RPC_PROMPT,
	PERMISSION_RPC_PROMPT_REPLY_PREFIX,
	startPermissionRpcServer,
} from "../src/forwarding/forwarder.ts";

describe("permission forwarding", () => {
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

		startPermissionRpcServer(events, async () => ({
			approved: true,
			state: "approved",
		}));

		const decision = await forwardPermissionPrompt({
			events,
			requesterSessionId: "child",
			targetSessionId: "parent",
			title: "Allow bash?",
			message: "git push",
			surface: "bash",
			value: "git push",
			timeoutMs: 1000,
		});

		expect(decision?.approved).toBe(true);
		expect(handlers.has(PERMISSION_RPC_PROMPT)).toBe(true);
		expect(
			[...handlers.keys()].some((key) =>
				key.startsWith(PERMISSION_RPC_PROMPT_REPLY_PREFIX),
			),
		).toBe(true);
	});
});
