import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTmdbTitles } from '$lib/server/tmdbSearch';
import { searchItunesMusic } from '$lib/server/itunesSearch';
import { searchIgdbGames } from '$lib/server/igdbSearch';
import { searchOpenLibrary } from '$lib/server/openLibrarySearch';
import { searchBggGames } from '$lib/server/bggSearch';
import { fetchOnMyOwnTrack, isSurronSongSecret } from '$lib/server/easterEggs';
import { normalizeLanguage } from '$lib/languages';
import { buildCacheKey, cacheGet, cacheSet } from '$lib/server/apiCache';
import { BOARD_GAMES_COMING_SOON, BOARD_GAMES_SOON_COPY } from '$lib/boardGamesGate';

export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
	// kind=music|games|books|boardgames — anything else = tmdb movies/tv
	let kind = (url.searchParams.get('kind') || url.searchParams.get('type') || 'media')
		.toLowerCase()
		.trim();
	const language = normalizeLanguage(
		url.searchParams.get('language') || url.searchParams.get('lang')
	);

	if (!q) {
		return json({ ok: true, results: [], total: 0, query: '', kind });
	}
	if (q.length > 120) throw error(400, 'query too long');

	let limit = Number(url.searchParams.get('limit') || 8);
	if (!Number.isFinite(limit)) limit = 8;

	const cacheKey = buildCacheKey('search', { q, kind, limit, language, v: kind.startsWith('board') ? 2 : 1 });
	const cached = await cacheGet<Record<string, unknown>>(cacheKey);
	if (cached && cached.ok) {
		return json(
			{ ...cached, fromCache: true },
			{ headers: { 'Cache-Control': 'private, max-age=120' } }
		);
	}

	const remember = async (payload: Record<string, unknown>, maxAge = 120) => {
		await cacheSet(cacheKey, payload, 24 * 60 * 60 * 1000);
		return json(payload, { headers: { 'Cache-Control': `private, max-age=${maxAge}` } });
	};

	if (kind === 'game' || kind === 'games' || kind === 'gaming') {
		const { results, total } = await searchIgdbGames(q, { limit });
		return remember({ ok: true, query: q, kind: 'games', total, results });
	}

	if (kind === 'book' || kind === 'books' || kind === 'manga') {
		const { results, total } = await searchOpenLibrary(q, { limit });
		await cacheSet(cacheKey, { ok: true, query: q, kind: 'books', total, results }, 24 * 60 * 60 * 1000);
		return json(
			{ ok: true, query: q, kind: 'books', total, results },
			{ headers: { 'Cache-Control': 'public, max-age=86400' } }
		);
	}

	if (kind === 'board' || kind === 'boardgame' || kind === 'boardgames' || kind === 'tabletop') {
		if (BOARD_GAMES_COMING_SOON) {
			return json(
				{
					ok: false,
					comingSoon: true,
					query: q,
					kind: 'boardgames',
					total: 0,
					results: [],
					error: BOARD_GAMES_SOON_COPY.title,
					message: BOARD_GAMES_SOON_COPY.body
				},
				{ status: 503, headers: { 'Cache-Control': 'private, max-age=30' } }
			);
		}
		try {
			const { results, total } = await searchBggGames(q, { limit, hydrateCovers: true });
			// don't cache empty misses — bgg 401s were poisoning the dropdown for a day
			if (!results.length) {
				return json(
					{ ok: true, query: q, kind: 'boardgames', total: 0, results: [] },
					{ headers: { 'Cache-Control': 'private, max-age=5' } }
				);
			}
			const payload = { ok: true, query: q, kind: 'boardgames', total, results };
			if (results.every((r) => !r.posterUrl && !r.image && !r.poster_path)) {
				return json(payload, { headers: { 'Cache-Control': 'private, max-age=5' } });
			}
			return remember(payload);
		} catch (e) {
			console.warn('board search route flopped', e);
			return json(
				{ ok: true, query: q, kind: 'boardgames', total: 0, results: [] },
				{ headers: { 'Cache-Control': 'private, max-age=5' } }
			);
		}
	}

	if (kind === 'music' || kind === 'song' || kind === 'songs') {
		if (isSurronSongSecret(q)) {
			const track = await fetchOnMyOwnTrack();
			if (track) {
				return remember(
					{
						ok: true,
						query: q,
						kind: 'music',
						total: 1,
						results: [
							{
								id: track.id,
								mediaType: 'song' as const,
								title: track.title,
								subtitle: track.artist,
								posterUrl: track.cover,
								year: track.year,
								rating: null,
								kindLabel: 'SONG' as const
							}
						]
					},
					300
				);
			}
		}

		const { results, total } = await searchItunesMusic(q, { limit });
		const mapped = [];
		for (const hit of results) {
			if (hit.hitKind === 'artist') {
				mapped.push({
					id: hit.id,
					mediaType: 'artist' as const,
					title: hit.name,
					subtitle: hit.genre,
					posterUrl: hit.cover,
					year: null,
					rating: null,
					kindLabel: 'ARTIST' as const
				});
			} else {
				mapped.push({
					id: hit.id,
					mediaType: 'song' as const,
					title: hit.title,
					subtitle: hit.artist,
					posterUrl: hit.cover,
					year: hit.year,
					rating: null,
					kindLabel: 'SONG' as const
				});
			}
		}
		return remember({ ok: true, query: q, kind: 'music', total, results: mapped });
	}

	const { results, total } = await searchTmdbTitles(q, { limit, language });
	return remember({ ok: true, query: q, kind: 'media', total, results });
};
