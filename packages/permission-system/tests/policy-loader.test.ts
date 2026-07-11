import { describe, expect, it } from "vitest";
import { mergePermissionMaps } from "../src/policy-loader.ts";

describe("policy-loader merge", () => {
	it("merges nested maps and overrides scalars", () => {
		const merged = mergePermissionMaps(
			{
				"*": "allow",
				bash: { "*": "ask", "git status": "allow" },
			},
			{
				write: "ask",
				bash: { "npm install": "deny" },
			},
		);

		expect(merged["*"]).toBe("allow");
		expect(merged.write).toBe("ask");
		expect(merged.bash).toEqual({
			"*": "ask",
			"git status": "allow",
			"npm install": "deny",
		});
	});
});
