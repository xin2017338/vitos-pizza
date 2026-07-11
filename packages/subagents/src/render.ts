import { keyHint } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import type { AgentProgress } from "./progress.ts";
import {
	formatDuration,
	formatTokenCount,
	formatToolArgs,
} from "./progress.ts";
import type { RenderAnimationContext } from "./render-animation.ts";
import { getAnimationFrame } from "./render-animation.ts";
import type { SingleResult, SubagentDetails } from "./types.ts";
import { getFinalOutput, getResultOutput, isFailedResult } from "./utils.ts";

const RUNNING_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function renderSubagentCall(
	args: Record<string, unknown>,
	theme: Theme,
): Text {
	const scope = (args.agentScope as string | undefined) ?? "both";

	if (Array.isArray(args.chain) && args.chain.length > 0) {
		let text =
			theme.fg("toolTitle", theme.bold("subagent ")) +
			theme.fg("accent", `chain (${args.chain.length} steps)`) +
			theme.fg("muted", ` [${scope}]`);
		for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
			const step = args.chain[i] as { agent: string; task: string };
			const preview =
				step.task.length > 40 ? `${step.task.slice(0, 40)}...` : step.task;
			text += `\n  ${theme.fg("muted", `${i + 1}.`)} ${theme.fg("accent", step.agent)}${theme.fg("dim", ` ${preview}`)}`;
		}
		return new Text(text, 0, 0);
	}

	if (Array.isArray(args.tasks) && args.tasks.length > 0) {
		let text =
			theme.fg("toolTitle", theme.bold("subagent ")) +
			theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
			theme.fg("muted", ` [${scope}]`);
		for (const task of (args.tasks as Array<{ agent: string; task: string }>).slice(0, 3)) {
			const preview = task.task.length > 40 ? `${task.task.slice(0, 40)}...` : task.task;
			text += `\n  ${theme.fg("accent", task.agent)}${theme.fg("dim", ` ${preview}`)}`;
		}
		return new Text(text, 0, 0);
	}

	const agentName = (args.agent as string | undefined) || "...";
	const task = args.task as string | undefined;
	const preview = task ? (task.length > 60 ? `${task.slice(0, 60)}...` : task) : "...";
	const asyncLabel = args.async ? theme.fg("warning", " async") : "";
	let text =
		theme.fg("toolTitle", theme.bold("subagent ")) +
		theme.fg("accent", agentName) +
		asyncLabel +
		theme.fg("muted", ` [${scope}]`);
	text += `\n  ${theme.fg("dim", preview)}`;
	return new Text(text, 0, 0);
}

export interface RenderSubagentResultOptions {
	expanded: boolean;
	isPartial?: boolean;
}

type SubagentToolResult = {
	content: Array<{ type: string; text?: string }>;
	details?: SubagentDetails;
};

export function subagentResultIsRunning(
	result: SubagentToolResult,
	options?: RenderSubagentResultOptions,
): boolean {
	if (options?.isPartial) return true;
	const details = result.details;
	if (!details || details.async) return false;
	return details.results.some(
		(entry) =>
			entry.progress?.status === "running" || entry.exitCode === -1,
	);
}

function runningGlyph(frame: number): string {
	return RUNNING_FRAMES[frame % RUNNING_FRAMES.length] ?? "●";
}

function getProgressStats(
	progress: Pick<AgentProgress, "toolCount" | "tokens" | "durationMs"> | undefined,
): string {
	if (!progress) return "";
	const parts: string[] = [];
	if (progress.toolCount > 0) parts.push(`${progress.toolCount} tools`);
	if (progress.tokens > 0) parts.push(`${formatTokenCount(progress.tokens)} tok`);
	if (progress.durationMs > 0) parts.push(formatDuration(progress.durationMs));
	return parts.join(" · ");
}

function formatCurrentToolLine(progress: AgentProgress, expanded: boolean): string | null {
	if (!progress.currentTool) return null;
	const args = progress.currentToolArgs;
	if (args) {
		return expanded
			? `${progress.currentTool}: ${args}`
			: `${progress.currentTool}`;
	}
	return progress.currentTool;
}

function compactActivity(progress: AgentProgress): string {
	return formatCurrentToolLine(progress, false) ?? "thinking…";
}

function isResultRunning(entry: SingleResult): boolean {
	return entry.progress?.status === "running" || entry.exitCode === -1;
}

function getToolCallLines(entry: SingleResult): string[] {
	const lines: string[] = [];
	for (const msg of entry.messages) {
		if (msg.role !== "assistant") continue;
		for (const part of msg.content) {
			if (part.type === "toolCall") {
				const args = formatToolArgs(part.arguments);
				lines.push(args ? `${part.name}: ${args}` : part.name);
			}
		}
	}
	return lines;
}

