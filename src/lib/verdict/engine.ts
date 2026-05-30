import type {
	Classification,
	DischargeEvent,
	RecentSample,
	RiskForecast,
	Verdict,
	VerdictFactor,
	VerdictResult
} from '$lib/data/types';

/**
 * The verdict engine combines four signals into one British-English answer:
 *   1. EA annual compliance classification.
 *   2. Daily pollution-risk forecast (in season only).
 *   3. Recent storm-overflow discharges within range.
 *   4. Rainfall in the last 24 hours.
 *
 * It is intentionally a pure function. All I/O happens upstream so the
 * engine is fully unit-tested and never throws on missing data.
 */
export interface VerdictInputs {
	classification: Classification;
	latestSample: RecentSample | null;
	riskForecast: RiskForecast | null;
	recentDischarges: DischargeEvent[];
	rainfall24hMm: number | null;
	now: Date;
}

const DISTANCE_NEARBY_M = 2_000;
const DISTANCE_RELEVANT_M = 5_000;
const DISTANCE_WIDER_M = 10_000;
const RECOVERY_WINDOW_HOURS = 12;
const RECENT_WINDOW_HOURS = 48;
const HEAVY_RAIN_MM = 15;
const NOTICEABLE_RAIN_MM = 8;
const E_COLI_CAUTION = 500;
const E_COLI_NO = 1_000;

export function bathingSeasonActive(d: Date): boolean {
	// UK bathing season runs from 15 May to 30 September.
	const month = d.getUTCMonth();
	const day = d.getUTCDate();
	if (month < 4 || month > 8) return false;
	if (month === 4 && day < 15) return false;
	return true;
}

function hoursSince(iso: string | undefined, now: Date): number | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return null;
	return (now.getTime() - t) / 36e5;
}

function ongoingNearby(discharges: DischargeEvent[], withinMetres: number): DischargeEvent | null {
	for (const d of discharges) {
		if (d.ongoing && d.distanceMetres <= withinMetres) return d;
	}
	return null;
}

function recentNearby(
	discharges: DischargeEvent[],
	withinMetres: number,
	maxAgeHours: number,
	now: Date
): DischargeEvent | null {
	for (const d of discharges) {
		if (d.distanceMetres > withinMetres) continue;
		const age = hoursSince(d.endedAt ?? d.startedAt, now);
		if (age === null) continue;
		if (age <= maxAgeHours) return d;
	}
	return null;
}

function fmtKm(m: number): string {
	const km = m / 1000;
	if (km < 1) return `${Math.round(m / 100) / 10}km`;
	return `${km.toFixed(km < 10 ? 1 : 0)}km`;
}

