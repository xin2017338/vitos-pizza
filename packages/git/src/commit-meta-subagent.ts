import type { SubagentEventBus } from "@vitos-pizza/subagents/rpc/client";
import { requestSubagentRun } from "@vitos-pizza/subagents/rpc/client";
import { buildCommitTask } from "./build-commit-prompt.ts";
import { parseCommitResponse } from "./parse-commit-response.ts";
import type { CommitMeta, GitContext, ShipMode } from "./types.ts";

function extractResultText(
	content: Array<{ type: string; text?: string }> | undefined,
): string {
	if (!content?.length) return "";
	const text = content[0];
	return text?.type === "text" ? (text.text ?? "").trim() : "";
}

export interface CommitMetaSubagentDeps {
	events: SubagentEventBus;
	resolveModelRef: () => string | undefined;
	timeoutMs?: number;
}

export function createCommitMetaSubagent(
	deps: CommitMetaSubagentDeps,
): (mode: ShipMode, context: GitContext) => Promise<CommitMeta | null> {
	return async (mode, context) => {
		const result = await requestSubagentRun(
			deps.events,
			{
				agent: "commit",
				task: buildCommitTask(mode, context),
				agentScope: "both",
				model: deps.resolveModelRef(),
			},
			{ timeoutMs: deps.timeoutMs ?? 60_000 },
		);

		if (!result) return null;
		const text = extractResultText(result.content);
		if (!text) return null;
		return parseCommitResponse(text, mode);
	};
}

export function resolveSessionModelRef(ctx: {
	model?: { provider?: string; id?: string } | undefined;
}): string | undefined {
	if (ctx.model?.provider && ctx.model?.id) {
		return `${ctx.model.provider}/${ctx.model.id}`;
	}
	return undefined;
}
