import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { selectAllowedToolNames } from "../src/handlers/before-agent-start.ts";
import { PermissionEvaluator } from "../src/permission-evaluator.ts";
import type { FlatPermissionConfig } from "../src/types.ts";

const presetsDir = join(dirname(fileURLToPath(import.meta.url)), "../presets");

function loadPresetPermission(name: string): FlatPermissionConfig {
	const raw = JSON.parse(
		readFileSync(join(presetsDir, `${name}.json`), "utf8"),
	) as { permission: FlatPermissionConfig };
	return raw.permission;
}

const ALL_TOOLS = [
	"read",
	"grep",
	"find",
	"ls",
	"write",
	"edit",
	"bash",
	"question",
	"subagent",
	"wait",
] as const;

describe("selectAllowedToolNames", () => {
	const evaluator = new PermissionEvaluator();

	it("restores write/edit/bash from full tool list under yolo after plan narrowing", () => {
		// Simulate sticky active set left over from plan mode.
		const planNarrowed = ["read", "grep", "find", "ls", "question", "subagent"];
		const yolo = loadPresetPermission("yolo");

		// Old bug: filtering only the narrowed set could never re-add write/bash.
		const fromNarrowed = selectAllowedToolNames(planNarrowed, yolo, evaluator);
		expect(fromNarrowed).not.toContain("write");
		expect(fromNarrowed).not.toContain("bash");

		// Fix: start from getAllTools() so execute/yolo can expand again.
		const fromAll = selectAllowedToolNames(ALL_TOOLS, yolo, evaluator);
		expect(fromAll).toContain("write");
		expect(fromAll).toContain("edit");
		expect(fromAll).toContain("bash");
		expect(fromAll).toContain("read");
	});

	it("still excludes write/edit/bash under plan preset", () => {
		const plan = loadPresetPermission("plan");
		const allowed = selectAllowedToolNames(ALL_TOOLS, plan, evaluator);
		expect(allowed).toContain("read");
		expect(allowed).toContain("subagent");
		expect(allowed).not.toContain("write");
		expect(allowed).not.toContain("edit");
		expect(allowed).not.toContain("bash");
	});
});
