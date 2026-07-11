import type { TodoItem, TodoSnapshot } from "./types.ts";

export type WidgetTheme = {
	fg: (color: string, text: string) => string;
	bold: (text: string) => string;
};

const MAX_WIDGET_ROWS = 10;

function formatElapsed(updatedAt: string, nowMs = Date.now()): string {
	const diff = nowMs - new Date(updatedAt).getTime();
	const secs = Math.floor(diff / 1000);
	if (secs < 60) return `${secs}s`;
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	return `${hrs}h ${mins % 60}m`;
}

function sortForWidget(todos: TodoItem[]): TodoItem[] {
	const statusOrder = { in_progress: 0, pending: 1, done: 2 } as const;
	return [...todos].sort((a, b) => {
		const orderDiff = statusOrder[a.status] - statusOrder[b.status];
		if (orderDiff !== 0) return orderDiff;
		return a.createdAt.localeCompare(b.createdAt);
	});
}

function formatMeta(todo: TodoItem, theme: WidgetTheme, nowMs: number): string {
	const parts: Array<string | null> = [];
	if (todo.status === "in_progress") {
		parts.push(formatElapsed(todo.updatedAt, nowMs));
	}
	if (todo.priority <= 2) parts.push(`p${todo.priority}`);
	if (todo.project) parts.push(todo.project);
	const meta = parts.filter(Boolean).join(" · ");
	return meta ? ` ${theme.fg("dim", meta)}` : "";
}

function formatTodoLine(todo: TodoItem, theme: WidgetTheme, nowMs: number): string {
	const metaStr = formatMeta(todo, theme, nowMs);
	if (todo.status === "in_progress") {
		return `  ${theme.fg("warning", "✳")} ${theme.fg("text", todo.text)}${metaStr}`;
	}
	if (todo.status === "done") {
		return `  ${theme.fg("muted", "☑")} ${theme.fg("muted", todo.text)}${metaStr}`;
	}
	return `  ${theme.fg("muted", "◻")} ${theme.fg("text", todo.text)}${metaStr}`;
}

export type TodoWidgetView = {
	lines: string[] | undefined;
	status: string | undefined;
};

/**
 * Build widget lines + status for the current snapshot.
 * Done tasks stay visible with ☑; widget clears only when the list is empty.
 */
export function buildTodoWidgetView(
	snapshot: TodoSnapshot,
	theme: WidgetTheme,
	nowMs = Date.now(),
): TodoWidgetView {
	if (snapshot.todos.length === 0) {
		return { lines: undefined, status: undefined };
	}

	const activeTodos = snapshot.todos.filter((t) => t.status !== "done");
	const doneCount = snapshot.doneCount;
	const sorted = sortForWidget(snapshot.todos);
	const visible = sorted.slice(0, MAX_WIDGET_ROWS);
	const hidden = sorted.length - visible.length;

	const lines: string[] = [];
	const headerIcon = activeTodos.some((t) => t.status === "in_progress")
		? "●"
		: activeTodos.length > 0
			? "○"
			: "☑";

	if (activeTodos.length > 0) {
		lines.push(
			theme.fg(
				"accent",
				`${headerIcon} ${activeTodos.length} task${activeTodos.length > 1 ? "s" : ""}`,
			) + (doneCount > 0 ? theme.fg("muted", ` (${doneCount} done)`) : ""),
		);
	} else {
		lines.push(
			theme.fg("muted", `☑ ${doneCount} done`),
		);
	}

	for (const todo of visible) {
		lines.push(formatTodoLine(todo, theme, nowMs));
	}

	if (hidden > 0) {
		lines.push(`  ${theme.fg("dim", `⋯ and ${hidden} more`)}`);
	}

	const status =
		activeTodos.length > 0
			? theme.fg("accent", `● ${activeTodos.length}`)
			: theme.fg("muted", `☑ ${doneCount}`);

	return { lines, status };
}
