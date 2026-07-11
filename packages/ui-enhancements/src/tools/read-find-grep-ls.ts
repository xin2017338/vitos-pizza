import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { shortenPath } from "../utils/shorten-path.ts";
import {
	countNonEmptyLines,
	getTextContent,
	renderBuiltInToolResult,
} from "./text-content.ts";
import { getBuiltInDefinitions, getBuiltInTools } from "./tool-cache.ts";

export function registerReadTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).read.parameters;

	pi.registerTool({
		name: "read",
		label: "read",
		description: getBuiltInTools(process.cwd()).read.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.read.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const path = shortenPath((args.path as string | undefined) || "");
			let pathDisplay = path
				? theme.fg("accent", path)
				: theme.fg("toolOutput", "...");

			if (args.offset !== undefined || args.limit !== undefined) {
				const startLine = (args.offset as number | undefined) ?? 1;
				const endLine =
					args.limit !== undefined
						? startLine + (args.limit as number) - 1
						: "";
				pathDisplay += theme.fg(
					"warning",
					`:${startLine}${endLine ? `-${endLine}` : ""}`,
				);
			}

			return new Text(
				`${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}`,
				0,
				0,
			);
		},

		renderResult(result, options, theme, context) {
			if (options.isPartial) {
				return new Text(theme.fg("warning", "Reading..."), 0, 0);
			}

			if (!options.expanded) {
				return new Text("", 0, 0);
			}

			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).read,
				result,
				options,
				theme,
				context,
			);
		},
	});
}

export function registerFindTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).find.parameters;

	pi.registerTool({
		name: "find",
		label: "find",
		description: getBuiltInTools(process.cwd()).find.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.find.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const pattern = (args.pattern as string | undefined) || "";
			const path = shortenPath((args.path as string | undefined) || ".");
			const limit = args.limit as number | undefined;

			let text = `${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg("accent", pattern)}`;
			text += theme.fg("toolOutput", ` in ${path}`);
			if (limit !== undefined) {
				text += theme.fg("toolOutput", ` (limit ${limit})`);
			}

			return new Text(text, 0, 0);
		},

		renderResult(result, options, theme, context) {
			if (options.isPartial) {
				return new Text(theme.fg("warning", "Searching..."), 0, 0);
			}

			if (!options.expanded) {
				const text = getTextContent(result);
				if (text) {
					const count = countNonEmptyLines(text);
					if (count > 0) {
						return new Text(theme.fg("muted", ` → ${count} files`), 0, 0);
					}
				}
				return new Text("", 0, 0);
			}

			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).find,
				result,
				options,
				theme,
				context,
			);
		},
	});
}

export function registerGrepTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).grep.parameters;

	pi.registerTool({
		name: "grep",
		label: "grep",
		description: getBuiltInTools(process.cwd()).grep.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.grep.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const pattern = (args.pattern as string | undefined) || "";
			const path = shortenPath((args.path as string | undefined) || ".");
			const glob = args.glob as string | undefined;
			const limit = args.limit as number | undefined;

			let text = `${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg("accent", `/${pattern}/`)}`;
			text += theme.fg("toolOutput", ` in ${path}`);
			if (glob) {
				text += theme.fg("toolOutput", ` (${glob})`);
			}
			if (limit !== undefined) {
				text += theme.fg("toolOutput", ` limit ${limit}`);
			}

			return new Text(text, 0, 0);
		},

		renderResult(result, options, theme, context) {
			if (options.isPartial) {
				return new Text(theme.fg("warning", "Searching..."), 0, 0);
			}

			if (!options.expanded) {
				const text = getTextContent(result);
				if (text) {
					const count = countNonEmptyLines(text);
					if (count > 0) {
						return new Text(theme.fg("muted", ` → ${count} matches`), 0, 0);
					}
				}
				return new Text("", 0, 0);
			}

			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).grep,
				result,
				options,
				theme,
				context,
			);
		},
	});
}

export function registerLsTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).ls.parameters;

	pi.registerTool({
		name: "ls",
		label: "ls",
		description: getBuiltInTools(process.cwd()).ls.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.ls.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const path = shortenPath((args.path as string | undefined) || ".");
			const limit = args.limit as number | undefined;

			let text = `${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", path)}`;
			if (limit !== undefined) {
				text += theme.fg("toolOutput", ` (limit ${limit})`);
			}

			return new Text(text, 0, 0);
		},

		renderResult(result, options, theme, context) {
			if (options.isPartial) {
				return new Text(theme.fg("warning", "Listing..."), 0, 0);
			}

			if (!options.expanded) {
				const text = getTextContent(result);
				if (text) {
					const count = countNonEmptyLines(text);
					if (count > 0) {
						return new Text(theme.fg("muted", ` → ${count} entries`), 0, 0);
					}
				}
				return new Text("", 0, 0);
			}

			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).ls,
				result,
				options,
				theme,
				context,
			);
		},
	});
}
