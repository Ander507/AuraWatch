import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTmdbTitles } from '$lib/server/tmdbSearch';
import { searchItunesMusic } from '$lib/server/itunesSearch';
import { fetchOnMyOwnTrack, isSurronSongSecret } from '$lib/server/easterEggs';

export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
	// kind=music for songs, anything else = tmdb movies/tv
	let kind = (url.searchParams.get('kind') || url.searchParams.get('type') || 'media')
		.toLowerCase()
		.trim();

	if (!q) {
		return json({ ok: true, results: [], total: 0, query: '', kind });
	}
	if (q.length > 120) throw error(400, 'query too long');

	let limit = Number(url.searchParams.get('limit') || 8);
	if (!Number.isFinite(limit)) limit = 8;

	if (kind === 'music' || kind === 'song' || kind === 'songs') {
		// 🤫 Surron / Talaria → only On My Own
		if (isSurronSongSecret(q)) {
			const track = await fetchOnMyOwnTrack();
			if (track) {
				return json({
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
				});
			}
		}

		const { results, total } = await searchItunesMusic(q, { limit });
		// flatten to the same shape the dropdown expects
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
		return json({ ok: true, query: q, kind: 'music', total, results: mapped });
	}

	const { results, total } = await searchTmdbTitles(q, { limit });
	return json({ ok: true, query: q, kind: 'media', total, results });
};
