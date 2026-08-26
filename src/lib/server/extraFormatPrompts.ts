/**
 * Gemini prompts + parsers for books, board games, Roblox, and full-vibe bundles.
 * Kept out of +server so that file doesn't grow into a novel.
 */

import { antiVibePromptBlock, antiVibeStrictRule, parseAntiVibe } from '$lib/server/antiVibe';
import {
	buildWeightingBlock,
	notesWeightBand,
	parseNotesWeight
} from '$lib/server/notesWeight';
import { decadePromptLabel, type DecadeRange } from '$lib/server/decade';
import {
	maturityPromptBlock,
	maturityStrictRule,
	type MaturityLevel
} from '$lib/server/maturity';
import { normalizeLanguage } from '$lib/languages';
import { safeParseGeminiJson } from '$lib/server/geminiJson';

const REC_LIMIT = 5;

function languagePromptLine(language?: string | null): string {
	const lang = normalizeLanguage(language);
	if (lang === 'en-US' || lang.startsWith('en')) return '';
	return `- Response language (HARD): write matchReason / pitches in ${lang}. Keep titles searchable in the original / official form.`;
}

export type GeminiBookRec = {
	title: string;
	author: string;
	releaseYear: string;
	mediaType: 'Book' | 'Manga';
	actualGenres: string[];
	matchReason: string;
	searchQuery: string;
};

export type GeminiBoardRec = {
	title: string;
	releaseYear: string;
	actualGenres: string[];
	matchReason: string;
	searchQuery: string;
	playerCount?: string;
	complexity?: string;
};

export type GeminiRobloxRec = {
	title: string;
	releaseYear: string;
	actualGenres: string[];
	matchReason: string;
	searchQuery: string;
};

export type GeminiVibeBundle = {
	watch: {
		title: string;
		releaseYear: string;
		mediaType: string;
		matchReason: string;
		searchQuery: string;
	};
	music: {
		title: string;
		artist: string;
		matchReason: string;
		searchQuery: string;
	};
	snack: {
		name: string;
		kind: 'drink' | 'snack';
		pitch: string;
	};
	vibeLabel?: string;
};

export function buildBooksConciergePrompt(opts: {
	genres: string[];
	prompt: string;
	likeTitles?: string[];
	decade?: DecadeRange | null;
	notesWeight?: number;
	maturity?: MaturityLevel | null;
	antiVibe?: string;
	language?: string;
}): string {
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');
	const era = decadePromptLabel(opts.decade || null);
	const hasNotes = Boolean(prompt.trim());
	const weight = parseNotesWeight(opts.notesWeight);
	const band = notesWeightBand(weight);
	const maturity = opts.maturity ?? null;
	const maturityBlock = maturityPromptBlock(maturity, 'media');
	const maturityRule = maturityStrictRule(maturity, 'media');
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const antiRule = antiVibeStrictRule(anti);

	let likeBlock = '';
	if (likes.length) {
		likeBlock =
			hasNotes && band === 'notes'
				? `
- Similar-to books/manga (SECONDARY): ${likes.map((t) => `'${t}'`).join(', ')}
  Soft taste hints. Notes win. Never return those exact titles.`
				: `
- Similar-to books/manga (HARD-ish): ${likes.map((t) => `'${t}'`).join(', ')}
  Neighbors in tone/structure — NEVER return those exact titles.`;
	}

	const weightingBlock = buildWeightingBlock({
		weight,
		hasNotes,
		hasLikes: likes.length > 0,
		kind: 'media'
	});

	return `
You are an expert books & manga recommender (novels, nonfiction, comics, manga — pick specific titles).
USER INPUT:
- Preferred Genres: ${genres}
- Vibe/Prompt (Notes): '${prompt || '(none)'}'
- Decade/Era: ${era}
${maturityBlock}
${antiBlock}${likeBlock}
${languagePromptLine(opts.language)}
${weightingBlock}

STRICT RULES:
1. Return real, searchable titles with correct authors when known.
2. mediaType MUST be "Book" or "Manga" (manga = Japanese comics / manhwa-adjacent ok if vibe fits).
3. searchQuery MUST be "Title" or "Title Author" — clean enough for Open Library / MAL search.
4. NO THIRD PERSON in matchReason — talk to the user.
5. Diversity: mix formats only if vibe allows; don't spam the same series.
${likes.length ? `6. SIMILAR-TO: neighbors of ${likeLabel}, not those titles themselves.` : ''}
${maturityRule ? `${maturityRule}` : ''}
${antiRule ? `${antiRule}` : ''}

RESPONSE JSON FORMAT:
{
  "recommendations": [
    {
      "title": "Exact Title",
      "author": "Author Name",
      "releaseYear": "YYYY",
      "mediaType": "Book",
      "actualGenres": ["Genre"],
      "matchReason": "Direct, 2-sentence pitch.",
      "searchQuery": "Exact Title Author"
    }
  ]
}

Return exactly ${REC_LIMIT} distinct picks, best match first.
Output ONLY valid JSON. No markdown fences.
`.trim();
}

