<script lang="ts">
	import DischargeList from '$lib/components/DischargeList.svelte';
	import FactorList from '$lib/components/FactorList.svelte';
	import LocationCard from '$lib/components/LocationCard.svelte';
	import SampleSummary from '$lib/components/SampleSummary.svelte';
	import Verdict from '$lib/components/Verdict.svelte';
	import { findNearest } from '$lib/data/locations';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let location = $derived(data.location);
	let live = $derived(data.live);
	let nearby = $derived(
		findNearest({ lat: location.lat, lon: location.lon }, 5)
			.map((r) => r.location)
			.filter((l) => l.id !== location.id)
			.slice(0, 4)
	);

	let metaTitle = $derived(
		`Is it safe to swim at ${location.name}? ${
			live.verdict.verdict === 'yes' ? 'Yes' : live.verdict.verdict === 'caution' ? 'Caution' : 'No'
		}.`
	);

	let metaDescription = $derived(`${live.verdict.headline} ${live.verdict.reason}`);

	let jsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'Place',
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
				value: live.verdict.headline + ' ' + live.verdict.reason
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
	<meta property="og:url" content={`https://isitsafetoswim.com/swim/${location.slug}`} />
	<link rel="canonical" href={`https://isitsafetoswim.com/swim/${location.slug}`} />
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
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
			<FactorList factors={live.verdict.factors} />
		</section>

		{#if live.recentDischarges.length > 0}
			<section class="block" aria-labelledby="discharges">
				<h2 id="discharges">Recent sewage discharges nearby</h2>
				<p class="muted">
					Storm overflows operated by {location.sewerageUndertaker ?? 'the local water company'}
					within ten kilometres in the last 48 hours.
				</p>
				<DischargeList discharges={live.recentDischarges} />
			</section>
		{/if}

		{#if live.latestSample}
			<section class="block" aria-labelledby="sample">
				<h2 id="sample">Latest bacteria reading</h2>
				<SampleSummary sample={live.latestSample} />
				<p class="muted small">
					The regulator samples weekly during the bathing season. E. coli and intestinal
					enterococci are the indicator organisms used in the official classification.
				</p>
			</section>
		{/if}

		<section class="block" aria-labelledby="source">
			<h2 id="source">Where this data comes from</h2>
			<ul class="muted source">
				{#each live.attribution as line (line)}
					<li>{line}</li>
				{/each}
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
</style>
