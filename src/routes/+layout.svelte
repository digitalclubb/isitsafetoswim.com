<script lang="ts">
	import '$lib/styles/app.css';
	import Masthead from '$lib/components/Masthead.svelte';
	import NavProgress from '$lib/components/NavProgress.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { onNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();

	// Vercel Web Analytics: a ~1KB first-party script (/_vercel/insights), no
	// cookies. mode 'auto' sends only from the Vercel production deployment and
	// stays silent in dev. Speed Insights is deliberately not included.
	injectAnalytics();

	let current: '' | 'home' | 'map' | 'about' = $derived(
		page.url.pathname === '/'
			? 'home'
			: page.url.pathname.startsWith('/map')
				? 'map'
				: page.url.pathname.startsWith('/about')
					? 'about'
					: ''
	);

	let busy = $derived(Boolean(navigating.to));

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

<SiteFooter />

<style>
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
