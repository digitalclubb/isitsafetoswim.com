// Ordnance Survey National Grid references to WGS84, for the EDM storm-overflow
// returns. Every row in those returns carries a grid reference and nothing else
// positional, so this is the only way to place an outfall against a bathing
// water. Pure, and tested with Vitest.
//
// Two steps, both standard: the grid reference resolves to an OSGB36 easting
// and northing, then a Helmert transformation moves it onto WGS84. Helmert is
// accurate to a few metres, against outfall-to-beach distances measured in
// kilometres, so the far more involved OSTN15 grid shift buys nothing here.

const AIRY_A = 6377563.396;
const AIRY_B = 6356256.909;
const WGS84_A = 6378137.0;
const WGS84_B = 6356752.3141;
const SCALE = 0.9996012717;
const TRUE_ORIGIN_LAT = (49 * Math.PI) / 180;
const TRUE_ORIGIN_LON = (-2 * Math.PI) / 180;
const FALSE_EASTING = 400000;
const FALSE_NORTHING = -100000;

/**
 * "SP6419046470" to {easting, northing} in metres on OSGB36. The letter pair
 * names a 100km square, and the digits split evenly into easting and northing
 * offsets within it, each padded to five figures so that a coarser reference
 * resolves to the square's south-west corner. Returns null for anything
 * malformed, since the returns do carry the odd blank or typo.
 */
export function gridRefToEastingNorthing(ref) {
	const cleaned = String(ref ?? '')
		.replace(/\s+/g, '')
		.toUpperCase();
	// I is unused in the grid, so the alphabet skips it in both positions.
	const match = /^([A-HJ-Z]{2})(\d+)$/.exec(cleaned);
	if (!match) return null;
	const [, letters, digits] = match;
	if (digits.length % 2 !== 0) return null;
	const half = digits.length / 2;
	if (half < 1 || half > 5) return null;

	const first = letterIndex(letters[0]);
	const second = letterIndex(letters[1]);
	const easting =
		(((first - 2) % 5) * 5 + (second % 5)) * 100000 + Number(digits.slice(0, half).padEnd(5, '0'));
	const northing =
		(19 - Math.floor(first / 5) * 5 - Math.floor(second / 5)) * 100000 +
		Number(digits.slice(half).padEnd(5, '0'));
	// Letter pairs outside the squares that cover Great Britain fall through the
	// arithmetic above as negative or absurd coordinates rather than as an
	// error, so they are rejected here instead of being projected into the sea.
	if (easting < 0 || easting > 700000 || northing < 0 || northing > 1300000) return null;
	return { easting, northing };
}

function letterIndex(letter) {
	const index = letter.charCodeAt(0) - 65;
	return index > 7 ? index - 1 : index;
}

