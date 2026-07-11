import type { TitleNamingContext } from "./extract-title-context.ts";

export function buildTitleSystemPrompt(maxLength: number): string {
	return `分析用户意图，结合助手最后一次回复，用${maxLength}字以内简短总结本次会话主题。只输出标题，不要引号或解释。若无明确任务意图则回复 SKIP。`;
}

export function buildTitleUserPrompt(context: TitleNamingContext): string {
	return `用户：${context.userMessage}\n\n助手最后一次回复：${context.assistantReply}`;
}

export function buildTitleTask(
	context: TitleNamingContext,
	maxTitleLength: number,
): string {
	return `最大标题长度：${maxTitleLength} 字。\n\n${buildTitleUserPrompt(context)}`;
}
