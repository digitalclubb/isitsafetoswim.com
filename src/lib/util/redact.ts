/**
 * Strips the two things a visitor can put in a URL on this site that would
 * identify where they are: the postcode they searched, and the coordinates the
 * "near me" button writes into the query string.
 *
 * A full UK postcode can identify a household, and the coordinates are rounded
 * to about 110 metres, so neither belongs in an analytics record. The route
 * itself is kept, so the counts still show how often each way of searching is
 * used.
 */
const POSTCODE_PATH = /^\/near\/[^/?#]+/i;
const LOCATING_PARAMS = ['lat', 'lon'];

export function redactAnalyticsUrl(url: string): string {
	let parsed: URL;
	try {
		parsed = new URL(url, 'https://isitsafetoswim.com');
	} catch {
		return url;
	}

	parsed.pathname = parsed.pathname.replace(POSTCODE_PATH, '/near/[postcode]');

	for (const param of LOCATING_PARAMS) {
		if (parsed.searchParams.has(param)) parsed.searchParams.set(param, 'redacted');
	}

	return parsed.toString();
}
