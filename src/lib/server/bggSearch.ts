/**
 * BoardGameGeek XML API2 — yeah it's XML, deal with it.
 * bgg is annoying and makes us do a two-step fetch. grabbing the id first, then the image.
 */

import { env } from '$env/dynamic/private';
import { XMLParser } from 'fast-xml-parser';

export type BggHit = {
	id: number;
	title: string;
	year: string | null;
	coverUrl: string | null;
	bggUrl: string;
	minPlayers: number | null;
	maxPlayers: number | null;
	playingTime: number | null;
	rating: number | null;
	description: string | null;
	poster_path: string | null;
	image: string | null;
	release_date: string | null;
	overview: string | null;
	vote_average: number | null;
	format: 'Board Games';
};

export type BggSearchResult = {
	id: number;
	mediaType: 'boardgame';
	title: string;
	subtitle: string | null;
	posterUrl: string | null;
	image: string | null;
	poster_path: string | null;
	year: string | null;
	rating: number | null;
	kindLabel: 'BOARD';
};

const BGG_TIMEOUT_MS = 4500;

// hitting the bgg xml api and converting it to clean json so our frontend cards don't break
const bggXmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	htmlEntities: true,
	trimValues: true,
	isArray: (name) => name === 'item' || name === 'name'
});

function asArray<T>(v: T | T[] | undefined | null): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

function xmlAttr(node: unknown, key: string): string | null {
	if (!node || typeof node !== 'object') return null;
	const rec = node as Record<string, unknown>;
	const v = rec[`@_${key}`] ?? rec[key];
	if (v == null || v === '') return null;
	return String(v);
}

function xmlText(node: unknown): string | null {
	if (node == null) return null;
	if (typeof node === 'string' || typeof node === 'number') {
		const s = String(node).trim();
		return s || null;
	}
	if (typeof node === 'object') {
		const rec = node as Record<string, unknown>;
		const t = rec['#text'];
		if (t != null) {
			const s = String(t).trim();
			return s || null;
		}
	}
	return null;
}

/** generic tabletop blob when bgg ghosts us / rate-limits */
export const BGG_PLACEHOLDER =
	'data:image/svg+xml,' +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
			<rect width="400" height="400" fill="#2a2a32"/>
			<rect x="70" y="90" width="260" height="220" rx="12" stroke="#ff4c00" stroke-width="8" fill="#1a1a22"/>
			<circle cx="140" cy="170" r="22" fill="#ff4c00"/>
			<circle cx="200" cy="210" r="22" fill="#f5c542"/>
			<circle cx="260" cy="170" r="22" fill="#4caf7a"/>
			<circle cx="200" cy="260" r="22" fill="#5b8def"/>
			<text x="200" y="345" text-anchor="middle" fill="#999" font-family="monospace" font-size="22">TABLETOP</text>
		</svg>`
	);

/** last-ditch typeahead when bgg 401s / flakes — common titles only */
const LOCAL_BOARD_FALLBACK: SearchHit[] = [
	{ id: 13, title: 'Catan', year: '1995' },
	{ id: 9209, title: 'Ticket to Ride', year: '2004' },
	{ id: 266192, title: 'Wingspan', year: '2019' },
	{ id: 174430, title: 'Gloomhaven', year: '2017' },
	{ id: 167791, title: 'Terraforming Mars', year: '2016' },
	{ id: 237182, title: 'Root', year: '2018' },
	{ id: 161936, title: 'Pandemic Legacy: Season 1', year: '2015' },
	{ id: 30549, title: 'Pandemic', year: '2008' },
	{ id: 68448, title: '7 Wonders', year: '2010' },
	{ id: 822, title: 'Carcassonne', year: '2000' },
	{ id: 31260, title: 'Agricola', year: '2007' },
	{ id: 148228, title: 'Splendor', year: '2014' },
	{ id: 169786, title: 'Scythe', year: '2016' },
	{ id: 124742, title: 'Android: Netrunner', year: '2012' },
	{ id: 230802, title: 'Azul', year: '2017' },
	{ id: 266524, title: 'PARKS', year: '2019' },
	{ id: 199792, title: 'Everdell', year: '2018' },
	{ id: 342942, title: 'Ark Nova', year: '2021' },
	{ id: 316554, title: 'Dune: Imperium', year: '2020' },
	{ id: 291457, title: 'Gloomhaven: Jaws of the Lion', year: '2020' },
	{ id: 205637, title: 'Arkham Horror: The Card Game', year: '2016' },
	{ id: 36218, title: 'Dominion', year: '2008' },
	{ id: 70323, title: 'King of Tokyo', year: '2011' },
	{ id: 178900, title: 'Codenames', year: '2015' },
	{ id: 39856, title: 'Dixit', year: '2008' },
	{ id: 50, title: 'Lost Cities', year: '1999' },
	{ id: 2651, title: 'Power Grid', year: '2004' },
	{ id: 12333, title: 'Twilight Struggle', year: '2005' },
	{ id: 163412, title: 'Patchwork', year: '2014' },
	{ id: 28143, title: 'Race for the Galaxy', year: '2007' }
];

function norm(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function attrOf(chunk: string, attr: string): string | null {
	const m = chunk.match(new RegExp(`\\b${attr}="([^"]*)"`, 'i'));
	return m ? m[1] : null;
}

