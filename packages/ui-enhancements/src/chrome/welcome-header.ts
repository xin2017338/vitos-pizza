import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { loadUiEnhancementsSettings } from "../config.ts";
import {
	buildLoadedLines,
	buildWelcomeTips,
	getLoadedCounts,
	getModelDisplay,
} from "./header-info.ts";

interface WelcomeHeaderData {
	modelName: string;
	providerName: string;
	tips: string[];
	loadedLines: string[];
}

function padLine(text: string, width: number): string {
	const vis = visibleWidth(text);
	if (vis >= width) return truncateToWidth(text, width, "…");
	return text + " ".repeat(width - vis);
}

function renderStacked(
	data: WelcomeHeaderData,
	theme: Theme,
	width: number,
): string[] {
	const lines: string[] = [""];
	lines.push(theme.fg("accent", " π"));
	lines.push(theme.fg("muted", " Vito's"));
	lines.push("");
	lines.push(theme.fg("success", "Welcome back!"));
	lines.push(
		theme.fg("accent", data.modelName) +
			(data.providerName ? theme.fg("muted", ` · ${data.providerName}`) : ""),
	);
	lines.push("");
	lines.push(theme.fg("accent", theme.bold("Tips")));
	for (const tip of data.tips) {
		lines.push(theme.fg("muted", `  ${tip}`));
	}
	lines.push("");
	lines.push(theme.fg("accent", theme.bold("Loaded")));
	for (const line of data.loadedLines) {
		lines.push(theme.fg("success", `  ${line}`));
	}
	lines.push("");
	return lines.map((line) => truncateToWidth(line, width, "…"));
}

function renderTwoColumn(
	data: WelcomeHeaderData,
	theme: Theme,
	width: number,
): string[] {
	const leftWidth = Math.min(22, Math.floor(width * 0.35));
	const rightWidth = Math.max(1, width - leftWidth - 1);
	const gap = " ";

	const leftRows: string[] = [
		theme.fg("accent", " π"),
		theme.fg("muted", " Vito's"),
		"",
		theme.fg("accent", theme.bold("Tips")),
		...data.tips.map((tip) => theme.fg("muted", ` ${tip}`)),
	];

	const rightRows: string[] = [
		theme.fg("success", "Welcome back!"),
		theme.fg("accent", data.modelName) +
			(data.providerName ? theme.fg("muted", ` · ${data.providerName}`) : ""),
		"",
		theme.fg("accent", theme.bold("Loaded")),
		...data.loadedLines.map((line) => theme.fg("success", ` ${line}`)),
	];

	const rowCount = Math.max(leftRows.length, rightRows.length);
	const lines: string[] = [""];
	for (let i = 0; i < rowCount; i++) {
		const left = padLine(leftRows[i] ?? "", leftWidth);
		const right = truncateToWidth(rightRows[i] ?? "", rightWidth, "…");
		lines.push(left + gap + right);
	}
	lines.push("");
	return lines;
}

export function registerWelcomeHeader(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		const settings = loadUiEnhancementsSettings(ctx.cwd);
		if (!settings.welcomeHeader || !ctx.hasUI || ctx.mode !== "tui") return;

		const model = getModelDisplay(ctx);
		const data: WelcomeHeaderData = {
			modelName: model.modelName,
			providerName: model.providerName,
			tips: buildWelcomeTips(settings.showExpandHint),
			loadedLines: buildLoadedLines(getLoadedCounts(pi)),
		};

		ctx.ui.setHeader((_tui, theme) => ({
			invalidate() {},
			render(width: number): string[] {
				if (width < 44) {
					return renderStacked(data, theme, width);
				}
				return renderTwoColumn(data, theme, width);
			},
		}));
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (!ctx.hasUI || ctx.mode !== "tui") return;
		const settings = loadUiEnhancementsSettings(ctx.cwd);
		if (!settings.welcomeHeader) return;
		ctx.ui.setHeader(undefined);
	});

	pi.registerCommand("builtin-header", {
		description: "Restore Pi built-in header with keybinding hints",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in header restored", "info");
		},
	});
}
