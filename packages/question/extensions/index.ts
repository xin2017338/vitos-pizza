/**
 * @vitos-pizza/question — structured ask-user question tool.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { startQuestionFileWatcher } from "../src/forwarding/file-watcher.ts";
import { startQuestionRpcServer } from "../src/forwarding/forwarder.ts";
import {
	promptQuestionLocally,
	registerQuestionTool,
} from "../src/register-tool.ts";

export default function (
	pi: import("@earendil-works/pi-coding-agent").ExtensionAPI,
) {
	let activeCtx: ExtensionContext | null = null;
	let stopFileWatcher: (() => void) | null = null;
	const agentDir = getAgentDir();

	const unsubRpc = startQuestionRpcServer(pi.events, async (payload) => {
		const ctx = activeCtx;
		if (!ctx?.hasUI) {
			return {
				question: payload.question,
				options: payload.options.map((o) => o.label),
				answer: null,
				cancelled: true,
				responderSessionId: ctx?.sessionManager.getSessionId?.() ?? "unknown",
				respondedAt: Date.now(),
			};
		}
		return promptQuestionLocally(
			ctx.ui,
			{ question: payload.question, options: payload.options },
			ctx.sessionManager.getSessionId?.() ?? "unknown",
		);
	});

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
						return {
							question: params.question,
							options: params.options.map((o) => o.label),
							answer: null,
							cancelled: true,
							responderSessionId: sessionId,
							respondedAt: Date.now(),
						};
					}
					return promptQuestionLocally(activeCtx.ui, params, sessionId);
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
