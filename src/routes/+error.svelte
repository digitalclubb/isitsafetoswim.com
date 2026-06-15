<script lang="ts">
	import { page } from '$app/state';

	let notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · Is it safe to swim?</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="error">
	<div class="container">
		<p class="status" aria-hidden="true">{page.status}</p>
		{#if notFound}
			<h1>We could not find that page</h1>
			<p class="lede">
				The bathing water you are after may have moved or it never existed. Search from the
				home page to find any designated bathing water in the UK.
			</p>
		{:else}
			<h1>Something went wrong</h1>
			<p class="lede">
				We hit a problem loading this page. It is usually temporary, so try again in a moment.
			</p>
		{/if}
		<p class="actions"><a href="/">← All bathing waters</a></p>
	</div>
</article>

<style>
	.error {
		padding-block: var(--space-7);
	}

	.status {
		font-family: var(--font-serif);
		font-size: var(--text-4xl);
		line-height: 1;
		color: var(--rule-strong);
		margin: 0 0 var(--space-3);
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
		max-width: 52ch;
		margin: 0 0 var(--space-5);
	}

	.actions {
		font-size: var(--text-sm);
		margin: 0;
	}

	.actions a {
		text-decoration: none;
	}
</style>
