export const SUBAGENTS_READY = "subagents:ready";

export const SUBAGENTS_RPC_RUN = "subagents:rpc:run";
export const SUBAGENTS_RPC_RUN_REPLY_PREFIX = "subagents:rpc:run:reply:";

export const SUBAGENTS_RPC_WAIT = "subagents:rpc:wait";
export const SUBAGENTS_RPC_WAIT_REPLY_PREFIX = "subagents:rpc:wait:reply:";

export const SUBAGENT_ASYNC_STARTED = "subagent:async-started";
export const SUBAGENT_ASYNC_COMPLETE = "subagent:async-complete";

export const SUBAGENT_CHILD_SESSION_CREATED = "subagents:child:session-created";
export const SUBAGENT_CHILD_DISPOSED = "subagents:child:disposed";

export function subagentsRunReplyChannel(requestId: string): string {
	return `${SUBAGENTS_RPC_RUN_REPLY_PREFIX}${requestId}`;
}

export function subagentsWaitReplyChannel(requestId: string): string {
	return `${SUBAGENTS_RPC_WAIT_REPLY_PREFIX}${requestId}`;
}
