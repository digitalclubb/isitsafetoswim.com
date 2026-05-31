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
	/**
	 * Coastal and inland waters have different sample standards. Defaults to the
	 * stricter coastal cut-offs when unknown.
	 */
	waterType?: 'coastal' | 'inland';
	/**
	 * EA flag: is this site's water quality degraded by heavy rain? When the EA
	 * says no (false), rainfall is still reported but does not on its own raise a
	 * caution. Unknown (null/undefined) is treated as "might be", so rainfall can
	 * still caution.
	 */
	rainImpacted?: boolean | null;
	now: Date;
}

const DISTANCE_NEARBY_M = 2_000;
const DISTANCE_RELEVANT_M = 5_000;
const DISTANCE_WIDER_M = 10_000;
const RECOVERY_WINDOW_HOURS = 12;
const RECENT_WINDOW_HOURS = 48;
const HEAVY_RAIN_MM = 15;
const NOTICEABLE_RAIN_MM = 8;

/**
 * Single-sample risk cut-offs in cfu/100ml. There is no statutory single-sample
 * standard (classification is a multi-year percentile), so these adopt the
 * revised Bathing Water Directive percentile boundaries as proxy cut-offs:
 * "elevated" at the Good 95th-percentile boundary, "high" at roughly twice it.
 * Coastal and inland differ, and intestinal enterococci runs lower than E. coli
 * and is often the limiting parameter at the coast, so the two are assessed
 * separately and the worse result wins.
 */
const SAMPLE_THRESHOLDS = {
	coastal: {
		'E. coli': { elevated: 500, high: 1_000 },
		'intestinal enterococci': { elevated: 200, high: 400 }
	},
	inland: {
		'E. coli': { elevated: 1_000, high: 2_000 },
		'intestinal enterococci': { elevated: 400, high: 800 }
	}
} as const;

interface SampleRisk {
	level: 'elevated' | 'high';
	label: string;
	value: number;
}

/**
 * Assess the latest sample against both parameters and return the worse result,
 * or null when the sample is clean or absent. Enterococci and E. coli have
 * different thresholds, so a clean E. coli reading does not clear a high
 * enterococci one.
 */
function worstSampleRisk(
	sample: RecentSample | null,
	waterType: 'coastal' | 'inland'
): SampleRisk | null {
	if (!sample) return null;
	const t = SAMPLE_THRESHOLDS[waterType];
	const params: Array<[string, number | undefined, { elevated: number; high: number }]> = [
		['E. coli', sample.eColi, t['E. coli']],
		['intestinal enterococci', sample.intestinalEnterococci, t['intestinal enterococci']]
	];
	let worst: SampleRisk | null = null;
	for (const [label, value, limits] of params) {
		if (value === undefined) continue;
		const level = value >= limits.high ? 'high' : value >= limits.elevated ? 'elevated' : null;
		if (!level) continue;
		// Promote to the more severe level. When both parameters reach the same
		// level we keep the first (E. coli), which is the more familiar figure to
		// report; the verdict is identical either way.
		if (!worst || (level === 'high' && worst.level === 'elevated')) {
			worst = { level, label, value };
		}
	}
	return worst;
}

/**
 * Band a single sample reading for one parameter against the water-type
 * thresholds. Shared with the trend sparkline so its colours match the verdict.
 */
export function sampleBand(
	value: number,
	parameter: 'E. coli' | 'intestinal enterococci',
	waterType: 'coastal' | 'inland' = 'coastal'
): 'low' | 'elevated' | 'high' {
	const limits = SAMPLE_THRESHOLDS[waterType][parameter];
	return value >= limits.high ? 'high' : value >= limits.elevated ? 'elevated' : 'low';
}

/** The "high" E. coli cut-off, used to scale the trend sparkline consistently. */
export function eColiScaleCeiling(waterType: 'coastal' | 'inland' = 'coastal'): number {
	return SAMPLE_THRESHOLDS[waterType]['E. coli'].high;
}

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