export function buildBoardGamesConciergePrompt(opts: {
	genres: string[];
	prompt: string;
	likeTitles?: string[];
	decade?: DecadeRange | null;
	notesWeight?: number;
	maturity?: MaturityLevel | null;
	antiVibe?: string;
	language?: string;
	playerCount?: string;
	complexity?: string;
}): string {
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');
	const era = decadePromptLabel(opts.decade || null);
	const hasNotes = Boolean(prompt.trim());
	const weight = parseNotesWeight(opts.notesWeight);
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const antiRule = antiVibeStrictRule(anti);
	const players = String(opts.playerCount || '').trim();
	const complexity = String(opts.complexity || '').trim();

	let likeBlock = '';
	if (likes.length) {
		likeBlock = `
- Similar-to board games: ${likes.map((t) => `'${t}'`).join(', ')}
  Tabletop neighbors — never recommend those exact games.`;
	}

	const weightingBlock = buildWeightingBlock({
		weight,
		hasNotes,
		hasLikes: likes.length > 0,
		kind: 'media'
	});

	// yelling at the llm to give us valid json without markdown fences
	return `
You are an expert tabletop / board game recommender (physical board games, not video games).
USER INPUT:
- Preferred Genres/Mechanics: ${genres}
- Vibe/Prompt (Notes): '${prompt || '(none)'}'
- Decade/Era: ${era}
${players ? `- Player count preference: ${players}` : '- Player count: flexible'}
${complexity ? `- Complexity preference: ${complexity}` : '- Complexity: flexible'}
${antiBlock}${likeBlock}
${languagePromptLine(opts.language)}
${weightingBlock}

STRICT RULES:
1. Only real board / card / tabletop games (Catan, Wingspan, Root — NOT video games).
2. searchQuery MUST be the exact BGG-searchable title (no "board game" suffix noise).
3. Include playerCount like "2-4" and complexity like "light" | "medium" | "heavy" when you know it.
4. NO THIRD PERSON in matchReason. Keep matchReason short — no nested quotes if you can help it.
${likes.length ? `5. SIMILAR-TO: neighbors of ${likeLabel}, not those games.` : ''}
${antiRule ? `${antiRule}` : ''}

JSON OUTPUT (HARD):
Return ONLY raw, valid, minified JSON. Do not use markdown formatting or code blocks. Escape all double quotes inside string values using a backslash (\\"). Do not include trailing commas.

RESPONSE JSON FORMAT:
{"recommendations":[{"title":"Exact Game Title","releaseYear":"YYYY","actualGenres":["Strategy"],"matchReason":"Direct 2-sentence pitch.","searchQuery":"Exact Game Title","playerCount":"2-4","complexity":"medium"}]}

Return exactly ${REC_LIMIT} distinct board games, best match first.
`.trim();
}

