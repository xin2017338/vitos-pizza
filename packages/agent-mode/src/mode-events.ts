import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentMode } from "./modes.ts";

export const AGENT_MODE_CHANGED = "agent-mode:changed";
export const AGENT_MODE_STATUS_KEY = "agent-mode";

export type AgentModeDisplayColor = "dim" | "accent" | "warning";

export interface AgentModeChangedPayload {
	mode: AgentMode;
	label: string;
	color: AgentModeDisplayColor;
}

interface EventBus {
	emit(channel: string, payload: unknown): void;
}

function modeDisplay(mode: AgentMode): AgentModeChangedPayload {
	switch (mode) {
		case "plan":
			return { mode, label: "plan", color: "accent" };
		case "execute":
			return { mode, label: "execute", color: "warning" };
		default:
			return { mode, label: "agent", color: "dim" };
	}
}

export function formatAgentModeStatusText(mode: AgentMode): string {
	return `mode: ${mode}`;
}

export function emitAgentModeChanged(
	events: EventBus,
	mode: AgentMode,
): AgentModeChangedPayload {
	const payload = modeDisplay(mode);
	events.emit(AGENT_MODE_CHANGED, payload);
	return payload;
}

function isBorderStatusBarEnabled(cwd: string): boolean {
	let borderStatusBar = true;
	const globalPath = join(homedir(), ".pi", "agent", "settings.json");
	const projectPath = join(cwd, ".pi", "settings.json");

	for (const path of [globalPath, projectPath]) {
		if (!existsSync(path)) continue;
		try {
			const raw = JSON.parse(readFileSync(path, "utf8")) as {
				ui?: { borderStatusBar?: boolean };
			};
			if (typeof raw.ui?.borderStatusBar === "boolean") {
				borderStatusBar = raw.ui.borderStatusBar;
			}
		} catch {
			// ignore invalid settings
		}
	}

	return borderStatusBar;
}

export function updateAgentModeStatusFallback(
	ctx: ExtensionContext,
	mode: AgentMode,
): void {
	if (!ctx.hasUI || ctx.mode !== "tui") return;
	if (isBorderStatusBarEnabled(ctx.cwd)) {
		ctx.ui.setStatus(AGENT_MODE_STATUS_KEY, undefined);
		return;
	}
	const theme = ctx.ui.theme;
	const display = modeDisplay(mode);
	const text = theme.fg(display.color, formatAgentModeStatusText(mode));
	ctx.ui.setStatus(AGENT_MODE_STATUS_KEY, text);
}

export function clearAgentModeStatus(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(AGENT_MODE_STATUS_KEY, undefined);
}

export function isAgentModeChangedPayload(
	value: unknown,
): value is AgentModeChangedPayload {
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
