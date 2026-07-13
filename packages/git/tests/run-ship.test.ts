import { describe, expect, it } from "vitest";
import { runShip } from "../src/run-ship.ts";
import type { GitExec } from "../src/types.ts";

describe("runShip", () => {
	it("checkouts, adds, commits, and pushes for bcp", async () => {
		const calls: string[][] = [];
		const exec: GitExec = async (args) => {
			calls.push(args);
			return { stdout: "", stderr: "", code: 0 };
		};

		const result = await runShip({
			mode: "bcp",
			cwd: "/repo",
			exec,
			meta: { branch: "feature/x", message: "add x" },
		});

		expect(result.ok).toBe(true);
		expect(calls[0]).toEqual(["checkout", "-b", "feature/x"]);
		expect(calls[1]).toEqual(["add", "-A"]);
		expect(calls[2]?.[0]).toBe("commit");
		expect(calls[2]?.[1]).toBe("-F");
		expect(calls[3]).toEqual(["push", "-u", "origin", "feature/x"]);
	});

	it("never uses force push", async () => {
		const exec: GitExec = async (args) => {
			expect(args.includes("--force")).toBe(false);
			expect(args.includes("-f")).toBe(false);
			if (args[0] === "rev-parse") {
				return { stdout: "origin/main\n", stderr: "", code: 0 };
			}
			return { stdout: "", stderr: "", code: 0 };
		};

		const result = await runShip({
			mode: "cp",
			cwd: "/repo",
			exec,
			meta: { message: "fix thing" },
		});
		expect(result.ok).toBe(true);
	});
});
