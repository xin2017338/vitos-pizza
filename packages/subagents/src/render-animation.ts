const ANIMATION_INTERVAL_MS = 80;
const ANIMATION_STATE_KEY = "subagentResultAnimationTimer";
const FRAME_STATE_KEY = "subagentResultAnimationFrame";

export interface RenderAnimationContext {
	state: Record<string, unknown>;
	invalidate?: () => void;
}

export function ensureSubagentResultAnimation(
	context: RenderAnimationContext | undefined,
): void {
	if (!context || typeof context.invalidate !== "function") return;
	if (context.state[ANIMATION_STATE_KEY] !== undefined) return;

	context.state[FRAME_STATE_KEY] = 0;
	context.state[ANIMATION_STATE_KEY] = setInterval(() => {
		const frame = (context.state[FRAME_STATE_KEY] as number | undefined) ?? 0;
		context.state[FRAME_STATE_KEY] = frame + 1;
		context.invalidate?.();
	}, ANIMATION_INTERVAL_MS);
}

export function clearSubagentResultAnimation(
	context: RenderAnimationContext | undefined,
): void {
	if (!context) return;
	const timer = context.state[ANIMATION_STATE_KEY];
	if (timer !== undefined) {
		clearInterval(timer as ReturnType<typeof setInterval>);
		delete context.state[ANIMATION_STATE_KEY];
	}
	delete context.state[FRAME_STATE_KEY];
}

export function getAnimationFrame(
	context: RenderAnimationContext | undefined,
): number {
	return (context?.state[FRAME_STATE_KEY] as number | undefined) ?? 0;
}
