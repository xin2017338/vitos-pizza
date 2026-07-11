import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	attachResizeRecovery,
	RESIZE_RECOVERY_DEBOUNCE_MS,
} from "../src/chrome/resize-recovery.ts";

describe("attachResizeRecovery", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("debounces resize and forces invalidate + full render", () => {
		const listeners = new Map<string, Set<() => void>>();
		const target = {
			invalidate: vi.fn(),
			requestRender: vi.fn(),
		};
		const columns = 120;
		const rows = 40;

		const detach = attachResizeRecovery({
			getColumns: () => columns,
			getRows: () => rows,
			getTarget: () => target,
			on: (event, listener) => {
				const set = listeners.get(event) ?? new Set();
				set.add(listener);
				listeners.set(event, set);
			},
			off: (event, listener) => {
				listeners.get(event)?.delete(listener);
			},
		});

		const fire = () => {
			for (const listener of listeners.get("resize") ?? []) listener();
		};

		fire();
		fire();
		expect(target.invalidate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS - 1);
		expect(target.invalidate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(target.invalidate).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledWith(true);

		detach();
	});

	it("skips recovery when columns or rows are falsy", () => {
		const listeners = new Map<string, Set<() => void>>();
		const target = {
			invalidate: vi.fn(),
			requestRender: vi.fn(),
		};
		let columns: number | undefined = 0;
		let rows: number | undefined = 40;

		attachResizeRecovery({
			getColumns: () => columns,
			getRows: () => rows,
			getTarget: () => target,
			on: (event, listener) => {
				const set = listeners.get(event) ?? new Set();
				set.add(listener);
				listeners.set(event, set);
			},
			off: (event, listener) => {
				listeners.get(event)?.delete(listener);
			},
		});

		const fire = () => {
			for (const listener of listeners.get("resize") ?? []) listener();
		};

		fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();

		columns = 100;
		rows = undefined;
		fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();

		columns = 100;
		rows = 30;
		fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledWith(true);
	});

	it("removes the listener and cancels pending timers on detach", () => {
		const listeners = new Map<string, Set<() => void>>();
		const target = {
			invalidate: vi.fn(),
			requestRender: vi.fn(),
		};

		const detach = attachResizeRecovery({
			getColumns: () => 80,
			getRows: () => 24,
			getTarget: () => target,
			on: (event, listener) => {
				const set = listeners.get(event) ?? new Set();
				set.add(listener);
				listeners.set(event, set);
			},
			off: (event, listener) => {
				listeners.get(event)?.delete(listener);
			},
		});

		const fire = () => {
			for (const listener of listeners.get("resize") ?? []) listener();
		};

		fire();
		detach();
		expect(listeners.get("resize")?.size ?? 0).toBe(0);

		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();
	});
});
