import { expandHomePath } from "./expand-home.ts";

export type CompiledWildcardPattern<TState> = {
	pattern: string;
	state: TState;
	regex: RegExp;
};

export type WildcardPatternMatch<TState> = {
	state: TState;
	matchedPattern: string;
	matchedName: string;
};

export interface WildcardMatchOptions {
	caseInsensitive?: boolean;
	windowsSeparators?: boolean;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileWildcardPattern<TState>(
	pattern: string,
	state: TState,
	options?: WildcardMatchOptions,
): CompiledWildcardPattern<TState> {
	let expanded = expandHomePath(pattern);
	if (options?.windowsSeparators) {
		expanded = expanded.replaceAll("/", "\\");
	}
	let escaped = expanded
		.split("*")
		.map((part) => escapeRegExp(part).replaceAll("\\?", "."))
		.join(".*");

	if (escaped.endsWith(" .*")) {
		escaped = `${escaped.slice(0, -3)}( .*)?`;
	}

	return {
		pattern,
		state,
		regex: new RegExp(`^${escaped}$`, options?.caseInsensitive ? "si" : "s"),
	};
}

export function compileWildcardPatternEntries<TState>(
	entries: Iterable<readonly [string, TState]>,
	options?: WildcardMatchOptions,
): CompiledWildcardPattern<TState>[] {
	return Array.from(entries, ([pattern, state]) =>
		compileWildcardPattern(pattern, state, options),
	);
}

export function findCompiledWildcardMatch<TState>(
	patterns: readonly CompiledWildcardPattern<TState>[],
	name: string,
): WildcardPatternMatch<TState> | null {
	for (let index = patterns.length - 1; index >= 0; index -= 1) {
		const pattern = patterns[index];
		if (pattern.regex.test(name)) {
			return {
				state: pattern.state,
				matchedPattern: pattern.pattern,
				matchedName: name,
			};
		}
	}
	return null;
}

export function wildcardMatch(
	pattern: string,
	value: string,
	options?: WildcardMatchOptions,
): boolean {
	return compileWildcardPattern(pattern, null, options).regex.test(value);
}
