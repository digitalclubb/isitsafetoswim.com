export interface LatLon {
	lat: number;
	lon: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMetres(a: LatLon, b: LatLon): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Convert an Ordnance Survey National Grid easting/northing (EPSG:27700, Airy
 * 1830) to WGS84 latitude/longitude in degrees. Thames Water's open data
 * reports outfall locations as OSGB36 X/Y, but the rest of the app and the
 * distance gating work in WGS84, so coordinates must be reprojected before use.
 *
 * Transverse Mercator inverse on the Airy 1830 ellipsoid, then a Helmert
 * transform from the OSGB36 datum to WGS84. Accurate to a few metres, which is
 * ample for distance gating at the kilometre scale (OSTN15 would add only
 * centimetre precision).
 */
export function osgb36ToWgs84(easting: number, northing: number): LatLon {
	// Airy 1830 ellipsoid and National Grid true origin.
	const a = 6_377_563.396;
	const b = 6_356_256.909;
	const f0 = 0.9996012717;
	const lat0 = (49 * Math.PI) / 180;
	const lon0 = (-2 * Math.PI) / 180;
	const n0 = -100_000;
	const e0 = 400_000;
	const e2 = 1 - (b * b) / (a * a);
	const n = (a - b) / (a + b);
	const n2 = n * n;
	const n3 = n * n * n;

	let lat = lat0;
	let m = 0;
	do {
		lat = (northing - n0 - m) / (a * f0) + lat;
		const ma = (1 + n + 1.25 * n2 + 1.25 * n3) * (lat - lat0);
		const mb = (3 * n + 3 * n2 + 2.625 * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
		const mc = (1.875 * n2 + 1.875 * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
		const md = (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
		m = b * f0 * (ma - mb + mc - md);
	} while (Math.abs(northing - n0 - m) >= 0.00001);

	const sinLat = Math.sin(lat);
	const cosLat = Math.cos(lat);
	const tanLat = Math.tan(lat);
	const nu = (a * f0) / Math.sqrt(1 - e2 * sinLat * sinLat);
	const rho = (a * f0 * (1 - e2)) / (1 - e2 * sinLat * sinLat) ** 1.5;
	const eta2 = nu / rho - 1;

	const tan2 = tanLat * tanLat;
	const tan4 = tan2 * tan2;
	const tan6 = tan4 * tan2;
	const sec = 1 / cosLat;
	const nu3 = nu ** 3;
	const nu5 = nu ** 5;
	const nu7 = nu ** 7;

	const vii = tanLat / (2 * rho * nu);
	const viii = (tanLat / (24 * rho * nu3)) * (5 + 3 * tan2 + eta2 - 9 * tan2 * eta2);
	const ix = (tanLat / (720 * rho * nu5)) * (61 + 90 * tan2 + 45 * tan4);
	const x = sec / nu;
	const xi = (sec / (6 * nu3)) * (nu / rho + 2 * tan2);
	const xii = (sec / (120 * nu5)) * (5 + 28 * tan2 + 24 * tan4);
	const xiia = (sec / (5040 * nu7)) * (61 + 662 * tan2 + 1320 * tan4 + 720 * tan6);

	const de = easting - e0;
	const de2 = de * de;
	const de3 = de2 * de;
	const de4 = de2 * de2;
	const de5 = de3 * de2;
	const de6 = de4 * de2;
	const de7 = de5 * de2;

	const latAiry = lat - vii * de2 + viii * de4 - ix * de6;
	const lonAiry = lon0 + x * de - xi * de3 + xii * de5 - xiia * de7;

	return helmertOsgb36ToWgs84(latAiry, lonAiry);
}

// Helmert transform OSGB36 -> WGS84 (the inverse of the OS-published
// WGS84 -> OSGB36 parameters: signs and scale negated).
function helmertOsgb36ToWgs84(lat: number, lon: number): LatLon {
	const airyA = 6_377_563.396;
	const airyB = 6_356_256.909;
	const wgsA = 6_378_137.0;
	const wgsB = 6_356_752.3142;

	const sinLat = Math.sin(lat);
	const cosLat = Math.cos(lat);
	const sinLon = Math.sin(lon);
	const cosLon = Math.cos(lon);
	const h = 0; // outfalls sit at ground level; height error is negligible here

	const airyE2 = 1 - (airyB * airyB) / (airyA * airyA);
	const nu = airyA / Math.sqrt(1 - airyE2 * sinLat * sinLat);

	const x1 = (nu + h) * cosLat * cosLon;
	const y1 = (nu + h) * cosLat * sinLon;
	const z1 = ((1 - airyE2) * nu + h) * sinLat;

	// OSGB36 -> WGS84 (metres, ppm, arcseconds).
	const tx = 446.448;
	const ty = -125.157;
	const tz = 542.06;
	const s = -20.4894 / 1_000_000;
	const rx = (0.1502 / 3600) * (Math.PI / 180);
	const ry = (0.247 / 3600) * (Math.PI / 180);
	const rz = (0.8421 / 3600) * (Math.PI / 180);

	const x2 = tx + (1 + s) * (x1 - rz * y1 + ry * z1);
	const y2 = ty + (1 + s) * (rz * x1 + y1 - rx * z1);
	const z2 = tz + (1 + s) * (-ry * x1 + rx * y1 + z1);

	const wgsE2 = 1 - (wgsB * wgsB) / (wgsA * wgsA);
	const p = Math.sqrt(x2 * x2 + y2 * y2);
	let latW = Math.atan2(z2, p * (1 - wgsE2));
	let latPrev: number;
	let iterations = 0;
	do {
		latPrev = latW;
		const nuW = wgsA / Math.sqrt(1 - wgsE2 * Math.sin(latW) ** 2);
		latW = Math.atan2(z2 + wgsE2 * nuW * Math.sin(latW), p);
		iterations += 1;
	} while (Math.abs(latW - latPrev) >= 1e-12 && iterations < 20);

	const lonW = Math.atan2(y2, x2);
	return { lat: (latW * 180) / Math.PI, lon: (lonW * 180) / Math.PI };
}
