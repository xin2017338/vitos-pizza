import { Text } from "@earendil-works/pi-tui";

/** Hide tool rows in the transcript; state is shown via the widget instead. */
export const silentRender = {
	renderShell: "self" as const,
	renderCall: () => new Text("", 0, 0),
	renderResult: () => new Text("", 0, 0),
};
