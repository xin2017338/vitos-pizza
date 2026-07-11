import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import {
	CURSOR_MARKER,
	Input,
	Key,
	matchesKey,
	parseKey,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type { QuestionParams, QuestionUiResult } from "./types.ts";

const CUSTOM_INPUT_PLACEHOLDER = "Type your answer";

export async function runQuestionUi(
	ui: ExtensionUIContext,
	params: QuestionParams,
): Promise<QuestionUiResult | null> {
	if (params.options.length === 0) {
		return null;
	}

	const options = params.options;
	const customInputIndex = options.length;

	return ui.custom<QuestionUiResult | null>((tui, theme, _kb, done) => {
		let optionIndex = 0;
		let cachedLines: string[] | undefined;
		let cachedWidth: number | undefined;
		const customInput = new Input();

		customInput.onSubmit = (value) => {
			const trimmed = value.trim();
			if (trimmed && optionIndex === customInputIndex) {
				done({ answer: trimmed, wasCustom: true });
			}
		};

		function isOnCustomInput(): boolean {
			return optionIndex === customInputIndex;
		}

		function refresh() {
			cachedLines = undefined;
			cachedWidth = undefined;
			tui.requestRender();
		}

		function selectPresetOption(index: number) {
			const selected = options[index];
			if (!selected) return;
			done({
				answer: selected.label,
				wasCustom: false,
				index: index + 1,
			});
		}

		function handleInput(data: string) {
			if (matchesKey(data, Key.escape)) {
				done(null);
				return;
			}

			if (isOnCustomInput()) {
				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					customInput.focused = false;
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					refresh();
					return;
				}
				if (matchesKey(data, Key.enter)) {
					const trimmed = customInput.getValue().trim();
					if (trimmed) {
						done({ answer: trimmed, wasCustom: true });
					}
					return;
				}
				customInput.focused = true;
				customInput.handleInput(data);
				refresh();
				return;
			}

			if (matchesKey(data, Key.up)) {
				optionIndex = Math.max(0, optionIndex - 1);
				customInput.focused = false;
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				optionIndex = Math.min(customInputIndex, optionIndex + 1);
				customInput.focused = optionIndex === customInputIndex;
				refresh();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				selectPresetOption(optionIndex);
				return;
			}

			const key = parseKey(data);
			if (key && /^[1-9]$/.test(key)) {
				const index = Number(key) - 1;
				if (index <= customInputIndex) {
					optionIndex = index;
					customInput.focused = index === customInputIndex;
					refresh();
				}
			}
		}

		function renderCustomInputRow(
			prefix: string,
			numberLabel: string,
			availableWidth: number,
			selected: boolean,
		): string[] {
			const numberPrefix = `${numberLabel} `;
			const numberWidth = visibleWidth(prefix + numberPrefix);
			const inputWidth = Math.max(1, availableWidth - numberWidth);
			const value = customInput.getValue();

			if (selected && value.length > 0) {
				customInput.focused = true;
				const [inputLine = ""] = customInput.render(inputWidth);
				const stripped = inputLine.startsWith("> ")
					? inputLine.slice(2)
					: inputLine;
				return [`${prefix}${numberPrefix}${stripped}`];
			}

			if (selected) {
				customInput.focused = true;
				const marker = CURSOR_MARKER;
				const firstChar = CUSTOM_INPUT_PLACEHOLDER[0] ?? " ";
				const rest = CUSTOM_INPUT_PLACEHOLDER.slice(1);
				const cursorFirst = `\x1b[7m${firstChar}\x1b[27m`;
				const restPlaceholder = theme.fg("dim", rest);
				const field = `${marker}${cursorFirst}${restPlaceholder}`;
				const padding = " ".repeat(
					Math.max(0, inputWidth - visibleWidth(CUSTOM_INPUT_PLACEHOLDER)),
				);
				return [`${prefix}${numberPrefix}${field}${padding}`];
			}

			customInput.focused = false;
			const display =
				value.length > 0
					? theme.fg("text", value)
					: theme.fg("dim", CUSTOM_INPUT_PLACEHOLDER);
			const padding =
				value.length > 0
					? ""
					: " ".repeat(
							Math.max(0, inputWidth - visibleWidth(CUSTOM_INPUT_PLACEHOLDER)),
						);
			return [`${prefix}${numberPrefix}${display}${padding}`];
		}

		function render(width: number): string[] {
			if (cachedLines && cachedWidth === width) return cachedLines;

			const lines: string[] = [];
			const renderWidth = Math.max(1, width);

			function addWrapped(text: string) {
				lines.push(...wrapTextWithAnsi(text, renderWidth));
			}

			function addWrappedWithPrefix(prefix: string, text: string) {
				const prefixWidth = visibleWidth(prefix);
				if (prefixWidth >= renderWidth) {
					addWrapped(prefix + text);
					return;
				}
				const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
				const continuationPrefix = " ".repeat(prefixWidth);
				for (let i = 0; i < wrapped.length; i++) {
					lines.push(`${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`);
				}
			}

			lines.push(theme.fg("accent", "─".repeat(renderWidth)));
			addWrappedWithPrefix(" ", theme.fg("text", params.question));
			lines.push("");

			for (let i = 0; i < options.length; i++) {
				const opt = options[i];
				const selected = !isOnCustomInput() && i === optionIndex;
				const prefix = selected ? theme.fg("accent", "> ") : "  ";
				const label = `${i + 1}. ${opt.label}`;
				const color = selected ? "accent" : "text";

				addWrappedWithPrefix(prefix, theme.fg(color, label));

				if (opt.description) {
					addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
				}
			}

			const customSelected = isOnCustomInput();
			const customPrefix = customSelected ? theme.fg("accent", "> ") : "  ";
			const customNumber = `${customInputIndex + 1}.`;
			for (const line of renderCustomInputRow(
				customPrefix,
				customNumber,
				renderWidth,
				customSelected,
			)) {
				addWrapped(line);
			}

			lines.push("");
			addWrappedWithPrefix(
				" ",
				theme.fg(
					"dim",
					"↑↓ select • 1-9 quick pick • Enter confirm • Esc cancel",
				),
			);
			lines.push(theme.fg("accent", "─".repeat(renderWidth)));

			cachedLines = lines;
			cachedWidth = width;
			return lines;
		}

		return {
			render,
			invalidate: () => {
				cachedLines = undefined;
				cachedWidth = undefined;
			},
			handleInput,
		};
	});
}
