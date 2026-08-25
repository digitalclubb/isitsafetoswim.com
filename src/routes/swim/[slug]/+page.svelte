<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import DischargeList from '$lib/components/DischargeList.svelte';
	import FactorList from '$lib/components/FactorList.svelte';
	import LocationCard from '$lib/components/LocationCard.svelte';
	import SampleHistory from '$lib/components/SampleHistory.svelte';
	import SampleSummary from '$lib/components/SampleSummary.svelte';
	import SpillHistory from '$lib/components/SpillHistory.svelte';
	import SupportNote from '$lib/components/SupportNote.svelte';
	import Verdict from '$lib/components/Verdict.svelte';
	import WaterTemperature from '$lib/components/WaterTemperature.svelte';
	import { findNearestSlim } from '$lib/data/search-index';
	import type { RecentSample } from '$lib/data/types';
	import { comparableSpillYears, getSpillHistoryMeta } from '$lib/data/spill-history';
	import { buildFaq } from '$lib/seo/faq';
	import { safeJsonLd } from '$lib/seo/jsonLd';
	import { londonClock, londonDayAndMonth, londonIsoDateTime, newestTimestamp } from '$lib/util/time';
	import { bathingSeasonActive } from '$lib/verdict/engine';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let location = $derived(data.location);

	// The verdict is built on the server and cached by ISR, so the page ships
	// with today's real answer already in place. No client-side swap.
	let live = $derived(data.live);

	// The sample-history sparkline and sea temperature are decoration that does
	// not affect the verdict, so the server render skips the slow fetches for
	// them and we pull them in after paint. The effect re-runs on the location
	// id so SPA navigation reissues the fetch and abandons the previous one.
	let enrichment = $state<{ sampleHistory: RecentSample[]; seaTemperatureC: number | null } | null>(
		null
	);
	let sampleHistory = $derived(enrichment?.sampleHistory ?? []);
	let seaTemperatureC = $derived(enrichment?.seaTemperatureC ?? null);

	$effect(() => {
		const id = data.location.id;
		enrichment = null;
		const controller = new AbortController();

		fetch(`/api/enrichment/${id}`, { signal: controller.signal })
			.then((r) => (r.ok ? r.json() : null))
			.then((fresh) => {
				if (fresh) enrichment = fresh;
			})
			.catch(() => {
				// Decoration only, so a failure just leaves these sections hidden.
			});

		return () => controller.abort();
	});

	let factorSignature = $derived(
		live.verdict.factors.map((f) => `${f.label}=${f.value}`).join('|')
	);

	// England and Wales expose live daily forecasts, samples and storm-overflow
	// feeds. Scotland (SEPA) and Northern Ireland (DAERA) do not, so their
	// verdicts rest on the annual classification and we say so rather than
	// implying we checked feeds that do not exist for those sites.
	let liveSignals = $derived(location.country === 'England' || location.country === 'Wales');
	let regulator = $derived(location.country === 'Scotland' ? 'SEPA' : 'DAERA');

	// Derived from the same clock the verdict was decided on, so the page never
	// explains a season the verdict did not apply.
	let inSeason = $derived(bathingSeasonActive(new Date(live.verdict.fetchedAt)));
	let nearby = $derived(
		findNearestSlim({ lat: location.lat, lon: location.lon }, 5)
			.map((r) => r.location)
			.filter((l) => l.id !== location.id)
			.slice(0, 4)
	);

	// Search asks this three ways: "X water quality" (about half of all
	// impressions), "is X safe to swim" (a fifth) and "can you swim at X". The
	// title carries the first two phrasings, the FAQ below carries the third.
	let metaTitle = $derived(
		`${location.name} water quality. Safe to swim? ${
			live.verdict.verdict === 'yes' ? 'Yes' : live.verdict.verdict === 'caution' ? 'Caution' : 'No'
		}.`
	);

	let verdictSentence = $derived(`${live.verdict.headline} ${live.verdict.reason}`);

	// The demand behind this page is explicitly time-bound ("...water quality
	// today"), so the snippet leads with when the check ran. The tail is kept
	// short enough that the location name still lands inside the roughly 155
	// characters Google renders, rather than being the first thing cut.
	let checkedLabel = $derived(
		londonClock(live.verdict.fetchedAt) &&
			`${londonClock(live.verdict.fetchedAt)} on ${londonDayAndMonth(live.verdict.fetchedAt)}`
	);
	let metaDescription = $derived(
		checkedLabel
			? `Checked ${checkedLabel}. ${verdictSentence} Live sewage alerts and bacteria readings for ${location.name}.`
			: verdictSentence
	);

	// Built server-side from the same payload as the verdict, and suppressed
	// when the live fetch failed: "try again in a few minutes" is incoherent
	// inside cached structured data a crawler reads.
	let faq = $derived(live.verdict.dataAge === 'unavailable' ? [] : buildFaq(live));

	let faqLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer }
		}))
	});

	// Where the EA attributes overflows to this bathing water the section is its
	// spill record, and the heading dates the series actually shown. Where it
	// does not, all we have is what sits within ten kilometres, which is not
	// this beach's record and must not be headed as though it were.
	let spillYears = $derived(
		(() => {
			const shown = comparableSpillYears(data.spillHistory?.attributed ?? []);
			if (shown.length === 0) return '';
			const years = shown.map((entry) => entry.year);
			const first = Math.min(...years);
			const last = Math.max(...years);
			return first === last ? `${first}` : `${first} to ${last}`;
		})()
	);
	// Named in the sources list, because five-year totals on a page whose
	// premise is "today" need to say plainly that they are an annual return.
	const spillMeta = getSpillHistoryMeta();
	let spillHeading = $derived(
		spillYears ? `Sewage spills, ${spillYears}` : 'Storm overflows nearby'
	);

	let placeId = $derived(`https://isitsafetoswim.com/swim/${location.slug}#place`);

	let contentModifiedAt = $derived(
		newestTimestamp(
			[
				live.latestSample?.sampledAt,
				...live.recentDischarges.flatMap((d) => [d.startedAt, d.endedAt])
			],
			live.verdict.fetchedAt
		)
	);

	// dateModified belongs on a CreativeWork, not a Place, so the freshness
	// signal rides on a WebPage that references the Place by id rather than
	// restating it as a second, emptier node.
	let pageLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		'@id': `https://isitsafetoswim.com/swim/${location.slug}`,
		url: `https://isitsafetoswim.com/swim/${location.slug}`,
		name: metaTitle,
		description: verdictSentence,
		dateModified: londonIsoDateTime(contentModifiedAt),
		inLanguage: 'en-GB',
		about: { '@id': placeId },
		isPartOf: {
			'@type': 'WebSite',
			'@id': 'https://isitsafetoswim.com/#website',
			name: 'Is it safe to swim?',
			url: 'https://isitsafetoswim.com/'
		}
	});

	let jsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'Place',
		'@id': placeId,
		name: location.name,
		address: {
			'@type': 'PostalAddress',
			addressLocality: location.region,
			addressCountry: countryToCode(location.country)
		},
		geo: {
			'@type': 'GeoCoordinates',
			latitude: location.lat,
			longitude: location.lon
		},
		additionalProperty: [
			{
				'@type': 'PropertyValue',
				name: 'Annual classification',
				value: live.classification
			},
			{
				'@type': 'PropertyValue',
				name: 'Current verdict',
				value: verdictSentence
			}
		]
	});

	let breadcrumbLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: 'All bathing waters',
				item: 'https://isitsafetoswim.com/'
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: location.name,
				item: `https://isitsafetoswim.com/swim/${location.slug}`
			}
		]
	});

	function countryToCode(c: string): string {
		switch (c) {
			case 'England':
				return 'GB-ENG';
			case 'Wales':
				return 'GB-WLS';
			case 'Scotland':
				return 'GB-SCT';
			case 'Northern Ireland':
				return 'GB-NIR';
			default:
				return 'GB';
		}
	}
