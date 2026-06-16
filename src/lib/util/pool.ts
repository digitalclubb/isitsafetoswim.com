/**
 * Run an async function over many items with a bounded number in flight at
 * once. Used by the precompute to fan out ~700 per-beach fetches without
 * opening 700 sockets at once. Results keep the input order.
 */
export async function mapPool<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const workerCount = Math.min(Math.max(1, limit), items.length);
	const workers = Array.from({ length: workerCount }, async () => {
		while (true) {
			const i = next++;
			if (i >= items.length) break;
			results[i] = await fn(items[i], i);
		}
	});
	await Promise.all(workers);
	return results;
}

/**
 * Run an async function over many items at a steady rate, starting one every
 * intervalMs regardless of how long each takes. Used to fetch profiles from the
 * rate-limited regulator host without bursting past its per-minute limit, where
 * a plain concurrency cap still spikes the instantaneous rate. Results keep the
 * input order.
 */
export async function pacedMap<T, R>(
	items: readonly T[],
	intervalMs: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	const running: Array<Promise<void>> = [];
	for (let i = 0; i < items.length; i++) {
		const index = i;
		running.push(
			Promise.resolve(fn(items[index], index)).then(
				(r) => {
					results[index] = r;
				},
				// Isolate a rejecting task: leave its slot unset (the caller treats it
				// as a miss) rather than failing the whole batch.
				() => {}
			)
		);
		if (i < items.length - 1 && intervalMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}
	}
	await Promise.all(running);
	return results;
}
