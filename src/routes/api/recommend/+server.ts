import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callGeminiFlash, howManyKeysWeGot } from '$lib/server/geminiRotator';
import { fetchWatchProviders } from '$lib/server/tmdbProviders';
import { searchTmdbPoster } from '$lib/server/tmdbSearch';
import { findSimilarPicks } from '$lib/server/tmdbSimilar';
import { cleanLikeTitle, parseLikeTitle, stripLikeClause } from '$lib/server/likeTitle';
import { getZflixUrl } from '$lib/watchLinks';
import { normalizeRegion } from '$lib/regions';
import { lookupItunesTrack, songListenLinks } from '$lib/server/itunesSearch';
import {
	kindLabel,
	pickManyFromCatalog,
	seasonInfo,
	type SelectedType
} from '$lib/server/catalog';

const REC_LIMIT = 5;

type GeminiRec = {
	title: string;
	releaseYear: string;
	mediaType: string;
	actualGenres: string[];
	matchReason: string;
	searchQuery: string;
};

function stripJsonFences(raw: string) {
	// gemini loves ```json wrappers for some reason
	let s = (raw || '').trim();
	if (s.startsWith('```')) {
		s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
	}
	const a = s.search(/[\[{]/);
	const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
	if (a !== -1 && b > a) s = s.slice(a, b + 1);
	return s;
}

// gemini json is haunted. we try a few times before giving up
function repairJsonText(raw: string): string {
	let s = stripJsonFences(raw);
	// curly quotes from copy-paste brains
	s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
	s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
	s = s.replace(/,\s*([}\]])/g, '$1'); // trailing commas my beloved
	return s;
}

function safeParseJson(raw: string): any {
	const tries = [repairJsonText(raw), stripJsonFences(raw), (raw || '').trim()];
	let lastErr: any = null;
	for (const t of tries) {
		if (!t) continue;
		try {
			return JSON.parse(t);
		} catch (e) {
			lastErr = e;
		}
	}
	// one more slap
	try {
		return JSON.parse(repairJsonText(raw).replace(/^\uFEFF/, '').replace(/,\s*([}\]])/g, '$1'));
	} catch {
		/* nah */
	}
	throw lastErr || new Error('model spat out unparseable junk');
}

function normalizeType(raw: any): SelectedType {
	const t = String(raw || 'all').toLowerCase().trim();
	if (t === 'movie' || t === 'movies' || t === 'film') return 'movie';
	if (t === 'series' || t === 'tv' || t === 'show' || t === 'shows') return 'series';
	if (t === 'anime') return 'anime';
	if (t === 'song' || t === 'songs' || t === 'music' || t === 'track') return 'songs';
	return 'all';
}

function formatLabel(type: SelectedType) {
	if (type === 'movie') return 'movie';
	if (type === 'series') return 'series';
	if (type === 'anime') return 'anime';
	if (type === 'songs') return 'songs';
	return 'all';
}

function buildMusicConciergePrompt(opts: {
	genres: string[];
	prompt: string;
	likeTitles?: string[];
}) {
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');

	let likeBlock = '';
	if (likes.length) {
		likeBlock = `
- Similar-to songs/artists (HARD): ${likes.map((t) => `'${t}'`).join(', ')}
  Recommend DIFFERENT songs in the same vibe/era/energy. Never return those exact tracks.`;
	}

	// keep the prompt strict or gemini invents fake b-sides
	return `
You are an expert music recommender (songs, not albums-as-products — pick specific tracks).
USER INPUT:
- Genres: ${genres}
- Vibe/Prompt: '${prompt}'${likeBlock}

STRICT RULES:
1. Return real, searchable song titles with correct artist names.
2. Prefer well-known enough tracks that Apple Music / Spotify search will find them.
3. Diversity: don't recommend 5 songs by the same artist unless vibes demand it.
4. NO THIRD PERSON in matchReason — speak to the user.
5. searchQuery MUST be "Artist - Song Title" for lookup.
${likes.length ? `6. SIMILAR-TO: neighbors of ${likeLabel}, not those tracks themselves.` : ''}

RESPONSE JSON FORMAT:
{
  "recommendations": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "releaseYear": "YYYY",
      "actualGenres": ["Genre"],
      "matchReason": "Direct, 2-sentence pitch.",
      "searchQuery": "Artist - Song Title"
    }
  ]
}

Return exactly ${REC_LIMIT} distinct songs, best match first.
Output ONLY valid JSON. No markdown fences, no trailing commas, no comments.
`.trim();
}