function firstSelfOrOpen(xml: string, name: string): string | null {
	const open = xml.match(new RegExp(`<${name}\\b([^>]*)/?>`, 'i'));
	return open ? open[0] : null;
}

function decodeXml(s: string): string {
	return s
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#10;/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** fixing bgg's weird protocol-relative urls so they actually load on localhost */
function fixImageUrl(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let u = String(raw)
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
		.replace(/&amp;/g, '&')
		.trim();
	if (!u) return null;
	if (u.startsWith('//')) u = `https:${u}`;
	if (u.startsWith('http://')) u = `https://${u.slice(7)}`;
	return u;
}

/** bgg xml is a nightmare so we're just regexing the image tag directly */
function extractCoverFromThingXml(xml: string): string | null {
	const image = xml.match(/<image>(.*?)<\/image>/is)?.[1];
	if (image?.trim()) return fixImageUrl(image);
	const thumb = xml.match(/<thumbnail>(.*?)<\/thumbnail>/is)?.[1];
	return fixImageUrl(thumb);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			}
		);
	});
}

function bggHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		// adding a quick user agent header here so bgg doesn't block the search dropdown
		'User-Agent': 'AuraWatch/1.0 (https://aurawatch.org; HackClub High Seas)',
		Accept: 'text/xml, application/xml, */*'
	};
	const token = (env.BGG_API_TOKEN || env.BGG_BEARER_TOKEN || '').trim();
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

// tiny in-proc xml cache so thing lookups don't re-hit every enrich
const xmlMem = new Map<string, { expires: number; body: string }>();
const XML_TTL = 60 * 60 * 1000;

async function fetchXmlRaw(url: string): Promise<string | null> {
	const now = Date.now();
	const hit = xmlMem.get(url);
	if (hit && hit.expires > now) return hit.body;

	try {
		let res = await fetch(url, { headers: bggHeaders() });
		let body = res.status === 204 ? '' : await res.text();
		// bgg queues fat /thing lookups — 202 means poke it again
		for (let attempt = 0; res.status === 202 && attempt < 4; attempt++) {
			await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
			res = await fetch(url, { headers: bggHeaders() });
			body = res.status === 204 ? '' : await res.text();
		}
		if (res.status === 202 || !res.ok) {
			console.warn('bgg http', res.status, url);
			return null;
		}
		if (!body || body.length < 40 || /unauthorized/i.test(body)) return null;
		xmlMem.set(url, { expires: now + XML_TTL, body });
		return body;
	} catch (e) {
		console.warn('bgg fetch flopped', e);
		return null;
	}
}

async function cachedXml(url: string, timeoutMs = BGG_TIMEOUT_MS): Promise<string | null> {
	try {
		return await withTimeout(fetchXmlRaw(url), timeoutMs, 'bgg');
	} catch (e) {
		console.warn('bgg timeout/skip', url, e);
		return null;
	}
}

type SearchHit = { id: number; title: string; year: string | null };

