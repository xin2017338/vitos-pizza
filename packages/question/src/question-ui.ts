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
import type {
	MultiQuestionParams,
	MultiQuestionUiResult,
	MultiTabAnswer,
	QuestionParams,
	QuestionUiResult,
	SelectType,
	SingleTabAnswer,
	TabAnswer,
} from "./types.ts";

const CUSTOM_INPUT_PLACEHOLDER = "Type your answer";
const CHECKED = "☑";
const UNCHECKED = "☐";

// ────────────────────────────────────────────
//  Type helper — embedded selectType
// ────────────────────────────────────────────

interface QuestionParamsWithSelect extends QuestionParams {
	selectType?: SelectType;
}

// ────────────────────────────────────────────
//  Legacy single‑question UI (selectType-aware)
// ────────────────────────────────────────────

export async function runQuestionUi(
	ui: ExtensionUIContext,
	params: QuestionParamsWithSelect,
): Promise<QuestionUiResult | null> {
	if (params.options.length === 0) return null;

	if (params.selectType === "multi") {
		return runMultiSelectSingleQuestion(ui, params);
	}

	return runSingleSelectSingleQuestion(ui, params);
}

/** Single-select, single question (original behavior) */
async function runSingleSelectSingleQuestion(
	ui: ExtensionUIContext,
	params: QuestionParams,
): Promise<QuestionUiResult | null> {
	const options = params.options;
	const customInputIndex = options.length;

	return ui.custom<QuestionUiResult | null>((tui, theme, _kb, done) => {
		let optionIndex = 0;
		let cachedLines: string[] | undefined;
		let cachedWidth: number | undefined;
		const customInput = new Input();

		customInput.onSubmit = (value: string) => {
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
			done({ answer: selected.label, wasCustom: false, index: index + 1 });
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
					if (trimmed) done({ answer: trimmed, wasCustom: true });
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
				const cp = " ".repeat(prefixWidth);
				for (let i = 0; i < wrapped.length; i++) {
					lines.push(`${i === 0 ? prefix : cp}${wrapped[i]}`);
				}
			}

			lines.push(theme.fg("accent", "─".repeat(renderWidth)));
			addWrappedWithPrefix(" ", theme.fg("text", params.question));
			lines.push("");

			for (let i = 0; i < options.length; i++) {
				const opt = options[i];
				const sel = !isOnCustomInput() && i === optionIndex;
				const prefix = sel ? theme.fg("accent", "> ") : "  ";
				const label = `${i + 1}. ${opt.label}`;
				const color = sel ? "accent" : "text";
				addWrappedWithPrefix(prefix, theme.fg(color, label));
				if (opt.description) {
					addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
				}
			}

			const customSelected = isOnCustomInput();
			const customPrefix = customSelected ? theme.fg("accent", "> ") : "  ";
			const customNumber = `${customInputIndex + 1}.`;
			for (const line of renderSingleSelectInputRow(
				customPrefix,
				customNumber,
				renderWidth,
				customSelected,
				customInput,
				theme,
			)) {
				addWrapped(line);
			}

			lines.push("");
			addWrappedWithPrefix(
				" ",
				theme.fg("dim", "↑↓ select • 1-9 quick pick • Enter confirm • Esc cancel"),
			);
			lines.push(theme.fg("accent", "─".repeat(renderWidth)));

			cachedLines = lines;
			cachedWidth = width;
			return lines;
		}

		return {
			render,
			invalidate: () => { cachedLines = undefined; cachedWidth = undefined; },
			handleInput,
		};
	});
}

