export interface QuestionOption {
	label: string;
	description?: string;
}

export interface QuestionParams {
	question: string;
	options: QuestionOption[];
}

export interface QuestionDetails {
	question: string;
	options: string[];
	answer: string | null;
	wasCustom?: boolean;
}

export interface QuestionUiResult {
	answer: string;
	wasCustom: boolean;
	index?: number;
}

export interface ForwardedQuestionRequest {
	id: string;
	createdAt: number;
	requesterSessionId: string;
	targetSessionId: string;
	question: string;
	options: QuestionOption[];
}

export interface ForwardedQuestionResponse {
	question: string;
	options: string[];
	answer: string | null;
	wasCustom?: boolean;
	cancelled?: boolean;
	responderSessionId: string;
	respondedAt: number;
}
