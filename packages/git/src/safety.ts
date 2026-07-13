const SECRET_PATH_PATTERNS: RegExp[] = [
	/(^|\/)\.env$/,
	/(^|\/)\.env\./,
	/(^|\/)\.env\.local$/,
	/(^|\/)credentials\.json$/,
	/(^|\/)id_rsa$/,
	/(^|\/)id_ed25519$/,
	/\.pem$/i,
	/\.p12$/i,
	/\.pfx$/i,
	/(^|\/)\.npmrc$/,
	/(^|\/)auth\.json$/,
];

/** Paths from `git status --porcelain` that look like secrets. */
export function findSecretPaths(files: string[]): string[] {
	return files.filter((file) =>
		SECRET_PATH_PATTERNS.some((pattern) => pattern.test(file)),
	);
}

export function parsePorcelainFiles(status: string): string[] {
	return status
		.split("\n")
		.map((line) => line.trimEnd())
		.filter(Boolean)
		.map((line) => {
			// XY PATH or XY ORIG -> PATH
			const renamed = line.slice(3).split(" -> ");
			return (renamed[renamed.length - 1] ?? "").trim();
		})
		.filter(Boolean);
}

export function truncateText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n\n…[truncated]`;
}
