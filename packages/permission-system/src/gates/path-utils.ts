import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { expandHomePath } from "../expand-home.ts";

export function normalizePathValue(pathValue: string, cwd: string): string {
	const expanded = expandHomePath(pathValue.trim());
	if (!expanded) return expanded;
	return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

export function findProjectRoot(cwd: string): string {
	let dir = resolve(cwd);
	while (true) {
		if (existsSync(resolve(dir, ".git"))) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return resolve(cwd);
}

export function isPathWithinRoot(normalizedPath: string, root: string): boolean {
	const resolvedRoot = resolve(root);
	const resolvedPath = resolve(normalizedPath);
	if (resolvedPath === resolvedRoot) return true;
	const rel = relative(resolvedRoot, resolvedPath);
	return !rel.startsWith("..") && !isAbsolute(rel);
}

export function isExternalPath(pathValue: string, cwd: string): boolean {
	const normalized = normalizePathValue(pathValue, cwd);
	const projectRoot = findProjectRoot(cwd);
	return !isPathWithinRoot(normalized, projectRoot);
}
export function extractPathFromToolInput(
	toolName: string,
	input: Record<string, unknown>,
): string | null {
	if (typeof input.path === "string") return input.path;
	if (toolName === "bash" && typeof input.command === "string") {
		return input.command;
	}
	if (toolName === "mcp") {
		const args = input.arguments;
		if (
			typeof args === "object" &&
			args !== null &&
			typeof (args as { path?: string }).path === "string"
		) {
			return (args as { path: string }).path;
		}
	}
	return null;
}

export function extractMcpTarget(
	input: Record<string, unknown>,
): string | null {
	if (typeof input.server === "string" && typeof input.tool === "string") {
		return `${input.server}/${input.tool}`;
	}
	if (typeof input.tool === "string") return input.tool;
	return null;
}
