import type {
	DischargeEvent,
	LiveLocationData,
	Location,
	RecentSample,
	VerdictResult
} from '$lib/data/types';
import { decideAt, emptyVerdict } from '$lib/verdict/engine';
import { attributionFor, type OverflowSource } from './attribution';
import { fetchRecentDischarges, isThamesWater } from './discharges';
import { fetchSampleHistory } from './history';
import { fetchProfile, type ProfileFetchResult } from './profile';
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

/**
 * Fold the resolved signals into the page payload. Shared by buildLiveData and
 * buildPageData so both assemble the verdict, attribution and record shape
 * identically; they differ only in which signals they fetch.
 */
function assemble(
	location: Location,
	profile: Profile | null,
	recentDischarges: DischargeEvent[],
	rainfall24hMm: number | null,
	sampleHistory: RecentSample[],
	seaTemperatureC: number | null,
	now: Date
): LiveLocationData {
	const overflowSource: OverflowSource =
		recentDischarges.length === 0
			? 'none'
			: isThamesWater(location.sewerageUndertaker)
				? 'thames'
				: 'ogl';

	return {
		location,
		classification: profile?.classification ?? location.classification,
		latestSample: profile?.latestSample ?? null,
		riskForecast: profile?.riskForecast ?? null,
		recentDischarges,
		rainfall24hMm,
		sampleHistory,
		seaTemperatureC,
		verdict: deriveVerdict(location, profile, recentDischarges, rainfall24hMm, now),
		attribution: attributionFor(location.country, overflowSource)
	};
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

	return assemble(
		location,
		profileResult.status === 'fulfilled' ? profileResult.value : null,
		dischargesResult.status === 'fulfilled' ? dischargesResult.value : [],
		rainfallResult.status === 'fulfilled' ? rainfallResult.value : null,
		historyResult.status === 'fulfilled' ? historyResult.value : [],
		temperatureResult.status === 'fulfilled' ? temperatureResult.value : null,
		now
	);
}

/**
 * Choose the profile the page verdict is built from: prefer the live fetch when
 * it succeeded, fall back to the cached profile, and only then to whatever the
 * live fetch returned (an ok:false fallback or null). Pure, so the fallback
 * order that guards the safety verdict is unit-tested without the network.
 */
export function pickProfile(
	live: ProfileFetchResult | null,
	cached: ProfileFetchResult | null
): ProfileFetchResult | null {
	if (live?.ok) return live;
	if (cached?.ok) return cached;
	return live;
}

/**
 * The payload for the per-location page. The daily forecast and latest sample
 * are fetched live so the safety verdict reflects today, falling back to the
 * precomputed profile cache only when the live fetch fails, so a slow or blocked
 * regulator host degrades to the last good reading rather than blocking the
 * render. Discharges and rainfall stay live too, so the page is the authority
 * on today's spills. The sample-history sparkline and sea temperature are
 * decoration that cannot change the verdict, so they are left empty here and
 * hydrated after paint.
 */
export async function buildPageData(
	location: Location,
	cachedProfile: ProfileFetchResult | null,
	signal?: AbortSignal
): Promise<LiveLocationData> {
	const now = new Date();
	const [profileResult, dischargesResult, rainfallResult] = await Promise.allSettled([
		fetchProfile(location, signal),
		fetchRecentDischarges(location, signal),
		fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal)
	]);

	const live = profileResult.status === 'fulfilled' ? profileResult.value : null;
	const profile = pickProfile(live, cachedProfile);

	return assemble(
		location,
		profile,
		dischargesResult.status === 'fulfilled' ? dischargesResult.value : [],
		rainfallResult.status === 'fulfilled' ? rainfallResult.value : null,
		[],
		null,
		now
	);
}
