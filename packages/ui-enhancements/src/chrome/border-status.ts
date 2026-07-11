import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Component, EditorTheme, TUI } from "@earendil-works/pi-tui";
import type { UiEnhancementsSettings } from "../config.ts";
import { loadUiEnhancementsSettings } from "../config.ts";
import { shortenPath } from "../utils/shorten-path.ts";
import {
	formatAgentModeSuffix,
	getAgentModeBadge,
	registerAgentModeBadge,
} from "./agent-mode-badge.ts";
import { fitBorder } from "./format-border.ts";
import { attachResizeRecovery } from "./resize-recovery.ts";

type GetSettings = () => UiEnhancementsSettings;

function formatContext(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow;
	if (!contextWindow || !usage || usage.percent === null) {
		return "ctx ?";
	}
	return `ctx ${Math.round(usage.percent)}%/${(contextWindow / 1000).toFixed(0)}k`;
}

function formatThinking(level: string): string {
	return level === "off" ? "off" : level;
}

class EmptyFooter implements Component {
	render(): string[] {
		return [];
	}

	invalidate(): void {}
}

export function registerBorderStatusBar(
	pi: ExtensionAPI,
	_getSettings: GetSettings,
): void {
	let isWorking = false;
	let spinnerIndex = 0;
	let spinnerTimer: ReturnType<typeof setInterval> | undefined;
	let activeTui: TUI | undefined;
	let detachResizeRecovery: (() => void) | undefined;
	const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

	const stopSpinner = () => {
		if (spinnerTimer) {
			clearInterval(spinnerTimer);
			spinnerTimer = undefined;
		}
	};

	const stopResizeRecovery = () => {
		detachResizeRecovery?.();
		detachResizeRecovery = undefined;
	};

	pi.on("agent_start", () => {
		isWorking = true;
		stopSpinner();
		spinnerTimer = setInterval(() => {
			spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
			activeTui?.requestRender();
		}, 80);
		activeTui?.requestRender();
	});

	pi.on("agent_end", () => {
		isWorking = false;
		stopSpinner();
		activeTui?.requestRender();
	});

	pi.on("session_shutdown", () => {
		stopSpinner();
		stopResizeRecovery();
		activeTui = undefined;
	});

	registerAgentModeBadge(pi, () => {
		activeTui?.requestRender();
	});

	pi.on("session_start", async (_event, ctx) => {
		const settings = loadUiEnhancementsSettings(ctx.cwd);
		if (!settings.borderStatusBar || !ctx.hasUI || ctx.mode !== "tui") return;

		stopResizeRecovery();
		detachResizeRecovery = attachResizeRecovery({
			getTarget: () => activeTui,
		});

		ctx.ui.setWorkingVisible(false);
		ctx.ui.setFooter(() => new EmptyFooter());

		let branch: string | undefined;
		let dirtyCount: number | undefined;

		const refreshGit = async () => {
			const branchResult = await pi
				.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd })
				.catch(() => undefined);
			const stdout = branchResult?.stdout.trim();
			branch = stdout && stdout.length > 0 ? stdout : undefined;

			const statusResult = await pi
				.exec("git", ["status", "--porcelain"], { cwd: ctx.cwd })
				.catch(() => undefined);
			if (statusResult?.stdout) {
				dirtyCount = statusResult.stdout
					.trim()
					.split("\n")
					.filter(Boolean).length;
			} else {
				dirtyCount = undefined;
			}

			activeTui?.requestRender();
		};
		void refreshGit();

		class BorderStatusEditor extends CustomEditor {
			constructor(
				tui: TUI,
				theme: EditorTheme,
				keybindings: KeybindingsManager,
			) {
				super(tui, theme, keybindings, { paddingX: 0 });
				activeTui = tui;
			}

			render(width: number): string[] {
				const lines = super.render(width);
				if (lines.length < 2) return lines;

				const thm = ctx.ui.theme;
				const model = ctx.model
					? `${ctx.model.provider}/${ctx.model.id}`
					: "no model";
				const thinking = pi.getThinkingLevel();
				const topLeft = isWorking
					? thm.fg("accent", ` ${spinnerFrames[spinnerIndex]} `)
					: "";
				const topRight = "";
				const bottomLeft = thm.fg(
					"muted",
					` ${model} · thinking:${formatThinking(thinking)}${formatAgentModeSuffix(getAgentModeBadge(), thm)} `,
				);

				const gitSuffix =
					branch !== undefined
						? ` (${branch}${dirtyCount ? ` *${dirtyCount}` : ""})`
						: "";
				const bottomRight = thm.fg(
					"muted",
					` ${formatContext(ctx)} · ${shortenPath(ctx.cwd)}${gitSuffix} `,
				);
				const borderColor = (text: string) => this.borderColor(text);

				lines[0] = fitBorder(topLeft, topRight, width, borderColor);
				lines[lines.length - 1] = fitBorder(
					bottomLeft,
					bottomRight,
					width,
					borderColor,
				);
				return lines;
			}
		}

		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) =>
				new BorderStatusEditor(tui, theme, keybindings),
		);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (!ctx.hasUI || ctx.mode !== "tui") return;
		const settings = loadUiEnhancementsSettings(ctx.cwd);
		if (!settings.borderStatusBar) return;

		ctx.ui.setWorkingVisible(true);
		ctx.ui.setFooter(undefined);
		ctx.ui.setEditorComponent(undefined);
	});
}
