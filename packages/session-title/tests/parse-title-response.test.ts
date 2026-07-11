import { describe, expect, it } from "vitest";
import {
	fallbackTitleFromPrompt,
	normalizeTitle,
} from "../src/normalize-title.ts";
import { parseTitleResponse } from "../src/parse-title-response.ts";

describe("parseTitleResponse", () => {
	it("returns null for SKIP", () => {
		expect(parseTitleResponse("SKIP")).toBeNull();
		expect(parseTitleResponse(" skip ")).toBeNull();
	});

	it("returns title text", () => {
		expect(parseTitleResponse("Fix login bug")).toBe("Fix login bug");
	});
});

describe("normalizeTitle", () => {
	it("strips quotes and collapses whitespace", () => {
		expect(normalizeTitle('"  hello world  "')).toBe("hello world");
	});

	it("truncates long titles", () => {
		const long = "a".repeat(80);
		expect([...normalizeTitle(long, 48)].length).toBeLessThanOrEqual(48);
	});

	it("builds fallback titles from prompts", () => {
		expect(fallbackTitleFromPrompt("  fix login bug  ", 48)).toBe(
			"fix login bug",
		);
	});
});
