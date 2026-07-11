import type { GateContext } from "../types.ts";

export function buildApprovalSummary(ctx: GateContext): string {
	const { toolName, input } = ctx;

	if (toolName === "bash" && typeof input.command === "string") {
		return `Run bash command:\n${input.command}`;
	}

	if (
		(toolName === "read" ||
			toolName === "write" ||
			toolName === "edit" ||
			toolName === "grep" ||
			toolName === "find" ||
			toolName === "ls") &&
		typeof input.path === "string"
	) {
		return `${toolName} ${input.path}`;
	}

	if (toolName === "mcp") {
		const server =
			typeof input.server === "string" ? input.server : "unknown-server";
		const tool = typeof input.tool === "string" ? input.tool : "unknown-tool";
		return `MCP ${server}/${tool}`;
	}

	if (toolName === "edit" && typeof input.old_string === "string") {
		const lines = input.old_string.split("\n").length;
		return `edit (${lines} line${lines === 1 ? "" : "s"})`;
	}

	const preview = JSON.stringify(input, null, 2);
	if (preview.length > 400) {
		return `${toolName}: ${preview.slice(0, 400)}…`;
	}
	return `${toolName}: ${preview}`;
}

export function buildApprovalTitle(toolName: string): string {
	return `Allow ${toolName}?`;
}
