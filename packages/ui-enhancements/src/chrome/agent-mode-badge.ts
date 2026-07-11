import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";

export const AGENT_MODE_CHANGED = "agent-mode:changed";

export type AgentModeDisplayColor = "dim" | "accent" | "warning";

export interface AgentModeChangedPayload {
	mode: "agent" | "plan" | "execute";
	label: string;
	color: AgentModeDisplayColor;
}

let currentAgentMode: AgentModeChangedPayload | null = null;

function isPayload(value: unknown): value is AgentModeChangedPayload {
	if (!value || typeof value !== "object") return false;
	const payload = value as Partial<AgentModeChangedPayload>;
	return (
		(payload.mode === "agent" ||
			payload.mode === "plan" ||
			payload.mode === "execute") &&
		typeof payload.label === "string" &&
		(payload.color === "dim" ||
			payload.color === "accent" ||
			payload.color === "warning")
	);
}

export function getAgentModeBadge(): AgentModeChangedPayload | null {
	return currentAgentMode;
}

export function formatAgentModeSuffix(
	payload: AgentModeChangedPayload | null,
	theme: Theme,
): string {
	if (!payload || payload.mode === "agent") return "";
	return theme.fg(payload.color, ` · ${payload.label}`);
}

export function registerAgentModeBadge(
	pi: ExtensionAPI,
	requestRender: () => void,
): () => void {
	const unsubChanged = pi.events.on(AGENT_MODE_CHANGED, (value) => {
		if (!isPayload(value)) return;
		currentAgentMode = value;
		requestRender();
	});

	pi.on("session_shutdown", () => {
		currentAgentMode = null;
	});

	return unsubChanged;
}

export function resetAgentModeBadgeForTests(): void {
	currentAgentMode = null;
}
