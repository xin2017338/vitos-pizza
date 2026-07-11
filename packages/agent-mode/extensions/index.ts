/**
 * @vitos-pizza/agent-mode — centralized agent / plan / execute mode switching.
 */

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { emitShortcutAction } from "@vitos-pizza/keybindings/types";
import {
	applyAgentMode,
	createReloadEmitter,
	ensureAgentModePersisted,
} from "../src/apply-mode.ts";
import {
	clearAgentModeStatus,
	emitAgentModeChanged,
	updateAgentModeStatusFallback,
} from "../src/mode-events.ts";
import {
	AGENT_MODES,
	cycleAgentMode,
	isAgentMode,
	MODE_LABELS,
	type AgentMode,
} from "../src/modes.ts";
import {
	PLAN_INSTRUCTIONS,
	PLAN_MODE_MESSAGE,
	PLAN_MODE_TOOLS,
} from "../src/plan-instructions.ts";

export default function (pi: ExtensionAPI): void {
	let currentMode: AgentMode = "agent";

	const emitReload = createReloadEmitter(pi.events);

	const publishMode = (ctx: ExtensionContext, mode: AgentMode) => {
		currentMode = mode;
		emitAgentModeChanged(pi.events, mode);
		updateAgentModeStatusFallback(ctx, mode);
	};

	const switchMode = async (ctx: ExtensionContext, mode: AgentMode) => {
		applyAgentMode(ctx.cwd, mode, { emitReload: emitReload });
		publishMode(ctx, mode);
		ctx.ui.notify(`Mode: ${mode}`, "info");
	};

	emitShortcutAction(pi.events, {
		id: "agent-mode.cycle",
		description: "Cycle agent mode (agent → plan → execute)",
		handler: async (shortcutCtx) => {
			const next = cycleAgentMode(currentMode);
			await switchMode(shortcutCtx, next);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		const mode = ensureAgentModePersisted(ctx.cwd, { emitReload });
		publishMode(ctx, mode);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		clearAgentModeStatus(ctx);
	});

	pi.on("before_agent_start", async (event, _ctx) => {
		if (currentMode !== "plan") return {};

		const registered = new Set(pi.getAllTools().map((tool) => tool.name));
		const activeTools = PLAN_MODE_TOOLS.filter((name) => registered.has(name));
		if (activeTools.length > 0) {
			pi.setActiveTools([...activeTools]);
		}

		return {
			message: {
				customType: "agent-plan-mode",
				content: PLAN_MODE_MESSAGE,
				display: false,
			},
			systemPrompt: `${event.systemPrompt}\n\n${PLAN_INSTRUCTIONS}`,
		};
	});

	pi.registerCommand("mode", {
		description: "Switch agent mode (agent|plan|execute)",
		handler: async (args, ctx) => {
			const requested = args?.trim().toLowerCase();
			let mode: AgentMode | undefined;

			if (requested) {
				if (!isAgentMode(requested)) {
					ctx.ui.notify(
						`Unknown mode "${requested}". Use: ${AGENT_MODES.join(", ")}`,
						"error",
					);
					return;
				}
				mode = requested;
			} else if (ctx.hasUI) {
				const options = AGENT_MODES.map((m) => MODE_LABELS[m]);
				const selected = await ctx.ui.select("Agent mode", options);
				if (!selected) return;
				const index = options.indexOf(selected);
				if (index < 0) return;
				mode = AGENT_MODES[index];
			} else {
				ctx.ui.notify(`Usage: /mode <${AGENT_MODES.join("|")}>`, "info");
				return;
			}

			await switchMode(ctx, mode);
		},
	});
}
