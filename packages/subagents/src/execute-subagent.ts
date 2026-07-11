import { randomUUID } from "node:crypto";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { discoverAgents, formatAvailableAgents } from "./agents.ts";
import { runSingleAgent } from "./run-agent.ts";
import type {
	AgentScope,
	ExecuteSubagentInput,
	SubagentDetails,
	SubagentMode,
	SingleResult,
} from "./types.ts";
import {
	DEFAULT_CONCURRENCY,
	getFinalOutput,
	getResultOutput,
	isFailedResult,
	mapWithConcurrencyLimit,
	MAX_PARALLEL_TASKS,
	truncateParallelOutput,
} from "./utils.ts";

export interface ExecuteContext {
	cwd: string;
	parentSessionId?: string | null;
	signal?: AbortSignal;
	onUpdate?: (details: SubagentDetails, text: string) => void;
}

function countModes(input: ExecuteSubagentInput): number {
	return (
		Number(Boolean(input.chain?.length)) +
		Number(Boolean(input.tasks?.length)) +
		Number(Boolean(input.agent && input.task))
	);
}

function resolveMode(input: ExecuteSubagentInput): SubagentMode | null {
	if ((input.chain?.length ?? 0) > 0) return "chain";
	if ((input.tasks?.length ?? 0) > 0) return "parallel";
	if (input.agent && input.task) return "single";
	return null;
}

export function buildSubagentDetails(
	mode: SubagentMode,
	agentScope: AgentScope,
	projectAgentsDir: string | null,
	results: SingleResult[],
	extra?: Partial<SubagentDetails>,
): SubagentDetails {
	return {
		mode,
		agentScope,
		projectAgentsDir,
		results,
		...extra,
	};
}

export async function executeSubagent(
	input: ExecuteSubagentInput,
	ctx: ExecuteContext,
): Promise<AgentToolResult<SubagentDetails>> {
	const agentScope: AgentScope = input.agentScope ?? "both";
	const discovery = discoverAgents(ctx.cwd, agentScope);
	const agents = discovery.agents;
	const mode = resolveMode(input);

	if (countModes(input) !== 1 || !mode) {
		const available = formatAvailableAgents(agents);
		return {
			content: [
				{
					type: "text",
					text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
				},
			],
			details: buildSubagentDetails("single", agentScope, discovery.projectAgentsDir, []),
		};
	}

	const makeDetails = (
		results: SingleResult[],
		extra?: Partial<SubagentDetails>,
	) =>
		buildSubagentDetails(mode, agentScope, discovery.projectAgentsDir, results, extra);

	if (mode === "chain" && input.chain) {
		const results: SingleResult[] = [];
		let previousOutput = "";

		for (let i = 0; i < input.chain.length; i++) {
			const step = input.chain[i];
			const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);
			const result = await runSingleAgent({
				defaultCwd: ctx.cwd,
				agents,
				agentName: step.agent,
				task: taskWithContext,
				cwd: step.cwd,
				step: i + 1,
				parentSessionId: ctx.parentSessionId,
				signal: ctx.signal,
				onUpdate: ctx.onUpdate
					? (partial) => {
							ctx.onUpdate?.(makeDetails([...results, partial.result]), partial.content[0]?.text ?? "");
						}
					: undefined,
			});
			results.push(result);

			if (isFailedResult(result)) {
				return {
					content: [
						{
							type: "text",
							text: `Chain stopped at step ${i + 1} (${step.agent}): ${getResultOutput(result)}`,
						},
					],
					details: makeDetails(results),
				};
			}
			previousOutput = getFinalOutput(result.messages);
		}

		const last = results[results.length - 1];
		return {
			content: [
				{
					type: "text",
					text: getFinalOutput(last.messages) || "(no output)",
				},
			],
			details: makeDetails(results),
		};
	}

	if (mode === "parallel" && input.tasks) {
		if (input.tasks.length > MAX_PARALLEL_TASKS) {
			return {
				content: [
					{
						type: "text",
						text: `Too many parallel tasks (${input.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
					},
				],
				details: makeDetails([]),
			};
		}

		const concurrency = input.concurrency ?? DEFAULT_CONCURRENCY;
		const allResults: SingleResult[] = new Array(input.tasks.length);
		for (let i = 0; i < input.tasks.length; i++) {
			allResults[i] = {
				agent: input.tasks[i].agent,
				agentSource: "unknown",
				task: input.tasks[i].task,
				exitCode: -1,
				messages: [],
				stderr: "",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					cost: 0,
					contextTokens: 0,
					turns: 0,
				},
			};
		}

		const emitParallelUpdate = () => {
			if (!ctx.onUpdate) return;
			const running = allResults.filter((result) => result.exitCode === -1).length;
			const done = allResults.filter((result) => result.exitCode !== -1).length;
			ctx.onUpdate(
				makeDetails([...allResults]),
				`Parallel: ${done}/${allResults.length} done, ${running} running...`,
			);
		};

		const results = await mapWithConcurrencyLimit(
			input.tasks,
			concurrency,
			async (task, index) => {
				const result = await runSingleAgent({
					defaultCwd: ctx.cwd,
					agents,
					agentName: task.agent,
					task: task.task,
					cwd: task.cwd,
					parentSessionId: ctx.parentSessionId,
					signal: ctx.signal,
					onUpdate: ctx.onUpdate
						? (partial) => {
								allResults[index] = partial.result;
								emitParallelUpdate();
							}
						: undefined,
				});
				allResults[index] = result;
				emitParallelUpdate();
				return result;
			},
		);

		const successCount = results.filter((result) => !isFailedResult(result)).length;
		const summaries = results.map((result) => {
			const output = truncateParallelOutput(getResultOutput(result));
			const status = isFailedResult(result)
				? `failed${result.stopReason && result.stopReason !== "end" ? ` (${result.stopReason})` : ""}`
				: "completed";
			return `### [${result.agent}] ${status}\n\n${output}`;
		});

		return {
			content: [
				{
					type: "text",
					text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`,
				},
			],
			details: makeDetails(results),
		};
	}

	if (mode === "single" && input.agent && input.task) {
		const result = await runSingleAgent({
			defaultCwd: ctx.cwd,
			agents,
			agentName: input.agent,
			task: input.task,
			cwd: input.cwd,
			parentSessionId: ctx.parentSessionId,
			signal: ctx.signal,
			modelOverride: input.model,
			onUpdate: ctx.onUpdate
				? (partial) => {
						ctx.onUpdate?.(makeDetails([partial.result]), partial.content[0]?.text ?? "");
					}
				: undefined,
		});

		if (isFailedResult(result)) {
			return {
				content: [
					{
						type: "text",
						text: `Agent ${result.stopReason || "failed"}: ${getResultOutput(result)}`,
					},
				],
				details: makeDetails([result]),
			};
		}

		return {
			content: [
				{
					type: "text",
					text: getFinalOutput(result.messages) || "(no output)",
				},
			],
			details: makeDetails([result]),
		};
	}

	const available = formatAvailableAgents(agents);
	return {
		content: [
			{
				type: "text",
				text: `Invalid parameters. Available agents: ${available}`,
			},
		],
		details: makeDetails([]),
	};
}

export function newRunId(): string {
	return randomUUID();
}
