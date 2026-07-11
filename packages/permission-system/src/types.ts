export type PermissionState = "allow" | "ask" | "deny";

export type DenyWithReason = {
	action: "deny";
	reason?: string;
};

export type ScalarPermissionValue = PermissionState | DenyWithReason;

export interface PatternMap {
	[key: string]: ScalarPermissionValue | PatternMap;
}

export type PatternValue = ScalarPermissionValue | PatternMap;

export type FlatPermissionConfig = Record<string, PatternValue>;

export interface ExtensionConfig {
	yoloMode?: boolean;
	debug?: boolean;
	agentMode?: "agent" | "plan" | "execute";
	permission?: FlatPermissionConfig;
}

export type RuleOrigin =
	| "global"
	| "project"
	| "agent"
	| "project-agent"
	| "session"
	| "builtin"
	| "yolo";

export interface PermissionCheckResult {
	state: PermissionState;
	reason?: string;
	matchedPattern?: string;
	surface: string;
	value: string;
	origin: RuleOrigin;
}

export interface GateContext {
	toolName: string;
	input: Record<string, unknown>;
	cwd: string;
	agentName?: string;
}

export function isPermissionState(value: unknown): value is PermissionState {
	return value === "allow" || value === "ask" || value === "deny";
}

export function isDenyWithReason(value: unknown): value is DenyWithReason {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		record.action === "deny" &&
		(record.reason === undefined || typeof record.reason === "string")
	);
}

export function permissionStateRank(state: PermissionState): number {
	if (state === "deny") return 3;
	if (state === "ask") return 2;
	return 1;
}

export function pickMostRestrictive(
	results: readonly PermissionCheckResult[],
): PermissionCheckResult | null {
	if (results.length === 0) return null;
	return results.reduce((best, current) =>
		permissionStateRank(current.state) > permissionStateRank(best.state)
			? current
			: best,
	);
}
