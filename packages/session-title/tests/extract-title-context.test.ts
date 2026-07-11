import { describe, expect, it } from "vitest";
import { extractTitleContext } from "../src/extract-title-context.ts";

describe("extractTitleContext", () => {
	it("extracts the last user message and assistant reply", () => {
		const context = extractTitleContext([
			{
				role: "user",
				content: [{ type: "text", text: "修复登录 bug" }],
				timestamp: 1,
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "我先检查 auth 模块。" }],
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
		] as never);

		expect(context).toEqual({
			userMessage: "修复登录 bug",
			assistantReply: "我先检查 auth 模块。",
		});
	});

	it("returns null when assistant reply is missing", () => {
		expect(
			extractTitleContext([
				{
					role: "user",
					content: "hello",
					timestamp: 1,
				},
			] as never),
		).toBeNull();
	});
});
