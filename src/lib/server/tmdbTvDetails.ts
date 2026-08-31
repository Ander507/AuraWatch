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

/** Movie runtime or typical TV episode length in minutes. */
export async function fetchTmdbRuntimeMinutes(
	tmdbId: number,
	mediaType: 'movie' | 'tv',
	language?: string | null
): Promise<number | null> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey || !tmdbId) return null;

	const lang = String(language || '').trim() || 'en-US';
	const path = mediaType === 'tv' ? `tv/${tmdbId}` : `movie/${tmdbId}`;
	const url = withKey(
		`https://api.themoviedb.org/3/${path}?language=${encodeURIComponent(lang)}`,
		apiKey,
		useBearer
	);

	try {
		const res = await cachedJsonFetch(url, { headers }, { ttlMs: 24 * 60 * 60 * 1000 });
		if (!res.ok || !res.data) return null;
		if (mediaType === 'movie') {
			const n = res.data.runtime;
			if (typeof n === 'number' && n > 0) return n;
			return null;
		}
		const eps = res.data.episode_run_time;
		if (Array.isArray(eps) && typeof eps[0] === 'number' && eps[0] > 0) return eps[0];
		return null;
	} catch (e) {
		console.warn('tmdb runtime fail', tmdbId, e);
		return null;
	}
}

/** Fetch number_of_seasons for a TMDB TV id. */
export async function fetchTvSeasonCount(
	tmdbId: number,
	language?: string | null
): Promise<number | null> {
	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey || !tmdbId) return null;

	const lang = String(language || '').trim() || 'en-US';
	const url = withKey(
		`https://api.themoviedb.org/3/tv/${tmdbId}?language=${encodeURIComponent(lang)}`,
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
