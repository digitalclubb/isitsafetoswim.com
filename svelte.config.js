import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			runtime: 'nodejs22.x'
		}),
		alias: {
			$lib: 'src/lib',
			$data: 'src/data'
		},
		prerender: {
			handleHttpError: 'warn',
			handleMissingId: 'warn',
			entries: ['*', '/sitemap.xml']
		}
	}
};

export default config;
