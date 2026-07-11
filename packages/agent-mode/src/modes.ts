import type { PermissionPresetName } from "@vitos-pizza/permission-system/mode-api";
import {
	PRESETS_DIR,
} from "@vitos-pizza/permission-system/mode-api";
import { detectPresetMode } from "@vitos-pizza/permission-system/detect-preset-mode";
import type { ExtensionConfig } from "@vitos-pizza/permission-system/types";

export type AgentMode = "agent" | "plan" | "execute";

export const AGENT_MODES: readonly AgentMode[] = [
	"agent",
	"plan",
	"execute",
] as const;

export const PRESET_BY_MODE: Record<AgentMode, PermissionPresetName> = {
	agent: "default",
	plan: "plan",
	execute: "yolo",
};

export const MODE_LABELS: Record<AgentMode, string> = {
	agent: "Agent mode — balanced permissions",
	plan: "Plan mode — read-only exploration",
	execute: "Execute mode — minimal gates",
};

export function isAgentMode(value: string): value is AgentMode {
	return (AGENT_MODES as readonly string[]).includes(value);
}

export function cycleAgentMode(current: AgentMode): AgentMode {
	const index = AGENT_MODES.indexOf(current);
	return AGENT_MODES[(index + 1) % AGENT_MODES.length];
}

export function inferAgentMode(config: ExtensionConfig): AgentMode {
	if (config.agentMode) return config.agentMode;
	const detected = detectPresetMode(config.permission, PRESETS_DIR);
	if (detected === "plan") return "plan";
	if (detected === "yolo") return "execute";
	return "agent";
}
