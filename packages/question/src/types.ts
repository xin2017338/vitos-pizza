export type SelectType = "single" | "multi";

export interface QuestionOption {
	label: string;
	description?: string;
}

export interface QuestionParams {
	question: string;
	options: QuestionOption[];
	selectType?: SelectType;
}

// --- Multi-question (tabs) types ---

export interface QuestionTab {
	/** Optional stable identifier used as result key; defaults to "q0", "q1", … */
	id?: string;
	/** Tab bar label; defaults to "Q1", "Q2", … */
	title?: string;
	/** The question text shown inside the tab */
	question: string;
	options: QuestionOption[];
	/** "single" (default) or "multi" */
	selectType?: SelectType;
}

export interface MultiQuestionParams {
	questions: QuestionTab[];
}

// --- Answer types ---

/** Single-select answer (one pick) */
export interface SingleTabAnswer {
	answer: string;
	wasCustom: boolean;
	index?: number;
}

/** Multi-select answer (multiple picks) */
export interface MultiTabAnswer {
	answers: string[];
	indices: number[];
}

export type TabAnswer = SingleTabAnswer | MultiTabAnswer;

export type QuestionsParams = QuestionParams | MultiQuestionParams;

/** Returns true if the answer is a multi-select answer */
export function isMultiAnswer(ans: TabAnswer): ans is MultiTabAnswer {
	return "answers" in ans;
}

// --- Result types ---

export interface QuestionDetails {
	question?: string;
	options?: string[];
	answer: string | null;
	wasCustom?: boolean;
	/** Multi-select answers (present when selectType="multi") */
	multiAnswers?: string[];
	multiIndices?: number[];
}

export interface MultiQuestionDetails {
	answers: Record<string, TabAnswer>;
}

export interface QuestionUiResult {
	answer: string;
	wasCustom: boolean;
	index?: number;
	/** Multi-select answers (present when selectType="multi") */
	multiAnswers?: string[];
	multiIndices?: number[];
}

export interface MultiQuestionUiResult {
	answers: Record<string, TabAnswer>;
}

// --- Forwarding types ---

export interface ForwardedQuestionRequest {
	id: string;
	createdAt: number;
	requesterSessionId: string;
	targetSessionId: string;
	/** Single question (legacy) */
	question?: string;
	options?: QuestionOption[];
	selectType?: SelectType;
	/** Multi-question (new) */
	questions?: QuestionTab[];
}

export interface ForwardedQuestionResponse {
	question?: string;
	options?: string[];
	answer?: string | null;
	wasCustom?: boolean;
	/** Multi-select answers */
	multiAnswers?: string[];
	multiIndices?: number[];
	/** Multi-question answers (each value can be single or multi answer) */
	answers?: Record<string, TabAnswer>;
	cancelled?: boolean;
	responderSessionId: string;
	respondedAt: number;
}
