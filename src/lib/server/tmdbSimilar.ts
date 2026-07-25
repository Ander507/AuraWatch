// TMDB "similar to X" — find a grounded neighbor for a reference title

import { env } from '$env/dynamic/private';
import type { SelectedType } from '$lib/server/catalog';
import { parseSearchQuery } from '$lib/server/tmdbSearch';

const POSTER = 'https://image.tmdb.org/t/p/w500';

/** TMDB genre ids we care about for filtering */
const GENRE = {
	animation: 16,
	comedy: 35,
	drama: 18,
	action: 28,
	adventure: 12,
	crime: 80,
	documentary: 99,
	family: 10751,
	fantasy: 14,
	history: 36,
	horror: 27,
	music: 10402,
	mystery: 9648,
	romance: 10749,
	scifi: 878,
	thriller: 53,
	war: 10752,
	western: 37,
	// TV-ish
	actionAdventure: 10759,
	kids: 10762,
	news: 10763,
	reality: 10764,
	scifiFantasy: 10765,
	soap: 10766,
	talk: 10767,
	warPolitics: 10768
} as const;

const USER_GENRE_TO_TMDB: Record<string, number[]> = {
	action: [GENRE.action, GENRE.actionAdventure],
	adventure: [GENRE.adventure, GENRE.actionAdventure],
	comedy: [GENRE.comedy],
	crime: [GENRE.crime],
	documentary: [GENRE.documentary],
	drama: [GENRE.drama],
	fantasy: [GENRE.fantasy, GENRE.scifiFantasy],
	horror: [GENRE.horror],
	mystery: [GENRE.mystery],
	romance: [GENRE.romance],
	'sci-fi': [GENRE.scifi, GENRE.scifiFantasy],
	scifi: [GENRE.scifi, GENRE.scifiFantasy],
	thriller: [GENRE.thriller],
	political: [GENRE.warPolitics],
	medical: [GENRE.drama],
	heist: [GENRE.crime, GENRE.action],
	psychological: [GENRE.thriller, GENRE.mystery, GENRE.drama],
	supernatural: [GENRE.fantasy, GENRE.scifiFantasy, GENRE.horror],
	'slice of life': [GENRE.drama, GENRE.comedy],
	school: [GENRE.drama, GENRE.comedy]
};

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

function norm(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export type SimilarPick = {
	id: number;
	mediaType: 'movie' | 'tv';
	title: string;
	posterUrl: string | null;
	year: string | null;
	rating: number | null;
	overview: string;
	genres: string[];
	referenceTitle: string;
	referenceTitles: string[];
	referenceId: number;
};

type RawHit = {
	id: number;
	title: string;
	poster_path: string | null;
	date: string;
	vote_average: number;
	overview: string;
	genre_ids: number[];
	origin_country?: string[];
	original_language?: string;
	mediaType: 'movie' | 'tv';
};

async function searchReference(
	query: string,
	prefer: 'tv' | 'movie' | 'either',
	headers: Record<string, string>,
	apiKey: string,
	useBearer: boolean
): Promise<RawHit | null> {
	const { title, year } = parseSearchQuery(query, null);
	if (!title) return null;

	const attempts: Array<'tv' | 'movie'> =
		prefer === 'movie' ? ['movie', 'tv'] : prefer === 'tv' ? ['tv', 'movie'] : ['tv', 'movie'];

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

			const want = norm(title);
			let best = results[0];
			let bestScore = -1;
			for (const r of results.slice(0, 10)) {
				const name = String(r.title || r.name || '');
				let score = 0;
				const n = norm(name);
				if (n === want) score += 12;
				else if (n.includes(want) || want.includes(n)) score += 6;
				const date = r.release_date || r.first_air_date || '';
				if (year && date.startsWith(year)) score += 8;
				if (r.poster_path) score += 2;
				score += Math.min(4, (r.popularity || 0) / 40);
				if (score > bestScore) {
					bestScore = score;
					best = r;
				}
			}

			return {
				id: best.id,
				title: best.title || best.name || title,
				poster_path: best.poster_path || null,
				date: best.release_date || best.first_air_date || '',
				vote_average: typeof best.vote_average === 'number' ? best.vote_average : 0,
				overview: String(best.overview || ''),
				genre_ids: Array.isArray(best.genre_ids) ? best.genre_ids : [],
				origin_country: best.origin_country,
				original_language: best.original_language,
				mediaType: kind
			};
		} catch (e) {
			console.warn('tmdb similar: search fail', kind, e);
		}
	}

	return null;
}

