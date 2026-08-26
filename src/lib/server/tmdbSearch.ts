// TMDB search — use searchQuery + year so "Charlotte (2015)" ≠ Attack on Titan
// Poster resolution: search → prefer art → /images → backdrop → yearless → multi

import { env } from '$env/dynamic/private';
import { cachedJsonFetch } from '$lib/server/httpCache';
import { tmdbCriticPercent } from '$lib/server/tmdbCriticScore';

const POSTER = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/w780';
const POSTER_SM = 'https://image.tmdb.org/t/p/w92';

function authHeaders(): { headers: Record<string, string>; useBearer: boolean; apiKey: string } {
	const apiKey = env.TMDB_API_KEY || env.TMDB_READ_ACCESS_TOKEN || '';
	const useBearer = apiKey.startsWith('eyJ');
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (useBearer) headers.Authorization = `Bearer ${apiKey}`;
	return { headers, useBearer, apiKey };
}

function withKey(url: string, apiKey: string, useBearer: boolean) {
	if (useBearer || !apiKey) return url;
	const join = url.includes('?') ? '&' : '?';
	return `${url}${join}api_key=${apiKey}`;
}

async function tmdbJson(url: string, headers: Record<string, string>) {
	return cachedJsonFetch(url, { headers }, { ttlMs: 15 * 60 * 1000 });
}

/** TMDB wants en-US style tags; fall back hard to english if someone passes garbage. */
function tmdbLang(raw?: string | null): string {
	const s = String(raw || '').trim();
	return s || 'en-US';
}

export function tmdbImageUrl(
	path: string | null | undefined,
	size: 'w92' | 'w500' | 'w780' = 'w500'
): string | null {
	if (!path) return null;
	const p = path.startsWith('/') ? path : `/${path}`;
	const base = size === 'w92' ? POSTER_SM : size === 'w780' ? BACKDROP : POSTER;
	return `${base}${p}`;
}

/** Strip soundtrack / vibe clutter Gemini sometimes appends to searchQuery. */
function cleanTitleNoise(title: string): string {
	let t = String(title || '').trim();
	// "Drive (2011) featuring Nightcall" / "Cherry — Juice WRLD soundtrack"
	t = t.replace(
		/\s*[-–—:|]\s*(featuring|features|feat\.?|with|soundtrack|ost|needle.?drop|song|music)\b.*$/i,
		''
	);
	t = t.replace(/\s*\((?:featuring|soundtrack|ost|with songs?).*\)$/i, '');
	t = t.replace(/\s+(featuring|features|feat\.?)\s+.+$/i, '');
	return t.trim();
}

export function parseSearchQuery(searchQuery: string, releaseYear?: string | null) {
	const raw = String(searchQuery || '').trim();
	// "Charlotte (2015)" exactly, or "Charlotte (2015) featuring …" (year not only at end)
	const parenEnd = raw.match(/^(.*?)\s*\((\d{4})\)\s*$/);
	if (parenEnd) {
		return { title: cleanTitleNoise(parenEnd[1]), year: parenEnd[2] };
	}
	const parenInline = raw.match(/^(.*?)\s*\((\d{4})\)\s+/);
	if (parenInline) {
		// Keep title before year; ignore trailing soundtrack notes
		return {
			title: cleanTitleNoise(parenInline[1]),
			year: parenInline[2]
		};
	}
	const trailing = raw.match(/^(.*?)\s+(\d{4})\s*$/);
	if (trailing) {
		return { title: cleanTitleNoise(trailing[1]), year: trailing[2] };
	}
	const y = releaseYear ? String(releaseYear).slice(0, 4) : null;
	return {
		title: cleanTitleNoise(raw),
		year: y && /^\d{4}$/.test(y) ? y : null
	};
}

export type TmdbHit = {
	id: number;
	mediaType: 'movie' | 'tv';
	title: string;
	posterUrl: string | null;
	/** Extra image URLs to try if the primary poster 404s or fails to load. */
	fallbackUrls: string[];
	year: string | null;
	rating: number | null;
	/** 0–100 critic-style meter mapped from TMDB vote_average */
	criticScore: number | null;
};