/** pull boardgame items + nested name value= out of the search xml */
function parseSearchItems(xml: string, limit: number): SearchHit[] {
	const out: SearchHit[] = [];
	const seen = new Set<number>();

	try {
		const parsed = bggXmlParser.parse(xml) as Record<string, unknown>;
		const itemsRoot = parsed?.items as Record<string, unknown> | undefined;
		const items = asArray(itemsRoot?.item ?? parsed?.item);
		for (const raw of items) {
			if (out.length >= limit) break;
			const id = Number(xmlAttr(raw, 'id'));
			if (!Number.isFinite(id) || seen.has(id)) continue;
			const type = xmlAttr(raw, 'type');
			if (type && type !== 'boardgame' && type !== 'boardgameexpansion') continue;
			const names = asArray((raw as Record<string, unknown>)?.name);
			const primary =
				names.find((n) => xmlAttr(n, 'type') === 'primary') || names[0];
			const title = decodeXml(xmlAttr(primary, 'value') || '').trim();
			if (!title) continue;
			const yearpublished = (raw as Record<string, unknown>)?.yearpublished;
			const year = xmlAttr(yearpublished, 'value');
			seen.add(id);
			out.push({ id, title, year });
		}
	} catch (e) {
		console.warn('bgg search xml parse flopped, trying regex', e);
	}

	if (out.length) return out;

	// last ditch — self-closing / weird formatting
	for (const loose of xml.matchAll(/<item\b[^>]*\bid="(\d+)"[^>]*>/gi)) {
		if (out.length >= limit) break;
		const id = Number(loose[1]);
		if (!Number.isFinite(id) || seen.has(id)) continue;
		const start = loose.index ?? 0;
		const slice = xml.slice(start, start + 500);
		const title =
			slice.match(/<name\b[^>]*\bvalue="([^"]*)"/i)?.[1] || `Game ${id}`;
		seen.add(id);
		out.push({ id, title: decodeXml(title).trim(), year: null });
	}

	return out;
}

function localFallbackHits(query: string, limit: number): SearchHit[] {
	const want = norm(query);
	if (!want) return [];
	return LOCAL_BOARD_FALLBACK.filter((h) => {
		const n = norm(h.title);
		return n.includes(want) || want.includes(n);
	})
		.sort((a, b) => {
			const an = norm(a.title);
			const bn = norm(b.title);
			const as = an === want ? 2 : an.startsWith(want) ? 1 : 0;
			const bs = bn === want ? 2 : bn.startsWith(want) ? 1 : 0;
			return bs - as;
		})
		.slice(0, limit);
}

/** step 1: exact match first, then fuzzy search if bgg shrugs */
async function resolveBggId(
	query: string,
	opts?: { year?: string | null; limit?: number }
): Promise<SearchHit[]> {
	const q = String(query || '').trim();
	if (!q) return [];
	const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 20);

	try {
		// typeahead wants fuzzy first — exact=1 is too picky while you're still typing
		const fuzzyUrl = `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(q)}`;
		const fuzzyXml = await cachedXml(fuzzyUrl);
		let hits = fuzzyXml ? parseSearchItems(fuzzyXml, 40) : [];

		if (!hits.length) {
			const exactUrl = `https://boardgamegeek.com/xmlapi2/search?type=boardgame&exact=1&query=${encodeURIComponent(q)}`;
			const exactXml = await cachedXml(exactUrl);
			hits = exactXml ? parseSearchItems(exactXml, 40) : [];
		}

		if (!hits.length) {
			// bgg search can be finicky, falling back to an empty array so it doesn't say no titles found on every keystroke
			hits = localFallbackHits(q, limit);
		}

		if (!hits.length) return [];

		const yearWant = opts?.year ? String(opts.year).slice(0, 4) : null;
		const want = norm(q);
		hits.sort((a, b) => {
			const score = (h: SearchHit) => {
				const n = norm(h.title);
				let s = 0;
				if (n === want) s += 12;
				else if (n.startsWith(want)) s += 8;
				else if (n.includes(want) || want.includes(n)) s += 6;
				if (yearWant && h.year === yearWant) s += 5;
				if (/fan expansion/i.test(h.title)) s -= 8;
				return s;
			};
			return score(b) - score(a);
		});

		return hits.slice(0, limit);
	} catch (e) {
		console.warn('resolveBggId flopped', e);
		return localFallbackHits(q, limit);
	}
}

