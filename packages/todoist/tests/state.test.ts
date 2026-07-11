import { describe, expect, it } from "vitest";
import { TodoStore } from "../src/state.ts";
describe("TodoStore", () => {
	it("should add a task", () => {
		const store = new TodoStore();
		const item = store.add("Test task", 2, "test-project");
		expect(item.text).toBe("Test task");
		expect(item.priority).toBe(2);
		expect(item.project).toBe("test-project");
		expect(item.status).toBe("pending");
		expect(item.id).toBe("1");
	});

	it("should list all tasks", () => {
		const store = new TodoStore();
		store.add("Task 1");
		store.add("Task 2");
		expect(store.list({ status: "all" })).toHaveLength(2);
	});

	it("should filter active tasks", () => {
		const store = new TodoStore();
		store.add("Task 1");
		const item2 = store.add("Task 2");
		store.update(item2.id, { status: "done" });
		expect(store.list({ status: "active" })).toHaveLength(1);
		expect(store.list({ status: "done" })).toHaveLength(1);
	});

	it("should filter by project", () => {
		const store = new TodoStore();
		store.add("Task 1", 3, "project-a");
		store.add("Task 2", 3, "project-b");
		expect(store.list({ project: "project-a" })).toHaveLength(1);
	});

	it("should update a task", () => {
		const store = new TodoStore();
		const item = store.add("Task 1");
		const updated = store.update(item.id, { text: "Updated", status: "done" });
		expect(updated).not.toBeNull();
		expect(updated!.text).toBe("Updated");
		expect(updated!.status).toBe("done");
	});

	it("should return null for updating non-existent task", () => {
		const store = new TodoStore();
		expect(store.update("999", { text: "Nope" })).toBeNull();
	});

	it("should remove a task", () => {
		const store = new TodoStore();
		const item = store.add("Task 1");
		expect(store.remove(item.id)).toBe(true);
		expect(store.list({ status: "all" })).toHaveLength(0);
	});

	it("should return false for removing non-existent task", () => {
		const store = new TodoStore();
		expect(store.remove("999")).toBe(false);
	});

	it("should clear all tasks", () => {
		const store = new TodoStore();
		store.add("Task 1");
		store.add("Task 2");
		store.clear();
		expect(store.list({ status: "all" })).toHaveLength(0);
	});

	it("should provide a snapshot", () => {
		const store = new TodoStore();
		store.add("Task 1");
		store.add("Task 2");
		const snap = store.getSnapshot();
		expect(snap.totalCount).toBe(2);
		expect(snap.todos).toHaveLength(2);
	});

	it("should sort: pending first, in_progress, done last", () => {
		const store = new TodoStore();
		const item1 = store.add("Task 1");
		const item2 = store.add("Task 2");
		const item3 = store.add("Task 3");
		store.update(item2.id, { status: "in_progress" });
		store.update(item3.id, { status: "done" });

		const todos = store.list({ status: "all" });
		expect(todos[0]!.id).toBe(item1.id); // pending
		expect(todos[1]!.id).toBe(item2.id); // in_progress
		expect(todos[2]!.id).toBe(item3.id); // done
	});

	it("should restore from history", () => {
		const store = new TodoStore();
		// Simulate conversation replay with snapshot data
		const fakeEntry = {
			toolName: "todo_add",
			input: { text: "Replayed task" },
			result: {
				details: {
					todos: [
						{
							id: "1",
							text: "Replayed task",
							status: "pending" as const,
							priority: 3 as const,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
					],
					totalCount: 1,
					doneCount: 0,
					todoistConnected: false,
				},
			},
		};
		store.restoreFromHistory([fakeEntry]);
		expect(store.list({ status: "all" })).toHaveLength(1);
		expect(store.list({ status: "all" })[0]!.text).toBe("Replayed task");
	});

	it("should fire onChange callback", () => {
		let callCount = 0;
		const store = new TodoStore({ onChange: () => { callCount++; } });
		store.add("Task 1");
		store.add("Task 2");
		expect(callCount).toBe(2);
	});

	it("keeps done items while other tasks remain active", () => {
		const store = new TodoStore();
		store.add("Task 1");
		const item2 = store.add("Task 2");
		store.update(item2.id, { status: "done" });
		expect(store.list({ status: "all" })).toHaveLength(2);
		expect(store.list({ status: "done" })).toHaveLength(1);
		expect(store.list({ status: "active" })).toHaveLength(1);
	});

	it("clears the list when every task is marked done", () => {
		const store = new TodoStore();
		const a = store.add("Task 1");
		const b = store.add("Task 2");
		store.update(a.id, { status: "done" });
		expect(store.list({ status: "all" })).toHaveLength(2);
		store.update(b.id, { status: "done" });
		expect(store.list({ status: "all" })).toHaveLength(0);
		expect(store.getSnapshot().totalCount).toBe(0);
	});

	it("starts a fresh list after all-done clear", () => {
		const store = new TodoStore();
		const only = store.add("Old work");
		store.update(only.id, { status: "done" });
		expect(store.list({ status: "all" })).toHaveLength(0);

		const next = store.add("New work");
		expect(store.list({ status: "all" })).toHaveLength(1);
		expect(next.text).toBe("New work");
		expect(store.list({ status: "done" })).toHaveLength(0);
	});
});
