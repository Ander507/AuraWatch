// TMDB "similar to X" — find a grounded neighbor for a reference title

import { env } from '$env/dynamic/private';
import {
	catalogFormats,
	type MediaFormat,
	type SelectedType,
	type SelectedTypes
} from '$lib/server/catalog';
import { parseSearchQuery, resolveTmdbArtwork, tmdbImageUrl } from '$lib/server/tmdbSearch';
import { tmdbCriticPercent } from '$lib/server/tmdbCriticScore';
import { cachedJsonFetch } from '$lib/server/httpCache';

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
	western: [GENRE.western],
	war: [GENRE.war],
	political: [GENRE.warPolitics],
	medical: [GENRE.drama],
	heist: [GENRE.crime, GENRE.action],
	psychological: [GENRE.thriller, GENRE.mystery, GENRE.drama],
	supernatural: [GENRE.fantasy, GENRE.scifiFantasy, GENRE.horror],
	'slice of life': [GENRE.drama, GENRE.comedy],
	school: [GENRE.drama, GENRE.comedy]
};

/** Strong vibe phrases in free-text notes → TMDB genre ids that picks MUST respect. */
const NOTE_VIBE_RULES: Array<{ re: RegExp; genreIds: number[]; keywords: string[] }> = [
	{
		re: /\b(westerns?|cowboy|cowboys|cowgirl|outlaw|outlaws|gunslinger|saloon|frontier|wild\s*west)\b/i,
		genreIds: [GENRE.western],
		keywords: ['western', 'cowboy', 'outlaw', 'frontier', 'ranch', 'gunslinger']
	},
	{
		re: /\b(horror|scary|ghost|vampire|slasher)\b/i,
		genreIds: [GENRE.horror],
		keywords: ['horror', 'scary', 'terror']
	},
	{
		re: /\b(sci-?fi|science fiction|space opera|cyberpunk)\b/i,
		genreIds: [GENRE.scifi, GENRE.scifiFantasy],
		keywords: ['sci-fi', 'science fiction', 'space', 'cyberpunk']
	},
	{
		re: /\b(rom-?com|romantic comedy)\b/i,
		genreIds: [GENRE.romance, GENRE.comedy],
		keywords: ['romance', 'romantic', 'love']
	},
	{
		re: /\b(heist|caper)\b/i,
		genreIds: [GENRE.crime],
		keywords: ['heist', 'robbery', 'caper']
	}
];

function extractNoteVibes(notes: string): { genreIds: number[]; keywords: string[] } {
	const genreIds = new Set<number>();
	const keywords = new Set<string>();
	const text = notes || '';
	if (!text.trim()) return { genreIds: [], keywords: [] };
	for (const rule of NOTE_VIBE_RULES) {
		if (!rule.re.test(text)) continue;
		for (const id of rule.genreIds) genreIds.add(id);
		for (const k of rule.keywords) keywords.add(k);
	}
	return { genreIds: [...genreIds], keywords: [...keywords] };
}

function hitMatchesVibe(hit: RawHit, vibes: { genreIds: number[]; keywords: string[] }): boolean {
	if (!vibes.genreIds.length && !vibes.keywords.length) return true;
	if (vibes.genreIds.some((id) => hit.genre_ids.includes(id))) return true;
	const blob = `${hit.title} ${hit.overview}`.toLowerCase();
	return vibes.keywords.some((k) => blob.includes(k));
}

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

function tmdbLang(raw?: string | null): string {
	const s = String(raw || '').trim();
	return s || 'en-US';
}

