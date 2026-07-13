import {
	findSecretPaths,
	parsePorcelainFiles,
	truncateText,
} from "./safety.ts";
import type { GitContext, GitExec } from "./types.ts";

const DIFF_MAX_CHARS = 14_000;

export async function collectGitContext(
	exec: GitExec,
	cwd: string,
): Promise<{ ok: true; context: GitContext } | { ok: false; reason: string }> {
	const rev = await exec(["rev-parse", "--is-inside-work-tree"], { cwd });
	if (rev.code !== 0 || rev.stdout.trim() !== "true") {
		return { ok: false, reason: "Not a git repository." };
	}

	const [statusResult, unstaged, staged, logResult, branchResult] =
		await Promise.all([
			exec(["status", "--porcelain"], { cwd }),
			exec(["diff"], { cwd }),
			exec(["diff", "--cached"], { cwd }),
			exec(["log", "-5", "--oneline"], { cwd }),
			exec(["branch", "--show-current"], { cwd }),
		]);

	if (statusResult.code !== 0) {
		return {
			ok: false,
			reason: statusResult.stderr.trim() || "git status failed.",
		};
	}

	const status = statusResult.stdout;
	const files = parsePorcelainFiles(status);
	if (files.length === 0) {
		return { ok: false, reason: "No changes to commit." };
	}

	const secrets = findSecretPaths(files);
	if (secrets.length > 0) {
		return {
			ok: false,
			reason: `Refusing to ship — possible secret files:\n${secrets.map((f) => `  - ${f}`).join("\n")}`,
		};
	}

	const combinedDiff = [staged.stdout, unstaged.stdout]
		.filter((part) => part.trim().length > 0)
		.join("\n");

	return {
		ok: true,
		context: {
			status,
			diff: truncateText(
				combinedDiff || "(no diff text — maybe binary/new files only)",
				DIFF_MAX_CHARS,
			),
			log: logResult.stdout.trim() || "(no commits yet)",
			files,
			branch:
				branchResult.code === 0 && branchResult.stdout.trim()
					? branchResult.stdout.trim()
					: undefined,
		},
	};
}
