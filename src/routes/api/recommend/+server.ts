import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callGeminiFlash, howManyKeysWeGot } from '$lib/server/geminiRotator';
import { fetchWatchProviders } from '$lib/server/tmdbProviders';
import { searchTmdbPoster } from '$lib/server/tmdbSearch';
import { findSimilarPicks } from '$lib/server/tmdbSimilar';
import { fetchTmdbTrailerKey } from '$lib/server/tmdbVideos';
import { cleanLikeTitle, parseLikeTitle, stripLikeClause } from '$lib/server/likeTitle';
import { getZflixUrl } from '$lib/watchLinks';
import { normalizeRegion } from '$lib/regions';
import { normalizeLanguage } from '$lib/languages';
import { buildCacheKey, cacheGet, cacheSet } from '$lib/server/apiCache';
import { lookupItunesTrack, songListenLinks } from '$lib/server/itunesSearch';
import {
	decadePromptLabel,
	parseDecade,
	yearInDecade,
	type DecadeRange
} from '$lib/server/decade';
import {
	buildWeightingBlock,
	notesWeightBand,
	parseNotesWeight
} from '$lib/server/notesWeight';
import {
	isExclusiveFormat,
	kindLabel,
	pickManyFromCatalog,
	seasonInfo,
	type MediaFormat,
	type SelectedType
} from '$lib/server/catalog';
import {
	fetchOnMyOwnTrack,
	fetchSurronsterNewest,
	isSurronSongSecret,
	isSurronsterVibeSecret,
	songSecretRecommendation,
	surronsterVidRecommendations
} from '$lib/server/easterEggs';
import {
	parsePlatforms,
	platformsPromptBlock,
	platformsStrictRule
} from '$lib/gamePlatforms';
import { antiVibePromptBlock, antiVibeStrictRule, parseAntiVibe } from '$lib/server/antiVibe';
import {
	parsePriceRange,
	priceRangeBadge,
	priceRangePromptBlock,
	priceRangeStrictRule,
	type PriceRangeId
} from '$lib/server/priceRange';
import {
	parseSeriesLength,
	seasonCountAllowed,
	seasonsLabel,
	seriesLengthPromptBlock,
	seriesLengthStrictRule,
	type SeriesLengthId
} from '$lib/server/seriesLength';
import { fetchTvSeasonCount } from '$lib/server/tmdbTvDetails';
import {
	maturityPromptBlock,
	maturityStrictRule,
	parseMaturity,
	type MaturityLevel
} from '$lib/server/maturity';
import { passesMaturityGate } from '$lib/server/tmdbCertification';
import {
	buildStoreLinksForPlatforms,
	gamePassesMaturity,
	lookupIgdbGame,
	primaryStoreLink
} from '$lib/server/igdbSearch';
import { howManyIgdbCreds } from '$lib/server/igdbAuth';
import { bookReadLinks, lookupBookOrManga } from '$lib/server/openLibrarySearch';
import { bggLinks, lookupBggGame } from '$lib/server/bggSearch';
import { resolveSnackPairing } from '$lib/server/snackPairing';
import { BOARD_GAMES_COMING_SOON, BOARD_GAMES_SOON_COPY } from '$lib/boardGamesGate';
import {
	buildBoardGamesConciergePrompt,
	buildBooksConciergePrompt,
	buildFullVibePrompt,
	parseGeminiBoardRecs,
	parseGeminiBookRecs,
	parseGeminiVibeBundle
} from '$lib/server/extraFormatPrompts';

/** Season count for TV picks — optional hard gate when Series Length is set. */
async function resolveTvSeasons(
	tmdbId: number,
	mediaType: 'movie' | 'tv',
	seriesLength: SeriesLengthId | null,
	language?: string | null
): Promise<{ ok: boolean; number_of_seasons: number | null; seasons_label: string | null }> {
	if (mediaType !== 'tv' || !tmdbId) {
		return { ok: true, number_of_seasons: null, seasons_label: null };
	}
	const count = await fetchTvSeasonCount(tmdbId, language);
	if (!seasonCountAllowed(count, seriesLength)) {
		return { ok: false, number_of_seasons: count, seasons_label: seasonsLabel(count) };
	}
	return { ok: true, number_of_seasons: count, seasons_label: seasonsLabel(count) };
}

const REC_LIMIT = 5;

function parseOneFormat(raw: any): MediaFormat | null {
	const t = String(raw || '').toLowerCase().trim();
	if (t === 'movie' || t === 'movies' || t === 'film') return 'movie';
	if (t === 'series' || t === 'tv' || t === 'show' || t === 'shows') return 'series';
	if (t === 'anime') return 'anime';
	if (t === 'song' || t === 'songs' || t === 'music' || t === 'track') return 'songs';
	if (t === 'game' || t === 'games' || t === 'gaming' || t === 'videogame' || t === 'video-game')
		return 'games';
	if (
		t === 'book' ||
		t === 'books' ||
		t === 'manga' ||
		t === 'books-manga' ||
		t === 'booksmanga'
	)
		return 'books';
	if (
		t === 'board' ||
		t === 'boardgame' ||
		t === 'boardgames' ||
		t === 'board-games' ||
		t === 'tabletop'
	)
		return 'boardgames';
	if (
		t === 'fullvibe' ||
		t === 'full-vibe' ||
		t === 'vibe' ||
		t === 'itinerary' ||
		t === 'combo'
	)
		return 'fullvibe';
	return null;
}

/** Prefer body.types[]; fall back to legacy body.type. Empty = all media. Exclusive lanes win. */
function normalizeTypes(body: any): MediaFormat[] {
	const out: MediaFormat[] = [];
	const seen = new Set<MediaFormat>();

	const push = (raw: any) => {
		const f = parseOneFormat(raw);
		if (!f || seen.has(f)) return;
		seen.add(f);
		out.push(f);
	};

	if (Array.isArray(body?.types)) {
		for (const t of body.types) push(t);
	} else if (body?.type != null && body.type !== '' && String(body.type).toLowerCase() !== 'all') {
		push(body.type);
	}

	// exclusive lanes — first one in this priority list wins
	for (const ex of ['fullvibe', 'boardgames', 'books', 'games', 'songs'] as MediaFormat[]) {
		if (out.includes(ex)) return [ex];
	}
	return out.filter((t) => !isExclusiveFormat(t));
}

function formatLabel(types: MediaFormat[]): string {
	if (!types.length) return 'all (movie, TV series, or anime)';
	return types
		.map((t) => {
			if (t === 'movie') return 'movie';
			if (t === 'series') return 'TV series';
			if (t === 'anime') return 'anime';
			if (t === 'games') return 'games';
			if (t === 'books') return 'books & manga';
			if (t === 'boardgames') return 'board games';
			if (t === 'fullvibe') return 'full vibe itinerary';
			return 'songs';
		})
		.join(' OR ');
}

function allowedMediaTypes(types: MediaFormat[]): string {
	if (!types.length) return '"TV Series", "Movie", "Anime Series"';
	const labels: string[] = [];
	if (types.includes('series')) labels.push('"TV Series"');
	if (types.includes('movie')) labels.push('"Movie"');
	if (types.includes('anime')) labels.push('"Anime Series"');
	return labels.join(', ') || '"TV Series", "Movie", "Anime Series"';
}

/** Legacy single SelectedType for response params when useful */
function legacyType(types: MediaFormat[]): SelectedType {
	if (!types.length) return 'all';
	if (types.length === 1) return types[0];
	return 'all';
}

