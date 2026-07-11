import {
	SUBAGENT_ASYNC_COMPLETE,
	SUBAGENT_ASYNC_STARTED,
} from "../rpc/channels.ts";
import type { AsyncRunStatus, ExecuteSubagentInput } from "../types.ts";

export interface AsyncJobTracker {
	track(runId: string, status: AsyncRunStatus): void;
	update(runId: string, patch: Partial<AsyncRunStatus>): void;
	get(runId: string): AsyncRunStatus | undefined;
	list(): AsyncRunStatus[];
	remove(runId: string): void;
	clear(): void;
}

export function createAsyncJobTracker(): AsyncJobTracker {
	const jobs = new Map<string, AsyncRunStatus>();

	return {
		track(runId, status) {
			jobs.set(runId, status);
		},
		update(runId, patch) {
			const current = jobs.get(runId);
			if (!current) return;
			jobs.set(runId, { ...current, ...patch, updatedAt: Date.now() });
		},
		get(runId) {
			return jobs.get(runId);
		},
		list() {
			return Array.from(jobs.values());
		},
		remove(runId) {
			jobs.delete(runId);
		},
		clear() {
			jobs.clear();
		},
	};
}

export interface SubagentEventBus {
	emit(channel: string, payload: unknown): void;
	on(channel: string, handler: (payload: unknown) => void): () => void;
}

export function emitAsyncStarted(
	events: SubagentEventBus | undefined,
	payload: {
		id: string;
		mode: AsyncRunStatus["mode"];
		sessionId: string | null;
		agents: string[];
	},
): void {
	events?.emit(SUBAGENT_ASYNC_STARTED, payload);
}

export function emitAsyncComplete(
	events: SubagentEventBus | undefined,
	payload: {
		id: string;
		exitCode: number;
		finalOutput: string;
	},
): void {
	events?.emit(SUBAGENT_ASYNC_COMPLETE, payload);
}

export type AsyncExecuteInput = ExecuteSubagentInput;
