import type { ExtensionConfig } from "../types.ts";

export interface YoloRuntimeApi {
	getYoloMode(): boolean;
	setYoloMode(
		enabled: boolean,
		options?: { persist?: boolean },
	): { error?: string };
	toggleYoloMode(options?: { persist?: boolean; source?: string }): {
		error?: string;
	};
}

type PermissionSystemGlobal = typeof globalThis & {
	__piPermissionSystem?: YoloRuntimeApi;
};

export function installYoloRuntimeApi(
	getConfig: () => ExtensionConfig,
	setConfig: (config: ExtensionConfig) => void,
	onConfigChange?: (config: ExtensionConfig) => void,
): YoloRuntimeApi {
	const applyConfig = (next: ExtensionConfig, persist: boolean) => {
		if (persist) {
			setConfig(next);
		} else {
			Object.assign(getConfig(), next);
		}
		onConfigChange?.(getConfig());
	};

	const api: YoloRuntimeApi = {
		getYoloMode() {
			return getConfig().yoloMode === true;
		},
		setYoloMode(enabled, options = {}) {
			const next = { ...getConfig(), yoloMode: enabled };
			applyConfig(next, options.persist !== false);
			return {};
		},
		toggleYoloMode(options = {}) {
			const enabled = !(getConfig().yoloMode === true);
			return api.setYoloMode(enabled, options);
		},
	};

	(globalThis as PermissionSystemGlobal).__piPermissionSystem = api;
	return api;
}
