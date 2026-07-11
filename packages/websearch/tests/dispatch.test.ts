import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("runSearchWithFallback", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns results from the first successful backend", async () => {
		vi.doMock("../src/backends/registry.ts", () => ({
			runBackend: vi
				.fn()
				.mockRejectedValueOnce(new Error("rate limited"))
				.mockResolvedValueOnce([
					{ title: "Example", url: "https://example.com", snippet: "Snippet" },
				]),
		}));
		vi.doMock("../src/config.ts", () => ({
			getActiveBackends: () => ["exa_mcp", "firecrawl"],
		}));

		const { runSearchWithFallback } = await import("../src/dispatch.ts");
		const result = await runSearchWithFallback("test query", 5, {});
		expect(result.backend).toBe("firecrawl");
		expect(result.results).toHaveLength(1);
		expect(result.errors).toHaveLength(1);
	});

	it("throws when all backends fail", async () => {
		vi.doMock("../src/backends/registry.ts", () => ({
			runBackend: vi.fn().mockRejectedValue(new Error("down")),
		}));
		vi.doMock("../src/config.ts", () => ({
			getActiveBackends: () => ["exa_mcp", "firecrawl"],
		}));

		const { runSearchWithFallback } = await import("../src/dispatch.ts");
		await expect(runSearchWithFallback("test query", 5, {})).rejects.toThrow(
			/All search backends failed/,
		);
	});

	it("uses a specific backend when requested", async () => {
		const runBackend = vi
			.fn()
			.mockResolvedValue([
				{ title: "Brave", url: "https://brave.example", snippet: "ok" },
			]);
		vi.doMock("../src/backends/registry.ts", () => ({ runBackend }));
		vi.doMock("../src/config.ts", () => ({
			getActiveBackends: () => ["exa_mcp"],
		}));

		const { runSearchWithFallback } = await import("../src/dispatch.ts");
		const result = await runSearchWithFallback("test query", 3, {
			backend: "brave",
		});
		expect(runBackend).toHaveBeenCalledWith(
			"brave",
			"test query",
			3,
			undefined,
		);
		expect(result.backend).toBe("brave");
	});
});
