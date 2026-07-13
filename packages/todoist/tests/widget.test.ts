import { describe, expect, it } from "vitest";
import type { TodoItem, TodoSnapshot } from "../src/types.ts";
import { buildTodoWidgetView } from "../src/widget.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
};

function item(
	partial: Pick<TodoItem, "id" | "text" | "status"> & Partial<TodoItem>,
): TodoItem {
	return {
		priority: 3,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...partial,
	};
}

function snapshot(todos: TodoItem[]): TodoSnapshot {
	return {
		todos,
		totalCount: todos.length,
		doneCount: todos.filter((t) => t.status === "done").length,
		todoistConnected: false,
	};
}

describe("buildTodoWidgetView", () => {
	it("clears widget when there are no tasks", () => {
		const view = buildTodoWidgetView(snapshot([]), theme);
		expect(view.lines).toBeUndefined();
		expect(view.status).toBeUndefined();
	});

	it("keeps done tasks visible with a checkmark and #id", () => {
		const view = buildTodoWidgetView(
			snapshot([
				item({ id: "1", text: "Active", status: "pending" }),
				item({ id: "2", text: "Finished", status: "done" }),
			]),
			theme,
		);

		expect(view.lines).toBeDefined();
		expect(
			view.lines!.some(
				(line) => line.includes("☑") && line.includes("#2 Finished"),
			),
		).toBe(true);
		expect(
			view.lines!.some(
				(line) => line.includes("◻") && line.includes("#1 Active"),
			),
		).toBe(true);
		expect(view.status).toContain("● 1");
	});

	it("still shows the widget when every task is done", () => {
		const view = buildTodoWidgetView(
			snapshot([item({ id: "1", text: "All done", status: "done" })]),
			theme,
		);

		expect(view.lines).toBeDefined();
		expect(view.lines![0]).toContain("☑ 1 done");
		expect(
			view.lines!.some(
				(line) => line.includes("☑") && line.includes("#1 All done"),
			),
		).toBe(true);
		expect(view.status).toContain("☑ 1");
	});

	it("shows #id on in_progress lines", () => {
		const view = buildTodoWidgetView(
			snapshot([item({ id: "7", text: "Working", status: "in_progress" })]),
			theme,
		);
		expect(view.lines!.some((line) => line.includes("#7 Working"))).toBe(true);
	});

	it("orders in_progress before pending before done", () => {
		const view = buildTodoWidgetView(
			snapshot([
				item({ id: "1", text: "Done", status: "done" }),
				item({ id: "2", text: "Pending", status: "pending" }),
				item({ id: "3", text: "Working", status: "in_progress" }),
			]),
			theme,
		);

		const body = view.lines!.slice(1).join("\n");
		const working = body.indexOf("Working");
		const pending = body.indexOf("Pending");
		const done = body.indexOf("Done");
		expect(working).toBeLessThan(pending);
		expect(pending).toBeLessThan(done);
	});
});
