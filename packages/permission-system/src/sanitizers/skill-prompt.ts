import type { PermissionEvaluator } from "../permission-evaluator.ts";
import type { FlatPermissionConfig } from "../types.ts";

export interface SkillPromptEntry {
	name: string;
	start: number;
	end: number;
}

export function findSkillBlocks(prompt: string): SkillPromptEntry[] {
	const lines = prompt.replace(/\r\n/g, "\n").split("\n");
	const entries: SkillPromptEntry[] = [];
	let current: SkillPromptEntry | null = null;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const match = /^## Skill:\s*(.+)$/.exec(line.trim());
		if (match) {
			if (current) {
				current.end = index;
				entries.push(current);
			}
			current = { name: match[1].trim(), start: index, end: lines.length };
			continue;
		}
		if (/^## /.test(line.trim()) && current) {
			current.end = index;
			entries.push(current);
			current = null;
		}
	}

	if (current) entries.push(current);
	return entries;
}

export function sanitizeSkillPromptBlocks(
	prompt: string,
	permission: FlatPermissionConfig,
	evaluator: PermissionEvaluator,
	options: { yoloMode?: boolean; agentName?: string },
): { prompt: string; entries: SkillPromptEntry[] } {
	const blocks = findSkillBlocks(prompt);
	if (blocks.length === 0) return { prompt, entries: [] };

	const lines = prompt.replace(/\r\n/g, "\n").split("\n");
	const deniedRanges: Array<{ start: number; end: number }> = [];
	const allowedEntries: SkillPromptEntry[] = [];

	for (const block of blocks) {
		const result = evaluator.evaluateSurface(
			permission,
			"skill",
			block.name,
			"project",
			{ yoloMode: options.yoloMode },
		);
		if (result.state === "deny") {
			deniedRanges.push({ start: block.start, end: block.end });
		} else {
			allowedEntries.push(block);
		}
	}

	if (deniedRanges.length === 0) {
		return { prompt, entries: allowedEntries };
	}

	const keepLine = new Array(lines.length).fill(true);
	for (const range of deniedRanges) {
		for (let index = range.start; index < range.end; index += 1) {
			keepLine[index] = false;
		}
	}

	const filtered = lines.filter((_line, index) => keepLine[index]);
	return {
		prompt: filtered
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trimEnd(),
		entries: allowedEntries,
	};
}

export function inferSkillNameFromPath(
	filePath: string,
	skillDirs: readonly string[],
): string | null {
	const normalized = filePath.replace(/\\/g, "/");
	for (const dir of skillDirs) {
		const normalizedDir = dir.replace(/\\/g, "/").replace(/\/$/, "");
		if (!normalized.startsWith(`${normalizedDir}/`)) continue;
		const remainder = normalized.slice(normalizedDir.length + 1);
		const skillName = remainder.split("/")[0];
		return skillName || null;
	}
	return null;
}
