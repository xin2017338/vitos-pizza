import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommitMeta, GitExec, ShipMode } from "./types.ts";

async function writeCommitMessageFile(
	message: string,
): Promise<{ path: string; cleanup: () => void }> {
	const dir = mkdtempSync(join(tmpdir(), "vitos-git-"));
	const path = join(dir, "COMMIT_EDITMSG");
	writeFileSync(path, `${message.trim()}\n`, "utf8");
	return {
		path,
		cleanup: () => {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				/* ignore */
			}
		},
	};
}

async function hasUpstream(exec: GitExec, cwd: string): Promise<boolean> {
	const result = await exec(
		["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
		{ cwd },
	);
	return result.code === 0 && result.stdout.trim().length > 0;
}

export async function runShip(input: {
	mode: ShipMode;
	cwd: string;
	exec: GitExec;
	meta: CommitMeta;
}): Promise<{ ok: true; summary: string } | { ok: false; reason: string }> {
	const { mode, cwd, exec, meta } = input;

	if (mode === "bcp") {
		const branch = meta.branch?.trim();
		if (!branch) {
			return { ok: false, reason: "Missing branch name." };
		}
		const checkout = await exec(["checkout", "-b", branch], { cwd });
		if (checkout.code !== 0) {
			return {
				ok: false,
				reason:
					checkout.stderr.trim() ||
					checkout.stdout.trim() ||
					`Failed to create branch ${branch}.`,
			};
		}
	}

	const add = await exec(["add", "-A"], { cwd });
	if (add.code !== 0) {
		return {
			ok: false,
			reason: add.stderr.trim() || "git add failed.",
		};
	}

	const msgFile = await writeCommitMessageFile(meta.message);
	try {
		const commit = await exec(["commit", "-F", msgFile.path], { cwd });
		if (commit.code !== 0) {
			return {
				ok: false,
				reason:
					commit.stderr.trim() || commit.stdout.trim() || "git commit failed.",
			};
		}
	} finally {
		msgFile.cleanup();
	}

	if (mode === "bcp") {
		const branch = meta.branch?.trim();
		if (!branch) {
			return { ok: false, reason: "Missing branch name after commit." };
		}
		const push = await exec(["push", "-u", "origin", branch], { cwd });
		if (push.code !== 0) {
			return {
				ok: false,
				reason:
					push.stderr.trim() ||
					push.stdout.trim() ||
					`git push -u origin ${branch} failed.`,
			};
		}
		return {
			ok: true,
			summary: `Created ${branch}, committed, and pushed to origin/${branch}.`,
		};
	}

	const upstream = await hasUpstream(exec, cwd);
	const push = upstream
		? await exec(["push"], { cwd })
		: await exec(["push", "-u", "origin", "HEAD"], { cwd });
	if (push.code !== 0) {
		return {
			ok: false,
			reason: push.stderr.trim() || push.stdout.trim() || "git push failed.",
		};
	}

	return {
		ok: true,
		summary: upstream
			? "Committed and pushed."
			: "Committed and pushed (set upstream to origin/HEAD).",
	};
}
