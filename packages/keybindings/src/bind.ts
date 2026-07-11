import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";
import type { ActionRegistry } from "./registry.ts";
import type { MergedShortcutConfig } from "./types.ts";

export interface BindResult {
	bound: Array<{ actionId: string; key: KeyId; description: string }>;
	skipped: Array<{ actionId: string; key: KeyId; reason: string }>;
	unboundActions: string[];
}

export function bindShortcuts(
	pi: Pick<ExtensionAPI, "registerShortcut">,
	registry: ActionRegistry,
	config: MergedShortcutConfig,
): BindResult {
	const result: BindResult = {
		bound: [],
		skipped: [],
		unboundActions: [],
	};

	const boundKeys = new Set<string>();

	for (const action of registry.list()) {
		const binding = config.bindings.get(action.id);
		if (!binding || binding.keys.length === 0) {
			result.unboundActions.push(action.id);
			continue;
		}

		for (const key of binding.keys) {
			const normalizedKey = key.toLowerCase();
			if (boundKeys.has(normalizedKey)) {
				result.skipped.push({
					actionId: action.id,
					key,
					reason: "duplicate key in vitos-shortcuts config",
				});
				continue;
			}

			pi.registerShortcut(key, {
				description: action.description,
				handler: action.handler,
			});
			boundKeys.add(normalizedKey);
			result.bound.push({
				actionId: action.id,
				key,
				description: action.description,
			});
		}
	}

	return result;
}
