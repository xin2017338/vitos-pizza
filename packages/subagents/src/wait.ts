import * as fs from "node:fs";
import type { AsyncJobTracker, SubagentEventBus } from "./async/job-tracker.ts";
import { summarizeAsyncRun } from "./async/spawn-async.ts";
import {
	getAsyncRootFromSessionFile,
	getRunDir,
	isTerminalState,
} from "./async/storage.ts";
import { SUBAGENT_ASYNC_COMPLETE } from "./rpc/channels.ts";
import type { AsyncRunSummary, WaitInput, WaitResult } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 500;

export interface WaitDeps {
	tracker: AsyncJobTracker;
	sessionFile?: string | null;
	events?: SubagentEventBus;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
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

function listActiveRuns(
	tracker: AsyncJobTracker,
	sessionFile: string | null | undefined,
): AsyncRunSummary[] {
	const asyncRoot = getAsyncRootFromSessionFile(sessionFile ?? null);
	const summaries: AsyncRunSummary[] = [];
	const seen = new Set<string>();

	for (const status of tracker.list()) {
		if (isTerminalState(status.state)) continue;
		seen.add(status.id);
		summaries.push({
			id: status.id,
			state: status.state,
			agents: status.agents,
			exitCode: status.exitCode,
		});
	}

	for (const runDir of listRunDirs(asyncRoot)) {
		const summary = summarizeAsyncRun(runDir);
		if (!summary || isTerminalState(summary.state) || seen.has(summary.id)) continue;
		summaries.push(summary);
	}

	return summaries;
}

function collectCompleted(
	tracker: AsyncJobTracker,
	sessionFile: string | null | undefined,
	idPrefix?: string,
): AsyncRunSummary[] {
	const asyncRoot = getAsyncRootFromSessionFile(sessionFile ?? null);
	const completed: AsyncRunSummary[] = [];
	const seen = new Set<string>();

	for (const status of tracker.list()) {
		if (!isTerminalState(status.state)) continue;
		if (idPrefix && !status.id.startsWith(idPrefix)) continue;
		seen.add(status.id);
		const runDir = getRunDir(asyncRoot, status.id);
		const summary = summarizeAsyncRun(runDir);
		completed.push(
			summary ?? {
				id: status.id,
				state: status.state,
				agents: status.agents,
				exitCode: status.exitCode,
			},
		);
	}

	return completed;
}

export async function waitForSubagents(
	input: WaitInput,
	deps: WaitDeps,
): Promise<WaitResult> {
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const now = deps.now ?? (() => Date.now());
	const sleep =
		deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
	const deadline = now() + timeoutMs;
	const waitAll = input.all === true;
	const idPrefix = input.id;

	let wake = false;
	const unsub = deps.events?.on(SUBAGENT_ASYNC_COMPLETE, () => {
		wake = true;
	});

	try {
		while (now() < deadline) {
			const active = listActiveRuns(deps.tracker, deps.sessionFile).filter((run) =>
				idPrefix ? run.id.startsWith(idPrefix) : true,
			);

			if (active.length === 0) {
				return {
					completed: collectCompleted(deps.tracker, deps.sessionFile, idPrefix),
					timedOut: false,
					activeRemaining: 0,
				};
			}

			if (!waitAll) {
				const completed = collectCompleted(deps.tracker, deps.sessionFile, idPrefix);
				if (completed.length > 0) {
					return {
						completed,
						timedOut: false,
						activeRemaining: active.length,
					};
				}
			} else {
				const stillActive = active.filter((run) => !isTerminalState(run.state));
				if (stillActive.length === 0) {
					return {
						completed: collectCompleted(deps.tracker, deps.sessionFile, idPrefix),
						timedOut: false,
						activeRemaining: 0,
					};
				}
			}

			wake = false;
			await sleep(DEFAULT_POLL_INTERVAL_MS);
			if (!wake) continue;
		}

		const activeRemaining = listActiveRuns(deps.tracker, deps.sessionFile).filter((run) =>
			idPrefix ? run.id.startsWith(idPrefix) : true,
		).length;

		return {
			completed: collectCompleted(deps.tracker, deps.sessionFile, idPrefix),
			timedOut: true,
			activeRemaining,
		};
	} finally {
		unsub?.();
	}
}
