import { describe, expect, it } from "vitest";
import { isReadonlyBash } from "../src/bash-readonly.ts";

describe("isReadonlyBash", () => {
	it("accepts simple read-only commands", () => {
		expect(isReadonlyBash("ls -la")).toBe(true);
		expect(isReadonlyBash("grep pattern src")).toBe(true);
		expect(isReadonlyBash("cat README.md")).toBe(true);
	});

	it("accepts piped read-only chains", () => {
		expect(isReadonlyBash("cat file.txt | grep foo")).toBe(true);
		expect(isReadonlyBash("ls | wc -l")).toBe(true);
	});

	it("accepts chained read-only commands", () => {
		expect(isReadonlyBash("pwd && ls")).toBe(true);
		expect(isReadonlyBash("echo hi; ls")).toBe(true);
	});

	it("rejects unknown commands", () => {
		expect(isReadonlyBash("npm test")).toBe(false);
		expect(isReadonlyBash("git status")).toBe(false);
		expect(isReadonlyBash("powershell Get-ChildItem")).toBe(false);
	});

	it("rejects destructive operators", () => {
		expect(isReadonlyBash("echo hi > out.txt")).toBe(false);
		expect(isReadonlyBash("cat file | tee out.txt")).toBe(false);
		expect(isReadonlyBash("rm -rf .")).toBe(false);
		expect(isReadonlyBash("curl https://example.com")).toBe(false);
	});

	it("rejects mixed safe and unsafe chains", () => {
		expect(isReadonlyBash("ls && npm test")).toBe(false);
		expect(isReadonlyBash("grep foo && rm bar")).toBe(false);
	});

	it("rejects empty commands", () => {
		expect(isReadonlyBash("")).toBe(false);
		expect(isReadonlyBash("   ")).toBe(false);
	});
});
