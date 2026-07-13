import {
	PERMISSION_APPLY_PRESET_EVENT,
	type PermissionApplyPresetPayload,
} from "@vitos-pizza/permission-system/mode-api";
import { type AgentMode, PRESET_BY_MODE } from "./modes.ts";

export interface ApplyAgentModeDeps {
	emitApplyPreset: (payload: PermissionApplyPresetPayload) => void;
}

export function applyAgentMode(
	mode: AgentMode,
	deps: ApplyAgentModeDeps,
): AgentMode {
	deps.emitApplyPreset({
		preset: PRESET_BY_MODE[mode],
		agentMode: mode,
	});
	return mode;
}

export function createApplyPresetEmitter(events: {
	emit: (channel: string, payload: unknown) => void;
}): (payload: PermissionApplyPresetPayload) => void {
	return (payload) => {
		events.emit(PERMISSION_APPLY_PRESET_EVENT, payload);
	};
}
