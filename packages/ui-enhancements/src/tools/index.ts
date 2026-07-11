import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	registerBashTool,
	registerEditTool,
	registerWriteTool,
} from "./bash-write-edit.ts";
import {
	registerFindTool,
	registerGrepTool,
	registerLsTool,
	registerReadTool,
} from "./read-find-grep-ls.ts";

export function registerCompactBuiltInTools(pi: ExtensionAPI): void {
	registerReadTool(pi);
	registerBashTool(pi);
	registerWriteTool(pi);
	registerEditTool(pi);
	registerFindTool(pi);
	registerGrepTool(pi);
	registerLsTool(pi);
}
