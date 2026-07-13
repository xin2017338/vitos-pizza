export type ShipMode = "cp" | "bcp";

export interface GitExecResult {
	stdout: string;
	stderr: string;
	code: number;
}

export type GitExec = (
	args: string[],
	options?: { cwd?: string },
) => Promise<GitExecResult>;

export interface GitContext {
	status: string;
	diff: string;
	log: string;
	files: string[];
	branch: string | undefined;
}

export interface CommitMeta {
	message: string;
	branch?: string;
}

export type ShipReport = (
	message: string,
	level?: "info" | "error" | "warning",
) => void;

export type ConfirmShip = (
	meta: CommitMeta,
	mode: ShipMode,
) => Promise<boolean>;

export type GenerateCommitMeta = (
	mode: ShipMode,
	context: GitContext,
) => Promise<CommitMeta | null>;
