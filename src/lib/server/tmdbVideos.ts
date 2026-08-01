// TMDB videos — official YouTube trailer keys for in-app preview

import { env } from '$env/dynamic/private';

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

type TmdbVideo = {
	key?: string;
	site?: string;
	type?: string;
	official?: boolean;
	published_at?: string;
	name?: string;
};

function scoreTrailer(v: TmdbVideo): number {
	if (!v.key || String(v.site || '').toLowerCase() !== 'youtube') return -1;
	let score = 0;
	const type = String(v.type || '').toLowerCase();
	if (type === 'trailer') score += 20;
	else if (type === 'teaser') score += 10;
	else if (type === 'clip') score += 4;
	else score += 1;
	if (v.official) score += 5;
	if (/official/i.test(v.name || '')) score += 2;
	return score;
}

/**
 * Fetch the best YouTube trailer/teaser key for a TMDB movie or TV id.
 */
export async function fetchTmdbTrailerKey(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
}): Promise<string | null> {
	const { apiKey, useBearer, headers } = authHeaders();
	const id = opts.tmdbId;
	if (!apiKey || !id) return null;

	const url = withKey(
		`https://api.themoviedb.org/3/${opts.mediaType}/${id}/videos?language=en-US`,
		apiKey,
		useBearer
	);

	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return null;
		const data = await res.json();
		const results: TmdbVideo[] = data?.results || [];
		let best: TmdbVideo | null = null;
		let bestScore = -1;
		for (const v of results) {
			const s = scoreTrailer(v);
			if (s > bestScore) {
				bestScore = s;
				best = v;
			}
		}
		return best?.key ? String(best.key) : null;
	} catch (e) {
		console.warn('tmdb videos fail', opts.mediaType, id, e);
		return null;
	}
}
