import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			runtime: 'nodejs22.x',
			// environment.data.gov.uk geo-blocks non-UK IPs (the default US region
			// 403s). London is AWS eu-west-2, whose egress is UK, so the live
			// regulator fetch works. Requires a Vercel Pro plan to pin the region.
			regions: ['lhr1']
		}),
		alias: {
			$lib: 'src/lib',
			$data: 'src/data'
		},
		prerender: {
			handleHttpError: 'warn',
			handleMissingId: 'warn',
			// '*' already covers every route without a required parameter, which
			// includes all four of these. They are named anyway, matching how
			// /sitemap.xml was already listed, so a rename cannot silently drop
			// one from the build.
			entries: ['*', '/sitemap.xml', '/sitemap-pages.xml', '/sitemap-swim.xml', '/sitemap-beaches.xml']
		}
	}
};

export default config;