/** Tell Gemini to write pitches in the user's language when it's not english. */
function languagePromptLine(language?: string | null): string {
	const lang = normalizeLanguage(language);
	if (lang === 'en-US' || lang.startsWith('en')) return '';
	return `- Response language (HARD): write matchReason / pitches in ${lang}. Keep title + searchQuery as the official localized title when you know it.`;
}

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

// gemini keeps putting raw double quotes inside strings and breaking the parser, stripping them here
function escapeInternalQuotes(jsonish: string): string {
	let out = '';
	let inString = false;
	let escaped = false;
	for (let i = 0; i < jsonish.length; i++) {
		const c = jsonish[i];
		if (escaped) {
			out += c;
			escaped = false;
			continue;
		}
		if (c === '\\' && inString) {
			out += c;
			escaped = true;
			continue;
		}
		if (c === '"') {
			if (!inString) {
				inString = true;
				out += c;
			} else {
				const rest = jsonish.slice(i + 1);
				if (/^\s*[,:}\]]/.test(rest) || /^\s*$/.test(rest)) {
					inString = false;
					out += c;
				} else {
					out += '\\"';
				}
			}
			continue;
		}
		out += c;
	}
	return out;
}

// gemini json is haunted. we try a few times before giving up
function repairJsonText(raw: string): string {
	let s = stripJsonFences(raw);
	s = s.replace(/^\uFEFF/, '');
	// curly quotes from copy-paste brains
	s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
	s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
	s = s.replace(/,\s*([}\]])/g, '$1'); // trailing commas my beloved
	s = escapeInternalQuotes(s);
	return s;
}

function safeParseJson(raw: string): any {
	const tries = [
		repairJsonText(raw),
		stripJsonFences(raw),
		escapeInternalQuotes(stripJsonFences(raw)),
		(raw || '').trim()
	];
	let lastErr: any = null;
	for (const t of tries) {
		if (!t) continue;
		try {
			return JSON.parse(t);
		} catch (e) {
			lastErr = e;
		}
	}
	throw lastErr || new Error('model spat out unparseable junk');
}

