import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 30_000;
const READ_MAX_BYTES = 2 * 1024 * 1024;

export function getAgentDir(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
	return `${home}/.pi/agent`.replace(/\\/g, "/");
}

export function timeoutSignal(
	parent?: AbortSignal,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): AbortSignal {
	if (parent?.aborted) {
		return AbortSignal.abort(parent.reason);
	}
	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(new Error("Request timed out")),
		timeoutMs,
	);
	const onAbort = () => {
		clearTimeout(timer);
		controller.abort(parent?.reason);
	};
	parent?.addEventListener("abort", onAbort, { once: true });
	controller.signal.addEventListener(
		"abort",
		() => {
			clearTimeout(timer);
			parent?.removeEventListener("abort", onAbort);
		},
		{ once: true },
	);
	return controller.signal;
}

export function sanitizeError(status: number, body: string): string {
	const trimmed = body
		.trim()
		.slice(0, 200)
		.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
	return trimmed ? `HTTP ${status}: ${trimmed}` : `HTTP ${status}`;
}

function isPrivateIpv4(host: string): boolean {
	const parts = host.split(".").map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
		return false;
	}
	const [a, b] = parts;
	if (a === 10) return true;
	if (a === 127) return true;
	if (a === 0) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	return false;
}

function isPrivateIpv6(host: string): boolean {
	const normalized = host.toLowerCase();
	if (normalized === "::1" || normalized === "::") return true;
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
	if (normalized.startsWith("fe80")) return true;
	return false;
}

export function validateUrl(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return "Invalid URL";
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return "Only HTTP(S) URLs are allowed";
	}
	const host = parsed.hostname.replace(/^\[|\]$/g, "");
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local")
	) {
		return "Localhost URLs are not allowed";
	}
	const ipVersion = isIP(host);
	if (ipVersion === 4 && isPrivateIpv4(host)) {
		return "Private network URLs are not allowed";
	}
	if (ipVersion === 6 && isPrivateIpv6(host)) {
		return "Private network URLs are not allowed";
	}
	return null;
}

export async function readResponseText(
	response: Response,
	maxBytes = READ_MAX_BYTES,
): Promise<string> {
	const contentLength = Number.parseInt(
		response.headers.get("content-length") ?? "",
		10,
	);
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new Error(`Response too large (${contentLength} bytes)`);
	}
	const text = await response.text();
	if (text.length > maxBytes) {
		throw new Error(`Response too large (${text.length} bytes)`);
	}
	return text;
}

export const MISSING_KEY_HELP =
	"Configure API keys in ~/.pi/agent/extensions/search.json or .pi/search.json";
