import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	loadUiEnhancementsSettings,
	type UiEnhancementsSettings,
} from "./config.ts";

export const UI_ENHANCEMENTS_STATUS_KEY = "ui-enhancements";

export interface UiEnhancementsState {
	settings: UiEnhancementsSettings;
}

export function registerUiEnhancementsSession(
	pi: ExtensionAPI,
	setState: (state: UiEnhancementsState) => void,
): void {
	pi.on("session_start", async (_event, ctx) => {
		const settings = loadUiEnhancementsSettings(ctx.cwd);
		setState({ settings });

		if (!ctx.hasUI || ctx.mode !== "tui") return;

		if (settings.toolsCollapsedByDefault) {
			ctx.ui.setToolsExpanded(false);
		}

		if (settings.showExpandHint && !settings.borderStatusBar) {
			ctx.ui.setStatus(UI_ENHANCEMENTS_STATUS_KEY, "[ctrl+o: expand]");
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus(UI_ENHANCEMENTS_STATUS_KEY, undefined);
	});
}

export function formatUiEnhancementsStatus(
	state: UiEnhancementsState | null,
	ctx?: ExtensionContext,
): string {
	if (!state) {
		return "UI enhancements: not initialized";
	}

	const lines = [
		"**UI enhancements** (`@vitos-pizza/ui-enhancements`)",
		"",
		"| Setting | Value |",
		"| --- | --- |",
		`| toolsCollapsedByDefault | \`${state.settings.toolsCollapsedByDefault}\` |`,
		`| showExpandHint | \`${state.settings.showExpandHint}\` |`,
		`| welcomeHeader | \`${state.settings.welcomeHeader}\` |`,
		`| borderStatusBar | \`${state.settings.borderStatusBar}\` |`,
		"",
		"**Compact built-in tools:** read, bash, write, edit, find, grep, ls",
		"",
		"- Read-only bash: collapsed by default with line count summary",
		"- write / edit / dangerous bash: always full output",
		"- Use `ctrl+o` (`app.tools.expand`) to toggle tool output expansion",
		"",
		"**Chrome UI:** Vito's welcome header + border status bar (model, thinking, context, cwd, git)",
	];

	if (ctx?.hasUI && ctx.mode === "tui") {
		lines.push("", `Current tools expanded: \`${ctx.ui.getToolsExpanded()}\``);
	}

	return lines.join("\n");
}
