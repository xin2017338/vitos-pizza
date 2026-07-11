import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { isReadonlyBash } from "../bash-readonly.ts";
import { shortenPath } from "../utils/shorten-path.ts";
import {
	countNonEmptyLines,
	getTextContent,
	renderBuiltInToolResult,
} from "./text-content.ts";
import { getBuiltInDefinitions, getBuiltInTools } from "./tool-cache.ts";

export function registerBashTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).bash.parameters;

	pi.registerTool({
		name: "bash",
		label: "bash",
		description: getBuiltInTools(process.cwd()).bash.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.bash.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const command = (args.command as string | undefined) || "...";
			const timeout = args.timeout as number | undefined;
			const timeoutSuffix = timeout
				? theme.fg("muted", ` (timeout ${timeout}s)`)
				: "";

			return new Text(
				theme.fg("toolTitle", theme.bold(`$ ${command}`)) + timeoutSuffix,
				0,
				0,
			);
		},

		renderResult(result, options, theme, context) {
			if (options.isPartial) {
				return new Text(theme.fg("warning", "Running..."), 0, 0);
			}

			const command = context.args.command as string | undefined;
			const collapsed = command ? isReadonlyBash(command) : false;

			if (collapsed && !options.expanded) {
				const text = getTextContent(result);
				if (text?.trim()) {
					const count = countNonEmptyLines(text);
					return new Text(theme.fg("muted", ` → ${count} lines`), 0, 0);
				}
				return new Text("", 0, 0);
			}

			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).bash,
				result,
				options,
				theme,
				context,
			);
		},
	});
}

export function registerWriteTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).write.parameters;

	pi.registerTool({
		name: "write",
		label: "write",
		description: getBuiltInTools(process.cwd()).write.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.write.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const path = shortenPath((args.path as string | undefined) || "");
			const pathDisplay = path
				? theme.fg("accent", path)
				: theme.fg("toolOutput", "...");
			const content = args.content as string | undefined;
			const lineCount = content ? content.split("\n").length : 0;
			const lineInfo =
				lineCount > 0 ? theme.fg("muted", ` (${lineCount} lines)`) : "";

			return new Text(
				`${theme.fg("toolTitle", theme.bold("write"))} ${pathDisplay}${lineInfo}`,
				0,
				0,
			);
		},

		renderResult(result, options, theme, context) {
			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).write,
				result,
				options,
				theme,
				context,
			);
		},
	});
}

export function registerEditTool(pi: ExtensionAPI): void {
	const parameters = getBuiltInTools(process.cwd()).edit.parameters;

	pi.registerTool({
		name: "edit",
		label: "edit",
		description: getBuiltInTools(process.cwd()).edit.description,
		parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.edit.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme) {
			const path = shortenPath((args.path as string | undefined) || "");
			const pathDisplay = path
				? theme.fg("accent", path)
				: theme.fg("toolOutput", "...");

			return new Text(
				`${theme.fg("toolTitle", theme.bold("edit"))} ${pathDisplay}`,
				0,
				0,
			);
		},

		renderResult(result, options, theme, context) {
			return renderBuiltInToolResult(
				getBuiltInDefinitions(context.cwd).edit,
				result,
				options,
				theme,
				context,
			);
		},
	});
}