type GeminiSongRec = {
	title: string;
	artist: string;
	releaseYear: string;
	actualGenres: string[];
	matchReason: string;
	searchQuery: string;
};

function parseGeminiSongRecs(raw: string): GeminiSongRec[] {
	const parsed = safeParseJson(raw);
	let list: any[] = [];
	if (Array.isArray(parsed?.recommendations)) list = parsed.recommendations;
	else if (Array.isArray(parsed)) list = parsed;
	else if (parsed?.title) list = [parsed];

	const out: GeminiSongRec[] = [];
	const seen = new Set<string>();

	for (const item of list) {
		const title = String(item?.title || '').trim();
		const artist = String(item?.artist || item?.artists || '').trim();
		if (!title || !artist) continue;

		const key = (artist + '::' + title).toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);

		let genres: string[] = [];
		if (Array.isArray(item?.actualGenres)) {
			genres = item.actualGenres.map((g: any) => String(g)).filter(Boolean);
		} else if (Array.isArray(item?.genres)) {
			genres = item.genres.map((g: any) => String(g)).filter(Boolean);
		}

		out.push({
			title,
			artist,
			releaseYear: String(item?.releaseYear || item?.year || '').trim().slice(0, 4),
			actualGenres: genres,
			matchReason: String(item?.matchReason || item?.pitch || '').trim(),
			searchQuery: String(item?.searchQuery || '').trim() || artist + ' - ' + title
		});
		if (out.length >= REC_LIMIT) break;
	}
	return out;
}

function buildConciergePrompt(opts: {
	type: SelectedType;
	genres: string[];
	prompt: string;
	likeTitles?: string[];
}) {
	const type = formatLabel(opts.type);
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');

	const likeBlock = likes.length
		? `
- Similar-to titles (HARD): ${likes.map((t) => `'${t}'`).join(', ')}
  You MUST recommend a DIFFERENT title that feels like these references (tone, structure, audience).
  NEVER return any of: ${likes.map((t) => `'${t}'`).join(', ')}. Prefer lesser-known neighbors over the usual top-10 lists.`
		: '';

	return `
You are an expert TV/Movie/Anime concierge.
USER INPUT: 
- Format: ${type} 
- Required Genres: ${genres}
- Vibe/Prompt: '${prompt}'${likeBlock}

CHAIN OF THOUGHT (do this silently before answering — do not output the reasoning):
1. List hard constraints from Format + Required Genres + Vibe/Prompt${likes.length ? ' + Similar-to titles' : ''}.
2. Reject any title that fails a hard constraint (wrong format, wrong length, no thematic fit${likes.length ? `, or is one of the reference titles` : ''}).
3. OVERRIDE POPULARITY BIAS before picking — popular defaults are guilty until proven perfect.
${likes.length ? `4. If Similar-to is set, prioritize thematic neighbors of those titles (same vibe/energy), not sequels of them.` : ''}

STRICT RULES:
1. OVERRIDE POPULARITY BIAS: Do not default to Breaking Bad, Game of Thrones, or Naruto unless they perfectly match the Vibe/Prompt. 
2. MATCHING: If the user asks for 'Police, 911' and 'Romance', you MUST return a show centered on first responders with romantic subplots (e.g., 'The Rookie', '9-1-1', 'Castle'). 
3. NO THIRD PERSON: Write the 'matchReason' directly to the user (e.g., 'Because you wanted a police show with romance...'). Never say 'The user is looking for...'.
4. actualGenres must be the title's REAL genres — never parrot Required Genres if the show does not have them.
5. searchQuery MUST be "Exact Title (YYYY)" so poster search is unambiguous (e.g. "Charlotte (2015)" not just "Charlotte").
6. Respect Format: anime + "1 season"/episodes → Anime Series (not anime movie). series → TV Series. movie → Movie.
${likes.length ? `7. SIMILAR-TO: Recommend titles LIKE ${likeLabel}, not those titles themselves. Say why each scratches the same itch in matchReason.` : ''}

RESPONSE JSON FORMAT:
{
  "recommendations": [
    {
      "title": "Exact Title",
      "releaseYear": "YYYY",
      "mediaType": "TV Series",
      "actualGenres": ["Real Genre 1", "Real Genre 2"],
      "matchReason": "Direct, 2-sentence pitch.",
      "searchQuery": "Exact Title (YYYY) for accurate poster search"
    }
  ]
}

Return exactly ${REC_LIMIT} distinct recommendations, best match first.
Output ONLY valid JSON. No markdown fences, no trailing commas, no comments. mediaType must be one of: "TV Series", "Movie", "Anime Series".
`.trim();
}