type ScoredResult = {
	id: number;
	mediaType: 'movie' | 'tv';
	title: string;
	poster_path: string | null;
	backdrop_path: string | null;
	year: string | null;
	rating: number | null;
	score: number;
};

function normTitle(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Query variants — subtitles / punctuation often break exact TMDB hits. */
export function titleSearchVariants(title: string): string[] {
	const base = cleanTitleNoise(title);
	if (!base) return [];
	const out: string[] = [];
	const push = (t: string) => {
		const s = t.trim();
		if (!s || out.some((x) => normTitle(x) === normTitle(s))) return;
		out.push(s);
	};
	push(base);
	// "F9: The Fast Saga" → "F9"
	const beforeColon = base.split(/[:–—]/)[0];
	if (beforeColon) push(beforeColon);
	// "The King of Staten Island" → also try without leading The
	push(base.replace(/^the\s+/i, ''));
	// Drop trailing edition tags
	push(base.replace(/\s*[\(:].*$/, ''));
	return out;
}

function uniqueUrls(...urls: Array<string | null | undefined>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const u of urls) {
		if (!u || seen.has(u)) continue;
		seen.add(u);
		out.push(u);
	}
	return out;
}

/**
 * Pull posters / backdrops for a known TMDB id when search returned a hit without art.
 * Also tries external_ids → find (IMDb id) as a last TMDB-side recovery path.
 */
export async function resolveTmdbArtwork(
	id: number,
	mediaType: 'movie' | 'tv',
	language?: string | null
): Promise<{ posterUrl: string | null; fallbackUrls: string[] }> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey || !id) return { posterUrl: null, fallbackUrls: [] };

	const lang = tmdbLang(language);
	const langShort = lang.split('-')[0] || 'en';
	const posters: string[] = [];
	const backdrops: string[] = [];

	try {
		// prefer posters in the user's lang, then untagged, then english
		const imgUrl = withKey(
			`https://api.themoviedb.org/3/${mediaType}/${id}/images?include_image_language=${langShort},en,null`,
			apiKey,
			useBearer
		);
		const imgRes = await tmdbJson(imgUrl, headers);
		if (imgRes.ok && imgRes.data) {
			const data = imgRes.data;
			for (const p of data?.posters || []) {
				const u = tmdbImageUrl(p.file_path, 'w500');
				if (u) posters.push(u);
			}
			for (const b of data?.backdrops || []) {
				const u = tmdbImageUrl(b.file_path, 'w780');
				if (u) backdrops.push(u);
			}
		} else if (imgRes.status === 429) {
			console.warn('tmdb images rate-limited', mediaType, id);
		}
	} catch (e) {
		console.warn('tmdb images fail', mediaType, id, e);
	}

	if (!posters.length) {
		try {
			const detailUrl = withKey(
				`https://api.themoviedb.org/3/${mediaType}/${id}?language=${encodeURIComponent(lang)}`,
				apiKey,
				useBearer
			);
			const detailRes = await tmdbJson(detailUrl, headers);
			if (detailRes.ok && detailRes.data) {
				const d = detailRes.data;
				const p = tmdbImageUrl(d.poster_path, 'w500');
				const b = tmdbImageUrl(d.backdrop_path, 'w780');
				if (p) posters.push(p);
				if (b) backdrops.push(b);
			}
		} catch (e) {
			console.warn('tmdb detail fail', mediaType, id, e);
		}
	}

	// IMDb-assisted recovery via TMDB find (same CDN — no scraping)
	if (!posters.length && !backdrops.length) {
		try {
			const extUrl = withKey(
				`https://api.themoviedb.org/3/${mediaType}/${id}/external_ids`,
				apiKey,
				useBearer
			);
			const extRes = await tmdbJson(extUrl, headers);
			if (extRes.ok && extRes.data) {
				const ext = extRes.data;
				const imdbId = ext?.imdb_id;
				if (imdbId) {
					const findUrl = withKey(
						`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`,
						apiKey,
						useBearer
					);
					const findRes = await tmdbJson(findUrl, headers);
					if (findRes.ok && findRes.data) {
						const found = findRes.data;
						const pool = [
							...(found.movie_results || []),
							...(found.tv_results || [])
						];
						for (const r of pool) {
							const p = tmdbImageUrl(r.poster_path, 'w500');
							const b = tmdbImageUrl(r.backdrop_path, 'w780');
							if (p) posters.push(p);
							if (b) backdrops.push(b);
						}
					}
				}
			}
		} catch (e) {
			console.warn('tmdb imdb-find fail', mediaType, id, e);
		}
	}

	const all = uniqueUrls(...posters, ...backdrops);
	return {
		posterUrl: all[0] || null,
		fallbackUrls: all.slice(1)
	};
}

