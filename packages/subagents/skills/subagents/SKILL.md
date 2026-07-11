---
name: subagents
description: Delegate exploration, planning, and implementation to Vito's Pizzeria subagents (scout, planner, worker).
---

# Subagents (Vito's Pizzeria)

Use the `subagent` tool to delegate work to focused child agents with isolated context.

## Modes

| Mode | Constraint |
|------|------------|
| **plan** | Read-only. Scout (optional) → planner. Never call worker. |
| **agent** / **execute** | May call worker after a plan is approved (or for focused implementation). |

## Built-in agents

| Agent | Use when |
|-------|----------|
| `scout` | Fast codebase recon; compressed context for handoff |
| `planner` | Turn context + requirements into an implementation plan |
| `worker` | Execute an approved plan with narrow, correct edits |

## Plan-mode examples

### Planner only

```json
{ "agent": "planner", "task": "Create an implementation plan for ..." }
```

### Scout → planner

```json
{
  "chain": [
    { "agent": "scout", "task": "Map the auth module and key entry points" },
    { "agent": "planner", "task": "Create a plan based on {previous}" }
  ]
}
```

### Parallel scouts

```json
{
  "tasks": [
    { "agent": "scout", "task": "Scan packages/subagents" },
    { "agent": "scout", "task": "Scan packages/permission-system" }
  ]
}
```

Then call planner with the combined findings.

## After plan approval (agent / execute)

### Chain through worker

```json
{
  "chain": [
    { "agent": "scout", "task": "Map relevant code" },
    { "agent": "planner", "task": "Create a plan based on {previous}" },
    { "agent": "worker", "task": "Implement the plan from {previous}" }
  ]
}
```

### Async + wait

```json
{ "agent": "worker", "task": "...", "async": true }
```

```json
{ "id": "<runId>" }
```

via the `wait` tool.

## External modules

Other Vito's Pizzeria extensions can request subagent runs via `pi.events` RPC (`subagents:rpc:run`). Import helpers from `@vitos-pizza/subagents/rpc/client` if needed.
