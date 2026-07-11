import type { AgentMessage } from "@earendil-works/pi-agent-core";

export interface TitleNamingContext {
	userMessage: string;
	assistantReply: string;
}

function extractTextFromMessage(message: AgentMessage): string {
	if (message.role === "user") {
		if (typeof message.content === "string") {
			return message.content;
		}
		return message.content
			.filter(
				(part): part is { type: "text"; text: string } =>
					part.type === "text" && typeof part.text === "string",
			)
			.map((part) => part.text)
			.join("\n");
	}

	if (message.role === "assistant") {
		return message.content
			.filter(
				(part): part is { type: "text"; text: string } =>
					part.type === "text" && typeof part.text === "string",
			)
			.map((part) => part.text)
			.join("\n");
	}

	return "";
}

export function extractTitleContext(
	messages: AgentMessage[],
): TitleNamingContext | null {
	let userMessage = "";
	let assistantReply = "";

	for (const message of messages) {
		if (message.role === "user") {
			userMessage = extractTextFromMessage(message);
		}
		if (message.role === "assistant") {
			assistantReply = extractTextFromMessage(message);
		}
	}

	const user = userMessage.trim();
	const assistant = assistantReply.trim();
	if (!user || !assistant) return null;

	return { userMessage: user, assistantReply: assistant };
}
