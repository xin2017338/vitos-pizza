/**
 * @vitos-pizza/permission-system — permission enforcement for Vito's Pizzeria.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
	getGlobalConfigPath,
	getProjectConfigPath,
} from "../src/config-paths.ts";
import { startPermissionRpcServer } from "../src/forwarding/forwarder.ts";
import {
	getSubagentSessionRegistry,
	subscribeSubagentLifecycle,
} from "../src/forwarding/subagent-registry.ts";
import { registerBeforeAgentStart } from "../src/handlers/before-agent-start.ts";
import {
	registerSkillInputGate,
	registerToolCallGate,
} from "../src/handlers/tool-call-gate.ts";
import {
	loadPermissionPreset,
	PERMISSION_APPLY_PRESET_EVENT,
	PERMISSION_RELOAD_CONFIG_EVENT,
	type PermissionApplyPresetPayload,
} from "../src/mode-api.ts";
import { PermissionSession } from "../src/permission-session.ts";
import { loadConfigFile, saveConfigFile } from "../src/policy-loader.ts";
import {
	createPermissionsService,
	emitPermissionEvent,
	setPermissionsService,
} from "../src/service.ts";
import type { ExtensionConfig } from "../src/types.ts";
import {
	buildApprovalSummary,
	buildApprovalTitle,
} from "../src/ui/approval-summary.ts";
import { showPermissionSystemModal } from "../src/ui/config-modal.ts";
import { requestPermissionDecisionFromUi } from "../src/ui/permission-dialog.ts";
import { installYoloRuntimeApi } from "../src/yolo/runtime-api.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const presetsDir = join(moduleDir, "..", "presets");

function ensureDefaultConfig(cwd: string, agentDir: string): void {
	const projectPath = getProjectConfigPath(cwd);
	if (existsSync(projectPath)) return;
	const globalPath = getGlobalConfigPath(agentDir);
	if (existsSync(globalPath)) return;

	const presetPath = join(presetsDir, "default.json");
	if (!existsSync(presetPath)) return;
	mkdirSync(dirname(projectPath), { recursive: true });
	copyFileSync(presetPath, projectPath);
}

export default function (pi: ExtensionAPI) {
	const agentDir = getAgentDir();
	const session = new PermissionSession(agentDir);
	const registry = getSubagentSessionRegistry();
	let activeUiContext: ExtensionContext | null = null;

	const persistConfig = (
		cwd: string,
		config: ReturnType<PermissionSession["getConfig"]>,
	) => {
		saveConfigFile(getProjectConfigPath(cwd), config);
	};

	const yoloApi = installYoloRuntimeApi(
		() => session.getConfig(),
		(config) => {
			const cwd = session.getCwd();
			persistConfig(cwd, config);
		},
		() => {
			if (activeUiContext) {
				session.refresh(activeUiContext);
			}
		},
	);

	setPermissionsService(
		createPermissionsService({
			getConfig: () => session.getConfig(),
			evaluator: session.evaluator,
			sessionApprovals: session.sessionApprovals,
			getAgentName: () =>
				session.resolveAgentName({ cwd: session.getCwd() } as never),
		}),
	);

	registerBeforeAgentStart(pi, session);
	registerToolCallGate(pi, session);
	registerSkillInputGate(pi, session);

	const unsubLifecycle = subscribeSubagentLifecycle(pi.events, registry);
	const unsubRpc = startPermissionRpcServer(pi.events, async (payload) => {
		const ctx = activeUiContext;
		if (!ctx?.hasUI) {
			return {
				approved: false,
				state: "denied",
				confirmationUnavailable: true,
			};
		}
		emitPermissionEvent(pi, "permissions:ui_prompt", payload);
		return requestPermissionDecisionFromUi(
			ctx.ui,
			payload.title || buildApprovalTitle(payload.surface),
			payload.message ||
				buildApprovalSummary({
					toolName: payload.surface,
					input: { command: payload.value },
					cwd: ctx.cwd,
				}),
			{
				sessionLabel: payload.value
					? `Yes, for this session (${payload.value})`
					: undefined,
			},
		);
	});

	const unsubReload = pi.events.on(PERMISSION_RELOAD_CONFIG_EVENT, () => {
		if (activeUiContext) {
			session.refresh(activeUiContext);
		}
	});

	const unsubApplyPreset = pi.events.on(
		PERMISSION_APPLY_PRESET_EVENT,
		(payload: unknown) => {
			const { preset, agentMode } = (payload ??
				{}) as PermissionApplyPresetPayload;
			if (preset !== "default" && preset !== "plan" && preset !== "yolo") {
				return;
			}
			const presetConfig = loadPermissionPreset(preset);
			const overlay: ExtensionConfig = {
				yoloMode: presetConfig.yoloMode ?? false,
				permission: presetConfig.permission ?? { "*": "ask" },
				...(agentMode ? { agentMode } : {}),
			};
			session.setSessionOverlay(overlay);
		},
	);

	pi.on("session_start", async (_event, ctx) => {
		activeUiContext = ctx;
		ensureDefaultConfig(ctx.cwd, agentDir);
		session.clearSessionOverlay();
		session.refresh(ctx);
		session.sessionApprovals.clear();
		emitPermissionEvent(pi, "permissions:ready", { cwd: ctx.cwd });
	});

	pi.on("session_shutdown", (_event, _ctx) => {
		activeUiContext = null;
		session.clearSessionOverlay();
		session.sessionApprovals.clear();
	});

	pi.registerCommand("permission-system", {
		description: "Open permission system settings (YOLO mode, debug)",
		handler: async (_args, ctx) => {
			session.refresh(ctx);
			const config = session.getConfig();
			await showPermissionSystemModal(ctx, config, (next) => {
				persistConfig(ctx.cwd, next);
				session.refresh(ctx);
			});
		},
	});

	void unsubLifecycle;
	void unsubRpc;
	void unsubReload;
	void unsubApplyPreset;
	void loadConfigFile;
	void yoloApi;
}
