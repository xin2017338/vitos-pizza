import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerSubagents } from "../extensions/index.ts";
import { SUBAGENT_PARENT_SESSION_ENV } from "../src/env.ts";
import { SUBAGENTS_READY } from "../src/rpc/channels.ts";

describe("registerSubagents", () => {
	it("sets parent session env on session_start and emits ready", () => {
		const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => void>();
		const emitted: Array<{ channel: string; payload: unknown }> = [];
		const pi = {
			on: vi.fn((event: string, handler: (event: unknown, ctx: ExtensionContext) => void) => {
				handlers.set(event, handler);
			}),
			registerTool: vi.fn(),
			events: {
				emit: vi.fn((channel: string, payload: unknown) => {
					emitted.push({ channel, payload });
				}),
				on: vi.fn(() => () => {}),
			},
		};

		delete process.env[SUBAGENT_PARENT_SESSION_ENV];
		registerSubagents(pi as never);

		const ctx = {
			cwd: process.cwd(),
			sessionManager: {
				getSessionId: () => "parent-session-123",
				getSessionFile: () => null,
			},
		} as unknown as ExtensionContext;

		handlers.get("session_start")?.({}, ctx);
		expect(process.env[SUBAGENT_PARENT_SESSION_ENV]).toBe("parent-session-123");
		expect(emitted.some((entry) => entry.channel === SUBAGENTS_READY)).toBe(true);

		handlers.get("session_shutdown")?.({}, ctx);
		expect(process.env[SUBAGENT_PARENT_SESSION_ENV]).toBeUndefined();
	});
});
