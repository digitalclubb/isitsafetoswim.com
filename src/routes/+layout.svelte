<script lang="ts">
	import '#lib/styles/app.css';
	import Masthead from '#lib/components/Masthead.svelte';
	import NavProgress from '#lib/components/NavProgress.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { beforeNavigate, onNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { browser } from '$app/env';

	let { children } = $props();

	// Cloudflare Web Analytics: no cookies and no identifier. A visitor can put
	// their own location into the URL two ways, the postcode they search and the
	// coordinates the near-me button writes, and both live under /near. The
	// beacon has no hook to redact a URL and reads the current path when the tab
	// is hidden, so a page running it must never show a /near URL: it is not
	// loaded on a /near landing, and every way into /near is a full page load.
	// near/+layout.svelte keeps the path out of the referrer on the way back out.
	if (browser && !location.pathname.startsWith('/near')) {
		const beacon = document.createElement('script');
		beacon.defer = true;
		beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
		beacon.dataset.cfBeacon = '{"token": "e2c101fc383748c9804e92ccc88af1e4"}';
		document.head.append(beacon);
	}

	beforeNavigate((navigation) => {
		const to = navigation.to?.url;
		if (
			navigation.type !== 'leave' &&
			to?.pathname.startsWith('/near') &&
			!location.pathname.startsWith('/near')
		) {
			navigation.cancel();
			location.assign(to.href);
		}
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
