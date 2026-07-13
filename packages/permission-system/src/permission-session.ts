import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PermissionEvaluator } from "./permission-evaluator.ts";
import { PolicyLoader } from "./policy-loader.ts";
import { SessionApprovals } from "./session-approvals.ts";
import type { ExtensionConfig } from "./types.ts";

const AGENT_NAME_RE = /<active_agent>\s*([^\s<]+)/i;

function applyOverlay(
	base: ExtensionConfig,
	overlay: ExtensionConfig,
): ExtensionConfig {
	return {
		...base,
		yoloMode: overlay.yoloMode ?? base.yoloMode,
		agentMode: overlay.agentMode ?? base.agentMode,
		permission: overlay.permission ?? base.permission,
		debug: overlay.debug ?? base.debug,
	};
}

export class PermissionSession {
	readonly evaluator = new PermissionEvaluator();
	readonly sessionApprovals = new SessionApprovals();
	private readonly loader: PolicyLoader;
	private config: ExtensionConfig = { permission: { "*": "ask" } };
	private sessionOverlay: ExtensionConfig | null = null;
	private cwd = process.cwd();
	private agentName: string | undefined;
	private explicitSkillInvocations = new Set<string>();

	constructor(agentDir: string) {
		this.loader = new PolicyLoader(agentDir);
	}

	refresh(ctx: ExtensionContext): void {
		this.cwd = ctx.cwd;
		this.loader.setCwd(ctx.cwd);
		const loaded = this.loader.load(this.agentName).config;
		this.config = this.sessionOverlay
			? applyOverlay(loaded, this.sessionOverlay)
			: loaded;
	}

	setSessionOverlay(overlay: ExtensionConfig): void {
		this.sessionOverlay = overlay;
		this.config = applyOverlay(this.config, overlay);
	}

	clearSessionOverlay(): void {
		this.sessionOverlay = null;
	}

	getSessionOverlay(): ExtensionConfig | null {
		return this.sessionOverlay;
	}

	setAgentName(agentName: string | undefined): void {
		this.agentName = agentName;
	}

	resolveAgentName(
		_ctx: ExtensionContext,
		systemPrompt?: string,
	): string | undefined {
		if (this.agentName) return this.agentName;
		const fromPrompt = systemPrompt
			? AGENT_NAME_RE.exec(systemPrompt)?.[1]
			: undefined;
		return fromPrompt;
	}

	getConfig(): ExtensionConfig {
		return this.config;
	}

	getCwd(): string {
		return this.cwd;
	}

	trackExplicitSkillInvocation(skillName: string): void {
		this.explicitSkillInvocations.add(skillName.trim().toLowerCase());
	}

	wasExplicitSkillInvocation(skillName: string): boolean {
		return this.explicitSkillInvocations.has(skillName.trim().toLowerCase());
	}

	clearExplicitSkillInvocations(): void {
		this.explicitSkillInvocations.clear();
	}
}
