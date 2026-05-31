import type { Country } from '$lib/data/types';

const EA = 'Contains Environment Agency information © Environment Agency and database right';
const NRW = 'Contains Natural Resources Wales information © NRW and database right';
const SEPA = 'Contains SEPA information © Scottish Environment Protection Agency';
const DAERA = 'Contains DAERA Northern Ireland information © Crown copyright';
const STREAM = 'Contains water-company storm overflow data, licensed under OGL v3';
const THAMES = 'Contains Thames Water storm overflow data © Thames Water Utilities Limited';

/**
 * Which storm-overflow source fed the verdict, so the right licence is shown.
 * The ArcGIS company feeds are OGL v3; Thames Water's open data is under its own
 * terms, so it is credited separately rather than under OGL.
 */
export type OverflowSource = 'none' | 'ogl' | 'thames';

export function attributionFor(country: Country, overflow: OverflowSource = 'none'): string[] {
	const out: string[] = [];
	switch (country) {
		case 'England':
			out.push(EA);
			break;
		case 'Wales':
			out.push(NRW);
			break;
		case 'Scotland':
			out.push(SEPA);
			break;
		case 'Northern Ireland':
			out.push(DAERA);
			break;
	}
	if (overflow === 'thames') out.push(THAMES);
	else if (overflow === 'ogl') out.push(STREAM);
	return out;
}
