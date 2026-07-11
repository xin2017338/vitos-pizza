import {
	closeSync,
	existsSync,
	openSync,
	readdirSync,
	readSync,
	statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

export interface RecentSession {
	name: string;
	timeAgo: string;
}

const SESSION_HEADER_READ_BYTES = 8192;

export function formatTimeAgo(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return "just now";
}

function readSessionHeaderProjectName(filePath: string): string | null {
	let fd: number | null = null;
	try {
		fd = openSync(filePath, "r");
		const buffer = Buffer.alloc(SESSION_HEADER_READ_BYTES);
		const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
		const firstLine = buffer
			.toString("utf8", 0, bytesRead)
			.split(/\r?\n/, 1)[0]
			?.trim();
		if (!firstLine) return null;

		const header: unknown = JSON.parse(firstLine);
		if (
			typeof header !== "object" ||
			header === null ||
			Array.isArray(header)
		) {
			return null;
		}

		const cwd = Reflect.get(header, "cwd");
		if (typeof cwd !== "string" || cwd.trim().length === 0) return null;

		return basename(cwd) || cwd;
	} catch {
		return null;
	} finally {
		if (fd !== null) closeSync(fd);
	}
}

function sessionProjectNameFromDirectory(dir: string): string {
	const parentName = basename(dir);
	if (!parentName.startsWith("--")) {
		return parentName;
	}

	const parts = parentName.split("-").filter((part) => part);
	return parts[parts.length - 1] || parentName;
}

function getAgentSessionDirs(): string[] {
	return [join(homedir(), ".pi", "agent", "sessions")];
}

function scanSessionsDir(
	dir: string,
	sessions: { name: string; mtime: number }[],
): void {
	if (!existsSync(dir)) return;

	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const entryPath = join(dir, entry);
			try {
				const stats = statSync(entryPath);
				if (stats.isDirectory()) {
					scanSessionsDir(entryPath, sessions);
				} else if (entry.endsWith(".jsonl")) {
					const projectName =
						readSessionHeaderProjectName(entryPath) ??
						sessionProjectNameFromDirectory(dir);
					sessions.push({ name: projectName, mtime: stats.mtimeMs });
				}
			} catch {
				// Skip unreadable entries.
			}
		}
	} catch {
		// Skip unreadable directories.
	}
}

export function getRecentSessions(maxCount = 5): RecentSession[] {
	const sessions: { name: string; mtime: number }[] = [];

	for (const sessionsDir of getAgentSessionDirs()) {
		scanSessionsDir(sessionsDir, sessions);
	}

	if (sessions.length === 0) return [];

	sessions.sort((a, b) => b.mtime - a.mtime);

	const seen = new Set<string>();
	const uniqueSessions: typeof sessions = [];
	for (const session of sessions) {
		if (!seen.has(session.name)) {
			seen.add(session.name);
			uniqueSessions.push(session);
		}
	}

	const now = Date.now();
	return uniqueSessions.slice(0, maxCount).map((session) => ({
		name:
			session.name.length > 20 ? `${session.name.slice(0, 17)}…` : session.name,
		timeAgo: formatTimeAgo(now - session.mtime),
	}));
}