export function buildRobloxConciergePrompt(opts: {
	genres: string[];
	prompt: string;
	likeTitles?: string[];
	decade?: DecadeRange | null;
	notesWeight?: number;
	maturity?: MaturityLevel | null;
	antiVibe?: string;
	language?: string;
}): string {
	const genres = opts.genres.join(', ') || 'None';
	const prompt = opts.prompt || '';
	const likes = (opts.likeTitles || []).map((t) => t.trim()).filter(Boolean);
	const likeLabel = likes.join(', ');
	const era = decadePromptLabel(opts.decade || null);
	const hasNotes = Boolean(prompt.trim());
	const weight = parseNotesWeight(opts.notesWeight);
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const antiRule = antiVibeStrictRule(anti);
	const maturity = opts.maturity ?? null;
	const maturityBlock = maturityPromptBlock(maturity, 'games');

	let likeBlock = '';
	if (likes.length) {
		likeBlock = `
- Similar-to Roblox experiences: ${likes.map((t) => `'${t}'`).join(', ')}
  Roblox neighbors — never recommend those exact experiences.`;
	}

	const weightingBlock = buildWeightingBlock({
		weight,
		hasNotes,
		hasLikes: likes.length > 0,
		kind: 'media'
	});

	return `
You are an expert Roblox experience recommender (UGC games on Roblox.com — NOT Steam/console titles).
USER INPUT:
- Preferred Genres/Tags: ${genres}
- Vibe/Prompt (Notes): '${prompt || '(none)'}'
- Decade/Era (soft — Roblox titles skew recent): ${era}
${maturityBlock}
${antiBlock}${likeBlock}
${languagePromptLine(opts.language)}
${weightingBlock}

STRICT RULES:
1. Only real Roblox experiences that players can search and join on Roblox (Adopt Me, Brookhaven, Doors, Blade Ball — NOT Minecraft/Fortnite unless they exist as Roblox copies, and prefer originals).
2. searchQuery MUST be the clean Roblox-searchable title (no "Roblox" suffix, no emoji spam).
3. Prefer experiences that are actively played / well-known when the vibe allows — skip dead clones when a famous neighbor exists.
4. NO THIRD PERSON in matchReason. Keep matchReason short — no nested quotes if you can help it.
${likes.length ? `5. SIMILAR-TO: neighbors of ${likeLabel}, not those experiences.` : ''}
${antiRule ? `${antiRule}` : ''}

JSON OUTPUT (HARD):
Return ONLY raw, valid, minified JSON. Do not use markdown formatting or code blocks. Escape all double quotes inside string values using a backslash (\\"). Do not include trailing commas.

RESPONSE JSON FORMAT:
{"recommendations":[{"title":"Exact Experience Title","releaseYear":"YYYY","actualGenres":["Obby"],"matchReason":"Direct 2-sentence pitch.","searchQuery":"Exact Experience Title"}]}

Return exactly ${REC_LIMIT} distinct Roblox experiences, best match first.
`.trim();
}

export function buildFullVibePrompt(opts: {
	prompt: string;
	genres?: string[];
	antiVibe?: string;
	language?: string;
	maturity?: MaturityLevel | null;
}): string {
	const prompt = opts.prompt || 'cozy rainy sunday';
	const genres = (opts.genres || []).join(', ') || 'None';
	const anti = parseAntiVibe(opts.antiVibe);
	const antiBlock = antiVibePromptBlock(anti);
	const maturity = opts.maturity ?? null;
	const maturityBlock = maturityPromptBlock(maturity, 'media');

	return `
You are a "Full Vibe Itinerary" planner. Given one vibe, pack a tiny night-in package.
USER INPUT:
- Vibe: '${prompt}'
- Soft genre hints: ${genres}
${maturityBlock}
${antiBlock}
${languagePromptLine(opts.language)}

bundle mode: packing the movie, music, and snack into one payload

STRICT RULES:
1. Return ONE movie OR TV show (mediaType "Movie" or "TV Series").
2. Return ONE music album OR lo-fi playlist-style album (real artist + album/playlist title).
3. Return ONE snack OR drink pairing (name + short fun pitch). Prefer real cocktail/snack names when possible.
4. searchQuery for watch = "Exact Title (YYYY)". searchQuery for music = "Artist - Album or Track".
5. Everything must feel like the SAME night / mood — cohesive, not random.

RESPONSE JSON FORMAT:
{
  "vibeLabel": "Short vibe name",
  "watch": {
    "title": "Exact Title",
    "releaseYear": "YYYY",
    "mediaType": "Movie",
    "matchReason": "Why this fits the vibe.",
    "searchQuery": "Exact Title (YYYY)"
  },
  "music": {
    "title": "Album or Track",
    "artist": "Artist",
    "matchReason": "Why this soundtrack fits.",
    "searchQuery": "Artist - Title"
  },
  "snack": {
    "name": "Hot cocoa with cinnamon",
    "kind": "drink",
    "pitch": "Warm, slow, rainy-window energy."
  }
}

Output ONLY valid JSON. No markdown fences.
`.trim();
}

function asList(parsed: any): any[] {
	if (Array.isArray(parsed?.recommendations)) return parsed.recommendations;
	if (Array.isArray(parsed)) return parsed;
	if (parsed?.title) return [parsed];
	return [];
}

