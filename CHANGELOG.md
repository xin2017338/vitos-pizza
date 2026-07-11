# Changelog

All notable changes to vitos-pizza are documented here.

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
- Plan-mode **Next** footer guidance and optional scout (skip recon when context is enough; parallel scouts for independent areas)

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

### Removed

- Nested `packages/xin-pi` aggregator
- `@xin-pi/core`, template scaffold, postinstall symlink hack

### Publishing

- GitHub Actions publishes `@vitos-pizza/vitos-pizza` via **npm Trusted Publishing (OIDC)** — no long-lived `NPM_TOKEN`
- Workflow: `.github/workflows/publish.yml` (triggers on `v*` tags / `workflow_dispatch`)
- `scripts/prepare-publish.mjs` rewrites `file:` workspace deps for the npm tarball
- First package version must be published once manually (or as a stub) before Trusted Publisher can be configured on npmjs.com
