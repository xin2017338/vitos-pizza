import { matchesFastReject } from "./fast-rules.ts";
import type { ScheduleContext, ScheduleDecision } from "./types.ts";

const COMMAND_PREFIXES = ["/", "!", "$"];

export function isBlank(text: string): boolean {
	return text.trim().length === 0;
}

export function isCommandInput(text: string): boolean {
	const trimmed = text.trim();
	return COMMAND_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function decideSchedule(
	input: string,
	ctx: ScheduleContext,
): ScheduleDecision {
	if (ctx.hasSessionName || ctx.inFlight) return "skip";
	if (isBlank(input) || isCommandInput(input)) return "skip";
	if (
		matchesFastReject(input, {
			minCharsForLlm: ctx.minCharsForLlm,
			fastRules: ctx.fastRules,
		})
	) {
		return "fastReject";
	}
	return "schedule";
}
