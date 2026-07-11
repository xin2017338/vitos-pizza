import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_HYPA_PI_CONFIG,
	formatDefaultHypaPiConfig,
	resolveHypaPiConfigPath,
} from "../src/config.ts";
import { seedHypaPiConfigIfMissing } from "../src/seed.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("resolveHypaPiConfigPath", () => {
	it("defaults to ~/.hypa-pi/config.json", () => {
		expect(resolveHypaPiConfigPath({}, "/home/vito")).toBe(
			join("/home/vito", ".hypa-pi", "config.json"),
		);
	});

	it("honors HYPA_PI_CONFIG and skips none/empty", () => {
		expect(
			resolveHypaPiConfigPath({ HYPA_PI_CONFIG: "/tmp/custom.json" }),
		).toBe("/tmp/custom.json");
		expect(resolveHypaPiConfigPath({ HYPA_PI_CONFIG: "none" })).toBeNull();
		expect(resolveHypaPiConfigPath({ HYPA_PI_CONFIG: "" })).toBeNull();
	});
});

describe("seedHypaPiConfigIfMissing", () => {
	it("writes additive defaults once and does not overwrite", () => {
		const dir = mkdtempSync(join(tmpdir(), "vitos-hypa-"));
		tempDirs.push(dir);
		const path = join(dir, "config.json");
		const env = { HYPA_PI_CONFIG: path };

		expect(seedHypaPiConfigIfMissing(env)).toBe(true);
		expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(
			DEFAULT_HYPA_PI_CONFIG,
		);
		expect(formatDefaultHypaPiConfig()).toContain("additive");
		expect(formatDefaultHypaPiConfig()).toContain("mcpProxyEnabled");

		writeFileSync(path, '{"mode":"replace"}\n', "utf8");
		expect(seedHypaPiConfigIfMissing(env)).toBe(false);
		expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
			mode: "replace",
		});
	});
});
