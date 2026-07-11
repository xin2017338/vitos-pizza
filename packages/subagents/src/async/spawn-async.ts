import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { executeSubagent, newRunId } from "../execute-subagent.ts";
import {
	agentsFromDetails,
	getAsyncRootFromSessionFile,
	getRunDir,
	isTerminalState,
	readRunResult,
	readRunStatus,
	writeRunResult,
	writeRunStatus,
} from "./storage.ts";
import type { SubagentEventBus } from "./job-tracker.ts";
import { emitAsyncComplete, emitAsyncStarted } from "./job-tracker.ts";
import type { AsyncJobTracker } from "./job-tracker.ts";
import {
	SUBAGENT_CHILD_DISPOSED,
	SUBAGENT_CHILD_SESSION_CREATED,
} from "../rpc/channels.ts";
import type { ExecuteSubagentInput, SubagentDetails, SubagentMode } from "../types.ts";
import { getResultOutput } from "../utils.ts";

export interface SpawnAsyncInput {
	params: ExecuteSubagentInput;
	cwd: string;
	parentSessionId?: string | null;
	sessionFile?: string | null;
	tracker: AsyncJobTracker;
	events?: SubagentEventBus;
	signal?: AbortSignal;
}

export function spawnAsyncRun(input: SpawnAsyncInput): {
	runId: string;
	result: AgentToolResult<SubagentDetails>;
} {
	const runId = newRunId();
	const asyncRoot = getAsyncRootFromSessionFile(input.sessionFile ?? null);
	const runDir = getRunDir(asyncRoot, runId);
	fs.mkdirSync(runDir, { recursive: true });

	const mode: SubagentMode =
		(input.params.chain?.length ?? 0) > 0
			? "chain"
			: (input.params.tasks?.length ?? 0) > 0
				? "parallel"
				: "single";

	const agents =
		mode === "single" && input.params.agent
			? [input.params.agent]
			: mode === "chain"
				? (input.params.chain?.map((step) => step.agent) ?? [])
				: (input.params.tasks?.map((task) => task.agent) ?? []);

	const status = {
		id: runId,
		state: "queued" as const,
		mode,
		sessionId: input.parentSessionId ?? null,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		agents,
	};

	writeRunStatus(runDir, status);
	input.tracker.track(runId, status);

	emitAsyncStarted(input.events, {
		id: runId,
		mode,
		sessionId: input.parentSessionId ?? null,
		agents,
	});

	input.events?.emit(SUBAGENT_CHILD_SESSION_CREATED, {
		sessionId: runId,
		parentSessionId: input.parentSessionId ?? undefined,
	});

	const childSessionId = randomUUID();

	void executeSubagent(input.params, {
		cwd: input.cwd,
		parentSessionId: input.parentSessionId,
		signal: input.signal,
	})
		.then((toolResult) => {
			const details = toolResult.details;
			const now = Date.now();
			const failed =
				details.results.some((entry) => entry.exitCode !== 0) ||
				toolResult.content[0]?.type === "text" &&
					toolResult.content[0].text.includes("failed");
			const terminalState = failed ? "failed" : "complete";
			const exitCode = failed ? 1 : 0;
			const finalOutput =
				toolResult.content[0]?.type === "text"
					? toolResult.content[0].text
					: "(no output)";

			const nextStatus = {
				...status,
				state: terminalState as "complete" | "failed",
				updatedAt: now,
				exitCode,
				agents: details ? agentsFromDetails(details) : agents,
			};

			writeRunStatus(runDir, nextStatus);
			input.tracker.update(runId, nextStatus);

			if (details) {
				writeRunResult(runDir, {
					status: nextStatus,
					details,
					finalOutput,
				});
			}

			emitAsyncComplete(input.events, { id: runId, exitCode, finalOutput });
			input.events?.emit(SUBAGENT_CHILD_DISPOSED, { sessionId: childSessionId });
		})
		.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			const nextStatus = {
				...status,
				state: "failed" as const,
				updatedAt: Date.now(),
				exitCode: 1,
				error: message,
			};
			writeRunStatus(runDir, nextStatus);
			input.tracker.update(runId, nextStatus);
			emitAsyncComplete(input.events, {
				id: runId,
				exitCode: 1,
				finalOutput: message,
			});
			input.events?.emit(SUBAGENT_CHILD_DISPOSED, { sessionId: childSessionId });
		});

	input.tracker.update(runId, { state: "running", updatedAt: Date.now() });
	writeRunStatus(runDir, { ...status, state: "running", updatedAt: Date.now() });

	return {
		runId,
		result: {
			content: [
				{
					type: "text",
					text: `Async subagent started (id: ${runId}). Use wait({ id: "${runId}" }) or wait() to collect results.`,
				},
			],
			details: {
				mode,
				agentScope: input.params.agentScope ?? "both",
				projectAgentsDir: null,
				results: [],
				runId,
				async: true,
			},
		},
	};
}

export function restoreAsyncJobs(
	sessionFile: string | null,
	tracker: AsyncJobTracker,
): void {
	const asyncRoot = getAsyncRootFromSessionFile(sessionFile);
	for (const runDir of listRunDirs(asyncRoot)) {
		const status = readRunStatus(runDir);
		if (!status) continue;
		if (isTerminalState(status.state)) {
			tracker.track(status.id, status);
			continue;
		}
		tracker.track(status.id, {
			...status,
			state: "failed",
			exitCode: 1,
			error: "Session restarted before async run completed.",
			updatedAt: Date.now(),
		});
		writeRunStatus(runDir, tracker.get(status.id)!);
	}
}

function listRunDirs(asyncRoot: string): string[] {
	if (!fs.existsSync(asyncRoot)) return [];
	try {
		return fs
			.readdirSync(asyncRoot, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => getRunDir(asyncRoot, entry.name));
	} catch {
		return [];
	}
}

export function summarizeAsyncRun(runDir: string) {
	const status = readRunStatus(runDir);
	if (!status) return null;
	const result = readRunResult(runDir);
	const finalOutput =
		result?.finalOutput ??
		(result?.details.results[0]
			? getResultOutput(result.details.results[0])
			: undefined);
	return {
		id: status.id,
		state: status.state,
		agents: status.agents,
		exitCode: status.exitCode,
		finalOutput,
	};
}
