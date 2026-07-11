import { describe, expect, it } from "vitest";
import {
	compileWildcardPattern,
	findCompiledWildcardMatch,
	wildcardMatch,
} from "../src/wildcard-matcher.ts";

describe("wildcard-matcher", () => {
	it("matches exact strings", () => {
		expect(wildcardMatch("git status", "git status")).toBe(true);
		expect(wildcardMatch("git status", "git diff")).toBe(false);
	});

	it("supports trailing optional args", () => {
		expect(wildcardMatch("git *", "git")).toBe(true);
		expect(wildcardMatch("git *", "git status")).toBe(true);
	});

	it("uses last-match-wins ordering", () => {
		const compiled = [
			compileWildcardPattern("*", "ask"),
			compileWildcardPattern("git status", "allow"),
		];
		const match = findCompiledWildcardMatch(compiled, "git status");
		expect(match?.state).toBe("allow");
	});
});
