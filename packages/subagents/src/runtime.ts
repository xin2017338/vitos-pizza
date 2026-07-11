import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createAsyncJobTracker } from "./async/job-tracker.ts";
import type { SubagentEventBus } from "./async/job-tracker.ts";
import { restoreAsyncJobs, spawnAsyncRun } from "./async/spawn-async.ts";
import { executeSubagent } from "./execute-subagent.ts";
import type {
	ExecuteSubagentInput,
	SubagentDetails,
	WaitInput,
	WaitResult,
} from "./types.ts";
import { waitForSubagents } from "./wait.ts";

export interface SubagentRuntimeDeps {
	getContext: () => ExtensionContext | null;
	events?: SubagentEventBus;
}

export interface SubagentRuntime {
	execute(
		input: ExecuteSubagentInput,
		options?: {
			signal?: AbortSignal;
			onUpdate?: (partial: AgentToolResult<SubagentDetails>) => void;
		},
	): Promise<AgentToolResult<SubagentDetails>>;
	wait(input?: WaitInput, options?: { signal?: AbortSignal }): Promise<WaitResult>;
	listAsync(): ReturnType<ReturnType<typeof createAsyncJobTracker>["list"]>;
}

export function createSubagentRuntime(deps: SubagentRuntimeDeps): SubagentRuntime {
	const tracker = createAsyncJobTracker();

	return {
		async execute(input, options = {}) {
			const ctx = deps.getContext();
			if (!ctx) {
				return {
					content: [
						{
							type: "text",
							text: "Subagent runtime is not bound to an active session.",
						},
					],
					details: {
						mode: "single",
						agentScope: "both",
						projectAgentsDir: null,
						results: [],
					},
				};
			}

			const parentSessionId = ctx.sessionManager.getSessionId?.() ?? null;
			const sessionFile = ctx.sessionManager.getSessionFile?.() ?? null;

			if (input.async) {
				const { result } = spawnAsyncRun({
					params: input,
					cwd: ctx.cwd,
					parentSessionId,
					sessionFile,
					tracker,
					events: deps.events,
					signal: options.signal,
				});
				return result;
			}

			return executeSubagent(input, {
				cwd: ctx.cwd,
				parentSessionId,
				signal: options.signal,
				onUpdate: options.onUpdate
					? (details, text) =>
							options.onUpdate?.({
								content: [{ type: "text", text }],
								details,
							})
					: undefined,
			});
		},

		async wait(input = {}, _options = {}) {
			const ctx = deps.getContext();
			return waitForSubagents(input, {
				tracker,
				sessionFile: ctx?.sessionManager.getSessionFile?.() ?? null,
				events: deps.events,
			});
		},

		listAsync() {
			return tracker.list();
		},

		_restore(sessionFile: string | null) {
			restoreAsyncJobs(sessionFile, tracker);
		},
	} as SubagentRuntime & { _restore(sessionFile: string | null): void };
}
