import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { runQuestionUi } from "../src/question-ui.ts";

describe("question-ui width cache", () => {
	it("recomputes lines when width changes without invalidate", async () => {
		const theme = {
			fg: (_color: string, text: string) => text,
			bold: (text: string) => text,
		};

		let component:
			| {
					render: (width: number) => string[];
					invalidate: () => void;
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

		await runQuestionUi(ui, {
			question: "Pick one",
			options: [{ label: "A" }, { label: "B" }],
		});

		expect(component).toBeDefined();
		if (!component) throw new Error("expected question UI component");

		const narrow = component.render(40);
		const narrowAgain = component.render(40);
		expect(narrowAgain).toBe(narrow);

		const wide = component.render(80);
		expect(wide).not.toBe(narrow);
		expect(wide[0]?.length).toBeGreaterThan(narrow[0]?.length ?? 0);
		expect(wide.at(-1)?.length).toBeGreaterThan(narrow.at(-1)?.length ?? 0);
	});
});
