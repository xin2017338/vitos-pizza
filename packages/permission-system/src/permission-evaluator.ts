import type {
	FlatPermissionConfig,
	PatternMap,
	PatternValue,
	PermissionCheckResult,
	PermissionState,
	RuleOrigin,
} from "./types.ts";
import {
	isDenyWithReason,
	isPermissionState,
	permissionStateRank,
} from "./types.ts";
import {
	compileWildcardPatternEntries,
	findCompiledWildcardMatch,
	type WildcardMatchOptions,
} from "./wildcard-matcher.ts";

export interface SessionApprovalRule {
	surface: string;
	pattern: string;
}

export class SessionApprovals {
	private readonly rules: SessionApprovalRule[] = [];

	add(surface: string, pattern: string): void {
		this.rules.push({ surface, pattern });
	}

	clear(): void {
		this.rules.length = 0;
	}

	hasMatch(
		surface: string,
		value: string,
		options?: WildcardMatchOptions,
	): boolean {
		return this.rules.some(
			(rule) =>
				rule.surface === surface &&
				findCompiledWildcardMatch(
					compileWildcardPatternEntries([[rule.pattern, true]], options),
					value,
				),
		);
	}
}

export interface EvaluateOptions {
	yoloMode?: boolean;
	sessionApprovals?: SessionApprovals;
	platform?: NodeJS.Platform;
}

function pathMatchOptions(
	platform?: NodeJS.Platform,
): WildcardMatchOptions | undefined {
	if (platform === "win32") {
		return { caseInsensitive: true, windowsSeparators: true };
	}
	return undefined;
}

function resolvePatternState(
	value: PatternValue | undefined,
): { state: PermissionState; reason?: string } | null {
	if (value === undefined) return null;
	if (isPermissionState(value)) return { state: value };
	if (isDenyWithReason(value)) {
		return { state: "deny", reason: value.reason };
	}
	return null;
}

function evaluatePatternMap(
	patterns: PatternMap,
	value: string,
	origin: RuleOrigin,
	surface: string,
	options?: WildcardMatchOptions,
): PermissionCheckResult | null {
	const entries = Object.entries(patterns).filter(
		([pattern]) => pattern !== "*",
	);
	const compiled = compileWildcardPatternEntries(entries, options);
	const match = findCompiledWildcardMatch(compiled, value);
	if (match) {
		const resolved = resolvePatternState(match.state);
		if (!resolved) return null;
		return {
			state: resolved.state,
			reason: resolved.reason,
			matchedPattern: match.matchedPattern,
			surface,
			value,
			origin,
		};
	}
	const fallback = resolvePatternState(patterns["*"]);
	if (!fallback) return null;
	return {
		state: fallback.state,
		reason: fallback.reason,
		matchedPattern: "*",
		surface,
		value,
		origin,
	};
}

export class PermissionEvaluator {
	evaluateSurface(
		permission: FlatPermissionConfig,
		surface: string,
		value: string,
		origin: RuleOrigin = "project",
		options: EvaluateOptions = {},
	): PermissionCheckResult {
		const matchOptions =
			surface === "path" || surface === "external_directory"
				? pathMatchOptions(options.platform)
				: undefined;

		if (options.sessionApprovals?.hasMatch(surface, value, matchOptions)) {
			return {
				state: "allow",
				matchedPattern: "<session-approval>",
				surface,
				value,
				origin: "session",
			};
		}

		const surfaceRules = permission[surface];
		let result: PermissionCheckResult | null = null;

		if (
			typeof surfaceRules === "object" &&
			surfaceRules !== null &&
			!Array.isArray(surfaceRules) &&
			!("action" in surfaceRules)
		) {
			result = evaluatePatternMap(
				surfaceRules as PatternMap,
				value,
				origin,
				surface,
				matchOptions,
			);
		} else {
			const resolved = resolvePatternState(surfaceRules);
			if (resolved) {
				result = {
					state: resolved.state,
					reason: resolved.reason,
					matchedPattern: surface,
					surface,
					value,
					origin,
				};
			}
		}

		if (!result) {
			const wildcard = resolvePatternState(permission["*"]);
			result = {
				state: wildcard?.state ?? "ask",
				reason: wildcard?.reason,
				matchedPattern: "*",
				surface,
				value,
				origin: "builtin",
			};
		}

		if (options.yoloMode && result.state === "ask") {
			return {
				...result,
				state: "allow",
				matchedPattern: result.matchedPattern ?? "*",
				origin: "yolo",
			};
		}

		return result;
	}

	getToolPermission(
		permission: FlatPermissionConfig,
		toolName: string,
		options: EvaluateOptions = {},
	): PermissionState {
		const toolRule = permission[toolName];
		if (isPermissionState(toolRule)) {
			const state = toolRule;
			if (options.yoloMode && state === "ask") return "allow";
			return state;
		}
		return this.evaluateSurface(permission, "*", toolName, "project", options)
			.state;
	}

	pickMostRestrictive(
		results: readonly PermissionCheckResult[],
	): PermissionCheckResult | null {
		if (results.length === 0) return null;
		return results.reduce((best, current) =>
			permissionStateRank(current.state) > permissionStateRank(best.state)
				? current
				: best,
		);
	}
}
