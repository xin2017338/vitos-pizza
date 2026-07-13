import type { GitContext, ShipMode } from "./types.ts";

export function buildCommitTask(mode: ShipMode, context: GitContext): string {
	if (mode === "bcp") {
		return [
			"Mode: bcp (suggest a new branch name and a commit message).",
			"Output exactly two lines in this format (no other text):",
			"BRANCH: <branch-name>",
			"MESSAGE: <commit-message>",
			"",
			`Current branch: ${context.branch ?? "(detached)"}`,
			"",
			"git status --porcelain:",
			context.status,
			"",
			"Recent commits:",
			context.log,
			"",
			"Diff:",
			context.diff,
		].join("\n");
	}

	return [
		"Mode: cp (commit message only).",
		"Output only the commit message text — no BRANCH line, no quotes, no markdown.",
		"",
		`Current branch: ${context.branch ?? "(detached)"}`,
		"",
		"git status --porcelain:",
		context.status,
		"",
		"Recent commits:",
		context.log,
		"",
		"Diff:",
		context.diff,
	].join("\n");
}

export const COMMIT_SYSTEM_PROMPT = `You write concise git commit messages (and optional branch names) from status, diff, and recent log.

Rules:
- Focus on why the change exists, not a file laundry list.
- Prefer 1–2 short sentences (or a conventional short subject line).
- Match the language and style of the recent commit log when clear.
- Do not wrap the message in quotes or markdown fences.
- Never suggest force-push, amending published history, or changing git config.
- For branch names: lowercase, use / or - separators, no spaces, keep short and descriptive.`;