function mediaLabelFromTmdb(mediaType: 'movie' | 'tv', selectedType: SelectedType): string {
	if (selectedType === 'anime') return 'Anime Series';
	if (mediaType === 'movie') return 'Movie';
	return 'TV Series';
}

function pitchForSimilar(opts: {
	pickTitle: string;
	referenceTitles: string[];
	overview: string;
	notes: string;
}): string {
	const refs =
		opts.referenceTitles.length <= 2
			? opts.referenceTitles.join(' and ')
			: `${opts.referenceTitles.slice(0, -1).join(', ')}, and ${opts.referenceTitles.at(-1)}`;
	const noteBit = opts.notes ? ` Plus you mentioned “${opts.notes.slice(0, 60)}”.` : '';
	const overviewBit = opts.overview
		? ` ${opts.overview.replace(/\s+/g, ' ').trim().slice(0, 160)}${opts.overview.length > 160 ? '…' : ''}`
		: '';
	return `If you liked ${refs}, try ${opts.pickTitle}.${noteBit}${overviewBit}`.trim();
}

function parseGeminiRec(raw: string | Record<string, any>): GeminiRec {
	const parsed =
		typeof raw === 'object' && raw !== null
			? raw
			: safeParseJson(String(raw));
	const title = String(parsed.title || '').trim();
	if (!title) throw new Error('gemini returned empty title');

	const releaseYear = String(parsed.releaseYear || '')
		.trim()
		.slice(0, 4);
	const searchQuery =
		String(parsed.searchQuery || '').trim() ||
		(releaseYear ? `${title} (${releaseYear})` : title);

	return {
		title,
		releaseYear,
		mediaType: String(parsed.mediaType || 'TV Series').trim(),
		actualGenres: Array.isArray(parsed.actualGenres)
			? parsed.actualGenres.map((g: any) => String(g)).filter(Boolean)
			: [],
		matchReason: String(parsed.matchReason || '').trim(),
		searchQuery
	};
}

function parseGeminiRecs(raw: string): GeminiRec[] {
	const parsed = safeParseJson(raw);
	const list = Array.isArray(parsed?.recommendations)
		? parsed.recommendations
		: Array.isArray(parsed)
			? parsed
			: parsed?.title
				? [parsed]
				: [];

	const out: GeminiRec[] = [];
	const seen = new Set<string>();
	for (const item of list) {
		try {
			const rec = parseGeminiRec(item);
			const key = rec.title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(rec);
			if (out.length >= REC_LIMIT) break;
		} catch {
			/* skip bad row */
		}
	}
	return out;
}

function mediaTypeToTmdb(mediaType: string): 'movie' | 'tv' {
	const m = mediaType.toLowerCase();
	if (m.includes('movie') && !m.includes('series')) return 'movie';
	return 'tv';
}

