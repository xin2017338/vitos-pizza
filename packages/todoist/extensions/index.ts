/**
 * @vitos-pizza/todoist — In-memory task management with TUI widget.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TODOIST_STATUS_KEY, TODOIST_WIDGET_KEY } from "../src/events.ts";
import { TodoStore } from "../src/state.ts";
import { registerTodoistTools } from "../src/tools.ts";
import { buildTodoWidgetView, type WidgetTheme } from "../src/widget.ts";

function renderTodoWidget(
	setWidget: (key: string, content: string[] | undefined) => void,
	setStatus: (key: string, content: string | undefined) => void,
	theme: WidgetTheme,
	store: TodoStore,
): void {
	const view = buildTodoWidgetView(store.getSnapshot(), theme);
	setWidget(TODOIST_WIDGET_KEY, view.lines);
	setStatus(TODOIST_STATUS_KEY, view.status);
}

export default function (pi: ExtensionAPI): void {
	const store = new TodoStore();

	// Track current mode for plan-mode injection
	let currentMode = "agent";

	// Listen for agent mode changes
	pi.events.on("agent_mode_changed", (payload: unknown) => {
		const p = payload as { mode?: string };
		if (p?.mode) currentMode = p.mode;
	});

	// Register 4 LLM tools
	registerTodoistTools(pi, store);

	// /todo command — show current todo list
	pi.registerCommand("todo", {
		description: "Show current todo list",
		handler: async (_args, ctx) => {
			const todos = store.list({ status: "all" });
			if (todos.length === 0) {
				ctx.ui.notify("📭 No tasks. Use `todo_add` to create one.", "info");
				return;
			}

			const pending = todos.filter((t) => t.status === "pending");
			const inProgress = todos.filter((t) => t.status === "in_progress");
			const done = todos.filter((t) => t.status === "done");

			const lines: string[] = [];
			if (inProgress.length > 0) {
				lines.push("In Progress:");
				lines.push(...inProgress.map((t) => `  ✳ #${t.id} ${t.text}`));
			}
			if (pending.length > 0) {
				lines.push("Pending:");
				lines.push(...pending.map((t) => `  ☐ #${t.id} ${t.text}`));
			}
			if (done.length > 0) {
				lines.push("Done:");
				lines.push(...done.map((t) => `  ☑ #${t.id} ${t.text}`));
			}
			lines.push(`\n📊 ${todos.length} total (${done.length} done)`);

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	// /todoist command — show connection info (stub, MCP removed)
	pi.registerCommand("todoist", {
		description: "Todoist — local in-memory task list",
		handler: async (_args, ctx) => {
			const todos = store.list({ status: "all" });
			const lines = [
				"📋 Local in-memory task list (no external sync)",
				`Tasks: ${todos.length} (${todos.filter((t) => t.status === "done").length} done)`,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	// Session lifecycle
	pi.on("session_start", async (_event, ctx) => {
		// Try to restore state from conversation history
		try {
			const entries = ctx.sessionManager?.getEntries?.() ?? [];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const toolEntries: any[] = [];
			for (const entry of entries) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const e = entry as any;
				if (e.type === "tool_call" && e.toolName) {
					toolEntries.push({
						toolName: e.toolName,
						input: e.input ?? {},
						result: e.result,
					});
				}
			}
			store.restoreFromHistory(toolEntries);
		} catch {
			// Silently fall back to empty state
		}

		// Render initial widget if there are any tasks (including all-done)
		const snap = store.getSnapshot();
		if (snap.todos.length > 0 && ctx.hasUI) {
			const theme = ctx.ui.theme as unknown as WidgetTheme;
			renderTodoWidget(
				(k, v) => ctx.ui.setWidget(k, v),
				(k, v) => ctx.ui.setStatus(k, v),
				theme,
				store,
			);
		}

		// Set up store change listener
		store.setOnChange(() => {
			if (ctx.hasUI) {
				const theme = ctx.ui.theme as unknown as WidgetTheme;
				renderTodoWidget(
					(k, v) => ctx.ui.setWidget(k, v),
					(k, v) => ctx.ui.setStatus(k, v),
					theme,
					store,
				);
			}
		});
	});

	// Plan mode injection — add pending tasks to system prompt
	pi.on("before_agent_start", async (event, _ctx) => {
		if (currentMode !== "plan") return {};

		const activeTodos = store.list({ status: "active" });
		if (activeTodos.length === 0) return {};

		const lines = activeTodos.map(
			(t) =>
				`  • #${t.id}: ${t.text} (p${t.priority})${t.project ? ` [${t.project}]` : ""}`,
		);

		const todoBlock = [
			"",
			"## Current Tasks",
			...lines,
			"",
			`📊 ${store.list({ status: "all" }).length} total (${store.list({ status: "done" }).length} done)`,
			"",
		].join("\n");

		const eventTyped = event as { systemPrompt?: string };
		return {
			systemPrompt: `${eventTyped.systemPrompt ?? ""}\n${todoBlock}`,
		};
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setWidget(TODOIST_WIDGET_KEY, undefined);
		ctx.ui.setStatus(TODOIST_STATUS_KEY, undefined);
	});
}
