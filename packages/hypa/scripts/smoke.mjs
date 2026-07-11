/**
 * Smoke: resolve platform Hypa binary and run --version.
 * Exit 0 = ok; 2 = binary missing (skip on unsupported install).
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(join(root, "package.json"));

function resolveHypaBin() {
	const platformKey = `${process.platform}-${process.arch}`;
	const map = {
		"win32-x64": "@hypabolic/hypa-win32-x64",
		"win32-arm64": "@hypabolic/hypa-win32-arm64",
		"linux-x64": "@hypabolic/hypa-linux-x64",
		"linux-arm64": "@hypabolic/hypa-linux-arm64",
		"darwin-x64": "@hypabolic/hypa-darwin-x64",
		"darwin-arm64": "@hypabolic/hypa-darwin-arm64",
	};
	const pkgName = map[platformKey];
	if (!pkgName) {
		console.error(`Unsupported platform: ${platformKey}`);
		process.exit(2);
	}
	try {
		const pkgJson = require.resolve(`${pkgName}/package.json`);
		const binName = process.platform === "win32" ? "hypa.exe" : "hypa";
		const binPath = join(dirname(pkgJson), "bin", binName);
		if (!existsSync(binPath)) {
			console.error(`Binary missing: ${binPath}`);
			process.exit(2);
		}
		return binPath;
	} catch (err) {
		console.error(`Could not resolve ${pkgName}:`, err);
		process.exit(2);
	}
}

const bin = resolveHypaBin();
const result = spawnSync(bin, ["--version"], { encoding: "utf8" });
if (result.status !== 0) {
	console.error(result.stderr || result.stdout || "hypa --version failed");
	process.exit(result.status ?? 1);
}
console.log(`hypa smoke ok: ${result.stdout.trim() || bin}`);
