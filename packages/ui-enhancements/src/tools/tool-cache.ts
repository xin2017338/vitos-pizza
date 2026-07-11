import {
	createBashTool,
	createBashToolDefinition,
	createEditTool,
	createEditToolDefinition,
	createFindTool,
	createFindToolDefinition,
	createGrepTool,
	createGrepToolDefinition,
	createLsTool,
	createLsToolDefinition,
	createReadTool,
	createReadToolDefinition,
	createWriteTool,
	createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";

type BuiltInTools = {
	read: ReturnType<typeof createReadTool>;
	bash: ReturnType<typeof createBashTool>;
	edit: ReturnType<typeof createEditTool>;
	write: ReturnType<typeof createWriteTool>;
	find: ReturnType<typeof createFindTool>;
	grep: ReturnType<typeof createGrepTool>;
	ls: ReturnType<typeof createLsTool>;
};

export type BuiltInDefinitions = {
	read: ReturnType<typeof createReadToolDefinition>;
	bash: ReturnType<typeof createBashToolDefinition>;
	edit: ReturnType<typeof createEditToolDefinition>;
	write: ReturnType<typeof createWriteToolDefinition>;
	find: ReturnType<typeof createFindToolDefinition>;
	grep: ReturnType<typeof createGrepToolDefinition>;
	ls: ReturnType<typeof createLsToolDefinition>;
};

type BuiltInToolBundle = {
	tools: BuiltInTools;
	definitions: BuiltInDefinitions;
};

function createBuiltInBundle(cwd: string): BuiltInToolBundle {
	return {
		tools: {
			read: createReadTool(cwd),
			bash: createBashTool(cwd),
			edit: createEditTool(cwd),
			write: createWriteTool(cwd),
			find: createFindTool(cwd),
			grep: createGrepTool(cwd),
			ls: createLsTool(cwd),
		},
		definitions: {
			read: createReadToolDefinition(cwd),
			bash: createBashToolDefinition(cwd),
			edit: createEditToolDefinition(cwd),
			write: createWriteToolDefinition(cwd),
			find: createFindToolDefinition(cwd),
			grep: createGrepToolDefinition(cwd),
			ls: createLsToolDefinition(cwd),
		},
	};
}

const toolCache = new Map<string, BuiltInToolBundle>();

function getBuiltInBundle(cwd: string): BuiltInToolBundle {
	let bundle = toolCache.get(cwd);
	if (!bundle) {
		bundle = createBuiltInBundle(cwd);
		toolCache.set(cwd, bundle);
	}
	return bundle;
}

export function getBuiltInTools(cwd: string): BuiltInTools {
	return getBuiltInBundle(cwd).tools;
}

export function getBuiltInDefinitions(cwd: string): BuiltInDefinitions {
	return getBuiltInBundle(cwd).definitions;
}

export function clearBuiltInToolCache(): void {
	toolCache.clear();
}
