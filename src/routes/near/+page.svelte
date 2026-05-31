<script lang="ts">
	import NearbyResults from '$lib/components/NearbyResults.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Bathing waters near you | Is it safe to swim?</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<NearbyResults heading={data.heading} results={data.results} emptyMessage={data.emptyMessage} />
