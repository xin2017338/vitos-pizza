/** Debounce window after the last resize event before forcing a full redraw. */
export const RESIZE_RECOVERY_DEBOUNCE_MS = 150;

/** Interval between recovery retries when size/target is not yet ready. */
export const RESIZE_RECOVERY_RETRY_MS = 50;

/** Max time to keep retrying after debounce settles. */
export const RESIZE_RECOVERY_RETRY_WINDOW_MS = 1000;

export type ResizeRecoveryTarget = {
	invalidate(): void;
	requestRender(force?: boolean): void;
};

export type ResizeRecoveryOptions = {
	debounceMs?: number;
	retryMs?: number;
	retryWindowMs?: number;
	getColumns?: () => number | undefined;
	getRows?: () => number | undefined;
	getTarget?: () => ResizeRecoveryTarget | undefined;
	on?: (event: "resize", listener: () => void) => void;
	off?: (event: "resize", listener: () => void) => void;
};

/**
 * After terminal resize settles, force a full TUI invalidate+redraw.
 * When columns/rows are briefly falsy (Windows) or the TUI target is not
 * ready yet, retries until dimensions/target are available or the retry
 * window elapses.
 */
export function attachResizeRecovery(
	options: ResizeRecoveryOptions = {},
): () => void {
	const debounceMs = options.debounceMs ?? RESIZE_RECOVERY_DEBOUNCE_MS;
	const retryMs = options.retryMs ?? RESIZE_RECOVERY_RETRY_MS;
	const retryWindowMs =
		options.retryWindowMs ?? RESIZE_RECOVERY_RETRY_WINDOW_MS;
	const getColumns = options.getColumns ?? (() => process.stdout.columns);
	const getRows = options.getRows ?? (() => process.stdout.rows);
	const getTarget = options.getTarget ?? (() => undefined);
	const on =
		options.on ??
		((event, listener) => {
			process.stdout.on(event, listener);
		});
	const off =
		options.off ??
		((event, listener) => {
			process.stdout.off(event, listener);
		});

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let retryDeadline = 0;

	const clearDebounce = () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = undefined;
	};

	const clearRetry = () => {
		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = undefined;
		retryDeadline = 0;
	};

	const tryRecover = (): boolean => {
		const cols = getColumns();
		const rows = getRows();
		if (!cols || !rows) return false;
		const target = getTarget();
		if (!target) return false;
		target.invalidate();
		target.requestRender(true);
		return true;
	};

	const scheduleRetry = () => {
		if (retryTimer) return;
		retryTimer = setTimeout(() => {
			retryTimer = undefined;
			if (tryRecover()) {
				clearRetry();
				return;
			}
			if (Date.now() >= retryDeadline) {
				retryDeadline = 0;
				return;
			}
			scheduleRetry();
		}, retryMs);
	};

	const startRecovery = () => {
		if (tryRecover()) {
			clearRetry();
			return;
		}
		retryDeadline = Date.now() + retryWindowMs;
		scheduleRetry();
	};

	const onResize = () => {
		clearDebounce();
		clearRetry();
		debounceTimer = setTimeout(() => {
			debounceTimer = undefined;
			startRecovery();
		}, debounceMs);
	};

	on("resize", onResize);

	return () => {
		clearDebounce();
		clearRetry();
		off("resize", onResize);
	};
}
