import { collectGitContext } from "./collect-git-context.ts";
import { runShip } from "./run-ship.ts";
import type {
	ConfirmShip,
	GenerateCommitMeta,
	GitExec,
	ShipMode,
	ShipReport,
} from "./types.ts";

export async function shipWorkflow(input: {
	mode: ShipMode;
	cwd: string;
	exec: GitExec;
	generateMeta: GenerateCommitMeta;
	confirm: ConfirmShip;
	report: ShipReport;
}): Promise<number> {
	const { mode, cwd, exec, generateMeta, confirm, report } = input;

	const collected = await collectGitContext(exec, cwd);
	if (!collected.ok) {
		report(collected.reason, "error");
		return 1;
	}

	report("Generating commit details…", "info");
	const meta = await generateMeta(mode, collected.context);
	if (!meta) {
		report("Could not generate commit details from the model.", "error");
		return 1;
	}

	const approved = await confirm(meta, mode);
	if (!approved) {
		report("Cancelled.", "info");
		return 1;
	}

	const result = await runShip({ mode, cwd, exec, meta });
	if (!result.ok) {
		report(result.reason, "error");
		return 1;
	}

	report(result.summary, "info");
	return 0;
}

export function formatConfirmBody(
	meta: {
		message: string;
		branch?: string;
	},
	mode: ShipMode,
): string {
	if (mode === "bcp") {
		return `Branch: ${meta.branch}\n\n${meta.message}`;
	}
	return meta.message;
}
