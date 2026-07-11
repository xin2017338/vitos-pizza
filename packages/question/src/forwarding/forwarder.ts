import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
	ForwardedQuestionRequest,
	ForwardedQuestionResponse,
	QuestionOption,
	QuestionParams,
} from "../types.ts";
import { QUESTION_RPC_PROMPT, questionReplyChannel } from "./channels.ts";

interface EventBus {
	emit(channel: string, payload: unknown): void;
	on(channel: string, handler: (payload: unknown) => void): () => void;
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
	params: QuestionParams;
	timeoutMs?: number;
}): Promise<ForwardedQuestionResponse | null> {
	const requestId = randomUUID();
	const payload = {
		requestId,
		targetSessionId: options.targetSessionId,
		requesterSessionId: options.requesterSessionId,
		question: options.params.question,
		options: options.params.options,
	};

	if (options.events) {
		const rpcReply = await waitForRpcReply(
			options.events,
			payload,
			options.timeoutMs ?? 600_000,
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
			options.timeoutMs ?? 600_000,
		);
	}

	return null;
}

function waitForRpcReply(
	events: EventBus,
	payload: {
		requestId: string;
		targetSessionId: string;
		requesterSessionId: string;
		question: string;
		options: QuestionOption[];
	},
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
		params: QuestionParams;
	},
	timeoutMs: number,
): Promise<ForwardedQuestionResponse | null> {
	const forwardingRoot = getQuestionForwardingRoot(agentDir, targetSessionId);
	const { requestsDir, responsesDir } = getForwardingDirs(forwardingRoot);
	const request: ForwardedQuestionRequest = {
		id: payload.requestId,
		createdAt: Date.now(),
		requesterSessionId: payload.requesterSessionId,
		targetSessionId: payload.targetSessionId,
		question: payload.params.question,
		options: payload.params.options,
	};
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
	handler: (payload: {
		requestId: string;
		question: string;
		options: QuestionOption[];
	}) => Promise<ForwardedQuestionResponse>,
): () => void {
	return events.on(QUESTION_RPC_PROMPT, async (raw) => {
		const payload = raw as {
			requestId: string;
			question: string;
			options: QuestionOption[];
		};
		const response = await handler(payload);
		events.emit(questionReplyChannel(payload.requestId), response);
	});
}