async function fetchSimilarList(
	id: number,
	mediaType: 'movie' | 'tv',
	headers: Record<string, string>,
	apiKey: string,
	useBearer: boolean
): Promise<RawHit[]> {
	const url = withKey(
		`https://api.themoviedb.org/3/${mediaType}/${id}/similar?language=en-US&page=1`,
		apiKey,
		useBearer
	);

	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return [];
		const data = await res.json();
		const results: any[] = data?.results || [];
		return results.slice(0, 20).map((r) => ({
			id: r.id,
			title: r.title || r.name || '???',
			poster_path: r.poster_path || null,
			date: r.release_date || r.first_air_date || '',
			vote_average: typeof r.vote_average === 'number' ? r.vote_average : 0,
			overview: String(r.overview || ''),
			genre_ids: Array.isArray(r.genre_ids) ? r.genre_ids : [],
			origin_country: r.origin_country,
			original_language: r.original_language,
			mediaType
		}));
	} catch (e) {
		console.warn('tmdb similar: list fail', e);
		return [];
	}
}

/** Recommendations endpoint — often better than /similar for "more like this" */
async function fetchRecommendationsList(
	id: number,
	mediaType: 'movie' | 'tv',
	headers: Record<string, string>,
	apiKey: string,
	useBearer: boolean
): Promise<RawHit[]> {
	const url = withKey(
		`https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?language=en-US&page=1`,
		apiKey,
		useBearer
	);

	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return [];
		const data = await res.json();
		const results: any[] = data?.results || [];
		return results.slice(0, 20).map((r) => ({
			id: r.id,
			title: r.title || r.name || '???',
			poster_path: r.poster_path || null,
			date: r.release_date || r.first_air_date || '',
			vote_average: typeof r.vote_average === 'number' ? r.vote_average : 0,
			overview: String(r.overview || ''),
			genre_ids: Array.isArray(r.genre_ids) ? r.genre_ids : [],
			origin_country: r.origin_country,
			original_language: r.original_language,
			mediaType
		}));
	} catch (e) {
		console.warn('tmdb recommendations fail', e);
		return [];
	}
}

function looksAnime(hit: RawHit): boolean {
	const hasAnim = hit.genre_ids.includes(GENRE.animation);
	const jp =
		hit.original_language === 'ja' ||
		(hit.origin_country || []).some((c) => c.toUpperCase() === 'JP');
	return hasAnim && (jp || hit.mediaType === 'tv');
}

function preferMedia(type: SelectedType): 'tv' | 'movie' | 'either' {
	if (type === 'movie') return 'movie';
	if (type === 'series' || type === 'anime') return 'tv';
	return 'either';
}

function genreOverlapScore(hit: RawHit, userGenres: string[]): number {
	if (!userGenres.length) return 0;
	let score = 0;
	for (const g of userGenres) {
		const ids = USER_GENRE_TO_TMDB[g.toLowerCase()] || [];
		if (ids.some((id) => hit.genre_ids.includes(id))) score += 4;
	}
	return score;
}

function genreNamesFromIds(ids: number[]): string[] {
	const map: Record<number, string> = {
		[GENRE.action]: 'Action',
		[GENRE.adventure]: 'Adventure',
		[GENRE.animation]: 'Animation',
		[GENRE.comedy]: 'Comedy',
		[GENRE.crime]: 'Crime',
		[GENRE.documentary]: 'Documentary',
		[GENRE.drama]: 'Drama',
		[GENRE.family]: 'Family',
		[GENRE.fantasy]: 'Fantasy',
		[GENRE.history]: 'History',
		[GENRE.horror]: 'Horror',
		[GENRE.music]: 'Music',
		[GENRE.mystery]: 'Mystery',
		[GENRE.romance]: 'Romance',
		[GENRE.scifi]: 'Sci-Fi',
		[GENRE.thriller]: 'Thriller',
		[GENRE.war]: 'War',
		[GENRE.western]: 'Western',
		[GENRE.actionAdventure]: 'Action',
		[GENRE.kids]: 'Kids',
		[GENRE.scifiFantasy]: 'Sci-Fi',
		[GENRE.warPolitics]: 'Political',
		[GENRE.soap]: 'Drama',
		[GENRE.talk]: 'Talk',
		[GENRE.reality]: 'Reality',
		[GENRE.news]: 'News'
	};
	const out: string[] = [];
	for (const id of ids) {
		const name = map[id];
		if (name && !out.includes(name)) out.push(name);
	}
	return out.slice(0, 5);
}

