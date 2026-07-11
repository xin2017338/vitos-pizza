import {
	applyPermissionPreset,
	loadProjectConfig,
	PERMISSION_RELOAD_CONFIG_EVENT,
	saveProjectConfig,
} from "@vitos-pizza/permission-system/mode-api";
import {
	inferAgentMode,
	PRESET_BY_MODE,
	type AgentMode,
} from "./modes.ts";

export interface ApplyAgentModeDeps {
	emitReload: () => void;
}

export function applyAgentMode(
	cwd: string,
	mode: AgentMode,
	deps?: ApplyAgentModeDeps,
): AgentMode {
	const preset = PRESET_BY_MODE[mode];
	applyPermissionPreset(cwd, preset);
	const existing = loadProjectConfig(cwd);
	const next = {
		...existing,
		agentMode: mode,
		yoloMode: false,
	};
	saveProjectConfig(cwd, next);
	deps?.emitReload();
	return mode;
}

export function resolveCurrentAgentMode(cwd: string): AgentMode {
	const config = loadProjectConfig(cwd);
	return inferAgentMode(config);
}

export function ensureAgentModePersisted(
	cwd: string,
	deps?: ApplyAgentModeDeps,
): AgentMode {
	const config = loadProjectConfig(cwd);
	const mode = inferAgentMode(config);
	if (config.agentMode !== mode) {
		applyAgentMode(cwd, mode, deps);
		return mode;
	}
	deps?.emitReload();
	return mode;
}

export function createReloadEmitter(
	events: { emit: (channel: string, payload: unknown) => void },
): () => void {
	return () => {
		events.emit(PERMISSION_RELOAD_CONFIG_EVENT, {});
	};
}
