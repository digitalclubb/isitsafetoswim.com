// Placeholder: the real implementation lands in Task #2.
// This script is invoked by `pnpm build` so it must always exit zero, even
// before the data layer is wired up. It writes an empty location index if
// none exists so that downstream code paths can rely on the file being
// present.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'src', 'data', 'locations.json');

async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

if (await exists(out)) {
	console.log(`[build-location-index] index already present at ${out}, skipping`);
	process.exit(0);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(
	out,
	`${JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			locations: []
		},
		null,
		2
	)}\n`
);
console.log(`[build-location-index] wrote empty placeholder index to ${out}`);
