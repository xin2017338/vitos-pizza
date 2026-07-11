import { describe, expect, it } from "vitest";
import { Text } from "@earendil-works/pi-tui";

function renderCall(theme: { fg: (c: string, t: string) => string; bold: (t: string) => string }) {
	return new Text(theme.fg("toolTitle", theme.bold("question")), 0, 0);
}

function renderResult(
	details: { answer: string | null } | undefined,
	theme: {
		fg: (c: string, t: string) => string;
	},
) {
	if (!details) return new Text("", 0, 0);
	if (details.answer === null) {
		return new Text(theme.fg("warning", "Cancelled"), 0, 0);
	}
	return new Text(
		theme.fg("success", "✓ ") + theme.fg("accent", details.answer),
		0,
		0,
	);
}

function textFrom(component: Text): string {
	return (component.render(120)[0] ?? "").trimEnd();
}

describe("question render helpers", () => {
	const theme = {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	};

	it("renderCall stays minimal without option list", () => {
		const output = textFrom(renderCall(theme));
		expect(output).toBe("question");
		expect(output).not.toContain("Options:");
	});

	it("renderResult shows a single-line answer", () => {
		const output = textFrom(renderResult({ answer: "Yes" }, theme));
		expect(output).toBe("✓ Yes");
	});
});
