import type {
	BeforeAgentStartEventResult,
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { PermissionSession } from "../permission-session.ts";
import { sanitizeSkillPromptBlocks } from "../sanitizers/skill-prompt.ts";
import { sanitizeAvailableToolsSection } from "../sanitizers/system-prompt.ts";

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
		const activeTools = pi.getActiveTools();
		const allowedTools: string[] = [];

		for (const toolName of activeTools) {
			const state = session.evaluator.getToolPermission(permission, toolName, {
				yoloMode: config.yoloMode,
				sessionApprovals: session.sessionApprovals,
			});
			if (state !== "deny") allowedTools.push(toolName);
		}

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