export const POST: RequestHandler = async ({ request }) => {
	let body: any = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'need json body');
	}

	const selectedType = normalizeType(body.type);
	const selectedGenres: string[] = Array.isArray(body.genres)
		? body.genres.map((g: any) => String(g).trim()).filter(Boolean)
		: [];
	const vibePrompt = (body.prompt || body.vibe || body.text || '').toString().trim();
	const region = normalizeRegion(body.region);

	const likeTitlesRaw: string[] = [];
	if (Array.isArray(body.likeTitles)) {
		for (const t of body.likeTitles) likeTitlesRaw.push(String(t));
	}
	if (Array.isArray(body.likes)) {
		for (const t of body.likes) likeTitlesRaw.push(String(t));
	}
	const singleLike = (body.likeTitle || body.like || '').toString();
	if (singleLike.trim()) likeTitlesRaw.push(singleLike);

	const likeTitles: string[] = [];
	const likeSeen = new Set<string>();
	for (const raw of likeTitlesRaw) {
		const cleaned = cleanLikeTitle(raw);
		if (!cleaned) continue;
		const key = cleaned.toLowerCase();
		if (likeSeen.has(key)) continue;
		likeSeen.add(key);
		likeTitles.push(cleaned);
	}

	const parsedFromPrompt = parseLikeTitle(vibePrompt);
	if (parsedFromPrompt && !likeSeen.has(parsedFromPrompt.toLowerCase())) {
		likeTitles.push(parsedFromPrompt);
	}

	const likeTitle = likeTitles[0] || null;
	const likeLabel = likeTitles.join(', ');
	const notesOnly = stripLikeClause(vibePrompt, likeTitle);

	if (!vibePrompt && !likeTitles.length && !selectedGenres.length && selectedType === 'all') {
		throw error(400, 'pick a type, some genres, a like-title, or type a vibe prompt');
	}

	// songs = gemini picks tracks, itunes fills covers/links. messy but works
	if (selectedType === 'songs') {
		if (howManyKeysWeGot() <= 0) {
			throw error(503, 'song recommendations need GEMINI_API_KEYS configured');
		}

		const musicPrompt = buildMusicConciergePrompt({
			genres: selectedGenres,
			prompt: [notesOnly, likeTitles.length ? `like ${likeLabel}` : '']
				.filter(Boolean)
				.join(' — '),
			likeTitles
		});

		try {
			// json mode + fat token budget (3072) last time it truncated mid-object lol
			const gemini = await callGeminiFlash(musicPrompt, { json: true, maxOutputTokens: 3072 });
			let songRecs: GeminiSongRec[];
			try {
				songRecs = parseGeminiSongRecs(gemini.text);
			} catch (parseErr: any) {
				console.error('song json go boom', parseErr?.message || parseErr, String(gemini.text || '').slice(0, 400));
				throw new Error('music model returned bad JSON — try again');
			}
			if (!songRecs.length) throw new Error('gemini returned no songs');

			const recommendations = [];
			for (const rec of songRecs) {
				const track = await lookupItunesTrack(rec.searchQuery);
				const artist = track?.artist || rec.artist;
				const title = track?.title || rec.title;
				const listen = songListenLinks({ title, artist, appleUrl: track?.appleUrl });

				// reuse providers[] so the UI watch row Just Works™ for listen links
				recommendations.push({
					title,
					artist,
					cover: track?.cover || '',
					genres: rec.actualGenres.length
						? rec.actualGenres
						: track?.album
							? [track.album]
							: [],
					pitch: rec.matchReason,
					mediaType: 'Song',
					seasonInfo: rec.releaseYear || track?.year || undefined,
					rating: undefined,
					releaseYear: rec.releaseYear || track?.year || undefined,
					searchQuery: rec.searchQuery,
					region: undefined,
					providers: listen.map((l) => ({ name: l.name, logo: null, url: l.url })),
					zflix_url: listen[0]?.url, // not zflix. dont ask.
					listen_url: track?.appleUrl || listen[0]?.url,
					preview_url: track?.previewUrl || undefined,
					likeTitle: likeLabel || undefined,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					kind: 'song' as const
				});
			}

			return json({
				ok: true,
				mocked: false,
				mode: 'songs',
				params: {
					type: selectedType,
					userGenres: selectedGenres,
					prompt: vibePrompt,
					likeTitles: likeTitles.length ? likeTitles : undefined
				},
				recommendation: recommendations[0],
				recommendations
			});
		} catch (e: any) {
			console.error('song recommend failed', e?.message || e);
			throw error(502, e?.message || 'song recommendation failed');
		}
	}

	// —— Similar-to path: TMDB recommendations/similar for "like Charlotte" / TED ——
	if (likeTitles.length) {
		try {
			const similars = await findSimilarPicks({
				likeTitles,
				type: selectedType,
				userGenres: selectedGenres,
				notes: notesOnly,
				limit: REC_LIMIT
			});

			if (similars.length) {
				const recommendations = await Promise.all(
					similars.map(async (similar) => {
						const watch = await fetchWatchProviders({
							tmdbId: similar.id,
							mediaType: similar.mediaType,
							region
						});
						const mediaType = mediaLabelFromTmdb(similar.mediaType, selectedType);
						const searchQuery = similar.year
							? `${similar.title} (${similar.year})`
							: similar.title;
						return {
							title: similar.title,
							cover: similar.posterUrl || '',
							genres: similar.genres,
							pitch: pitchForSimilar({
								pickTitle: similar.title,
								referenceTitles: similar.referenceTitles,
								overview: similar.overview,
								notes: notesOnly
							}),
							mediaType,
							seasonInfo: similar.year ? String(similar.year) : undefined,
							rating: similar.rating ?? undefined,
							releaseYear: similar.year || undefined,
							searchQuery,
							tmdb_id: similar.id,
							media_type: selectedType === 'all' ? undefined : selectedType,
							region: watch.region,
							providers: watch.providers,
							zflix_url: getZflixUrl(similar.title),
							likeTitle: similar.referenceTitle,
							likeTitles: similar.referenceTitles
						};
					})
				);

				return json({
					ok: true,
					mocked: false,
					mode: 'similar',
					params: {
						type: selectedType,
						userGenres: selectedGenres,
						prompt: vibePrompt,
						likeTitles: similars[0].referenceTitles,
						likeTitle: similars[0].referenceTitle
					},
					recommendation: recommendations[0],
					recommendations
				});
			}
		} catch (e: any) {
			console.error('similar-to path failed, continuing', e?.message || e);
		}
	}

	const conciergePromptText = [
		notesOnly,
		likeTitles.length ? `like ${likeLabel}` : ''
	]
		.filter(Boolean)
		.join(' — ');

	// —— Gemini path: full concierge pick + TMDB poster via searchQuery ——
	if (howManyKeysWeGot() > 0) {
		try {
			const prompt = buildConciergePrompt({
				type: selectedType,
				genres: selectedGenres,
				prompt: conciergePromptText || vibePrompt,
				likeTitles
			});
			const gemini = await callGeminiFlash(prompt, { json: true, maxOutputTokens: 3072 });
			const recs = parseGeminiRecs(gemini.text);
			if (!recs.length) throw new Error('gemini returned no recommendations');

			const recommendations = await Promise.all(
				recs.map(async (rec) => {
					const tmdb = await searchTmdbPoster({
						searchQuery: rec.searchQuery,
						releaseYear: rec.releaseYear,
						mediaTypeHint: rec.mediaType
					});
					const tmdbId = tmdb?.id ?? 0;
					const tmdbKind = tmdb?.mediaType ?? mediaTypeToTmdb(rec.mediaType);
					const watch =
						tmdbId > 0
							? await fetchWatchProviders({
									tmdbId,
									mediaType: tmdbKind,
									region
								})
							: { region, providers: [], justWatchLink: null };

					return {
						title: rec.title,
						cover: tmdb?.posterUrl || '',
						genres: rec.actualGenres,
						pitch: rec.matchReason,
						mediaType: rec.mediaType,
						seasonInfo: rec.releaseYear ? String(rec.releaseYear) : undefined,
						rating: tmdb?.rating ?? undefined,
						releaseYear: rec.releaseYear,
						searchQuery: rec.searchQuery,
						tmdb_id: tmdbId || undefined,
						media_type: selectedType === 'all' ? undefined : selectedType,
						region: watch.region,
						providers: watch.providers,
						zflix_url: getZflixUrl(rec.title),
						likeTitle: likeLabel || undefined,
						likeTitles: likeTitles.length ? likeTitles : undefined
					};
				})
			);

			return json({
				ok: true,
				mocked: false,
				mode: likeTitles.length ? 'gemini-like' : 'gemini',
				params: {
					type: selectedType,
					userGenres: selectedGenres,
					prompt: vibePrompt,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					likeTitle: likeTitle || undefined
				},
				recommendation: recommendations[0],
				recommendations
			});
		} catch (e: any) {
			console.error('gemini concierge failed, catalog fallback', e?.message || e);
			// fall through to catalog
		}
	}

	// —— Fallback: local catalog (no keys / gemini error) ——
	const catalogPrompt = conciergePromptText || vibePrompt;
	const hits = pickManyFromCatalog(
		{
			type: selectedType,
			userGenres: selectedGenres,
			prompt: catalogPrompt,
			intent: {
				wantsSeries: /\b(1\s*season|episodes?|series)\b/i.test(catalogPrompt) ? true : null,
				wantsMovie: /\b(movie|film)\b/i.test(catalogPrompt) ? true : null,
				maxSeasons: /\b1\s*season\b/i.test(catalogPrompt) ? 1 : null,
				maxEpisodes: null,
				titleHint: null,
				likeTitle,
				likeTitles,
				keywords: catalogPrompt
					.toLowerCase()
					.split(/[^a-z0-9+]+/)
					.filter((w: string) => w.length > 2),
				matchReason: ''
			}
		},
		REC_LIMIT
	);

	const recommendations = await Promise.all(
		hits.map(async (hit) => {
			const tmdb = await searchTmdbPoster({
				searchQuery: hit.title,
				releaseYear: null,
				mediaTypeHint: kindLabel(hit.kind)
			});
			const watch = await fetchWatchProviders({
				tmdbId: tmdb?.id || hit.tmdbId,
				mediaType: tmdb?.mediaType || hit.mediaType,
				region
			});
			const pitch = likeTitles.length
				? `If you liked ${likeLabel}, ${hit.title} is a close neighbor in our local catalog.`
				: vibePrompt
					? `Because you asked for “${vibePrompt.slice(0, 80)}”, ${hit.title} fits from our catalog.`
					: `${hit.title} fits your ${formatLabel(selectedType)} filters.`;

			return {
				title: hit.title,
				cover: tmdb?.posterUrl || hit.cover,
				genres: hit.genres,
				pitch,
				mediaType: kindLabel(hit.kind),
				seasonInfo: seasonInfo(hit),
				rating: tmdb?.rating ?? hit.rating,
				searchQuery: hit.title,
				tmdb_id: tmdb?.id || hit.tmdbId,
				media_type: hit.format,
				region: watch.region,
				providers: watch.providers,
				zflix_url: getZflixUrl(hit.title),
				likeTitle: likeLabel || undefined,
				likeTitles: likeTitles.length ? likeTitles : undefined
			};
		})
	);

	return json({
		ok: true,
		mocked: true,
		mode: likeTitles.length ? 'catalog-like' : 'catalog',
		params: {
			type: selectedType,
			userGenres: selectedGenres,
			prompt: vibePrompt,
			likeTitles: likeTitles.length ? likeTitles : undefined,
			likeTitle: likeTitle || undefined
		},
		recommendation: recommendations[0],
		recommendations
	});
};

export const GET: RequestHandler = async () => {
	return json({
		ok: true,
		msg: 'POST { type, genres, prompt, likeTitles, region }',
		keys_loaded: howManyKeysWeGot()
	});
};
