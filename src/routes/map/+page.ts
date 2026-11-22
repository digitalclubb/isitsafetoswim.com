import { getSearchIndex } from '#lib/data/search-index.ts';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
	return { points: getSearchIndex() };
};