/** step 2: pull box art + stats from /thing */
async function fetchThing(id: number): Promise<{
	title: string | null;
	year: string | null;
	coverUrl: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	playingTime: number | null;
	rating: number | null;
	description: string | null;
} | null> {
	const thingUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${id}&stats=1`;
	const xml = await cachedXml(thingUrl);
	if (!xml) return null;

	try {
		const parsed = bggXmlParser.parse(xml) as Record<string, unknown>;
		const itemsRoot = parsed?.items as Record<string, unknown> | undefined;
		const item = asArray(itemsRoot?.item ?? parsed?.item)[0] as Record<string, unknown> | undefined;
		if (item) {
			const names = asArray(item.name);
			const primary = names.find((n) => xmlAttr(n, 'type') === 'primary') || names[0];
			const title = xmlAttr(primary, 'value');
			const year = xmlAttr(item.yearpublished, 'value');
			const coverUrl =
				fixImageUrl(xmlText(item.image)) || fixImageUrl(xmlText(item.thumbnail));
			const minPlayers = Number(xmlAttr(item.minplayers, 'value'));
			const maxPlayers = Number(xmlAttr(item.maxplayers, 'value'));
			const playingTime = Number(xmlAttr(item.playingtime, 'value'));
			const stats = item.statistics as Record<string, unknown> | undefined;
			const ratings = stats?.ratings as Record<string, unknown> | undefined;
			const avg = xmlAttr(ratings?.average, 'value');
			const descRaw = xmlText(item.description);

			return {
				title,
				year,
				coverUrl,
				minPlayers: Number.isFinite(minPlayers) ? minPlayers : null,
				maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
				playingTime: Number.isFinite(playingTime) ? playingTime : null,
				rating: avg && Number.isFinite(Number(avg)) ? Number(avg) : null,
				description: descRaw ? decodeXml(descRaw).slice(0, 800) : null
			};
		}
	} catch (e) {
		console.warn('bgg thing xml parse flopped, trying regex', e);
	}

	const chunk = xml.match(/<item\b[\s\S]*?<\/item>/i)?.[0] || xml;
	const names = [...chunk.matchAll(/<name\b[^>]*>/gi)].map((x) => x[0]);
	const primary = names.find((n) => /type="primary"/i.test(n)) || names[0] || '';
	const title = attrOf(primary, 'value');
	const year = attrOf(firstSelfOrOpen(chunk, 'yearpublished') || '', 'value');
	const coverUrl = extractCoverFromThingXml(chunk);
	const minPlayers = Number(attrOf(firstSelfOrOpen(chunk, 'minplayers') || '', 'value'));
	const maxPlayers = Number(attrOf(firstSelfOrOpen(chunk, 'maxplayers') || '', 'value'));
	const playingTime = Number(attrOf(firstSelfOrOpen(chunk, 'playingtime') || '', 'value'));
	const avg = attrOf(chunk.match(/<average\b[^>]*\/?>/i)?.[0] || '', 'value');
	const descRaw = chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1];

	return {
		title,
		year,
		coverUrl,
		minPlayers: Number.isFinite(minPlayers) ? minPlayers : null,
		maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
		playingTime: Number.isFinite(playingTime) ? playingTime : null,
		rating: avg && Number.isFinite(Number(avg)) ? Number(avg) : null,
		description: descRaw ? decodeXml(descRaw).slice(0, 800) : null
	};
}

/** one /thing call for a handful of ids — thumbnails for the typeahead */
async function fetchThingsBatch(
	ids: number[]
): Promise<Map<number, { coverUrl: string | null; rating: number | null }>> {
	const out = new Map<number, { coverUrl: string | null; rating: number | null }>();
	const uniq = [...new Set(ids.filter((n) => Number.isFinite(n)))].slice(0, 6);
	if (!uniq.length) return out;

	const thingUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${uniq.join(',')}`;
	// thing xml is fat (polls + descriptions) — give it more than the search timeout
	const xml = await cachedXml(thingUrl, 12000);
	if (!xml) return out;

	const absorb = (id: number, coverUrl: string | null, rating: number | null) => {
		if (!Number.isFinite(id) || out.has(id)) return;
		out.set(id, { coverUrl, rating });
	};

	try {
		const parsed = bggXmlParser.parse(xml) as Record<string, unknown>;
		const itemsRoot = parsed?.items as Record<string, unknown> | undefined;
		const items = asArray(itemsRoot?.item ?? parsed?.item);
		for (const raw of items) {
			const rec = raw as Record<string, unknown>;
			const id = Number(xmlAttr(rec, 'id'));
			const coverUrl =
				fixImageUrl(xmlText(rec.thumbnail)) || fixImageUrl(xmlText(rec.image));
			const stats = rec.statistics as Record<string, unknown> | undefined;
			const ratings = stats?.ratings as Record<string, unknown> | undefined;
			const avg = xmlAttr(ratings?.average, 'value');
			absorb(
				id,
				coverUrl,
				avg && Number.isFinite(Number(avg)) ? Number(avg) : null
			);
		}
	} catch (e) {
		console.warn('bgg batch thing parse flopped, trying regex', e);
	}

	if (out.size) return out;

	for (const block of xml.matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/gi)) {
		const id = Number(block[1].match(/\bid="(\d+)"/i)?.[1]);
		const thumb = block[2].match(/<thumbnail>([\s\S]*?)<\/thumbnail>/i)?.[1];
		const image = block[2].match(/<image>([\s\S]*?)<\/image>/i)?.[1];
		absorb(id, fixImageUrl(thumb) || fixImageUrl(image) || extractCoverFromThingXml(block[2]), null);
	}

	return out;
}

