import { join } from "node:path";

export const EXTENSION_ID = "pi-permission-system";

export function getGlobalConfigDir(agentDir: string): string {
	return join(agentDir, "extensions", EXTENSION_ID);
}

export function getGlobalConfigPath(agentDir: string): string {
	return join(getGlobalConfigDir(agentDir), "config.json");
}

export function getProjectConfigPath(cwd: string): string {
	return join(cwd, ".pi", "extensions", EXTENSION_ID, "config.json");
}

export function getGlobalAgentsDir(agentDir: string): string {
	return join(agentDir, "agents");
}

export function getProjectAgentsDir(cwd: string): string {
	return join(cwd, ".pi", "agents");
}
