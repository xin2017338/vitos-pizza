export const PLAN_MODE_TOOLS = [
	"read",
	"grep",
	"find",
	"ls",
	"hypa_read",
	"hypa_grep",
	"hypa_find",
	"hypa_ls",
	"question",
	"subagent",
	"wait",
	"web_search",
	"web_read",
] as const;

export const PLAN_INSTRUCTIONS = `## PLAN MODE

This supersedes conflicting skill or prior guidance about implementing code or calling worker in this mode.

**Hard rules**
- Main agent: no write, edit, or bash. Do not call worker.
- Produce an Implementation Plan and wait for confirmation.
- To implement, the user switches via \`/mode execute\` or \`/mode agent\`.

**Clarification**
- Prefer \`question\` for mutually exclusive choices (2–5 options); skip when context is enough. Available to main, scout, and planner.

**Exploration**
- Scout is optional — only for unfamiliar or multi-file recon. Parallel scouts via \`subagent({ tasks: [...] })\` for independent areas, then planner.
- Prefer \`hypa_read\` / \`hypa_grep\` / \`hypa_find\` / \`hypa_ls\` when available; fall back to read/grep/find/ls.
- Web tools only for current external facts outside the repo.

**Delegation**
- Enough context → \`subagent({ agent: "planner", task })\`
- Need recon → \`subagent({ chain: [scout, planner] })\`

**Optional Next footer** (2–3 one-line reply verbs) when the next step is not obvious:

\`\`\`
**Next**
- Confirm → \`/mode execute\` (or Ctrl+. / Alt+M)
- Say what to change if scope is off
\`\`\``;

export const PLAN_MODE_MESSAGE = `[PLAN MODE ACTIVE]

Read-only planning. No write/edit/bash/worker.
Clarify with \`question\` when needed. Scout only if recon is required; otherwise planner.
Prefer hypa_* read tools when available. Return the plan and wait; optionally a short **Next** footer.`;

export const PLAN_MODE_ENDED_MESSAGE = `[PLAN MODE ENDED]

You left plan mode. write, edit, and bash are available again according to the current mode (agent or execute). Do not treat earlier [PLAN MODE ACTIVE] messages as still in effect.`;
