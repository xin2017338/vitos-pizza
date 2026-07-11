import { describe, expect, it } from "vitest";
import { sanitizeAvailableToolsSection } from "../src/sanitizers/system-prompt.ts";

describe("system-prompt sanitizer", () => {
	it("removes denied tools from Available tools section", () => {
		const prompt = [
			"Available tools:",
			"- read: read files",
			"- bash: run commands",
			"- write: write files",
			"",
			"Guidelines:",
			"- use bash for file operations like ls, rg, find",
		].join("\n");

		const result = sanitizeAvailableToolsSection(prompt, ["read"]);
		expect(result.removed).toBe(true);
		expect(result.prompt).toContain("- read:");
		expect(result.prompt).not.toContain("- bash:");
		expect(result.prompt).not.toContain("use bash for file operations");
	});
});
