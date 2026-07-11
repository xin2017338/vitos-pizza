/**
 * @vitos-pizza/ui-enhancements — TUI and UI enhancements for Vito's Pizzeria.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerUiEnhancements } from "../src/register-ui-enhancements.ts";

export default function (pi: ExtensionAPI): void {
	registerUiEnhancements(pi);
}
