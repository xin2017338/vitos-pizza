import { describe, expect, it } from "vitest";

// isMultiParams routing tests — the core logic for dispatching single vs multi

type QuestionsParams =
	| { question: string; options: Array<{ label: string; description?: string }> }
	| { questions: Array<{ id?: string; title?: string; question: string; options: Array<{ label: string; description?: string }> }> };

function isMultiParams(params: QuestionsParams): boolean {
	return "questions" in params && Array.isArray(params.questions);
}

describe("isMultiParams routing", () => {
	it("identifies single-question params", () => {
		const params: QuestionsParams = {
			question: "Test?",
			options: [{ label: "A" }, { label: "B" }],
		};
		expect(isMultiParams(params)).toBe(false);
	});

	it("identifies multi-question params", () => {
		const params: QuestionsParams = {
			questions: [{ question: "Q1?", options: [{ label: "A" }] }],
		};
		expect(isMultiParams(params)).toBe(true);
	});

	it("handles mixed payload (both question and questions)", () => {
		const params = {
			question: "Single?",
			options: [{ label: "A" }],
			questions: [{ question: "Multi?", options: [{ label: "B" }] }],
		};
		expect(isMultiParams(params as QuestionsParams)).toBe(true);
	});
});

describe("result builders — single", () => {
	it("builds cancelled result with null answer", () => {
		const options = ["A", "B"];
		const result = {
			content: [{ type: "text" as const, text: "User cancelled the selection" }],
			details: {
				question: "Pick one",
				options,
				answer: null,
			},
		};
		expect(result.details.answer).toBeNull();
		expect(result.content[0]?.text).toContain("cancelled");
	});

	it("builds answer result with index", () => {
		const result = {
			content: [{ type: "text" as const, text: "User selected: 1. A" }],
			details: {
				question: "Pick one",
				options: ["A", "B"],
				answer: "A",
				wasCustom: false,
			},
		};
		expect(result.details.answer).toBe("A");
		expect(result.content[0]?.text).toContain("1. A");
	});

	it("builds custom answer result", () => {
		const result = {
			content: [{ type: "text" as const, text: "User wrote: custom value" }],
			details: {
				question: "Pick one",
				options: ["A", "B"],
				answer: "custom value",
				wasCustom: true,
			},
		};
		expect(result.details.wasCustom).toBe(true);
		expect(result.content[0]?.text).toContain("custom value");
	});
});

describe("result builders — multi-select (single question)", () => {
	it("builds multi-select result with multiple answers", () => {
		const result = {
			content: [{ type: "text" as const, text: "User selected:\n  1. TypeScript\n  3. Rust" }],
			details: {
				question: "Pick skills",
				options: ["TypeScript", "Python", "Rust"],
				answer: "TypeScript, Rust",
				multiAnswers: ["TypeScript", "Rust"],
				multiIndices: [1, 3],
			},
		};
		expect(result.details.multiAnswers).toHaveLength(2);
		expect(result.details.multiAnswers?.[0]).toBe("TypeScript");
		expect(result.details.multiAnswers?.[1]).toBe("Rust");
		expect(result.details.answer).toBe("TypeScript, Rust");
	});

	it("builds multi-select with custom input", () => {
		const result = {
			content: [{ type: "text" as const, text: "User selected:\n  1. TypeScript\n  (custom) Go" }],
			details: {
				question: "Pick skills",
				options: ["TypeScript", "Python"],
				answer: "TypeScript, Go",
				multiAnswers: ["TypeScript", "Go"],
				multiIndices: [1, -1],
			},
		};
		expect(result.details.multiIndices).toEqual([1, -1]);
		expect(result.details.multiAnswers?.[1]).toBe("Go");
	});
});

describe("result builders — multi-question (tabbed)", () => {
	it("builds multi-answer result with mixed single/multi", () => {
		const answers = {
			single: { answer: "A", wasCustom: false, index: 1 },
			multi: { answers: ["X", "Z"], indices: [1, 3] },
		};
		const result = {
			content: [{ type: "text" as const, text: "User answered:\n  single: 1. A\n  multi: 1. X, 3. Z" }],
			details: { answers },
		};
		expect(result.details.answers.single.answer).toBe("A");
		expect(result.details.answers.multi.answers).toEqual(["X", "Z"]);
	});

	it("builds cancelled result with empty answers", () => {
		const result = {
			content: [{ type: "text" as const, text: "User cancelled the multi‑question selection" }],
			details: { answers: {} },
		};
		expect(result.details.answers).toEqual({});
	});
});
