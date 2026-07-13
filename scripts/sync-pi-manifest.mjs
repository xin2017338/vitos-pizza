import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");
const rootPkgPath = join(root, "package.json");

const RESOURCE_TYPES = ["extensions", "skills", "prompts", "themes"];

/** Local modules after permission-system, before agent-mode (plan setActiveTools). */
const LOCAL_ORDER = [
	"permission-system",
	"settings-preset",
	"hypa",
	"question",
	"ui-enhancements",
	"subagents",
	"websearch",
	"session-title",
	"keybindings",
	"agent-mode",
	"todoist",
	"git",
];

function loadJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function discoverPackages() {
	if (!existsSync(packagesDir)) return [];

	return readdirSync(packagesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const dir = entry.name;
			const pkgPath = join(packagesDir, dir, "package.json");
			if (!existsSync(pkgPath)) return null;
			const pkg = loadJson(pkgPath);
			if (!pkg.name) return null;
			return { dir, pkg };
		})
		.filter(Boolean);
}

function resolveModulePaths(pkgName, pkgDir) {
	const piManifest = {};
	for (const type of RESOURCE_TYPES) {
		const localDir = join(pkgDir, type);
		if (!existsSync(localDir)) continue;
		piManifest[type] = [`node_modules/${pkgName}/${type}`];
	}
	return piManifest;
}

function resolveBundledPaths(npmName) {
	const pkgDir = join(root, "node_modules", npmName);
	const pkgPath = join(pkgDir, "package.json");
	if (!existsSync(pkgPath)) {
		console.warn(
			`Warning: bundled package ${npmName} not found in node_modules — run npm install`,
		);
		return null;
	}

	const pkg = loadJson(pkgPath);
	const pi = pkg.pi ?? {};
	const result = {};

	for (const type of RESOURCE_TYPES) {
		const entries = pi[type];
		if (!entries?.length) continue;
		result[type] = entries.map((entry) => {
			const rel = entry.startsWith("./") ? entry.slice(2) : entry;
			return `node_modules/${npmName}/${rel}`.replace(/\\/g, "/");
		});
	}

	return result;
}

function mergePiManifest(entries) {
	const merged = {};
	for (const type of RESOURCE_TYPES) {
		const seen = new Set();
		const paths = [];
		for (const entry of entries) {
			for (const path of entry.pi[type] ?? []) {
				if (seen.has(path)) continue;
				seen.add(path);
				paths.push(path);
			}
		}
		if (paths.length > 0) merged[type] = paths;
	}
	return merged;
}

function getRequires(pkg) {
	const requires = pkg.pi?.requires;
	if (!requires) return [];
	if (!Array.isArray(requires)) {
		throw new Error(`package ${pkg.name} has invalid pi.requires (must be string[])`);
	}
	return requires;
}

function sortPackagesByRequires(packages) {
	const byName = new Map(packages.map((entry) => [entry.pkg.name, entry]));
	const indegree = new Map(packages.map((entry) => [entry.pkg.name, 0]));
	const edges = new Map(packages.map((entry) => [entry.pkg.name, []]));

	for (const entry of packages) {
		for (const dep of getRequires(entry.pkg)) {
			if (!byName.has(dep)) {
				throw new Error(
					`package ${entry.pkg.name} requires missing module ${dep}`,
				);
			}
			edges.get(dep).push(entry.pkg.name);
			indegree.set(entry.pkg.name, (indegree.get(entry.pkg.name) ?? 0) + 1);
		}
	}

	const queue = packages
		.filter((entry) => (indegree.get(entry.pkg.name) ?? 0) === 0)
		.map((entry) => entry.pkg.name)
		.sort((a, b) => {
			const aDir = byName.get(a).dir;
			const bDir = byName.get(b).dir;
			const aIndex = LOCAL_ORDER.indexOf(aDir);
			const bIndex = LOCAL_ORDER.indexOf(bDir);
			if (aIndex !== -1 || bIndex !== -1) {
				return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
			}
			return aDir.localeCompare(bDir);
		});

	const ordered = [];
	while (queue.length > 0) {
		const name = queue.shift();
		ordered.push(byName.get(name));
		for (const next of edges.get(name) ?? []) {
			const nextDegree = (indegree.get(next) ?? 0) - 1;
			indegree.set(next, nextDegree);
			if (nextDegree === 0) {
				queue.push(next);
				queue.sort((a, b) => {
					const aDir = byName.get(a).dir;
					const bDir = byName.get(b).dir;
					const aIndex = LOCAL_ORDER.indexOf(aDir);
					const bIndex = LOCAL_ORDER.indexOf(bDir);
					if (aIndex !== -1 || bIndex !== -1) {
						return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
					}
					return aDir.localeCompare(bDir);
				});
			}
		}
	}

	if (ordered.length !== packages.length) {
		throw new Error("Circular pi.requires dependency detected between local modules");
	}

	return ordered;
}

const packages = discoverPackages();
const sortedPackages = sortPackagesByRequires(packages);
const rootPkg = loadJson(rootPkgPath);
const existingDeps = rootPkg.dependencies ?? {};
const piBundled = Array.isArray(rootPkg.piBundled) ? rootPkg.piBundled : [];

const dependencies = {};
for (const [name, spec] of Object.entries(existingDeps)) {
	if (!spec.startsWith("file:")) {
		dependencies[name] = spec;
	}
}

for (const { dir, pkg } of packages) {
	dependencies[pkg.name] = `file:packages/${dir}`;
}

const piEntries = [];

for (const npmName of piBundled) {
	const pi = resolveBundledPaths(npmName);
	if (pi) piEntries.push({ pi });
}

for (const entry of sortedPackages) {
	piEntries.push({
		pi: resolveModulePaths(entry.pkg.name, join(packagesDir, entry.dir)),
	});
}

rootPkg.dependencies = dependencies;
rootPkg.piBundled = piBundled;
rootPkg.pi = mergePiManifest(piEntries);

writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, "\t")}\n`, "utf8");

console.log(
	`Synced vitos-pizza manifest: ${packages.length} local module(s) [${sortedPackages.map((p) => p.dir).join(", ")}], piBundled: ${piBundled.join(", ") || "(none)"}`,
);
