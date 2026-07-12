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
- Scout/planner use \`hypa_read\` / \`hypa_grep\` / \`hypa_find\` / \`hypa_ls\` only. Main session: prefer hypa_*; fall back to read/grep/find/ls if needed.
- Web tools only for current external facts outside the repo.

**Delegation**
- Enough context → \`subagent({ agent: "planner", task })\`
- Need recon → \`subagent({ chain: [scout, planner] })\`

**Optional open-questions footer** (2–4 one-line prompts) only when the plan may miss scope or adjacent capabilities the user has not clarified. Soft guidance — not next-steps, not mode-switching:

\`\`\`
**Worth considering**
- <gap or adjacent capability the user may not have decided yet>?
- <in/out of scope this round>?
\`\`\`

Rules:
- Ask about omissions, edge cases, related features, or "do you also need X?"
- Do NOT list mode-switching or how-to-proceed verbs (e.g. \`/mode execute\`, Ctrl+.)
- Do NOT restate the plan as todos
- Prefer \`question\` for mutually exclusive choices; use this footer for soft, optional prompts
- Skip the footer when scope is already clear`;

export const PLAN_MODE_MESSAGE = `[PLAN MODE ACTIVE]

Read-only planning. No write/edit/bash/worker.
Clarify with \`question\` when needed. Scout only if recon is required; otherwise planner.
Prefer hypa_* read tools when available. Return the plan and wait; optionally a short **Worth considering** footer for gaps/adjacent capabilities.`;

export const PLAN_MODE_ENDED_MESSAGE = `[PLAN MODE ENDED]

You left plan mode. write, edit, and bash are available again according to the current mode (agent or execute). Do not treat earlier [PLAN MODE ACTIVE] messages as still in effect.`;