export function parseGeminiBookRecs(raw: string): GeminiBookRec[] {
	const parsed = safeParseGeminiJson(raw);
	const out: GeminiBookRec[] = [];
	const seen = new Set<string>();
	for (const item of asList(parsed)) {
		const title = String(item?.title || '').trim();
		if (!title) continue;
		const key = title.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		const mt = /manga|manhwa|manhua|comic/i.test(String(item?.mediaType || ''))
			? 'Manga'
			: 'Book';
		out.push({
			title,
			author: String(item?.author || '').trim() || 'Unknown',
			releaseYear: String(item?.releaseYear || item?.year || '').slice(0, 4),
			mediaType: mt,
			actualGenres: Array.isArray(item?.actualGenres)
				? item.actualGenres.map(String)
				: [],
			matchReason: String(item?.matchReason || item?.pitch || '').trim(),
			searchQuery: String(item?.searchQuery || `${title} ${item?.author || ''}`).trim()
		});
		if (out.length >= REC_LIMIT) break;
	}
	return out;
}

export function parseGeminiBoardRecs(raw: string): GeminiBoardRec[] {
	const parsed = safeParseGeminiJson(raw);
	const out: GeminiBoardRec[] = [];
	const seen = new Set<string>();
	for (const item of asList(parsed)) {
		const title = String(item?.title || '').trim();
		if (!title) continue;
		const key = title.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			title,
			releaseYear: String(item?.releaseYear || item?.year || '').slice(0, 4),
			actualGenres: Array.isArray(item?.actualGenres)
				? item.actualGenres.map(String)
				: [],
			matchReason: String(item?.matchReason || item?.pitch || '').trim(),
			searchQuery: String(item?.searchQuery || title).trim(),
			playerCount: item?.playerCount ? String(item.playerCount) : undefined,
			complexity: item?.complexity ? String(item.complexity) : undefined
		});
		if (out.length >= REC_LIMIT) break;
	}
	return out;
}

export function parseGeminiRobloxRecs(raw: string): GeminiRobloxRec[] {
	const parsed = safeParseGeminiJson(raw);
	const out: GeminiRobloxRec[] = [];
	const seen = new Set<string>();
	for (const item of asList(parsed)) {
		const title = String(item?.title || '').trim();
		if (!title) continue;
		const key = title.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			title,
			releaseYear: String(item?.releaseYear || item?.year || '').slice(0, 4),
			actualGenres: Array.isArray(item?.actualGenres)
				? item.actualGenres.map(String)
				: [],
			matchReason: String(item?.matchReason || item?.pitch || '').trim(),
			searchQuery: String(item?.searchQuery || title).trim()
		});
		if (out.length >= REC_LIMIT) break;
	}
	return out;
}

export function parseGeminiVibeBundle(raw: string): GeminiVibeBundle {
	const parsed = safeParseGeminiJson(raw);
	const watch = parsed?.watch || parsed?.movie || parsed?.show;
	const music = parsed?.music || parsed?.album || parsed?.song;
	const snack = parsed?.snack || parsed?.drink || parsed?.pairing;
	if (!watch?.title || !music?.title || !snack?.name) {
		throw new Error('vibe bundle json missing watch/music/snack');
	}
	const snackKind = /drink|cocktail|beverage|tea|coffee|cocoa|wine|beer/i.test(
		String(snack.kind || snack.name || '')
	)
		? 'drink'
		: 'snack';
	return {
		vibeLabel: parsed?.vibeLabel ? String(parsed.vibeLabel) : undefined,
		watch: {
			title: String(watch.title).trim(),
			releaseYear: String(watch.releaseYear || watch.year || '').slice(0, 4),
			mediaType: String(watch.mediaType || 'Movie'),
			matchReason: String(watch.matchReason || '').trim(),
			searchQuery: String(watch.searchQuery || `${watch.title} (${watch.releaseYear || ''})`).trim()
		},
		music: {
			title: String(music.title).trim(),
			artist: String(music.artist || '').trim() || 'Unknown',
			matchReason: String(music.matchReason || '').trim(),
			searchQuery: String(
				music.searchQuery || `${music.artist || ''} - ${music.title}`
			).trim()
		},
		snack: {
			name: String(snack.name).trim(),
			kind: snackKind,
			pitch: String(snack.pitch || snack.matchReason || '').trim()
		}
	};
}
