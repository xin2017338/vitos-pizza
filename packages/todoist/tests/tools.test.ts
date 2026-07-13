import { describe, expect, it, vi } from "vitest";
import { TodoStore } from "../src/state.ts";
import {
	formatActiveIdHint,
	formatTodoListLine,
	registerTodoistTools,
} from "../src/tools.ts";
import type { TodoItem } from "../src/types.ts";

type ToolResult = {
	content: Array<{ type: string; text: string }>;
	details: { todos: TodoItem[]; totalCount: number; doneCount: number };
};

type RegisteredTool = {
	name: string;
	execute: (
		toolCallId: string,
		params: unknown,
		signal: unknown,
		onUpdate: unknown,
		ctx: unknown,
	) => Promise<ToolResult>;
};

function registerTools(store: TodoStore): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const pi = {
		registerTool: vi.fn((tool: RegisteredTool) => {
			tools.set(tool.name, tool);
		}),
	};
	registerTodoistTools(pi as never, store);
	return tools;
}

function textOf(result: ToolResult): string {
	return result.content.map((c) => c.text).join("");
}

describe("formatTodoListLine / formatActiveIdHint", () => {
	it("formats list lines with id and status", () => {
		expect(
			formatTodoListLine({
				id: "1",
				text: "Scout memory",
				status: "pending",
				priority: 3,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
			}),
		).toBe("#1 [pending] Scout memory");
	});

	it("hints active ids only", () => {
		expect(
			formatActiveIdHint([
				{
					id: "1",
					text: "A",
					status: "pending",
					priority: 3,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				},
				{
					id: "2",
					text: "B",
					status: "done",
					priority: 3,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				},
			]),
		).toBe("active: #1");
		expect(formatActiveIdHint([])).toBe("no active tasks");
	});
});

describe("todoist tools content", () => {
	it("todo_add returns #id in content", async () => {
		const store = new TodoStore();
		const tools = registerTools(store);
		const result = await tools.get("todo_add")!.execute(
			"call-1",
			{ text: "Explore memory" },
			undefined,
			undefined,
			undefined,
		);
		const added = result.details.todos[0]!;
		expect(textOf(result)).toBe(
			`added #${added.id}: Explore memory (${result.details.totalCount} total)`,
		);
		expect(added.text).toBe("Explore memory");
	});

	it("todo_list returns each task with #id and status", async () => {
		const store = new TodoStore();
		const a = store.add("Task A");
		const b = store.add("Task B");
		const tools = registerTools(store);
		const result = await tools.get("todo_list")!.execute(
			"call-2",
			{ filter: "active" },
			undefined,
			undefined,
			undefined,
		);
		const text = textOf(result);
		expect(text).toContain("listed 2 (filter=active)");
		expect(text).toContain(`#${a.id} [pending] Task A`);
		expect(text).toContain(`#${b.id} [pending] Task B`);
	});

	it("todo_list empty filter still reports count", async () => {
		const store = new TodoStore();
		const tools = registerTools(store);
		const result = await tools.get("todo_list")!.execute(
			"call-3",
			{ filter: "done" },
			undefined,
			undefined,
			undefined,
		);
		expect(textOf(result)).toBe("listed 0 (filter=done)");
	});

	it("todo_update failure returns current snapshot and active ids", async () => {
		const store = new TodoStore();
		const open = store.add("Still open");
		const tools = registerTools(store);
		const result = await tools.get("todo_update")!.execute(
			"call-4",
			{ id: "0", status: "done" },
			undefined,
			undefined,
			undefined,
		);
		expect(textOf(result)).toBe(
			`update failed: id=0 not found; active: #${open.id}`,
		);
		expect(result.details.totalCount).toBe(1);
		expect(result.details.todos[0]!.id).toBe(open.id);
		expect(store.list({ status: "active" })).toHaveLength(1);
	});

	it("todo_update success still reports #id", async () => {
		const store = new TodoStore();
		const item = store.add("Finish me");
		const tools = registerTools(store);
		const result = await tools.get("todo_update")!.execute(
			"call-5",
			{ id: item.id, status: "done" },
			undefined,
			undefined,
			undefined,
		);
		expect(textOf(result)).toBe(`updated #${item.id} (status=done)`);
	});
});
