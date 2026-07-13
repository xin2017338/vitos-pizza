import { describe, expect, it } from "vitest";
import { collectGitContext } from "../src/collect-git-context.ts";
import type { GitExec } from "../src/types.ts";

function mockExec(
	responses: Record<
		string,
		{ stdout?: string; stderr?: string; code?: number }
	>,
): GitExec {
	return async (args) => {
		const key = args.join(" ");
		const hit = responses[key];
		if (!hit) {
			return { stdout: "", stderr: `unexpected: ${key}`, code: 1 };
		}
		return {
			stdout: hit.stdout ?? "",
			stderr: hit.stderr ?? "",
			code: hit.code ?? 0,
		};
	};
}

describe("collectGitContext", () => {
	it("rejects when not a git repo", async () => {
		const result = await collectGitContext(
			mockExec({
				"rev-parse --is-inside-work-tree": { stdout: "false\n", code: 0 },
			}),
			"/tmp",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/Not a git repository/);
	});

	it("rejects empty working tree", async () => {
		const result = await collectGitContext(
			mockExec({
				"rev-parse --is-inside-work-tree": { stdout: "true\n" },
				"status --porcelain": { stdout: "" },
				diff: { stdout: "" },
				"diff --cached": { stdout: "" },
				"log -5 --oneline": { stdout: "abc init\n" },
				"branch --show-current": { stdout: "main\n" },
			}),
			"/tmp",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/No changes/);
	});

	it("rejects secret paths", async () => {
		const result = await collectGitContext(
			mockExec({
				"rev-parse --is-inside-work-tree": { stdout: "true\n" },
				"status --porcelain": { stdout: "?? .env\n M src/a.ts\n" },
				diff: { stdout: "diff\n" },
				"diff --cached": { stdout: "" },
				"log -5 --oneline": { stdout: "abc init\n" },
				"branch --show-current": { stdout: "main\n" },
			}),
			"/tmp",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/\.env/);
	});

	it("returns context for dirty tree", async () => {
		const result = await collectGitContext(
			mockExec({
				"rev-parse --is-inside-work-tree": { stdout: "true\n" },
				"status --porcelain": { stdout: " M src/a.ts\n" },
				diff: { stdout: "diff --git a/src/a.ts\n" },
				"diff --cached": { stdout: "" },
				"log -5 --oneline": { stdout: "abc init\n" },
				"branch --show-current": { stdout: "main\n" },
			}),
			"/tmp",
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.context.files).toEqual(["src/a.ts"]);
			expect(result.context.branch).toBe("main");
		}
	});
});
