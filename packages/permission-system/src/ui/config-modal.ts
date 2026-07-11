import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionConfig } from "../types.ts";

export async function showPermissionSystemModal(
	ctx: ExtensionContext,
	config: ExtensionConfig,
	onSave: (next: ExtensionConfig) => void,
): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify(
			"Permission system settings require an interactive UI.",
			"info",
		);
		return;
	}

	const yoloLabel = config.yoloMode
		? "YOLO mode: ON (auto-approve ask)"
		: "YOLO mode: OFF";
	const debugLabel = config.debug ? "Debug logging: ON" : "Debug logging: OFF";
	const selected = await ctx.ui.select("Permission system", [
		yoloLabel,
		debugLabel,
		"Close",
	]);
	if (!selected || selected === "Close") return;

	const next = { ...config };
	if (selected === yoloLabel) next.yoloMode = !config.yoloMode;
	if (selected === debugLabel) next.debug = !config.debug;
	onSave(next);
	ctx.ui.notify(
		"Permission settings updated. Run /reload to apply runtime changes.",
		"info",
	);
}