/** OSGB36 easting and northing to WGS84 {lat, lon} in degrees. */
export function eastingNorthingToWgs84(easting, northing) {
	const e2 = 1 - (AIRY_B * AIRY_B) / (AIRY_A * AIRY_A);
	const n = (AIRY_A - AIRY_B) / (AIRY_A + AIRY_B);

	// Newton iteration on the meridional arc to recover the footpoint latitude.
	let lat = TRUE_ORIGIN_LAT;
	let arc = 0;
	for (let i = 0; i < 100; i += 1) {
		lat = (northing - FALSE_NORTHING - arc) / (AIRY_A * SCALE) + lat;
		const dLat = lat - TRUE_ORIGIN_LAT;
		const sLat = lat + TRUE_ORIGIN_LAT;
		arc =
			AIRY_B *
			SCALE *
			((1 + n + 1.25 * n ** 2 + 1.25 * n ** 3) * dLat -
				(3 * n + 3 * n ** 2 + 2.625 * n ** 3) * Math.sin(dLat) * Math.cos(sLat) +
				(1.875 * n ** 2 + 1.875 * n ** 3) * Math.sin(2 * dLat) * Math.cos(2 * sLat) -
				(35 / 24) * n ** 3 * Math.sin(3 * dLat) * Math.cos(3 * sLat));
		if (Math.abs(northing - FALSE_NORTHING - arc) < 1e-5) break;
	}

	const sinLat = Math.sin(lat);
	const cosLat = Math.cos(lat);
	const tanLat = Math.tan(lat);
	const nu = (AIRY_A * SCALE) / Math.sqrt(1 - e2 * sinLat * sinLat);
	const rho = (AIRY_A * SCALE * (1 - e2)) / (1 - e2 * sinLat * sinLat) ** 1.5;
	const eta2 = nu / rho - 1;
	const t2 = tanLat ** 2;
	const t4 = tanLat ** 4;
	const t6 = tanLat ** 6;
	const d = easting - FALSE_EASTING;

	const vii = tanLat / (2 * rho * nu);
	const viii = (tanLat / (24 * rho * nu ** 3)) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2);
	const ix = (tanLat / (720 * rho * nu ** 5)) * (61 + 90 * t2 + 45 * t4);
	const x = 1 / (cosLat * nu);
	const xi = (1 / (cosLat * 6 * nu ** 3)) * (nu / rho + 2 * t2);
	const xii = (1 / (cosLat * 120 * nu ** 5)) * (5 + 28 * t2 + 24 * t4);
	const xiia = (1 / (cosLat * 5040 * nu ** 7)) * (61 + 662 * t2 + 1320 * t4 + 720 * t6);

	const osgbLat = lat - vii * d ** 2 + viii * d ** 4 - ix * d ** 6;
	const osgbLon = TRUE_ORIGIN_LON + x * d - xi * d ** 3 + xii * d ** 5 - xiia * d ** 7;
	return osgb36ToWgs84(osgbLat, osgbLon);
}

/** Helmert transformation, OSGB36 to WGS84, via geocentric cartesian coordinates. */
function osgb36ToWgs84(lat, lon) {
	const e2 = 1 - (AIRY_B * AIRY_B) / (AIRY_A * AIRY_A);
	const sinLat = Math.sin(lat);
	const cosLat = Math.cos(lat);
	const nu = AIRY_A / Math.sqrt(1 - e2 * sinLat * sinLat);
	const x1 = nu * cosLat * Math.cos(lon);
	const y1 = nu * cosLat * Math.sin(lon);
	const z1 = (1 - e2) * nu * sinLat;

	const tx = 446.448;
	const ty = -125.157;
	const tz = 542.06;
	const s = -20.4894e-6;
	const rx = (0.1502 / 3600) * (Math.PI / 180);
	const ry = (0.247 / 3600) * (Math.PI / 180);
	const rz = (0.8421 / 3600) * (Math.PI / 180);

	const x2 = tx + x1 * (1 + s) - y1 * rz + z1 * ry;
	const y2 = ty + x1 * rz + y1 * (1 + s) - z1 * rx;
	const z2 = tz - x1 * ry + y1 * rx + z1 * (1 + s);

	const e2b = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);
	const p = Math.hypot(x2, y2);
	let outLat = Math.atan2(z2, p * (1 - e2b));
	for (let i = 0; i < 20; i += 1) {
		const nu2 = WGS84_A / Math.sqrt(1 - e2b * Math.sin(outLat) ** 2);
		outLat = Math.atan2(z2 + e2b * nu2 * Math.sin(outLat), p);
	}
	return { lat: (outLat * 180) / Math.PI, lon: (Math.atan2(y2, x2) * 180) / Math.PI };
}

/** Grid reference straight to WGS84 {lat, lon}, or null when it will not parse. */
export function gridRefToWgs84(ref) {
	const en = gridRefToEastingNorthing(ref);
	if (!en) return null;
	return eastingNorthingToWgs84(en.easting, en.northing);
}

/** Metres between two WGS84 points. Matches the runtime helper in live/geo.ts. */
export function haversineMetres(a, b) {
	const R = 6_371_000;
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}
