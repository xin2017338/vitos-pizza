import type { ShortcutAction, ShortcutActionEntry } from "./types.ts";

export class ActionRegistry {
	private actions = new Map<string, ShortcutAction>();

	register(action: ShortcutAction): void {
		this.actions.set(action.id, action);
	}

	get(actionId: string): ShortcutAction | undefined {
		return this.actions.get(actionId);
	}

	list(): ShortcutAction[] {
		return [...this.actions.values()].sort((a, b) => a.id.localeCompare(b.id));
	}

	clear(): void {
		this.actions.clear();
	}

	buildEntries(
		bindings: Map<
			string,
			{
				keys: import("@earendil-works/pi-tui").KeyId[];
				source?: ShortcutActionEntry["source"];
			}
		>,
	): ShortcutActionEntry[] {
		const entries: ShortcutActionEntry[] = [];
		for (const action of this.list()) {
			const binding = bindings.get(action.id);
			entries.push({
				id: action.id,
				description: action.description,
				keys: binding?.keys ?? [],
				source: binding?.source,
			});
		}
		return entries;
	}
}
