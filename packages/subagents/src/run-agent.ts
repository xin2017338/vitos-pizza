import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Message } from "@earendil-works/pi-ai";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import {
	applyThinkingSuffix,
	type AgentConfig,
} from "./agents.ts";
import {
	SUBAGENT_CHILD_AGENT_ENV,
	SUBAGENT_CHILD_ENV,
	SUBAGENT_PARENT_SESSION_ENV,
	SUBAGENT_RUN_ID_ENV,
} from "./env.ts";
import { getPiSpawnCommand } from "./spawn.ts";
import {
	deriveProgress,
	toProgressSummary,
} from "./progress.ts";
import type { SingleResult } from "./types.ts";
import { emptyUsage, isFailedResult } from "./utils.ts";

export type OnUpdateCallback = (partial: {
	content: Array<{ type: "text"; text: string }>;
	result: SingleResult;
}) => void;

export interface RunSingleAgentInput {
	defaultCwd: string;
	agents: AgentConfig[];
	agentName: string;
	task: string;
	cwd?: string;
	step?: number;
	parentSessionId?: string | null;
	runId?: string;
	signal?: AbortSignal;
	onUpdate?: OnUpdateCallback;
	modelOverride?: string;
}

async function writePromptToTempFile(
	agentName: string,
	prompt: string,
): Promise<{ dir: string; filePath: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vitos-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, {
			encoding: "utf-8",
			mode: 0o600,
		});
	});
	return { dir: tmpDir, filePath };
}

export async function runSingleAgent(
	input: RunSingleAgentInput,
): Promise<SingleResult> {
	const {
		defaultCwd,
		agents,
		agentName,
		task,
		cwd,
		step,
		parentSessionId,
		runId = randomUUID(),
		signal,
		onUpdate,
		modelOverride,
	} = input;

	const agent = agents.find((entry) => entry.name === agentName);
	if (!agent) {
		const available = agents.map((entry) => `"${entry.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			messages: [],
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: emptyUsage(),
			step,
		};
	}

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	const modelArg = applyThinkingSuffix(
		modelOverride ?? agent.model,
		agent.thinking,
	);
	if (modelArg) args.push("--model", modelArg);
	if (agent.tools?.length) args.push("--tools", agent.tools.join(","));

	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const currentResult: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: 0,
		messages: [],
		stderr: "",
		usage: emptyUsage(),
		model: agent.model,
		step,
	};

	const startedAt = Date.now();
	let pendingTool: { name: string; args: Record<string, unknown>; startedAt: number } | undefined;
	let processClosed = false;

	const refreshProgress = (isRunning: boolean) => {
		const progress = deriveProgress(currentResult.messages, currentResult.usage, {
			isRunning,
			startedAt,
			failed: !isRunning && isFailedResult({ ...currentResult, exitCode: currentResult.exitCode || 1 }),
			pendingTool,
		});
		if (isRunning) {
			currentResult.progress = progress;
			delete currentResult.progressSummary;
		} else {
			currentResult.progressSummary = toProgressSummary(progress);
			delete currentResult.progress;
		}
	};

	const emitUpdate = () => {
		refreshProgress(!processClosed);
		onUpdate?.({
			content: [
				{
					type: "text",
					text: getFinalOutput(currentResult.messages) || "(running...)",
				},
			],
			result: currentResult,
		});
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push(
				agent.systemPromptMode === "append"
					? "--append-system-prompt"
					: "--system-prompt",
				tmpPromptPath,
			);
		}

		args.push(`Task: ${task}`);

		const spawnEnv: Record<string, string | undefined> = {
			...process.env,
			[SUBAGENT_CHILD_ENV]: "1",
			[SUBAGENT_RUN_ID_ENV]: runId,
			[SUBAGENT_CHILD_AGENT_ENV]: agentName,
		};
		if (parentSessionId) {
			spawnEnv[SUBAGENT_PARENT_SESSION_ENV] = parentSessionId;
		}

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiSpawnCommand(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: cwd ?? defaultCwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
				env: spawnEnv,
				detached: false,
			});

			let buffer = "";
			let wasAborted = false;

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: {
					type?: string;
					message?: Message;
					toolName?: string;
					args?: Record<string, unknown>;
				};
				try {
					event = JSON.parse(line) as {
						type?: string;
						message?: Message;
						toolName?: string;
						args?: Record<string, unknown>;
					};
				} catch {
					return;
				}

				if (event.type === "tool_execution_start" && event.toolName) {
					pendingTool = {
						name: event.toolName,
						args: event.args ?? {},
						startedAt: Date.now(),
					};
					emitUpdate();
				}

				if (event.type === "message_end" && event.message) {
					const msg = event.message;
					currentResult.messages.push(msg);
					if (msg.role === "assistant") {
						currentResult.usage.turns++;
						const usage = msg.usage;
						if (usage) {
							currentResult.usage.input += usage.input || 0;
							currentResult.usage.output += usage.output || 0;
							currentResult.usage.cacheRead += usage.cacheRead || 0;
							currentResult.usage.cacheWrite += usage.cacheWrite || 0;
							currentResult.usage.cost += usage.cost?.total || 0;
							currentResult.usage.contextTokens = usage.totalTokens || 0;
						}
						if (!currentResult.model && msg.model) currentResult.model = msg.model;
						if (msg.stopReason) currentResult.stopReason = msg.stopReason;
						if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
					}
					emitUpdate();
				}

				if (event.type === "tool_result_end" && event.message) {
					currentResult.messages.push(event.message);
					if (
						pendingTool &&
						event.message.role === "toolResult" &&
						event.message.toolName === pendingTool.name
					) {
						pendingTool = undefined;
					}
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data: Buffer) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data: Buffer) => {
				currentResult.stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (buffer.trim()) processLine(buffer);
				processClosed = true;
				pendingTool = undefined;
				resolve(wasAborted ? 1 : (code ?? 0));
			});

			proc.on("error", () => resolve(1));

			if (signal) {
				const killProc = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
				};
				if (signal.aborted) killProc();
				else signal.addEventListener("abort", killProc, { once: true });
			}
		});

		currentResult.exitCode = exitCode;
		refreshProgress(false);
		return currentResult;
	} finally {
		if (tmpPromptPath) {
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				// ignore
			}
		}
		if (tmpPromptDir) {
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				// ignore
			}
		}
	}
}

function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}
