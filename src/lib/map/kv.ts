import { env } from 'cloudflare:workers';
import type { ProfileCache } from './profiles';
import type { MapColours, RainfallBlob, SpillsBlob } from './types';

const COLOURS_KEY = 'map:colours';
const PROFILES_KEY = 'map:profiles';
const SPILLS_KEY = 'map:spills';
const RAINFALL_KEY = 'map:rainfall';

// Reads must never reject: callers treat null as "no cached value" and carry
// on with whatever they can fetch live. Writes surface failures to the cron.
async function readJson<T>(key: string): Promise<T | null> {
	try {
		return await env.MAP_KV.get<T>(key, 'json');
	} catch {
		return null;
	}
}

const writeJson = async (key: string, value: unknown) => env.MAP_KV.put(key, JSON.stringify(value));

export const readColours = () => readJson<MapColours>(COLOURS_KEY);
export const writeColours = (blob: MapColours) => writeJson(COLOURS_KEY, blob);
export const readProfiles = () => readJson<ProfileCache>(PROFILES_KEY);
export const writeProfiles = (cache: ProfileCache) => writeJson(PROFILES_KEY, cache);
export const readSpills = () => readJson<SpillsBlob>(SPILLS_KEY);
export const writeSpills = (blob: SpillsBlob) => writeJson(SPILLS_KEY, blob);
export const readRainfall = () => readJson<RainfallBlob>(RAINFALL_KEY);
export const writeRainfall = (blob: RainfallBlob) => writeJson(RAINFALL_KEY, blob);
