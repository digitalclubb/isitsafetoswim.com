import { getSearchIndex } from '$lib/data/search-index';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
	return { points: getSearchIndex() };
};
