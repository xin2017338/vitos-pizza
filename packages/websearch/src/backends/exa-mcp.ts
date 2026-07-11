import { parseExaMcpItems } from "../parsers.ts";
import type { SearchResult } from "../types.ts";
import { sanitizeError, timeoutSignal } from "../utils.ts";

const EXA_MCP_ENDPOINT = "https://mcp.exa.ai/mcp";

interface MCPRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: {
		name?: string;
		arguments?: Record<string, unknown>;
	};
}

interface MCPResponse {
	jsonrpc: "2.0";
	id: number;
	result?: {
		content?: Array<{ type: string; text?: string }>;
	};
	error?: {
		code: number;
		message: string;
	};
}

let requestId = 0;

function parseMcpText(text: string): SearchResult[] {
	try {
		const parsed = JSON.parse(text) as unknown;
		if (Array.isArray(parsed)) {
			return parseExaMcpItems(parsed as Array<Record<string, unknown>>);
		}
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			Array.isArray((parsed as Record<string, unknown>).results)
		) {
			return parseExaMcpItems(
				(parsed as Record<string, unknown>).results as Array<
					Record<string, unknown>
				>,
			);
		}
	} catch {
		// fall through to line parsing
	}

	const results: SearchResult[] = [];
	for (const line of text.split("\n")) {
		const parts = line.split("\t");
		if (parts.length >= 2) {
			results.push({
				title: parts[1] || "",
				url: parts[0] || "",
				snippet: parts[2] || "",
			});
		}
	}
	return results;
}

async function callMcp(
	toolName: string,
	arguments_: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<SearchResult[]> {
	const id = ++requestId;
	const request: MCPRequest = {
		jsonrpc: "2.0",
		id,
		method: "tools/call",
		params: {
			name: toolName,
			arguments: arguments_,
		},
	};

	const response = await fetch(EXA_MCP_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(request),
		signal: timeoutSignal(signal),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Exa MCP ${sanitizeError(response.status, text)}`);
	}

	const data = (await response.json()) as MCPResponse;
	if (data.error) {
		throw new Error(`Exa MCP error: ${data.error.message}`);
	}

	const text = (data.result?.content ?? [])
		.filter((entry) => entry.type === "text")
		.map((entry) => entry.text ?? "")
		.join("\n");

	return parseMcpText(text);
}

export async function searchExaMCP(
	query: string,
	numResults: number,
	signal?: AbortSignal,
): Promise<{ results: SearchResult[] }> {
	const results = await callMcp(
		"web_search_exa",
		{
			query,
			numResults: Math.min(numResults, 20),
		},
		signal,
	);
	return { results };
}

export async function fetchExaMCP(
	url: string,
	signal?: AbortSignal,
): Promise<{ title: string; url: string; content: string }> {
	const results = await callMcp("web_fetch_exa", { url }, signal);
	const first = results[0];
	if (!first) {
		throw new Error(`Exa MCP fetch returned no content for ${url}`);
	}
	return {
		title: first.title || "",
		url: first.url || url,
		content: first.content || first.snippet || "",
	};
}
