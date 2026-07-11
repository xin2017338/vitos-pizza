import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TitleModelContext } from "../src/resolve-title-model.ts";
import {
	resolveTitleModel,
	resolveTitleModelRef,
} from "../src/resolve-title-model.ts";
import { createTitleAgent } from "../src/title-agent.ts";
import { DEFAULT_AUTO_TITLE_SETTINGS } from "../src/types.ts";

const requestSubagentRun = vi.hoisted(() => vi.fn());

vi.mock("@vitos-pizza/subagents/rpc/client", () => ({
	requestSubagentRun,
}));

const sampleContext = {
	userMessage: "修复登录 bug",
	assistantReply: "我先检查 auth 模块。",
};

function createMockEvents() {
	const handlers = new Map<string, Array<(payload: unknown) => void>>();
	return {
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
}

describe("resolveTitleModel", () => {
	it("prefers configured model over session model", () => {
		const sessionModel = { id: "session-model", provider: "test" };
		const configuredModel = { id: "configured-model", provider: "google" };
		const find = vi.fn(() => configuredModel);
		const ctx: TitleModelContext = {
			model: sessionModel as TitleModelContext["model"],
			modelRegistry: { find } as unknown as TitleModelContext["modelRegistry"],
		};

		expect(resolveTitleModel(ctx, "google/gemini-2.5-flash")).toBe(
			configuredModel,
		);
		expect(find).toHaveBeenCalledWith("google", "gemini-2.5-flash");
	});

	it("falls back to session model", () => {
		const sessionModel = { id: "session-model", provider: "openai" };
		const ctx: TitleModelContext = {
			model: sessionModel as TitleModelContext["model"],
			modelRegistry: {
				find: vi.fn(() => undefined),
			} as unknown as TitleModelContext["modelRegistry"],
		};

		expect(resolveTitleModel(ctx, "missing/model")).toBe(sessionModel);
		expect(resolveTitleModel(ctx)).toBe(sessionModel);
	});
});

describe("resolveTitleModelRef", () => {
	it("returns configured model ref when set", () => {
		const ctx: TitleModelContext = {
			model: { id: "gpt-4o", provider: "openai" } as TitleModelContext["model"],
		};
		expect(resolveTitleModelRef(ctx, "google/gemini-2.5-flash")).toBe(
			"google/gemini-2.5-flash",
		);
	});

	it("falls back to session provider/id", () => {
		const ctx: TitleModelContext = {
			model: { id: "gpt-4o", provider: "openai" } as TitleModelContext["model"],
		};
		expect(resolveTitleModelRef(ctx)).toBe("openai/gpt-4o");
	});
});

describe("createTitleAgent", () => {
	beforeEach(() => {
		requestSubagentRun.mockReset();
	});

	it("returns null for SKIP responses", async () => {
		requestSubagentRun.mockResolvedValue({
			content: [{ type: "text", text: "SKIP" }],
			details: {
				mode: "single",
				agentScope: "both",
				projectAgentsDir: null,
				results: [],
			},
		});

		const agent = createTitleAgent({
			events: createMockEvents(),
			resolveModelRef: () => "openai/gpt-4o",
			settings: DEFAULT_AUTO_TITLE_SETTINGS,
		});

		await expect(agent.run(sampleContext)).resolves.toBeNull();
		expect(requestSubagentRun).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				agent: "title",
				agentScope: "both",
				model: "openai/gpt-4o",
			}),
			expect.objectContaining({ timeoutMs: DEFAULT_AUTO_TITLE_SETTINGS.timeoutMs }),
		);
	});

	it("returns normalized titles within 20 chars", async () => {
		requestSubagentRun.mockResolvedValue({
			content: [{ type: "text", text: "修复登录问题" }],
			details: {
				mode: "single",
				agentScope: "both",
				projectAgentsDir: null,
				results: [],
			},
		});

		const agent = createTitleAgent({
			events: createMockEvents(),
			resolveModelRef: () => "openai/gpt-4o",
			settings: DEFAULT_AUTO_TITLE_SETTINGS,
		});

		await expect(agent.run(sampleContext)).resolves.toBe("修复登录问题");
	});

	it("returns null when RPC times out", async () => {
		requestSubagentRun.mockResolvedValue(null);

		const agent = createTitleAgent({
			events: createMockEvents(),
			resolveModelRef: () => undefined,
			settings: DEFAULT_AUTO_TITLE_SETTINGS,
		});

		await expect(agent.run(sampleContext)).resolves.toBeNull();
	});
});
