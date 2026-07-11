import { describe, expect, it } from "vitest";
import { evaluateBashCommand } from "../src/bash/matcher.ts";
import {
	enumerateBashCommands,
	isTriviallyEmptyCommand,
} from "../src/bash/parser.ts";
import { PermissionEvaluator } from "../src/permission-evaluator.ts";

describe("bash parser", () => {
	it("treats comments as trivially empty", () => {
		expect(isTriviallyEmptyCommand("# just a comment")).toBe(true);
	});

	it("splits chained commands", () => {
		expect(enumerateBashCommands("git status && npm test")).toEqual([
			{ text: "git status", opaque: false },
			{ text: "npm test", opaque: false },
		]);
	});

	it("fails closed on unparseable non-empty commands", () => {
		const evaluator = new PermissionEvaluator();
		const result = evaluateBashCommand(
			"{{{{",
			{ "*": "allow", bash: { "*": "allow" } },
			evaluator,
			{},
		);
		expect(result.state).toBe("ask");
		expect(result.matchedPattern).toBe("<unparseable-bash-command>");
	});
});
