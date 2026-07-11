import type { Api, Model } from "@earendil-works/pi-ai";

export interface TitleModelContext {
	model?: Model<Api> | undefined;
	modelRegistry?: {
		find(provider: string, modelId: string): Model<Api> | undefined;
	};
}

export function resolveTitleModel(
	ctx: TitleModelContext,
	configuredModel?: string,
): Model<Api> | undefined {
	if (configuredModel && ctx.modelRegistry) {
		const [provider, modelId] = configuredModel.split("/");
		if (provider && modelId) {
			const found = ctx.modelRegistry.find(provider, modelId);
			if (found) return found;
		}
	}
	return ctx.model;
}

export function resolveTitleModelRef(
	ctx: TitleModelContext,
	configuredModel?: string,
): string | undefined {
	if (configuredModel) return configuredModel;
	if (ctx.model?.provider && ctx.model?.id) {
		return `${ctx.model.provider}/${ctx.model.id}`;
	}
	return undefined;
}
