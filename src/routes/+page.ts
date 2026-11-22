import { getSearchIndex } from '#lib/data/search-index.ts';

// The slim search index stays universal so it rides in the chunk the map and
// location pages already share and cache, rather than inline in this page's HTML.
export const load = ({ data }) => ({ ...data, searchIndex: getSearchIndex() });
