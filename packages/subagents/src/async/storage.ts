import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AsyncRunResult, AsyncRunStatus, SubagentDetails } from "../types.ts";
import { readJsonFile, writeJsonAtomic } from "../utils.ts";

export function getAsyncRootFromSessionFile(sessionFile: string | null): string {
	if (sessionFile) {
		const baseName = path.basename(sessionFile, ".jsonl");
		const sessionsDir = path.dirname(sessionFile);
		return path.join(sessionsDir, baseName, "subagents", "async");
	}
	return path.join(os.tmpdir(), "vitos-subagents-async");
}

export function getRunDir(asyncRoot: string, runId: string): string {
	return path.join(asyncRoot, runId);
}

export function writeRunStatus(runDir: string, status: AsyncRunStatus): void {
	writeJsonAtomic(path.join(runDir, "status.json"), status);
}

export function writeRunResult(runDir: string, result: AsyncRunResult): void {
	writeJsonAtomic(path.join(runDir, "result.json"), result);
}

export function readRunStatus(runDir: string): AsyncRunStatus | null {
	return readJsonFile<AsyncRunStatus>(path.join(runDir, "status.json"));
}

export function readRunResult(runDir: string): AsyncRunResult | null {
	return readJsonFile<AsyncRunResult>(path.join(runDir, "result.json"));
}

export function listRunDirs(asyncRoot: string): string[] {
	if (!fs.existsSync(asyncRoot)) return [];
	try {
		return fs
			.readdirSync(asyncRoot, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => path.join(asyncRoot, entry.name));
	} catch {
		return [];
	}
}

export function isTerminalState(state: AsyncRunStatus["state"]): boolean {
	return state === "complete" || state === "failed";
}

export function agentsFromDetails(details: SubagentDetails): string[] {
	const names = new Set<string>();
	for (const result of details.results) names.add(result.agent);
	if (details.results.length === 0 && details.mode === "single") return [];
	return Array.from(names);
}
