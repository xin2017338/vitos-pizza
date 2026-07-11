import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type {
	Theme,
	ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { Text } from "@earendil-works/pi-tui";

type BuiltInRenderDefinition = {
	renderResult?: (
		result: AgentToolResult<unknown>,
		options: ToolRenderResultOptions,
		theme: Theme,
		context: unknown,
	) => Component;
};

export function getTextContent(
	result: AgentToolResult<unknown>,
): string | undefined {
	const textContent = result.content.find((c) => c.type === "text");
	if (textContent?.type !== "text") return undefined;
	return textContent.text;
}

export function countNonEmptyLines(text: string): number {
	return text.trim().split("\n").filter(Boolean).length;
}

export function renderBuiltInToolResult(
	definition: object,
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: unknown,
): Component {
	const renderResult = (definition as BuiltInRenderDefinition).renderResult;
	if (!renderResult) {
		return new Text("", 0, 0);
	}
	return renderResult(result, options, theme, context);
}