/** Multi-select, single question */
async function runMultiSelectSingleQuestion(
	ui: ExtensionUIContext,
	params: QuestionParams,
): Promise<QuestionUiResult | null> {
	const options = params.options;

	return ui.custom<QuestionUiResult | null>((tui, theme, _kb, done) => {
		let cursorIndex = 0;
		const selected = new Set<number>();
		const customInput = new Input();
		let customValue: string | null = null;

		let cachedLines: string[] | undefined;
		let cachedWidth: number | undefined;

		const ci = options.length; // custom input index
		const lastRow = ci; // custom input is last row; submit via Enter at any position

		function refresh() {
			cachedLines = undefined;
			cachedWidth = undefined;
			tui.requestRender();
		}

		function toggleCurrent() {
			if (cursorIndex < ci) {
				if (selected.has(cursorIndex)) {
					selected.delete(cursorIndex);
				} else {
					selected.add(cursorIndex);
				}
				refresh();
			}
		}

		function submitSelected() {
			if (selected.size === 0 && !customValue) return; // ignore empty
			const answers: string[] = [];
			const indices: number[] = [];
			for (const idx of [...selected].sort((a, b) => a - b)) {
				answers.push(options[idx]!.label);
				indices.push(idx + 1);
			}
			if (customValue) {
				answers.push(customValue);
				indices.push(-1);
			}
			done({
				answer: answers.join(", "),
				wasCustom: true,
				index: indices[0],
				multiAnswers: answers,
				multiIndices: indices,
			});
		}

		function handleInput(data: string) {
			if (matchesKey(data, Key.escape)) {
				done(null);
				return;
			}

			if (cursorIndex === ci) {
				// On custom input row
				if (matchesKey(data, Key.up)) {
					cursorIndex = Math.max(0, cursorIndex - 1);
					customInput.focused = false;
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					refresh();
					return;
				}
				if (matchesKey(data, Key.space)) {
					refresh();
					return;
				}
				if (matchesKey(data, Key.enter)) {
					const trimmed = customInput.getValue().trim();
					customValue = trimmed || null;
					submitSelected();
					return;
				}
				customInput.focused = true;
				customInput.handleInput(data);
				refresh();
				return;
			}

			// On a preset option row
			if (matchesKey(data, Key.up)) {
				cursorIndex = Math.max(0, cursorIndex - 1);
				customInput.focused = false;
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				cursorIndex = Math.min(ci, cursorIndex + 1);
				customInput.focused = cursorIndex === ci;
				refresh();
				return;
			}
			if (matchesKey(data, Key.space)) {
				toggleCurrent();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				submitSelected();
				return;
			}
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
				if (prefixWidth >= renderWidth) { addWrapped(prefix + text); return; }
				const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
				const cp = " ".repeat(prefixWidth);
				for (let i = 0; i < wrapped.length; i++) {
					lines.push(`${i === 0 ? prefix : cp}${wrapped[i]}`);
				}
			}

			lines.push(theme.fg("accent", "─".repeat(renderWidth)));
			addWrappedWithPrefix(" ", theme.fg("text", params.question));
			lines.push("");

			for (let i = 0; i < options.length; i++) {
				const opt = options[i];
				const isFocused = cursorIndex === i;
				const isChecked = selected.has(i);
				const checkMark = isChecked ? CHECKED : UNCHECKED;
				const prefix = isFocused ? theme.fg("accent", "> ") : "  ";
				const check = isFocused
					? theme.fg("accent", checkMark)
					: isChecked
						? theme.fg("success", checkMark)
						: theme.fg("muted", checkMark);
				const label = `${i + 1}. ${opt.label}`;
				const labelColor = isFocused ? "accent" : "text";
				addWrappedWithPrefix(`${prefix}${check} `, theme.fg(labelColor, label));
				if (opt.description) {
					addWrappedWithPrefix("       ", theme.fg("muted", opt.description));
				}
			}

			// Custom input row
			const onCustom = cursorIndex === ci;
			const customPrefix = onCustom ? theme.fg("accent", "> ") : "  ";
			const customNumber = `${ci + 1}.`;
			for (const line of renderMultiSelectInputRow(
				customPrefix,
				customNumber,
				renderWidth,
				onCustom,
				customInput,
				theme,
			)) {
				addWrapped(line);
			}

			// Footer
			lines.push("");
			const n = selected.size + (customValue ? 1 : 0);
			const help = n > 0
				? `↑↓ • Space toggle • Enter submit (${n}) • Esc cancel`
				: "↑↓ • Space toggle • Enter submit • Esc cancel";
			addWrappedWithPrefix(" ", theme.fg("dim", help));
			lines.push(theme.fg("accent", "─".repeat(renderWidth)));

			cachedLines = lines;
			cachedWidth = width;
			return lines;
		}

		return {
			render,
			invalidate: () => { cachedLines = undefined; cachedWidth = undefined; },
			handleInput,
		};
	});
}

// ────────────────────────────────────────────
//  Multi‑question tabbed UI (selectType-aware)
// ────────────────────────────────────────────

