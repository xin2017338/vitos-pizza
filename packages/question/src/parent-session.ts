export const SUBAGENT_CHILD_ENV = "PI_SUBAGENT_CHILD";

export const SUBAGENT_PARENT_SESSION_ENV_CANDIDATES = [
	"PI_AGENT_ROUTER_PARENT_SESSION_ID",
	"PI_SUBAGENT_PARENT_SESSION",
] as const;

export function isSubagentChild(): boolean {
	return process.env[SUBAGENT_CHILD_ENV] === "1";
}

export function resolveParentSessionId(): string | null {
	for (const key of SUBAGENT_PARENT_SESSION_ENV_CANDIDATES) {
		const value = process.env[key]?.trim();
		if (value) return value;
	}
	return null;
}