function renderSingleResult(
	entry: SingleResult,
	theme: Theme,
	options: RenderSubagentResultOptions,
	context?: RenderAnimationContext,
): Component {
	const expanded = options.expanded;
	const running = isResultRunning(entry);
	const progress = entry.progress;
	const summary = progress ?? entry.progressSummary;
	const frame = getAnimationFrame(context);

	if (running && progress) {
		const c = new Container();
		const stats = getProgressStats(progress);
		const glyph = theme.fg("warning", runningGlyph(frame));
		let header = `${glyph} ${theme.fg("toolTitle", theme.bold(entry.agent))}`;
		if (stats) header += ` ${theme.fg("dim", `· ${stats}`)}`;
		c.addChild(new Text(header, 0, 0));

		if (expanded) {
			c.addChild(new Spacer(1));
			const taskPreview =
				entry.task.length > 200 && !expanded
					? `${entry.task.slice(0, 200)}...`
					: entry.task;
			c.addChild(new Text(theme.fg("dim", `Task: ${taskPreview}`), 0, 0));
			c.addChild(new Spacer(1));
		}

		const toolLine = formatCurrentToolLine(progress, expanded);
		if (toolLine) {
			c.addChild(new Text(theme.fg("warning", `> ${toolLine}`), 0, 0));
		} else {
			c.addChild(new Text(theme.fg("dim", ` ⎿ ${compactActivity(progress)}`), 0, 0));
		}

		if (!expanded) {
			c.addChild(new Text(theme.fg("accent", ` ${keyHint("app.tools.expand", "for live detail")}`), 0, 0));
			return c;
		}

		c.addChild(new Text(theme.fg("accent", keyHint("app.tools.expand", "for live detail")), 0, 0));

		if (progress.recentTools.length > 0) {
			c.addChild(new Spacer(1));
			for (const tool of progress.recentTools.slice(-3)) {
				const line = tool.args ? `${tool.tool}: ${tool.args}` : tool.tool;
				c.addChild(new Text(theme.fg("dim", line), 0, 0));
			}
		}

		if (progress.recentOutput.length > 0) {
			c.addChild(new Spacer(1));
			for (const line of progress.recentOutput.slice(-5)) {
				c.addChild(new Text(theme.fg("dim", ` ${line}`), 0, 0));
			}
		}

		return c;
	}

	const failed = isFailedResult(entry);
	const icon = failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
	const output = getResultOutput(entry);
	const stats = summary ? getProgressStats(summary as AgentProgress) : "";

	const c = new Container();
	let header = `${icon} ${theme.fg("toolTitle", theme.bold(entry.agent))}`;
	if (stats) header += ` ${theme.fg("dim", `· ${stats}`)}`;
	c.addChild(new Text(header, 0, 0));

	if (expanded) {
		c.addChild(new Spacer(1));
		c.addChild(new Text(theme.fg("dim", `Task: ${entry.task}`), 0, 0));
		const toolLines = getToolCallLines(entry);
		if (toolLines.length > 0) {
			c.addChild(new Spacer(1));
			for (const line of toolLines) {
				c.addChild(new Text(theme.fg("muted", line), 0, 0));
			}
		}
		c.addChild(new Spacer(1));
		c.addChild(new Text(theme.fg("toolOutput", output), 0, 0));
		return c;
	}

	const preview = output.length > 120 ? `${output.slice(0, 120)}...` : output;
	c.addChild(new Text(theme.fg("dim", ` ⎿ ${preview}`), 0, 0));
	return c;
}

function renderChainResult(
	details: SubagentDetails,
	theme: Theme,
	options: RenderSubagentResultOptions,
	context?: RenderAnimationContext,
): Component {
	const expanded = options.expanded;
	const frame = getAnimationFrame(context);
	const c = new Container();

	const flowParts: string[] = [];
	for (let i = 0; i < details.results.length; i++) {
		const entry = details.results[i];
		if (isResultRunning(entry)) {
			flowParts.push(
				`${theme.fg("warning", runningGlyph(frame))} ${theme.fg("accent", entry.agent)}`,
			);
		} else if (isFailedResult(entry)) {
			flowParts.push(`${theme.fg("error", "✗")} ${theme.fg("accent", entry.agent)}`);
		} else {
			flowParts.push(`${theme.fg("success", "✓")} ${theme.fg("accent", entry.agent)}`);
		}
		if (i < details.results.length - 1) flowParts.push(theme.fg("muted", " → "));
	}
	c.addChild(
		new Text(
			`${theme.fg("toolTitle", theme.bold("chain"))} ${flowParts.join("")}`,
			0,
			0,
		),
	);

	if (expanded) {
		c.addChild(new Spacer(1));
		for (const entry of details.results) {
			c.addChild(renderSingleResult(entry, theme, { ...options, expanded: false }, context));
			c.addChild(new Spacer(1));
		}
		const last = details.results[details.results.length - 1];
		if (last && !isResultRunning(last)) {
			c.addChild(new Text(theme.fg("toolOutput", getResultOutput(last)), 0, 0));
		}
		return c;
	}

	const runningEntry = details.results.find((entry) => isResultRunning(entry));
	if (runningEntry?.progress) {
		c.addChild(
			new Text(
				theme.fg("dim", ` ⎿ ${compactActivity(runningEntry.progress)}`),
				0,
				0,
			),
		);
		c.addChild(
			new Text(
				theme.fg("accent", ` ${keyHint("app.tools.expand", "for live detail")}`),
				0,
				0,
			),
		);
	}

	return c;
}

