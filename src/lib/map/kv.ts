import { createClient } from 'redis';
import { env } from '$env/dynamic/private';
import type { ProfileCache } from './profiles';
import type { MapColours, SpillsBlob } from './types';

const COLOURS_KEY = 'map:colours';
const PROFILES_KEY = 'map:profiles';
const SPILLS_KEY = 'map:spills';

// `createClient({ url })` infers a narrower type than `createClient`'s default
// generics, so we take the type from this wrapper rather than from the bare
// `createClient` to keep them in step.
function makeClient(url: string) {
	const c = createClient({ url });
	// A dropped connection must not throw out of a request; reads fall back to
	// the empty blob and writes surface the failure to the cron.
	c.on('error', () => {});
	return c;
}

type RedisClient = ReturnType<typeof makeClient>;

// One lazily connected client per warm function instance. `ready` is the
// connection promise, awaited before any command. Both stay null when
// REDIS_URL is not configured, so the read path degrades to an empty blob
// rather than throwing during local dev or before the store is provisioned.
let client: RedisClient | null = null;
let ready: Promise<unknown> | null = null;

function connect(): RedisClient | null {
	const url = env.REDIS_URL;
	if (!url) return null;
	if (!client) {
		const c = makeClient(url);
		client = c;
		// Reset on a failed initial connect so the next call re-attempts rather
		// than awaiting a permanently rejected promise for the life of the
		// instance. The closure-captured `c` guard avoids nulling a newer client.
		ready = c.connect().catch((err) => {
			if (client === c) {
				client = null;
				ready = null;
			}
			throw err;
		});
	}
	return client;
}

async function readJson<T>(key: string): Promise<T | null> {
	const c = connect();
	if (!c) return null;
	try {
		await ready;
		const raw = await c.get(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

async function writeJson(key: string, value: unknown): Promise<void> {
	const c = connect();
	if (!c) throw new Error('REDIS_URL is not configured');
	await ready;
	await c.set(key, JSON.stringify(value));
}

export const readColours = () => readJson<MapColours>(COLOURS_KEY);
export const writeColours = (blob: MapColours) => writeJson(COLOURS_KEY, blob);
export const readProfiles = () => readJson<ProfileCache>(PROFILES_KEY);
export const writeProfiles = (cache: ProfileCache) => writeJson(PROFILES_KEY, cache);
export const readSpills = () => readJson<SpillsBlob>(SPILLS_KEY);
export const writeSpills = (blob: SpillsBlob) => writeJson(SPILLS_KEY, blob);