async function searchKindResults(opts: {
	title: string;
	year: string | null;
	kind: 'movie' | 'tv';
	apiKey: string;
	useBearer: boolean;
	headers: Record<string, string>;
	language?: string | null;
}): Promise<ScoredResult[]> {
	const { title, year, kind, apiKey, useBearer, headers } = opts;
	const params = new URLSearchParams({
		query: title,
		include_adult: 'false',
		// hit tmdb for the posters. passing the lang code here so it doesn't default to english
		language: tmdbLang(opts.language),
		page: '1'
	});
	if (year) {
		if (kind === 'movie') params.set('year', year);
		else params.set('first_air_date_year', year);
	}

	const url = withKey(`https://api.themoviedb.org/3/search/${kind}?${params}`, apiKey, useBearer);
	let res = await tmdbJson(url, headers);
	// One soft retry on rate-limit (common when enriching 5 picks in parallel)
	if (res.status === 429) {
		await new Promise((r) => setTimeout(r, 280));
		res = await tmdbJson(url, headers);
	}
	if (!res.ok || !res.data) return [];
	const data = res.data;
	const results: any[] = data?.results || [];
	if (!results.length) return [];

	const want = normTitle(title);
	const scored: ScoredResult[] = [];

	for (const r of results.slice(0, 10)) {
		const name = String(r.title || r.name || '');
		let score = 0;
		const n = normTitle(name);
		if (n === want) score += 10;
		else if (n.includes(want) || want.includes(n)) score += 5;
		const date = r.release_date || r.first_air_date || '';
		if (year && String(date).startsWith(year)) score += 8;
		if (r.poster_path) score += 3;
		if (r.backdrop_path) score += 1;
		scored.push({
			id: r.id,
			mediaType: kind,
			title: name || title,
			poster_path: r.poster_path || null,
			backdrop_path: r.backdrop_path || null,
			year: date ? String(date).slice(0, 4) : year,
			rating: typeof r.vote_average === 'number' ? r.vote_average : null,
			score
		});
	}

	scored.sort((a, b) => b.score - a.score);
	return scored;
}

function pickBestWithArt(candidates: ScoredResult[]): ScoredResult | null {
	if (!candidates.length) return null;
	const top = candidates[0];
	// Prefer a near-tied hit that actually has a poster (e.g. wrong yearless doc vs TV show)
	const withPoster = candidates.find(
		(c) => c.poster_path && c.score >= top.score - 3
	);
	return withPoster || top;
}

function urlsFromHit(hit: ScoredResult, extras: string[] = []): {
	posterUrl: string | null;
	fallbackUrls: string[];
} {
	const primary = tmdbImageUrl(hit.poster_path, 'w500');
	const backdrop = tmdbImageUrl(hit.backdrop_path, 'w780');
	const all = uniqueUrls(primary, backdrop, ...extras);
	return {
		posterUrl: all[0] || null,
		fallbackUrls: all.slice(1)
	};
}

