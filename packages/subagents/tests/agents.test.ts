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
		expect(scout?.tools).toContain("hypa_read");
	});

	it("gives scout plan-friendly tools including question and hypa reads only", () => {
		const scout = discoverAgents(process.cwd(), "both").agents.find(
			(agent) => agent.name === "scout",
		);
		expect(scout?.tools).toContain("question");
		expect(scout?.tools).toContain("web_search");
		expect(scout?.tools).toContain("hypa_read");
		expect(scout?.tools).toContain("hypa_grep");
		expect(scout?.tools).toContain("hypa_find");
		expect(scout?.tools).toContain("hypa_ls");
		expect(scout?.tools).not.toContain("read");
		expect(scout?.tools).not.toContain("grep");
		expect(scout?.tools).not.toContain("find");
		expect(scout?.tools).not.toContain("ls");
		expect(scout?.tools).not.toContain("bash");
		expect(scout?.tools).not.toContain("write");
		expect(scout?.tools).not.toContain("hypa_shell");
	});

	it("gives planner hypa reads only plus write and question", () => {
		const planner = discoverAgents(process.cwd(), "both").agents.find(
			(agent) => agent.name === "planner",
		);
		expect(planner?.tools).toContain("hypa_read");
		expect(planner?.tools).toContain("write");
		expect(planner?.tools).toContain("question");
		expect(planner?.tools).not.toContain("read");
		expect(planner?.tools).not.toContain("grep");
		expect(planner?.tools).not.toContain("find");
		expect(planner?.tools).not.toContain("ls");
		expect(planner?.tools).not.toContain("bash");
		expect(planner?.tools).not.toContain("hypa_shell");
	});

	it("gives worker hypa reads plus bash without hypa_shell or builtin reads", () => {
		const worker = discoverAgents(process.cwd(), "both").agents.find(
			(agent) => agent.name === "worker",
		);
		expect(worker?.tools).toContain("bash");
		expect(worker?.tools).toContain("edit");
		expect(worker?.tools).toContain("write");
		expect(worker?.tools).toContain("hypa_read");
		expect(worker?.tools).not.toContain("read");
		expect(worker?.tools).not.toContain("grep");
		expect(worker?.tools).not.toContain("find");
		expect(worker?.tools).not.toContain("ls");
		expect(worker?.tools).not.toContain("hypa_shell");
	});
});
