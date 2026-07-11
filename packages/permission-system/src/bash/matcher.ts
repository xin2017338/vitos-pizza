import type {
	EvaluateOptions,
	PermissionEvaluator,
} from "../permission-evaluator.ts";
import type { FlatPermissionConfig, PermissionCheckResult } from "../types.ts";
import { enumerateBashCommands, isTriviallyEmptyCommand } from "./parser.ts";

export function evaluateBashCommand(
	command: string,
	permission: FlatPermissionConfig,
	evaluator: PermissionEvaluator,
	options: EvaluateOptions = {},
): PermissionCheckResult {
	const units = enumerateBashCommands(command);

	if (units.length === 0) {
		if (isTriviallyEmptyCommand(command)) {
			return evaluator.evaluateSurface(
				permission,
				"bash",
				command.trim(),
				"project",
				options,
			);
		}
		return {
			state: "ask",
			matchedPattern: "<unparseable-bash-command>",
			surface: "bash",
			value: command,
			origin: "builtin",
		};
	}

	const results = units.map((unit) => {
		const base = evaluator.evaluateSurface(
			permission,
			"bash",
			unit.text,
			"project",
			options,
		);
		if (unit.opaque && base.state === "allow") {
			return {
				...base,
				state: "ask" as const,
				matchedPattern: "<opaque-bash-wrapper>",
			};
		}
		return base;
	});

	return evaluator.pickMostRestrictive(results) ?? results[0];
}
