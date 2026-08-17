/**
 * Open Library + manga fallbacks (Jikan / AniList).
 * Gemini gives us titles, we go fishing for covers.
 */

import { cachedJsonFetch } from '$lib/server/httpCache';

export type BookHit = {
	id: string;
	title: string;
	author: string | null;
	year: string | null;
	coverUrl: string | null;
	openLibraryUrl: string | null;
	isbn: string | null;
	kind: 'book' | 'manga';
	source: 'openlibrary' | 'jikan' | 'anilist' | 'googlebooks';
};

export type BookSearchResult = {
	id: string;
	mediaType: 'book' | 'manga';
	title: string;
	subtitle: string | null;
	posterUrl: string | null;
	year: string | null;
	rating: number | null;
	kindLabel: 'BOOK' | 'MANGA';
};

function norm(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function coverFromOl(doc: any): string | null {
	// grabbing the large cover image using the internal cover id (cover_i)
	if (doc?.cover_i) {
		return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
	}
	const isbn = Array.isArray(doc?.isbn) ? doc.isbn[0] : doc?.isbn;
	if (isbn) {
		return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
	}
	return null;
}

// adding google books fallback and cache headers so book covers load instantaneously
const gbCoverMem = new Map<string, { expires: number; url: string | null }>();
const GB_TTL_MS = 24 * 60 * 60 * 1000;

function httpsImage(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let u = String(raw).trim();
	if (!u) return null;
	if (u.startsWith('http://')) u = `https://${u.slice(7)}`;
	u = u.replace(/zoom=1\b/i, 'zoom=2');
	return u;
}

async function googleBooksCover(title: string, author?: string | null): Promise<string | null> {
	const t = String(title || '').trim();
	if (!t) return null;
	const key = `gb:${norm(t)}:${norm(author || '')}`;
	const hit = gbCoverMem.get(key);
	if (hit && hit.expires > Date.now()) return hit.url;

	const q = author ? `intitle:${t} inauthor:${author}` : `intitle:${t}`;
	const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=3&fields=items(volumeInfo/title,volumeInfo/imageLinks)`;
	try {
		const res = await cachedJsonFetch(url, undefined, { ttlMs: GB_TTL_MS });
		const items: any[] = res.data?.items || [];
		let urlOut: string | null = null;
		const want = norm(t);
		const ranked = [...items].sort((a, b) => {
			const an = norm(String(a?.volumeInfo?.title || ''));
			const bn = norm(String(b?.volumeInfo?.title || ''));
			const as = an === want ? 2 : an.includes(want) || want.includes(an) ? 1 : 0;
			const bs = bn === want ? 2 : bn.includes(want) || want.includes(bn) ? 1 : 0;
			return bs - as;
		});
		for (const it of ranked) {
			const links = it?.volumeInfo?.imageLinks || {};
			urlOut =
				httpsImage(links.extraLarge) ||
				httpsImage(links.large) ||
				httpsImage(links.medium) ||
				httpsImage(links.thumbnail) ||
				httpsImage(links.smallThumbnail);
			if (urlOut) break;
		}
		gbCoverMem.set(key, { expires: Date.now() + GB_TTL_MS, url: urlOut });
		return urlOut;
	} catch (e) {
		console.warn('google books cover flopped', e);
		gbCoverMem.set(key, { expires: Date.now() + 5 * 60 * 1000, url: null });
		return null;
	}
}

function olUrl(doc: any): string | null {
	const key = doc?.key || doc?.seed?.[0];
	if (!key) return null;
	const path = String(key).startsWith('/') ? key : `/${key}`;
	return `https://openlibrary.org${path}`;
}

/** hitting open library here to grab the book data, keeping the limit low so it's fast */
export async function searchOpenLibrary(
	query: string,
	opts?: { limit?: number }
): Promise<{ results: BookSearchResult[]; total: number }> {
	const q = String(query || '').trim();
	if (!q) return { results: [], total: 0 };
	const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 20);

	const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}`;
	try {
		const res = await cachedJsonFetch(url, undefined, { ttlMs: 30 * 60 * 1000 });
		if (!res.ok || !res.data) return { results: [], total: 0 };
		const docs: any[] = res.data.docs || [];
		const total = typeof res.data.numFound === 'number' ? res.data.numFound : docs.length;
		const results: BookSearchResult[] = [];
		for (const d of docs) {
			const title = String(d.title || '').trim();
			if (!title) continue;
			const author = Array.isArray(d.author_name) ? d.author_name[0] : null;
			const year = d.first_publish_year ? String(d.first_publish_year) : null;
			const isManga =
				Array.isArray(d.subject) &&
				d.subject.some((s: string) => /manga|comics|graphic novel/i.test(String(s)));
			results.push({
				id: String(d.key || d.cover_i || title),
				mediaType: isManga ? 'manga' : 'book',
				title,
				subtitle: author,
				posterUrl: coverFromOl(d),
				year,
				rating: null,
				kindLabel: isManga ? 'MANGA' : 'BOOK'
			});
			if (results.length >= limit) break;
		}
		await Promise.all(
			results.map(async (r) => {
				if (r.posterUrl) return;
				r.posterUrl = await googleBooksCover(r.title, r.subtitle);
			})
		);
		return { results, total };
	} catch (e) {
		console.warn('open library search flopped', e);
		return { results: [], total: 0 };
	}
}

async function lookupOpenLibrary(searchQuery: string): Promise<BookHit | null> {
	const { results } = await searchOpenLibrary(searchQuery, { limit: 5 });
	if (!results.length) return null;

	const want = norm(searchQuery);
	let best = results[0];
	let bestScore = -1;
	for (const r of results) {
		const n = norm(r.title);
		let score = 0;
		if (n === want) score += 12;
		else if (n.includes(want) || want.includes(n)) score += 6;
		if (r.posterUrl) score += 2;
		if (score > bestScore) {
			bestScore = score;
			best = r;
		}
	}

	// re-hit search with exact title for richer cover/isbn fields
	const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(best.title)}&limit=3`;
	try {
		const res = await cachedJsonFetch(url, undefined, { ttlMs: 30 * 60 * 1000 });
		const docs: any[] = res.data?.docs || [];
		const doc =
			docs.find((d) => norm(String(d.title || '')) === norm(best.title)) || docs[0] || null;
		if (doc) {
			const isbn = Array.isArray(doc.isbn) ? doc.isbn[0] : null;
			return {
				id: String(doc.key || best.id),
				title: String(doc.title || best.title),
				author: Array.isArray(doc.author_name) ? doc.author_name[0] : best.subtitle,
				year: doc.first_publish_year ? String(doc.first_publish_year) : best.year,
				coverUrl: coverFromOl(doc) || best.posterUrl,
				openLibraryUrl: olUrl(doc),
				isbn: isbn ? String(isbn) : null,
				kind: best.mediaType,
				source: 'openlibrary'
			};
		}
	} catch {
		/* fall through with autocomplete shape */
	}

	return {
		id: best.id,
		title: best.title,
		author: best.subtitle,
		year: best.year,
		coverUrl: best.posterUrl,
		openLibraryUrl: `https://openlibrary.org/search?q=${encodeURIComponent(best.title)}`,
		isbn: null,
		kind: best.mediaType,
		source: 'openlibrary'
	};
}

