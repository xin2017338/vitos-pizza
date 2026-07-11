/**
 * @vitos-pizza/hypa — seed Hypa Pi defaults (additive, MCP proxy off).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { seedHypaPiConfigIfMissing } from "../src/seed.ts";

export default function (pi: ExtensionAPI) {
	let seeded = false;

	pi.on("session_start", async (_event, _ctx) => {
		if (seeded) return;
		seeded = true;
		seedHypaPiConfigIfMissing();
	});
}
