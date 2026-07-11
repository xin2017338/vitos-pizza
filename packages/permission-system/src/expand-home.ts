import { homedir } from "node:os";

export function expandHomePath(value: string): string {
	if (!value.startsWith("~/")) return value;
	return joinPath(homedir(), value.slice(2));
}

function joinPath(base: string, rest: string): string {
	if (!rest) return base;
	const sep = base.includes("\\") ? "\\" : "/";
	return `${base}${sep}${rest}`;
}
