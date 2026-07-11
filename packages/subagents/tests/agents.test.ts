import { describe, expect, it } from "vitest";
import {
	discoverAgents,
	formatAvailableAgents,
	getBuiltinAgentsDir,
	isPublicAgent,
} from "../src/agents.ts";

describe("discoverAgents", () => {
	it("loads builtin scout, planner, and worker agents", () => {
		const { agents, builtinAgentsDir } = discoverAgents(process.cwd(), "both");
		expect(builtinAgentsDir).toBe(getBuiltinAgentsDir());
		const names = agents.map((agent) => agent.name).sort();
		expect(names).toEqual(["planner", "scout", "title", "worker"]);
	});

	it("hides the title agent from public listings", () => {
		const { agents } = discoverAgents(process.cwd(), "both");
		expect(isPublicAgent("title")).toBe(false);
		expect(formatAvailableAgents(agents)).not.toContain("title");
		expect(formatAvailableAgents(agents)).toContain("scout");
	});

	it("prefers builtin agents over duplicates", () => {
		const scout = discoverAgents(process.cwd(), "both").agents.find(
			(agent) => agent.name === "scout",
		);
		expect(scout?.source).toBe("builtin");
		expect(scout?.tools).toContain("read");
	});

	it("gives scout plan-friendly tools including question", () => {
		const scout = discoverAgents(process.cwd(), "both").agents.find(
			(agent) => agent.name === "scout",
		);
		expect(scout?.tools).toContain("question");
		expect(scout?.tools).toContain("web_search");
		expect(scout?.tools).not.toContain("bash");
		expect(scout?.tools).not.toContain("write");
	});
});
