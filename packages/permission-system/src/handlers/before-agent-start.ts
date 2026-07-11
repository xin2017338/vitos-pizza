import type {
	BeforeAgentStartEventResult,
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type {
	EvaluateOptions,
	PermissionEvaluator,
} from "../permission-evaluator.ts";
import type { PermissionSession } from "../permission-session.ts";
import { sanitizeSkillPromptBlocks } from "../sanitizers/skill-prompt.ts";
import { sanitizeAvailableToolsSection } from "../sanitizers/system-prompt.ts";
import type { FlatPermissionConfig } from "../types.ts";

export function selectAllowedToolNames(
	toolNames: readonly string[],
	permission: FlatPermissionConfig,
	evaluator: PermissionEvaluator,
	options: EvaluateOptions = {},
): string[] {
	const allowedTools: string[] = [];
	for (const toolName of toolNames) {
		const state = evaluator.getToolPermission(permission, toolName, options);
		if (state !== "deny") allowedTools.push(toolName);
	}
	return allowedTools;
}

export function registerBeforeAgentStart(
	pi: ExtensionAPI,
	session: PermissionSession,
): void {
	pi.on("before_agent_start", async (event, ctx) => {
		session.refresh(ctx);
		const agentName = session.resolveAgentName(ctx, event.systemPrompt);
		session.setAgentName(agentName);

		const config = session.getConfig();
		const permission = config.permission ?? {};
		// Start from all registered tools so leaving a narrowed mode (e.g. plan)
		// can expand write/edit/bash again — getActiveTools() only shrinks.
		const candidateTools = pi.getAllTools().map((tool) => tool.name);
		const allowedTools = selectAllowedToolNames(
			candidateTools,
			permission,
			session.evaluator,
			{
				yoloMode: config.yoloMode,
				sessionApprovals: session.sessionApprovals,
			},
		);

		pi.setActiveTools(allowedTools);

		const toolPromptResult = sanitizeAvailableToolsSection(
			event.systemPrompt,
			allowedTools,
		);
		const skillPromptResult = sanitizeSkillPromptBlocks(
			toolPromptResult.prompt,
			permission,
			session.evaluator,
			{ yoloMode: config.yoloMode, agentName },
		);

		if (
			skillPromptResult.prompt !== event.systemPrompt ||
			toolPromptResult.removed
		) {
			return { systemPrompt: skillPromptResult.prompt };
		}
		return {};
	});
}

export function resolveAgentNameFromContext(
	_ctx: ExtensionContext,
	systemPrompt?: string,
): string | undefined {
	const match = systemPrompt
		? /<active_agent>\s*([^\s<]+)/i.exec(systemPrompt)
		: null;
	return match?.[1];
}

export type { BeforeAgentStartEventResult };
