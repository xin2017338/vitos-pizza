import * as fs from "node:fs";
import * as path from "node:path";

export interface PiSpawnDeps {
	platform?: NodeJS.Platform;
	execPath?: string;
	argv1?: string;
	existsSync?: (filePath: string) => boolean;
	readFileSync?: (filePath: string, encoding: "utf-8") => string;
	env?: NodeJS.ProcessEnv;
}

export interface PiSpawnCommand {
	command: string;
	args: string[];
}

const PI_CODING_AGENT_PACKAGE = "@earendil-works/pi-coding-agent";

function isRunnableNodeScript(
	filePath: string,
	existsSync: (filePath: string) => boolean,
): boolean {
	if (!existsSync(filePath)) return false;
	return /\.(?:mjs|cjs|js)$/i.test(filePath);
}

function findPiPackageRootFromEntry(entryPoint: string): string | undefined {
	let dir = path.dirname(entryPoint);
	while (dir !== path.dirname(dir)) {
		const packageJsonPath = path.join(dir, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
				name?: unknown;
			};
			if (pkg.name === PI_CODING_AGENT_PACKAGE) return dir;
		}
		dir = path.dirname(dir);
	}
	return undefined;
}

function resolvePiPackageRoot(): string | undefined {
	try {
		const entry = process.argv[1];
		return entry
			? findPiPackageRootFromEntry(fs.realpathSync(entry))
			: undefined;
	} catch {
		return undefined;
	}
}

export function resolveWindowsPiCliScript(deps: PiSpawnDeps = {}): string | undefined {
	const existsSync = deps.existsSync ?? fs.existsSync;
	const readFileSync =
		deps.readFileSync ??
		((filePath, encoding) => fs.readFileSync(filePath, encoding));
	const argv1 = deps.argv1 ?? process.argv[1];

	if (argv1) {
		const argvPath = path.isAbsolute(argv1) ? argv1 : path.resolve(argv1);
		if (isRunnableNodeScript(argvPath, existsSync)) return argvPath;
	}

	try {
		const root = resolvePiPackageRoot();
		if (!root) return undefined;
		const packageJsonPath = path.join(root, "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
			bin?: string | Record<string, string>;
		};
		const binField = packageJson.bin;
		const binPath =
			typeof binField === "string"
				? binField
				: (binField?.pi ?? Object.values(binField ?? {})[0]);
		if (!binPath) return undefined;
		const candidate = path.resolve(path.dirname(packageJsonPath), binPath);
		if (isRunnableNodeScript(candidate, existsSync)) return candidate;
	} catch {
		return undefined;
	}

	return undefined;
}

export function getPiSpawnCommand(
	args: string[],
	deps: PiSpawnDeps = {},
): PiSpawnCommand {
	const platform = deps.platform ?? process.platform;
	if (platform === "win32") {
		const piCliPath = resolveWindowsPiCliScript(deps);
		if (piCliPath) {
			return {
				command: deps.execPath ?? process.execPath,
				args: [piCliPath, ...args],
			};
		}
	}

	return { command: "pi", args };
}
