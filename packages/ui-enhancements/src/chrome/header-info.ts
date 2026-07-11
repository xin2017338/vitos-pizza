import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";

export interface LoadedCounts {
	extensions: number;
	skills: number;
	promptTemplates: number;
}

export interface ModelDisplay {
	modelName: string;
	providerName: string;
}

const BUILTIN_TOOL_SOURCE = "@earendil-works/pi-coding-agent";

export function getModelDisplay(ctx: ExtensionContext): ModelDisplay {
	const model = ctx.model;
	return {
		modelName: model?.id ?? "no model",
		providerName: model?.provider ?? "",
	};
}

export function getLoadedCounts(pi: ExtensionAPI): LoadedCounts {
	const commands = pi.getCommands();
	const skills = commands.filter(
		(command) => command.source === "skill",
	).length;
	const promptTemplates = commands.filter(
		(command) => command.source === "prompt",
	).length;

	const extensionSources = new Set<string>();
	for (const tool of pi.getAllTools()) {
		const source = tool.sourceInfo?.source;
		if (!source || source === BUILTIN_TOOL_SOURCE) continue;
		extensionSources.add(source);
	}

	return {
		extensions: extensionSources.size,
		skills,
		promptTemplates,
	};
}

export function buildWelcomeTips(showExpandHint: boolean): string[] {
	const tips = [`/ for commands`];
	if (showExpandHint) {
		tips.push(keyHint("app.tools.expand", "expand"));
	}
	tips.push(keyHint("app.thinking.cycle", "cycle thinking"));
	return tips;
}

export function buildLoadedLines(counts: LoadedCounts): string[] {
	return [
		`✓ ${counts.extensions} extension${counts.extensions === 1 ? "" : "s"}`,
		`✓ ${counts.skills} skill${counts.skills === 1 ? "" : "s"}`,
		`✓ ${counts.promptTemplates} prompt template${counts.promptTemplates === 1 ? "" : "s"}`,
	];
}
