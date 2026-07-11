import { resolveBackendKey } from "../credentials.ts";
import type { SearchConfig } from "../types.ts";
import { readResponseText, sanitizeError, timeoutSignal } from "../utils.ts";

export async function readWithJina(
	url: string,
	searchConfig: SearchConfig,
	signal?: AbortSignal,
): Promise<{ title: string; url: string; content: string }> {
	const readerUrl = new URL(`https://r.jina.ai/${url}`);
	const headers: Record<string, string> = {
		Accept: "text/plain",
	};

	const jinaKey = resolveBackendKey("jina", searchConfig);
	if (jinaKey) {
		headers.Authorization = `Bearer ${jinaKey}`;
	}

	const response = await fetch(readerUrl.toString(), {
		signal: timeoutSignal(signal),
		headers,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Jina Reader ${sanitizeError(response.status, text)}`);
	}

	const content = await readResponseText(response);
	const title = extractJinaTitle(content) || "";
	return {
		title,
		url,
		content,
	};
}

function extractJinaTitle(content: string): string | undefined {
	const match = content.match(/^Title:\s*(.+)$/m);
	return match?.[1]?.trim();
}