async function enrichHitArt(hit: ScoredResult, language?: string | null): Promise<TmdbHit> {
	let { posterUrl, fallbackUrls } = urlsFromHit(hit);

	// Only hit /images + IMDb find when search returned no usable art
	if (!posterUrl) {
		const art = await resolveTmdbArtwork(hit.id, hit.mediaType, language);
		const merged = uniqueUrls(art.posterUrl, ...art.fallbackUrls, ...fallbackUrls);
		posterUrl = merged[0] || null;
		fallbackUrls = merged.slice(1);
	}

	return {
		id: hit.id,
		mediaType: hit.mediaType,
		title: hit.title,
		posterUrl,
		fallbackUrls,
		year: hit.year,
		rating: hit.rating,
		criticScore: tmdbCriticPercent(hit.rating)
	};
}

/**
 * Search TMDB with title + year for accurate poster.
 * Prefers tv for series/anime series, movie for movies.
 * Recovers missing posters via alt candidates, /images, backdrop, yearless retry, multi-search, IMDb find.
 */
export async function searchTmdbPoster(opts: {
	searchQuery: string;
	releaseYear?: string | null;
	/** Bare title fallback when searchQuery is noisy (soundtrack notes, etc.) */
	titleFallback?: string | null;
	mediaTypeHint?: string | null; // "TV Series" | "Movie" | "Anime Series"
	/** TMDB language tag e.g. es-ES — titles/overviews come back localized */
	language?: string | null;
}): Promise<TmdbHit | null> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey) return null;

	const language = tmdbLang(opts.language);
	const parsed = parseSearchQuery(opts.searchQuery, opts.releaseYear);
	const fallbackTitle = cleanTitleNoise(String(opts.titleFallback || ''));
	const year =
		parsed.year ||
		(opts.releaseYear && /^\d{4}$/.test(String(opts.releaseYear).slice(0, 4))
			? String(opts.releaseYear).slice(0, 4)
			: null);

	const variants = titleSearchVariants(parsed.title || fallbackTitle);
	if (fallbackTitle) {
		for (const v of titleSearchVariants(fallbackTitle)) {
			if (!variants.some((x) => normTitle(x) === normTitle(v))) variants.push(v);
		}
	}
	if (!variants.length) return null;

	const hint = String(opts.mediaTypeHint || '').toLowerCase();
	const preferTv = hint.includes('series') || hint.includes('anime') || hint.includes('tv');
	const preferMovie =
		(hint.includes('movie') || hint.includes('film')) && !preferTv;

	// Default movie-first — TV-first was orphaning common film posters
	const attempts: Array<'tv' | 'movie'> = preferTv
		? ['tv', 'movie']
		: ['movie', 'tv'];

	const yearPasses: Array<string | null> = year ? [year, null] : [null];

	for (const title of variants) {
		for (const yearFilter of yearPasses) {
			for (const kind of attempts) {
				try {
					const scored = await searchKindResults({
						title,
						year: yearFilter,
						kind,
						apiKey,
						useBearer,
						headers,
						language
					});
					if (!scored.length) continue;

					const best = pickBestWithArt(scored);
					if (!best) continue;

					// Collect sibling posters as client-side fallbacks
					const siblingPosters = scored
						.filter((c) => c.id !== best.id && c.poster_path)
						.slice(0, 3)
						.map((c) => tmdbImageUrl(c.poster_path, 'w500'));

					const hit = await enrichHitArt(best, language);
					hit.fallbackUrls = uniqueUrls(...hit.fallbackUrls, ...siblingPosters);

					// If we still have no art, try the next candidate with a poster
					if (!hit.posterUrl) {
						const alt = scored.find((c) => c.id !== best.id && c.poster_path);
						if (alt) {
							const altHit = await enrichHitArt(alt, language);
							if (altHit.posterUrl) return altHit;
						}
						continue;
					}

					return hit;
				} catch (e) {
					console.warn('tmdb search fail', kind, e);
				}
			}
		}
	}

	// Last resort: multi-search (catches odd title formatting)
	for (const title of variants.slice(0, 2)) {
		try {
			const params = new URLSearchParams({
				query: title,
				include_adult: 'false',
				language,
				page: '1'
			});
			const url = withKey(
				`https://api.themoviedb.org/3/search/multi?${params}`,
				apiKey,
				useBearer
			);
			const res = await tmdbJson(url, headers);
			if (res.ok && res.data) {
				const data = res.data;
				const want = normTitle(title);
				const raw: any[] = data?.results || [];
				const scored: ScoredResult[] = [];
				for (const r of raw.slice(0, 12)) {
					if (r.media_type !== 'movie' && r.media_type !== 'tv') continue;
					const name = String(r.title || r.name || '');
					let score = 0;
					const n = normTitle(name);
					if (n === want) score += 10;
					else if (n.includes(want) || want.includes(n)) score += 5;
					if (year) {
						const date = r.release_date || r.first_air_date || '';
						if (String(date).startsWith(year)) score += 8;
					}
					if (r.poster_path) score += 5; // strongly prefer hits with art
					scored.push({
						id: r.id,
						mediaType: r.media_type,
						title: name || title,
						poster_path: r.poster_path || null,
						backdrop_path: r.backdrop_path || null,
						year: (r.release_date || r.first_air_date || '').slice(0, 4) || year,
						rating: typeof r.vote_average === 'number' ? r.vote_average : null,
						score
					});
				}
				scored.sort((a, b) => b.score - a.score);
				const best = pickBestWithArt(scored);
				if (best) {
					const hit = await enrichHitArt(best, language);
					if (hit.posterUrl) return hit;
				}
			}
		} catch (e) {
			console.warn('tmdb multi poster fail', e);
		}
	}

	return null;
}

