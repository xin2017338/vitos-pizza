import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backupDir = join(root, ".publish-backup");
const packagesDir = join(root, "packages");

const BUNDLED_MODULES = [
	"@hypabolic/pi-hypa",
	"@vitos-pizza/agent-mode",
	"@vitos-pizza/git",
	"@vitos-pizza/hypa",
	"@vitos-pizza/keybindings",
	"@vitos-pizza/permission-system",
	"@vitos-pizza/question",
	"@vitos-pizza/session-title",
	"@vitos-pizza/settings-preset",
	"@vitos-pizza/subagents",
	"@vitos-pizza/todoist",
	"@vitos-pizza/ui-enhancements",
	"@vitos-pizza/websearch",
];

function loadJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function saveJson(path, data) {
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
}

function discoverWorkspacePackagePaths() {
	if (!existsSync(packagesDir)) return [];

	return readdirSync(packagesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(packagesDir, entry.name, "package.json"))
		.filter((pkgPath) => existsSync(pkgPath));
}

function backupAll() {
	rmSync(backupDir, { recursive: true, force: true });
	mkdirSync(backupDir, { recursive: true });
	cpSync(join(root, "package.json"), join(backupDir, "package.json"));

	for (const pkgPath of discoverWorkspacePackagePaths()) {
		const rel = pkgPath.slice(root.length + 1).replace(/\\/g, "/");
		const dest = join(backupDir, rel);
		mkdirSync(dirname(dest), { recursive: true });
		cpSync(pkgPath, dest);
	}
}

function restoreAll() {
	if (!existsSync(backupDir)) return;

	cpSync(join(backupDir, "package.json"), join(root, "package.json"));

	for (const pkgPath of discoverWorkspacePackagePaths()) {
		const rel = pkgPath.slice(root.length + 1).replace(/\\/g, "/");
		const backupPath = join(backupDir, rel);
		if (existsSync(backupPath)) {
			cpSync(backupPath, pkgPath);
		}
	}

	rmSync(backupDir, { recursive: true, force: true });
}

function rewriteInternalDeps(section, version) {
	if (!section) return;

	for (const [name, spec] of Object.entries(section)) {
		if (!name.startsWith("@vitos-pizza/")) continue;
		if (typeof spec !== "string") continue;
		if (spec.startsWith("file:") || spec === "*") {
			section[name] = version;
		}
	}
}

function prepack() {
	backupAll();
	execSync("node scripts/sync-pi-manifest.mjs", { cwd: root, stdio: "inherit" });

	const rootPkgPath = join(root, "package.json");
	const rootPkg = loadJson(rootPkgPath);
	const version = rootPkg.version;

	rootPkg.name = "@vitos-pizza/vitos-pizza";
	delete rootPkg.private;
	rootPkg.publishConfig = {
		access: "public",
		registry: "https://registry.npmjs.org/",
	};
	rootPkg.repository = {
		type: "git",
		url: "git+https://github.com/xin2017338/vitos-pizza.git",
	};
	rootPkg.files = [
		"packages",
		"assets",
		"scripts/sync-pi-manifest.mjs",
		"README.md",
		"LICENSE",
		"CHANGELOG.md",
		"AGENTS.md",
		"!packages/**/tests",
		"!packages/**/node_modules",
	];
	rootPkg.bundledDependencies = [...BUNDLED_MODULES];
	rewriteInternalDeps(rootPkg.dependencies, version);
	saveJson(rootPkgPath, rootPkg);

	for (const pkgPath of discoverWorkspacePackagePaths()) {
		const pkg = loadJson(pkgPath);
		rewriteInternalDeps(pkg.dependencies, version);
		rewriteInternalDeps(pkg.devDependencies, version);
		saveJson(pkgPath, pkg);
	}

	console.log("prepare-publish: prepack complete");
}

function postpack() {
	restoreAll();
	execSync("node scripts/sync-pi-manifest.mjs", { cwd: root, stdio: "inherit" });
	console.log("prepare-publish: postpack complete");
}

const mode = process.argv[2];
if (mode === "prepack") {
	prepack();
} else if (mode === "postpack") {
	postpack();
} else {
	console.error("Usage: node scripts/prepare-publish.mjs prepack|postpack");
	process.exit(1);
}
