---
name: subagents
description: Delegate exploration, planning, and implementation to Vito's Pizzeria subagents (scout, planner, worker).
---

# Subagents (Vito's Pizzeria)

Use the `subagent` tool to delegate work to focused child agents with isolated context.

## Agent modes

Vito's Pizzeria uses three modes via `/mode` or `F6`:

| Mode | When to use |
|------|-------------|
| **agent** | Default balanced work |
| **plan** | Read-only planning — planner (+ optional scout), `question` for clarification; optional short **Next** footer |
| **execute** | Full implementation after plan is approved |

In **plan** mode the main agent cannot write/edit/bash. Delegate with subagents. Scout is optional — use it only when codebase recon is needed; otherwise call planner directly. When recon spans independent areas, run multiple scouts in parallel (`tasks: [...]`) then planner:

```
[optional scout(s) →] planner → (user confirms) → switch to execute → worker
```

## Built-in agents

| Agent | Use when |
|-------|----------|
| `scout` | Fast codebase recon; returns compressed context |
| `planner` | Turn context + requirements into an implementation plan |
| `worker` | Execute an approved plan with narrow, correct edits |
| `title` | Generate short session titles (used by `@vitos-pizza/session-title`) |

## Typical workflow

```
[optional scout →] planner → worker
```

### Planner only (enough context)

```json
{ "agent": "planner", "task": "Create an implementation plan for ..." }
```

### Chain with scout (when recon is needed)

```json
{
  "chain": [
    { "agent": "scout", "task": "Map the auth module and key entry points" },
    { "agent": "planner", "task": "Create a plan based on {previous}" },
    { "agent": "worker", "task": "Implement the plan from {previous}" }
  ]
}
```

### Parallel

```json
{
  "tasks": [
    { "agent": "scout", "task": "Scan packages/subagents" },
    { "agent": "scout", "task": "Scan packages/permission-system" }
  ]
}
```

### Async + wait

Start work in the background, then block until it finishes:

```json
{ "agent": "worker", "task": "...", "async": true }
```

```json
{ "id": "<runId>" }
```

via the `wait` tool.

## External modules

Other Vito's Pizzeria extensions can request subagent runs via `pi.events` RPC (`subagents:rpc:run`). Import helpers from `@vitos-pizza/subagents/rpc/client` if needed.
