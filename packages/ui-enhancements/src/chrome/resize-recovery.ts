/** Debounce window after the last resize event before forcing a full redraw. */
export const RESIZE_RECOVERY_DEBOUNCE_MS = 150;

export type ResizeRecoveryTarget = {
	invalidate(): void;
	requestRender(force?: boolean): void;
};

export type ResizeRecoveryOptions = {
	debounceMs?: number;
	getColumns?: () => number | undefined;
	getRows?: () => number | undefined;
	getTarget?: () => ResizeRecoveryTarget | undefined;
	on?: (event: "resize", listener: () => void) => void;
	off?: (event: "resize", listener: () => void) => void;
};

/**
 * After terminal resize settles, force a full TUI invalidate+redraw.
 * Skips frames where columns/rows are falsy (Windows can briefly report 0).
 */
export function attachResizeRecovery(
	options: ResizeRecoveryOptions = {},
): () => void {
	const debounceMs = options.debounceMs ?? RESIZE_RECOVERY_DEBOUNCE_MS;
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

	let timer: ReturnType<typeof setTimeout> | undefined;

	const onResize = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			const cols = getColumns();
			const rows = getRows();
			if (!cols || !rows) return;
			const target = getTarget();
			if (!target) return;
			target.invalidate();
			target.requestRender(true);
		}, debounceMs);
	};

	on("resize", onResize);

	return () => {
		if (timer) clearTimeout(timer);
		timer = undefined;
		off("resize", onResize);
	};
}
