/** TMDB TV details — season counts for Series Length filter / badges */

import { env } from '$env/dynamic/private';
import { cachedJsonFetch } from '$lib/server/httpCache';

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

/** Fetch number_of_seasons for a TMDB TV id. */
export async function fetchTvSeasonCount(tmdbId: number): Promise<number | null> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey || !tmdbId) return null;

	const url = withKey(
		`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`,
		apiKey,
		useBearer
	);

	try {
		const res = await cachedJsonFetch(url, { headers }, { ttlMs: 24 * 60 * 60 * 1000 });
		if (!res.ok || !res.data) return null;
		const n = res.data.number_of_seasons;
		if (typeof n === 'number' && n > 0) return n;
		return null;
	} catch (e) {
		console.warn('tmdb tv details fail', tmdbId, e);
		return null;
	}
}
