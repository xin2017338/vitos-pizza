import { afterEach, describe, expect, it } from "vitest";
import {
	isSubagentChild,
	resolveParentSessionId,
	SUBAGENT_CHILD_ENV,
} from "../src/parent-session.ts";

describe("parent session resolution", () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("detects subagent child env", () => {
		delete process.env[SUBAGENT_CHILD_ENV];
		expect(isSubagentChild()).toBe(false);
		process.env[SUBAGENT_CHILD_ENV] = "1";
		expect(isSubagentChild()).toBe(true);
	});

	it("resolves parent session from PI_SUBAGENT_PARENT_SESSION", () => {
		delete process.env.PI_SUBAGENT_PARENT_SESSION;
		delete process.env.PI_AGENT_ROUTER_PARENT_SESSION_ID;
		expect(resolveParentSessionId()).toBeNull();
		process.env.PI_SUBAGENT_PARENT_SESSION = "parent-abc";
		expect(resolveParentSessionId()).toBe("parent-abc");
	});
});
