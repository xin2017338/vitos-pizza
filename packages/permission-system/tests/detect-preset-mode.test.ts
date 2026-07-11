import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectPresetMode } from "../src/detect-preset-mode.ts";

const presetsDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"presets",
);

describe("detect-preset-mode", () => {
	it("recognizes bundled default preset", () => {
		const defaultPreset = JSON.parse(
			readFileSync(join(presetsDir, "default.json"), "utf8"),
		) as { permission: Record<string, unknown> };

		expect(detectPresetMode(defaultPreset.permission, presetsDir)).toBe(
			"default",
		);
		expect(defaultPreset.permission.hypa_read).toBe("allow");
		expect(defaultPreset.permission.hypa_mcp_proxy).toBe("deny");
	});

	it("recognizes bundled plan preset", () => {
		const planPreset = JSON.parse(
			readFileSync(join(presetsDir, "plan.json"), "utf8"),
		) as { permission: Record<string, unknown> };

		expect(detectPresetMode(planPreset.permission, presetsDir)).toBe("plan");
		expect(planPreset.permission.web_search).toBe("ask");
		expect(planPreset.permission.web_read).toBe("ask");
	});

	it("returns custom for unknown policy shape", () => {
		expect(detectPresetMode({ "*": "deny" }, presetsDir)).toBe("custom");
	});
});
