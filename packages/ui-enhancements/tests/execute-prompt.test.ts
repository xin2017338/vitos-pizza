import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	EXECUTE_ACTION_LABEL,
	EXECUTE_START_MESSAGE,
	formatExecuteActionLine,
	formatExecuteSeparatorLine,
	handleExecutePromptKey,
	injectExecutePromptRows,
} from "../src/chrome/execute-prompt.ts";

const theme = {
	fg: (_color: string, text: string) => text,
};

/** Raw terminal sequences (matchesKey expects these as `data`, not Key ids). */
const SEQ = {
	enter: "\r",
	up: "\x1b[A",
	down: "\x1b[B",
} as const;

describe("execute-prompt", () => {
	it("exports the start message used for submit", () => {
		expect(EXECUTE_START_MESSAGE).toBe("开始实现");
		expect(EXECUTE_ACTION_LABEL).toBe("开始实现");
	});

	it("formats selected action with play marker, idle without padding", () => {
		const selected = formatExecuteActionLine(true, theme, 40);
		const idle = formatExecuteActionLine(false, theme, 40);
		expect(selected).toBe("▶ 开始实现");
		expect(idle).toBe("开始实现");
	});

	it("formats a light dotted separator without leading spaces", () => {
		const line = formatExecuteSeparatorLine(theme, 20);
		expect(line).toContain("·");
		expect(line.startsWith(" ")).toBe(false);
		expect(line.endsWith(" ")).toBe(false);
	});

	it("injects action and separator after the top border", () => {
		const lines = injectExecutePromptRows(
			["TOP", "body", "BOTTOM"],
			"ACTION",
			"SEP",
		);
		expect(lines).toEqual(["TOP", "ACTION", "SEP", "body", "BOTTOM"]);
	});

	it("from action: down focuses editor, enter submits start", () => {
		expect(
			handleExecutePromptKey("action", SEQ.down, {
				editorEmpty: true,
				onFirstVisualLine: true,
			}),
		).toEqual({ type: "setFocus", focus: "editor" });

		expect(
			handleExecutePromptKey("action", SEQ.enter, {
				editorEmpty: true,
				onFirstVisualLine: true,
			}),
		).toEqual({ type: "submitStart" });
	});

	it("from editor: up on empty first line returns to action", () => {
		expect(
			handleExecutePromptKey("editor", SEQ.up, {
				editorEmpty: true,
				onFirstVisualLine: true,
			}),
		).toEqual({ type: "setFocus", focus: "action" });

		expect(
			handleExecutePromptKey("editor", SEQ.up, {
				editorEmpty: false,
				onFirstVisualLine: true,
			}),
		).toEqual({ type: "delegate" });
	});

	it("delegates unknown keys to the editor", () => {
		expect(
			handleExecutePromptKey("action", "x", {
				editorEmpty: true,
				onFirstVisualLine: true,
			}),
		).toEqual({ type: "delegate" });
	});
});

describe("keybindings preset", () => {
	it("binds agent-mode.cycle to ctrl+. and alt+m", () => {
		const presetPath = join(
			dirname(fileURLToPath(import.meta.url)),
			"../../keybindings/presets/shortcuts.json",
		);
		const preset = JSON.parse(readFileSync(presetPath, "utf8")) as Record<
			string,
			string
		>;
		expect(preset["agent-mode.cycle"]).toEqual(["ctrl+.", "alt+m"]);
	});
});
