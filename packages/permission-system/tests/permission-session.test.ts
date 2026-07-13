import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPermissionPreset } from "../src/mode-api.ts";
import { PermissionSession } from "../src/permission-session.ts";
import type { ExtensionConfig } from "../src/types.ts";

function writeProjectConfig(cwd: string, config: ExtensionConfig): void {
	const dir = join(cwd, ".pi", "extensions", "pi-permission-system");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, "\t"));
}

describe("PermissionSession overlay", () => {
	it("applies session overlay over disk config and survives refresh", () => {
		const cwd = mkdtempSync(join(tmpdir(), "perm-overlay-"));
		const agentDir = mkdtempSync(join(tmpdir(), "perm-agent-"));
		writeProjectConfig(cwd, {
			yoloMode: false,
			permission: { "*": "ask", write: "allow" },
		});

		const session = new PermissionSession(agentDir);
		const ctx = { cwd } as Parameters<PermissionSession["refresh"]>[0];
		session.refresh(ctx);
		expect(session.getConfig().permission?.write).toBe("allow");

		const plan = loadPermissionPreset("plan");
		session.setSessionOverlay({
			yoloMode: plan.yoloMode ?? false,
			permission: plan.permission,
			agentMode: "plan",
		});
		expect(session.getConfig().permission?.write).toBe("deny");
		expect(session.getConfig().agentMode).toBe("plan");

		session.refresh(ctx);
		expect(session.getConfig().permission?.write).toBe("deny");
		expect(session.getSessionOverlay()?.agentMode).toBe("plan");
	});

	it("clearSessionOverlay lets refresh restore disk config", () => {
		const cwd = mkdtempSync(join(tmpdir(), "perm-overlay-"));
		const agentDir = mkdtempSync(join(tmpdir(), "perm-agent-"));
		writeProjectConfig(cwd, {
			permission: { "*": "ask", write: "allow" },
		});

		const session = new PermissionSession(agentDir);
		const ctx = { cwd } as Parameters<PermissionSession["refresh"]>[0];
		session.refresh(ctx);

		const plan = loadPermissionPreset("plan");
		session.setSessionOverlay({
			permission: plan.permission,
			yoloMode: false,
		});
		session.clearSessionOverlay();
		session.refresh(ctx);
		expect(session.getConfig().permission?.write).toBe("allow");
		expect(session.getSessionOverlay()).toBeNull();
	});
});
