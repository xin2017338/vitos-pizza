export const PLAN_MODE_TOOLS = [
	"read",
	"grep",
	"find",
	"ls",
	"question",
	"subagent",
	"wait",
	"web_search",
	"web_read",
] as const;

export const PLAN_INSTRUCTIONS = `## PLAN MODE

You are in **plan** mode. Do not call write, edit, or bash on the main agent.

**Planning workflow**
- Mutually exclusive design choices (2–5 options) → always use the \`question\` tool; do not ask in free text
- Produce an Implementation Plan and wait for user confirmation
- Do **not** call worker or edit code directly in this mode

**When to explore**
- Scout is **optional**. Skip it when the task is clear, scoped to known files, or the user already provided enough context
- Call scout only when you need codebase recon (unfamiliar area, many files, unclear entry points)
- Independent areas → parallel scouts via \`subagent({ tasks: [...] })\` to finish recon faster; then planner
- For light lookups, the main agent may use read/grep/find/ls directly — no scout required

**Delegation**
- Enough context already → \`subagent({ agent: "planner", task: "..." })\`
- Need recon first → \`subagent({ chain: [{ agent: "scout", task: "..." }, { agent: "planner", task: "..." }] })\`
- Multi-area recon → parallel scouts, then planner with the combined findings

**After the plan (optional)**
When helpful, add a short **Next** footer — Cursor-style suggested actions. Skip it if the next step is already obvious.
- 2–3 bullets max; each one line
- Concrete verbs the user can reply with (e.g. confirm → \`/mode execute\`, tweak scope)
- No essays, no restating the whole plan

Example:
\`\`\`
**Next**
- Confirm → \`/mode execute\` (or F6) to implement
- Say what to change if the scope is off
\`\`\`

**To implement**, the user must switch to execute or agent mode (\`/mode execute\` or \`/mode agent\`).`;

export const PLAN_MODE_MESSAGE = `[PLAN MODE ACTIVE]

You are in plan mode. The main agent must NOT write, edit, or run bash.

1. Mutually exclusive choices → \`question\` tool (not free-text "which do you prefer?")
2. Scout only if needed; parallel scouts (\`tasks: [...]\`) when exploring independent areas; otherwise go straight to planner
3. Return the plan and wait; optionally a short **Next** footer (2–3 one-line actions) when helpful
4. Do NOT call worker or make code changes

Planner only (no scout):
\`\`\`json
{ "agent": "planner", "task": "Create an implementation plan for ..." }
\`\`\`

Scout → planner (when recon is needed):
\`\`\`json
{
  "chain": [
    { "agent": "scout", "task": "Map relevant code for this task" },
    { "agent": "planner", "task": "Create an implementation plan from {previous}" }
  ]
}
\`\`\`

Parallel scouts (independent areas), then planner:
\`\`\`json
{
  "tasks": [
    { "agent": "scout", "task": "Map area A" },
    { "agent": "scout", "task": "Map area B" }
  ]
}
\`\`\`
Then \`subagent({ agent: "planner", task: "Plan from the scout findings above" })\`.`;

export const PLAN_MODE_ENDED_MESSAGE = `[PLAN MODE ENDED]

You left plan mode. write, edit, and bash are available again according to the current mode (agent or execute). Do not treat earlier [PLAN MODE ACTIVE] messages as still in effect.`;
