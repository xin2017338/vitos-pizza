/**
 * @vitos-pizza/question — structured ask-user question tool.
 * Supports single-question (legacy) and multi-question tabbed modes.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { startQuestionFileWatcher } from "../src/forwarding/file-watcher.ts";
import { startQuestionRpcServer } from "../src/forwarding/forwarder.ts";
import type { ForwardQuestionPayload } from "../src/forwarding/forwarder.ts";
import {
	promptQuestionLocally,
	registerQuestionTool,
} from "../src/register-tool.ts";
import type { MultiQuestionParams, QuestionParams } from "../src/types.ts";

export default function (
	pi: import("@earendil-works/pi-coding-agent").ExtensionAPI,
) {
	let activeCtx: ExtensionContext | null = null;
	let stopFileWatcher: (() => void) | null = null;
	const agentDir = getAgentDir();

	const unsubRpc = startQuestionRpcServer(
		pi.events,
		async (payload: ForwardQuestionPayload) => {
			const ctx = activeCtx;
			// No UI or wrong session — stay silent so callers can fall through
			// to file-based forwarding (do not fake cancelled).
			if (!ctx?.hasUI) return null;

			const sessionId =
				ctx.sessionManager.getSessionId?.() ?? "unknown";
			if (
				payload.targetSessionId &&
				payload.targetSessionId !== sessionId
			) {
				return null;
			}

			if (payload.questions) {
				return promptQuestionLocally(
					ctx.ui,
					{ questions: payload.questions } as MultiQuestionParams,
					sessionId,
				);
			}

			return promptQuestionLocally(
				ctx.ui,
				{
					question: payload.question ?? "",
					options: payload.options ?? [],
					selectType: payload.selectType,
				} as QuestionParams,
				sessionId,
			);
		},
	);

	registerQuestionTool(pi, {
		getAgentDir: () => agentDir,
		events: pi.events,
	});

	pi.on("session_start", async (_event, ctx) => {
		activeCtx = ctx;
		stopFileWatcher?.();

		const sessionId = ctx.sessionManager.getSessionId?.();
		if (sessionId && ctx.hasUI) {
			stopFileWatcher = startQuestionFileWatcher({
				agentDir,
				sessionId,
				responderSessionId: sessionId,
				showQuestion: async (params) => {
					if (!activeCtx?.hasUI) {
						if ("questions" in params) {
							return {
								answers: {},
								cancelled: true,
								responderSessionId: sessionId,
								respondedAt: Date.now(),
							};
						}
						return {
							question: (params as QuestionParams).question,
							options: (params as QuestionParams).options.map((o) => o.label),
							answer: null,
							cancelled: true,
							responderSessionId: sessionId,
							respondedAt: Date.now(),
						};
					}
					return promptQuestionLocally(
						activeCtx.ui,
						params,
						sessionId,
					);
				},
			});
		}
	});

	pi.on("session_shutdown", (_event, _ctx) => {
		stopFileWatcher?.();
		stopFileWatcher = null;
		activeCtx = null;
	});

	void unsubRpc;
}
