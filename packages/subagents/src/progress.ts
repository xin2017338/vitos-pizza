import type { Message } from "@earendil-works/pi-ai";
import type { UsageStats } from "./types.ts";

export interface AgentProgress {
	status: "running" | "complete" | "failed";
	currentTool?: string;
	currentToolArgs?: string;
	currentToolStartedAt?: number;
	recentTools: Array<{ tool: string; args: string }>;
	recentOutput: string[];
	toolCount: number;
	tokens: number;
	durationMs: number;
	startedAt: number;
}

export type ProgressSummary = Pick<
	AgentProgress,
	"toolCount" | "tokens" | "durationMs"
>;

const MAX_RECENT_TOOLS = 5;
const MAX_RECENT_OUTPUT = 8;
const OUTPUT_PREVIEW_LEN = 120;

export function formatToolArgs(args: Record<string, unknown>): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(args)) {
		if (value === undefined || value === null) continue;
		const text =
			typeof value === "string"
				? value.length > 40
					? `${value.slice(0, 40)}...`
					: value
				: JSON.stringify(value);
		parts.push(`${key}=${text}`);
		if (parts.join(" ").length > 80) break;
	}
	return parts.join(" ");
}

function truncatePreview(text: string, maxLen = OUTPUT_PREVIEW_LEN): string {
	const oneLine = text.replace(/\s+/g, " ").trim();
	if (oneLine.length <= maxLen) return oneLine;
	return `${oneLine.slice(0, maxLen)}...`;
}

function extractTextFromMessage(msg: Message): string | null {
	if (msg.role === "toolResult") {
		const parts: string[] = [];
		for (const part of msg.content) {
			if (part.type === "text" && part.text.trim()) parts.push(part.text);
		}
		return parts.length > 0 ? parts.join("\n") : null;
	}
	if (msg.role === "assistant") {
		for (const part of msg.content) {
			if (part.type === "text" && part.text.trim()) return part.text;
		}
	}
	return null;
}

function countCompletedTools(messages: Message[]): number {
	return messages.filter((msg) => msg.role === "toolResult").length;
}

export interface DeriveProgressOptions {
	isRunning: boolean;
	startedAt: number;
	failed?: boolean;
	pendingTool?: { name: string; args: Record<string, unknown>; startedAt: number };
}

export function deriveProgress(
	messages: Message[],
	usage: UsageStats,
	options: DeriveProgressOptions,
): AgentProgress {
	const recentTools: Array<{ tool: string; args: string }> = [];
	const recentOutput: string[] = [];
	let currentTool: string | undefined;
	let currentToolArgs: string | undefined;
	let currentToolStartedAt: number | undefined;

	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "toolCall") {
					const entry = {
						tool: part.name,
						args: formatToolArgs(part.arguments),
					};
					recentTools.push(entry);
					if (recentTools.length > MAX_RECENT_TOOLS) recentTools.shift();
					currentTool = part.name;
					currentToolArgs = entry.args || undefined;
					currentToolStartedAt = msg.timestamp;
				}
			}
			const text = extractTextFromMessage(msg);
			if (text) {
				recentOutput.push(truncatePreview(text));
				if (recentOutput.length > MAX_RECENT_OUTPUT) recentOutput.shift();
			}
		}

		if (msg.role === "toolResult") {
			const text = extractTextFromMessage(msg);
			if (text) {
				recentOutput.push(truncatePreview(text));
				if (recentOutput.length > MAX_RECENT_OUTPUT) recentOutput.shift();
			}
			if (currentTool === msg.toolName) {
				currentTool = undefined;
				currentToolArgs = undefined;
				currentToolStartedAt = undefined;
			}
		}
	}

	if (options.pendingTool) {
		currentTool = options.pendingTool.name;
		currentToolArgs = formatToolArgs(options.pendingTool.args) || undefined;
		currentToolStartedAt = options.pendingTool.startedAt;
		const entry = { tool: currentTool, args: currentToolArgs ?? "" };
		if (
			recentTools.length === 0 ||
			recentTools[recentTools.length - 1]?.tool !== entry.tool
		) {
			recentTools.push(entry);
			if (recentTools.length > MAX_RECENT_TOOLS) recentTools.shift();
		}
	}

	const tokens =
		usage.input + usage.output + usage.cacheRead + usage.cacheWrite ||
		usage.contextTokens;
	const now = Date.now();

	let status: AgentProgress["status"];
	if (options.isRunning) {
		status = "running";
	} else if (options.failed) {
		status = "failed";
	} else {
		status = "complete";
	}

	return {
		status,
		currentTool,
		currentToolArgs,
		currentToolStartedAt,
		recentTools,
		recentOutput,
		toolCount: countCompletedTools(messages),
		tokens,
		durationMs: Math.max(0, now - options.startedAt),
		startedAt: options.startedAt,
	};
}

export function toProgressSummary(
	progress: AgentProgress,
): ProgressSummary {
	return {
		toolCount: progress.toolCount,
		tokens: progress.tokens,
		durationMs: progress.durationMs,
	};
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const rem = seconds % 60;
	return rem > 0 ? `${minutes}m${rem}s` : `${minutes}m`;
}

export function formatTokenCount(tokens: number): string {
	if (tokens < 1000) return `${tokens}`;
	if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
	return `${(tokens / 1_000_000).toFixed(1)}M`;
}
