import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { computeMapColours } from '$lib/map/compute';
import { writeColours, writeSpills } from '$lib/map/kv';
import type { RequestHandler } from './$types';

export const prerender = false;

export const config = {
	runtime: 'nodejs22.x',
	// The whole catalogue is computed in one run, so allow well beyond the
	// default function budget.
	maxDuration: 300
};

/**
 * Hourly Vercel Cron target. Recomputes every beach's verdict and writes the
 * colour blob the map reads. Secured by CRON_SECRET, which Vercel sends as a
 * bearer token on scheduled invocations.
 */
export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		throw error(401, 'unauthorised');
	}

	const now = new Date();
	const { blob, spills, computed, skipped, total } = await computeMapColours(now, request.signal);

	// A backstop: profiles now come from the daily cache so a profile outage no
	// longer drops beaches, but a catastrophic failure (e.g. the whole compute)
	// still should not overwrite a good snapshot with a mostly-neutral one.
	if (computed < total * 0.5) {
		return json({
			ok: false,
			reason: 'too few beaches computed, keeping the previous snapshot',
			computed,
			skipped,
			total
		});
	}

	// Spills share the colours guard deliberately: both are written only on a
	// healthy run, so a partial outage keeps the last good snapshot of each
	// rather than a mostly-empty one.
	await writeColours(blob);
	await writeSpills({ generatedAt: blob.generatedAt, spills });
	return json({
		ok: true,
		generatedAt: blob.generatedAt,
		computed,
		skipped,
		total,
		spills: spills.length
	});
};
