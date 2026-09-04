import { classificationChange } from '$lib/data/rating';
import type { LiveLocationData, RecentSample } from '$lib/data/types';
import { joinList } from '$lib/util/text';
import { londonFullDate } from '$lib/util/time';
import { SAMPLE_CURRENT_DAYS } from '$lib/verdict/engine';

/**
 * The three questions the location page answers in the words search uses.
 * Roughly half the demand behind these pages is phrased "X water quality", a
 * fifth "is X safe to swim" and a fourteenth "can you swim at X", so the page
 * answers all three rather than only the one its title asks.
 *
 * Pure, and separate from the component, because every answer here is a claim
 * about water quality that also ships as FAQPage JSON-LD. The branches that
 * must never overclaim are the ones worth testing.
 */
export interface FaqItem {
	question: string;
	answer: string;
}

/** Mirrors the engine: a reading we cannot date still counts as current. */
function isStale(sampledAt: string, now: Date): boolean {
	const t = Date.parse(sampledAt);
	if (!Number.isFinite(t)) return false;
	return now.getTime() - t > SAMPLE_CURRENT_DAYS * 24 * 36e5;
}

function sampleSentence(sample: RecentSample | null, now: Date): string {
	if (!sample) return '';
	// The unit rides on each figure. "10 E. coli and 13 intestinal enterococci
	// cfu/100ml" reads as though only the second one carries it.
	const readings = [
		sample.eColi !== undefined ? `${sample.eColi} cfu/100ml of E. coli` : null,
		sample.intestinalEnterococci !== undefined
			? `${sample.intestinalEnterococci} cfu/100ml of intestinal enterococci`
			: null
	].filter((reading): reading is string => reading !== null);
	if (readings.length === 0) return '';

	const when = londonFullDate(sample.sampledAt);
	const dated = when ? `, taken ${when},` : '';
	const caveat = isStale(sample.sampledAt, now)
		? ' That reading is too old to drive the verdict above.'
		: '';
	return ` The most recent sample${dated} showed ${joinList(readings)}.${caveat}`;
}

function classificationSentence(live: LiveLocationData): string {
	const name = live.location.name;
	switch (live.classification) {
		case 'New':
		case 'Unknown': {
			// Northern Ireland has no annual classification to hold: DAERA does not
			// publish one. Saying only "we hold no classification" reads as a gap on
			// our side and throws away the weekly reading DAERA does publish.
			const assessment = live.location.currentAssessment;
			if (!assessment) return `We hold no annual classification for ${name}.`;
			if (assessment.level === 'advised-against') {
				return `The regulator advises against bathing at ${name}.`;
			}
			const when = assessment.assessedAt ? londonFullDate(assessment.assessedAt) : '';
			const dated = when ? `, taken ${when},` : '';
			return `No annual classification is published for ${name}. The regulator's most recent water-quality reading${dated} was ${assessment.label}.`;
		}
		case 'Closed':
			// classify() in live/profile.ts folds "decommissioned" into Closed, so
			// this must not assert a present-tense closure to bathers.
			return `${name} is no longer listed as an open bathing water.`;
		default: {
			// Dating the classification matters most out of season, when it is the
			// only thing holding the page up: "rated Excellent" with no year is an
			// undated claim, and the ratings are republished every November.
			const year = live.location.classificationYear;
			const when = year ? `${year} annual classification` : 'latest annual classification';
			const change = classificationChange(live.classification, live.location.previousClassification);
			const moved = change
				? ` That is ${change.direction} from ${change.from} the season before.`
				: '';
			return `${name} is rated ${live.classification} in the regulator's ${when}, a percentile taken over readings from up to four bathing seasons.${moved}`;
		}
	}
}

function sewageAnswer(live: LiveLocationData): string {
	const name = live.location.name;
	if (!live.hasDischargeFeed) {
		return `We do not have a live storm-overflow feed for ${name}, so we cannot say whether one has discharged nearby.`;
	}

	const total = live.recentDischarges.length;
	if (total === 0) {
		return `No. No storm overflow within ten kilometres of ${name} has discharged in the last 48 hours.`;
	}

	// An overflow still running is kept regardless of when it started, so the
	// two are counted separately rather than all being called "in the last 48
	// hours", which would misdate a spill that began a week ago.
	const ongoing = live.recentDischarges.filter((d) => d.ongoing).length;
	const finished = total - ongoing;
	const parts = [
		ongoing > 0 ? `${ongoing} discharging now` : null,
		finished > 0 ? `${finished} in the last 48 hours` : null
	].filter((part): part is string => part !== null);

	return `Yes. ${total} storm ${total === 1 ? 'overflow' : 'overflows'} within ten kilometres of ${name}: ${joinList(parts)}.`;
}

/**
 * What being designated actually buys the reader, which is not the same in
 * every country. "Sampled and rated every season" is true in England, Wales and
 * Scotland; DAERA samples but publishes no annual classification, so saying it
 * of a Northern Irish site restates the claim this page was corrected to drop.
 */
function sampledAndRated(live: LiveLocationData): string {
	return live.location.country === 'Northern Ireland'
		? 'the regulator samples it through the bathing season'
		: 'it is sampled and rated every season';
}

export function buildFaq(live: LiveLocationData): FaqItem[] {
	const name = live.location.name;
	const now = new Date(live.verdict.fetchedAt);

	return [
		{
			question: `Can you swim at ${name}?`,
			answer: `${live.verdict.headline} ${live.verdict.reason} ${name} is a designated bathing water, so ${sampledAndRated(live)}. This answer covers water quality only, not tides, currents or lifeguard cover.`
		},
		{
			question: `What is the water quality like at ${name}?`,
			answer: classificationSentence(live) + sampleSentence(live.latestSample, now)
		},
		{
			question: `Has there been sewage at ${name} recently?`,
			answer: sewageAnswer(live)
		}
	];
}
