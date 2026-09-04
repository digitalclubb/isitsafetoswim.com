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
	/** The regulator's own name, when the displayed one differs from it. */
	officialName?: string;
	country: Country;
	region?: string;
	lat: number;
	lon: number;
	classification: Classification;
	/** The bathing season the classification was awarded for, e.g. 2025. */
	classificationYear?: number;
	/** The classification for the season before `classificationYear`. */
	previousClassification?: Classification;
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

/** One turning point in the tidal curve. */
export interface TideEvent {
	/** ISO timestamp of high or low water. */
	at: string;
	type: 'high' | 'low';
	/** Height in metres relative to mean sea level. */
	heightM: number;
}

export interface TideInfo {
	/** Turning points from now onwards, soonest first. */
	events: TideEvent[];
	/** Whether the water is rising or falling right now. */
	state: 'rising' | 'falling';
}

export interface DischargeEvent {
	outfallName: string;
	receivingWater?: string;
	distanceMetres: number;
	startedAt: string;
	endedAt?: string;
	ongoing: boolean;
	/** The outfall's own coordinates, used to identify it across beaches. */
	lat?: number;
	lon?: number;
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
	/**
	 * Whether a storm-overflow feed exists for this site at all. An empty
	 * `recentDischarges` is an all-clear only when this is true.
	 */
	hasDischargeFeed: boolean;
	rainfall24hMm: number | null;
	sampleHistory: RecentSample[];
	seaTemperatureC: number | null;
	tide: TideInfo | null;
	verdict: VerdictResult;
	attribution: string[];
}
