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
		const mode = detectPresetMode(
			{
				"*": "allow",
				read: "allow",
				grep: "allow",
				find: "allow",
				ls: "allow",
				web_search: "ask",
				web_read: "ask",
				path: {
					"*": "allow",
					"*.env": "deny",
					"*.env.*": "deny",
					"*.env.example": "allow",
					"~/.ssh/*": "deny",
				},
				bash: {
					"*": "ask",
					"git status": "allow",
					"git status *": "allow",
					"git diff": "allow",
					"git diff *": "allow",
					"git log": "allow",
					"git log *": "allow",
					ls: "allow",
					"ls *": "allow",
					"npm test": "allow",
					"npm test *": "allow",
					"npm run typecheck": "allow",
					"npm run lint": "allow",
					"rm -rf *": "deny",
					"sudo *": "ask",
				},
				external_directory: "ask",
			},
			presetsDir,
		);
		expect(mode).toBe("default");
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
