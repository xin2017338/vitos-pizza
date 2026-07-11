/** Priority: 1 = highest (p1), 4 = lowest (p4) */
export type TodoPriority = 1 | 2 | 3 | 4;

export type TodoStatus = "pending" | "in_progress" | "done";

export interface TodoItem {
	id: string;
	text: string;
	status: TodoStatus;
	priority: TodoPriority;
	project?: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Full snapshot carried in tool call details.
 * Used for conversation replay to rebuild in-memory state.
 */
export interface TodoSnapshot {
	todos: TodoItem[];
	totalCount: number;
	doneCount: number;
	todoistConnected: boolean;
}

export interface TodoListFilter {
	status?: "all" | "active" | "done";
	project?: string;
}

export interface TodoStoreEvents {
	onChange?: (snapshot: TodoSnapshot) => void;
}
