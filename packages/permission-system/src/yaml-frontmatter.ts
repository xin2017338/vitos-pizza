export function extractFrontmatter(content: string): {
	frontmatter: string;
	body: string;
} | null {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
	if (!match) return null;
	return {
		frontmatter: match[1],
		body: content.slice(match[0].length),
	};
}

export function parseSimpleYamlMap(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = yaml.split(/\r?\n/);
	let currentKey: string | null = null;
	let currentIndent = 0;
	const nested: Record<string, Record<string, unknown>> = {};

	for (const rawLine of lines) {
		if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;

		const indent = rawLine.search(/\S/);
		const trimmed = rawLine.trim();

		if (indent === 0) {
			const colon = trimmed.indexOf(":");
			if (colon === -1) continue;
			const key = trimmed.slice(0, colon).trim();
			const value = trimmed.slice(colon + 1).trim();
			currentKey = key;
			currentIndent = 0;
			if (value) {
				result[key] = parseScalar(value);
			} else {
				nested[key] = {};
				result[key] = nested[key];
			}
			continue;
		}

		if (currentKey && indent > currentIndent) {
			const colon = trimmed.indexOf(":");
			if (colon === -1) continue;
			const key = trimmed.slice(0, colon).trim();
			const value = trimmed.slice(colon + 1).trim();
			const bucket = nested[currentKey] ?? {};
			if (!nested[currentKey]) nested[currentKey] = bucket;
			bucket[key] = parseScalar(value);
		}
	}

	return result;
}

function parseScalar(value: string): unknown {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	return value;
}

export function parseAgentFrontmatterPermission(
	content: string,
): Record<string, unknown> | null {
	const extracted = extractFrontmatter(content);
	if (!extracted) return null;
	const map = parseSimpleYamlMap(extracted.frontmatter);
	const permission = map.permission;
	if (
		!permission ||
		typeof permission !== "object" ||
		Array.isArray(permission)
	) {
		return null;
	}
	return permission as Record<string, unknown>;
}
