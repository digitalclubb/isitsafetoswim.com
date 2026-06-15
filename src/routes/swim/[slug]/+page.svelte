<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import DischargeList from '$lib/components/DischargeList.svelte';
	import FactorList from '$lib/components/FactorList.svelte';
	import LocationCard from '$lib/components/LocationCard.svelte';
	import SampleHistory from '$lib/components/SampleHistory.svelte';
	import SampleSummary from '$lib/components/SampleSummary.svelte';
	import SectionSkeleton from '$lib/components/SectionSkeleton.svelte';
	import Verdict from '$lib/components/Verdict.svelte';
	import WaterTemperature from '$lib/components/WaterTemperature.svelte';
	import { findNearestSlim } from '$lib/data/search-index';
	import type { LiveLocationData } from '$lib/data/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let location = $derived(data.location);

	// On first paint we render the cached verdict from the index — instant.
	// As soon as the page is interactive we fetch the live verdict from
	// /api/verdict/[id] and swap it in. The page is fully usable before this
	// resolves, so navigation never blocks on the regulator APIs.
	let liveOverride = $state<LiveLocationData | null>(null);
	let live = $derived<LiveLocationData>(liveOverride ?? data.live);

	// The effect re-runs when the location id changes, so SPA navigation
	// between two /swim/[slug] pages correctly reissues the live fetch and
	// abandons the previous one through the AbortController cleanup.
	$effect(() => {
		const id = data.location.id;
		liveOverride = null;
		const controller = new AbortController();

		fetch(`/api/verdict/${id}`, { signal: controller.signal })
			.then((r) => (r.ok ? r.json() : null))
			.then((fresh: LiveLocationData | null) => {
				if (fresh && fresh.location?.id === id) liveOverride = fresh;
			})
			.catch(() => {
				// Stay on the cached verdict if the live fetch fails.
			});

		return () => controller.abort();
	});

	let factorSignature = $derived(
		live.verdict.factors.map((f) => `${f.label}=${f.value}`).join('|')
	);
	let nearby = $derived(
		findNearestSlim({ lat: location.lat, lon: location.lon }, 5)
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

	function safeJsonLd(value: unknown): string {
		return JSON.stringify(value)
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026');
	}

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
	<meta property="og:image" content="https://isitsafetoswim.com/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={`https://isitsafetoswim.com/swim/${location.slug}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href={`https://isitsafetoswim.com/swim/${location.slug}`} />
	{@html `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`}
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/">← All bathing waters</a></p>

		<Verdict
			verdict={live.verdict}
			locationName={location.name}
			country={location.country}
			region={location.region}
			hydrating={!liveOverride}
		/>

		<p class="caveat">
			This is a water-quality verdict only. It does not account for tides, rip currents, cold
			water or lifeguard cover. Always check local signs before you enter the water.
			<a href="/about#cannot-tell-you">What we cannot tell you</a>.
		</p>

		<section class="block" aria-labelledby="why">
			<h2 id="why">Why this verdict</h2>
			{#key factorSignature}
				<div in:fade={{ duration: 240, easing: cubicOut }}>
					<FactorList factors={live.verdict.factors} />
				</div>
			{/key}
		</section>

		{#if liveOverride && live.seaTemperatureC != null}
			<section
				class="block"
				aria-labelledby="temperature"
				in:slide={{ duration: 280, delay: 200, easing: cubicOut }}
			>
				<h2 id="temperature" class="muted-h">Water temperature</h2>
				<WaterTemperature celsius={live.seaTemperatureC} />
			</section>
		{/if}

		{#if !liveOverride}
			<section
				class="block"
				aria-labelledby="checking"
				out:slide={{ duration: 200, easing: cubicOut }}
			>
				<h2 id="checking" class="muted-h">Checking for recent activity</h2>
				<SectionSkeleton
					label="Checking for recent sewage discharges and the latest sample"
					lines={2}
				/>
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
					<SampleHistory samples={live.sampleHistory} waterType={location.waterType} />
					<p class="muted small">
						The regulator samples weekly during the bathing season. E. coli and intestinal
						enterococci are the indicator organisms used in the official classification.
					</p>
				</section>
			{/if}
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

	.caveat {
		margin: var(--space-4) 0 0;
		padding-left: var(--space-4);
		border-left: var(--rule-weight-strong) solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		line-height: 1.5;
		color: var(--ink-soft);
	}

	.caveat a {
		color: inherit;
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
</style>
