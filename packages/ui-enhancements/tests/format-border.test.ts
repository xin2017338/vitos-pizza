import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { fitBorder } from "../src/chrome/format-border.ts";

describe("fitBorder", () => {
	const border = (text: string) => text;
	const fill = (text: string) => text;

	it("returns empty string for non-positive width", () => {
		expect(fitBorder("left", "right", 0, border, fill)).toBe("");
	});

	it("returns a single border dash for width 1", () => {
		expect(fitBorder("left", "right", 1, border, fill)).toBe("─");
	});

	it("fits left and right text with a gap", () => {
		const line = fitBorder(" left ", " right ", 20, border, fill);
		expect(line.startsWith("─")).toBe(true);
		expect(line.endsWith("─")).toBe(true);
		expect(line).toContain("left");
		expect(line).toContain("right");
	});

	it("truncates right text first when too wide", () => {
		const line = fitBorder(
			" long-left ",
			" long-right-text ",
			18,
			border,
			fill,
		);
		expect(line).toContain("long-left");
		expect(visibleWidth(line)).toBeLessThanOrEqual(18);
	});
});