function buildMusicConciergePrompt(opts: {
	genres: string[];
	prompt: string;
	likeTitles?: string[];
	decade?: DecadeRange | null;
	notesWeight?: number;
	maturity?: MaturityLevel | null;
	antiVibe?: string;
	language?: string;
}) {
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');
	const era = decadePromptLabel(opts.decade || null);
	const hasNotes = Boolean(prompt.trim());
	const weight = parseNotesWeight(opts.notesWeight);
	const band = notesWeightBand(weight);
	const maturity = opts.maturity ?? null;
	const maturityBlock = maturityPromptBlock(maturity, 'music');
	const maturityRule = maturityStrictRule(maturity, 'music');
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const antiRule = antiVibeStrictRule(anti);

	let likeBlock = '';
	if (likes.length) {
		if (hasNotes && band === 'notes') {
			likeBlock = `
- Similar-to songs/artists (SECONDARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Soft taste hints only. Notes/Vibe outrank structural similarity. Never return those exact tracks.`;
		} else if (hasNotes && band === 'balanced') {
			likeBlock = `
- Similar-to songs/artists (BALANCED): ${likes.map((t) => `'${t}'`).join(', ')}
  Fit both Notes vibe and these references. Never return those exact tracks.`;
		} else if (hasNotes && band === 'similar') {
			likeBlock = `
- Similar-to songs/artists (PRIMARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Prefer neighbors of these references; Notes are a soft steer. Never return those exact tracks.`;
		} else {
			likeBlock = `
- Similar-to songs/artists (HARD): ${likes.map((t) => `'${t}'`).join(', ')}
  Recommend DIFFERENT songs in the same vibe/era/energy. Never return those exact tracks.`;
		}
	}

	const eraBlock = opts.decade
		? `
- Decade/Era (HARD): ${era}
  Every song's releaseYear MUST fall in ${opts.decade.yearFrom}–${opts.decade.yearTo}.`
		: `
- Decade/Era: Any`;

	const weightingBlock = buildWeightingBlock({
		weight,
		hasNotes,
		hasLikes: likes.length > 0,
		kind: 'music'
	});

	// keep the prompt strict or gemini invents fake b-sides
	return `
You are an expert music recommender (songs, not albums-as-products — pick specific tracks).
USER INPUT:
- Genres: ${genres}
- Vibe/Prompt (Notes): '${prompt || '(none)'}'${eraBlock}
${maturityBlock}
${antiBlock}${likeBlock}
${languagePromptLine(opts.language)}
${weightingBlock}

STRICT RULES:
1. Return real, searchable song titles with correct artist names.
2. Prefer well-known enough tracks that Apple Music / Spotify search will find them.
3. Diversity: don't recommend 5 songs by the same artist unless vibes demand it.
4. NO THIRD PERSON in matchReason — speak to the user.
5. searchQuery MUST be "Artist - Song Title" for lookup.
${hasNotes ? `6. Respect the PRIORITY WEIGHTING block above for Notes vs Similar-to.` : ''}
${opts.decade ? `${hasNotes ? '7' : '6'}. ERA: releaseYear MUST be between ${opts.decade.yearFrom} and ${opts.decade.yearTo} inclusive.` : ''}
${likes.length ? `${opts.decade ? (hasNotes ? '8' : '7') : hasNotes ? '7' : '6'}. SIMILAR-TO: neighbors of ${likeLabel}, not those tracks themselves.` : ''}
${maturityRule ? `${maturityRule}` : ''}
${antiRule ? `${antiRule}` : ''}

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

type GeminiGameRec = {
	title: string;
	releaseYear: string;
	actualGenres: string[];
	matchReason: string;
	searchQuery: string;
};

function buildGamesConciergePrompt(opts: {
	genres: string[];
	prompt: string;
	likeTitles?: string[];
	decade?: DecadeRange | null;
	notesWeight?: number;
	maturity?: MaturityLevel | null;
	priceRange?: PriceRangeId | null;
	antiVibe?: string;
	platforms?: string[];
	language?: string;
}) {
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');
	const era = decadePromptLabel(opts.decade || null);
	const hasNotes = Boolean(prompt.trim());
	const weight = parseNotesWeight(opts.notesWeight);
	const band = notesWeightBand(weight);
	const maturity = opts.maturity ?? null;
	const maturityBlock = maturityPromptBlock(maturity, 'games');
	const maturityRule = maturityStrictRule(maturity, 'games');
	const priceRange = opts.priceRange ?? null;
	const priceBlock = priceRangePromptBlock(priceRange);
	const priceRule = priceRangeStrictRule(priceRange);
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const antiRule = antiVibeStrictRule(anti);
	const platforms = parsePlatforms(opts.platforms);
	const platformBlock = platformsPromptBlock(platforms);
	const platformRule = platformsStrictRule(platforms);

	let likeBlock = '';
	if (likes.length) {
		if (hasNotes && band === 'notes') {
			likeBlock = `
- Similar-to games (SECONDARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Soft taste hints only. Notes/Vibe outrank structural similarity. Never return those exact games.`;
		} else if (hasNotes && band === 'balanced') {
			likeBlock = `
- Similar-to games (BALANCED): ${likes.map((t) => `'${t}'`).join(', ')}
  Fit both Notes vibe and these references. Never return those exact games.`;
		} else if (hasNotes && band === 'similar') {
			likeBlock = `
- Similar-to games (PRIMARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Prefer neighbors of these references; Notes are a soft steer. Never return those exact games.`;
		} else {
			likeBlock = `
- Similar-to games (HARD): ${likes.map((t) => `'${t}'`).join(', ')}
  Recommend DIFFERENT games in the same vibe/systems/audience. Never return those exact games.`;
		}
	}

	const eraBlock = opts.decade
		? `
- Decade/Era (HARD): ${era}
  Every game's first_release year MUST fall in ${opts.decade.yearFrom}–${opts.decade.yearTo}.`
		: `
- Decade/Era: Any`;

	const weightingBlock = buildWeightingBlock({
		weight,
		hasNotes,
		hasLikes: likes.length > 0,
		kind: 'media'
	});

	return `
You are an expert video game recommender (PC, console, and multiplayer titles).
USER INPUT:
- Genres: ${genres}
- Vibe/Prompt (Notes): '${prompt || '(none)'}'${eraBlock}
${maturityBlock}
${priceBlock}
${platformBlock}
${antiBlock}${likeBlock}
${languagePromptLine(opts.language)}
${weightingBlock}

VIBE TESTS (apply silently):
- "highly competitive tactical shooter" → titles like Counter-Strike 2, Valorant, Rainbow Six Siege — NOT story campaigns.
- "deep crafting, automation, user-generated content" → Minecraft (modded), Factorio, Satisfactory, Roblox — NOT linear shooters.
- Match gameplay loop and social mode, not just a shared genre tag.

STRICT RULES:
1. Return real, searchable game titles (main editions — not random DLC names unless the vibe demands it).
2. Prefer titles IGDB / Steam can resolve by exact name.
3. Diversity: don't recommend 5 near-identical clones unless vibes demand it.
4. NO THIRD PERSON in matchReason — speak to the user.
5. searchQuery MUST be "Exact Title (YYYY)" when year is known.
${hasNotes ? `6. Respect the PRIORITY WEIGHTING block above for Notes vs Similar-to.` : ''}
${opts.decade ? `${hasNotes ? '7' : '6'}. ERA: releaseYear MUST be between ${opts.decade.yearFrom} and ${opts.decade.yearTo} inclusive.` : ''}
${likes.length ? `${opts.decade ? (hasNotes ? '8' : '7') : hasNotes ? '7' : '6'}. SIMILAR-TO: neighbors of ${likeLabel}, not those games themselves.` : ''}
${maturityRule ? `${maturityRule}` : ''}
${priceRule ? `${priceRule}` : ''}
${platformRule ? `${platformRule}` : ''}
${antiRule ? `${antiRule}` : ''}

RESPONSE JSON FORMAT:
{
  "recommendations": [
    {
      "title": "Exact Game Title",
      "releaseYear": "YYYY",
      "actualGenres": ["Genre"],
      "matchReason": "Direct, 2-sentence pitch.",
      "searchQuery": "Exact Title (YYYY)"
    }
  ]
}

Return exactly ${REC_LIMIT} distinct games, best match first.
Output ONLY valid JSON. No markdown fences, no trailing commas, no comments.
`.trim();
}

function parseGeminiGameRecs(raw: string): GeminiGameRec[] {
	const parsed = safeParseJson(raw);
	let list: any[] = [];
	if (Array.isArray(parsed?.recommendations)) list = parsed.recommendations;
	else if (Array.isArray(parsed)) list = parsed;
	else if (parsed?.title) list = [parsed];

	const out: GeminiGameRec[] = [];
	const seen = new Set<string>();

	for (const item of list) {
		const title = String(item?.title || '').trim();
		if (!title) continue;
		const key = title.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);

		let genres: string[] = [];
		if (Array.isArray(item?.actualGenres)) {
			genres = item.actualGenres.map((g: any) => String(g)).filter(Boolean);
		} else if (Array.isArray(item?.genres)) {
			genres = item.genres.map((g: any) => String(g)).filter(Boolean);
		}

		const releaseYear = String(item?.releaseYear || item?.year || '').trim().slice(0, 4);
		out.push({
			title,
			releaseYear,
			actualGenres: genres,
			matchReason: String(item?.matchReason || item?.pitch || '').trim(),
			searchQuery:
				String(item?.searchQuery || '').trim() ||
				(releaseYear ? `${title} (${releaseYear})` : title)
		});
		if (out.length >= REC_LIMIT) break;
	}
	return out;
}

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
	types: MediaFormat[];
	genres: string[];
	prompt: string;
	likeTitles?: string[];
	decade?: DecadeRange | null;
	notesWeight?: number;
	maturity?: MaturityLevel | null;
	seriesLength?: SeriesLengthId | null;
	antiVibe?: string;
	language?: string;
}) {
	const type = formatLabel(opts.types);
	const allowed = allowedMediaTypes(opts.types);
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');
	const era = decadePromptLabel(opts.decade || null);
	const eraLine = opts.decade
		? `- Decade/Era (HARD): ${era} — every title's releaseYear MUST be ${opts.decade.yearFrom}–${opts.decade.yearTo}`
		: `- Decade/Era: Any`;
	const maturity = opts.maturity ?? null;
	const maturityLine = maturityPromptBlock(maturity, 'media');
	const maturityRule = maturityStrictRule(maturity, 'media');
	const wantsSeriesLength =
		Boolean(opts.seriesLength) &&
		(opts.types.includes('series') || opts.types.includes('anime'));
	const seriesLength = wantsSeriesLength ? opts.seriesLength ?? null : null;
	const seriesLengthLine = seriesLengthPromptBlock(seriesLength);
	const seriesLengthRule = seriesLengthStrictRule(seriesLength);
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const antiRule = antiVibeStrictRule(anti);

	const hasNotes = Boolean(prompt.trim());
	const weight = parseNotesWeight(opts.notesWeight);
	const band = notesWeightBand(weight);

	const likeBlock = likes.length
		? hasNotes && band === 'notes'
			? `
- Similar-to titles (SECONDARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Use these only as soft taste hints (tone/audience), NEVER as structural clones.
  NEVER return any of: ${likes.map((t) => `'${t}'`).join(', ')}.
  If a Similar-to title conflicts with Notes/Vibe, Notes WIN — pick for the vibe, not the reference's plot structure.`
			: hasNotes && band === 'balanced'
				? `
- Similar-to titles (BALANCED with Notes): ${likes.map((t) => `'${t}'`).join(', ')}
  Picks should fit Notes vibe AND feel like neighbors of these references.
  NEVER return any of: ${likes.map((t) => `'${t}'`).join(', ')}.`
				: hasNotes && band === 'similar'
					? `
- Similar-to titles (PRIMARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Prefer structural/tonal neighbors of these references. Notes are a soft steer among them.
  NEVER return any of: ${likes.map((t) => `'${t}'`).join(', ')}.`
					: `
- Similar-to titles (HARD): ${likes.map((t) => `'${t}'`).join(', ')}
  You MUST recommend a DIFFERENT title that feels like these references (tone, structure, audience).
  NEVER return any of: ${likes.map((t) => `'${t}'`).join(', ')}. Prefer lesser-known neighbors over the usual top-10 lists.`
		: '';

	const weightingBlock = buildWeightingBlock({
		weight,
		hasNotes,
		hasLikes: likes.length > 0,
		kind: 'media'
	});

	const notesPrimary = hasNotes && (band === 'notes' || !likes.length);
	const notesBalanced = hasNotes && band === 'balanced' && likes.length > 0;

	return `
You are an expert TV/Movie/Anime concierge.
USER INPUT: 
- Format: ${type} 
- Required Genres: ${genres}
${eraLine}
${maturityLine}
${seriesLengthLine}
${antiBlock}
- Vibe/Prompt (Notes): '${prompt || '(none)'}'${likeBlock}
${languagePromptLine(opts.language)}
${weightingBlock}

CHAIN OF THOUGHT (do this silently before answering — do not output the reasoning):
1. List hard constraints from Format + Required Genres + Decade/Era + Content rating${seriesLength ? ' + Series length' : ''}${anti ? ' + Anti-vibe exclusions' : ''}${hasNotes ? ' + Notes/Vibe' : ''}${likes.length ? ' + Similar-to titles' : ''}.
2. If Notes mention a song, artist, soundtrack, needle-drop, or "movies/shows with [song]", treat that as a HARD soundtrack constraint — recommend titles where that music is actually featured (or that artist's music is prominently used), not just the same vibe as the song.
3. Reject any title that fails a hard constraint (wrong format, wrong era/year, wrong content rating, wrong series length, hits anti-vibe, wrong soundtrack fit, wrong length, no thematic fit${hasNotes ? ', fails Notes/vibe when Notes are weighted high' : ''}${likes.length ? `, or is one of the reference titles` : ''}).
4. OVERRIDE POPULARITY BIAS before picking — popular defaults are guilty until proven perfect.
${notesPrimary ? `5. Score every candidate first by Notes/vibe fit (including soundtrack fit). Similar-to may break ties only among equally on-vibe titles.` : notesBalanced ? `5. Score candidates on both Notes fit and Similar-to neighbor fit; keep both in play.` : likes.length ? `5. If Similar-to is set, prioritize thematic neighbors of those titles (same vibe/energy), not sequels of them. Use Notes as a soft bias when present.` : ''}

STRICT RULES:
1. OVERRIDE POPULARITY BIAS: Do not default to Breaking Bad, Game of Thrones, or Naruto unless they perfectly match the Vibe/Prompt. 
2. MATCHING: If the user asks for 'Police, 911' and 'Romance', you MUST return a show centered on first responders with romantic subplots (e.g., 'The Rookie', '9-1-1', 'Castle'). 
3. SOUNDTRACKS: If Notes ask for movies/TV/anime featuring a specific song or artist (e.g. "movies with Nightcall", "shows with Radiohead", "films that use Where Is My Mind"), use your film/TV soundtrack knowledge to recommend titles where that music is prominently featured. Name the song/needle-drop in matchReason. Prefer accurate soundtrack placements over vibe-only neighbors.
4. Respect the PRIORITY WEIGHTING block above. When Notes weight is high, words like western, cowboy, horror, heist in Notes are non-negotiable — never recommend a title that ignores that vibe (e.g. do NOT suggest Dynasty for a cowboy/western request). Prefer on-theme titles even if less famous (e.g. Yellowstone, 1883, Justified, Godless for western TV).
5. NO THIRD PERSON: Write the 'matchReason' directly to the user (e.g., 'Because you wanted a police show with romance...'). Never say 'The user is looking for...'.${hasNotes ? ' Lead with how the pick matches Notes when Notes weight is high.' : ''}
6. actualGenres must be the title's REAL genres — never parrot Required Genres if the show does not have them.
7. searchQuery MUST be ONLY "Exact Title (YYYY)" — nothing else. No song names, artists, "featuring", or soundtrack notes (e.g. "Drive (2011)" not "Drive (2011) featuring Nightcall"). Put soundtrack details in matchReason only.
8. Respect Format strictly: every recommendation's mediaType MUST be one of the allowed formats (${allowed}). When Format lists multiple options (e.g. movie OR TV series), you may mix them across the list but each item must still match one allowed format. anime + "1 season"/episodes → Anime Series (not anime movie). series → TV Series. movie → Movie.
${opts.decade ? `9. ERA (HARD): releaseYear MUST be between ${opts.decade.yearFrom} and ${opts.decade.yearTo} inclusive. Prefer titles that premiered/released in that decade — do not stretch eras.` : ''}
${likes.length ? `${opts.decade ? '10' : '9'}. SIMILAR-TO: Recommend titles LIKE ${likeLabel}, not those titles themselves. Apply the PRIORITY WEIGHTING block when Notes are also present.` : ''}
${maturityRule ? `${maturityRule}` : ''}
${seriesLengthRule ? `${seriesLengthRule}` : ''}
${antiRule ? `${antiRule}` : ''}

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
Output ONLY valid JSON. No markdown fences, no trailing commas, no comments. mediaType must be one of: ${allowed}.
`.trim();
}

