import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { forwardQuestionPrompt } from "./forwarding/forwarder.ts";
import { isSubagentChild, resolveParentSessionId } from "./parent-session.ts";
import { runMultiQuestionUi, runQuestionUi } from "./question-ui.ts";
import type {
	MultiQuestionDetails,
	MultiQuestionParams,
	MultiTabAnswer,
	QuestionDetails,
	QuestionParams,
	QuestionUiResult,
	QuestionsParams,
	SelectType,
	SingleTabAnswer,
	TabAnswer,
} from "./types.ts";

const SelectTypeSchema = Type.Optional(
	Type.Union([Type.Literal("single"), Type.Literal("multi")], {
		description: '"single" (default) or "multi" — allows multiple selections',
	}),
);

const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(
		Type.String({ description: "Optional description shown below label" }),
	),
});

const QuestionTabSchema = Type.Object({
	id: Type.Optional(
		Type.String({
			description:
				"Optional stable identifier used as result key (defaults to q0, q1, …)",
		}),
	),
	title: Type.Optional(
		Type.String({
			description: "Optional tab bar label (defaults to Q1, Q2, …)",
		}),
	),
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Array(OptionSchema, {
		description: "Options for the user to choose from",
	}),
	selectType: SelectTypeSchema,
});

const QuestionParamsSchema = Type.Object({
	question: Type.Optional(
		Type.String({
			description: "The question to ask the user (single‑question mode)",
		}),
	),
	options: Type.Optional(
		Type.Array(OptionSchema, {
			description: "Options for the user to choose from (single‑question mode)",
		}),
	),
	selectType: SelectTypeSchema,
	questions: Type.Optional(
		Type.Array(QuestionTabSchema, {
			description:
				"Multiple questions displayed as tabs (multi‑question mode). Overrides question/options when present.",
			minItems: 1,
		}),
	),
});

export interface QuestionToolDeps {
	getAgentDir: () => string;
	events: {
		emit(channel: string, payload: unknown): void;
		on(channel: string, handler: (payload: unknown) => void): () => void;
	};
}

// ── result builders (single) ──

function buildCancelledResult(
	params: QuestionParams,
): AgentToolResult<QuestionDetails> {
	const simpleOptions = params.options.map((o) => o.label);
	return {
		content: [{ type: "text", text: "User cancelled the selection" }],
		details: {
			question: params.question,
			options: simpleOptions,
			answer: null,
		},
	};
}

function buildAnswerResult(
	params: QuestionParams,
	answerData: string | SingleTabAnswer | MultiTabAnswer | QuestionUiResult,
): AgentToolResult<QuestionDetails> {
	const simpleOptions = params.options.map((o) => o.label);

	// Check for multi-select (from MultiTabAnswer or QuestionUiResult)
	if (typeof answerData === "object" && ("answers" in answerData || "multiAnswers" in answerData)) {
		const multiAnswers = "answers" in answerData
			? (answerData as MultiTabAnswer).answers
			: (answerData as QuestionUiResult).multiAnswers ?? [];
		const multiIndices = "indices" in answerData
			? (answerData as MultiTabAnswer).indices
			: (answerData as QuestionUiResult).multiIndices ?? [];

		const lines = multiAnswers.map((a: string, i: number) => {
			const idx = multiIndices[i];
			return idx === -1 ? `  (custom) ${a}` : `  ${idx}. ${a}`;
		});
		return {
			content: [{ type: "text", text: `User selected:\n${lines.join("\n")}` }],
			details: {
				question: params.question,
				options: simpleOptions,
				answer: multiAnswers.join(", "),
				multiAnswers,
				multiIndices,
			},
		};
	}

	if (typeof answerData === "object") {
		// Single select
		const single = answerData as SingleTabAnswer;
		if (single.wasCustom) {
			return {
				content: [{ type: "text", text: `User wrote: ${single.answer}` }],
				details: {
					question: params.question,
					options: simpleOptions,
					answer: single.answer,
					wasCustom: true,
				},
			};
		}
		return {
			content: [
				{
					type: "text",
					text: `User selected: ${single.index ?? simpleOptions.indexOf(single.answer) + 1}. ${single.answer}`,
				},
			],
			details: {
				question: params.question,
				options: simpleOptions,
				answer: single.answer,
				wasCustom: false,
			},
		};
	}

	// Legacy string
	return {
		content: [{ type: "text", text: `User selected: ${answerData}` }],
		details: {
			question: params.question,
			options: simpleOptions,
			answer: answerData,
		},
	};
}

function buildUnavailableResult(
	params: QuestionParams,
	reason: string,
): AgentToolResult<QuestionDetails> {
	return {
		content: [{ type: "text", text: reason }],
		details: {
			question: params.question,
			options: params.options.map((o) => o.label),
			answer: null,
		},
	};
}

