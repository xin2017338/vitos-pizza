/**
 * @vitos-pizza/git — /cp and /bcp quick commit+push.
 */

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	createCommitMetaSubagent,
	resolveSessionModelRef,
} from "../src/commit-meta-subagent.ts";
import type { GitExec, ShipMode } from "../src/types.ts";
import { formatConfirmBody, shipWorkflow } from "../src/workflow.ts";

function createPiGitExec(pi: ExtensionAPI, cwd: string): GitExec {
	return async (args) => {
		try {
			const result = await pi.exec("git", args, { cwd });
			return {
				stdout: result.stdout ?? "",
				stderr: result.stderr ?? "",
				code: result.code ?? 0,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { stdout: "", stderr: message, code: 1 };
		}
	};
}

async function handleShip(
	pi: ExtensionAPI,
	mode: ShipMode,
	ctx: ExtensionContext,
): Promise<void> {
	const generateMeta = createCommitMetaSubagent({
		events: pi.events,
		resolveModelRef: () => resolveSessionModelRef(ctx),
	});

	await shipWorkflow({
		mode,
		cwd: ctx.cwd,
		exec: createPiGitExec(pi, ctx.cwd),
		generateMeta,
		confirm: async (meta, shipMode) => {
			if (!ctx.hasUI) return true;
			const title =
				shipMode === "bcp" ? "Create branch, commit & push?" : "Commit & push?";
			return ctx.ui.confirm(title, formatConfirmBody(meta, shipMode));
		},
		report: (message, level) => {
			if (!ctx.hasUI) return;
			ctx.ui.notify(message, level ?? "info");
		},
	});
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("cp", {
		description: "AI commit message → confirm → commit & push",
		handler: async (_args, ctx) => {
			await handleShip(pi, "cp", ctx);
		},
	});

	pi.registerCommand("bcp", {
		description:
			"AI branch + message → confirm → checkout -b, commit & push -u",
		handler: async (_args, ctx) => {
			await handleShip(pi, "bcp", ctx);
		},
	});
}