function norm(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export type SimilarPick = {
	id: number;
	mediaType: 'movie' | 'tv';
	title: string;
	posterUrl: string | null;
	fallbackUrls?: string[];
	year: string | null;
	rating: number | null;
	criticScore: number | null;
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
	useBearer: boolean,
	language?: string | null
): Promise<RawHit | null> {
	const { title, year } = parseSearchQuery(query, null);
	if (!title) return null;

	const lang = tmdbLang(language);

	// Always score both movie + TV — prefer only breaks ties. Prevents "TV Series" format
	// from latching onto a weak TV hit for a famous movie like a Western.
	const attempts: Array<'tv' | 'movie'> =
		prefer === 'movie' ? ['movie', 'tv'] : prefer === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];

	const want = norm(title);
	let bestHit: RawHit | null = null;
	let bestScore = -1;

	for (const kind of attempts) {
		const params = new URLSearchParams({
			query: title,
			include_adult: 'false',
			language: lang,
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
			const res = await tmdbJson(url, headers);
			if (!res.ok || !res.data) continue;
			const data = res.data;
			const results: any[] = data?.results || [];
			if (!results.length) continue;

			for (const r of results.slice(0, 10)) {
				const name = String(r.title || r.name || '');
				let score = 0;
				const n = norm(name);
				if (n === want) score += 20;
				else if (n.startsWith(want) || want.startsWith(n)) score += 10;
				else if (n.includes(want) || want.includes(n)) score += 6;
				else continue; // ignore unrelated noise
				const date = r.release_date || r.first_air_date || '';
				if (year && date.startsWith(year)) score += 8;
				if (r.poster_path) score += 2;
				score += Math.min(4, (r.popularity || 0) / 40);
				// slight preference for the user's selected format — never enough to beat a real title match
				if (prefer === kind) score += 1.5;
				if (prefer === 'either' && kind === 'movie') score += 0.25;

				if (score > bestScore) {
					bestScore = score;
					bestHit = {
						id: r.id,
						title: name || title,
						poster_path: r.poster_path || null,
						date: date || '',
						vote_average: typeof r.vote_average === 'number' ? r.vote_average : 0,
						overview: String(r.overview || ''),
						genre_ids: Array.isArray(r.genre_ids) ? r.genre_ids : [],
						origin_country: r.origin_country,
						original_language: r.original_language,
						mediaType: kind
					};
				}
			}
		} catch (e) {
			console.warn('tmdb similar: search fail', kind, e);
		}
	}

	// Require a real title match — popularity-only junk is worse than falling through to Gemini
	if (!bestHit || bestScore < 6) return null;
	return bestHit;
}

async function fetchSimilarList(
	id: number,
	mediaType: 'movie' | 'tv',
	headers: Record<string, string>,
	apiKey: string,
	useBearer: boolean,
	language?: string | null
): Promise<RawHit[]> {
	const lang = tmdbLang(language);
	const url = withKey(
		`https://api.themoviedb.org/3/${mediaType}/${id}/similar?language=${encodeURIComponent(lang)}&page=1`,
		apiKey,
		useBearer
	);

	try {
		const res = await tmdbJson(url, headers);
		if (!res.ok || !res.data) return [];
		const data = res.data;
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
	useBearer: boolean,
	language?: string | null
): Promise<RawHit[]> {
	const lang = tmdbLang(language);
	const url = withKey(
		`https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?language=${encodeURIComponent(lang)}&page=1`,
		apiKey,
		useBearer
	);

	try {
		const res = await tmdbJson(url, headers);
		if (!res.ok || !res.data) return [];
		const data = res.data;
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

function preferMedia(types: MediaFormat[]): 'tv' | 'movie' | 'either' {
	const allow = catalogFormats(types);
	if (!allow.length) return 'either';
	const wantsMovie = allow.includes('movie');
	const wantsTv = allow.includes('series') || allow.includes('anime');
	if (wantsMovie && !wantsTv) return 'movie';
	if (wantsTv && !wantsMovie) return 'tv';
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
		types: MediaFormat[];
		userGenres: string[];
		notes: string;
		excludeIds: Set<number>;
		noteVibes: { genreIds: number[]; keywords: string[] };
		refGenreIds: number[];
	}
): number {
	if (opts.excludeIds.has(hit.id)) return -999;

	// Hard fail: notes said western/cowboy (etc.) and this pick isn't that
	if (!hitMatchesVibe(hit, opts.noteVibes)) return -999;

	let score = hit.vote_average * 1.2;
	if (hit.poster_path) score += 2;
	if (hit.overview) score += 1;

	score += genreOverlapScore(hit, opts.userGenres);

	// Inherit genres from the liked reference (Western movie → western neighbors)
	for (const gid of opts.refGenreIds) {
		if (hit.genre_ids.includes(gid)) score += 5;
	}

	const notes = opts.notes.toLowerCase();
	if (notes) {
		const tokens = notes.split(/[^a-z0-9+]+/).filter((w) => w.length > 3);
		const blob = `${hit.title} ${hit.overview}`.toLowerCase();
		for (const t of tokens) {
			if (blob.includes(t)) score += 2.5;
		}
		for (const k of opts.noteVibes.keywords) {
			if (blob.includes(k)) score += 4;
		}
	}

	const allow = catalogFormats(opts.types);
	if (!allow.length) return score;

	const wantAnime = allow.includes('anime');
	const wantSeries = allow.includes('series');
	const wantMovie = allow.includes('movie');
	const animeHit = looksAnime(hit);

	if (wantAnime) {
		if (animeHit) score += 12;
		else if (hit.genre_ids.includes(GENRE.animation)) score += 4;
		else if (!wantSeries && !wantMovie) score -= 20;
	}

	if (wantSeries || wantAnime) {
		if (hit.mediaType === 'tv') score += 6;
		else if (!wantMovie) score -= 40; // hard: don't return movies when user asked TV only
	}

	if (wantMovie) {
		if (hit.mediaType === 'movie') score += 6;
		else if (!wantSeries && !wantAnime) score -= 40;
	}

	if (wantSeries && !wantAnime && animeHit) score -= 8;

	return score;
}

/**
 * Resolve one or more reference titles on TMDB, merge similar/recommended pools, return top neighbors.
 */
export async function findSimilarPicks(opts: {
	likeTitle?: string;
	likeTitles?: string[];
	type?: SelectedType;
	types?: SelectedTypes;
	userGenres?: string[];
	notes?: string;
	limit?: number;
	yearFrom?: number | null;
	yearTo?: number | null;
	language?: string | null;
}): Promise<SimilarPick[]> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey) return [];

	const language = tmdbLang(opts.language);

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

	const types = catalogFormats(opts.types ?? opts.type);
	const userGenres = opts.userGenres || [];
	const notes = opts.notes || '';
	const noteVibes = extractNoteVibes(notes);
	const prefer = preferMedia(types);
	const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10);
	const yearFrom = opts.yearFrom ?? null;
	const yearTo = opts.yearTo ?? null;

	// Resolve like-titles by best real match (movie OR tv), not by forced format
	const refs = (
		await Promise.all(
			uniqueTitles.map((t) => searchReference(t, 'either', headers, apiKey, useBearer, language))
		)
	).filter((r): r is RawHit => Boolean(r));

	if (!refs.length) return [];

	const refGenreIds = [...new Set(refs.flatMap((r) => r.genre_ids))];

	// Liked a movie but user only wants TV (or vice versa): TMDB similar stays same-media.
	// Bail so Gemini can find Yellowstone / 1883 / etc. from the vibe + like-title.
	const refKinds = new Set(refs.map((r) => r.mediaType));
	if (prefer === 'tv' && !refKinds.has('tv') && refKinds.has('movie')) return [];
	if (prefer === 'movie' && !refKinds.has('movie') && refKinds.has('tv')) return [];

	const excludeIds = new Set(refs.map((r) => r.id));
	const refNames = refs.map((r) => r.title);
	const refNameSet = new Set(refNames.map((n) => n.toLowerCase()));

	const pools = await Promise.all(
		refs.map(async (ref) => {
			const [recs, sims] = await Promise.all([
				fetchRecommendationsList(ref.id, ref.mediaType, headers, apiKey, useBearer, language),
				fetchSimilarList(ref.id, ref.mediaType, headers, apiKey, useBearer, language)
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

	const inDecade = (h: RawHit) => {
		if (yearFrom == null && yearTo == null) return true;
		const y = Number(String(h.date || '').slice(0, 4));
		if (!Number.isFinite(y) || y < 1000) return false;
		if (yearFrom != null && y < yearFrom) return false;
		if (yearTo != null && y > yearTo) return false;
		return true;
	};

	let filtered = pool.filter(inDecade);
	if (noteVibes.genreIds.length || noteVibes.keywords.length) {
		const vibeHits = filtered.filter((h) => hitMatchesVibe(h, noteVibes));
		// If notes demand a vibe and TMDB similar has nothing on-theme, don't return trash
		if (!vibeHits.length) return [];
		filtered = vibeHits;
	}
	if (!filtered.length) filtered = pool;

	const ranked = filtered
		.map((h) => ({
			h,
			score: scoreCandidate(h, {
				types,
				userGenres,
				notes,
				excludeIds,
				noteVibes,
				refGenreIds
			})
		}))
		.filter((x) => x.score > -50 && x.h.vote_average >= 5.5)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);

	// Still nothing credible after format/vibe scoring → Gemini
	if (!ranked.length) return [];

	return Promise.all(
		ranked.map(async ({ h }) => {
			let posterUrl = tmdbImageUrl(h.poster_path, 'w500');
			let fallbackUrls: string[] = [];

			if (!posterUrl) {
				const art = await resolveTmdbArtwork(h.id, h.mediaType, language);
				posterUrl = art.posterUrl;
				fallbackUrls = art.fallbackUrls;
			}

			return {
				id: h.id,
				mediaType: h.mediaType,
				title: h.title,
				posterUrl,
				fallbackUrls,
				year: h.date ? h.date.slice(0, 4) : null,
				rating: h.vote_average || null,
				criticScore: tmdbCriticPercent(h.vote_average),
				overview: h.overview,
				genres: genreNamesFromIds(h.genre_ids),
				referenceTitle: refNames.join(', '),
				referenceTitles: refNames,
				referenceId: refs[0].id
			};
		})
	);
}

/** @deprecated prefer findSimilarPicks — kept for single-pick callers */
export async function findSimilarPick(opts: {
	likeTitle?: string;
	likeTitles?: string[];
	type?: SelectedType;
	types?: SelectedTypes;
	userGenres?: string[];
	notes?: string;
}): Promise<SimilarPick | null> {
	const picks = await findSimilarPicks({ ...opts, limit: 1 });
	return picks[0] || null;
}