// ── result builders (multi) ──

function buildMultiCancelledResult(
	params: MultiQuestionParams,
): AgentToolResult<MultiQuestionDetails> {
	return {
		content: [
			{ type: "text", text: "User cancelled the multi‑question selection" },
		],
		details: {
			answers: {},
		},
	};
}

function buildMultiAnswerResult(
	params: MultiQuestionParams,
	answers: Record<string, TabAnswer>,
): AgentToolResult<MultiQuestionDetails> {
	const lines: string[] = ["User answered:"];
	for (const [key, ans] of Object.entries(answers)) {
		const tab = params.questions.find(
			(q) => (q.id ?? `q${params.questions.indexOf(q)}`) === key,
		);
		const label = tab?.title ?? key;
		if ("answers" in ans) {
			const multi = ans as MultiTabAnswer;
			const parts = multi.answers.map((a, i) => {
				const idx = multi.indices[i];
				return idx === -1 ? `${a}(custom)` : `${idx}. ${a}`;
			});
			lines.push(`  ${label}: ${parts.join(", ")}`);
		} else {
			const single = ans as SingleTabAnswer;
			if (single.wasCustom) {
				lines.push(`  ${label}: ${single.answer} (custom)`);
			} else {
				lines.push(`  ${label}: ${single.index}. ${single.answer}`);
			}
		}
	}
	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { answers },
	};
}

function buildMultiUnavailableResult(
	params: MultiQuestionParams,
	reason: string,
): AgentToolResult<MultiQuestionDetails> {
	return {
		content: [{ type: "text", text: reason }],
		details: { answers: {} },
	};
}

// ── execution ──

function isMultiParams(
	params: QuestionsParams,
): params is MultiQuestionParams {
	return (
		"questions" in params &&
		Array.isArray((params as MultiQuestionParams).questions)
	);
}

async function executeSingleQuestion(
	params: QuestionParams,
	ctx: ExtensionContext,
	deps: QuestionToolDeps,
): Promise<AgentToolResult<QuestionDetails>> {
	if (params.options.length === 0) {
		return buildUnavailableResult(params, "Error: No options provided");
	}

	const child = isSubagentChild();
	const parentSessionId = resolveParentSessionId();
	const currentSessionId = ctx.sessionManager.getSessionId?.() ?? null;

	if (!child && ctx.hasUI) {
		const result = await runQuestionUi(ctx.ui, params);
		if (!result) return buildCancelledResult(params);
		if (result.multiAnswers && result.multiIndices) {
			return buildAnswerResult(params, {
				answers: result.multiAnswers,
				indices: result.multiIndices,
			} as MultiTabAnswer);
		}
		return buildAnswerResult(params, result as SingleTabAnswer);
	}

	if (!parentSessionId) {
		return buildUnavailableResult(
			params,
			"Error: UI not available (running in non-interactive mode)",
		);
	}

	const forwarded = await forwardQuestionPrompt({
		events: deps.events,
		agentDir: deps.getAgentDir(),
		targetSessionId: parentSessionId,
		requesterSessionId: currentSessionId ?? "unknown",
		params,
	});

	if (!forwarded) {
		return buildUnavailableResult(
			params,
			"Error: Question prompt timed out or parent session unavailable",
		);
	}

	if (forwarded.cancelled) {
		return buildCancelledResult(params);
	}

	// Multi-select via forwarding
	if (forwarded.multiAnswers && forwarded.multiIndices) {
		return buildAnswerResult(params, {
			answers: forwarded.multiAnswers,
			indices: forwarded.multiIndices,
		} as MultiTabAnswer);
	}

	// Single-select via forwarding
	if (forwarded.answer !== null && forwarded.answer !== undefined) {
		return buildAnswerResult(params, {
			answer: forwarded.answer,
			wasCustom: forwarded.wasCustom ?? false,
		} as SingleTabAnswer);
	}

	return buildCancelledResult(params);
}

