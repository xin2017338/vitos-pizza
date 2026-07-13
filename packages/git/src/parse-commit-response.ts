import type { CommitMeta, ShipMode } from "./types.ts";

const BRANCH_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;

function cleanMessage(raw: string): string {
	return raw
		.trim()
		.replace(/^["'`]+|["'`]+$/g, "")
		.replace(/^MESSAGE:\s*/i, "")
		.trim();
}

function cleanBranch(raw: string): string | null {
	const branch = raw
		.trim()
		.replace(/^["'`]+|["'`]+$/g, "")
		.replace(/^BRANCH:\s*/i, "")
		.trim();
	if (!branch || !BRANCH_RE.test(branch) || branch.includes("..")) {
		return null;
	}
	return branch;
}

export function parseCommitResponse(
	raw: string,
	mode: ShipMode,
): CommitMeta | null {
	const text = raw.trim();
	if (!text) return null;

	if (mode === "cp") {
		const message = cleanMessage(
			text
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.join("\n"),
		);
		return message ? { message } : null;
	}

	let branch: string | undefined;
	let message: string | undefined;

	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const branchMatch = /^BRANCH:\s*(.+)$/i.exec(trimmed);
		if (branchMatch) {
			branch = cleanBranch(branchMatch[1] ?? "") ?? undefined;
			continue;
		}
		const messageMatch = /^MESSAGE:\s*(.+)$/i.exec(trimmed);
		if (messageMatch) {
			message = cleanMessage(messageMatch[1] ?? "");
		}
	}

	if (!branch || !message) {
		// Fallback: first non-empty line = branch, rest = message
		const lines = text
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		if (!branch && lines[0]) branch = cleanBranch(lines[0]) ?? undefined;
		if (!message && lines.length > 1) {
			message = cleanMessage(lines.slice(1).join("\n"));
		}
	}

	if (!branch || !message) return null;
	return { branch, message };
}
