import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { runQuestionUi, runMultiQuestionUi } from "../src/question-ui.ts";

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

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
	dim: (text: string) => text,
	success: (text: string) => text,
	muted: (text: string) => text,
};

describe("multi-select — single question", () => {
	it("renders checkboxes for multi-select", async () => {
		const { ui, getComponent } = captureComponent();
		await runQuestionUi(ui, {
			question: "Pick skills",
			options: [
				{ label: "TypeScript" },
				{ label: "Python" },
				{ label: "Rust" },
			],
			selectType: "multi",
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(60);
		const text = lines.join("\n");
		expect(text).toContain("☐");
		expect(text).toContain("Pick skills");
		expect(text).toContain("Space toggle");
		expect(text).toContain("Enter submit");
	});

	it("single-select still renders radio-style without checkboxes", async () => {
		const { ui, getComponent } = captureComponent();
		await runQuestionUi(ui, {
			question: "Pick one",
			options: [{ label: "A" }, { label: "B" }],
			selectType: "single",
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(60);
		const text = lines.join("\n");
		expect(text).not.toContain("☐");
		expect(text).toContain("Enter confirm");
		expect(text).toContain("1-9 quick pick");
	});

	it("defaults to single-select when selectType is omitted", async () => {
		const { ui, getComponent } = captureComponent();
		await runQuestionUi(ui, {
			question: "Pick one",
			options: [{ label: "A" }, { label: "B" }],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(60);
		const text = lines.join("\n");
		expect(text).not.toContain("☐");
		expect(text).toContain("Enter confirm");
	});
});

describe("multi-select — tabbed", () => {
	it("renders checkboxes for multi-select tab and radio for single-select tab", async () => {
		const { ui, getComponent } = captureComponent();
		await runMultiQuestionUi(ui, {
			questions: [
				{
					id: "single",
					title: "Single",
					question: "Pick one",
					options: [{ label: "A" }, { label: "B" }],
					selectType: "single",
				},
				{
					id: "multi",
					title: "Multi",
					question: "Pick many",
					options: [
						{ label: "X" },
						{ label: "Y" },
						{ label: "Z" },
					],
					selectType: "multi",
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(60);
		const text = lines.join("\n");
		// Tab 0 is single-select — rendered first
		expect(text).toContain("Single");
		expect(text).toContain("1-9 quick pick");
		expect(text).not.toContain("☐");
	});

	it("multi-select tab shows footer with Space toggle", async () => {
		const { ui, getComponent } = captureComponent();
		await runMultiQuestionUi(ui, {
			questions: [
				{
					title: "M",
					question: "Multi?",
					options: [{ label: "A" }, { label: "B" }],
					selectType: "multi",
				},
			],
		});

		const comp = getComponent();
		expect(comp).toBeDefined();
		if (!comp) throw new Error("expected component");

		const lines = comp.render(80);
		const text = lines.join("\n");
		expect(text).toContain("☐");
		expect(text).toContain("Space toggle");
		expect(text).not.toContain("1-9 quick pick");
	});
});
