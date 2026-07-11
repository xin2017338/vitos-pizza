import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
	ForwardedQuestionRequest,
	ForwardedQuestionResponse,
	QuestionParams,
} from "../types.ts";
import { getQuestionForwardingRoot } from "./forwarder.ts";

const PROCESSING_SUFFIX = ".processing";

export function startQuestionFileWatcher(options: {
	agentDir: string;
	sessionId: string;
	responderSessionId: string;
	showQuestion: (params: QuestionParams) => Promise<ForwardedQuestionResponse>;
	pollIntervalMs?: number;
}): () => void {
	const forwardingRoot = getQuestionForwardingRoot(
		options.agentDir,
		options.sessionId,
	);
	const requestsDir = join(forwardingRoot, "requests");
	const responsesDir = join(forwardingRoot, "responses");
	mkdirSync(requestsDir, { recursive: true });
	mkdirSync(responsesDir, { recursive: true });

	const inFlight = new Set<string>();
	const pollIntervalMs = options.pollIntervalMs ?? 250;

	const timer = setInterval(() => {
		if (!existsSync(requestsDir)) return;
		for (const file of readdirSync(requestsDir)) {
			if (!file.endsWith(".json") || file.endsWith(PROCESSING_SUFFIX)) continue;
			const requestId = file.replace(/\.json$/, "");
			if (inFlight.has(requestId)) continue;

			const requestPath = join(requestsDir, file);
			const processingPath = `${requestPath}${PROCESSING_SUFFIX}`;
			try {
				renameSync(requestPath, processingPath);
			} catch {
				continue;
			}

			inFlight.add(requestId);
			void handleRequest(processingPath, requestId);
		}
	}, pollIntervalMs);

	async function handleRequest(processingPath: string, requestId: string) {
		try {
			const request = JSON.parse(
				readFileSync(processingPath, "utf8"),
			) as ForwardedQuestionRequest;

			const response = await options.showQuestion({
				question: request.question,
				options: request.options,
			});

			writeFileSync(
				join(responsesDir, `${requestId}.json`),
				JSON.stringify(response),
				"utf8",
			);
		} catch {
			const failure: ForwardedQuestionResponse = {
				question: "",
				options: [],
				answer: null,
				cancelled: true,
				responderSessionId: options.responderSessionId,
				respondedAt: Date.now(),
			};
			try {
				writeFileSync(
					join(responsesDir, `${requestId}.json`),
					JSON.stringify(failure),
					"utf8",
				);
			} catch {
				// ignore
			}
		} finally {
			inFlight.delete(requestId);
			try {
				unlinkSync(processingPath);
			} catch {
				// ignore
			}
		}
	}

	return () => {
		clearInterval(timer);
	};
}
