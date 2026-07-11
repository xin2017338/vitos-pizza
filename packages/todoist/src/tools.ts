import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { TodoStore } from "./state.ts";

/** Debug-visible result — short text in transcript; full snapshot in details for replay */
function silentResult(
	snap: ReturnType<TodoStore["getSnapshot"]>,
	summary: string,
) {
	return {
		content: [{ type: "text" as const, text: summary }],
		details: { todos: snap.todos, totalCount: snap.totalCount, doneCount: snap.doneCount },
	};
}

/** Shared complete-vs-delete boundary (Claude Code style). */
const COMPLETE_VS_DELETE = [
	"Complete finished work with todo_update status 'done' (shows ☑). Do not use todo_remove to mark work finished.",
	"When every task in the list is done, the list clears automatically — then start the next multi-step request with fresh todo_add calls.",
	"Use todo_remove only for cancelled, duplicate, mistaken, or no-longer-relevant tasks.",
] as const;

export function registerTodoistTools(pi: ExtensionAPI, store: TodoStore): void {
	pi.registerTool({
		name: "todo_add",
		label: "Add Todo",
		description: "Create a new task in the in-memory todo list.",
		promptSnippet: "Add a task to the todo list",
		promptGuidelines: [
			"Use todo_add when you need to create a new task to track",
			"After a previous list was fully completed (auto-cleared), start the next multi-step request with fresh todo_add calls",
			"Priority: 1 (urgent), 2 (high), 3 (normal), 4 (low)",
			"Project is optional — use it to group related tasks",
		],
		parameters: Type.Object({
			text: Type.String({ description: "Task description" }),
			priority: Type.Optional(
				Type.Number({ description: "Priority 1-4 (1=urgent, 4=low)", default: 3 }),
			),
			project: Type.Optional(
				Type.String({ description: "Optional project/group name" }),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const input = params as { text: string; priority?: number; project?: string };
			store.add(
				input.text,
				(input.priority ?? 3) as 1 | 2 | 3 | 4,
				input.project,
			);
			const snap = store.getSnapshot();
			return silentResult(snap, `added: ${input.text} (${snap.totalCount} total)`);
		},
	});

	pi.registerTool({
		name: "todo_list",
		label: "List Todos",
		description:
			"List all tasks in the todo list, optionally filtered by status or project.",
		promptSnippet: "List tasks from the todo list",
		promptGuidelines: [
			"Use todo_list to see current tasks",
			"Filter by 'active' to see only unfinished tasks",
			"Filter by 'done' to see completed tasks",
		],
		parameters: Type.Object({
			filter: Type.Optional(
				StringEnum(["all", "active", "done"] as const, {
					description: "Filter by status",
					default: "all",
				}),
			),
			project: Type.Optional(
				Type.String({ description: "Filter by project name" }),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const input = params as {
				filter?: "all" | "active" | "done";
				project?: string;
			};
			const listed = store.list({
				status: input.filter ?? "all",
				project: input.project,
			});
			const snap = store.getSnapshot();
			return silentResult(
				snap,
				`listed ${listed.length} (filter=${input.filter ?? "all"})`,
			);
		},
	});

	pi.registerTool({
		name: "todo_update",
		label: "Update Todo",
		description:
			"Update a task's text, status, or priority. Set status to 'done' when work is finished (checked off). When all tasks are done, the list clears automatically.",
		promptSnippet: "Update a task in the todo list",
		promptGuidelines: [
			"Use todo_update to mark tasks done, change priority, or edit text",
			"When work is finished, set status to 'done' immediately — do not batch completions",
			"Set status to 'in_progress' when starting work on a task (ideally one at a time)",
			...COMPLETE_VS_DELETE,
		],
		parameters: Type.Object({
			id: Type.String({ description: "Task ID to update" }),
			text: Type.Optional(Type.String({ description: "New task text" })),
			status: Type.Optional(
				StringEnum(["pending", "in_progress", "done"] as const, {
					description: "New status",
				}),
			),
			priority: Type.Optional(
				Type.Number({ description: "New priority 1-4" }),
			),
			project: Type.Optional(
				Type.String({ description: "New project name" }),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const input = params as {
				id: string;
				text?: string;
				status?: "pending" | "in_progress" | "done";
				priority?: number;
				project?: string;
			};
			const item = store.update(input.id, {
				text: input.text,
				status: input.status,
				priority: input.priority as 1 | 2 | 3 | 4 | undefined,
				project: input.project,
			});
			if (!item) {
				return silentResult(
					{ todos: [], totalCount: 0, doneCount: 0, todoistConnected: false },
					`update failed: id=${input.id} not found`,
				);
			}
			const snap = store.getSnapshot();
			const bits = [
				input.status ? `status=${input.status}` : null,
				input.text ? `text=${input.text}` : null,
			].filter(Boolean);
			return silentResult(
				snap,
				`updated #${input.id}${bits.length ? ` (${bits.join(", ")})` : ""}`,
			);
		},
	});

	pi.registerTool({
		name: "todo_remove",
		label: "Remove Todo",
		description:
			"Permanently delete a task that is cancelled, duplicate, mistaken, or no longer relevant. Do not use this to mark finished work — use todo_update with status 'done' instead.",
		promptSnippet: "Permanently delete a no-longer-relevant task",
		promptGuidelines: [
			...COMPLETE_VS_DELETE,
			"Only call todo_remove when the user cancels the task, the plan changed, the item was a duplicate/mistake, or they explicitly ask to delete it",
		],
		parameters: Type.Object({
			id: Type.String({ description: "Task ID to permanently delete" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const input = params as { id: string };
			store.remove(input.id);
			const snap = store.getSnapshot();
			return silentResult(snap, `removed #${input.id} (${snap.totalCount} left)`);
		},
	});
}
