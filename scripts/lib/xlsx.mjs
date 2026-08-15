// A read-only xlsx reader, no dependencies. An xlsx is a zip of XML parts, and
// Node ships the inflate half of zip in zlib, so the only missing piece is the
// container format. That is cheaper than taking a spreadsheet dependency for
// one build script that runs once a year, when the EA publishes the EDM return.
//
// Deliberately partial: cell values only, no formatting, formulas, dates or
// styles. The EDM returns are flat tables of text and numbers, and anything
// richer would be a reason to reach for a real library instead.

import { inflateRawSync } from 'node:zlib';

const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/**
 * Read a zip from a buffer into a Map of entry name to Buffer.
 *
 * Entries are located through the central directory rather than by scanning
 * local headers, because a local header may declare sizes of zero and defer
 * them to a trailing data descriptor, which cannot be found without already
 * knowing where the entry ends.
 */
export function readZipEntries(buffer) {
	const eocd = findEndOfCentralDirectory(buffer);
	if (eocd < 0) throw new Error('not a zip file: no end-of-central-directory record');

	const count = buffer.readUInt16LE(eocd + 10);
	let offset = buffer.readUInt32LE(eocd + 16);
	// Either sentinel means the real values live in a ZIP64 record this reader
	// does not parse, and carrying on would silently read a truncated archive.
	if (count === 0xffff || offset === 0xffffffff) {
		throw new Error('ZIP64 archive: too many entries or too large for this reader');
	}
	const entries = new Map();

	for (let i = 0; i < count; i += 1) {
		if (buffer.readUInt32LE(offset) !== SIG_CENTRAL) {
			throw new Error(`corrupt central directory at entry ${i}`);
		}
		const method = buffer.readUInt16LE(offset + 10);
		const compressedSize = buffer.readUInt32LE(offset + 20);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const localOffset = buffer.readUInt32LE(offset + 42);
		const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

		// The local header repeats the name and extra fields, at its own lengths,
		// so the data start has to be measured from the local header not this one.
		const localNameLength = buffer.readUInt16LE(localOffset + 26);
		const localExtraLength = buffer.readUInt16LE(localOffset + 28);
		const start = localOffset + 30 + localNameLength + localExtraLength;
		const raw = buffer.subarray(start, start + compressedSize);

		if (method === 0) entries.set(name, Buffer.from(raw));
		else if (method === 8) entries.set(name, inflateRawSync(raw));
		else throw new Error(`unsupported compression method ${method} for ${name}`);

		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

function findEndOfCentralDirectory(buffer) {
	// The record is at the end, but a trailing comment of up to 64KB can follow.
	const earliest = Math.max(0, buffer.length - 22 - 0xffff);
	for (let i = buffer.length - 22; i >= earliest; i -= 1) {
		if (buffer.readUInt32LE(i) === SIG_EOCD) return i;
	}
	return -1;
}

/**
 * Every <t> descendant joined, which is how a cell with mixed runs reads. The
 * opening tag is matched strictly so a self-closing <t/>, which the returns do
 * contain, cannot pair with the closing tag of a later run and swallow the
 * markup between them.
 */
function textOf(xml) {
	return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');
}

function unescapeXml(value) {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
		.replace(/&amp;/g, '&');
}

/** "BC" to 54. Column letters are base-26 with A as 1. */
export function columnIndex(cellRef) {
	const letters = /^[A-Z]+/.exec(String(cellRef ?? '').toUpperCase());
	if (!letters) return -1;
	let n = 0;
	for (const ch of letters[0]) n = n * 26 + (ch.charCodeAt(0) - 64);
	return n - 1;
}

/**
 * Open a workbook buffer. Returns the sheet names in workbook order and a
 * reader that yields one sheet as an array of string rows.
 */
export function openWorkbook(buffer) {
	const entries = readZipEntries(buffer);
	const read = (name) => {
		const found = entries.get(name);
		if (!found) throw new Error(`missing workbook part: ${name}`);
		return found.toString('utf8');
	};

	// Cells reference shared strings by index, so a missed <si> shifts every
	// string after it and quietly rewrites the whole workbook. <sst> declares
	// how many there should be, which turns that into a loud failure.
	let sharedStrings = [];
	if (entries.has('xl/sharedStrings.xml')) {
		const xml = read('xl/sharedStrings.xml');
		sharedStrings = [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
		const declared = Number(/<sst\b[^>]*\buniqueCount="(\d+)"/.exec(xml)?.[1]);
		if (Number.isFinite(declared) && declared !== sharedStrings.length) {
			throw new Error(
				`shared strings: parsed ${sharedStrings.length} but the workbook declares ${declared}`
			);
		}
	}

	const relTargets = new Map(
		[...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/>/g)].map((m) => [
			/\bId="([^"]+)"/.exec(m[1])?.[1],
			/\bTarget="([^"]+)"/.exec(m[1])?.[1]
		])
	);

	const sheets = [...read('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => {
		const name = unescapeXml(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? '');
		const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1];
		const target = relTargets.get(rid) ?? '';
		const path = target.startsWith('/')
			? target.slice(1)
			: target.startsWith('xl/')
				? target
				: `xl/${target}`;
		return { name, path };
	});

	function rowsOf(sheetName) {
		const sheet = sheets.find((s) => s.name === sheetName);
		if (!sheet) throw new Error(`no such sheet: ${sheetName}`);
		const xml = read(sheet.path);
		const out = [];
		for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
			const cells = [];
			for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
				const attrs = cellMatch[1];
				const body = cellMatch[2] ?? '';
				const index = columnIndex(/\br="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? '');
				if (index < 0) continue;
				const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
				let value = '';
				if (type === 'inlineStr') {
					value = textOf(body);
				} else {
					const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
					if (raw !== undefined) {
						value = type === 's' ? (sharedStrings[Number(raw)] ?? '') : unescapeXml(raw);
					}
				}
				while (cells.length < index) cells.push('');
				cells[index] = value;
			}
			out.push(cells);
		}
		return out;
	}

	return { sheetNames: sheets.map((s) => s.name), rowsOf };
}
