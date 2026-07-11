import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerBorderStatusBar } from "./chrome/border-status.ts";
import { registerWelcomeHeader } from "./chrome/welcome-header.ts";
import {
	DEFAULT_UI_ENHANCEMENTS_SETTINGS,
	type UiEnhancementsSettings,
} from "./config.ts";
import type { UiEnhancementsState } from "./session.ts";
import {
	formatUiEnhancementsStatus,
	registerUiEnhancementsSession,
} from "./session.ts";
import { registerCompactBuiltInTools } from "./tools/index.ts";

export interface UiEnhancementsHarness {
	getState: () => UiEnhancementsState | null;
}

export function registerUiEnhancements(
	pi: ExtensionAPI,
): UiEnhancementsHarness {
	let state: UiEnhancementsState | null = null;
	let currentSettings: UiEnhancementsSettings = {
		...DEFAULT_UI_ENHANCEMENTS_SETTINGS,
	};

	const getSettings = (): UiEnhancementsSettings => currentSettings;

	registerCompactBuiltInTools(pi);
	registerWelcomeHeader(pi);
	registerBorderStatusBar(pi, getSettings);
	registerUiEnhancementsSession(pi, (next) => {
		state = next;
		currentSettings = next.settings;
	});

	pi.registerCommand("vitos-ui", {
		description: "Show vitos-pizza UI enhancement settings and status",
		handler: async (_args, ctx) => {
			ctx.ui.notify(formatUiEnhancementsStatus(state, ctx), "info");
		},
	});

	return {
		getState: () => state,
	};
}