function mediaLabelFromTmdb(mediaType: 'movie' | 'tv', types: MediaFormat[]): string {
	if (types.length === 1 && types[0] === 'anime') return 'Anime Series';
	if (types.includes('anime') && mediaType === 'tv') {
		// ambiguous — prefer Anime Series only when anime is the sole TV-ish format
		if (!types.includes('series')) return 'Anime Series';
	}
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

	const selectedTypes = normalizeTypes(body);
	const isSongs = selectedTypes.length === 1 && selectedTypes[0] === 'songs';
	const isGames = selectedTypes.length === 1 && selectedTypes[0] === 'games';
	const isBooks = selectedTypes.length === 1 && selectedTypes[0] === 'books';
	const isBoardGames = selectedTypes.length === 1 && selectedTypes[0] === 'boardgames';
	const isFullVibe = selectedTypes.length === 1 && selectedTypes[0] === 'fullvibe';

	// parking board game picks until the bgg token actually clears review
	if (isBoardGames && BOARD_GAMES_COMING_SOON) {
		return json(
			{
				ok: false,
				comingSoon: true,
				error: BOARD_GAMES_SOON_COPY.title,
				message: BOARD_GAMES_SOON_COPY.body
			},
			{ status: 503 }
		);
	}

	const selectedType = legacyType(selectedTypes);
	const decade = parseDecade(body.decade ?? body.era ?? body.yearDecade);
	const maturity = parseMaturity(
		body.maturity ?? body.contentRating ?? body.content_rating ?? body.ratingLevel
	);
	const priceRange = isGames
		? parsePriceRange(body.priceRange ?? body.price_range ?? body.priceTier)
		: null;
	const targetPlatforms = isGames
		? parsePlatforms(body.platforms ?? body.targetPlatforms ?? body.platform)
		: [];
	const wantsSeries =
		selectedTypes.includes('series') || selectedTypes.includes('anime');
	const seriesLength = wantsSeries
		? parseSeriesLength(
				body.seriesLength ?? body.seasonCount ?? body.seasons ?? body.series_length
			)
		: null;
	const notesWeight = parseNotesWeight(body.notesWeight ?? body.notes_weight ?? body.weight);
	const selectedGenres: string[] = Array.isArray(body.genres)
		? body.genres.map((g: any) => String(g).trim()).filter(Boolean)
		: [];
	const vibePrompt = (body.prompt || body.vibe || body.text || '').toString().trim();
	const antiVibe = parseAntiVibe(
		body.antiVibe ?? body.anti_vibe ?? body.exclude ?? body.excludeVibe
	);
	const region = normalizeRegion(body.region);
	const language = normalizeLanguage(body.language ?? body.lang ?? body.locale);

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

	if (!vibePrompt && !likeTitles.length && !selectedGenres.length && !selectedTypes.length) {
		throw error(400, 'pick a type, some genres, a like-title, or type a vibe prompt');
	}

	// cache this so we don't nuke our API limits and keep the UI snappy
	const cacheKey = buildCacheKey('recommend', {
		types: selectedTypes,
		genres: selectedGenres,
		prompt: vibePrompt,
		antiVibe,
		likes: likeTitles,
		notesWeight,
		region,
		language,
		decade: decade?.id || null,
		maturity,
		priceRange,
		platforms: targetPlatforms,
		seriesLength
	});
	const cached = await cacheGet<Record<string, unknown>>(cacheKey);
	if (cached && cached.ok) {
		return json({ ...cached, fromCache: true });
	}

	const remember = async (payload: Record<string, unknown>) => {
		await cacheSet(cacheKey, payload);
		return json(payload);
	};

	const secretHaystack = [vibePrompt, notesOnly, ...likeTitles, ...selectedGenres].join(' ');

	// 🤫 Songs: Surron / Talaria → only On My Own by Kyle The Hooligan
	if (isSongs && isSurronSongSecret(secretHaystack)) {
		const track = await fetchOnMyOwnTrack();
		if (!track) throw error(502, 'could not load the secret track');
		const rec = {
			...songSecretRecommendation(track),
			likeTitle: likeLabel || 'Sur Ronster',
			likeTitles: likeTitles.length ? likeTitles : ['Sur Ronster']
		};
		return remember({
			ok: true,
			mocked: false,
			mode: 'songs-secret',
			params: {
				type: selectedType,
				types: selectedTypes,
				decade: decade?.id || null,
				maturity,
				notesWeight,
				userGenres: selectedGenres,
				prompt: vibePrompt,
				likeTitles: likeTitles.length ? likeTitles : undefined
			},
			recommendation: rec,
			recommendations: [rec]
		});
	}

	// 🤫 Movies/TV: surronster vibe → newest @surronster uploads
	if (!isSongs && !isGames && !isBooks && !isBoardGames && !isFullVibe && isSurronsterVibeSecret(secretHaystack)) {
		const vids = await fetchSurronsterNewest(REC_LIMIT);
		if (!vids.length) throw error(502, 'could not load Sur Ronster videos');
		const recommendations = surronsterVidRecommendations(vids);
		return remember({
			ok: true,
			mocked: false,
			mode: 'surronster',
			params: {
				type: selectedType,
				types: selectedTypes,
				decade: decade?.id || null,
				maturity,
				notesWeight,
				userGenres: selectedGenres,
				prompt: vibePrompt,
				likeTitles: likeTitles.length ? likeTitles : undefined
			},
			recommendation: recommendations[0],
			recommendations
		});
	}

	// songs = gemini picks tracks, itunes fills covers/links. messy but works
	if (isSongs) {
		if (howManyKeysWeGot() <= 0) {
			throw error(503, 'song recommendations need GEMINI_API_KEYS configured');
		}

		const musicPrompt = buildMusicConciergePrompt({
			genres: selectedGenres,
			prompt: notesOnly,
			likeTitles,
			decade,
			notesWeight,
			maturity,
			antiVibe,
			language
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

			const filteredSongs = decade
				? songRecs.filter((r) => yearInDecade(r.releaseYear, decade))
				: songRecs;
			const songList = filteredSongs.length ? filteredSongs : songRecs;

			const recommendations = [];
			for (const rec of songList) {
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

			return remember({
				ok: true,
				mocked: false,
				mode: 'songs',
				params: {
					type: selectedType,
					types: selectedTypes,
					decade: decade?.id || null,
					maturity,
					notesWeight,
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

	// games = gemini picks titles, IGDB fills covers / platforms / store links
	if (isGames) {
		if (howManyKeysWeGot() <= 0) {
			throw error(503, 'game recommendations need GEMINI_API_KEYS configured');
		}
		if (howManyIgdbCreds() <= 0) {
			throw error(
				503,
				'game recommendations need IGDB_CLIENT_ID + IGDB_CLIENT_SECRET (Twitch app)'
			);
		}

		const gamesPrompt = buildGamesConciergePrompt({
			genres: selectedGenres,
			prompt: notesOnly,
			likeTitles,
			decade,
			notesWeight,
			maturity,
			priceRange,
			antiVibe,
			platforms: targetPlatforms,
			language
		});
		const priceLabel = priceRangeBadge(priceRange);

		try {
			const gemini = await callGeminiFlash(gamesPrompt, { json: true, maxOutputTokens: 3072 });
			let gameRecs: GeminiGameRec[];
			try {
				gameRecs = parseGeminiGameRecs(gemini.text);
			} catch (parseErr: any) {
				console.error(
					'game json go boom',
					parseErr?.message || parseErr,
					String(gemini.text || '').slice(0, 400)
				);
				throw new Error('games model returned bad JSON — try again');
			}
			if (!gameRecs.length) throw new Error('gemini returned no games');

			const filteredGames = decade
				? gameRecs.filter((r) => yearInDecade(r.releaseYear, decade))
				: gameRecs;
			const gameList = filteredGames.length ? filteredGames : gameRecs;

			const recommendations = [];
			for (const rec of gameList) {
				const hit = await lookupIgdbGame({
					searchQuery: rec.searchQuery,
					title: rec.title,
					releaseYear: rec.releaseYear
				});

				if (hit && !gamePassesMaturity(hit.maturityCert, maturity)) {
					continue;
				}

				const title = hit?.title || rec.title;
				const year = hit?.year || rec.releaseYear || undefined;
				const rawStores = hit?.stores?.length
					? hit.stores
					: [
							{
								name: 'IGDB',
								url: `https://www.igdb.com/search?type=1&q=${encodeURIComponent(title)}`,
								logo: null
							}
						];
				const storeLinks = buildStoreLinksForPlatforms(
					rawStores,
					targetPlatforms,
					hit?.platforms || []
				);
				const primaryFallback = primaryStoreLink(rawStores, targetPlatforms);
				const primaryUrl = storeLinks[0]?.url || primaryFallback?.url || null;
				const primaryStoreName = storeLinks[0]?.store || primaryFallback?.name || undefined;
				const platformLabels =
					hit?.platforms?.map((p) => p.abbreviation || p.name).filter(Boolean) || [];

				recommendations.push({
					title,
					cover: hit?.coverUrl || '',
					genres: rec.actualGenres.length ? rec.actualGenres : hit?.genres || [],
					pitch: rec.matchReason,
					mediaType: 'Game',
					seasonInfo: year,
					rating: hit?.rating ?? undefined,
					content_rating: hit?.contentRating || undefined,
					price_range: priceRange || undefined,
					priceLabel: priceLabel || undefined,
					releaseYear: year,
					searchQuery: rec.searchQuery,
					igdb_id: hit?.id,
					// Hardware only — never mix storefront names into platforms
					platforms: platformLabels,
					region: undefined,
					storeLinks,
					// Storefronts only (legacy consumers); UI uses storeLinks + platforms
					providers: storeLinks.map((s) => ({
						name: s.platform || s.store,
						logo: null,
						url: s.url || null
					})),
					watch_link: primaryUrl,
					zflix_url: primaryUrl,
					listen_url: primaryUrl,
					store_name: primaryStoreName,
					likeTitle: likeLabel || undefined,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					kind: 'game' as const
				});

				if (recommendations.length >= REC_LIMIT) break;
			}

			if (!recommendations.length) {
				throw new Error('no games passed IGDB lookup / maturity gate');
			}

			return remember({
				ok: true,
				mocked: false,
				mode: 'games',
				params: {
					type: selectedType,
					types: selectedTypes,
					decade: decade?.id || null,
					maturity,
					priceRange,
					platforms: targetPlatforms.length ? targetPlatforms : undefined,
					notesWeight,
					userGenres: selectedGenres,
					prompt: vibePrompt,
					likeTitles: likeTitles.length ? likeTitles : undefined
				},
				recommendation: recommendations[0],
				recommendations
			});
		} catch (e: any) {
			console.error('game recommend failed', e?.message || e);
			throw error(502, e?.message || 'game recommendation failed');
		}
	}

	// books & manga = gemini titles → open library covers (jikan/anilist if manga blanks)
	if (isBooks) {
		if (howManyKeysWeGot() <= 0) {
			throw error(503, 'book recommendations need GEMINI_API_KEYS configured');
		}

		const booksPrompt = buildBooksConciergePrompt({
			genres: selectedGenres,
			prompt: notesOnly,
			likeTitles,
			decade,
			notesWeight,
			maturity,
			antiVibe,
			language
		});

		try {
			const gemini = await callGeminiFlash(booksPrompt, { json: true, maxOutputTokens: 3072 });
			let bookRecs;
			try {
				bookRecs = parseGeminiBookRecs(gemini.text);
			} catch (parseErr: any) {
				console.error('book json go boom', parseErr?.message || parseErr);
				throw new Error('books model returned bad JSON — try again');
			}
			if (!bookRecs.length) throw new Error('gemini returned no books');

			const recommendations = [];
			for (const rec of bookRecs) {
				const hit = await lookupBookOrManga({
					searchQuery: rec.searchQuery || rec.title,
					title: rec.title,
					hint: rec.mediaType
				});
				const title = hit?.title || rec.title;
				const author = hit?.author || rec.author;
				const links = hit
					? bookReadLinks(hit)
					: [
							{
								name: 'Open Library',
								url: `https://openlibrary.org/search?q=${encodeURIComponent(rec.searchQuery || rec.title)}`,
								logo: null as string | null
							}
						];

				recommendations.push({
					title,
					artist: author,
					cover: hit?.coverUrl || '',
					genres: rec.actualGenres,
					pitch: rec.matchReason,
					mediaType: hit?.kind === 'manga' || rec.mediaType === 'Manga' ? 'Manga' : 'Book',
					seasonInfo: hit?.year || rec.releaseYear || undefined,
					releaseYear: hit?.year || rec.releaseYear || undefined,
					searchQuery: rec.searchQuery,
					providers: links,
					watch_link: links[0]?.url || null,
					listen_url: links[0]?.url || null,
					likeTitle: likeLabel || undefined,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					kind: 'book' as const,
					source: hit?.source
				});
				if (recommendations.length >= REC_LIMIT) break;
			}

			if (!recommendations.length) throw new Error('no books resolved');

			return remember({
				ok: true,
				mocked: false,
				mode: 'books',
				params: {
					type: selectedType,
					types: selectedTypes,
					decade: decade?.id || null,
					maturity,
					notesWeight,
					userGenres: selectedGenres,
					prompt: vibePrompt,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					language
				},
				recommendation: recommendations[0],
				recommendations
			});
		} catch (e: any) {
			console.error('book recommend failed', e?.message || e);
			throw error(502, e?.message || 'book recommendation failed');
		}
	}

	// board games = gemini → bgg xml search/thing for box art
	if (isBoardGames) {
		if (howManyKeysWeGot() <= 0) {
			throw error(503, 'board game recommendations need GEMINI_API_KEYS configured');
		}

		const playerCount = (body.playerCount || body.players || '').toString().trim();
		const complexity = (body.complexity || body.weight || '').toString().trim();

		const boardPrompt = buildBoardGamesConciergePrompt({
			genres: selectedGenres,
			prompt: notesOnly,
			likeTitles,
			decade,
			notesWeight,
			maturity,
			antiVibe,
			language,
			playerCount: playerCount || undefined,
			complexity: complexity || undefined
		});

		try {
			// one retry if gemini hands us broken json after the repair pass
			let boardRecs: ReturnType<typeof parseGeminiBoardRecs> = [];
			let parseFailedTwice = false;
			for (let attempt = 0; attempt < 2; attempt++) {
				const gemini = await callGeminiFlash(boardPrompt, {
					json: true,
					maxOutputTokens: 3072
				});
				try {
					// making sure we actually use the repair pass for board games so it stops exploding
					boardRecs = parseGeminiBoardRecs(gemini.text);
					parseFailedTwice = false;
					break;
				} catch (parseErr: any) {
					console.error(
						'board json go boom',
						attempt === 0 ? '(retrying once)' : '(gave up)',
						parseErr?.message || parseErr
					);
					if (attempt === 0) continue;
					parseFailedTwice = true;
				}
			}
			if (parseFailedTwice) {
				throw new Error('board games model returned bad JSON — try again');
			}
			if (!boardRecs.length) throw new Error('gemini returned no board games');

			const recommendations = [];
			for (const rec of boardRecs) {
				const hit = await lookupBggGame({
					searchQuery: rec.searchQuery || rec.title,
					title: rec.title,
					year: rec.releaseYear
				});
				const title = hit?.title || rec.title;
				const cover = hit?.coverUrl || hit?.image || hit?.poster_path || '';
				const year = hit?.year || hit?.release_date || rec.releaseYear || undefined;
				const rating = hit?.vote_average ?? hit?.rating ?? undefined;
				const pitch = rec.matchReason || hit?.overview || hit?.description || '';
				const links = hit ? bggLinks(hit) : [];
				const players =
					hit?.minPlayers != null && hit?.maxPlayers != null
						? `${hit.minPlayers}–${hit.maxPlayers} players`
						: rec.playerCount || undefined;

				// normalizing the data to look exactly like a movie or video game result
				recommendations.push({
					title,
					cover,
					poster_path: cover || null,
					image: cover || null,
					genres: rec.actualGenres,
					pitch,
					overview: pitch,
					description: hit?.description || pitch,
					mediaType: 'Board Game',
					format: hit?.format || 'Board Games',
					seasonInfo: year,
					release_date: year,
					releaseYear: year,
					year,
					rating,
					vote_average: rating,
					searchQuery: rec.searchQuery,
					platforms: players ? [players] : undefined,
					complexity: rec.complexity || undefined,
					playingTime: hit?.playingTime || undefined,
					providers: links,
					storeLinks: links.map((l) => ({
						platform: l.name,
						url: l.url,
						store: l.name
					})),
					watch_link: hit?.bggUrl || links[0]?.url || null,
					listen_url: hit?.bggUrl || null,
					bgg_id: hit?.id,
					likeTitle: likeLabel || undefined,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					kind: 'boardgame' as const
				});
				if (recommendations.length >= REC_LIMIT) break;
			}

			if (!recommendations.length) throw new Error('no board games resolved from BGG');

			return remember({
				ok: true,
				mocked: false,
				mode: 'boardgames',
				params: {
					type: selectedType,
					types: selectedTypes,
					decade: decade?.id || null,
					maturity,
					notesWeight,
					userGenres: selectedGenres,
					prompt: vibePrompt,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					playerCount: playerCount || undefined,
					complexity: complexity || undefined,
					language
				},
				recommendation: recommendations[0],
				recommendations
			});
		} catch (e: any) {
			console.error('board game recommend failed', e?.message || e);
			throw error(502, e?.message || 'board game recommendation failed');
		}
	}

	// full vibe itinerary — one watch + one listen + one snack, same mood
	if (isFullVibe) {
		if (howManyKeysWeGot() <= 0) {
			throw error(503, 'full vibe needs GEMINI_API_KEYS configured');
		}
		if (!vibePrompt && !selectedGenres.length) {
			throw error(400, 'drop a vibe note for Full Vibe (e.g. rainy sunday cozy)');
		}

		const vibeBundlePrompt = buildFullVibePrompt({
			prompt: notesOnly || vibePrompt || selectedGenres.join(', '),
			genres: selectedGenres,
			antiVibe,
			language,
			maturity
		});

		try {
			const gemini = await callGeminiFlash(vibeBundlePrompt, {
				json: true,
				maxOutputTokens: 2048
			});
			let bundle;
			try {
				bundle = parseGeminiVibeBundle(gemini.text);
			} catch (parseErr: any) {
				console.error('full vibe json go boom', parseErr?.message || parseErr);
				throw new Error('full vibe model returned bad JSON — try again');
			}

			const tmdb = await searchTmdbPoster({
				searchQuery: bundle.watch.searchQuery || bundle.watch.title,
				releaseYear: bundle.watch.releaseYear,
				titleFallback: bundle.watch.title,
				mediaTypeHint: bundle.watch.mediaType,
				language
			});
			const tmdbId = tmdb?.id ?? 0;
			const tmdbKind = tmdb?.mediaType ?? mediaTypeToTmdb(bundle.watch.mediaType);
			const watch =
				tmdbId > 0
					? await fetchWatchProviders({
							tmdbId,
							mediaType: tmdbKind,
							region,
							title: bundle.watch.title
						})
					: { region, providers: [], watchLink: null };
			const trailerKey =
				tmdbId > 0
					? await fetchTmdbTrailerKey({ tmdbId, mediaType: tmdbKind, language })
					: null;

			const track = await lookupItunesTrack(bundle.music.searchQuery);
			const musicTitle = track?.title || bundle.music.title;
			const musicArtist = track?.artist || bundle.music.artist;
			const listen = songListenLinks({
				title: musicTitle,
				artist: musicArtist,
				appleUrl: track?.appleUrl
			});

			const snack = await resolveSnackPairing({
				name: bundle.snack.name,
				pitch: bundle.snack.pitch,
				kind: bundle.snack.kind
			});

			const packageRec = {
				title: bundle.vibeLabel || 'Full Vibe Package',
				cover: tmdb?.posterUrl || track?.cover || snack.thumb || '',
				pitch: `Your night-in starter pack for “${notesOnly || vibePrompt}”.`,
				mediaType: 'Vibe Package',
				kind: 'vibe' as const,
				vibeLabel: bundle.vibeLabel || 'Full Vibe',
				watch: {
					title: tmdb?.title || bundle.watch.title,
					cover: tmdb?.posterUrl || '',
					coverFallbacks: tmdb?.fallbackUrls || [],
					pitch: bundle.watch.matchReason,
					mediaType: bundle.watch.mediaType,
					seasonInfo: bundle.watch.releaseYear || tmdb?.year || undefined,
					rating: tmdb?.rating ?? undefined,
					providers: watch.providers,
					watch_link: watch.watchLink,
					trailer_youtube_key: trailerKey || undefined,
					tmdb_id: tmdbId || undefined,
					kind: 'media' as const
				},
				music: {
					title: musicTitle,
					artist: musicArtist,
					cover: track?.cover || '',
					pitch: bundle.music.matchReason,
					mediaType: 'Song',
					preview_url: track?.previewUrl || undefined,
					listen_url: listen[0]?.url || undefined,
					providers: listen,
					kind: 'song' as const
				},
				snack: {
					title: snack.name,
					cover: snack.thumb || '',
					pitch: snack.pitch,
					mediaType: snack.kind === 'drink' ? 'Drink' : 'Snack',
					watch_link: snack.recipeUrl,
					instructions: snack.instructions || undefined,
					kind: 'snack' as const
				}
			};

			return remember({
				ok: true,
				mocked: false,
				mode: 'fullvibe',
				params: {
					type: selectedType,
					types: selectedTypes,
					maturity,
					userGenres: selectedGenres,
					prompt: vibePrompt,
					language,
					region
				},
				recommendation: packageRec,
				recommendations: [packageRec]
			});
		} catch (e: any) {
			console.error('full vibe failed', e?.message || e);
			throw error(502, e?.message || 'full vibe recommendation failed');
		}
	}

	// —— Similar-to path: TMDB recommendations/similar ——
	// Skip when Notes are present and user weighted Notes over Similar-to (slider ≥ 60)
	const preferNotesOverSimilar =
		Boolean(notesOnly.trim()) && notesWeightBand(notesWeight) === 'notes';

	if (likeTitles.length && !preferNotesOverSimilar) {
		try {
			const similars = await findSimilarPicks({
				likeTitles,
				types: selectedTypes,
				userGenres: selectedGenres,
				notes: notesOnly,
				limit: maturity && maturity !== 'mature' ? Math.min(REC_LIMIT + 5, 10) : REC_LIMIT,
				yearFrom: decade?.yearFrom ?? null,
				yearTo: decade?.yearTo ?? null,
				language
			});

			if (similars.length) {
				const gated = await Promise.all(
					similars.map(async (similar) => {
						const gate = await passesMaturityGate({
							tmdbId: similar.id,
							mediaType: similar.mediaType,
							maturity
						});
						return gate.ok ? { similar, certification: gate.certification } : null;
					})
				);
				const picks = gated
					.filter((x): x is { similar: (typeof similars)[number]; certification: string | null } =>
						Boolean(x)
					)
					.slice(0, REC_LIMIT);

				// All neighbors failed the rating gate — fall through to Gemini/catalog
				if (picks.length) {
					const recommendations = [];
					for (const { similar, certification } of picks) {
						const seasons = await resolveTvSeasons(
							similar.id,
							similar.mediaType,
							seriesLength,
							language
						);
						if (!seasons.ok) continue;

						const watch = await fetchWatchProviders({
							tmdbId: similar.id,
							mediaType: similar.mediaType,
							region,
							title: similar.title
						});
						const trailerKey = await fetchTmdbTrailerKey({
							tmdbId: similar.id,
							mediaType: similar.mediaType,
							language
						});
						const mediaType = mediaLabelFromTmdb(similar.mediaType, selectedTypes);
						const searchQuery = similar.year
							? `${similar.title} (${similar.year})`
							: similar.title;
						recommendations.push({
							title: similar.title,
							cover: similar.posterUrl || '',
							coverFallbacks: similar.fallbackUrls || [],
							genres: similar.genres,
							pitch: pitchForSimilar({
								pickTitle: similar.title,
								referenceTitles: similar.referenceTitles,
								overview: similar.overview,
								notes: notesOnly
							}),
							mediaType,
							seasonInfo: similar.year ? String(similar.year) : undefined,
							number_of_seasons: seasons.number_of_seasons || undefined,
							seasons_label: seasons.seasons_label || undefined,
							rating: similar.rating ?? undefined,
							content_rating: certification || undefined,
							releaseYear: similar.year || undefined,
							searchQuery,
							tmdb_id: similar.id,
							media_type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
							trailer_youtube_key: trailerKey || undefined,
							region: watch.region,
							providers: watch.providers,
							watch_link: watch.watchLink,
							zflix_url: getZflixUrl(similar.title),
							likeTitle: similar.referenceTitle,
							likeTitles: similar.referenceTitles
						});
						if (recommendations.length >= REC_LIMIT) break;
					}

					if (recommendations.length) {
						return remember({
							ok: true,
							mocked: false,
							mode: 'similar',
							params: {
								type: selectedType,
								types: selectedTypes,
								decade: decade?.id || null,
								maturity,
								seriesLength,
								notesWeight,
								userGenres: selectedGenres,
								prompt: vibePrompt,
								likeTitles: similars[0].referenceTitles,
								likeTitle: similars[0].referenceTitle
							},
							recommendation: recommendations[0],
							recommendations
						});
					}
				}
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
				types: selectedTypes,
				genres: selectedGenres,
				prompt: conciergePromptText || vibePrompt,
				likeTitles,
				decade,
				notesWeight,
				maturity,
				seriesLength,
				antiVibe,
				language
			});
			const gemini = await callGeminiFlash(prompt, { json: true, maxOutputTokens: 3072 });
			const parsedRecs = parseGeminiRecs(gemini.text);
			if (!parsedRecs.length) throw new Error('gemini returned no recommendations');
			const decadeFiltered = decade
				? parsedRecs.filter((r) => yearInDecade(r.releaseYear, decade))
				: parsedRecs;
			const recs = decadeFiltered.length ? decadeFiltered : parsedRecs;

			// Sequential enrich — parallel TMDB fan-out was rate-limiting posters to initials
			const enriched = [];
			for (const rec of recs) {
				const tmdb = await searchTmdbPoster({
					searchQuery: rec.searchQuery || rec.title,
					releaseYear: rec.releaseYear,
					titleFallback: rec.title,
					mediaTypeHint: rec.mediaType,
					language
				});
				const tmdbId = tmdb?.id ?? 0;
				const tmdbKind = tmdb?.mediaType ?? mediaTypeToTmdb(rec.mediaType);
				const gate =
					tmdbId > 0
						? await passesMaturityGate({
								tmdbId,
								mediaType: tmdbKind,
								maturity
							})
						: { ok: true, certification: null as string | null };
				if (!gate.ok) continue;

				const seasons = await resolveTvSeasons(tmdbId, tmdbKind, seriesLength, language);
				if (!seasons.ok) continue;

				const watch =
					tmdbId > 0
						? await fetchWatchProviders({
								tmdbId,
								mediaType: tmdbKind,
								region,
								title: rec.title
							})
						: { region, providers: [], watchLink: null };
				const trailerKey =
					tmdbId > 0
						? await fetchTmdbTrailerKey({ tmdbId, mediaType: tmdbKind, language })
						: null;

				enriched.push({
					title: tmdb?.title || rec.title,
					cover: tmdb?.posterUrl || '',
					coverFallbacks: tmdb?.fallbackUrls || [],
					genres: rec.actualGenres,
					pitch: rec.matchReason,
					mediaType: rec.mediaType,
					seasonInfo: rec.releaseYear ? String(rec.releaseYear) : undefined,
					number_of_seasons: seasons.number_of_seasons || undefined,
					seasons_label: seasons.seasons_label || undefined,
					rating: tmdb?.rating ?? undefined,
					content_rating: gate.certification || undefined,
					releaseYear: rec.releaseYear,
					searchQuery: rec.searchQuery,
					tmdb_id: tmdbId || undefined,
					media_type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
					trailer_youtube_key: trailerKey || undefined,
					region: watch.region,
					providers: watch.providers,
					watch_link: watch.watchLink,
					zflix_url: getZflixUrl(rec.title),
					likeTitle: likeLabel || undefined,
					likeTitles: likeTitles.length ? likeTitles : undefined
				});
			}

			const recommendations = enriched;
			if (!recommendations.length) throw new Error('all gemini picks failed maturity gate');

			return remember({
				ok: true,
				mocked: false,
				mode: likeTitles.length ? 'gemini-like' : 'gemini',
				params: {
					type: selectedType,
					types: selectedTypes,
					decade: decade?.id || null,
					maturity,
					seriesLength,
					notesWeight,
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
			types: selectedTypes,
			userGenres: selectedGenres,
			prompt: catalogPrompt,
			yearFrom: decade?.yearFrom ?? null,
			yearTo: decade?.yearTo ?? null,
			intent: {
				wantsSeries:
					seriesLength || /\b(1\s*season|episodes?|series)\b/i.test(catalogPrompt)
						? true
						: null,
				wantsMovie: /\b(movie|film)\b/i.test(catalogPrompt) ? true : null,
				maxSeasons:
					seriesLength === 'mini'
						? 1
						: seriesLength === 'short'
							? 3
							: /\b1\s*season\b/i.test(catalogPrompt)
								? 1
								: null,
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
		maturity && maturity !== 'mature' ? REC_LIMIT + 4 : REC_LIMIT
	);

	const catalogEnriched = [];
	for (const hit of hits) {
			if (seriesLength && hit.seasons > 0 && !seasonCountAllowed(hit.seasons, seriesLength)) {
				continue;
			}

			const tmdb = await searchTmdbPoster({
				searchQuery: hit.title,
				releaseYear: String(hit.year),
				titleFallback: hit.title,
				mediaTypeHint: kindLabel(hit.kind),
				language
			});
			const tmdbId = tmdb?.id || hit.tmdbId;
			const tmdbKind = tmdb?.mediaType || hit.mediaType;
			const gate = tmdbId
				? await passesMaturityGate({
						tmdbId,
						mediaType: tmdbKind,
						maturity
					})
				: { ok: true, certification: null as string | null };
			if (!gate.ok) continue;

			const seasons = tmdbId
				? await resolveTvSeasons(tmdbId, tmdbKind, seriesLength, language)
				: {
						ok: seasonCountAllowed(hit.seasons || null, seriesLength),
						number_of_seasons: hit.seasons > 0 ? hit.seasons : null,
						seasons_label: seasonsLabel(hit.seasons > 0 ? hit.seasons : null)
					};
			if (!seasons.ok) continue;

			const watch = await fetchWatchProviders({
				tmdbId,
				mediaType: tmdbKind,
				region,
				title: hit.title
			});
			const trailerKey = tmdbId
				? await fetchTmdbTrailerKey({ tmdbId, mediaType: tmdbKind, language })
				: null;
			const pitch = likeTitles.length
				? `If you liked ${likeLabel}, ${hit.title} is a close neighbor in our local catalog.`
				: vibePrompt
					? `Because you asked for “${vibePrompt.slice(0, 80)}”, ${hit.title} fits from our catalog.`
					: `${hit.title} fits your ${formatLabel(selectedTypes)} filters.`;

				catalogEnriched.push({
					title: tmdb?.title || hit.title,
				cover: tmdb?.posterUrl || hit.cover,
				coverFallbacks: [
					...(tmdb?.fallbackUrls || []),
					...(tmdb?.posterUrl && hit.cover && hit.cover !== tmdb.posterUrl ? [hit.cover] : [])
				],
				genres: hit.genres,
				pitch,
				mediaType: kindLabel(hit.kind),
				seasonInfo: seasonInfo(hit),
				number_of_seasons:
					seasons.number_of_seasons || (hit.seasons > 0 ? hit.seasons : undefined),
				seasons_label:
					seasons.seasons_label ||
					seasonsLabel(hit.seasons > 0 ? hit.seasons : null) ||
					undefined,
				rating: tmdb?.rating ?? hit.rating,
				content_rating: gate.certification || undefined,
				releaseYear: String(hit.year),
				searchQuery: hit.title,
				tmdb_id: tmdbId,
				media_type: hit.format,
				trailer_youtube_key: trailerKey || undefined,
				region: watch.region,
				providers: watch.providers,
				watch_link: watch.watchLink,
				zflix_url: getZflixUrl(hit.title),
				likeTitle: likeLabel || undefined,
				likeTitles: likeTitles.length ? likeTitles : undefined
			});
			if (catalogEnriched.length >= REC_LIMIT) break;
	}

	const recommendations = catalogEnriched.slice(0, REC_LIMIT);

	return remember({
		ok: true,
		mocked: true,
		mode: likeTitles.length ? 'catalog-like' : 'catalog',
		params: {
			type: selectedType,
			types: selectedTypes,
			decade: decade?.id || null,
			maturity,
			seriesLength,
			notesWeight,
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
		msg: 'POST { types, genres, prompt, antiVibe, likeTitles, region, language, decade, maturity, priceRange, platforms, seriesLength, notesWeight }',
		keys_loaded: howManyKeysWeGot(),
		igdb: howManyIgdbCreds() > 0
	});
};
