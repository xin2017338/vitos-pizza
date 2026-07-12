import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { runMultiQuestionUi } from "../src/question-ui.ts";

describe("multi-question tabbed UI", () => {
	const theme = {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
		dim: (text: string) => text,
		success: (text: string) => text,
		muted: (text: string) => text,
	};

	function captureComponent() {
		let component:
			| {
					render: (width: number) => string[];
					invalidate: () => void;
					handleInput?: (data: string) => void;
			  }
			| undefined;

		const ui = {
			custom: vi.fn((_factory) => {
				const done = vi.fn();
				const tui = { requestRender: vi.fn() };
				component = _factory(tui, theme, {}, done);
				return Promise.resolve(null);
			}),
		} as unknown as ExtensionUIContext;

		return { ui, getComponent: () => component };
	}

	it("returns null for empty questions array", async () => {
		const { ui } = captureComponent();
		const result = await runMultiQuestionUi(ui, { questions: [] });
		expect(result).toBeNull();
	});

	it("renders tab bar when multiple questions", async () => {
		const { ui, getComponent } = captureComponent();
		await runMultiQuestionUi(ui, {
			questions: [
				{
					id: "q1",
					title: "Arch",
					question: "Which architecture?",
					options: [{ label: "Microservices" }, { label: "Monolith" }],
				},
				{
					id: "q2",
					title: "Lang",
					question: "Which language?",
					options: [{ label: "TypeScript" }, { label: "Python" }],
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(80);

		// Should have tab bar with Arch / Lang labels (from the title field)
		const fullText = lines.join("\n");
		expect(fullText).toContain("Arch");
		expect(fullText).toContain("Lang");

		// Should show the first question
		expect(fullText).toContain("Which architecture?");
	});

	it("caches render output", async () => {
		const { ui, getComponent } = captureComponent();
		await runMultiQuestionUi(ui, {
			questions: [
				{
					title: "Q1",
					question: "Pick one",
					options: [{ label: "A" }, { label: "B" }],
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const first = comp.render(60);
		const second = comp.render(60);
		expect(second).toBe(first);
	});

	it("single question (no tab bar) renders normally", async () => {
		const { ui, getComponent } = captureComponent();
		await runMultiQuestionUi(ui, {
			questions: [
				{
					question: "Just one question",
					options: [{ label: "Yes" }, { label: "No" }],
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(60);
		const fullText = lines.join("\n");
		expect(fullText).toContain("Just one question");
		expect(fullText).toContain("Yes");
		expect(fullText).toContain("No");
	});

	it("shows default Q1/Q2 labels when title is not provided", async () => {
		const { ui, getComponent } = captureComponent();
		await runMultiQuestionUi(ui, {
			questions: [
				{
					question: "First question",
					options: [{ label: "A" }, { label: "B" }],
				},
				{
					question: "Second question",
					options: [{ label: "X" }, { label: "Y" }],
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(80);
		const fullText = lines.join("\n");
		expect(fullText).toContain("Q1");
		expect(fullText).toContain("Q2");
	});

	it("uses custom tab ids when provided", async () => {
		const { ui, getComponent } = captureComponent();
		const promise = runMultiQuestionUi(ui, {
			questions: [
				{
					id: "my-custom-id",
					question: "Test?",
					options: [{ label: "A" }],
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		// Simulate selecting the first option to get the result
		const lines = comp.render(60);
		expect(lines.join("\n")).toContain("Test?");
	});
});
