<script lang="ts">
	let { children } = $props();
</script>

<!-- The path carries the visitor's postcode, so a page opened from here gets
     only the origin as its referrer. See the analytics note in the root layout. -->
<svelte:head>
	<meta name="referrer" content="strict-origin" />
</svelte:head>

{@render children()}
