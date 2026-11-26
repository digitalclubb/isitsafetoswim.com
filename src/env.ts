import { defineEnvVars } from '@sveltejs/kit/env';

// Both are optional: without CRON_SECRET the crons refuse every call, and without
// PUBLIC_BASEMAP_URL the map serves the self-hosted /uk.pmtiles.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	CRON_SECRET: {
		schema: optional,
		description: 'Bearer token the isitsafetoswim-cron Worker sends'
	},
	PUBLIC_BASEMAP_URL: { public: true, schema: optional, description: 'Basemap override' }
});
