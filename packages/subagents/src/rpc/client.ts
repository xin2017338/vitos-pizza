import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { randomUUID } from "node:crypto";
import type { SubagentRuntime } from "../runtime.ts";
import type { ExecuteSubagentInput, SubagentDetails, WaitInput, WaitResult } from "../types.ts";
import {
	SUBAGENTS_RPC_RUN,
	SUBAGENTS_RPC_WAIT,
	subagentsRunReplyChannel,
	subagentsWaitReplyChannel,
} from "./channels.ts";

export interface SubagentEventBus {
	emit(channel: string, payload: unknown): void;
	on(channel: string, handler: (payload: unknown) => void): () => void;
}

export interface RunRpcRequest extends ExecuteSubagentInput {
	requestId: string;
}

export interface WaitRpcRequest extends WaitInput {
	requestId: string;
}

export function startSubagentRpcServer(
	events: SubagentEventBus,
	runtime: SubagentRuntime,
): () => void {
	const unsubRun = events.on(SUBAGENTS_RPC_RUN, async (raw) => {
		const payload = raw as RunRpcRequest;
		if (!payload?.requestId) return;
		try {
			const result = await runtime.execute(payload);
			events.emit(subagentsRunReplyChannel(payload.requestId), result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const failure: AgentToolResult<SubagentDetails> = {
				content: [{ type: "text", text: `Subagent RPC failed: ${message}` }],
				details: {
					mode: "single",
					agentScope: "both",
					projectAgentsDir: null,
					results: [],
				},
			};
			events.emit(subagentsRunReplyChannel(payload.requestId), failure);
		}
	});

	const unsubWait = events.on(SUBAGENTS_RPC_WAIT, async (raw) => {
		const payload = raw as WaitRpcRequest;
		if (!payload?.requestId) return;
		try {
			const result: WaitResult = await runtime.wait(payload);
			events.emit(subagentsWaitReplyChannel(payload.requestId), result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			events.emit(subagentsWaitReplyChannel(payload.requestId), {
				completed: [],
				timedOut: true,
				activeRemaining: 0,
				error: message,
			});
		}
	});

	return () => {
		unsubRun();
		unsubWait();
	};
}

export interface RpcClientOptions {
	timeoutMs?: number;
	signal?: AbortSignal;
}

function waitForReply<T>(
	events: SubagentEventBus,
	replyChannel: string,
	options: RpcClientOptions = {},
): Promise<T | null> {
	const timeoutMs = options.timeoutMs ?? 30_000;
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			unsub();
			resolve(null);
		}, timeoutMs);

		const finish = (value: T | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			unsub();
			resolve(value);
		};

		const unsub = events.on(replyChannel, (reply) => finish(reply as T));

		if (options.signal) {
			if (options.signal.aborted) finish(null);
			else {
				options.signal.addEventListener(
					"abort",
					() => finish(null),
					{ once: true },
				);
			}
		}
	});
}

export async function requestSubagentRun(
	events: SubagentEventBus,
	params: ExecuteSubagentInput,
	options: RpcClientOptions = {},
): Promise<AgentToolResult<SubagentDetails> | null> {
	const requestId = randomUUID();
	const reply = waitForReply<AgentToolResult<SubagentDetails>>(
		events,
		subagentsRunReplyChannel(requestId),
		options,
	);
	events.emit(SUBAGENTS_RPC_RUN, { requestId, ...params });
	return reply;
}

export async function requestSubagentWait(
	events: SubagentEventBus,
	params: WaitInput = {},
	options: RpcClientOptions = {},
): Promise<WaitResult | null> {
	const requestId = randomUUID();
	const reply = waitForReply<WaitResult>(
		events,
		subagentsWaitReplyChannel(requestId),
		options,
	);
	events.emit(SUBAGENTS_RPC_WAIT, { requestId, ...params });
	return reply;
}
