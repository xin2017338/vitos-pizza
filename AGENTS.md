# Vito's Pizzeria — Agent Instructions

This repository is **vitos-pizza**, a [Pi](https://pi.dev/) **distribution** (like LazyVim for Neovim). Users install the repo root once via `pi install .` and get the full curated experience.

Inspired by Vito's Pizzeria from Garfield — one brand, one install.

## Structure

- **Repo root** — The distribution. `package.json` is the pi-package manifest.
- **`packages/<module>/`** — Built-in modules (e.g. `@vitos-pizza/agent-mode`, `@vitos-pizza/hypa`, `@vitos-pizza/question`, `@vitos-pizza/session-title`, `@vitos-pizza/permission-system`, `@vitos-pizza/subagents`, `@vitos-pizza/keybindings`). Not installed separately by users.
- **`scripts/sync-pi-manifest.mjs`** — Scans `packages/*`, merges `piBundled` npm packages, and updates root `dependencies` + `pi` manifest. Honors `pi.requires` for extension load order.

## Bundled third-party Pi packages

Declare npm pi packages in root `package.json`:

- `dependencies` — version range
- `bundledDependencies` — include in the distribution tarball
- `piBundled` — list read by `sync-pi-manifest.mjs` to merge `node_modules/<pkg>/` paths into the root `pi` manifest

Extension load order: topological sort of `pi.requires`, with `LOCAL_ORDER` tie-break. Default: `permission-system` → `settings-preset` → `hypa` → `question` → `ui-enhancements` → `subagents` → `websearch` → `session-title` → `keybindings` → `agent-mode` → `todoist`. (`agent-mode` requires `keybindings` so shortcut actions register after the keybindings listener is ready.) `piBundled` packages (e.g. `@hypabolic/pi-hypa`) load before local modules.

## Agent mode

Vito's Pizzeria uses three centralized modes via **`@vitos-pizza/agent-mode`**:

| Mode | Permissions | Behavior |
|------|-------------|----------|
| `agent` | `default` preset | Balanced daily work |
| `plan` | `plan` preset | Read-only; scout → planner via subagents + `question` |
| `execute` | `yolo` preset | Minimal gates; full implementation |

Switch with `/mode [agent|plan|execute]` or **`Ctrl+.`** / **`Alt+M`** (`agent-mode.cycle`). Current mode appears in the ui-enhancements border bar (`· plan` / `· execute`).

## Keyboard shortcuts

Pi already provides built-in keybindings (`~/.pi/agent/keybindings.json`, namespaced `app.*` / `tui.*`) and extension shortcuts via `pi.registerShortcut()`.

**vitos-pizza convention:** only `@vitos-pizza/keybindings` may call `pi.registerShortcut`. Other modules register **actions** (not keys) during `session_start`:

```typescript
import { emitShortcutAction } from "@vitos-pizza/keybindings/types";

// session_start — register handler only; keys come from vitos-shortcuts.json
emitShortcutAction(pi.events, {
  id: "agent-mode.cycle",
 description: "Cycle agent mode (agent → plan → execute)",
 handler: async (ctx) => { /* ... */ },
});
```

Default binding: `ctrl+.` and `alt+m` (see `packages/keybindings/presets/shortcuts.json`). `Ctrl+.` needs a terminal with Kitty / modifyOtherKeys; `Alt+M` works in classic terminals.

Key config (project overrides global overrides preset defaults):

- `packages/keybindings/presets/shortcuts.json` — distribution defaults
- `~/.pi/agent/vitos-shortcuts.json` — user global overrides
- `<cwd>/.pi/vitos-shortcuts.json` — project overrides

Use `/vitos-shortcuts` to list registered actions and current bindings. Pi built-in shortcuts remain in `/hotkeys` and `keybindings.json`.

Each module follows Pi conventions:

```
packages/<module>/
├── extensions/     # TypeScript (*.ts)
├── skills/         # */SKILL.md (optional)
├── prompts/        # *.md slash templates (optional)
└── themes/         # *.json (optional)
```

## Adding a module

1. Create `packages/<name>/` with `package.json` (`"name": "@vitos-pizza/<name>"`).
2. Optional: declare `"pi": { "requires": ["@vitos-pizza/other-module"] }` so sync orders extensions correctly.
3. Add extensions, skills, prompts, or themes as needed.
4. If you referenced external open source, add an **Acknowledgments** row in [README.md](README.md) (see **Open-source acknowledgments** below).
5. Run `npm run sync && npm install` at repo root.
6. Reload Pi with `/reload` or `pi install .`.

## Dependency rules

- **Pi core packages** (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `typebox`) → `peerDependencies: "*"` only.
- **Third-party runtime deps** → `dependencies` in the module that uses them.

## Subagent delegation

All child-agent work in vitos-pizza modules must go through **`@vitos-pizza/subagents`** — use `requestSubagentRun` / `requestSubagentWait` from `@vitos-pizza/subagents/rpc/client` on `pi.events`. Do not call `completeSimple` or spawn `pi` directly for delegated agent runs.

Declare `"pi": { "requires": ["@vitos-pizza/subagents"] }` in the consuming module's `package.json` so extension load order is correct.

## Ask-user questions

Structured clarification (multiple-choice UI) uses **`@vitos-pizza/question`** — the `question` tool. Main sessions show the TUI directly; subagent children forward prompts to the parent session (events RPC + file fallback). Planner and scout agents include `question` in their `tools:` list.

## Open-source acknowledgments

Whenever work **references, adapts, or depends on** external open source, add or update an entry in [README.md](README.md) → **Acknowledgments**. Do this in the **same PR** as the feature or dependency change — not as a follow-up.

**Must acknowledge:**

- Pi extensions / npm packages you read, port patterns from, or bundle (`piBundled`, `dependencies`)
- GitHub repos or docs used as implementation reference (even if reimplemented in-tree)
- New runtime `dependencies` in any `packages/*/package.json`
- UX or architecture inspiration with a named upstream (e.g. Claude Code–style presets)

**Do not** list every transitive npm package — only direct references and meaningful upstreams.

**Where to put each entry** (keep existing subsection structure):

| Kind | README subsection |
|------|-------------------|
| Platform / distribution model | `### Platform & distribution model` |
| Feature reference, port, or bundled Pi package | `### Features referenced or adapted` |
| Direct runtime or dev tooling dependency | `### Runtime & tooling libraries` |

**Row format** (match existing tables):

```markdown
| [Project name](https://…/) | `@vitos-pizza/<module>` or area | One line: what we took or how we use it |
```

For libraries, the Link column can hold the homepage; for features, link the repo, npm page, or Pi package catalog URL.

**Adding a module checklist** — in addition to sync/install, if the module references upstream work, extend README Acknowledgments before merging.

## Development

- No build step — Pi loads TypeScript via jiti.
- After editing extensions: `/reload`.
- Type-check: `npm run typecheck`
- Test: `npm run test`
- Lint: `npm run lint`

## Plan documents

Feature plans should include a short **`## 功能验收`** section (3–6 checkboxes) between the implementation approach and risks/constraints. Each item states an observable outcome, e.g. `xxx 功能已实现：<what the user can verify>`. Implementation is not done until every item can be answered yes/no.

If the plan references external open source, include a checkbox: `README Acknowledgments 已更新（如有上游参考）`.

## Install

```bash
pi install .           # global settings
pi install -l .        # project .pi/settings.json
pi -e .                # try without installing
```

## Extension API

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", { /* ... */ });
  pi.on("session_start", async (_event, ctx) => { /* ... */ });
}
```

See [Pi Extensions docs](https://pi.dev/docs/latest/extensions).
