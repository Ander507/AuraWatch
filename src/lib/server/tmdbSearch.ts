// TMDB search — use searchQuery + year so "Charlotte (2015)" ≠ Attack on Titan

import { env } from '$env/dynamic/private';

const POSTER = 'https://image.tmdb.org/t/p/w500';

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

export function parseSearchQuery(searchQuery: string, releaseYear?: string | null) {
	const raw = String(searchQuery || '').trim();
	// "Charlotte (2015)" or "Charlotte 2015"
	const paren = raw.match(/^(.*?)\s*\((\d{4})\)\s*$/);
	if (paren) {
		return { title: paren[1].trim(), year: paren[2] };
	}
	const trailing = raw.match(/^(.*?)\s+(\d{4})\s*$/);
	if (trailing) {
		return { title: trailing[1].trim(), year: trailing[2] };
	}
	const y = releaseYear ? String(releaseYear).slice(0, 4) : null;
	return { title: raw, year: y && /^\d{4}$/.test(y) ? y : null };
}

export type TmdbHit = {
	id: number;
	mediaType: 'movie' | 'tv';
	title: string;
	posterUrl: string | null;
	year: string | null;
	rating: number | null;
};

/**
 * Search TMDB with title + year for accurate poster.
 * Prefers tv for series/anime series, movie for movies.
 */
export async function searchTmdbPoster(opts: {
	searchQuery: string;
	releaseYear?: string | null;
	mediaTypeHint?: string | null; // "TV Series" | "Movie" | "Anime Series"
}): Promise<TmdbHit | null> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey) return null;

	const { title, year } = parseSearchQuery(opts.searchQuery, opts.releaseYear);
	if (!title) return null;

	const hint = String(opts.mediaTypeHint || '').toLowerCase();
	const preferTv = hint.includes('series') || hint.includes('anime') || hint.includes('tv');
	const preferMovie = hint.includes('movie') && !preferTv;

	const attempts: Array<'tv' | 'movie'> = preferMovie
		? ['movie', 'tv']
		: preferTv
			? ['tv', 'movie']
			: ['tv', 'movie'];

	for (const kind of attempts) {
		const params = new URLSearchParams({
			query: title,
			include_adult: 'false',
			language: 'en-US',
			page: '1'
		});
		if (year) {
			if (kind === 'movie') params.set('year', year);
			else params.set('first_air_date_year', year);
		}

		const url = withKey(
			`https://api.themoviedb.org/3/search/${kind}?${params}`,
			apiKey,
			useBearer
		);

		try {
			const res = await fetch(url, { headers });
			if (!res.ok) continue;
			const data = await res.json();
			const results: any[] = data?.results || [];
			if (!results.length) continue;

			// prefer exact-ish title match + year when possible
			const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
			const want = norm(title);

			let best = results[0];
			let bestScore = -1;
			for (const r of results.slice(0, 8)) {
				const name = r.title || r.name || '';
				let score = 0;
				const n = norm(name);
				if (n === want) score += 10;
				else if (n.includes(want) || want.includes(n)) score += 5;
				const date = r.release_date || r.first_air_date || '';
				if (year && date.startsWith(year)) score += 8;
				if (r.poster_path) score += 2;
				if (score > bestScore) {
					bestScore = score;
					best = r;
				}
			}

			const date = best.release_date || best.first_air_date || '';
			return {
				id: best.id,
				mediaType: kind,
				title: best.title || best.name || title,
				posterUrl: best.poster_path ? `${POSTER}${best.poster_path}` : null,
				year: date ? date.slice(0, 4) : year,
				rating: typeof best.vote_average === 'number' ? best.vote_average : null
			};
		} catch (e) {
			console.warn('tmdb search fail', kind, e);
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

const POSTER_SM = 'https://image.tmdb.org/t/p/w92';

/**
 * Multi-search for autocomplete — movies + TV, ranked by popularity.
 */
export async function searchTmdbTitles(
	query: string,
	opts?: { limit?: number }
): Promise<{ results: TmdbSearchResult[]; total: number }> {
	const { apiKey, useBearer, headers } = authHeaders();
	const q = String(query || '').trim();
	if (!apiKey || q.length < 1) return { results: [], total: 0 };

	const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 20);
	const params = new URLSearchParams({
		query: q,
		include_adult: 'false',
		language: 'en-US',
		page: '1'
	});

	const url = withKey(
		`https://api.themoviedb.org/3/search/multi?${params}`,
		apiKey,
		useBearer
	);

	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return { results: [], total: 0 };
		const data = await res.json();
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
				posterUrl: r.poster_path ? `${POSTER_SM}${r.poster_path}` : null,
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
