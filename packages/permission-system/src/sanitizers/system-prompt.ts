export interface SanitizeSystemPromptResult {
	prompt: string;
	removed: boolean;
}

type LineSection = { start: number; end: number };

type GuidelineRule = {
	matches: (guideline: string) => boolean;
	shouldKeep: (allowedTools: ReadonlySet<string>) => boolean;
};

const AVAILABLE_TOOLS_SECTION_HEADER = "Available tools:";
const GUIDELINES_SECTION_HEADER = "Guidelines:";

const TOOL_GUIDELINE_RULES: readonly GuidelineRule[] = [
	{
		matches: (g) => g === "use bash for file operations like ls, rg, find",
		shouldKeep: (tools) => tools.has("bash"),
	},
	{
		matches: (g) =>
			g ===
			"prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)",
		shouldKeep: (tools) =>
			tools.has("bash") &&
			(tools.has("grep") || tools.has("find") || tools.has("ls")),
	},
	{
		matches: (g) =>
			g ===
				"use read to examine files before editing. you must use this tool instead of cat or sed." ||
			g === "use read to examine files instead of cat or sed.",
		shouldKeep: (tools) => tools.has("read"),
	},
	{
		matches: (g) =>
			g === "use edit for precise changes (old text must match exactly)",
		shouldKeep: (tools) => tools.has("edit"),
	},
	{
		matches: (g) => g === "use write only for new files or complete rewrites",
		shouldKeep: (tools) => tools.has("write"),
	},
	{
		matches: (g) =>
			g ===
			"when summarizing your actions, output plain text directly - do not use cat or bash to display what you did",
		shouldKeep: (tools) => tools.has("edit") || tools.has("write"),
	},
	{
		matches: (g) =>
			g ===
			"use task when work should be delegated to one or more specialized agents instead of handled entirely in the current session.",
		shouldKeep: (tools) => tools.has("task"),
	},
	{
		matches: (g) =>
			g ===
			"use mcp for mcp discovery first: search by capability, describe one exact tool name, then call it.",
		shouldKeep: (tools) => tools.has("mcp"),
	},
];

function normalizePrompt(prompt: string): string {
	return (prompt || "").replace(/\r\n/g, "\n");
}

function collapseExtraBlankLines(text: string): string {
	return text.replace(/\n{3,}/g, "\n\n").trimEnd();
}

function normalizeGuidelineText(line: string): string {
	return line
		.trim()
		.replace(/^[-*]\s+/, "")
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function isTopLevelSectionHeader(line: string): boolean {
	const trimmed = line.trim();
	return (
		trimmed.length > 0 && trimmed.endsWith(":") && !trimmed.startsWith("-")
	);
}

function isSectionBodyLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return true;
	if (trimmed.startsWith("- ")) return true;
	return line !== line.trimStart();
}

function findSection(
	lines: readonly string[],
	header: string,
): LineSection | null {
	const start = lines.findIndex((line) => line.trim() === header);
	if (start === -1) return null;

	for (let index = start + 1; index < lines.length; index += 1) {
		if (isTopLevelSectionHeader(lines[index])) {
			return { start, end: index };
		}
	}

	let end = start + 1;
	for (let index = start + 1; index < lines.length; index += 1) {
		if (!isSectionBodyLine(lines[index])) {
			end = index;
			break;
		}
		end = index + 1;
	}
	return { start, end };
}

function extractToolBulletName(line: string): string | null {
	const match = /^\s*-\s+([A-Za-z0-9_-]+)/.exec(line);
	return match ? match[1] : null;
}

function narrowAvailableToolsSection(
	lines: readonly string[],
	allowedTools: ReadonlySet<string>,
): { lines: string[]; removed: boolean } {
	const section = findSection(lines, AVAILABLE_TOOLS_SECTION_HEADER);
	if (!section) return { lines: [...lines], removed: false };

	const before = lines.slice(0, section.start);
	const header = lines[section.start];
	const body = lines.slice(section.start + 1, section.end);
	const after = lines.slice(section.end);

	const filteredBody = body.filter((line) => {
		const toolName = extractToolBulletName(line);
		if (!toolName) return true;
		return allowedTools.has(toolName);
	});

	const removed = filteredBody.length !== body.length;
	if (!removed) return { lines: [...lines], removed: false };

	const hasToolBullet = filteredBody.some(
		(line) => extractToolBulletName(line) !== null,
	);
	if (!hasToolBullet) return { lines: [...before, ...after], removed: true };

	return {
		lines: [...before, header, ...filteredBody, ...after],
		removed: true,
	};
}

function shouldKeepGuideline(
	line: string,
	allowedTools: ReadonlySet<string>,
): boolean {
	const normalized = normalizeGuidelineText(line);
	for (const rule of TOOL_GUIDELINE_RULES) {
		if (rule.matches(normalized)) return rule.shouldKeep(allowedTools);
	}
	return true;
}

function sanitizeGuidelinesSection(
	lines: readonly string[],
	allowedTools: ReadonlySet<string>,
): { lines: string[]; removed: boolean } {
	const section = findSection(lines, GUIDELINES_SECTION_HEADER);
	if (!section) return { lines: [...lines], removed: false };

	const before = lines.slice(0, section.start + 1);
	const after = lines.slice(section.end);
	const body = lines.slice(section.start + 1, section.end);
	const filteredBody = body.filter((line) => {
		const trimmed = line.trim();
		if (!trimmed.startsWith("- ")) return true;
		return shouldKeepGuideline(line, allowedTools);
	});

	const removed = filteredBody.length !== body.length;
	if (!removed) return { lines: [...lines], removed: false };

	const hasBullet = filteredBody.some((line) => line.trim().startsWith("- "));
	if (!hasBullet) {
		return {
			lines: [...lines.slice(0, section.start), ...after],
			removed: true,
		};
	}

	return { lines: [...before, ...filteredBody, ...after], removed: true };
}

export function sanitizeAvailableToolsSection(
	systemPrompt: string,
	allowedToolNames: readonly string[],
): SanitizeSystemPromptResult {
	const allowedTools = new Set(
		allowedToolNames.map((toolName) => toolName.trim()).filter(Boolean),
	);
	const normalizedLines = normalizePrompt(systemPrompt).split("\n");
	const narrowedToolsSection = narrowAvailableToolsSection(
		normalizedLines,
		allowedTools,
	);
	const sanitizedGuidelines = sanitizeGuidelinesSection(
		narrowedToolsSection.lines,
		allowedTools,
	);
	const removed = narrowedToolsSection.removed || sanitizedGuidelines.removed;

	return {
		prompt: removed
			? collapseExtraBlankLines(sanitizedGuidelines.lines.join("\n"))
			: systemPrompt,
		removed,
	};
}
