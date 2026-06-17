<script lang="ts">
	import { onMount } from 'svelte';
	import BeachMap from '$lib/components/BeachMap.svelte';
	import type { Verdict } from '$lib/data/types';
	import { UNKNOWN_HEX, VERDICT_LEGEND, verdictHex } from '$lib/map/colours';
	import { nearestSafe } from '$lib/map/nearest';
	import type { MapColours } from '$lib/map/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let colours = $state<Record<string, Verdict>>({});
	let generatedAt = $state('');

	type Status = 'idle' | 'locating' | 'denied' | 'error';
	let status = $state<Status>('idle');
	let userLocation = $state<{ lat: number; lon: number } | null>(null);
	let errorMsg = $state('');

	let busy = $derived(status === 'locating');
	let results = $derived(
		userLocation ? nearestSafe(userLocation, data.points, colours, 8) : []
	);

	onMount(async () => {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 8000);
			try {
				const res = await fetch('/api/map', { signal: controller.signal });
				const blob: MapColours = res.ok ? await res.json() : { generatedAt: '', colours: {} };
				colours = blob.colours;
				generatedAt = blob.generatedAt;
			} finally {
				clearTimeout(timer);
			}
		} catch {
			// The map still renders; pins stay neutral until colours arrive.
		}
	});

	function formatKm(metres: number): string {
		const km = metres / 1000;
		return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
	}

	function formatTime(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}

	function locate() {
		if (!('geolocation' in navigator)) {
			status = 'error';
			errorMsg = 'Your browser does not support location.';
			return;
		}
		status = 'locating';
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				userLocation = {
					lat: Math.round(pos.coords.latitude * 1000) / 1000,
					lon: Math.round(pos.coords.longitude * 1000) / 1000
				};
				status = 'idle';
			},
			(err) => {
				if (err.code === err.PERMISSION_DENIED) {
					status = 'denied';
				} else {
					status = 'error';
					errorMsg = 'We could not get your location. Try again.';
				}
			},
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
		);
	}
</script>

<svelte:head>
	<title>Map of safe beaches near you | Is it safe to swim?</title>
	<meta
		name="description"
		content="A live map of every UK designated bathing water, coloured by today's verdict, with the safe beaches nearest to you."
	/>
	<meta property="og:title" content="Map of safe beaches near you" />
	<meta
		property="og:description"
		content="Every UK bathing water on a map, coloured by today's verdict."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://isitsafetoswim.com/og.png" />
	<meta property="og:url" content="https://isitsafetoswim.com/map" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://isitsafetoswim.com/map" />
</svelte:head>

<article class="page">
	<div class="container">
		<header class="head">
			<h1>Map of safe beaches near you</h1>
			<p class="lede">
				Every designated bathing water in the UK, coloured by today's verdict. Use your location
				to centre the map and list the nearest beaches rated Yes.
			</p>
		</header>

		<BeachMap points={data.points} {colours} {userLocation} />

		<ul class="legend" aria-label="What the colours mean">
			{#each VERDICT_LEGEND as item (item.verdict)}
				<li>
					<span class="dot" style={`background:${item.hex}`} aria-hidden="true"></span>
					<span><strong>{item.label}</strong> {item.meaning}</span>
				</li>
			{/each}
			<li>
				<span class="dot" style={`background:${UNKNOWN_HEX}`} aria-hidden="true"></span>
				<span><strong>Grey</strong> No verdict for today yet</span>
			</li>
		</ul>

		<p class="more"><a href="/spills">See sewage spills happening now →</a></p>

		<div class="locate">
			<button type="button" onclick={locate} disabled={busy}>
				{busy ? 'Finding your location' : 'Use my location'}
			</button>
		</div>

		<div aria-live="polite">
			{#if userLocation}
				{#if results.length > 0}
					<p class="freshness">
						Nearest beaches rated safe {generatedAt
							? `as of ${formatTime(generatedAt)} today`
							: 'today'}. Tap through for the live verdict.
					</p>
					<ul class="results">
						{#each results as r (r.point.slug)}
							<li>
								<a href={`/swim/${r.point.slug}`}>
									<span class="dot" style={`background:${verdictHex('yes')}`} aria-hidden="true"
									></span>
									<span class="name">{r.point.name}</span>
									<span class="meta">{r.point.region ?? r.point.country} · {formatKm(
											r.distanceMetres
										)}</span>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">
						We could not find a bathing water rated Yes near you right now. The live status may
						still be updating, or the nearest safe water may be some distance away.
						<a href="/beaches">Browse all areas</a> or search by name from the
						<a href="/">home page</a>.
					</p>
				{/if}
			{:else if status === 'denied'}
				<p class="muted">
					Location permission was declined. You can still pan the map, <a href="/beaches"
						>browse by area</a
					> or search by name from the <a href="/">home page</a>.
				</p>
			{:else if status === 'error'}
				<p class="muted">{errorMsg} You can still pan the map above.</p>
			{/if}
		</div>
	</div>
</article>

<style>
	.page {
		padding-block: var(--space-6) var(--space-7);
	}

	.head {
		padding-bottom: var(--space-5);
		margin-bottom: var(--space-5);
		border-bottom: var(--rule-weight-strong) solid var(--rule-strong);
	}

	h1 {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-2xl), 5vw, var(--text-3xl));
		line-height: 1.05;
		margin: 0 0 var(--space-4);
	}

	.lede {
		font-size: var(--text-lg);
		color: var(--ink-soft);
		max-width: 56ch;
		margin: 0;
	}

	.legend {
		list-style: none;
		padding: 0;
		margin: var(--space-4) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		font-size: var(--text-sm);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.more {
		margin: var(--space-4) 0 0;
		font-size: var(--text-sm);
	}

	.more a {
		text-decoration: none;
	}

	.locate {
		padding-block: var(--space-5);
	}

	.locate button {
		font-family: var(--font-sans);
		font-size: var(--text-base);
		font-weight: 600;
		padding: var(--space-3) var(--space-5);
		color: var(--background);
		background: var(--ink);
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.locate button:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.freshness {
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin: 0 0 var(--space-4);
	}

	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}

	.results a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--ink);
	}

	@media (hover: hover) {
		.results a:hover {
			border-color: var(--rule-strong);
		}
	}

	.results .name {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}

	.results .meta {
		font-size: var(--text-sm);
		color: var(--ink-soft);
		text-align: right;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
		align-self: center;
	}

	.muted {
		color: var(--ink-soft);
		max-width: 56ch;
	}
</style>
