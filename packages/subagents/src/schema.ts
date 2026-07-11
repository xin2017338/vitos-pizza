import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({
		description:
			"Task with optional {previous} placeholder for prior step output",
	}),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "both".',
	default: "both",
});

export const SubagentParams: TSchema = Type.Object({
	agent: Type.Optional(Type.String({ description: "Agent name (single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (single mode)" })),
	tasks: Type.Optional(
		Type.Array(TaskItem, { description: "Parallel tasks array" }),
	),
	chain: Type.Optional(
		Type.Array(ChainItem, { description: "Sequential chain steps" }),
	),
	agentScope: Type.Optional(AgentScopeSchema),
	concurrency: Type.Optional(
		Type.Integer({
			minimum: 1,
			description: "Parallel mode max concurrency (default 4)",
		}),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory (single mode)" })),
	async: Type.Optional(
		Type.Boolean({ description: "Run in background; returns run id immediately" }),
	),
});

export const WaitParams: TSchema = Type.Object({
	id: Type.Optional(
		Type.String({ description: "Run id or prefix to wait for one specific run" }),
	),
	all: Type.Optional(
		Type.Boolean({
			description:
				"Wait for all active runs. Default false: return when the first run completes.",
		}),
	),
	timeoutMs: Type.Optional(
		Type.Integer({
			minimum: 1,
			description: "Timeout in milliseconds (default 30 minutes)",
		}),
	),
});
