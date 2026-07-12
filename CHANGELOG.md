# Changelog

All notable changes to vitos-pizza are documented here.

## [Unreleased]

## [0.4.1] - 2026-07-12

### Added

- **Multi-select questions** — `question` tool `selectType: "multi"` (Space toggle, Enter submit)
- **Multi-question tabs** — `questions: [...]` for tabbed prompts (Tab/←→ switch; per-tab single or multi)

### Changed

- **Subagent hypa-only reads** — scout / planner / worker drop builtin `read`/`grep`/`find`/`ls`; exploration uses `hypa_*` only (`bash`/`edit`/`write` unchanged)
- Plan mode footer: **Worth considering** (gaps/adjacent capabilities) replaces **Next** (no mode-switch verbs)
- Subagent question forwarding: subprocess children use **file channel only** (skip in-process RPC)

### Fixed

- **Subagent question false cancel** — child no-UI RPC no longer replies `cancelled`; parent TUI receives forwarded prompts
- **Resize recovery** — after Windows/Cursor reports `columns`/`rows` as 0 (or the border TUI is not ready yet), retry invalidate+full redraw for up to 1s so the UI recovers when size settles without another resize event

## [0.4.0] - 2026-07-11

### Added

- **Hypa context compression** — bundles `@hypabolic/pi-hypa` (additive mode; MCP proxy off); `@vitos-pizza/hypa` seeds `~/.hypa-pi/config.json`
- Plan mode / scout / planner / worker: `hypa_read` / `hypa_grep` / `hypa_find` / `hypa_ls` allowlisted alongside builtins
- `scripts/sync-pi-manifest.mjs` reads root `piBundled` and merges third-party Pi package extensions
- README **Architecture** capability map (`assets/architecture.svg` / `.png`)

### Acknowledgments

- [Hypa](https://github.com/Hypabolic/Hypa) / `@hypabolic/pi-hypa` (FSL-1.1-ALv2) — shell output compression and `hypa_*` tools

## [0.3.1] - 2026-07-11

### Changed

- **Prompt optimization** — plan mode: authoritative short system instructions + supersede; sticky reminder without JSON dumps
- Subagents skill: mode constraints one-liners; plan vs execute/agent examples split (no worker chain in plan)
- Scout / planner / worker / title prompts tightened; planner output adds `## 功能验收`
- Hide internal `title` agent from public subagent listings
- `web_search` guidelines: prefer local tools; use web only for current external facts

### Acknowledgments

- Claude Code plan-mode reminder pattern and OpenAI Codex base-instruction style (prompt craft reference)

## [0.3.0] - 2026-07-11

### Added

- **Execute-mode prompt UI** — bordered editor shows `▶ 开始实现` + free input (status bar preserved)
- **`@vitos-pizza/settings-preset`** — seeds default Pi settings on first session when none exist
- Mode cycle bindings: **`Ctrl+.`** and **`Alt+M`** (`agent-mode.cycle`)

### Changed

- Shortcut registration: actions register on `session_start` so keybindings can bind them reliably
- Plan mode: main agent / scout / planner can use `question` when helpful; scout tools aligned to plan-friendly set (no bash/write)

## [0.2.0] - 2026-07-11

### Added

- **`@vitos-pizza/todoist`** — in-memory task list with TUI widget, `/todo` command, and LLM tools (`todo_add` / `todo_update` / `todo_complete` / `todo_delete`)
- Terminal **resize recovery** in ui-enhancements — debounce + full redraw after resize (fixes blank/corrupt TUI on Windows)
- Plan-mode **Worth considering** footer (gaps/adjacent capabilities; not next-steps) and optional scout (skip recon when context is enough; parallel scouts for independent areas)

### Changed

- Permission system: tool activation starts from **all registered tools** (`getAllTools`) so leaving plan mode restores write/edit/bash
- Plan instructions: require `question` for mutually exclusive choices; clarify scout → planner delegation paths
- Question UI: width cache / render fixes for more stable TUI layout

### Fixed

- Permission gate / evaluator edge cases covered by new tests (`before-agent-start`, gates, evaluator)

## [0.1.0] - 2026-07-10

### Added

- Rebrand from xin-pi to **vitos-pizza** (维多披萨 / Vito's Pizzeria)
- Pi distribution layout: repo root as single install entry
- `scripts/sync-pi-manifest.mjs` module assembler
- Original logo at `assets/logo.svg`
- Built-in modules: agent-mode, question, session-title, permission-system, subagents, keybindings, ui-enhancements, websearch
- Agent modes: `agent` / `plan` / `execute` with `/mode` and cycle shortcuts
- Structured `question` tool with subagent parent-session forwarding
- Session auto-title from first meaningful user message

### Acknowledgments

- [Pi](https://pi.dev/) / [@earendil-works/pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
- [@gotgenes/pi-permission-system](https://www.npmjs.com/package/@gotgenes/pi-permission-system)
- Pi official `question` and subagent examples