/** jikan (MAL) — manga covers when open library is being useless */
async function lookupJikanManga(searchQuery: string): Promise<BookHit | null> {
	const q = String(searchQuery || '').trim();
	if (!q) return null;
	const url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=5`;
	try {
		const res = await cachedJsonFetch(url, undefined, { ttlMs: 30 * 60 * 1000 });
		if (!res.ok || !res.data) return null;
		const list: any[] = res.data.data || [];
		if (!list.length) return null;

		const want = norm(q);
		let best = list[0];
		let bestScore = -1;
		for (const m of list) {
			const title = String(m.title || m.title_english || '');
			const n = norm(title);
			let score = 0;
			if (n === want) score += 12;
			else if (n.includes(want) || want.includes(n)) score += 6;
			if (m.images?.jpg?.large_image_url || m.images?.jpg?.image_url) score += 2;
			if (score > bestScore) {
				bestScore = score;
				best = m;
			}
		}

		const title = String(best.title_english || best.title || q);
		const authors = Array.isArray(best.authors)
			? best.authors.map((a: any) => a.name).filter(Boolean)
			: [];
		return {
			id: `jikan-${best.mal_id}`,
			title,
			author: authors[0] || null,
			year: best.published?.prop?.from?.year ? String(best.published.prop.from.year) : null,
			coverUrl: best.images?.jpg?.large_image_url || best.images?.jpg?.image_url || null,
			openLibraryUrl: best.url || `https://myanimelist.net/manga/${best.mal_id}`,
			isbn: null,
			kind: 'manga',
			source: 'jikan'
		};
	} catch (e) {
		console.warn('jikan manga lookup flopped', e);
		return null;
	}
}

