import { describe, expect, it } from "vitest";
import {
	buildTitleSystemPrompt,
	buildTitleTask,
	buildTitleUserPrompt,
} from "../src/build-title-prompt.ts";

describe("build-title-prompt", () => {
	it("asks for intent-based summary within max length", () => {
		expect(buildTitleSystemPrompt(20)).toContain("20字以内");
		expect(buildTitleSystemPrompt(20)).toContain("助手最后一次回复");
	});

	it("includes user message and assistant reply", () => {
		const prompt = buildTitleUserPrompt({
			userMessage: "修复登录 bug",
			assistantReply: "我先检查 auth 模块。",
		});
		expect(prompt).toContain("修复登录 bug");
		expect(prompt).toContain("我先检查 auth 模块。");
	});

	it("includes max length in buildTitleTask", () => {
		const task = buildTitleTask(
			{
				userMessage: "修复登录 bug",
				assistantReply: "我先检查 auth 模块。",
			},
			20,
		);
		expect(task).toContain("最大标题长度：20 字");
		expect(task).toContain("修复登录 bug");
	});
});
