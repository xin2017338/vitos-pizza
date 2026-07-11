import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runGatePipeline } from "../src/gates/pipeline.ts";
import {
	findProjectRoot,
	isExternalPath,
	isPathWithinRoot,
} from "../src/gates/path-utils.ts";
import { PermissionEvaluator } from "../src/permission-evaluator.ts";

describe("path-utils project root", () => {
	it("treats sibling packages inside the git repo as in-project", () => {
		const repo = mkdtempSync(join(tmpdir(), "perm-repo-"));
		mkdirSync(join(repo, ".git"));
		const pkgA = join(repo, "packages", "a");
		const pkgB = join(repo, "packages", "b", "file.ts");
		mkdirSync(pkgA, { recursive: true });
		mkdirSync(join(repo, "packages", "b"), { recursive: true });
		writeFileSync(pkgB, "export {}\n", "utf8");

		expect(findProjectRoot(pkgA)).toBe(repo);
		expect(isExternalPath(pkgB, pkgA)).toBe(false);
		expect(isPathWithinRoot(pkgB, repo)).toBe(true);
	});

	it("still treats paths outside the git repo as external", () => {
		const repo = mkdtempSync(join(tmpdir(), "perm-repo-"));
		mkdirSync(join(repo, ".git"));
		expect(isExternalPath("/etc/hosts", repo)).toBe(true);
	});
});

describe("gate pipeline in-project reads", () => {
	const evaluator = new PermissionEvaluator();
	const permission = {
		"*": "allow" as const,
		read: "allow" as const,
		path: {
			"*": "allow" as const,
			"*.env": "deny" as const,
		},
		external_directory: "ask" as const,
	};

	it("allows reading another package in the same repo without asking", () => {
		const repo = mkdtempSync(join(tmpdir(), "perm-gate-repo-"));
		mkdirSync(join(repo, ".git"));
		const cwd = join(repo, "packages", "a");
		const target = join(repo, "packages", "b", "file.ts");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(join(repo, "packages", "b"), { recursive: true });
		writeFileSync(target, "export {}\n", "utf8");

		const result = runGatePipeline(
			permission,
			evaluator,
			{
				toolName: "read",
				input: { path: target },
				cwd,
			},
			{ registeredTools: new Set(["read"]) },
		);
		expect(result.state).toBe("allow");
	});
});
