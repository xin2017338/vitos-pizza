import type { Message } from "@earendil-works/pi-ai";
import type { AgentProgress, ProgressSummary } from "./progress.ts";

export type AgentScope = "user" | "project" | "both";
export type SubagentMode = "single" | "parallel" | "chain";

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export interface SingleResult {
	agent: string;
	agentSource: "builtin" | "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
	progress?: AgentProgress;
	progressSummary?: ProgressSummary;
}

export interface SubagentDetails {
	mode: SubagentMode;
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
	runId?: string;
	async?: boolean;
}

export type AsyncRunState = "queued" | "running" | "complete" | "failed";

export interface AsyncRunStatus {
	id: string;
	state: AsyncRunState;
	mode: SubagentMode;
	sessionId: string | null;
	createdAt: number;
	updatedAt: number;
	agents: string[];
	exitCode?: number;
	error?: string;
}

export interface AsyncRunResult {
	status: AsyncRunStatus;
	details: SubagentDetails;
	finalOutput: string;
}

export interface ExecuteSubagentInput {
	agent?: string;
	task?: string;
	tasks?: Array<{ agent: string; task: string; cwd?: string }>;
	chain?: Array<{ agent: string; task: string; cwd?: string }>;
	cwd?: string;
	concurrency?: number;
	async?: boolean;
	agentScope?: AgentScope;
	model?: string;
}

export interface WaitInput {
	id?: string;
	all?: boolean;
	timeoutMs?: number;
}

export interface WaitResult {
	completed: AsyncRunSummary[];
	timedOut: boolean;
	activeRemaining: number;
}

export interface AsyncRunSummary {
	id: string;
	state: AsyncRunState;
	agents: string[];
	exitCode?: number;
	finalOutput?: string;
}
