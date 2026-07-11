import { describe, expect, it } from "vitest";
import {
	isEmojiOnly,
	isPurePunctuation,
	isRepeatedSingleChar,
	isTooShort,
	matchesFastReject,
} from "../src/fast-rules.ts";

describe("fast-rules", () => {
	it("flags short greetings", () => {
		expect(isTooShort("你好", 4)).toBe(true);
		expect(isTooShort("hi", 4)).toBe(true);
		expect(isTooShort("修复 auth", 4)).toBe(false);
	});

	it("flags punctuation-only input", () => {
		expect(isPurePunctuation("???")).toBe(true);
		expect(isPurePunctuation("fix bug")).toBe(false);
	});

	it("flags emoji-only input", () => {
		expect(isEmojiOnly("👋")).toBe(true);
		expect(isEmojiOnly("👋🙂")).toBe(true);
	});

	it("flags repeated single characters", () => {
		expect(isRepeatedSingleChar("aaa")).toBe(true);
		expect(isRepeatedSingleChar("abc")).toBe(false);
	});

	it("matches fast reject cases", () => {
		expect(
			matchesFastReject("你好", { minCharsForLlm: 4, fastRules: true }),
		).toBe(true);
		expect(
			matchesFastReject("修复登录 bug", { minCharsForLlm: 4, fastRules: true }),
		).toBe(false);
		expect(
			matchesFastReject("hi", { minCharsForLlm: 4, fastRules: false }),
		).toBe(false);
	});
});
