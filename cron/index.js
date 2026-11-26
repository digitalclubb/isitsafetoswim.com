const PATHS = {
	'0 * * * *': '/api/cron/refresh-map',
	'30 * * * *': '/api/cron/refresh-profiles'
};

export default {
	async scheduled(controller, env) {
		const res = await env.SITE.fetch(`https://isitsafetoswim.com${PATHS[controller.cron]}`, {
			headers: { authorization: `Bearer ${env.CRON_SECRET}` }
		});
		const body = await res.text();
		// Throwing marks the run as failed in the dashboard's Cron Events. The map
		// run answers 200 with ok:false when it refuses to overwrite a good
		// snapshot, which is a failure for this purpose.
		if (!res.ok || JSON.parse(body).ok === false) {
			throw new Error(`${controller.cron} ${res.status} ${body}`);
		}
		console.log(body);
	}
};