/** anilist graphql — last ditch manga cover grab */
async function lookupAniListManga(searchQuery: string): Promise<BookHit | null> {
	const q = String(searchQuery || '').trim();
	if (!q) return null;
	const query = `
		query ($search: String) {
			Media(search: $search, type: MANGA) {
				id
				title { romaji english native }
				coverImage { large extraLarge }
				startDate { year }
				siteUrl
				staff(perPage: 3) {
					edges { role node { name { full } } }
				}
			}
		}
	`;
	try {
		const res = await fetch('https://graphql.anilist.co', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables: { search: q } })
		});
		if (!res.ok) return null;
		const data = await res.json();
		const m = data?.data?.Media;
		if (!m) return null;
		const authorEdge = (m.staff?.edges || []).find((e: any) =>
			/story|art|author|mangaka/i.test(String(e.role || ''))
		);
		return {
			id: `anilist-${m.id}`,
			title: m.title?.english || m.title?.romaji || q,
			author: authorEdge?.node?.name?.full || null,
			year: m.startDate?.year ? String(m.startDate.year) : null,
			coverUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
			openLibraryUrl: m.siteUrl || null,
			isbn: null,
			kind: 'manga',
			source: 'anilist'
		};
	} catch (e) {
		console.warn('anilist manga lookup flopped', e);
		return null;
	}
}

/**
 * Resolve a Gemini book/manga title → cover + link.
 * preferOpenLibrary first; if manga-ish or no cover, try jikan then anilist.
 */
export async function lookupBookOrManga(opts: {
	searchQuery: string;
	title?: string;
	hint?: 'book' | 'manga' | string | null;
}): Promise<BookHit | null> {
	const q = String(opts.searchQuery || opts.title || '').trim();
	if (!q) return null;
	const hint = String(opts.hint || '').toLowerCase();
	const wantsManga = hint.includes('manga') || /\bmanga\b/i.test(q);

	const ol = await lookupOpenLibrary(q);
	if (ol && !ol.coverUrl) {
		ol.coverUrl = await googleBooksCover(ol.title, ol.author);
		if (ol.coverUrl) ol.source = 'googlebooks';
	}
	if (ol?.coverUrl && !wantsManga) return ol;
	if (ol?.coverUrl && wantsManga && ol.kind === 'manga') return ol;

	// open library blanked on manga covers a lot — bounce to jikan / anilist
	const jikan = await lookupJikanManga(q);
	if (jikan?.coverUrl) return jikan;

	const anilist = await lookupAniListManga(q);
	if (anilist?.coverUrl) return anilist;

	return ol || jikan || anilist;
}

export function bookReadLinks(hit: BookHit) {
	const links: { name: string; url: string; logo: string | null }[] = [];
	if (hit.openLibraryUrl) {
		links.push({
			name: hit.source === 'openlibrary' ? 'Open Library' : 'More info',
			url: hit.openLibraryUrl,
			logo: null
		});
	}
	const q = encodeURIComponent(hit.author ? `${hit.title} ${hit.author}` : hit.title);
	links.push({
		name: 'Goodreads',
		url: `https://www.goodreads.com/search?q=${q}`,
		logo: null
	});
	return links;
}