function renderParallelResult(
	details: SubagentDetails,
	theme: Theme,
	options: RenderSubagentResultOptions,
	context?: RenderAnimationContext,
): Component {
	const expanded = options.expanded;
	const frame = getAnimationFrame(context);
	const total = details.results.length;
	const done = details.results.filter((entry) => !isResultRunning(entry)).length;
	const c = new Container();

	c.addChild(
		new Text(
			`${theme.fg("toolTitle", theme.bold("parallel"))} ${theme.fg("dim", `${done}/${total} done`)}`,
			0,
			0,
		),
	);

	for (const entry of details.results) {
		const running = isResultRunning(entry);
		const glyph = running
			? theme.fg("warning", runningGlyph(frame))
			: isFailedResult(entry)
				? theme.fg("error", "✗")
				: theme.fg("success", "✓");
		let line = `${glyph} ${theme.fg("accent", entry.agent)}`;
		if (running && entry.progress) {
			line += theme.fg("dim", ` ⎿ ${compactActivity(entry.progress)}`);
		} else if (!running) {
			const output = getFinalOutput(entry.messages) || getResultOutput(entry);
			const preview = output.length > 80 ? `${output.slice(0, 80)}...` : output;
			if (preview) line += theme.fg("dim", ` ${preview}`);
		}
		c.addChild(new Text(line, 0, 0));

		if (expanded && running && entry.progress) {
			for (const tool of entry.progress.recentTools.slice(-2)) {
				const toolLine = tool.args ? `${tool.tool}: ${tool.args}` : tool.tool;
				c.addChild(new Text(theme.fg("dim", `   ${toolLine}`), 0, 0));
			}
		}
	}

	if (!expanded && details.results.some((entry) => isResultRunning(entry))) {
		c.addChild(
			new Text(
				theme.fg("accent", keyHint("app.tools.expand", "for live detail")),
				0,
				0,
			),
		);
	}

	return c;
}

export function renderSubagentResult(
	result: SubagentToolResult,
	options: RenderSubagentResultOptions,
	theme: Theme,
	context?: RenderAnimationContext,
): Component {
	const details = result.details;
	if (!details || details.results.length === 0) {
		const text = result.content[0];
		return new Text(
			text?.type === "text" ? (text.text ?? "(no output)") : "(no output)",
			0,
			0,
		);
	}

	if (details.async && details.runId) {
		return new Text(
			`${theme.fg("warning", "⏳")} ${theme.fg("toolTitle", theme.bold("async "))}${theme.fg("accent", details.runId)}`,
			0,
			0,
		);
	}

	if (details.mode === "chain") {
		return renderChainResult(details, theme, options, context);
	}

	if (details.mode === "parallel") {
		return renderParallelResult(details, theme, options, context);
	}

	if (details.mode === "single" && details.results.length === 1) {
		return renderSingleResult(details.results[0], theme, options, context);
	}

	const lines: string[] = [];
	const icon =
		details.results.every((entry) => !isFailedResult(entry))
			? theme.fg("success", "✓")
			: theme.fg("error", "✗");
	lines.push(
		`${icon} ${theme.fg("toolTitle", theme.bold(details.mode))} (${details.results.length})`,
	);
	for (const entry of details.results) {
		const rIcon = isFailedResult(entry)
			? theme.fg("error", "✗")
			: theme.fg("success", "✓");
		const output = getFinalOutput(entry.messages) || getResultOutput(entry);
		const preview = output.length > 120 ? `${output.slice(0, 120)}...` : output;
		lines.push(`${rIcon} ${theme.fg("accent", entry.agent)}: ${theme.fg("dim", preview)}`);
	}
	return new Text(lines.join("\n"), 0, 0);
}

export function renderWaitCall(
	args: Record<string, unknown>,
	theme: Theme,
): Text {
	const id = args.id as string | undefined;
	const all = args.all === true;
	const label = id ? `id=${id}` : all ? "all" : "next";
	return new Text(
		theme.fg("toolTitle", theme.bold("wait ")) + theme.fg("accent", label),
		0,
		0,
	);
}

export function renderWaitResult(
	result: { content: Array<{ type: string; text?: string }> },
	theme: Theme,
): Text {
	const text = result.content[0];
	return new Text(
		text?.type === "text" ? (text.text ?? "(no output)") : "(no output)",
		0,
		0,
	);
}
