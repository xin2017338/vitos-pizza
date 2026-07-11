import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	formatTimeAgo,
	getRecentSessions,
} from "../src/chrome/recent-sessions.ts";

describe("formatTimeAgo", () => {
	it("formats recent times", () => {
		expect(formatTimeAgo(30_000)).toBe("just now");
		expect(formatTimeAgo(120_000)).toBe("2m ago");
		expect(formatTimeAgo(3_600_000)).toBe("1h ago");
		expect(formatTimeAgo(86_400_000)).toBe("1d ago");
	});
});

describe("getRecentSessions", () => {
	let tempHome: string;

	beforeEach(() => {
		tempHome = mkdtempSync(join(tmpdir(), "vitos-recent-sessions-"));
		vi.stubEnv("HOME", tempHome);
		vi.stubEnv("USERPROFILE", tempHome);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(tempHome, { recursive: true, force: true });
	});

	it("returns empty list when sessions directory is missing", () => {
		expect(getRecentSessions(5)).toEqual([]);
	});

	it("sorts, deduplicates, and formats recent sessions", () => {
		const sessionsRoot = join(tempHome, ".pi", "agent", "sessions");
		const projectA = join(sessionsRoot, "--users--project-a--");
		const projectB = join(sessionsRoot, "--users--project-b--");
		mkdirSync(projectA, { recursive: true });
		mkdirSync(projectB, { recursive: true });

		const older = join(projectA, "older.jsonl");
		const newer = join(projectA, "newer.jsonl");
		const other = join(projectB, "other.jsonl");

		const header = (cwd: string) =>
			`${JSON.stringify({ type: "session", version: 3, cwd })}\n`;

		writeFileSync(older, header("C:\\Users\\me\\project-a"));
		writeFileSync(newer, header("C:\\Users\\me\\project-a"));
		writeFileSync(other, header("C:\\Users\\me\\subagent"));

		const now = Date.now();
		utimesSync(older, now / 1000 - 3600, now / 1000 - 3600);
		utimesSync(newer, now / 1000 - 60, now / 1000 - 60);
		utimesSync(other, now / 1000 - 10, now / 1000 - 10);

		const recent = getRecentSessions(5);
		expect(recent).toHaveLength(2);
		expect(recent[0]?.name).toBe("subagent");
		expect(recent[0]?.timeAgo).toBe("just now");
		expect(recent[1]?.name).toBe("project-a");
	});
});
