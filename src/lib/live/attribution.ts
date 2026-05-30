import type { Country } from '$lib/data/types';

const EA = 'Contains Environment Agency information © Environment Agency and database right';
const NRW = 'Contains Natural Resources Wales information © NRW and database right';
const SEPA = 'Contains SEPA information © Scottish Environment Protection Agency';
const DAERA = 'Contains DAERA Northern Ireland information © Crown copyright';
const STREAM = 'Contains water-company storm overflow data, licensed under OGL v3';

export function attributionFor(country: Country, includeOverflow: boolean): string[] {
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
	if (includeOverflow) out.push(STREAM);
	return out;
}
