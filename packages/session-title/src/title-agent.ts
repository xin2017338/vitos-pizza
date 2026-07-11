import type { SubagentEventBus } from "@vitos-pizza/subagents/rpc/client";
import { requestSubagentRun } from "@vitos-pizza/subagents/rpc/client";
import { buildTitleTask } from "./build-title-prompt.ts";
import type { TitleNamingContext } from "./extract-title-context.ts";
import { normalizeTitle } from "./normalize-title.ts";
import { parseTitleResponse } from "./parse-title-response.ts";
import type { AutoTitleSettings } from "./types.ts";

export interface TitleAgent {
	run(
		context: TitleNamingContext,
		signal?: AbortSignal,
	): Promise<string | null>;
}

export interface TitleAgentDeps {
	events: SubagentEventBus;
	resolveModelRef: () => string | undefined;
	settings: AutoTitleSettings;
}

function extractResultText(
	content: Array<{ type: string; text?: string }> | undefined,
): string {
	if (!content?.length) return "";
	const text = content[0];
	return text?.type === "text" ? (text.text ?? "").trim() : "";
}

export function createTitleAgent(deps: TitleAgentDeps): TitleAgent {
	return {
		async run(
			context: TitleNamingContext,
			signal?: AbortSignal,
		): Promise<string | null> {
			const result = await requestSubagentRun(
				deps.events,
				{
					agent: "title",
					task: buildTitleTask(context, deps.settings.maxTitleLength),
					agentScope: "both",
					model: deps.resolveModelRef(),
				},
				{
					timeoutMs: deps.settings.timeoutMs,
					signal,
				},
			);

			if (!result) return null;

			const text = extractResultText(result.content);
			if (!text) return null;

			const parsed = parseTitleResponse(text);
			if (!parsed) return null;
			return normalizeTitle(parsed, deps.settings.maxTitleLength) || null;
		},
	};
}
