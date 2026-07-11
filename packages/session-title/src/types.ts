export type ScheduleDecision = "skip" | "fastReject" | "schedule";

export interface AutoTitleSettings {
	enabled: boolean;
	model?: string;
	minCharsForLlm: number;
	fastRules: boolean;
	maxInputChars: number;
	maxOutputTokens: number;
	timeoutMs: number;
	maxTitleLength: number;
}

export const DEFAULT_AUTO_TITLE_SETTINGS: AutoTitleSettings = {
	enabled: true,
	minCharsForLlm: 4,
	fastRules: true,
	maxInputChars: 280,
	maxOutputTokens: 24,
	timeoutMs: 8000,
	maxTitleLength: 20,
};

export interface ScheduleContext {
	hasSessionName: boolean;
	inFlight: boolean;
	fastRules: boolean;
	minCharsForLlm: number;
}
