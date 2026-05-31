<script lang="ts">
	import NearbyResults from '$lib/components/NearbyResults.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let canonical = $derived(`https://isitsafetoswim.com/near/${data.code.replace(/\s+/g, '').toLowerCase()}`);
	let title = $derived(`Is it safe to swim near ${data.heading}? | Is it safe to swim?`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta
		name="description"
		content={`The nearest designated UK bathing waters to ${data.heading}, with a live Yes, Caution or No verdict for each.`}
	/>
	<link rel="canonical" href={canonical} />
</svelte:head>

<NearbyResults heading={data.heading} results={data.results} emptyMessage={data.emptyMessage} />
