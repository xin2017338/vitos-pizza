import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { PermissionPromptDecision } from "../ui/permission-dialog.ts";

export const PERMISSION_RPC_PROMPT = "permissions:rpc:prompt";
export const PERMISSION_RPC_PROMPT_REPLY_PREFIX =
	"permissions:rpc:prompt:reply:";

export const SUBAGENT_PARENT_SESSION_ENV_CANDIDATES = [
	"PI_AGENT_ROUTER_PARENT_SESSION_ID",
	"PI_SUBAGENT_PARENT_SESSION",
] as const;

export interface ForwardedPermissionRequest {
	id: string;
	createdAt: number;
	requesterSessionId: string;
	targetSessionId: string;
	message: string;
	surface: string;
	value: string;
}

export interface ForwardedPermissionResponse {
	approved: boolean;
	state: PermissionPromptDecision["state"];
	denialReason?: string;
	responderSessionId: string;
	respondedAt: number;
}

interface EventBus {
	emit(channel: string, payload: unknown): void;
	on(channel: string, handler: (payload: unknown) => void): () => void;
}

export function resolveParentSessionId(): string | null {
	for (const key of SUBAGENT_PARENT_SESSION_ENV_CANDIDATES) {
		const value = process.env[key]?.trim();
		if (value) return value;
	}
	return null;
}

function getForwardingDirs(sessionRootDir: string): {
	requestsDir: string;
	responsesDir: string;
} {
	const base = join(sessionRootDir, "permission-forwarding");
	const requestsDir = join(base, "requests");
	const responsesDir = join(base, "responses");
	mkdirSync(requestsDir, { recursive: true });
	mkdirSync(responsesDir, { recursive: true });
	return { requestsDir, responsesDir };
}

export async function forwardPermissionPrompt(options: {
	events?: EventBus;
	sessionRootDir?: string;
	requesterSessionId: string;
	targetSessionId: string;
	title: string;
	message: string;
	surface: string;
	value: string;
	timeoutMs?: number;
}): Promise<PermissionPromptDecision | null> {
	const requestId = randomUUID();
	const payload = {
		requestId,
		targetSessionId: options.targetSessionId,
		requesterSessionId: options.requesterSessionId,
		title: options.title,
		message: options.message,
		surface: options.surface,
		value: options.value,
	};

	if (options.events) {
		return waitForRpcReply(
			options.events,
			payload,
			options.timeoutMs ?? 600_000,
		);
	}

	if (options.sessionRootDir) {
		return waitForFileReply(
			options.sessionRootDir,
			payload,
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
		title: string;
		message: string;
		surface: string;
		value: string;
	},
	timeoutMs: number,
): Promise<PermissionPromptDecision | null> {
	return new Promise((resolve) => {
		const replyChannel = `${PERMISSION_RPC_PROMPT_REPLY_PREFIX}${payload.requestId}`;
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
			const decision = reply as PermissionPromptDecision;
			resolve(decision);
		});

		events.emit(PERMISSION_RPC_PROMPT, payload);
	});
}

function waitForFileReply(
	sessionRootDir: string,
	payload: {
		requestId: string;
		targetSessionId: string;
		requesterSessionId: string;
		title: string;
		message: string;
		surface: string;
		value: string;
	},
	timeoutMs: number,
): Promise<PermissionPromptDecision | null> {
	const { requestsDir, responsesDir } = getForwardingDirs(sessionRootDir);
	const request: ForwardedPermissionRequest = {
		id: payload.requestId,
		createdAt: Date.now(),
		requesterSessionId: payload.requesterSessionId,
		targetSessionId: payload.targetSessionId,
		message: payload.message,
		surface: payload.surface,
		value: payload.value,
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
					) as ForwardedPermissionResponse;
					unlinkSync(join(responsesDir, file));
					clearInterval(timer);
					resolve({
						approved: response.approved,
						state: response.state,
						denialReason: response.denialReason,
					});
					return;
				} catch {
					// keep polling
				}
			}
		}, 250);
	});
}

export function startPermissionRpcServer(
	events: EventBus,
	handler: (payload: {
		requestId: string;
		title: string;
		message: string;
		surface: string;
		value: string;
	}) => Promise<PermissionPromptDecision>,
): () => void {
	return events.on(PERMISSION_RPC_PROMPT, async (raw) => {
		const payload = raw as {
			requestId: string;
			title: string;
			message: string;
			surface: string;
			value: string;
		};
		const decision = await handler(payload);
		events.emit(
			`${PERMISSION_RPC_PROMPT_REPLY_PREFIX}${payload.requestId}`,
			decision,
		);
	});
}
