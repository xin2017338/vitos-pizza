import type { TitleNamingContext } from "./extract-title-context.ts";
import { fallbackTitleFromPrompt, normalizeTitle } from "./normalize-title.ts";
import type { TitleAgent } from "./title-agent.ts";

export interface SessionNameApi {
	getSessionName: () => string | undefined;
	setSessionName: (name: string) => void;
}

export interface TitleJob {
	agent: TitleAgent;
	context: TitleNamingContext;
	signal: AbortSignal;
	sessionName: SessionNameApi;
	maxTitleLength: number;
	onSettled?: () => void;
}

export interface TitleJobState {
	inFlight: boolean;
}

export function scheduleTitleJob(job: TitleJob, state: TitleJobState): void {
	if (state.inFlight) return;
	state.inFlight = true;

	void job.agent
		.run(job.context, job.signal)
		.then((title) => {
			if (job.signal.aborted) return;
			if (job.sessionName.getSessionName()) return;
			if (title) {
				job.sessionName.setSessionName(title);
				job.onSettled?.();
				return;
			}
		})
		.catch(() => {
			if (job.signal.aborted) return;
			if (job.sessionName.getSessionName()) return;
			const fallback = normalizeTitle(
				fallbackTitleFromPrompt(job.context.userMessage, job.maxTitleLength),
				job.maxTitleLength,
			);
			if (fallback) {
				job.sessionName.setSessionName(fallback);
				job.onSettled?.();
			}
		})
		.finally(() => {
			state.inFlight = false;
		});
}