function scoreCandidate(
	hit: RawHit,
	opts: {
		type: SelectedType;
		userGenres: string[];
		notes: string;
		excludeIds: Set<number>;
	}
): number {
	if (opts.excludeIds.has(hit.id)) return -999;

	let score = hit.vote_average * 1.2;
	if (hit.poster_path) score += 2;
	if (hit.overview) score += 1;

	score += genreOverlapScore(hit, opts.userGenres);

	const notes = opts.notes.toLowerCase();
	if (notes) {
		const tokens = notes.split(/[^a-z0-9+]+/).filter((w) => w.length > 3);
		const blob = `${hit.title} ${hit.overview}`.toLowerCase();
		for (const t of tokens) {
			if (blob.includes(t)) score += 1.5;
		}
	}

	if (opts.type === 'anime') {
		if (looksAnime(hit)) score += 12;
		else if (hit.genre_ids.includes(GENRE.animation)) score += 4;
		else score -= 20;
	} else if (opts.type === 'series') {
		if (hit.mediaType === 'tv') score += 6;
		else score -= 15;
		if (looksAnime(hit)) score -= 8;
	} else if (opts.type === 'movie') {
		if (hit.mediaType === 'movie') score += 6;
		else score -= 15;
	}

	return score;
}

/**
 * Resolve one or more reference titles on TMDB, merge similar/recommended pools, return top neighbors.
 */
export async function findSimilarPicks(opts: {
	likeTitle?: string;
	likeTitles?: string[];
	type?: SelectedType;
	userGenres?: string[];
	notes?: string;
	limit?: number;
}): Promise<SimilarPick[]> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey) return [];

	const titles = [
		...(opts.likeTitles || []),
		...(opts.likeTitle ? [opts.likeTitle] : [])
	]
		.map((t) => String(t || '').trim())
		.filter(Boolean);

	const seenTitle = new Set<string>();
	const uniqueTitles: string[] = [];
	for (const t of titles) {
		const k = t.toLowerCase();
		if (seenTitle.has(k)) continue;
		seenTitle.add(k);
		uniqueTitles.push(t);
	}
	if (!uniqueTitles.length) return [];

	const type = opts.type || 'all';
	const userGenres = opts.userGenres || [];
	const notes = opts.notes || '';
	const prefer = preferMedia(type);
	const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10);

	const refs = (
		await Promise.all(uniqueTitles.map((t) => searchReference(t, prefer, headers, apiKey, useBearer)))
	).filter((r): r is RawHit => Boolean(r));

	if (!refs.length) return [];

	const excludeIds = new Set(refs.map((r) => r.id));
	const refNames = refs.map((r) => r.title);
	const refNameSet = new Set(refNames.map((n) => n.toLowerCase()));

	const pools = await Promise.all(
		refs.map(async (ref) => {
			const [recs, sims] = await Promise.all([
				fetchRecommendationsList(ref.id, ref.mediaType, headers, apiKey, useBearer),
				fetchSimilarList(ref.id, ref.mediaType, headers, apiKey, useBearer)
			]);
			return [...recs, ...sims];
		})
	);

	const seen = new Set<number>();
	const pool: RawHit[] = [];
	for (const list of pools) {
		for (const h of list) {
			if (seen.has(h.id) || excludeIds.has(h.id)) continue;
			if (refNameSet.has(h.title.toLowerCase())) continue;
			seen.add(h.id);
			pool.push(h);
		}
	}

	if (!pool.length) return [];

	const ranked = pool
		.map((h) => ({
			h,
			score: scoreCandidate(h, { type, userGenres, notes, excludeIds })
		}))
		.filter((x) => x.score > -50 && x.h.vote_average >= 5.5)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);

	return ranked.map(({ h }) => ({
		id: h.id,
		mediaType: h.mediaType,
		title: h.title,
		posterUrl: h.poster_path ? `${POSTER}${h.poster_path}` : null,
		year: h.date ? h.date.slice(0, 4) : null,
		rating: h.vote_average || null,
		overview: h.overview,
		genres: genreNamesFromIds(h.genre_ids),
		referenceTitle: refNames.join(', '),
		referenceTitles: refNames,
		referenceId: refs[0].id
	}));
}

/** @deprecated prefer findSimilarPicks — kept for single-pick callers */
export async function findSimilarPick(opts: {
	likeTitle?: string;
	likeTitles?: string[];
	type?: SelectedType;
	userGenres?: string[];
	notes?: string;
}): Promise<SimilarPick | null> {
	const picks = await findSimilarPicks({ ...opts, limit: 1 });
	return picks[0] || null;
}
