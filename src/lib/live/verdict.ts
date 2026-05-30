import type { Location, LiveLocationData, VerdictResult } from '$lib/data/types';
import { decideAt, emptyVerdict } from '$lib/verdict/engine';
import { attributionFor } from './attribution';
import { fetchRecentDischarges } from './discharges';
import { fetchProfile } from './profile';
import { fetchRainfall24h } from './rainfall';

/**
 * Build an instant verdict from the build-time classification only — no
 * network calls. Used to render the location page immediately so navigation
 * never blocks on the regulator APIs. The live verdict hydrates afterwards
 * via /api/verdict/[id].
 */
export function buildCachedData(location: Location): LiveLocationData {
	const now = new Date();
	const verdict = decideAt(
		{
			classification: location.classification,
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: null,
			now
		},
		'cached'
	);
	return {
		location,
		classification: location.classification,
		latestSample: null,
		riskForecast: null,
		recentDischarges: [],
		rainfall24hMm: null,
		verdict,
		attribution: attributionFor(location.country, false)
	};
}

export async function buildLiveData(location: Location, signal?: AbortSignal): Promise<LiveLocationData> {
	const now = new Date();
	const [profileResult, dischargesResult, rainfallResult] = await Promise.allSettled([
		fetchProfile(location, signal),
		fetchRecentDischarges(location, signal),
		fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal)
	]);

	const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
	const profileOk = profile?.ok ?? false;
	const recentDischarges = dischargesResult.status === 'fulfilled' ? dischargesResult.value : [];
	const rainfall24hMm = rainfallResult.status === 'fulfilled' ? rainfallResult.value : null;

	const classification = profile?.classification ?? location.classification;
	const latestSample = profile?.latestSample ?? null;
	const riskForecast = profile?.riskForecast ?? null;

	const everythingFailed =
		!profileOk && recentDischarges.length === 0 && rainfall24hMm === null;

	let verdict: VerdictResult;
	if (everythingFailed) {
		verdict = emptyVerdict(
			'We could not reach the live data sources for this site. Try again in a few minutes.',
			now
		);
	} else {
		verdict = decideAt(
			{
				classification,
				latestSample,
				riskForecast,
				recentDischarges,
				rainfall24hMm,
				now
			},
			profileOk ? 'fresh' : 'cached'
		);
	}

	return {
		location,
		classification,
		latestSample,
		riskForecast,
		recentDischarges,
		rainfall24hMm,
		verdict,
		attribution: attributionFor(location.country, recentDischarges.length > 0)
	};
}