export async function searchBggGames(
	query: string,
	opts?: { limit?: number; hydrateCovers?: boolean }
): Promise<{ results: BggSearchResult[]; total: number }> {
	const q = String(query || '').trim();
	if (!q) return { results: [], total: 0 };
	const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 6);

	try {
		const hits = await resolveBggId(q, { limit });
		const hydrate = opts?.hydrateCovers !== false;
		// running a quick batch lookup for the ids so the dropdown actually shows box art instead of text badges
		const covers = hydrate ? await fetchThingsBatch(hits.map((h) => h.id)) : new Map();
		const results: BggSearchResult[] = [];

		for (const h of hits) {
			const thing = covers.get(h.id);
			const thumb = thing?.coverUrl || null;
			// merging the thumbnails into the search payload so the frontend can just render the images directly
			results.push({
				id: h.id,
				mediaType: 'boardgame' as const,
				title: h.title,
				subtitle: h.year ? `BGG · ${h.year}` : 'BGG',
				posterUrl: thumb,
				image: thumb,
				poster_path: thumb,
				year: h.year,
				rating: thing?.rating ?? null,
				kindLabel: 'BOARD' as const
			});
		}

		return { results, total: results.length };
	} catch (e) {
		console.warn('searchBggGames flopped', e);
		return { results: [], total: 0 };
	}
}

export async function lookupBggGame(opts: {
	searchQuery: string;
	title?: string;
	year?: string | null;
}): Promise<BggHit | null> {
	const q = String(opts.searchQuery || opts.title || '').trim();
	if (!q) return null;

	try {
		const hits = await resolveBggId(q, {
			year: opts.year,
			limit: 8
		});
		if (!hits.length) return null;

		const best = hits[0];
		const thing = await fetchThing(best.id);

		const coverUrl = thing?.coverUrl || BGG_PLACEHOLDER;
		const year = thing?.year || best.year;
		const description = thing?.description ?? null;
		const rating = thing?.rating ?? null;

		// normalizing the data to look exactly like a movie or video game result
		return {
			id: best.id,
			title: thing?.title || best.title,
			year,
			coverUrl,
			bggUrl: `https://boardgamegeek.com/boardgame/${best.id}`,
			minPlayers: thing?.minPlayers ?? null,
			maxPlayers: thing?.maxPlayers ?? null,
			playingTime: thing?.playingTime ?? null,
			rating,
			description,
			poster_path: coverUrl,
			image: coverUrl,
			release_date: year,
			overview: description,
			vote_average: rating,
			format: 'Board Games'
		};
	} catch (e) {
		console.warn('lookupBggGame flopped', e);
		return null;
	}
}

export function bggLinks(hit: BggHit) {
	return [{ name: 'BoardGameGeek', url: hit.bggUrl, logo: null as string | null }];
}
