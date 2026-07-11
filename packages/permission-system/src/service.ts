import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PermissionEvaluator } from "./permission-evaluator.ts";
import type { SessionApprovals } from "./session-approvals.ts";
import type { ExtensionConfig, PermissionCheckResult } from "./types.ts";

export interface PermissionsService {
	checkPermission(surface: string, value: string): PermissionCheckResult;
	getToolPermission(toolName: string): "allow" | "ask" | "deny";
}

let serviceInstance: PermissionsService | null = null;

export function setPermissionsService(
	service: PermissionsService | null,
): void {
	serviceInstance = service;
}

export function getPermissionsService(): PermissionsService | null {
	return serviceInstance;
}

export function createPermissionsService(deps: {
	getConfig: () => ExtensionConfig;
	evaluator: PermissionEvaluator;
	sessionApprovals: SessionApprovals;
	getAgentName: () => string | undefined;
}): PermissionsService {
	return {
		checkPermission(surface, value) {
			const config = deps.getConfig();
			return deps.evaluator.evaluateSurface(
				config.permission ?? {},
				surface,
				value,
				"project",
				{
					yoloMode: config.yoloMode,
					sessionApprovals: deps.sessionApprovals,
				},
			);
		},
		getToolPermission(toolName) {
			const config = deps.getConfig();
			return deps.evaluator.getToolPermission(
				config.permission ?? {},
				toolName,
				{
					yoloMode: config.yoloMode,
					sessionApprovals: deps.sessionApprovals,
				},
			);
		},
	};
}

export function emitPermissionEvent(
	pi: ExtensionAPI,
	channel:
		| "permissions:ready"
		| "permissions:decision"
		| "permissions:ui_prompt",
	payload: unknown,
): void {
	pi.events.emit(channel, payload);
}
