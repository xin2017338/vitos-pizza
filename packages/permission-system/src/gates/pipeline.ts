import { evaluateBashCommand } from "../bash/matcher.ts";
import type {
	EvaluateOptions,
	PermissionEvaluator,
	SessionApprovals,
} from "../permission-evaluator.ts";
import { inferSkillNameFromPath } from "../sanitizers/skill-prompt.ts";
import type {
	FlatPermissionConfig,
	GateContext,
	PermissionCheckResult,
} from "../types.ts";
import {
	extractMcpTarget,
	extractPathFromToolInput,
	isExternalPath,
	normalizePathValue,
} from "./path-utils.ts";

export interface GatePipelineOptions {
	yoloMode?: boolean;
	platform?: NodeJS.Platform;
	skillDirs?: readonly string[];
	registeredTools?: ReadonlySet<string>;
	sessionApprovals?: SessionApprovals;
}

export function runGatePipeline(
	permission: FlatPermissionConfig,
	evaluator: PermissionEvaluator,
	ctx: GateContext,
	options: GatePipelineOptions = {},
): PermissionCheckResult {
	const { toolName, input, cwd } = ctx;
	const evalOptions: EvaluateOptions = {
		yoloMode: options.yoloMode,
		platform: options.platform,
		sessionApprovals: options.sessionApprovals,
	};

	if (options.registeredTools && !options.registeredTools.has(toolName)) {
		return {
			state: "deny",
			reason: `Tool "${toolName}" is not registered`,
			matchedPattern: "<unregistered-tool>",
			surface: toolName,
			value: toolName,
			origin: "builtin",
		};
	}

	const checks: PermissionCheckResult[] = [];
	const pathValue = extractPathFromToolInput(toolName, input);
	if (pathValue) {
		const normalizedPath = normalizePathValue(pathValue, cwd);
		checks.push(
			evaluator.evaluateSurface(
				permission,
				"path",
				normalizedPath,
				"project",
				evalOptions,
			),
		);
		if (isExternalPath(pathValue, cwd)) {
			const externalRules = permission.external_directory;
			if (externalRules !== undefined) {
				checks.push(
					evaluator.evaluateSurface(
						permission,
						"external_directory",
						normalizedPath,
						"project",
						evalOptions,
					),
				);
			}
		}
	}

	const toolPermission = permission[toolName];
	if (typeof toolPermission === "string") {
		// Evaluate via the tool surface so session approvals / yolo apply.
		checks.push(
			evaluator.evaluateSurface(
				permission,
				toolName,
				toolName,
				"project",
				evalOptions,
			),
		);
	} else {
		checks.push(
			evaluator.evaluateSurface(
				permission,
				"*",
				toolName,
				"project",
				evalOptions,
			),
		);
	}

	if (toolName === "bash" && typeof input.command === "string") {
		checks.push(
			evaluateBashCommand(input.command, permission, evaluator, evalOptions),
		);
	}

	if (toolName === "mcp") {
		const target = extractMcpTarget(input);
		if (target) {
			checks.push(
				evaluator.evaluateSurface(
					permission,
					"mcp",
					target,
					"project",
					evalOptions,
				),
			);
		}
	}

	if (toolName === "read" && pathValue && options.skillDirs?.length) {
		const skillName = inferSkillNameFromPath(pathValue, options.skillDirs);
		if (skillName) {
			checks.push(
				evaluator.evaluateSurface(
					permission,
					"skill",
					skillName,
					"project",
					evalOptions,
				),
			);
		}
	}

	const mostRestrictive = evaluator.pickMostRestrictive(checks);
	return (
		mostRestrictive ?? {
			state: "ask",
			matchedPattern: "*",
			surface: toolName,
			value: toolName,
			origin: "builtin",
		}
	);
}
