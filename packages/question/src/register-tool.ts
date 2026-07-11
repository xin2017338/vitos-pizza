import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { forwardQuestionPrompt } from "./forwarding/forwarder.ts";
import { isSubagentChild, resolveParentSessionId } from "./parent-session.ts";
import { runQuestionUi } from "./question-ui.ts";
import type { QuestionDetails, QuestionParams } from "./types.ts";

const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(
		Type.String({ description: "Optional description shown below label" }),
	),
});

const QuestionParamsSchema = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Array(OptionSchema, {
		description: "Options for the user to choose from",
	}),
});

export interface QuestionToolDeps {
	getAgentDir: () => string;
	events: {
		emit(channel: string, payload: unknown): void;
		on(channel: string, handler: (payload: unknown) => void): () => void;
	};
}

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
	answer: string,
	wasCustom: boolean,
	index?: number,
): AgentToolResult<QuestionDetails> {
	const simpleOptions = params.options.map((o) => o.label);
	if (wasCustom) {
		return {
			content: [{ type: "text", text: `User wrote: ${answer}` }],
			details: {
				question: params.question,
				options: simpleOptions,
				answer,
				wasCustom: true,
			},
		};
	}
	return {
		content: [
			{
				type: "text",
				text: `User selected: ${index ?? simpleOptions.indexOf(answer) + 1}. ${answer}`,
			},
		],
		details: {
			question: params.question,
			options: simpleOptions,
			answer,
			wasCustom: false,
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

async function executeQuestion(
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
		return buildAnswerResult(
			params,
			result.answer,
			result.wasCustom,
			result.index,
		);
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

	if (forwarded.cancelled || forwarded.answer === null) {
		return buildCancelledResult(params);
	}

	return buildAnswerResult(
		params,
		forwarded.answer,
		forwarded.wasCustom ?? false,
	);
}

export function registerQuestionTool(
	pi: ExtensionAPI,
	deps: QuestionToolDeps,
): void {
	pi.registerTool({
		name: "question",
		label: "Question",
		description:
			"Ask the user a question and let them pick from options. Use when you need user input to proceed.",
		parameters: QuestionParamsSchema,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			return executeQuestion(params, ctx, deps);
		},

		renderCall(_args, theme, _context) {
			return new Text(theme.fg("toolTitle", theme.bold("question")), 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionDetails | undefined;
			if (!details) {
				const text = result.content[0];
				const fallback = text?.type === "text" ? text.text : "";
				return new Text(fallback, 0, 0);
			}

			if (details.answer === null) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}

			return new Text(
				theme.fg("success", "✓ ") + theme.fg("accent", details.answer),
				0,
				0,
			);
		},
	});
}

export async function promptQuestionLocally(
	ui: ExtensionContext["ui"],
	params: QuestionParams,
	responderSessionId: string,
) {
	const simpleOptions = params.options.map((o) => o.label);
	const result = await runQuestionUi(ui, params);
	if (!result) {
		return {
			question: params.question,
			options: simpleOptions,
			answer: null,
			cancelled: true,
			responderSessionId,
			respondedAt: Date.now(),
		};
	}
	return {
		question: params.question,
		options: simpleOptions,
		answer: result.answer,
		wasCustom: result.wasCustom,
		cancelled: false,
		responderSessionId,
		respondedAt: Date.now(),
	};
}
