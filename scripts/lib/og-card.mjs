// Build the SVG for a social share card (1200x630). Rendered to PNG at build
// time by generate-images.mjs. Pure string building so it is unit-tested.

const STRIPE = { green: '#1f6f4b', amber: '#a86b1c', red: '#9b2c2c' };
const INK = '#0b1f2a';
const INK_SOFT = '#475a64';
const CREAM = '#fbfaf6';

/**
 * Shrink a font size until the line fits the card's text column.
 *
 * The meta line had no fit at all, so it ran off the right edge of every card
 * whose council name is long: all 33 Northern Irish sites (up to "Causeway
 * Coast and Glens Borough Council · Northern Ireland" at 59 characters) plus
 * the City of London. Source Serif averages a little under half the point size
 * per character at this weight, which is close enough to keep text inside a
 * column with this much slack, and the floor stops a very long line shrinking
 * into illegibility rather than being allowed to clip.
 */
export function fitFontSize(text, maxWidth, baseSize, minSize = 26) {
	const estimated = String(text).length * baseSize * 0.48;
	if (estimated <= maxWidth) return baseSize;
	return Math.max(minSize, Math.floor((maxWidth / estimated) * baseSize));
}

export function escapeXml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Greedy word wrap to lines of at most `max` characters.
export function wrapText(text, max) {
	const lines = [];
	let line = '';
	for (const word of String(text).split(/\s+/).filter(Boolean)) {
		if (!line) line = word;
		else if (`${line} ${word}`.length <= max) line += ` ${word}`;
		else {
			lines.push(line);
			line = word;
		}
	}
	if (line) lines.push(line);
	return lines;
}

// Northern Ireland has no annual classification to be waiting for, so "Not yet
// classified" would promise one that is never coming, and it would put the site
// DAERA advises against bathing on a neutral card. Where the regulator publishes
// a reading instead, the card carries that.
function classificationLabel(classification, assessment) {
	if (classification === 'Closed') return 'Currently closed';
	if (classification === 'New') return 'Newly designated';
	if (classification === 'Unknown' || !classification) {
		if (assessment?.level === 'advised-against') return 'Advised against bathing';
		// Same window the verdict engine and the cards use, so a card shared in
		// February does not present August's reading as the latest word.
		if (assessment) {
			return readingIsCurrent(assessment)
				? `Latest reading ${assessment.label}`
				: `Last reading ${assessment.label}`;
		}
		return 'Not yet classified';
	}
	return `Rated ${classification}`;
}

const READING_CURRENT_DAYS = 28;

function readingIsCurrent(assessment) {
	if (!assessment?.assessedAt) return false;
	const at = Date.parse(assessment.assessedAt);
	if (!Number.isFinite(at)) return false;
	return Date.now() - at <= READING_CURRENT_DAYS * 24 * 36e5;
}

function classificationColour(classification, assessment) {
	if (assessment?.level === 'advised-against') return STRIPE.red;
	if (assessment?.level === 'good') return STRIPE.green;
	if (assessment?.level === 'satisfactory') return STRIPE.amber;
	if (classification === 'Excellent' || classification === 'Good') return STRIPE.green;
	if (classification === 'Sufficient') return STRIPE.amber;
	if (classification === 'Poor' || classification === 'Closed') return STRIPE.red;
	return INK_SOFT;
}

function frame(inner) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
	<rect width="1200" height="630" fill="${CREAM}"/>
	<g transform="translate(80,70)">
		<rect width="46" height="46" rx="9" fill="${INK}"/>
		<path d="M7 30c6-6 12-6 18 0s12 6 18 0" stroke="${CREAM}" stroke-width="3.2" fill="none" stroke-linecap="round" transform="translate(0,2)"/>
		<path d="M7 38c6-6 12-6 18 0s12 6 18 0" stroke="#6ec39a" stroke-width="3.2" fill="none" stroke-linecap="round" transform="translate(0,2)"/>
	</g>
	<text x="146" y="103" font-family="Source Serif 4" font-weight="600" font-size="27" letter-spacing="0.5" fill="${INK_SOFT}">Is it safe to swim?</text>
${inner}
	<rect x="0" y="610" width="400" height="20" fill="${STRIPE.green}"/>
	<rect x="400" y="610" width="400" height="20" fill="${STRIPE.amber}"/>
	<rect x="800" y="610" width="400" height="20" fill="${STRIPE.red}"/>
</svg>`;
}

// Fit the headline to at most two lines, dropping the size for long names.
function headline(name) {
	let lines = wrapText(name, 17);
	let size = 104;
	if (lines.length > 2) {
		lines = wrapText(name, 26).slice(0, 2);
		size = 70;
	}
	lines = lines.slice(0, 2);
	const lineHeight = Math.round(size * 1.04);
	const tspans = lines
		.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
		.join('');
	return { tspans, size, extra: (lines.length - 1) * lineHeight };
}

export function buildLocationCard({ name, region, country, classification, currentAssessment }) {
	const top = 300;
	const h = headline(name);
	const place = region ? `${region} · ${country}` : country;
	// 1200 wide, 80 of padding each side.
	const placeSize = fitFontSize(place, 1040, 40);
	const metaY = top + h.extra + 74;
	const classY = metaY + 66;
	const inner = `	<text x="80" y="${top}" font-family="Source Serif 4" font-weight="600" font-size="${h.size}" letter-spacing="-1" fill="${INK}">${h.tspans}</text>
	<text x="80" y="${metaY}" font-family="Source Serif 4" font-weight="400" font-size="${placeSize}" fill="${INK_SOFT}">${escapeXml(place)}</text>
	<g transform="translate(80,${classY})">
		<circle cx="11" cy="-12" r="11" fill="${classificationColour(classification, currentAssessment)}"/>
		<text x="36" y="0" font-family="Source Serif 4" font-weight="600" font-size="34" fill="${INK}">${escapeXml(classificationLabel(classification, currentAssessment))}</text>
	</g>`;
	return frame(inner);
}

export function buildHeadlineCard({ title, subtitle }) {
	const top = 350;
	const h = headline(title);
	const inner = `	<text x="80" y="${top}" font-family="Source Serif 4" font-weight="600" font-size="${h.size}" letter-spacing="-1" fill="${INK}">${h.tspans}</text>
	<text x="80" y="${top + h.extra + 70}" font-family="Source Serif 4" font-weight="400" font-size="38" fill="${INK_SOFT}">${escapeXml(subtitle)}</text>`;
	return frame(inner);
}

export function buildAreaCard({ name, country, count, kind }) {
	const top = 360;
	const h = headline(name);
	const sub =
		kind === 'country'
			? `${count} designated bathing waters`
			: `${count} designated bathing waters · ${country}`;
	const inner = `	<text x="80" y="250" font-family="Source Serif 4" font-weight="400" font-size="34" fill="${INK_SOFT}">Cleanest beaches in</text>
	<text x="80" y="${top}" font-family="Source Serif 4" font-weight="600" font-size="${h.size}" letter-spacing="-1" fill="${INK}">${h.tspans}</text>
	<text x="80" y="${top + h.extra + 70}" font-family="Source Serif 4" font-weight="400" font-size="38" fill="${INK_SOFT}">${escapeXml(sub)}</text>`;
	return frame(inner);
}
