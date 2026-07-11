import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	forwardPermissionPrompt,
	resolveParentSessionId,
} from "../forwarding/forwarder.ts";
import { getSubagentSessionRegistry } from "../forwarding/subagent-registry.ts";
import { runGatePipeline } from "../gates/pipeline.ts";
import { patternForSessionApproval } from "../permission-evaluator.ts";
import type { PermissionSession } from "../permission-session.ts";
import { emitPermissionEvent } from "../service.ts";
import type { GateContext } from "../types.ts";
import {
	buildApprovalSummary,
	buildApprovalTitle,
} from "../ui/approval-summary.ts";
import { requestPermissionDecisionFromUi } from "../ui/permission-dialog.ts";

export interface ToolGateDeps {
	getRegisteredTools?: () => ReadonlySet<string>;
	getSkillDirs?: () => readonly string[];
	getParentSessionId?: () => string | null;
}

export function registerToolCallGate(
	pi: ExtensionAPI,
	session: PermissionSession,
	deps: ToolGateDeps = {},
): void {
	pi.on("tool_call", async (event, ctx) => {
		session.refresh(ctx);
		const toolName = event.toolName;
		const config = session.getConfig();
		const permission = config.permission ?? {};
		const registeredTools =
			deps.getRegisteredTools?.() ??
			new Set(pi.getAllTools().map((tool) => tool.name));

		const gateContext: GateContext = {
			toolName,
			input: (event.input ?? {}) as Record<string, unknown>,
			cwd: ctx.cwd,
			agentName: session.resolveAgentName(ctx),
		};

		const result = runGatePipeline(permission, session.evaluator, gateContext, {
			yoloMode: config.yoloMode,
			platform: process.platform,
			skillDirs: deps.getSkillDirs?.() ?? [],
			registeredTools,
			sessionApprovals: session.sessionApprovals,
		});

		emitPermissionEvent(pi, "permissions:decision", {
			toolName,
			state: result.state,
			surface: result.surface,
			value: result.value,
			matchedPattern: result.matchedPattern,
		});

		if (result.state === "deny") {
			return {
				block: true,
				reason: result.reason ?? `Permission denied for ${toolName}`,
			};
		}

		if (result.state === "allow") {
			return;
		}

		const decision = await resolveAskDecision(
			pi,
			ctx,
			session,
			gateContext,
			result.matchedPattern,
			deps,
		);
		if (!decision.approved) {
			return {
				block: true,
				reason:
					decision.denialReason ??
					(decision.confirmationUnavailable
						? "Permission confirmation unavailable"
						: "Permission denied by user"),
			};
		}

		if (decision.state === "approved_for_session" && result.matchedPattern) {
			session.sessionApprovals.add(
				result.surface,
				patternForSessionApproval(result.surface, result.matchedPattern),
			);
		}
	});
}

async function resolveAskDecision(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	_session: PermissionSession,
	gateContext: GateContext,
	matchedPattern: string | undefined,
	deps: ToolGateDeps,
) {
	const title = buildApprovalTitle(gateContext.toolName);
	const message = buildApprovalSummary(gateContext);

	if (ctx.hasUI) {
		emitPermissionEvent(pi, "permissions:ui_prompt", {
			toolName: gateContext.toolName,
			surface: gateContext.toolName,
			value: message,
		});
		return requestPermissionDecisionFromUi(ctx.ui, title, message, {
			sessionLabel: matchedPattern
				? `Yes, for this session (${matchedPattern})`
				: undefined,
		});
	}

	const currentSessionId = ctx.sessionManager.getSessionId?.() ?? null;
	const registry = getSubagentSessionRegistry();
	const parentFromRegistry = currentSessionId
		? registry.get(currentSessionId)?.parentSessionId
		: undefined;
	const parentSessionId =
		parentFromRegistry ??
		deps.getParentSessionId?.() ??
		resolveParentSessionId();

	if (!parentSessionId || !currentSessionId) {
		return {
			approved: false,
			state: "denied" as const,
			confirmationUnavailable: true as const,
		};
	}

	const forwarded = await forwardPermissionPrompt({
		events: pi.events,
		requesterSessionId: currentSessionId,
		targetSessionId: parentSessionId,
		title,
		message,
		surface: gateContext.toolName,
		value: message,
	});

	if (!forwarded) {
		return {
			approved: false,
			state: "denied" as const,
			confirmationUnavailable: true as const,
		};
	}

	if (forwarded.autoApproved) {
		return forwarded;
	}

	return forwarded;
}

export function registerSkillInputGate(
	pi: ExtensionAPI,
	session: PermissionSession,
): void {
	pi.on("input", async (event, ctx) => {
		const text = typeof event.text === "string" ? event.text.trim() : "";
		if (!text.startsWith("/")) return;
		const skillName = text.slice(1).split(/\s+/)[0]?.trim();
		if (!skillName) return;

		session.refresh(ctx);
		session.trackExplicitSkillInvocation(skillName);
		const config = session.getConfig();
		const result = session.evaluator.evaluateSurface(
			config.permission ?? {},
			"skill",
			skillName,
			"project",
			{ yoloMode: config.yoloMode, sessionApprovals: session.sessionApprovals },
		);

		if (result.state === "deny") {
			ctx.ui.notify(`Skill "${skillName}" is not permitted`, "error");
			return;
		}

		if (result.state === "ask" && ctx.hasUI && !config.yoloMode) {
			const approved = await ctx.ui.confirm(
				`Load skill ${skillName}?`,
				`Allow loading skill "${skillName}"`,
			);
			if (!approved) return;
		}
	});
}
