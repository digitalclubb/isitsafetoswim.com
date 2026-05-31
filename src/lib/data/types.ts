export type Country = 'England' | 'Wales' | 'Scotland' | 'Northern Ireland';

export type Classification =
	| 'Excellent'
	| 'Good'
	| 'Sufficient'
	| 'Poor'
	| 'New'
	| 'Closed'
	| 'Unknown';

export type SourceApi = 'ea' | 'nrw' | 'sepa' | 'daera';

export interface LocationSource {
	api: SourceApi;
	sourceId: string;
	profileUrl?: string;
}

export interface Location {
	id: string;
	slug: string;
	name: string;
	country: Country;
	region?: string;
	lat: number;
	lon: number;
	classification: Classification;
	sewerageUndertaker?: string;
	waterType?: 'coastal' | 'inland';
	/** EA flag: is this site's water quality degraded by heavy rain? */
	rainImpacted?: boolean;
	source: LocationSource;
}

export interface LocationIndex {
	generatedAt: string;
	count: number;
	byCountry: Record<Country, number>;
	partialFor?: string[];
	locations: Location[];
}

export interface RecentSample {
	sampledAt: string;
	eColi?: number;
	intestinalEnterococci?: number;
}

export interface RiskForecast {
	riskLevel: 'normal' | 'increased' | 'unknown';
	expiresAt?: string;
}

export interface DischargeEvent {
	outfallName: string;
	receivingWater?: string;
	distanceMetres: number;
	startedAt: string;
	endedAt?: string;
	ongoing: boolean;
}

export type Verdict = 'yes' | 'caution' | 'no';

export interface VerdictResult {
	verdict: Verdict;
	headline: string;
	reason: string;
	factors: VerdictFactor[];
	fetchedAt: string;
	dataAge: 'fresh' | 'cached' | 'unavailable';
}

export interface VerdictFactor {
	label: string;
	value: string;
	weight: 'positive' | 'neutral' | 'negative';
}

export interface LiveLocationData {
	location: Location;
	classification: Classification;
	latestSample: RecentSample | null;
	riskForecast: RiskForecast | null;
	recentDischarges: DischargeEvent[];
	rainfall24hMm: number | null;
	sampleHistory: RecentSample[];
	seaTemperatureC: number | null;
	verdict: VerdictResult;
	attribution: string[];
}
