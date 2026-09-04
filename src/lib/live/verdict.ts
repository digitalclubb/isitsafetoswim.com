import type {
	DischargeEvent,
	LiveLocationData,
	Location,
	RecentSample,
	TideInfo,
	VerdictResult
} from '$lib/data/types';
import { decideAt, emptyVerdict } from '$lib/verdict/engine';
import { attributionFor, type OverflowSource } from './attribution';
import { fetchRecentDischarges, hasDischargeFeed, isThamesWater } from './discharges';
import { fetchSampleHistory } from './history';
import { fetchProfile, type ProfileFetchResult } from './profile';
import { fetchRainfall24h } from './rainfall';
import { fetchSeaTemperature } from './temperature';
import { fetchTide } from './tides';

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
			hasDischargeFeed: hasDischargeFeed(location),
			country: location.country,
			currentAssessment: location.currentAssessment ?? null,
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
	tide: TideInfo | null,
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
		hasDischargeFeed: hasDischargeFeed(location),
		rainfall24hMm,
		sampleHistory,
		seaTemperatureC,
		tide,
		verdict: deriveVerdict(location, profile, recentDischarges, rainfall24hMm, now),
		attribution: attributionFor(location.country, overflowSource)
	};
}

export async function buildLiveData(
	location: Location,
	signal?: AbortSignal
): Promise<LiveLocationData> {
	const now = new Date();
	const [
		profileResult,
		dischargesResult,
		rainfallResult,
		historyResult,
		temperatureResult,
		tideResult
	] = await Promise.allSettled([
		fetchProfile(location, signal),
		fetchRecentDischarges(location, signal),
		fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal),
		fetchSampleHistory(location, signal),
		fetchSeaTemperature(location, signal),
		fetchTide(location, signal)
	]);

	return assemble(
		location,
		profileResult.status === 'fulfilled' ? profileResult.value : null,
		dischargesResult.status === 'fulfilled' ? dischargesResult.value : [],
		rainfallResult.status === 'fulfilled' ? rainfallResult.value : null,
		historyResult.status === 'fulfilled' ? historyResult.value : [],
		temperatureResult.status === 'fulfilled' ? temperatureResult.value : null,
		tideResult.status === 'fulfilled' ? tideResult.value : null,
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

/** The precomputed signals the page reads rather than fetching for itself. */
export interface CachedSignals {
	profile: ProfileFetchResult | null;
	rainfall24hMm: number | null;
}

/**
 * The payload for the per-location page. The daily forecast and latest sample
 * are fetched live so the safety verdict reflects today, falling back to the
 * precomputed profile cache only when the live fetch fails, so a slow or blocked
 * regulator host degrades to the last good reading rather than blocking the
 * render. Discharges stay live, so the page is the authority on today's spills.
 *
 * Rainfall comes from the hourly precompute instead. Resolving the nearest
 * flood-monitoring station takes anywhere from 0.1s to 15s, which dominated the
 * render, and a rolling 24h total moves far too slowly to be worth that. The
 * cache is passed in as a promise so it is awaited here, alongside the live
 * fetches, rather than ahead of them.
 *
 * Sea temperature and the tide are decoration that cannot change the verdict,
 * but they are fetched here rather than after paint: both come from Open-Meteo
 * in a couple of hundred milliseconds, and cold-water and tide questions are
 * exactly the winter demand a client-only render hides from crawlers. The
 * sample-history sparkline stays deferred, because it reads the rate-limited
 * regulator host that made a cold render take ten seconds.
 */
export async function buildPageData(
	location: Location,
	cached: Promise<CachedSignals>,
	signal?: AbortSignal
): Promise<LiveLocationData> {
	const now = new Date();
	const [profileResult, dischargesResult, cachedResult, temperatureResult, tideResult] =
		await Promise.allSettled([
			fetchProfile(location, signal),
			fetchRecentDischarges(location, signal),
			cached,
			fetchSeaTemperature(location, signal),
			fetchTide(location, signal)
		]);

	const signals: CachedSignals =
		cachedResult.status === 'fulfilled' ? cachedResult.value : { profile: null, rainfall24hMm: null };
	const live = profileResult.status === 'fulfilled' ? profileResult.value : null;

	return assemble(
		location,
		pickProfile(live, signals.profile),
		dischargesResult.status === 'fulfilled' ? dischargesResult.value : [],
		signals.rainfall24hMm,
		[],
		temperatureResult.status === 'fulfilled' ? temperatureResult.value : null,
		tideResult.status === 'fulfilled' ? tideResult.value : null,
		now
	);
}
