// Rasterise the brand SVG and OG SVG into PNG variants used by the manifest
// and social share cards. Runs at build time after the location index step.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const staticDir = resolve(repoRoot, 'static');

async function render(svgPath, outputPath, fitWidth) {
	const svg = await readFile(svgPath, 'utf8');
	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: fitWidth },
		background: 'rgba(0,0,0,0)'
	});
	const png = resvg.render().asPng();
	await writeFile(outputPath, png);
	console.log(
		`[generate-images] ${svgPath.split('/').pop()} -> ${outputPath.split('/').pop()} (${png.length} bytes)`
	);
}

const tasks = [
	{ from: 'icon.svg', to: 'icon-192.png', width: 192 },
	{ from: 'icon.svg', to: 'icon-512.png', width: 512 },
	{ from: 'icon.svg', to: 'icon-maskable-512.png', width: 512 },
	{ from: 'og.svg', to: 'og.png', width: 1200 }
];

for (const task of tasks) {
	await render(resolve(staticDir, task.from), resolve(staticDir, task.to), task.width);
}
