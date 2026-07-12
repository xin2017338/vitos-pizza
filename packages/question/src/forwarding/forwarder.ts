import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { isSubagentChild } from "../parent-session.ts";
import type {
	ForwardedQuestionRequest,
	ForwardedQuestionResponse,
	MultiQuestionParams,
	QuestionOption,
	QuestionParams,
	QuestionTab,
	SelectType,
} from "../types.ts";
import { QUESTION_RPC_PROMPT, questionReplyChannel } from "./channels.ts";

interface EventBus {
	emit(channel: string, payload: unknown): void;
	on(channel: string, handler: (payload: unknown) => void): () => void;
}

/**
 * Payload sent over RPC / file for a forwarded question prompt.
 * Supports both single- and multi-question modes.
 */
export interface ForwardQuestionPayload {
	requestId: string;
	targetSessionId: string;
	requesterSessionId: string;
	/** Single‑question mode */
	question?: string;
	options?: QuestionOption[];
	selectType?: SelectType;
	/** Multi‑question mode */
	questions?: QuestionTab[];
}

export function getQuestionForwardingRoot(
	agentDir: string,
	sessionId: string,
): string {
	return join(agentDir, "question-forwarding", sessionId);
}

function getForwardingDirs(forwardingRoot: string): {
	requestsDir: string;
	responsesDir: string;
} {
	const requestsDir = join(forwardingRoot, "requests");
	const responsesDir = join(forwardingRoot, "responses");
	mkdirSync(requestsDir, { recursive: true });
	mkdirSync(responsesDir, { recursive: true });
	return { requestsDir, responsesDir };
}

export async function forwardQuestionPrompt(options: {
	events?: EventBus;
	agentDir?: string;
	targetSessionId: string;
	requesterSessionId: string;
	params: QuestionParams | MultiQuestionParams;
	timeoutMs?: number;
}): Promise<ForwardedQuestionResponse | null> {
	const requestId = randomUUID();

	const isMulti = "questions" in options.params;
	const payload: ForwardQuestionPayload = {
		requestId,
		targetSessionId: options.targetSessionId,
		requesterSessionId: options.requesterSessionId,
	};

	if (isMulti) {
		const mp = options.params as MultiQuestionParams;
		payload.questions = mp.questions;
	} else {
		const sp = options.params as QuestionParams;
		payload.question = sp.question;
		payload.options = sp.options;
		payload.selectType = sp.selectType;
	}

	// Subprocess children have an isolated event bus; their own no-UI RPC
	// server would poison-reply with cancelled. Skip RPC and use files only.
	if (options.events && !isSubagentChild()) {
		// Same-process RPC. If no capable listener replies, fall through to
		// file-based forwarding quickly instead of waiting the full timeout.
		const rpcReply = await waitForRpcReply(
			options.events,
			payload,
			1500, // short RPC-specific timeout
		);
		if (rpcReply) return rpcReply;
	}

	if (options.agentDir) {
		return waitForFileReply(
			options.agentDir,
			options.targetSessionId,
			{
				requestId,
				requesterSessionId: options.requesterSessionId,
				targetSessionId: options.targetSessionId,
				params: options.params,
			},
			options.timeoutMs ?? 300_000, // 5 min for user response
		);
	}

	return null;
}

function waitForRpcReply(
	events: EventBus,
	payload: ForwardQuestionPayload,
	timeoutMs: number,
): Promise<ForwardedQuestionResponse | null> {
	return new Promise((resolve) => {
		const replyChannel = questionReplyChannel(payload.requestId);
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			unsub();
			resolve(null);
		}, timeoutMs);

		const unsub = events.on(replyChannel, (reply) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			unsub();
			resolve(reply as ForwardedQuestionResponse);
		});

		events.emit(QUESTION_RPC_PROMPT, payload);
	});
}

function waitForFileReply(
	agentDir: string,
	targetSessionId: string,
	payload: {
		requestId: string;
		requesterSessionId: string;
		targetSessionId: string;
		params: QuestionParams | MultiQuestionParams;
	},
	timeoutMs: number,
): Promise<ForwardedQuestionResponse | null> {
	const forwardingRoot = getQuestionForwardingRoot(agentDir, targetSessionId);
	const { requestsDir, responsesDir } = getForwardingDirs(forwardingRoot);

	const isMulti = "questions" in payload.params;
	const request: ForwardedQuestionRequest = {
		id: payload.requestId,
		createdAt: Date.now(),
		requesterSessionId: payload.requesterSessionId,
		targetSessionId: payload.targetSessionId,
	};

	if (isMulti) {
		const mp = payload.params as MultiQuestionParams;
		request.questions = mp.questions;
	} else {
		const sp = payload.params as QuestionParams;
		request.question = sp.question;
		request.options = sp.options;
		request.selectType = sp.selectType;
	}

	writeFileSync(
		join(requestsDir, `${request.id}.json`),
		JSON.stringify(request),
		"utf8",
	);

	const started = Date.now();
	return new Promise((resolve) => {
		const timer = setInterval(() => {
			if (Date.now() - started > timeoutMs) {
				clearInterval(timer);
				resolve(null);
				return;
			}
			for (const file of readdirSync(responsesDir)) {
				if (!file.startsWith(request.id)) continue;
				try {
					const response = JSON.parse(
						readFileSync(join(responsesDir, file), "utf8"),
					) as ForwardedQuestionResponse;
					unlinkSync(join(responsesDir, file));
					clearInterval(timer);
					resolve(response);
					return;
				} catch {
					// keep polling
				}
			}
		}, 250);
	});
}

export function startQuestionRpcServer(
	events: EventBus,
	handler: (
		payload: ForwardQuestionPayload,
	) => Promise<ForwardedQuestionResponse | null | undefined>,
): () => void {
	return events.on(QUESTION_RPC_PROMPT, async (raw) => {
		const payload = raw as ForwardQuestionPayload;
		const response = await handler(payload);
		if (response == null) return;
		events.emit(questionReplyChannel(payload.requestId), response);
	});
}
