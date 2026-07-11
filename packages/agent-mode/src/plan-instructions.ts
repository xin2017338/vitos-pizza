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
- Default path: \`subagent({ chain: [{ agent: "scout", task: "..." }, { agent: "planner", task: "..." }] })\`
- Use the \`question\` tool when requirements are unclear
- Produce an Implementation Plan and wait for user confirmation
- Do **not** call worker or edit code directly in this mode

**To implement**, the user must switch to execute or agent mode (\`/mode execute\` or \`/mode agent\`).`;

export const PLAN_MODE_MESSAGE = `[PLAN MODE ACTIVE]

You are in plan mode. The main agent must NOT write, edit, or run bash.

For any task that needs codebase exploration or an implementation plan, you MUST delegate to subagents:

1. Call \`subagent\` with a scout → planner chain (do not only use read/grep yourself)
2. Use \`question\` when requirements are unclear
3. Return the planner's output and wait for user confirmation
4. Do NOT call worker or make code changes

Example:
\`\`\`json
{
  "chain": [
    { "agent": "scout", "task": "Map relevant code for this task" },
    { "agent": "planner", "task": "Create an implementation plan from {previous}" }
  ]
}
\`\`\``;
