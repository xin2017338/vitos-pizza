import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

export const SHORTCUTS_REGISTER = "vitos:shortcuts:register";

export interface ShortcutAction {
	id: string;
	description: string;
	handler: (ctx: ExtensionContext) => void | Promise<void>;
}

export type ShortcutBindingSource = "preset" | "global" | "project";

export type ShortcutBindingsConfig = Record<string, KeyId | KeyId[]>;

export interface ResolvedShortcutBinding {
	actionId: string;
	keys: KeyId[];
	source: ShortcutBindingSource;
}

export interface MergedShortcutConfig {
	bindings: Map<string, ResolvedShortcutBinding>;
}

export interface ShortcutActionEntry {
	id: string;
	description: string;
	keys: KeyId[];
	source?: ShortcutBindingSource;
}

export interface EventBus {
	emit(channel: string, payload: unknown): void;
	on(channel: string, handler: (payload: unknown) => void): () => void;
}

export function emitShortcutAction(
	events: EventBus,
	action: ShortcutAction,
): void {
	events.emit(SHORTCUTS_REGISTER, action);
}

export function isShortcutAction(value: unknown): value is ShortcutAction {
	if (!value || typeof value !== "object") return false;
	const action = value as Partial<ShortcutAction>;
	return (
		typeof action.id === "string" &&
		action.id.length > 0 &&
		typeof action.description === "string" &&
		typeof action.handler === "function"
	);
}
