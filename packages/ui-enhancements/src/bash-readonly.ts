/** Read-only bash commands that are safe to collapse by default. */
const READONLY_BASH_COMMANDS = new Set([
	"cat",
	"head",
	"tail",
	"wc",
	"sort",
	"uniq",
	"cut",
	"tr",
	"jq",
	"yq",
	"awk",
	"sed",
	"grep",
	"rg",
	"fd",
	"fzf",
	"diff",
	"patch",
	"xz",
	"zstd",
	"gzip",
	"gunzip",
	"base64",
	"md5sum",
	"sha256sum",
	"sha1sum",
	"stat",
	"file",
	"dirname",
	"basename",
	"realpath",
	"readlink",
	"hexdump",
	"od",
	"strings",
	"tree",
	"ls",
	"find",
	"echo",
	"printf",
	"date",
	"id",
	"whoami",
	"pwd",
	"env",
	"export",
	"unset",
]);

const DESTRUCTIVE_PATTERN =
	/(?:\s>>?\s?|\|\s*(?:tee|xargs)|\brm\b|\bmv\b|\bcp\b|\bdd\b|\btruncate\b|\bchmod\b|\bchown\b|\btouch\b|\bmkdir\b|\brmdir\b|\bunlink\b|\bkill\b|\bpkill\b|\bkillall\b|\bwget\b|\bcurl\b|\bnc\b|\bexec\b|\bsource\b)/i;

/**
 * Detect if a bash command is read-only and safe to collapse.
 * Every command in the chain must be in READONLY_BASH_COMMANDS.
 */
export function isReadonlyBash(command: string): boolean {
	const trimmed = command.trim();
	if (!trimmed) return false;

	const chain = trimmed.split(/\s*(?:;|\|\||&&)\s*/);

	for (const segment of chain) {
		const primary = segment
			.trim()
			.split(/\s*\|\s*/)[0]
			?.trim()
			.split(/\s+/)[0];
		if (!primary) continue;
		if (!READONLY_BASH_COMMANDS.has(primary)) {
			return false;
		}
	}

	if (DESTRUCTIVE_PATTERN.test(trimmed)) {
		return false;
	}

	return true;
}
