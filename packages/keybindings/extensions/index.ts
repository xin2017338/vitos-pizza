import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { type BindResult, bindShortcuts } from "../src/bind.ts";
import {
	loadShortcutConfigFiles,
	resolveShortcutConfigPaths,
} from "../src/config.ts";
import { ActionRegistry } from "../src/registry.ts";
import {
	isShortcutAction,
	SHORTCUTS_REGISTER,
	type ShortcutActionEntry,
} from "../src/types.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const presetPath = join(moduleDir, "..", "presets", "shortcuts.json");

export interface KeybindingsState {
	entries: ShortcutActionEntry[];
	bindResult: BindResult;
	configPaths: ReturnType<typeof resolveShortcutConfigPaths>;
}

function formatEntriesMessage(state: KeybindingsState): string {
	if (state.entries.length === 0) {
		return "No vitos shortcut actions registered yet.\n\nModules can register actions via vitos:shortcuts:register during session_start.";
	}

	const lines = ["**Action** | **Keys** | **Source**", "--- | --- | ---"];

	for (const entry of state.entries) {
		const keys =
			entry.keys.length > 0
				? entry.keys.map((key) => `\`${key}\``).join(", ")
				: "_(unbound)_";
		const source = entry.source ?? "—";
		lines.push(`\`${entry.id}\` — ${entry.description} | ${keys} | ${source}`);
	}

	if (state.bindResult.skipped.length > 0) {
		lines.push("");
		lines.push("**Skipped bindings:**");
		for (const skipped of state.bindResult.skipped) {
			lines.push(
				`- \`${skipped.actionId}\` \`${skipped.key}\`: ${skipped.reason}`,
			);
		}
	}

	lines.push("");
	lines.push("Config files (project overrides global overrides preset):");
	lines.push(`- preset: \`${state.configPaths.presetPath}\``);
	lines.push(`- global: \`${state.configPaths.globalPath}\``);
	lines.push(`- project: \`${state.configPaths.projectPath}\``);

	return lines.join("\n");
}

export function registerKeybindings(pi: ExtensionAPI): {
	registry: ActionRegistry;
	getState: () => KeybindingsState | null;
} {
	const registry = new ActionRegistry();
	let state: KeybindingsState | null = null;
	let sessionCwd: string | undefined;

	const rebind = (cwd: string) => {
		const agentDir = getAgentDir();
		const configPaths = resolveShortcutConfigPaths(presetPath, agentDir, cwd);
		const config = loadShortcutConfigFiles(configPaths);
		const bindResult = bindShortcuts(pi, registry, config);
		const entries = registry.buildEntries(config.bindings);
		state = { entries, bindResult, configPaths };
		return state;
	};

	const unsubRegister = pi.events.on(SHORTCUTS_REGISTER, (payload) => {
		if (!isShortcutAction(payload)) return;
		registry.register(payload);
		// Rebind if session already started (covers either session_start order).
		if (sessionCwd) rebind(sessionCwd);
	});
	void unsubRegister;

	pi.on("session_start", async (_event, ctx) => {
		sessionCwd = ctx.cwd;
		rebind(ctx.cwd);
	});

	pi.on("session_shutdown", () => {
		sessionCwd = undefined;
	});

	pi.registerCommand("vitos-shortcuts", {
		description: "List vitos-pizza shortcut actions and key bindings",
		handler: async (_args, ctx) => {
			const current = rebind(ctx.cwd);
			ctx.ui.notify(formatEntriesMessage(current), "info");
		},
	});

	return {
		registry,
		getState: () => state,
	};
}

export default function (pi: ExtensionAPI): void {
	registerKeybindings(pi);
}
