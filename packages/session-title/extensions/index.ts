/**
 * @vitos-pizza/session-title — async session auto-naming for Vito's Pizzeria.
 */

import type {
	AgentEndEvent,
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { extractTitleContext } from "../src/extract-title-context.ts";
import { loadAutoTitleSettings } from "../src/load-settings.ts";
import { resolveTitleModelRef } from "../src/resolve-title-model.ts";
import { scheduleTitleJob } from "../src/schedule-title-job.ts";
import { decideSchedule } from "../src/should-schedule.ts";
import { createTitleAgent } from "../src/title-agent.ts";
import type { AutoTitleSettings } from "../src/types.ts";

type EventHandler = (event: unknown, ctx: ExtensionContext) => void;

export interface SessionTitleDeps {
	loadSettings?: (cwd: string) => AutoTitleSettings;
	createAgent?: typeof createTitleAgent;
}

export interface SessionTitleTestHarness {
	handlers: {
		agent_end?: EventHandler;
		session_start?: EventHandler;
		session_shutdown?: EventHandler;
	};
}

function tryScheduleFromAgentEnd(
	event: AgentEndEvent,
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: {
		titleSettled: boolean;
		jobState: { inFlight: boolean };
		abortController: AbortController;
		settings: AutoTitleSettings;
	},
	deps: SessionTitleDeps,
): void {
	if (state.titleSettled || !state.settings.enabled) return;

	const titleContext = extractTitleContext(event.messages);
	if (!titleContext) return;

	const decision = decideSchedule(titleContext.userMessage, {
		hasSessionName: Boolean(pi.getSessionName()),
		inFlight: state.jobState.inFlight,
		fastRules: state.settings.fastRules,
		minCharsForLlm: state.settings.minCharsForLlm,
	});

	if (decision !== "schedule") return;

	const agentFactory = deps.createAgent ?? createTitleAgent;
	const agent = agentFactory({
		events: pi.events,
		resolveModelRef: () => resolveTitleModelRef(ctx, state.settings.model),
		settings: state.settings,
	});

	scheduleTitleJob(
		{
			agent,
			context: titleContext,
			signal: state.abortController.signal,
			sessionName: {
				getSessionName: () => pi.getSessionName(),
				setSessionName: (name) => pi.setSessionName(name),
			},
			maxTitleLength: state.settings.maxTitleLength,
			onSettled: () => {
				state.titleSettled = true;
			},
		},
		state.jobState,
	);
}

export function registerSessionTitle(
	pi: ExtensionAPI,
	deps: SessionTitleDeps = {},
): SessionTitleTestHarness {
	const handlers: SessionTitleTestHarness["handlers"] = {};
	let titleSettled = false;
	const jobState = { inFlight: false };
	let abortController = new AbortController();
	let settings = loadAutoTitleSettings(process.cwd());

	const getState = () => ({
		titleSettled,
		jobState,
		abortController,
		settings,
	});

	handlers.agent_end = (event, ctx) => {
		settings = (deps.loadSettings ?? loadAutoTitleSettings)(ctx.cwd);
		if (pi.getSessionName()) {
			titleSettled = true;
			return;
		}

		tryScheduleFromAgentEnd(event as AgentEndEvent, pi, ctx, getState(), deps);
	};

	pi.on("agent_end", handlers.agent_end);

	handlers.session_start = (_event, ctx) => {
		abortController.abort();
		abortController = new AbortController();
		titleSettled = false;
		jobState.inFlight = false;
		settings = (deps.loadSettings ?? loadAutoTitleSettings)(ctx.cwd);
		if (pi.getSessionName()) {
			titleSettled = true;
		}
	};

	pi.on("session_start", handlers.session_start);

	handlers.session_shutdown = () => {
		abortController.abort();
	};

	pi.on("session_shutdown", handlers.session_shutdown);

	return { handlers };
}

export default function sessionTitleExtension(pi: ExtensionAPI) {
	registerSessionTitle(pi);
}
