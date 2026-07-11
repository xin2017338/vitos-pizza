import { describe, expect, it } from "vitest";
import { truncateInput } from "../src/truncate-input.ts";

describe("truncateInput", () => {
	it("returns trimmed text unchanged when short enough", () => {
		expect(truncateInput("  fix login bug  ", 280)).toBe("fix login bug");
	});

	it("truncates long text near word boundaries", () => {
		const long = `${"word ".repeat(80)}tail`;
		const result = truncateInput(long, 120);
		expect(result.length).toBeLessThanOrEqual(120);
		expect(result.endsWith("tail")).toBe(false);
	});
});