</script>

<svelte:head>
	<title>{metaTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={`https://isitsafetoswim.com/og/swim/${location.slug}.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={`https://isitsafetoswim.com/swim/${location.slug}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href={`https://isitsafetoswim.com/swim/${location.slug}`} />
	{@html `<script type="application/ld+json">${safeJsonLd(faq.length > 0 ? [pageLd, jsonLd, breadcrumbLd, faqLd] : [pageLd, jsonLd, breadcrumbLd])}</script>`}
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/">← All bathing waters</a></p>

		<Verdict
			verdict={live.verdict}
			locationName={location.name}
			country={location.country}
			region={location.region}
		/>

		<section class="block" aria-labelledby="why">
			<h2 id="why">Why this verdict</h2>
			{#key factorSignature}
				<div in:fade={{ duration: 240, easing: cubicOut }}>
					<FactorList factors={live.verdict.factors} />
				</div>
			{/key}
		</section>

		{#if !inSeason}
			<section class="block" aria-labelledby="out-of-season">
				<h2 id="out-of-season" class="muted-h">Out of season</h2>
				<p class="muted">
					Weekly sampling and the daily pollution-risk forecast pause on 30 September and
					resume on 15 May.
					{#if liveSignals}
						This verdict rests on the annual classification, live storm-overflow data and
						rainfall in the last 24 hours.
					{:else}
						This verdict rests on the annual classification, which is the only measure
						{regulator} publishes for this site year-round.
					{/if}
				</p>
				{#if liveSignals}
					<p class="muted">
						Storm overflows are driven by rain, so they spill more in autumn and winter than
						in summer. <a href="/spills">See every spill happening now across the UK</a>.
					</p>
				{/if}
			</section>
		{/if}

		{#if seaTemperatureC != null}
			<section
				class="block"
				aria-labelledby="temperature"
				in:slide={{ duration: 280, easing: cubicOut }}
			>
				<h2 id="temperature" class="muted-h">Water temperature</h2>
				<WaterTemperature celsius={seaTemperatureC} />
			</section>
		{/if}

		{#if !liveSignals && live.recentDischarges.length === 0 && !live.latestSample}
			<section
				class="block"
				aria-labelledby="coverage"
				in:slide={{ duration: 280, delay: 200, easing: cubicOut }}
			>
				<h2 id="coverage" class="muted-h">Coverage for this site</h2>
				<p class="muted">
					{regulator} does not publish a daily pollution-risk forecast or live storm-overflow
					data for bathing waters in {location.country}, so this verdict reflects the most
					recent annual classification rather than today's conditions. We show live forecasts,
					sample readings and sewage-overflow alerts for England and Wales only.
				</p>
			</section>
		{:else if live.recentDischarges.length === 0 && !live.latestSample}
			<section
				class="block"
				aria-labelledby="all-clear"
				in:slide={{ duration: 280, delay: 200, easing: cubicOut }}
			>
				<h2 id="all-clear" class="muted-h">No recent activity</h2>
				<p class="muted">
					No storm-overflow discharges in the last 48 hours within ten kilometres of this
					bathing water and no fresh sample yet.
				</p>
			</section>
		{:else}
			{#if live.recentDischarges.length > 0}
				<section
					class="block"
					aria-labelledby="discharges"
					in:slide={{ duration: 280, delay: 200, easing: cubicOut }}
				>
					<h2 id="discharges">Recent sewage discharges nearby</h2>
					<p class="muted">
						Storm overflows operated by {location.sewerageUndertaker ?? 'the local water company'}
						within ten kilometres in the last 48 hours.
					</p>
					<DischargeList discharges={live.recentDischarges} />
					<p class="more">
						<a href="/spills">See every spill happening now across the UK →</a>
					</p>
				</section>
			{/if}

			{#if live.latestSample}
				<section
					class="block"
					aria-labelledby="sample"
					in:slide={{ duration: 280, delay: 200, easing: cubicOut }}
				>
					<h2 id="sample">Latest bacteria reading</h2>
					<SampleSummary sample={live.latestSample} />
					{#if sampleHistory.length > 0}
						<SampleHistory samples={sampleHistory} waterType={location.waterType} />
					{/if}
					<p class="muted small">
						{#if inSeason}
							The regulator samples weekly during the bathing season.
						{:else}
							This is the most recent reading. Sampling resumes on 15 May.
						{/if}
						E. coli and intestinal enterococci are the indicator organisms used in the
						official classification.
					</p>
				</section>
			{/if}
		{/if}

		{#if data.spillHistory}
			<section class="block" aria-labelledby="spill-history">
				<h2 id="spill-history">{spillHeading}</h2>
				<SpillHistory record={data.spillHistory} locationName={location.name} />
			</section>
		{/if}

		{#if faq.length > 0}
			<section class="block" aria-labelledby="faq">
				<h2 id="faq">Common questions</h2>
				<dl class="faq">
					{#each faq as item (item.question)}
						<dt>{item.question}</dt>
						<dd>{item.answer}</dd>
					{/each}
				</dl>
			</section>
		{/if}

		<section class="block" aria-labelledby="source">
			<h2 id="source">Where this data comes from</h2>
			<ul class="muted source">
				{#each live.attribution as line (line)}
					<li>{line}</li>
				{/each}
				{#if data.spillHistory}
					<li>
						Spill counts from the {spillMeta.source}, {spillMeta.years[0]} to
						{spillMeta.years[spillMeta.years.length - 1]}, published annually.
					</li>
				{/if}
				<li>
					<a href={location.source.profileUrl} rel="external">View the regulator's full profile</a>
				</li>
			</ul>
		</section>

		{#if nearby.length > 0}
			<section class="block" aria-labelledby="nearby">
				<h2 id="nearby">Other beaches nearby</h2>
				<div class="card-grid">
					{#each nearby as n (n.id)}
						<LocationCard location={n} />
					{/each}
				</div>
			</section>
		{/if}

		<p class="more">
			<a href={`/beaches/${data.hub.slug}`}>Cleanest beaches in {data.hub.name} →</a>
		</p>

		<SupportNote />
	</div>
</article>

<style>
	.page {
		padding-block: var(--space-6) var(--space-7);
	}

	.back {
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
	}

	.back a {
		text-decoration: none;
	}

	.more {
		margin: var(--space-6) 0 0;
		font-size: var(--text-sm);
	}

	.more a {
		text-decoration: none;
	}

	.block {
		padding-block: var(--space-6);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.block:last-of-type {
		border-bottom: none;
	}

	.block h2 {
		font-size: var(--text-xl);
		margin-bottom: var(--space-4);
	}

	.muted-h {
		color: var(--ink-soft);
		font-size: var(--text-lg) !important;
		font-weight: 500;
	}

	.small {
		font-size: var(--text-sm);
		margin-top: var(--space-3);
	}

	.source {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-4);
	}

	.faq {
		margin: 0;
	}

	.faq dt {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		margin-bottom: var(--space-2);
	}

	.faq dd {
		margin: 0 0 var(--space-4);
		color: var(--ink-soft);
		max-width: 60ch;
	}

	.faq dd:last-child {
		margin-bottom: 0;
	}
</style>
