export interface BashCommandUnit {
	text: string;
	opaque?: boolean;
}

const OPAQUE_WRAPPER_RE = /^(?:bash|sh|zsh|dash|eval)\s+(?:-c\b|eval\b)/;

export function isTriviallyEmptyCommand(command: string): boolean {
	const lines = command.split("\n").map((line) => line.trim());
	return lines.every((line) => line.length === 0 || line.startsWith("#"));
}

export function splitBashProgram(command: string): BashCommandUnit[] {
	const trimmed = command.trim();
	if (!trimmed || isTriviallyEmptyCommand(trimmed)) return [];
	if (isClearlyInvalidCommand(trimmed)) return [];

	const segments = trimmed
		.split(/(?:&&|\|\||;|\n)/)
		.map((part) => part.trim())
		.filter(Boolean);

	if (segments.length === 0) return [];

	return segments.map((text) => ({
		text,
		opaque: OPAQUE_WRAPPER_RE.test(text),
	}));
}

export function enumerateBashCommands(command: string): BashCommandUnit[] {
	const units = splitBashProgram(command);
	if (units.length > 0) return units;
	if (isTriviallyEmptyCommand(command)) return [];
	return [];
}

function isClearlyInvalidCommand(command: string): boolean {
	return /^[{}<>]+$/.test(command.trim());
}
