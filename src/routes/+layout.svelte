<script lang="ts">
	import '$lib/styles/app.css';
	import Masthead from '$lib/components/Masthead.svelte';
	import NavProgress from '$lib/components/NavProgress.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { onNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { redactAnalyticsUrl } from '$lib/util/redact';

	let { children } = $props();

	// Vercel Web Analytics: a ~1KB first-party script (/_vercel/insights), no
	// cookies. mode 'auto' sends only from the Vercel production deployment and
	// stays silent in dev. Speed Insights is deliberately not included.
	//
	// A visitor can put their own location into the URL two ways: the postcode
	// they search, and the coordinates the near-me button writes into the query
	// string. beforeSend keeps the route and drops both, so the counts show how
	// often each search is used without recording who used it from where.
	injectAnalytics({
		beforeSend: (event) => ({ ...event, url: redactAnalyticsUrl(event.url) })
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
