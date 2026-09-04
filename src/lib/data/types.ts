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

/**
 * A regulator's own current judgement on the water, where it publishes one in
 * place of an annual classification rather than as well as it.
 *
 * DAERA is the case this exists for. Northern Ireland's feed carries a weekly
 * `water_quality_indicator` derived from that week's sample, and no annual
 * classification at all. It was previously read straight into `classification`,
 * which made 29 pages claim a four-year percentile the regulator has never
 * published, and dropped the one site DAERA marks as advised against bathing
 * into "unclassified".
 */
export interface CurrentAssessment {
	/** `advised-against` is a warning, not a rating, and always decides. */
	level: 'good' | 'satisfactory' | 'advised-against';
	/** The regulator's own word for it, so the page never renames the finding. */
	label: string;
	/** When the sample behind it was taken, so staleness can be judged. */
	assessedAt?: string;
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
	/**
	 * Every classification this site has been awarded under the revised regime,
	 * oldest first. Real assessments only, so it starts at 2015 and skips 2020,
	 * the season the pandemic cut short and no classification was made for.
	 */
	classificationHistory?: Array<{ year: number; classification: Classification }>;
	/** Where the regulator publishes a current judgement instead of a classification. */
	currentAssessment?: CurrentAssessment;
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
