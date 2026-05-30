<script lang="ts">
	import '$lib/styles/app.css';
	import Masthead from '$lib/components/Masthead.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	let current = $derived(
		page.url.pathname === '/'
			? 'home'
			: page.url.pathname.startsWith('/about')
				? 'about'
				: ''
	) as '' | 'home' | 'about';
</script>

<Masthead {current} />

<main id="main">
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
