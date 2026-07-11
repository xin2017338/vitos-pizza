import { describe, expect, it, vi } from "vitest";
import { bindShortcuts } from "../src/bind.ts";
import { ActionRegistry } from "../src/registry.ts";
import type { MergedShortcutConfig } from "../src/types.ts";

describe("bindShortcuts", () => {
	it("registers shortcuts for bound actions", () => {
		const registry = new ActionRegistry();
		const handler = vi.fn();
		registry.register({
			id: "demo.action",
			description: "Demo action",
			handler,
		});

		const registerShortcut = vi.fn();
		const config: MergedShortcutConfig = {
			bindings: new Map([
				[
					"demo.action",
					{
						actionId: "demo.action",
						keys: ["ctrl+shift+d"],
						source: "preset",
					},
				],
			]),
		};

		const result = bindShortcuts({ registerShortcut }, registry, config);

		expect(registerShortcut).toHaveBeenCalledWith("ctrl+shift+d", {
			description: "Demo action",
			handler,
		});
		expect(result.bound).toEqual([
			{
				actionId: "demo.action",
				key: "ctrl+shift+d",
				description: "Demo action",
			},
		]);
		expect(result.unboundActions).toEqual([]);
	});

	it("skips duplicate keys within the same bind pass", () => {
		const registry = new ActionRegistry();
		registry.register({
			id: "first.action",
			description: "First",
			handler: vi.fn(),
		});
		registry.register({
			id: "second.action",
			description: "Second",
			handler: vi.fn(),
		});

		const registerShortcut = vi.fn();
		const config: MergedShortcutConfig = {
			bindings: new Map([
				[
					"first.action",
					{
						actionId: "first.action",
						keys: ["ctrl+k"],
						source: "preset",
					},
				],
				[
					"second.action",
					{
						actionId: "second.action",
						keys: ["ctrl+k"],
						source: "preset",
					},
				],
			]),
		};

		const result = bindShortcuts({ registerShortcut }, registry, config);

		expect(registerShortcut).toHaveBeenCalledTimes(1);
		expect(result.skipped).toEqual([
			{
				actionId: "second.action",
				key: "ctrl+k",
				reason: "duplicate key in vitos-shortcuts config",
			},
		]);
	});

	it("reports unbound registered actions", () => {
		const registry = new ActionRegistry();
		registry.register({
			id: "unbound.action",
			description: "Unbound",
			handler: vi.fn(),
		});

		const result = bindShortcuts({ registerShortcut: vi.fn() }, registry, {
			bindings: new Map(),
		});

		expect(result.unboundActions).toEqual(["unbound.action"]);
	});
});

describe("ActionRegistry", () => {
	it("buildEntries merges registry actions with bindings", () => {
		const registry = new ActionRegistry();
		registry.register({
			id: "b.action",
			description: "B",
			handler: vi.fn(),
		});
		registry.register({
			id: "a.action",
			description: "A",
			handler: vi.fn(),
		});

		const entries = registry.buildEntries(
			new Map([["a.action", { keys: ["ctrl+a"], source: "project" as const }]]),
		);

		expect(entries).toEqual([
			{
				id: "a.action",
				description: "A",
				keys: ["ctrl+a"],
				source: "project",
			},
			{
				id: "b.action",
				description: "B",
				keys: [],
				source: undefined,
			},
		]);
	});
});
