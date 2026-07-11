import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("loadConfig", () => {
	const originalHome = process.env.HOME;
	const originalUserProfile = process.env.USERPROFILE;
	let tempHome = "";
	let tempProject = "";

	beforeEach(() => {
		tempHome = mkdtempSync(join(tmpdir(), "vitos-websearch-home-"));
		tempProject = mkdtempSync(join(tmpdir(), "vitos-websearch-project-"));
		process.env.HOME = tempHome;
		process.env.USERPROFILE = tempHome;
		vi.resetModules();
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		process.env.USERPROFILE = originalUserProfile;
		delete process.env.SEARCH_TAVILY_API_KEY;
		vi.resetModules();
	});

	it("uses built-in defaults when no config files exist", async () => {
		const { loadConfig } = await import("../src/config.ts");
		const config = loadConfig(tempProject);
		expect(config.backends?.exa_mcp?.enabled).toBe(true);
		expect(config.backends?.firecrawl?.enabled).toBe(true);
		expect(config.backends?.tavily?.enabled).toBeUndefined();
	});

	it("merges project config over global config", async () => {
		const globalDir = join(tempHome, ".pi", "agent", "extensions");
		mkdirSync(globalDir, { recursive: true });
		writeFileSync(
			join(globalDir, "search.json"),
			JSON.stringify({
				backends: {
					tavily: { enabled: true, apiKey: "TAVILY_API_KEY" },
				},
			}),
		);

		const projectDir = join(tempProject, ".pi");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(
			join(projectDir, "search.json"),
			JSON.stringify({
				backends: {
					brave: { enabled: true, apiKey: "BRAVE_API_KEY" },
				},
			}),
		);

		const { loadConfig } = await import("../src/config.ts");
		const config = loadConfig(tempProject);
		expect(config.backends?.tavily?.enabled).toBe(true);
		expect(config.backends?.brave?.enabled).toBe(true);
		expect(config.backends?.exa_mcp?.enabled).toBe(true);
	});

	it("auto-enables backend when convenience env var is set", async () => {
		process.env.SEARCH_TAVILY_API_KEY = "tvly-test";
		const { loadConfig } = await import("../src/config.ts");
		const config = loadConfig(tempProject);
		expect(config.backends?.tavily?.enabled).toBe(true);
	});
});
