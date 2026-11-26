// The few Workers runtime types the server code touches. Declared by hand
// because `wrangler types` emits runtime globals that clash with the DOM types
// the components are checked against.

// Cloudflare's per-data-centre cache.
interface CacheStorage {
	readonly default: Cache;
}

declare module 'cloudflare:workers' {
	interface KV {
		get<T>(key: string, type: 'json'): Promise<T | null>;
		put(key: string, value: string): Promise<void>;
	}
	export const env: { MAP_KV: KV };
	export function waitUntil(promise: Promise<unknown>): void;
}