export function evaluateVerdict(
	inputs: VerdictInputs
): Omit<VerdictResult, 'fetchedAt' | 'dataAge'> {
	const { classification, latestSample, riskForecast, recentDischarges, rainfall24hMm, now } =
		inputs;
	const waterType = inputs.waterType ?? 'coastal';
	const rainMatters = inputs.rainImpacted !== false;
	const factors: VerdictFactor[] = [];
	const inSeason = bathingSeasonActive(now);

	const ongoing = ongoingNearby(recentDischarges, DISTANCE_RELEVANT_M);
	const justFinished = recentNearby(
		recentDischarges.filter((d) => !d.ongoing),
		DISTANCE_RELEVANT_M,
		RECOVERY_WINDOW_HOURS,
		now
	);
	const recentWider = recentNearby(recentDischarges, DISTANCE_WIDER_M, RECENT_WINDOW_HOURS, now);
	const rain = rainfall24hMm ?? null;
	const sampleRisk = worstSampleRisk(latestSample, waterType);

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
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample, waterType)
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
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample, waterType)
		};
	}
	if (classification === 'Closed') {
		return {
			verdict: 'no',
			headline: 'No.',
			reason: 'This bathing water is closed.',
			factors: appendBaseFactors([], classification, riskForecast, rain, latestSample, waterType)
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
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample, waterType)
		};
	}
	if (sampleRisk?.level === 'high') {
		factors.push({
			label: `Latest ${sampleRisk.label}`,
			value: `${sampleRisk.value} cfu/100ml`,
			weight: 'negative'
		});
		return {
			verdict: 'no',
			headline: 'No.',
			reason: `Latest sample showed ${sampleRisk.value} ${sampleRisk.label} cfu/100ml.`,
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample, waterType)
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
	if (rain !== null && rain >= HEAVY_RAIN_MM && rainMatters) {
		cautions.push(`${Math.round(rain)}mm rain in the last 24 hours.`);
		factors.push({
			label: 'Rainfall (24h)',
			value: `${Math.round(rain)}mm`,
			weight: 'negative'
		});
	} else if (rain !== null && rain >= NOTICEABLE_RAIN_MM && rainMatters) {
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
	if (sampleRisk?.level === 'elevated') {
		cautions.push(`Latest ${sampleRisk.label} was elevated at ${sampleRisk.value} cfu/100ml.`);
		factors.push({
			label: `Latest ${sampleRisk.label}`,
			value: `${sampleRisk.value} cfu/100ml`,
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
			factors: appendBaseFactors(factors, classification, riskForecast, rain, latestSample, waterType)
		};
	}

	// ---- Yes --------------------------------------------------------------
	const yesReason =
		classification === 'Excellent'
			? 'Excellent water quality and no sewage in the last 48 hours.'
			: 'Good water quality and no sewage in the last 48 hours.';
	return {
		verdict: 'yes',
		headline: 'Yes.',
		reason: yesReason,
		factors: appendBaseFactors([], classification, riskForecast, rain, latestSample, waterType)
	};
}

function appendBaseFactors(
	existing: VerdictFactor[],
	classification: Classification,
	risk: RiskForecast | null,
	rain: number | null,
	sample: RecentSample | null,
	waterType: 'coastal' | 'inland'
): VerdictFactor[] {
	const seen = new Set(existing.map((f) => f.label));
	const out = [...existing];
	const limits = SAMPLE_THRESHOLDS[waterType];
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
			value:
				risk.riskLevel === 'normal'
					? 'Normal'
					: risk.riskLevel === 'increased'
						? 'Increased'
						: 'Not reported',
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
			weight: sample.eColi >= limits['E. coli'].elevated ? 'negative' : 'positive'
		});
	}
	if (sample?.intestinalEnterococci !== undefined && !seen.has('Latest intestinal enterococci')) {
		out.push({
			label: 'Latest intestinal enterococci',
			value: `${sample.intestinalEnterococci} cfu/100ml`,
			weight:
				sample.intestinalEnterococci >= limits['intestinal enterococci'].elevated
					? 'negative'
					: 'positive'
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

export function decideAt(
	inputs: VerdictInputs,
	dataAge: VerdictResult['dataAge'] = 'fresh'
): VerdictResult {
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
	SAMPLE_THRESHOLDS
};

export type { Verdict };
