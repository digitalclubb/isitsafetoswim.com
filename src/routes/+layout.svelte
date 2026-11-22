<script lang="ts">
	import '#lib/styles/app.css';
	import Masthead from '#lib/components/Masthead.svelte';
	import NavProgress from '#lib/components/NavProgress.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { onNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { browser } from '$app/env';
	import { inject, pageview } from '@vercel/analytics';
	import { redactAnalyticsUrl } from '#lib/util/redact.ts';

	let { children } = $props();

	// Vercel Web Analytics: a ~1KB first-party script (/_vercel/insights), no
	// cookies. mode 'auto' sends only from the Vercel production deployment and
	// stays silent in dev. Speed Insights is deliberately not included.
	//
	// A visitor can put their own location into the URL two ways: the postcode
	// they search, and the coordinates the near-me button writes into the query
	// string. beforeSend keeps the route and drops both, so the counts show how
	// often each search is used without recording who used it from where.
	//
	// This is @vercel/analytics/sveltekit's injectAnalytics on $app/state: that
	// wrapper subscribes to $app/stores, which throws under SvelteKit 3. Swap
	// back once the package supports Kit 3.
	if (browser) {
		inject(
			{
				beforeSend: (event) => ({ ...event, url: redactAnalyticsUrl(event.url) }),
				basePath: import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH,
				disableAutoTrack: true,
				framework: 'sveltekit'
			},
			import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG
		);
	}

	$effect(() => {
		if (page.route.id) pageview({ route: page.route.id, path: page.url.pathname });
	});

	let current: '' | 'home' | 'map' | 'areas' | 'spills' | 'about' = $derived(
		page.url.pathname === '/'
			? 'home'
			: page.url.pathname.startsWith('/map')
				? 'map'
				: page.url.pathname.startsWith('/beaches')
					? 'areas'
					: page.url.pathname.startsWith('/spills')
						? 'spills'
						: page.url.pathname.startsWith('/about')
							? 'about'
							: ''
	);

	let busy = $derived(Boolean(navigating.to));

	// The location and about pages carry the signed note, so the footer holds its
	// tongue there rather than asking twice on one screen.
	let showFooterAsk = $derived(
		!(page.url.pathname.startsWith('/swim/') || page.url.pathname === '/about')
	);

	// Cross-fade between routes using the browser View Transitions API. Falls
	// through to a plain navigation when the browser lacks support. onNavigate
	// only fires in the browser so no SSR guard is needed.
	onNavigate((navigation) => {
		if (!('startViewTransition' in document)) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<NavProgress />
<Masthead {current} />

<main id="main" aria-busy={busy}>
	{@render children?.()}
</main>

<SiteFooter support={showFooterAsk} />

<style>
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
