import type { Classification, Location, RecentSample, RiskForecast } from '$lib/data/types';
import { fetchJson } from './http';

interface LinkedDataValue {
	_value?: unknown;
	'@value'?: unknown;
	name?: unknown;
	label?: unknown;
	prefLabel?: unknown;
}

function readLabel(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === 'string') {
		if (/^https?:\/\//i.test(value)) return undefined;
		return value;
	}
	if (Array.isArray(value)) {
		const labels = value.map(readLabel).filter((v): v is string => Boolean(v));
		return labels.length ? labels.join(', ') : undefined;
	}
	if (typeof value === 'object') {
		const v = value as LinkedDataValue & { inXSDDateTime?: unknown };
		if ('_value' in v) return readLabel(v._value);
		if ('@value' in v) return readLabel(v['@value']);
		if ('inXSDDateTime' in v) return readLabel(v.inXSDDateTime);
		if ('name' in v) return readLabel(v.name);
		if ('prefLabel' in v) return readLabel(v.prefLabel);
		if ('label' in v) return readLabel(v.label);
	}
	return undefined;
}

function readNumber(value: unknown): number | undefined {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		const n = Number(value);
		return Number.isFinite(n) ? n : undefined;
	}
	if (value && typeof value === 'object' && '_value' in (value as object)) {
		return readNumber((value as LinkedDataValue)._value);
	}
	return undefined;
}

function classify(raw: string | undefined): Classification | undefined {
	if (!raw) return undefined;
	const lower = raw.toLowerCase();
	if (lower.includes('excellent')) return 'Excellent';
	if (lower.includes('sufficient')) return 'Sufficient';
	if (lower.includes('good')) return 'Good';
	if (lower.includes('poor')) return 'Poor';
	if (lower === 'new' || lower.includes('insufficient')) return 'New';
	if (lower.includes('closed') || lower.includes('decommiss')) return 'Closed';
	return undefined;
}

export interface ProfileFetchResult {
	classification: Classification | null;
	latestSample: RecentSample | null;
	riskForecast: RiskForecast | null;
	source: string;
}

function profileEndpoint(location: Location): string | null {
	if (location.source.api === 'ea') {
		return `https://environment.data.gov.uk/doc/bathing-water/${location.source.sourceId}.json`;
	}
	if (location.source.api === 'nrw') {
		return `https://environment.data.gov.uk/wales/bathing-waters/doc/bathing-water/${location.source.sourceId}.json`;
	}
	return null;
}

interface ItemShape {
	latestComplianceAssessment?: {
		complianceClassification?: unknown;
	};
	latestSampleAssessment?:
		| string
		| {
				sampleDateTime?: unknown;
				escherichiaColiCount?: unknown;
				intestinalEnterococciCount?: unknown;
				bacteriaCount?: Array<{ parameter?: unknown; countValue?: unknown }>;
		  };
	latestRiskPrediction?: {
		riskLevel?: unknown;
		expiresAt?: unknown;
	};
}

function pickItem(payload: unknown): ItemShape | null {
	if (!payload || typeof payload !== 'object') return null;
	const r = (payload as { result?: { items?: unknown[]; primaryTopic?: unknown } }).result;
	if (!r) return null;
	if (r.primaryTopic && typeof r.primaryTopic === 'object') return r.primaryTopic as ItemShape;
	if (Array.isArray(r.items) && r.items[0]) return r.items[0] as ItemShape;
	return null;
}

function extractSample(sample: ItemShape['latestSampleAssessment']): RecentSample | null {
	if (!sample || typeof sample === 'string') return null;
	const sampledAt = readLabel(sample.sampleDateTime);
	let eColi = readNumber(sample.escherichiaColiCount);
	let intestinalEnterococci = readNumber(sample.intestinalEnterococciCount);
	if (eColi === undefined && intestinalEnterococci === undefined) {
		const bacteria = sample.bacteriaCount ?? [];
		for (const entry of bacteria) {
			const label = readLabel(entry.parameter)?.toLowerCase() ?? '';
			const count = readNumber(entry.countValue);
			if (count === undefined) continue;
			if (label.includes('coli')) eColi = count;
			else if (label.includes('entero')) intestinalEnterococci = count;
		}
	}
	if (!sampledAt && eColi === undefined && intestinalEnterococci === undefined) return null;
	return {
		sampledAt: sampledAt ?? '',
		eColi,
		intestinalEnterococci
	};
}

async function dereferenceSample(
	uri: string,
	signal: AbortSignal | undefined
): Promise<RecentSample | null> {
	const url = uri.startsWith('http://')
		? `https://${uri.slice('http://'.length)}.json`
		: `${uri}.json`;
	try {
		const payload = await fetchJson<unknown>(url, { signal, timeoutMs: 4_000 });
		const inner = pickItem(payload);
		if (!inner) return null;
		return extractSample(inner.latestSampleAssessment ?? (inner as ItemShape['latestSampleAssessment']));
	} catch {
		return null;
	}
}

function extractRisk(item: ItemShape): RiskForecast | null {
	const risk = item.latestRiskPrediction;
	if (!risk) return null;
	const level = readLabel(risk.riskLevel)?.toLowerCase() ?? '';
	const expiresAt = readLabel(risk.expiresAt);
	let riskLevel: RiskForecast['riskLevel'] = 'unknown';
	if (level.includes('normal')) riskLevel = 'normal';
	else if (level.includes('increased') || level.includes('elevated') || level.includes('high'))
		riskLevel = 'increased';
	return {
		riskLevel,
		expiresAt: expiresAt ?? undefined
	};
}

/**
 * For Scotland and Northern Ireland we don't yet have a per-site live API,
 * so fall back to the classification captured in the index at build time.
 */
function fallbackResult(location: Location): ProfileFetchResult {
	return {
		classification: location.classification === 'Unknown' ? null : location.classification,
		latestSample: null,
		riskForecast: null,
		source:
			location.source.api === 'sepa'
				? 'https://apps.sepa.org.uk/bathingwaters/'
				: 'https://www.daera-ni.gov.uk/articles/bathing-water-quality-dashboard'
	};
}

export async function fetchProfile(
	location: Location,
	signal?: AbortSignal
): Promise<ProfileFetchResult> {
	const url = profileEndpoint(location);
	if (!url) return fallbackResult(location);
	const payload = await fetchJson<unknown>(url, { signal });
	const item = pickItem(payload);
	if (!item) return fallbackResult(location);
	const classification =
		classify(readLabel(item.latestComplianceAssessment?.complianceClassification)) ?? null;

	let latestSample: RecentSample | null = null;
	const sampleField = item.latestSampleAssessment;
	if (typeof sampleField === 'string') {
		latestSample = await dereferenceSample(sampleField, signal);
	} else {
		latestSample = extractSample(sampleField);
	}

	return {
		classification,
		latestSample,
		riskForecast: extractRisk(item),
		source: url
	};
}