export async function runMultiQuestionUi(
	ui: ExtensionUIContext,
	params: MultiQuestionParams,
): Promise<MultiQuestionUiResult | null> {
	const tabs = params.questions;
	if (tabs.length === 0) return null;

	return ui.custom<MultiQuestionUiResult | null>((tui, theme, _kb, done) => {
		// ── state ──
		let activeTab = 0;
		const tabInputs: Input[] = tabs.map(() => new Input());
		const tabOptionIndex: number[] = tabs.map(() => 0);
		/** Per-tab selected indices for multi-select */
		const tabSelected: Set<number>[] = tabs.map(() => new Set());
		const tabCustomValues: (string | null)[] = tabs.map(() => null);
		const tabAnswers: (TabAnswer | null)[] = tabs.map(() => null);

		let cachedLines: string[] | undefined;
		let cachedWidth: number | undefined;

		for (const inp of tabInputs) {
			inp.onSubmit = (value: string) => {
				const ti = tabInputs.indexOf(inp);
				if (ti === activeTab) handleTabSubmit(ti, value.trim());
			};
		}

		// ── helpers ──
		function ci(tab: number): number {
			return tabs[tab]?.options.length ?? 0;
		}
		function isSingle(tab: number): boolean {
			return (tabs[tab]?.selectType ?? "single") === "single";
		}
		function isMulti(tab: number): boolean {
			return (tabs[tab]?.selectType ?? "single") === "multi";
		}
		function isOnCustomInput(tab?: number): boolean {
			const t = tab ?? activeTab;
			return tabOptionIndex[t] === ci(t);
		}

		function setAnswer(tab: number, ans: TabAnswer) {
			tabAnswers[tab] = ans;
			if (allAnswered()) {
				done(buildResult());
			} else {
				moveToNextUnanswered();
				refresh();
			}
		}

		function allAnswered(): boolean {
			return tabAnswers.every((a) => a !== null);
		}

		function buildResult(): MultiQuestionUiResult {
			const answers: Record<string, TabAnswer> = {};
			for (let i = 0; i < tabs.length; i++) {
				const tab = tabs[i];
				const key = tab.id ?? `q${i}`;
				const ans = tabAnswers[i];
				if (ans) answers[key] = ans;
			}
			return { answers };
		}

		function moveToNextUnanswered() {
			for (let i = 0; i < tabs.length; i++) {
				const next = (activeTab + 1 + i) % tabs.length;
				if (tabAnswers[next] === null) {
					activeTab = next;
					tabInputs[next]!.focused = isOnCustomInput(next);
					return;
				}
			}
		}

		function refresh() {
			cachedLines = undefined;
			cachedWidth = undefined;
			tui.requestRender();
		}

		// ── tab submit ──
		function handleTabSubmit(tab: number, customVal: string) {
			if (isSingle(tab)) {
				const opt = tabs[tab]?.options[tabOptionIndex[tab]];
				if (tabOptionIndex[tab] < ci(tab) && opt) {
					setAnswer(tab, { answer: opt.label, wasCustom: false, index: tabOptionIndex[tab] + 1 });
				} else if (customVal) {
					setAnswer(tab, { answer: customVal, wasCustom: true });
				}
			} else {
				// multi
				const set = tabSelected[tab]!;
				if (customVal) tabCustomValues[tab] = customVal;
				const n = set.size + (tabCustomValues[tab] ? 1 : 0);
				if (n === 0) return; // ignore empty
				const ansLabels: string[] = [];
				const ansIndices: number[] = [];
				for (const idx of [...set].sort((a, b) => a - b)) {
					ansLabels.push(tabs[tab]!.options[idx]!.label);
					ansIndices.push(idx + 1);
				}
				if (tabCustomValues[tab]) {
					ansLabels.push(tabCustomValues[tab]!);
					ansIndices.push(-1);
				}
				setAnswer(tab, { answers: ansLabels, indices: ansIndices });
			}
		}

		// ── input ──
		function handleInput(data: string) {
			if (matchesKey(data, Key.escape)) {
				done(null);
				return;
			}

			// Tab switching
			if (matchesKey(data, Key.tab)) {
				switchToTab((activeTab + 1) % tabs.length);
				return;
			}
			if (matchesKey(data, Key.shift("tab"))) {
				switchToTab((activeTab - 1 + tabs.length) % tabs.length);
				return;
			}
			if (matchesKey(data, Key.left)) {
				switchToTab((activeTab - 1 + tabs.length) % tabs.length);
				return;
			}
			if (matchesKey(data, Key.right)) {
				switchToTab((activeTab + 1) % tabs.length);
				return;
			}

			const limit = ci(activeTab);
			const isAnswered = tabAnswers[activeTab] !== null;

			if (isAnswered) return; // no editing after submit

			if (isSingle(activeTab)) {
				handleSingleSelectInput(data);
			} else {
				handleMultiSelectInput(data);
			}
		}

		function handleSingleSelectInput(data: string) {
			const limit = ci(activeTab);

			if (isOnCustomInput()) {
				if (matchesKey(data, Key.up)) {
					tabOptionIndex[activeTab] = Math.max(0, tabOptionIndex[activeTab] - 1);
					tabInputs[activeTab]!.focused = false;
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					refresh();
					return;
				}
				if (matchesKey(data, Key.enter)) {
					handleTabSubmit(activeTab, tabInputs[activeTab]!.getValue().trim());
					return;
				}
				tabInputs[activeTab]!.focused = true;
				tabInputs[activeTab]!.handleInput(data);
				refresh();
				return;
			}

			if (matchesKey(data, Key.up)) {
				tabOptionIndex[activeTab] = Math.max(0, tabOptionIndex[activeTab] - 1);
				tabInputs[activeTab]!.focused = false;
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				tabOptionIndex[activeTab] = Math.min(limit, tabOptionIndex[activeTab] + 1);
				tabInputs[activeTab]!.focused = tabOptionIndex[activeTab] === limit;
				refresh();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				const opt = tabs[activeTab]?.options[tabOptionIndex[activeTab]];
				if (opt) {
					setAnswer(activeTab, { answer: opt.label, wasCustom: false, index: tabOptionIndex[activeTab] + 1 });
				}
				return;
			}

			const key = parseKey(data);
			if (key && /^[1-9]$/.test(key)) {
				const index = Number(key) - 1;
				if (index <= limit) {
					tabOptionIndex[activeTab] = index;
					tabInputs[activeTab]!.focused = index === limit;
					refresh();
				}
			}
		}

		function handleMultiSelectInput(data: string) {
			const limit = ci(activeTab);

			if (isOnCustomInput()) {
				if (matchesKey(data, Key.up)) {
					tabOptionIndex[activeTab] = Math.max(0, tabOptionIndex[activeTab] - 1);
					tabInputs[activeTab]!.focused = false;
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					refresh();
					return;
				}
				if (matchesKey(data, Key.space)) {
					refresh();
					return;
				}
				if (matchesKey(data, Key.enter)) {
					handleTabSubmit(activeTab, tabInputs[activeTab]!.getValue().trim());
					return;
				}
				tabInputs[activeTab]!.focused = true;
				tabInputs[activeTab]!.handleInput(data);
				refresh();
				return;
			}

			// On preset option
			if (matchesKey(data, Key.up)) {
				tabOptionIndex[activeTab] = Math.max(0, tabOptionIndex[activeTab] - 1);
				tabInputs[activeTab]!.focused = false;
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				tabOptionIndex[activeTab] = Math.min(limit, tabOptionIndex[activeTab] + 1);
				tabInputs[activeTab]!.focused = tabOptionIndex[activeTab] === limit;
				refresh();
				return;
			}
			if (matchesKey(data, Key.space)) {
				const idx = tabOptionIndex[activeTab];
				if (tabSelected[activeTab]!.has(idx)) {
					tabSelected[activeTab]!.delete(idx);
				} else {
					tabSelected[activeTab]!.add(idx);
				}
				refresh();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				handleTabSubmit(activeTab, "");
				return;
			}
		}

		function switchToTab(index: number) {
			if (index === activeTab) return;
			tabInputs[activeTab]!.focused = false;
			activeTab = index;
			tabInputs[activeTab]!.focused = isOnCustomInput();
			refresh();
		}

		// ── render ──

		function renderTabBar(width: number): string[] {
			if (tabs.length <= 1) return [];

			const tabLabels: string[] = tabs.map((t, i) => {
				const answered = tabAnswers[i] !== null;
				const check = answered ? " ✔" : "";
				return t.title ?? `Q${i + 1}${check}`;
			});

			const segments: string[] = [];
			let remaining = width;

			for (let i = 0; i < tabLabels.length; i++) {
				if (remaining <= 3) break;
				const isActive = i === activeTab;
				const prefix = i === 0 ? " " : " ";
				const suffix = " ";
				const tabsLeft = tabLabels.length - i;
				const maxLabelLen = Math.max(4, Math.floor((remaining - 2) / tabsLeft) - 2);
				let label = tabLabels[i]!;
				if (visibleWidth(label) > maxLabelLen) {
					label = label.slice(0, maxLabelLen - 1) + "…";
				}
				const tabContent = `${prefix}${label}${suffix}`;
				const styled = isActive
					? theme.fg("accent", tabContent)
					: tabAnswers[i] !== null
						? theme.fg("success", tabContent)
						: theme.fg("muted", tabContent);
				segments.push(styled);
				remaining -= visibleWidth(tabContent);
			}

			if (segments.length === 0) return [];
			return [segments.join("")];
		}

		function render(width: number): string[] {
			if (cachedLines && cachedWidth === width) return cachedLines;

			const lines: string[] = [];
			const renderWidth = Math.max(1, width);
			const tab = tabs[activeTab]!;
			const options = tab.options;
			const limit = ci(activeTab);
			const isAnswered = tabAnswers[activeTab] !== null;
			const currentIdx = tabOptionIndex[activeTab];
			const isMultiSelect = tab.selectType === "multi";

			function addWrapped(text: string) {
				lines.push(...wrapTextWithAnsi(text, renderWidth));
			}
			function addWrappedWithPrefix(prefix: string, text: string) {
				const prefixWidth = visibleWidth(prefix);
				if (prefixWidth >= renderWidth) { addWrapped(prefix + text); return; }
				const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
				const cp = " ".repeat(prefixWidth);
				for (let i = 0; i < wrapped.length; i++) {
					lines.push(`${i === 0 ? prefix : cp}${wrapped[i]}`);
				}
			}

			// Tab bar
			const tabBarLines = renderTabBar(renderWidth);
			if (tabBarLines.length > 0) {
				lines.push(theme.fg("accent", "─".repeat(renderWidth)));
				lines.push(...tabBarLines);
			}

			// Question
			lines.push(theme.fg("accent", "─".repeat(renderWidth)));
			const tabTitle = tab.title ? theme.fg("accent", `[${tab.title}]`) : "";
			const questionText = isAnswered
				? theme.fg("success", `✔ ${tab.question}`)
				: theme.fg("text", tab.question);
			addWrappedWithPrefix(tabTitle ? `${tabTitle} ` : " ", questionText);
			lines.push("");

			// Options
			if (isMultiSelect && isAnswered) {
				// Show selected items
				const ans = tabAnswers[activeTab] as MultiTabAnswer;
				for (let i = 0; i < ans.answers.length; i++) {
					const idx = ans.indices[i];
					const label = idx === -1
						? theme.fg("success", `✔ ${ans.answers[i]}`)
						: theme.fg("success", `✔ ${idx}. ${ans.answers[i]}`);
					addWrappedWithPrefix("  ", label);
				}
			} else if (isMultiSelect) {
				for (let i = 0; i < options.length; i++) {
					const opt = options[i];
					const isFocused = i === currentIdx && !isOnCustomInput();
					const isChecked = tabSelected[activeTab]!.has(i);
					const checkMark = isChecked ? CHECKED : UNCHECKED;
					const prefix = isFocused ? theme.fg("accent", "> ") : "  ";
					const check = isFocused
						? theme.fg("accent", checkMark)
						: isChecked
							? theme.fg("success", checkMark)
							: theme.fg("muted", checkMark);
					const label = `${i + 1}. ${opt.label}`;
					const labelColor = isFocused ? "accent" : "text";
					addWrappedWithPrefix(`${prefix}${check} `, theme.fg(labelColor, label));
					if (opt.description) {
						addWrappedWithPrefix("       ", theme.fg("muted", opt.description));
					}
				}
			} else {
				for (let i = 0; i < options.length; i++) {
					const opt = options[i];
					const sel = !isOnCustomInput() && i === currentIdx;
					const disabled = isAnswered;
					const prefix = sel ? theme.fg("accent", "> ") : "  ";
					const label = `${i + 1}. ${opt.label}`;
					const color = disabled ? "dim" : sel ? "accent" : "text";
					addWrappedWithPrefix(prefix, theme.fg(color, label));
					if (opt.description) {
						addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
					}
				}
			}

			// Custom input / answer display
			if (isAnswered) {
				if (!isMultiSelect) {
					const ans = tabAnswers[activeTab] as SingleTabAnswer;
					const displayLabel = ans.wasCustom
						? theme.fg("success", `✔ ${ans.answer}`)
						: theme.fg("success", `✔ ${ans.index}. ${ans.answer}`);
					addWrappedWithPrefix("  ", displayLabel);
				}
			} else {
				const onCustom = isOnCustomInput();
				const customPrefix = onCustom ? theme.fg("accent", "> ") : "  ";
				const customNumber = `${limit + 1}.`;

				if (isMultiSelect) {
					for (const line of renderMultiSelectInputRow(
						customPrefix,
						customNumber,
						renderWidth,
						onCustom,
						tabInputs[activeTab]!,
						theme,
					)) {
						addWrapped(line);
					}
				} else {
					for (const line of renderSingleSelectInputRow(
						customPrefix,
						customNumber,
						renderWidth,
						onCustom,
						tabInputs[activeTab]!,
						theme,
					)) {
						addWrapped(line);
					}
				}
			}

			// Footer
			lines.push("");
			const helpParts: string[] = [];
			if (tabs.length > 1) helpParts.push("Tab/←→ switch");
			if (isMultiSelect) {
				helpParts.push("↑↓");
				helpParts.push("Space toggle");
				const n = tabSelected[activeTab]!.size + (tabCustomValues[activeTab] ? 1 : 0);
				helpParts.push(n > 0 ? `Enter submit (${n})` : "Enter submit");
			} else {
				helpParts.push("↑↓ select");
				helpParts.push("1-9 quick pick");
				if (!isAnswered) helpParts.push("Enter confirm");
			}
			helpParts.push("Esc cancel");
			addWrappedWithPrefix(" ", theme.fg("dim", helpParts.join(" • ")));
			lines.push(theme.fg("accent", "─".repeat(renderWidth)));

			cachedLines = lines;
			cachedWidth = width;
			return lines;
		}

		return {
			render,
			invalidate: () => { cachedLines = undefined; cachedWidth = undefined; },
			handleInput,
		};
	});
}

