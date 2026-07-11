import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootPkg = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), "../../../package.json"),
		"utf8",
	),
) as {
	piBundled?: string[];
	pi?: { extensions?: string[] };
	dependencies?: Record<string, string>;
};

describe("hypa distribution wiring", () => {
	it("lists @hypabolic/pi-hypa in piBundled and pi.extensions", () => {
		expect(rootPkg.piBundled).toContain("@hypabolic/pi-hypa");
		expect(rootPkg.dependencies?.["@hypabolic/pi-hypa"]).toBeTruthy();
		expect(rootPkg.pi?.extensions?.[0]).toBe(
			"node_modules/@hypabolic/pi-hypa/extensions",
		);
		expect(rootPkg.pi?.extensions).toContain(
			"node_modules/@vitos-pizza/hypa/extensions",
		);
	});
});