export type TmdbSearchResult = {
	id: number;
	mediaType: 'movie' | 'tv';
	title: string;
	posterUrl: string | null;
	year: string | null;
	rating: number | null;
	kindLabel: 'MOVIE' | 'TV';
};

/**
 * Multi-search for autocomplete — movies + TV, ranked by popularity.
 */
export async function searchTmdbTitles(
	query: string,
	opts?: { limit?: number; language?: string | null }
): Promise<{ results: TmdbSearchResult[]; total: number }> {
	const { apiKey, useBearer, headers } = authHeaders();
	const q = String(query || '').trim();
	if (!apiKey || q.length < 1) return { results: [], total: 0 };

	const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 20);
	const params = new URLSearchParams({
		query: q,
		include_adult: 'false',
		language: tmdbLang(opts?.language),
		page: '1'
	});

	const url = withKey(
		`https://api.themoviedb.org/3/search/multi?${params}`,
		apiKey,
		useBearer
	);

	try {
		const res = await tmdbJson(url, headers);
		if (!res.ok || !res.data) return { results: [], total: 0 };
		const data = res.data;
		const raw: any[] = data?.results || [];
		const total = typeof data?.total_results === 'number' ? data.total_results : raw.length;

		const mapped: TmdbSearchResult[] = [];
		for (const r of raw) {
			const mt = r.media_type;
			if (mt !== 'movie' && mt !== 'tv') continue;
			const title = String(r.title || r.name || '').trim();
			if (!title) continue;
			const date = r.release_date || r.first_air_date || '';
			mapped.push({
				id: r.id,
				mediaType: mt,
				title,
				posterUrl: tmdbImageUrl(r.poster_path, 'w92'),
				year: date ? String(date).slice(0, 4) : null,
				rating: typeof r.vote_average === 'number' ? r.vote_average : null,
				kindLabel: mt === 'movie' ? 'MOVIE' : 'TV'
			});
			if (mapped.length >= limit) break;
		}

		return { results: mapped, total };
	} catch (e) {
		console.warn('tmdb multi search fail', e);
		return { results: [], total: 0 };
	}
}
