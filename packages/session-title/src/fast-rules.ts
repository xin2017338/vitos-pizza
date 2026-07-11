const PUNCTUATION_ONLY = /^[\p{P}\p{S}\s]+$/u;

export function codePointLength(text: string): number {
	return [...text].length;
}

export function isTooShort(text: string, minChars: number): boolean {
	const trimmed = text.trim();
	if (!trimmed) return true;
	return codePointLength(trimmed) < minChars;
}

export function isPurePunctuation(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	return PUNCTUATION_ONLY.test(trimmed);
}

export function isEmojiOnly(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	const withoutJoiners = trimmed.replace(/[\uFE0F\u200D]/g, "");
	return /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s]+$/u.test(
		withoutJoiners,
	);
}

export function isRepeatedSingleChar(text: string, minRepeat = 3): boolean {
	const trimmed = text.trim();
	if (codePointLength(trimmed) < minRepeat) return false;
	const chars = [...trimmed];
	return chars.every((char) => char === chars[0]);
}

export function matchesFastReject(
	text: string,
	options: { minCharsForLlm: number; fastRules: boolean },
): boolean {
	if (!options.fastRules) return false;
	const trimmed = text.trim();
	if (!trimmed) return false;
	return (
		isTooShort(trimmed, options.minCharsForLlm) ||
		isPurePunctuation(trimmed) ||
		isEmojiOnly(trimmed) ||
		isRepeatedSingleChar(trimmed)
	);
}
