import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { readProfiles, writeProfiles } from '$lib/map/kv';
import { computeProfileCache } from '$lib/map/profiles';
import type { RequestHandler } from './$types';

export const prerender = false;

export const config = {
	runtime: 'nodejs22.x',
	maxDuration: 300
};

/**
 * Daily Vercel Cron target. Refreshes the cached classifications, forecasts and
 * samples that the hourly map run reads, so that run does not have to fetch
 * ~600 profiles itself. Secured by CRON_SECRET. Always safe to write: failures
 * keep the previously cached profile rather than overwriting it.
 */
export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		throw error(401, 'unauthorised');
	}

	const now = new Date();
	const previous = await readProfiles();
	const { cache, fetched, total } = await computeProfileCache(now, previous, request.signal);
	await writeProfiles(cache);

	return json({
		ok: true,
		generatedAt: cache.generatedAt,
		fetched,
		cached: Object.keys(cache.profiles).length,
		total
	});
};
