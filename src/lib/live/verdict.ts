import type {
	Classification,
	LiveLocationData,
	Location,
	RecentSample,
	RiskForecast,
	VerdictResult
} from '$lib/data/types';
import { decideAt, emptyVerdict } from '$lib/verdict/engine';
import { attributionFor } from './attribution';
import { fetchRecentDischarges } from './discharges';
import { fetchProfile } from './profile';
import { fetchRainfall24h } from './rainfall';
import { loadSnapshot } from './snapshot';

interface ProfileReading {
	profileOk: boolean;
	classification: Classification | null;
	latestSample: RecentSample | null;
	riskForecast: RiskForecast | null;
	rainfall24hMm: number | null;
}

/**
 * Profile and rainfall come from the scheduled snapshot when it is available
 * (the regulator host 403s Vercel IPs at request time). Where there is no
 * snapshot entry, for example in local dev or before the first cron run, fetch
 * the regulator directly so dev parity is preserved.
 */
async function readProfile(location: Location, signal?: AbortSignal): Promise<ProfileReading> {
	const snapshot = await loadSnapshot();
	const entry = snapshot?.sites?.[location.id];
	if (entry && typeof entry === 'object') {
		return {
			profileOk: entry.ok,
			classification: entry.classification,
			latestSample: entry.latestSample,
			riskForecast: entry.riskForecast,
			rainfall24hMm: entry.rainfall24hMm
		};
	}

	const [profileResult, rainfallResult] = await Promise.allSettled([
		fetchProfile(location, signal),
		fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal)
	]);
	const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
	return {
		profileOk: profile?.ok ?? false,
		classification: profile?.classification ?? null,
		latestSample: profile?.latestSample ?? null,
		riskForecast: profile?.riskForecast ?? null,
		rainfall24hMm: rainfallResult.status === 'fulfilled' ? rainfallResult.value : null
	};
}

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

export async function buildLiveData(
	location: Location,
	signal?: AbortSignal
): Promise<LiveLocationData> {
	const now = new Date();
	const [profileReading, dischargesResult] = await Promise.allSettled([
		readProfile(location, signal),
		fetchRecentDischarges(location, signal)
	]);

	const profile =
		profileReading.status === 'fulfilled'
			? profileReading.value
			: {
					profileOk: false,
					classification: null,
					latestSample: null,
					riskForecast: null,
					rainfall24hMm: null
				};
	const profileOk = profile.profileOk;
	const recentDischarges = dischargesResult.status === 'fulfilled' ? dischargesResult.value : [];
	const rainfall24hMm = profile.rainfall24hMm;

	const classification = profile.classification ?? location.classification;
	const latestSample = profile.latestSample;
	const riskForecast = profile.riskForecast;

	const everythingFailed = !profileOk && recentDischarges.length === 0 && rainfall24hMm === null;

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
