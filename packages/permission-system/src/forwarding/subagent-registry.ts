const SUBAGENT_SESSION_REGISTRY_KEY = Symbol.for(
	"@vitos-pizza/permission-system:subagent-registry",
);

export interface SubagentSessionInfo {
	parentSessionId?: string;
}

export class SubagentSessionRegistry {
	private readonly sessions = new Map<string, SubagentSessionInfo>();

	register(sessionId: string, info: SubagentSessionInfo): void {
		this.sessions.set(sessionId, info);
	}

	unregister(sessionId: string): void {
		this.sessions.delete(sessionId);
	}

	get(sessionId: string): SubagentSessionInfo | undefined {
		return this.sessions.get(sessionId);
	}
}

export function getSubagentSessionRegistry(): SubagentSessionRegistry {
	const store = globalThis as Record<symbol, unknown>;
	const existing = store[SUBAGENT_SESSION_REGISTRY_KEY] as
		| SubagentSessionRegistry
		| undefined;
	if (existing) return existing;
	const registry = new SubagentSessionRegistry();
	store[SUBAGENT_SESSION_REGISTRY_KEY] = registry;
	return registry;
}

export const SUBAGENT_CHILD_SESSION_CREATED = "subagents:child:session-created";
export const SUBAGENT_CHILD_DISPOSED = "subagents:child:disposed";

interface LifecycleEventBus {
	on(channel: string, handler: (data: unknown) => void): () => void;
}

export function subscribeSubagentLifecycle(
	events: LifecycleEventBus,
	registry: SubagentSessionRegistry,
): () => void {
	const unsubCreated = events.on(SUBAGENT_CHILD_SESSION_CREATED, (data) => {
		const event = data as { sessionId: string; parentSessionId?: string };
		registry.register(event.sessionId, {
			parentSessionId: event.parentSessionId,
		});
	});
	const unsubDisposed = events.on(SUBAGENT_CHILD_DISPOSED, (data) => {
		const event = data as { sessionId: string };
		registry.unregister(event.sessionId);
	});
	return () => {
		unsubCreated();
		unsubDisposed();
	};
}