// ────────────────────────────────────────────
//  Shared input row renderers
// ────────────────────────────────────────────

function renderSingleSelectInputRow(
	prefix: string,
	numberLabel: string,
	availableWidth: number,
	selected: boolean,
	input: Input,
	theme: Theme,
): string[] {
	const numberPrefix = `${numberLabel} `;
	const numberWidth = visibleWidth(prefix + numberPrefix);
	const inputWidth = Math.max(1, availableWidth - numberWidth);
	const value = input.getValue();

	if (selected && value.length > 0) {
		input.focused = true;
		const [line = ""] = input.render(inputWidth);
		const stripped = line.startsWith("> ") ? line.slice(2) : line;
		return [`${prefix}${numberPrefix}${stripped}`];
	}
	if (selected) {
		input.focused = true;
		const marker = CURSOR_MARKER;
		const firstChar = CUSTOM_INPUT_PLACEHOLDER[0] ?? " ";
		const rest = CUSTOM_INPUT_PLACEHOLDER.slice(1);
		const cursorFirst = `\x1b[7m${firstChar}\x1b[27m`;
		const restPlaceholder = theme.fg("dim", rest);
		const field = `${marker}${cursorFirst}${restPlaceholder}`;
		const padding = " ".repeat(Math.max(0, inputWidth - visibleWidth(CUSTOM_INPUT_PLACEHOLDER)));
		return [`${prefix}${numberPrefix}${field}${padding}`];
	}
	input.focused = false;
	const display = value.length > 0
		? theme.fg("text", value)
		: theme.fg("dim", CUSTOM_INPUT_PLACEHOLDER);
	const padding = value.length > 0
		? ""
		: " ".repeat(Math.max(0, inputWidth - visibleWidth(CUSTOM_INPUT_PLACEHOLDER)));
	return [`${prefix}${numberPrefix}${display}${padding}`];
}

function renderMultiSelectInputRow(
	prefix: string,
	numberLabel: string,
	availableWidth: number,
	selected: boolean,
	input: Input,
	theme: Theme,
): string[] {
	// Same visual as single-select input but renders differently in multi-select context
	return renderSingleSelectInputRow(prefix, numberLabel, availableWidth, selected, input, theme);
}

interface Theme {
	fg: (color: string, text: string) => string;
	dim: (text: string) => string;
}
