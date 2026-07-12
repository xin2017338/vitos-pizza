import { Text } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";

function renderCall(theme: {
	fg: (c: string, t: string) => string;
	bold: (t: string) => string;
}) {
	return new Text(theme.fg("toolTitle", theme.bold("question")), 0, 0);
}

function renderResult(
	details: { answer: string | null } | { answers: Record<string, unknown> } | undefined,
	theme: {
		fg: (c: string, t: string) => string;
	},
) {
	if (!details) return new Text("", 0, 0);

	// Multi-question
	if ("answers" in details && details.answers) {
		const keys = Object.keys(details.answers);
		if (keys.length === 0) {
			return new Text(theme.fg("warning", "Cancelled"), 0, 0);
		}
		return new Text(
			theme.fg("success", `✓ ${keys.length} answered`),
			0,
			0,
		);
	}

	// Single-question
	const sq = details as { answer: string | null };
	if (sq.answer === null) {
		return new Text(theme.fg("warning", "Cancelled"), 0, 0);
	}
	return new Text(
		theme.fg("success", "✓ ") + theme.fg("accent", sq.answer),
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

	it("renderResult shows a single-line answer (single-question)", () => {
		const output = textFrom(renderResult({ answer: "Yes" }, theme));
		expect(output).toBe("✓ Yes");
	});

	it("renderResult shows cancelled for single null answer", () => {
		const output = textFrom(renderResult({ answer: null }, theme));
		expect(output).toBe("Cancelled");
	});

	it("renderResult shows count for multi-question answers", () => {
		const output = textFrom(
			renderResult(
				{
					answers: {
						q1: { answer: "A", wasCustom: false },
						q2: { answer: "B", wasCustom: false },
					},
				},
				theme,
			),
		);
		expect(output).toBe("✓ 2 answered");
	});

	it("renderResult shows cancelled for empty multi-question answers", () => {
		const output = textFrom(
			renderResult({ answers: {} }, theme),
		);
		expect(output).toBe("Cancelled");
	});
});
