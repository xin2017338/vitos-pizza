import type { TodoItem, TodoListFilter, TodoPriority, TodoSnapshot, TodoStatus, TodoStoreEvents } from "./types.ts";

let nextId = 1;

function generateId(): string {
	return String(nextId++);
}

function now(): string {
	return new Date().toISOString();
}

export class TodoStore {
	private items = new Map<string, TodoItem>();
	private events: TodoStoreEvents = {};

	constructor(events?: TodoStoreEvents) {
		this.events = events ?? {};
	}

	setOnChange(cb: (snapshot: TodoSnapshot) => void): void {
		this.events.onChange = cb;
	}

	add(text: string, priority: TodoPriority = 3, project?: string): TodoItem {
		const item: TodoItem = {
			id: generateId(),
			text,
			status: "pending",
			priority,
			project,
			createdAt: now(),
			updatedAt: now(),
		};
		this.items.set(item.id, item);
		this.emitChange();
		return item;
	}

	list(filter?: TodoListFilter): TodoItem[] {
		let result = Array.from(this.items.values());

		if (filter?.status && filter.status !== "all") {
			result = result.filter((t) => {
				if (filter.status === "active") return t.status !== "done";
				if (filter.status === "done") return t.status === "done";
				return true;
			});
		}

		if (filter?.project) {
			result = result.filter((t) => t.project === filter.project);
		}

		return result.sort((a, b) => {
			// Sort by: pending first, in_progress, done last; then by creation time
			const statusOrder = { pending: 0, in_progress: 1, done: 2 };
			const aOrder = statusOrder[a.status];
			const bOrder = statusOrder[b.status];
			if (aOrder !== bOrder) return aOrder - bOrder;
			return a.createdAt.localeCompare(b.createdAt);
		});
	}

	get(id: string): TodoItem | undefined {
		return this.items.get(id);
	}

	update(
		id: string,
		changes: { text?: string; status?: TodoStatus; priority?: TodoPriority; project?: string },
	): TodoItem | null {
		const item = this.items.get(id);
		if (!item) return null;

		if (changes.text !== undefined) item.text = changes.text;
		if (changes.status !== undefined) item.status = changes.status;
		if (changes.priority !== undefined) item.priority = changes.priority;
		if (changes.project !== undefined) item.project = changes.project;
		item.updatedAt = now();

		// Claude Code: when every remaining task is done, clear the list for the next round
		this.clearIfAllDone();
		this.emitChange();
		return item;
	}

	remove(id: string): boolean {
		const result = this.items.delete(id);
		if (result) this.emitChange();
		return result;
	}

	clear(): void {
		this.items.clear();
		this.emitChange();
	}

	getSnapshot(): TodoSnapshot {
		const todos = Array.from(this.items.values());
		return {
			todos,
			totalCount: todos.length,
			doneCount: todos.filter((t) => t.status === "done").length,
			todoistConnected: false,
		};
	}

	/**
	 * Rebuild state from a series of historical tool calls (conversation replay).
	 * Each entry should have: { toolName, input, result }
	 * Uses the last entry that includes `details.todos` (including an empty array
	 * after all-done clear) — does not merge earlier snapshots.
	 */
	restoreFromHistory(
		entries: Array<{ toolName: string; input: Record<string, unknown>; result?: Record<string, unknown> }>,
	): void {
		this.items.clear();
		nextId = 1;

		let lastTodos: TodoItem[] | undefined;
		for (const entry of entries) {
			const details = entry.result?.details as { todos?: TodoItem[] } | undefined;
			if (!details || !Array.isArray(details.todos)) continue;
			lastTodos = details.todos;
		}

		if (!lastTodos) return;

		for (const todo of lastTodos) {
			const idNum = Number.parseInt(todo.id, 10);
			if (Number.isFinite(idNum) && idNum >= nextId) nextId = idNum + 1;
			this.items.set(todo.id, { ...todo });
		}
	}

	getTodoistConnected(): boolean {
		return false;
	}

	/** After a mutation: if every remaining item is done, clear the list (Claude Code). */
	private clearIfAllDone(): void {
		if (this.items.size === 0) return;
		if ([...this.items.values()].every((t) => t.status === "done")) {
			this.items.clear();
		}
	}

	private emitChange(): void {
		this.events.onChange?.(this.getSnapshot());
	}
}
