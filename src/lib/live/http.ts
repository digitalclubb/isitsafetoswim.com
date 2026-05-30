const USER_AGENT = 'isitsafetoswim/0.1 (+https://isitsafetoswim.com)';

export interface FetchJsonOptions {
	timeoutMs?: number;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export async function fetchJson<T = unknown>(
	url: string,
	options: FetchJsonOptions = {}
): Promise<T> {
	const timeoutMs = options.timeoutMs ?? 8_000;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const linked = options.signal;
	if (linked) {
		if (linked.aborted) controller.abort();
		else linked.addEventListener('abort', () => controller.abort(), { once: true });
	}
	try {
		const res = await fetch(url, {
			headers: {
				'user-agent': USER_AGENT,
				accept: 'application/json',
				...options.headers
			},
			signal: controller.signal,
			redirect: 'follow'
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
		}
		return (await res.json()) as T;
	} finally {
		clearTimeout(timer);
	}
}
