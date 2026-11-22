import { defineEnvVars } from '@sveltejs/kit/env';

// All three are optional: without REDIS_URL the map reads degrade to an empty
// blob, without CRON_SECRET the crons refuse every call, and without
// PUBLIC_BASEMAP_URL the map serves the self-hosted /uk.pmtiles.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	REDIS_URL: { schema: optional, description: 'Colour, profile, spills and rainfall store' },
	CRON_SECRET: { schema: optional, description: 'Bearer token Vercel Cron sends' },
	PUBLIC_BASEMAP_URL: { public: true, schema: optional, description: 'Basemap override' }
});