function fmtHours(h: number): string {
	if (h < 1) return 'in the last hour';
	if (h < 2) return 'an hour ago';
	if (h < 24) return `${Math.round(h)} hours ago`;
	const days = Math.round(h / 24);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function evaluateVerdict(inputs: VerdictInputs): Omit<VerdictResult, 'fetchedAt' | 'dataAge'> {
	const { classification, latestSample, riskForecast, recentDischarges, rainfall24hMm, now } =
		inputs;
	const factors: VerdictFactor[] = [];
	const inSeason = bathingSeasonActive(now);

	const ongoing = ongoingNearby(recentDischarges, DISTANCE_RELEVANT_M);
	const justFinished = recentNearby(
		recentDischarges.filter((d) => !d.ongoing),
		DISTANCE_RELEVANT_M,
		RECOVERY_WINDOW_HOURS,
		now
	);
	const recentWider = recentNearby(
		recentDischarges,
		DISTANCE_WIDER_M,
		RECENT_WINDOW_HOURS,
		now
	);
	const rain = rainfall24hMm ?? null;
	const ecoli = latestSample?.eColi ?? null;

	// ---- Hard NO ----------------------------------------------------------
	if (ongoing) {
		factors.push({
			label: 'Sewage discharge in progress',
			value: `${fmtKm(ongoing.distanceMetres)} away${
				ongoing.receivingWater ? `, into ${ongoing.receivingWater}` : ''
			}`,
			weight: 'negative'
		});
		return {
			verdict: 'no',
			headline: 'No.',
			reason: `Sewage being discharged ${fmtKm(ongoing.distanceMetres)} away right now.`,
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample)
		};
	}
	if (justFinished) {
		const age = hoursSince(justFinished.endedAt, now) ?? 0;
		factors.push({
			label: 'Recent sewage discharge',
			value: `${fmtKm(justFinished.distanceMetres)} away, ${fmtHours(age)}`,
			weight: 'negative'
		});
		return {
			verdict: 'no',
			headline: 'No.',
			reason: `Sewage discharged ${fmtKm(justFinished.distanceMetres)} away ${fmtHours(age)}.`,
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample)
		};
	}
	if (classification === 'Closed') {
		return {
			verdict: 'no',
			headline: 'No.',
			reason: 'This bathing water is closed.',
			factors: appendBaseFactors([], classification, riskForecast, rain, latestSample)
		};
	}
	if (classification === 'Poor' && inSeason) {
		factors.push({
			label: 'Annual classification',
			value: 'Poor',
			weight: 'negative'
		});
		return {
			verdict: 'no',
			headline: 'No.',
			reason: 'Annual classification is Poor and bathing is advised against.',
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample)
		};
	}
	if (ecoli !== null && ecoli >= E_COLI_NO) {
		factors.push({
			label: 'Latest E. coli',
			value: `${ecoli} cfu/100ml`,
			weight: 'negative'
		});
		return {
			verdict: 'no',
			headline: 'No.',
			reason: `Latest sample showed ${ecoli} E. coli cfu/100ml.`,
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample)
		};
	}

	// ---- Caution ----------------------------------------------------------
	const cautions: string[] = [];

	if (recentWider) {
		const age = hoursSince(recentWider.endedAt ?? recentWider.startedAt, now) ?? 0;
		cautions.push(`Sewage discharge ${fmtKm(recentWider.distanceMetres)} away ${fmtHours(age)}.`);
		factors.push({
			label: 'Discharge nearby',
			value: `${fmtKm(recentWider.distanceMetres)} ${fmtHours(age)}`,
			weight: 'negative'
		});
	}
	if (riskForecast?.riskLevel === 'increased') {
		cautions.push('Pollution risk is raised today.');
		factors.push({
			label: 'Pollution risk forecast',
			value: 'Increased',
			weight: 'negative'
		});
	}
	if (rain !== null && rain >= HEAVY_RAIN_MM) {
		cautions.push(`${Math.round(rain)}mm rain in the last 24 hours.`);
		factors.push({
			label: 'Rainfall (24h)',
			value: `${Math.round(rain)}mm`,
			weight: 'negative'
		});
	} else if (rain !== null && rain >= NOTICEABLE_RAIN_MM) {
		cautions.push(`${Math.round(rain)}mm rain in the last 24 hours may have flushed pollution.`);
		factors.push({
			label: 'Rainfall (24h)',
			value: `${Math.round(rain)}mm`,
			weight: 'neutral'
		});
	}
	if (classification === 'Sufficient') {
		cautions.push('Annual classification is only Sufficient.');
	}
	if (classification === 'New' || classification === 'Unknown') {
		cautions.push('No verified classification for this site yet.');
	}
	if (ecoli !== null && ecoli >= E_COLI_CAUTION && ecoli < E_COLI_NO) {
		cautions.push(`Latest E. coli was elevated at ${ecoli} cfu/100ml.`);
		factors.push({
			label: 'Latest E. coli',
			value: `${ecoli} cfu/100ml`,
			weight: 'negative'
		});
	}
	if (!inSeason) {
		cautions.push('Outside bathing season, the official forecast is not in operation.');
		factors.push({
			label: 'Bathing season',
			value: 'Outside official season',
			weight: 'neutral'
		});
	}

	if (cautions.length > 0) {
		return {
			verdict: 'caution',
			headline: 'Caution.',
			reason: cautions[0],
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample)
		};
	}

	// ---- Yes --------------------------------------------------------------
	const yesReason = classification === 'Excellent'
		? 'Excellent water quality and no sewage in the last 48 hours.'
		: 'Good water quality and no sewage in the last 48 hours.';
	return {
		verdict: 'yes',
		headline: 'Yes.',
		reason: yesReason,
		factors: appendBaseFactors([], classification, riskForecast, rain, latestSample)
	};
}

function appendBaseFactors(
	existing: VerdictFactor[],
	classification: Classification,
	risk: RiskForecast | null,
	rain: number | null,
	sample: RecentSample | null
): VerdictFactor[] {
	const seen = new Set(existing.map((f) => f.label));
	const out = [...existing];
	if (!seen.has('Annual classification')) {
		out.push({
			label: 'Annual classification',
			value: classification,
			weight: classWeight(classification)
		});
	}
	if (risk && !seen.has('Pollution risk forecast')) {
		out.push({
			label: 'Pollution risk forecast',
			value: risk.riskLevel === 'normal' ? 'Normal' : risk.riskLevel === 'increased' ? 'Increased' : 'Not reported',
			weight: risk.riskLevel === 'increased' ? 'negative' : 'positive'
		});
	}
	if (rain !== null && !seen.has('Rainfall (24h)')) {
		out.push({
			label: 'Rainfall (24h)',
			value: `${Math.round(rain)}mm`,
			weight: rain >= NOTICEABLE_RAIN_MM ? 'neutral' : 'positive'
		});
	}
	if (sample?.eColi !== undefined && !seen.has('Latest E. coli')) {
		out.push({
			label: 'Latest E. coli',
			value: `${sample.eColi} cfu/100ml`,
			weight: sample.eColi >= E_COLI_CAUTION ? 'negative' : 'positive'
		});
	}
	return out;
}

function classWeight(c: Classification): VerdictFactor['weight'] {
	switch (c) {
		case 'Excellent':
		case 'Good':
			return 'positive';
		case 'Sufficient':
		case 'New':
		case 'Unknown':
			return 'neutral';
		case 'Poor':
		case 'Closed':
			return 'negative';
	}
}

export function emptyVerdict(reason: string, now: Date): VerdictResult {
	return {
		verdict: 'caution',
		headline: 'Hard to say.',
		reason,
		factors: [],
		fetchedAt: now.toISOString(),
		dataAge: 'unavailable'
	};
}

export function decideAt(inputs: VerdictInputs, dataAge: VerdictResult['dataAge'] = 'fresh'): VerdictResult {
	const decided = evaluateVerdict(inputs);
	return {
		...decided,
		fetchedAt: inputs.now.toISOString(),
		dataAge
	};
}

export const _internals = {
	DISTANCE_NEARBY_M,
	DISTANCE_RELEVANT_M,
	DISTANCE_WIDER_M,
	HEAVY_RAIN_MM,
	NOTICEABLE_RAIN_MM,
	E_COLI_CAUTION,
	E_COLI_NO
};

export type { Verdict };
