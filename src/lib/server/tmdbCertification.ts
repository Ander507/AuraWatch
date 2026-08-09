/** TMDB US content certification (movie release_dates / TV content_ratings) */

import { env } from '$env/dynamic/private';
import { cachedJsonFetch } from '$lib/server/httpCache';
import { certificationAllowed, type MaturityLevel } from '$lib/server/maturity';

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

function pickUsMovieCert(data: any): string | null {
	const results: any[] = data?.results || [];
	const us = results.find((r) => String(r?.iso_3166_1 || '').toUpperCase() === 'US');
	if (!us || !Array.isArray(us.release_dates)) return null;

	// Prefer theatrical (type 3), then digital/physical, then any with a cert
	const ranked = [...us.release_dates].sort((a, b) => {
		const rank = (t: number) => (t === 3 ? 0 : t === 4 ? 1 : t === 5 ? 2 : 3);
		return rank(Number(a?.type) || 99) - rank(Number(b?.type) || 99);
	});

	for (const rd of ranked) {
		const cert = String(rd?.certification || '').trim();
		if (cert) return cert;
	}
	return null;
}

function pickUsTvCert(data: any): string | null {
	const results: any[] = data?.results || [];
	const us = results.find((r) => String(r?.iso_3166_1 || '').toUpperCase() === 'US');
	const cert = String(us?.rating || '').trim();
	return cert || null;
}

/** Fetch the US certification string for a TMDB movie/TV id, or null if unknown. */
export async function fetchTmdbCertification(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
}): Promise<string | null> {
	const { tmdbId, mediaType } = opts;
	if (!tmdbId) return null;

	const { apiKey, useBearer, headers } = authHeaders();
	if (!apiKey) return null;

	try {
		if (mediaType === 'movie') {
			const url = withKey(
				`https://api.themoviedb.org/3/movie/${tmdbId}/release_dates`,
				apiKey,
				useBearer
			);
			const res = await tmdbJson(url, headers);
			if (!res.ok || !res.data) return null;
			return pickUsMovieCert(res.data);
		}

		const url = withKey(
			`https://api.themoviedb.org/3/tv/${tmdbId}/content_ratings`,
			apiKey,
			useBearer
		);
		const res = await tmdbJson(url, headers);
		if (!res.ok || !res.data) return null;
		return pickUsTvCert(res.data);
	} catch {
		return null;
	}
}

/** True when the title passes the maturity gate (or maturity is off / mature).
 * Always fetches certification when possible so the UI can show an age badge.
 */
export async function passesMaturityGate(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	maturity: MaturityLevel | null;
}): Promise<{ ok: boolean; certification: string | null }> {
	if (!opts.tmdbId) {
		return { ok: true, certification: null };
	}

	const certification = await fetchTmdbCertification({
		tmdbId: opts.tmdbId,
		mediaType: opts.mediaType
	});

	if (!opts.maturity || opts.maturity === 'mature') {
		return { ok: true, certification };
	}

	return {
		ok: certificationAllowed(certification, opts.maturity),
		certification
	};
}
