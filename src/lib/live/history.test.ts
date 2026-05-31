import { describe, expect, it } from 'vitest';
import { parseSampleHistory } from './history';

const instant = (iso: string) => `http://reference.data.gov.uk/id/gregorian-instant/${iso}`;

describe('parseSampleHistory', () => {
	it('parses samples and returns them oldest first', () => {
		const out = parseSampleHistory({
			result: {
				items: [
					{
						sampleDateTime: instant('2026-05-18T14:10:00'),
						escherichiaColiCount: 10,
						intestinalEnterococciCount: 10
					},
					{
						sampleDateTime: instant('2026-05-01T09:00:00'),
						escherichiaColiCount: 2900,
						intestinalEnterococciCount: 2500
					}
				]
			}
		});
		expect(out.map((s) => s.sampledAt)).toEqual(['2026-05-01T09:00:00', '2026-05-18T14:10:00']);
		expect(out[0].eColi).toBe(2900);
		expect(out[1].intestinalEnterococci).toBe(10);
	});

	it('skips items with no usable date or counts', () => {
		const out = parseSampleHistory({
			result: {
				items: [
					{ escherichiaColiCount: 50 },
					{ sampleDateTime: instant('2026-05-18T14:10:00') },
					{ sampleDateTime: instant('2026-05-18T14:10:00'), escherichiaColiCount: 50 }
				]
			}
		});
		expect(out).toHaveLength(1);
		expect(out[0].eColi).toBe(50);
	});

	it('returns an empty array for an empty or malformed payload', () => {
		expect(parseSampleHistory({})).toEqual([]);
		expect(parseSampleHistory({ result: { items: [] } })).toEqual([]);
	});
});
