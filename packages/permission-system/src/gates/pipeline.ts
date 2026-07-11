import { evaluateBashCommand } from "../bash/matcher.ts";
import type { PermissionEvaluator } from "../permission-evaluator.ts";
import { inferSkillNameFromPath } from "../sanitizers/skill-prompt.ts";
import type {
	FlatPermissionConfig,
	GateContext,
	PermissionCheckResult,
	PermissionState,
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
}

export function runGatePipeline(
	permission: FlatPermissionConfig,
	evaluator: PermissionEvaluator,
	ctx: GateContext,
	options: GatePipelineOptions = {},
): PermissionCheckResult {
	const { toolName, input, cwd } = ctx;
	const evalOptions = {
		yoloMode: options.yoloMode,
		platform: options.platform,
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
			if (
				typeof externalRules === "object" &&
				externalRules !== null &&
				!Array.isArray(externalRules)
			) {
				checks.push(
					evaluator.evaluateSurface(
						permission,
						"external_directory",
						normalizedPath,
						"project",
						evalOptions,
					),
				);
			} else if (typeof externalRules === "string") {
				checks.push({
					state: externalRules as PermissionState,
					matchedPattern: "external_directory",
					surface: "external_directory",
					value: normalizedPath,
					origin: "project",
				});
			}
		}
	}

	const toolPermission = permission[toolName];
	if (typeof toolPermission === "string") {
		checks.push({
			state: toolPermission as PermissionState,
			matchedPattern: toolName,
			surface: toolName,
			value: toolName,
			origin: "project",
		});
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
