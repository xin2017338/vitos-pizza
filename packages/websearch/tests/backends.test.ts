import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBrave, parseFirecrawl, parseTavily } from "../src/parsers.ts";

describe("parsers", () => {
	it("parses Tavily results", () => {
		const results = parseTavily(
			{
				results: [
					{ title: "Tavily", url: "https://tavily.test", content: "Body" },
				],
			},
			5,
		);
		expect(results[0]?.title).toBe("Tavily");
		expect(results[0]?.snippet).toBe("Body");
	});

	it("parses Brave results", () => {
		const results = parseBrave(
			{
				web: {
					results: [
						{
							title: "Brave",
							url: "https://brave.test",
							description: "Snippet",
						},
					],
				},
			},
			5,
		);
		expect(results[0]?.url).toBe("https://brave.test");
	});

	it("parses Firecrawl v2 web results", () => {
		const results = parseFirecrawl(
			{
				data: {
					web: [
						{
							title: "Firecrawl",
							url: "https://firecrawl.test",
							description: "Hi",
						},
					],
				},
			},
			5,
		);
		expect(results[0]?.title).toBe("Firecrawl");
	});
});

describe("searchExaMCP", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses MCP JSON search results", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				jsonrpc: "2.0",
				id: 1,
				result: {
					content: [
						{
							type: "text",
							text: JSON.stringify([
								{
									title: "Exa",
									url: "https://exa.test",
									snippet: "Found",
								},
							]),
						},
					],
				},
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		const { searchExaMCP } = await import("../src/backends/exa-mcp.ts");
		const result = await searchExaMCP("exa query", 3);
		expect(result.results[0]?.url).toBe("https://exa.test");
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});

describe("validateUrl", () => {
	it("rejects localhost URLs", async () => {
		const { validateUrl } = await import("../src/utils.ts");
		expect(validateUrl("http://localhost/docs")).toBe(
			"Localhost URLs are not allowed",
		);
	});

	it("allows public HTTPS URLs", async () => {
		const { validateUrl } = await import("../src/utils.ts");
		expect(validateUrl("https://example.com/docs")).toBeNull();
	});
});
