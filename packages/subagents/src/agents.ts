import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
	CONFIG_DIR_NAME,
	getAgentDir,
	parseFrontmatter,
} from "@earendil-works/pi-coding-agent";
import type { AgentScope } from "./types.ts";

export interface AgentConfig {
	name: string;
	description: string;
	tools?: string[];
	model?: string;
	thinking?: string;
	systemPromptMode?: "append" | "replace";
	systemPrompt: string;
	source: "builtin" | "user" | "project";
	filePath: string;
}

export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	projectAgentsDir: string | null;
	builtinAgentsDir: string;
}

const THINKING_LEVELS = new Set([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);

/** Internal agents (e.g. session naming) — callable by name, not listed to the main agent. */
const INTERNAL_AGENT_NAMES = new Set(["title"]);

export function isPublicAgent(name: string): boolean {
	return !INTERNAL_AGENT_NAMES.has(name);
}

export function formatAvailableAgents(
	agents: Array<{ name: string; source: string }>,
): string {
	const visible = agents.filter((agent) => isPublicAgent(agent.name));
	return (
		visible.map((agent) => `${agent.name} (${agent.source})`).join(", ") ||
		"none"
	);
}

export function getBuiltinAgentsDir(): string {
	return path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
		"agents",
	);
}

function loadAgentsFromDir(
	dir: string,
	source: AgentConfig["source"],
): AgentConfig[] {
	if (!fs.existsSync(dir)) return [];

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const agents: AgentConfig[] = [];
	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(
			content,
		);
		if (!frontmatter.name || !frontmatter.description) continue;

		const tools = frontmatter.tools
			?.split(",")
			.map((tool) => tool.trim())
			.filter(Boolean);

		const systemPromptMode =
			frontmatter.systemPromptMode === "append" ? "append" : "replace";

		agents.push({
			name: frontmatter.name,
			description: frontmatter.description,
			tools: tools && tools.length > 0 ? tools : undefined,
			model: frontmatter.model,
			thinking: frontmatter.thinking,
			systemPromptMode,
			systemPrompt: body,
			source,
			filePath,
		});
	}

	return agents;
}

function isDirectory(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isDirectory();
	} catch {
		return false;
	}
}

function findNearestProjectAgentsDir(cwd: string): string | null {
	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, CONFIG_DIR_NAME, "agents");
		if (isDirectory(candidate)) return candidate;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

export function applyThinkingSuffix(
	model: string | undefined,
	thinking: string | undefined,
): string | undefined {
	if (!model || !thinking) return model;
	const colonIdx = model.lastIndexOf(":");
	if (
		colonIdx !== -1 &&
		THINKING_LEVELS.has(model.substring(colonIdx + 1))
	) {
		return `${model.slice(0, colonIdx)}:${thinking}`;
	}
	return `${model}:${thinking}`;
}

export function discoverAgents(
	cwd: string,
	scope: AgentScope = "both",
): AgentDiscoveryResult {
	const builtinAgentsDir = getBuiltinAgentsDir();
	const userDir = path.join(getAgentDir(), "agents");
	const projectAgentsDir = findNearestProjectAgentsDir(cwd);

	const builtinAgents = loadAgentsFromDir(builtinAgentsDir, "builtin");
	const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
	const projectAgents =
		scope === "user" || !projectAgentsDir
			? []
			: loadAgentsFromDir(projectAgentsDir, "project");

	const agentMap = new Map<string, AgentConfig>();
	for (const agent of builtinAgents) agentMap.set(agent.name, agent);
	if (scope === "both" || scope === "user") {
		for (const agent of userAgents) agentMap.set(agent.name, agent);
	}
	if (scope === "both" || scope === "project") {
		for (const agent of projectAgents) agentMap.set(agent.name, agent);
	}

	return {
		agents: Array.from(agentMap.values()),
		projectAgentsDir,
		builtinAgentsDir,
	};
}
