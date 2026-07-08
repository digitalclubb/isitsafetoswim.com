import type { DischargeEvent, LiveLocationData, Location, VerdictResult } from '$lib/data/types';
import { decideAt, emptyVerdict } from '$lib/verdict/engine';
import { attributionFor, type OverflowSource } from './attribution';
import { fetchRecentDischarges, isThamesWater } from './discharges';
import { fetchSampleHistory } from './history';
import { fetchProfile } from './profile';
import { fetchRainfall24h } from './rainfall';
import { fetchSeaTemperature } from './temperature';

type Profile = Awaited<ReturnType<typeof fetchProfile>>;

/**
 * Reduce the live signals to a single verdict. Shared by the per-location page
 * (through buildLiveData) and the map precompute so both produce exactly the
 * same verdict from the same inputs. A site we could not reach at all returns
 * the unavailable verdict, which the precompute treats as "no colour yet".
 */
export function deriveVerdict(
	location: Location,
	profile: Profile | null,
	recentDischarges: DischargeEvent[],
	rainfall24hMm: number | null,
	now: Date
): VerdictResult {
	const profileOk = profile?.ok ?? false;
	const everythingFailed = !profileOk && recentDischarges.length === 0 && rainfall24hMm === null;
	if (everythingFailed) {
		return emptyVerdict(
			'We could not reach the live data sources for this site. Try again in a few minutes.',
			now
		);
	}
	return decideAt(
		{
			classification: profile?.classification ?? location.classification,
			latestSample: profile?.latestSample ?? null,
			riskForecast: profile?.riskForecast ?? null,
			recentDischarges,
			rainfall24hMm,
			waterType: location.waterType,
			rainImpacted: location.rainImpacted,
			now
		},
		profileOk ? 'fresh' : 'cached'
	);
}

export async function buildLiveData(
	location: Location,
	signal?: AbortSignal
): Promise<LiveLocationData> {
	const now = new Date();
	const [profileResult, dischargesResult, rainfallResult, historyResult, temperatureResult] =
		await Promise.allSettled([
			fetchProfile(location, signal),
			fetchRecentDischarges(location, signal),
			fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal),
			fetchSampleHistory(location, signal),
			fetchSeaTemperature(location, signal)
		]);

	const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
	const recentDischarges = dischargesResult.status === 'fulfilled' ? dischargesResult.value : [];
	const rainfall24hMm = rainfallResult.status === 'fulfilled' ? rainfallResult.value : null;
	const sampleHistory = historyResult.status === 'fulfilled' ? historyResult.value : [];
	const seaTemperatureC = temperatureResult.status === 'fulfilled' ? temperatureResult.value : null;

	const classification = profile?.classification ?? location.classification;
	const latestSample = profile?.latestSample ?? null;
	const riskForecast = profile?.riskForecast ?? null;

	const overflowSource: OverflowSource =
		recentDischarges.length === 0
			? 'none'
			: isThamesWater(location.sewerageUndertaker)
				? 'thames'
				: 'ogl';

	const verdict = deriveVerdict(location, profile, recentDischarges, rainfall24hMm, now);

	return {
		location,
		classification,
		latestSample,
		riskForecast,
		recentDischarges,
		rainfall24hMm,
		sampleHistory,
		seaTemperatureC,
		verdict,
		attribution: attributionFor(location.country, overflowSource)
	};
}
