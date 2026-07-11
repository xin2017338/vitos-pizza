export const QUESTION_RPC_PROMPT = "question:rpc:prompt";
export const QUESTION_RPC_PROMPT_REPLY_PREFIX = "question:rpc:prompt:reply:";

export function questionReplyChannel(requestId: string): string {
	return `${QUESTION_RPC_PROMPT_REPLY_PREFIX}${requestId}`;
}
