import { Key, matchesKey, visibleWidth } from "@earendil-works/pi-tui";

export const EXECUTE_START_MESSAGE = "开始实现";
export const EXECUTE_ACTION_LABEL = "开始实现";

export type ExecutePromptFocus = "action" | "editor";

export type ExecutePromptTheme = {
	fg(color: string, text: string): string;
};

export type ExecutePromptKeyResult =
	| { type: "setFocus"; focus: ExecutePromptFocus }
	| { type: "submitStart" }
	| { type: "delegate" };

export function formatExecuteActionLine(
	selected: boolean,
	theme: ExecutePromptTheme,
	_width: number,
): string {
	const label = theme.fg(selected ? "accent" : "dim", EXECUTE_ACTION_LABEL);
	if (selected) {
		return `${theme.fg("accent", "▶ ")}${label}`;
	}
	return label;
}

/** Light dotted rule — avoids competing with the full-width border chrome. */
export function formatExecuteSeparatorLine(
	theme: ExecutePromptTheme,
	width: number,
): string {
	const unit = "· ";
	const count = Math.max(0, Math.floor(width / visibleWidth(unit)));
	const dots = unit.repeat(count).trimEnd();
	return theme.fg("dim", dots);
}

/**
 * Decide how execute-mode prompt UI should handle a key when it owns focus logic.
 * Returns `delegate` for keys the underlying CustomEditor should handle
 * (shortcuts, free-text editing, etc.).
 */
export function handleExecutePromptKey(
	focus: ExecutePromptFocus,
	data: string,
	options: { editorEmpty: boolean; onFirstVisualLine: boolean },
): ExecutePromptKeyResult {
	if (focus === "action") {
		if (matchesKey(data, Key.down)) {
			return { type: "setFocus", focus: "editor" };
		}
		if (matchesKey(data, Key.up)) {
			return { type: "setFocus", focus: "action" };
		}
		if (matchesKey(data, Key.enter)) {
			return { type: "submitStart" };
		}
		return { type: "delegate" };
	}

	if (
		matchesKey(data, Key.up) &&
		options.editorEmpty &&
		options.onFirstVisualLine
	) {
		return { type: "setFocus", focus: "action" };
	}
	return { type: "delegate" };
}

/** Insert action + separator after the top border, before the editor body. */
export function injectExecutePromptRows(
	lines: string[],
	actionLine: string,
	separatorLine: string,
): string[] {
	if (lines.length < 2) return lines;
	const next = [...lines];
	next.splice(1, 0, actionLine, separatorLine);
	return next;
}
