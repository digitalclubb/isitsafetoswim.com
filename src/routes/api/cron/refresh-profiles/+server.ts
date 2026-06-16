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
 * Hourly Vercel Cron target. Refreshes the cached classifications, forecasts
 * and samples that the map run reads, so that run does not have to fetch ~600
 * profiles itself. Each run refreshes the least-recently-attempted batch, paced
 * under the host's rate limit, and the hourly schedule cycles through the
 * catalogue over a few hours. Secured by CRON_SECRET. Always safe to write:
 * failures keep the previously cached profile rather than overwriting it.
 * `cached` (any profile) fills quickly; `liveFetched` (a live success) climbs as
 * coverage converges.
 */
export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		throw error(401, 'unauthorised');
	}

	const now = new Date();
	const previous = await readProfiles();
	const { cache, batch, fetched, liveFetched, cached, total } = await computeProfileCache(
		now,
		previous,
		request.signal
	);
	await writeProfiles(cache);

	return json({
		ok: true,
		generatedAt: cache.generatedAt,
		batch,
		fetched,
		liveFetched,
		cached,
		total
	});
};
