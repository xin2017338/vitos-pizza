import { describe, expect, it } from "vitest";
import { parseCommitResponse } from "../src/parse-commit-response.ts";
import { findSecretPaths, parsePorcelainFiles } from "../src/safety.ts";
import { formatConfirmBody } from "../src/workflow.ts";

describe("parseCommitResponse", () => {
	it("parses cp message-only output", () => {
		expect(parseCommitResponse("fix login timeout handling\n", "cp")).toEqual({
			message: "fix login timeout handling",
		});
	});

	it("parses bcp BRANCH/MESSAGE lines", () => {
		expect(
			parseCommitResponse(
				"BRANCH: feature/login-timeout\nMESSAGE: fix login timeout\n",
				"bcp",
			),
		).toEqual({
			branch: "feature/login-timeout",
			message: "fix login timeout",
		});
	});

	it("rejects invalid branch names", () => {
		expect(
			parseCommitResponse("BRANCH: bad branch\nMESSAGE: hi", "bcp"),
		).toBeNull();
	});
});

describe("safety", () => {
	it("parses porcelain paths including renames", () => {
		expect(
			parsePorcelainFiles(" M src/a.ts\nR  old.ts -> new.ts\n?? .env\n"),
		).toEqual(["src/a.ts", "new.ts", ".env"]);
	});

	it("flags secret-looking paths", () => {
		expect(findSecretPaths(["src/a.ts", ".env", "certs/key.pem"])).toEqual([
			".env",
			"certs/key.pem",
		]);
	});
});

describe("formatConfirmBody", () => {
	it("includes branch for bcp", () => {
		expect(
			formatConfirmBody({ branch: "feature/x", message: "add x" }, "bcp"),
		).toBe("Branch: feature/x\n\nadd x");
	});
});