async function executeMultiQuestion(
	params: MultiQuestionParams,
	ctx: ExtensionContext,
	deps: QuestionToolDeps,
): Promise<AgentToolResult<MultiQuestionDetails>> {
	if (params.questions.length === 0) {
		return buildMultiUnavailableResult(params, "Error: No questions provided");
	}

	const child = isSubagentChild();
	const parentSessionId = resolveParentSessionId();
	const currentSessionId = ctx.sessionManager.getSessionId?.() ?? null;

	if (!child && ctx.hasUI) {
		const result = await runMultiQuestionUi(ctx.ui, params);
		if (!result) return buildMultiCancelledResult(params);
		return buildMultiAnswerResult(params, result.answers);
	}

	if (!parentSessionId) {
		return buildMultiUnavailableResult(
			params,
			"Error: UI not available (running in non-interactive mode)",
		);
	}

	const forwarded = await forwardQuestionPrompt({
		events: deps.events,
		agentDir: deps.getAgentDir(),
		targetSessionId: parentSessionId,
		requesterSessionId: currentSessionId ?? "unknown",
		params,
	});

	if (!forwarded) {
		return buildMultiUnavailableResult(
			params,
			"Error: Question prompt timed out or parent session unavailable",
		);
	}

	if (forwarded.cancelled) {
		return buildMultiCancelledResult(params);
	}

	if (forwarded.answers) {
		return buildMultiAnswerResult(params, forwarded.answers);
	}

	return buildMultiUnavailableResult(params, "Error: No answers returned");
}

// ── tool registration ──

export function registerQuestionTool(
	pi: ExtensionAPI,
	deps: QuestionToolDeps,
): void {
	pi.registerTool({
		name: "question",
		label: "Question",
		description:
			"Ask the user a question and let them pick from options. Supports single questions (question+options) or multiple tabbed questions (questions[]). Use when you need user input to proceed.",
		parameters: QuestionParamsSchema,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const p = params as QuestionsParams;
			if (isMultiParams(p)) {
				return executeMultiQuestion(p, ctx, deps);
			}
			const single = p as QuestionParams;
			if (!single.question || !single.options) {
				return buildUnavailableResult(
					{
						question: single.question ?? "",
						options: single.options ?? [],
					},
					"Error: Provide either question+options or questions[]",
				);
			}
			return executeSingleQuestion(single, ctx, deps);
		},

		renderCall(_args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("question")), 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as
				| QuestionDetails
				| MultiQuestionDetails
				| undefined;
			if (!details) {
				const text = result.content[0];
				const fallback = text?.type === "text" ? text.text : "";
				return new Text(fallback, 0, 0);
			}

			// Multi-question (tabbed) result
			if ("answers" in details && details.answers) {
				const ans = details.answers;
				const keys = Object.keys(ans);
				if (keys.length === 0) {
					return new Text(theme.fg("warning", "Cancelled"), 0, 0);
				}
				const first = ans[keys[0]!];
				if (keys.length === 1 && first) {
					const display = "answers" in first
						? (first as MultiTabAnswer).answers.join(", ")
						: (first as SingleTabAnswer).answer;
					return new Text(
						theme.fg("success", "✓ ") + theme.fg("accent", display),
						0,
						0,
					);
				}
				return new Text(
					theme.fg("success", `✓ ${keys.length} answered`),
					0,
					0,
				);
			}

			// Single-question result
			const sq = details as QuestionDetails;
			if (sq.multiAnswers && sq.multiAnswers.length > 0) {
				return new Text(
					theme.fg("success", "✓ ") +
						theme.fg("accent", sq.multiAnswers.join(", ")),
					0,
					0,
				);
			}
			if (sq.answer === null || sq.answer === undefined) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}
			return new Text(
				theme.fg("success", "✓ ") + theme.fg("accent", sq.answer),
				0,
				0,
			);
		},
	});
}

// ── local prompt helper ──

export async function promptQuestionLocally(
	ui: ExtensionContext["ui"],
	params: QuestionParams | MultiQuestionParams,
	responderSessionId: string,
) {
	if (isMultiParams(params)) {
		const result = await runMultiQuestionUi(ui, params);
		if (!result) {
			return {
				answers: {},
				cancelled: true,
				responderSessionId,
				respondedAt: Date.now(),
			};
		}
		return {
			answers: result.answers,
			cancelled: false,
			responderSessionId,
			respondedAt: Date.now(),
		};
	}

	const result = await runQuestionUi(ui, params);
	if (!result) {
		return {
			question: params.question,
			options: params.options.map((o) => o.label),
			answer: null,
			cancelled: true,
			responderSessionId,
			respondedAt: Date.now(),
		};
	}

	// Multi-select result
	if (result.multiAnswers && result.multiIndices) {
		return {
			question: params.question,
			options: params.options.map((o) => o.label),
			answer: result.multiAnswers.join(", "),
			multiAnswers: result.multiAnswers,
			multiIndices: result.multiIndices,
			cancelled: false,
			responderSessionId,
			respondedAt: Date.now(),
		};
	}

	// Single-select result
	return {
		question: params.question,
		options: params.options.map((o) => o.label),
		answer: result.answer,
		wasCustom: result.wasCustom,
		cancelled: false,
		responderSessionId,
		respondedAt: Date.now(),
	};
}
