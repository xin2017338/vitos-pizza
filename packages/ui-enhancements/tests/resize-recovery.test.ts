import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	attachResizeRecovery,
	RESIZE_RECOVERY_DEBOUNCE_MS,
	RESIZE_RECOVERY_RETRY_MS,
	RESIZE_RECOVERY_RETRY_WINDOW_MS,
} from "../src/chrome/resize-recovery.ts";

function createListenerBus() {
	const listeners = new Map<string, Set<() => void>>();
	return {
		on: (event: "resize", listener: () => void) => {
			const set = listeners.get(event) ?? new Set();
			set.add(listener);
			listeners.set(event, set);
		},
		off: (event: "resize", listener: () => void) => {
			listeners.get(event)?.delete(listener);
		},
		fire: () => {
			for (const listener of listeners.get("resize") ?? []) listener();
		},
		listenerCount: (event: "resize") => listeners.get(event)?.size ?? 0,
	};
}

describe("attachResizeRecovery", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("debounces resize and forces invalidate + full render", () => {
		const bus = createListenerBus();
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
			on: bus.on,
			off: bus.off,
		});

		bus.fire();
		bus.fire();
		expect(target.invalidate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS - 1);
		expect(target.invalidate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(target.invalidate).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledWith(true);

		detach();
	});

	it("does not recover while columns or rows stay falsy", () => {
		const bus = createListenerBus();
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
			on: bus.on,
			off: bus.off,
		});

		bus.fire();
		vi.advanceTimersByTime(
			RESIZE_RECOVERY_DEBOUNCE_MS + RESIZE_RECOVERY_RETRY_WINDOW_MS,
		);
		expect(target.invalidate).not.toHaveBeenCalled();

		columns = 100;
		rows = undefined;
		bus.fire();
		vi.advanceTimersByTime(
			RESIZE_RECOVERY_DEBOUNCE_MS + RESIZE_RECOVERY_RETRY_WINDOW_MS,
		);
		expect(target.invalidate).not.toHaveBeenCalled();

		columns = 100;
		rows = 30;
		bus.fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledWith(true);
	});

	it("retries when size becomes valid after debounce without a new resize", () => {
		const bus = createListenerBus();
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
			on: bus.on,
			off: bus.off,
		});

		bus.fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();

		columns = 100;
		rows = 30;
		vi.advanceTimersByTime(RESIZE_RECOVERY_RETRY_MS);
		expect(target.invalidate).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledWith(true);
	});

	it("retries when target becomes available after debounce", () => {
		const bus = createListenerBus();
		const target = {
			invalidate: vi.fn(),
			requestRender: vi.fn(),
		};
		let active: typeof target | undefined;

		attachResizeRecovery({
			getColumns: () => 80,
			getRows: () => 24,
			getTarget: () => active,
			on: bus.on,
			off: bus.off,
		});

		bus.fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();

		active = target;
		vi.advanceTimersByTime(RESIZE_RECOVERY_RETRY_MS);
		expect(target.invalidate).toHaveBeenCalledOnce();
		expect(target.requestRender).toHaveBeenCalledWith(true);
	});

	it("removes the listener and cancels pending timers on detach", () => {
		const bus = createListenerBus();
		const target = {
			invalidate: vi.fn(),
			requestRender: vi.fn(),
		};

		const detach = attachResizeRecovery({
			getColumns: () => 80,
			getRows: () => 24,
			getTarget: () => target,
			on: bus.on,
			off: bus.off,
		});

		bus.fire();
		detach();
		expect(bus.listenerCount("resize")).toBe(0);

		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();
	});

	it("cancels pending retries on detach", () => {
		const bus = createListenerBus();
		const target = {
			invalidate: vi.fn(),
			requestRender: vi.fn(),
		};
		let columns: number | undefined = 0;
		const rows = 40;

		const detach = attachResizeRecovery({
			getColumns: () => columns,
			getRows: () => rows,
			getTarget: () => target,
			on: bus.on,
			off: bus.off,
		});

		bus.fire();
		vi.advanceTimersByTime(RESIZE_RECOVERY_DEBOUNCE_MS);
		expect(target.invalidate).not.toHaveBeenCalled();

		detach();
		columns = 120;
		vi.advanceTimersByTime(RESIZE_RECOVERY_RETRY_WINDOW_MS);
		expect(target.invalidate).not.toHaveBeenCalled();
	});
});
