import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	getGlobalAgentsDir,
	getGlobalConfigPath,
	getProjectAgentsDir,
	getProjectConfigPath,
} from "./config-paths.ts";
import type {
	ExtensionConfig,
	FlatPermissionConfig,
	PatternMap,
	PatternValue,
} from "./types.ts";
import { isDenyWithReason, isPermissionState } from "./types.ts";
import { parseAgentFrontmatterPermission } from "./yaml-frontmatter.ts";

function stripJsonComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

function toRecord(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, unknown>;
}

function isPatternMap(value: PatternValue): value is PatternMap {
	return typeof value === "object" && value !== null && !("action" in value);
}

function normalizePermissionValue(value: unknown): PatternValue | undefined {
	if (isPermissionState(value)) return value;
	if (isDenyWithReason(value)) return value;
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		const nested: PatternMap = {};
		for (const [key, nestedValue] of Object.entries(value)) {
			const normalized = normalizePermissionValue(nestedValue);
			if (normalized !== undefined) nested[key] = normalized;
		}
		return Object.keys(nested).length > 0 ? nested : undefined;
	}
	return undefined;
}

function normalizePermissionConfig(raw: unknown): FlatPermissionConfig {
	const record = toRecord(raw);
	const result: FlatPermissionConfig = {};
	for (const [key, value] of Object.entries(record)) {
		const normalized = normalizePermissionValue(value);
		if (normalized !== undefined) result[key] = normalized;
	}
	return result;
}

export function loadConfigFile(path: string): ExtensionConfig {
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(stripJsonComments(raw)) as unknown;
		const record = toRecord(parsed);
		const agentMode = record.agentMode;
		const normalizedAgentMode =
			agentMode === "agent" ||
			agentMode === "plan" ||
			agentMode === "execute"
				? agentMode
				: undefined;
		return {
			yoloMode: record.yoloMode === true,
			debug: record.debug === true,
			agentMode: normalizedAgentMode,
			permission: normalizePermissionConfig(record.permission),
		};
	} catch {
		return { permission: { "*": "ask" } };
	}
}

export function saveConfigFile(path: string, config: ExtensionConfig): void {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, `${JSON.stringify(config, null, "\t")}\n`, "utf8");
}

function getFileStamp(path: string): string {
	try {
		return existsSync(path) ? String(statSync(path).mtimeMs) : "missing";
	} catch {
		return "missing";
	}
}

function findAgentFile(dir: string, agentName: string): string | null {
	const candidates = [`${agentName}.md`, `${agentName}.agent.md`];
	for (const name of candidates) {
		const path = join(dir, name);
		if (existsSync(path)) return path;
	}
	return null;
}

export interface LoadedPolicy {
	config: ExtensionConfig;
	agentPermission?: FlatPermissionConfig;
}

export class PolicyLoader {
	private readonly agentDir: string;
	private cwd: string | null = null;
	private cacheStamp = "";
	private cached: LoadedPolicy | null = null;

	constructor(agentDir: string) {
		this.agentDir = agentDir;
	}

	setCwd(cwd: string): void {
		this.cwd = cwd;
		this.cached = null;
	}

	load(agentName?: string): LoadedPolicy {
		const stamp = [
			getFileStamp(getGlobalConfigPath(this.agentDir)),
			this.cwd ? getFileStamp(getProjectConfigPath(this.cwd)) : "no-cwd",
			agentName ?? "no-agent",
		].join("|");
		if (this.cached && this.cacheStamp === stamp) {
			return this.cached;
		}

		const global = loadConfigFile(getGlobalConfigPath(this.agentDir));
		const project =
			this.cwd && existsSync(getProjectConfigPath(this.cwd))
				? loadConfigFile(getProjectConfigPath(this.cwd))
				: { permission: {} };

		const mergedPermission = mergePermissionMaps(
			global.permission ?? {},
			project.permission ?? {},
		);

		let agentPermission: FlatPermissionConfig | undefined;
		if (agentName) {
			const globalAgentDir = getGlobalAgentsDir(this.agentDir);
			const projectAgentDir = this.cwd ? getProjectAgentsDir(this.cwd) : null;
			const globalAgentPath = findAgentFile(globalAgentDir, agentName);
			const projectAgentPath = projectAgentDir
				? findAgentFile(projectAgentDir, agentName)
				: null;
			const globalAgentPerm = globalAgentPath
				? loadAgentPermission(globalAgentPath)
				: {};
			const projectAgentPerm = projectAgentPath
				? loadAgentPermission(projectAgentPath)
				: {};
			agentPermission = mergePermissionMaps(globalAgentPerm, projectAgentPerm);
			Object.assign(
				mergedPermission,
				mergePermissionMaps(mergedPermission, agentPermission),
			);
		}

		const config: ExtensionConfig = {
			yoloMode: project.yoloMode ?? global.yoloMode ?? false,
			debug: project.debug ?? global.debug ?? false,
			agentMode: project.agentMode ?? global.agentMode,
			permission: mergedPermission,
		};

		this.cacheStamp = stamp;
		this.cached = { config, agentPermission };
		return this.cached;
	}
}

function loadAgentPermission(path: string): FlatPermissionConfig {
	try {
		const content = readFileSync(path, "utf8");
		const permission = parseAgentFrontmatterPermission(content);
		return permission ? normalizePermissionConfig(permission) : {};
	} catch {
		return {};
	}
}

export function mergePermissionMaps(
	base: FlatPermissionConfig,
	override: FlatPermissionConfig,
): FlatPermissionConfig {
	const result: FlatPermissionConfig = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const existing = result[key];
		if (
			existing !== undefined &&
			isPatternMap(existing) &&
			isPatternMap(value)
		) {
			result[key] = mergePermissionMaps(existing, value);
		} else {
			result[key] = value;
		}
	}
	return result;
}
