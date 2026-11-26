import { waitUntil } from 'cloudflare:workers';
import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';

// Stands in for Vercel ISR: a GET whose response carries s-maxage is kept in
// this data centre's cache for that long, so a busy location page reaches the
// rate-limited regulator host once per five minutes rather than once per
// visitor. The Cache API ignores stale-while-revalidate and is a no-op on
// workers.dev, so this only takes effect on the custom domain. Prerendering
// runs in Node, which has no `caches`.
//
// The key drops the query string, as ISR did, so ?utm_source and the like
// cannot force a cold render: no cached route reads it. __data.json keeps it,
// because x-sveltekit-invalidated changes the payload.
export const handle: Handle = async ({ event, resolve }) => {
	const { request } = event;
	if (building || request.method !== 'GET' || request.headers.has('authorization')) {
		return resolve(event);
	}
	const url = new URL(request.url);
	if (!url.pathname.endsWith('/__data.json')) url.search = '';
	const key = new Request(url);
	const cache = caches.default;
	const hit = await cache.match(key).catch(() => undefined);
	if (hit) return hit;
	const response = await resolve(event);
	if (response.status === 200 && response.headers.get('cache-control')?.includes('s-maxage')) {
		waitUntil(cache.put(key, response.clone()).catch(() => {}));
	}
	return response;
};
