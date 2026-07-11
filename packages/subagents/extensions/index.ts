/**
 * @vitos-pizza/subagents — subprocess subagent delegation for Vito's Pizzeria.
 */

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SUBAGENT_CHILD_ENV, SUBAGENT_PARENT_SESSION_ENV } from "../src/env.ts";
import { createSubagentRuntime } from "../src/runtime.ts";
import type { SubagentRuntime } from "../src/runtime.ts";
import { SUBAGENTS_READY } from "../src/rpc/channels.ts";
import { startSubagentRpcServer } from "../src/rpc/client.ts";
import {
	clearSubagentResultAnimation,
	ensureSubagentResultAnimation,
} from "../src/render-animation.ts";
import {
	renderSubagentCall,
	renderSubagentResult,
	subagentResultIsRunning,
	renderWaitCall,
	renderWaitResult,
} from "../src/render.ts";
import { SubagentParams, WaitParams } from "../src/schema.ts";
import type { ExecuteSubagentInput, WaitInput } from "../src/types.ts";

export interface SubagentsTestHarness {
	handlers: {
		session_start?: (event: unknown, ctx: ExtensionContext) => void;
		session_shutdown?: (event: unknown, ctx: ExtensionContext) => void;
	};
	runtime?: SubagentRuntime;
}

export function registerSubagents(
	pi: ExtensionAPI,
): SubagentsTestHarness {
	const handlers: SubagentsTestHarness["handlers"] = {};
	let currentCtx: ExtensionContext | null = null;
	let rpcDispose: (() => void) | null = null;

	const runtime = createSubagentRuntime({
		getContext: () => currentCtx,
		events: pi.events,
	}) as SubagentRuntime & { _restore(sessionFile: string | null): void };

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description:
			"Delegate tasks to specialized subagents. Modes: single (agent+task), parallel (tasks[]), chain (chain[] with {previous}). Use async:true for background runs.",
		parameters: SubagentParams,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			currentCtx = ctx;
			return runtime.execute(params as ExecuteSubagentInput, {
				signal,
				onUpdate: onUpdate
					? (partial) => onUpdate(partial)
					: undefined,
			});
		},
		renderCall(args, theme) {
			return renderSubagentCall(args as Record<string, unknown>, theme);
		},
		renderResult(result, options, theme, context) {
			if (subagentResultIsRunning(
				result as {
					content: Array<{ type: string; text?: string }>;
					details?: import("../src/types.ts").SubagentDetails;
				},
				options,
			)) {
				ensureSubagentResultAnimation(context);
			} else {
				clearSubagentResultAnimation(context);
			}
			return renderSubagentResult(
				result as {
					content: Array<{ type: string; text?: string }>;
					details?: import("../src/types.ts").SubagentDetails;
				},
				options,
				theme,
				context,
			);
		},
	});

	pi.registerTool({
		name: "wait",
		label: "Wait",
		description:
			"Block until background subagent runs finish. Default returns when the first run completes; use all:true to wait for every active run.",
		parameters: WaitParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			currentCtx = ctx;
			const outcome = await runtime.wait(params as WaitInput);
			const summaries = outcome.completed.map((run) => {
				const status = run.state;
				const output = run.finalOutput ?? "(no output)";
				return `- ${run.id} [${run.agents.join(", ")}] ${status}: ${output}`;
			});
			const header = outcome.timedOut
				? `Wait timed out (${outcome.activeRemaining} still active).`
				: `Wait complete (${outcome.completed.length} run(s)).`;
			return {
				content: [
					{
						type: "text",
						text: `${header}\n${summaries.join("\n") || "(none)"}`,
					},
				],
				details: outcome,
			};
		},
		renderCall(args, theme) {
			return renderWaitCall(args as Record<string, unknown>, theme);
		},
		renderResult(result, _options, theme) {
			return renderWaitResult(
				result as { content: Array<{ type: string; text?: string }> },
				theme,
			);
		},
	});

	handlers.session_start = (_event, ctx) => {
		currentCtx = ctx;
		if (!process.env[SUBAGENT_CHILD_ENV]) {
			const sessionId = ctx.sessionManager.getSessionId?.();
			if (sessionId) {
				process.env[SUBAGENT_PARENT_SESSION_ENV] = sessionId;
			}
		}
		const sessionFile = ctx.sessionManager.getSessionFile?.() ?? null;
		(runtime as SubagentRuntime & { _restore(sessionFile: string | null): void })._restore(
			sessionFile,
		);
		rpcDispose?.();
		rpcDispose = startSubagentRpcServer(pi.events, runtime);
		pi.events.emit(SUBAGENTS_READY, { version: 1 });
	};

	pi.on("session_start", handlers.session_start);

	handlers.session_shutdown = () => {
		delete process.env[SUBAGENT_PARENT_SESSION_ENV];
		rpcDispose?.();
		rpcDispose = null;
		currentCtx = null;
	};

	pi.on("session_shutdown", handlers.session_shutdown);

	return { handlers, runtime };
}

export default function subagentsExtension(pi: ExtensionAPI) {
	if (process.env[SUBAGENT_CHILD_ENV] === "1") {
		return;
	}
	registerSubagents(pi);
}
