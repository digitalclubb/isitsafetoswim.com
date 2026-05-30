import type { Location, LiveLocationData, VerdictResult } from '$lib/data/types';
import { decideAt, emptyVerdict } from '$lib/verdict/engine';
import { attributionFor } from './attribution';
import { fetchRecentDischarges } from './discharges';
import { fetchProfile } from './profile';
import { fetchRainfall24h } from './rainfall';

export async function buildLiveData(location: Location, signal?: AbortSignal): Promise<LiveLocationData> {
	const now = new Date();
	const [profileResult, dischargesResult, rainfallResult] = await Promise.allSettled([
		fetchProfile(location, signal),
		fetchRecentDischarges(location, signal),
		fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal)
	]);

	const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
	const recentDischarges = dischargesResult.status === 'fulfilled' ? dischargesResult.value : [];
	const rainfall24hMm = rainfallResult.status === 'fulfilled' ? rainfallResult.value : null;

	const classification = profile?.classification ?? location.classification;
	const latestSample = profile?.latestSample ?? null;
	const riskForecast = profile?.riskForecast ?? null;

	let verdict: VerdictResult;
	if (!profile && recentDischarges.length === 0 && rainfall24hMm === null) {
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
			profile ? 'fresh' : 'cached'
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
