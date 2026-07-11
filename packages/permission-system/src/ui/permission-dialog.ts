export type PermissionDecisionState =
	| "approved"
	| "approved_for_session"
	| "denied"
	| "denied_with_reason";

export interface PermissionPromptDecision {
	approved: boolean;
	state: PermissionDecisionState;
	denialReason?: string;
	autoApproved?: true;
	confirmationUnavailable?: true;
}

export interface PermissionDecisionUi {
	select(title: string, options: string[]): Promise<string | undefined>;
	input(title: string, placeholder?: string): Promise<string | undefined>;
}

const APPROVE_OPTION = "Yes";
const APPROVE_FOR_SESSION_OPTION = "Yes, for this session";
const DENY_OPTION = "No";
const DENY_WITH_REASON_OPTION = "No, provide reason";

export async function requestPermissionDecisionFromUi(
	ui: PermissionDecisionUi,
	title: string,
	_message: string,
	options?: { sessionLabel?: string },
): Promise<PermissionPromptDecision> {
	const sessionOption = options?.sessionLabel ?? APPROVE_FOR_SESSION_OPTION;
	const decisionOptions = [
		APPROVE_OPTION,
		sessionOption,
		DENY_OPTION,
		DENY_WITH_REASON_OPTION,
	];
	const selected = await ui.select(title, decisionOptions);
	if (!selected || selected === DENY_OPTION) {
		return { approved: false, state: "denied" };
	}
	if (selected === DENY_WITH_REASON_OPTION) {
		const reason = await ui.input("Reason for denial", "optional");
		return reason
			? { approved: false, state: "denied_with_reason", denialReason: reason }
			: { approved: false, state: "denied" };
	}
	if (selected === sessionOption) {
		return { approved: true, state: "approved_for_session" };
	}
	return { approved: true, state: "approved" };
}
