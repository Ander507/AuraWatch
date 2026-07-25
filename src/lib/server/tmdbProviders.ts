// tmdb watch providers — /movie/{id}/watch/providers or /tv/{id}/watch/providers
// needs TMDB_API_KEY in .env

import { env } from '$env/dynamic/private';
import { normalizeRegion } from '$lib/regions';

const IMG = 'https://image.tmdb.org/t/p/w92';

export type WatchProvider = {
	name: string;
	logo: string | null;
	url: string | null;
	type: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
};

// user-picked region from the UI wins; env is only a last-ditch default
export function getWatchRegion(override?: string | null) {
	return normalizeRegion(override || env.TMDB_WATCH_REGION || 'US');
}

function logoUrl(path: string | null | undefined) {
	if (!path) return null;
	return `${IMG}${path}`;
}

/**
 * Grab streaming / rent / buy providers for a title in a region.
 * Prefers flatrate (subscription), then ads/free, then rent/buy.
 */
export async function fetchWatchProviders(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	region?: string | null;
}): Promise<{ region: string; providers: WatchProvider[]; justWatchLink: string | null }> {
	const region = getWatchRegion(opts.region);
	const apiKey = env.TMDB_API_KEY || env.TMDB_READ_ACCESS_TOKEN;

	if (!apiKey || !opts.tmdbId) {
		return { region, providers: [], justWatchLink: null };
	}

	const kind = opts.mediaType === 'movie' ? 'movie' : 'tv';
	// v3 API key as query param — also works with bearer for read token but keeping it simple
	const url = `https://api.themoviedb.org/3/${kind}/${opts.tmdbId}/watch/providers?api_key=${apiKey}`;

	try {
		const headers: Record<string, string> = { Accept: 'application/json' };
		// if they pasted a JWT-ish read access token instead of api key
		if (apiKey.startsWith('eyJ')) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const res = await fetch(
			apiKey.startsWith('eyJ')
				? `https://api.themoviedb.org/3/${kind}/${opts.tmdbId}/watch/providers`
				: url,
			{ headers }
		);

		if (!res.ok) {
			console.warn('tmdb providers fail', res.status);
			return { region, providers: [], justWatchLink: null };
		}

		const data = await res.json();
		const country = data?.results?.[region] || data?.results?.US || null;
		if (!country) {
			return { region, providers: [], justWatchLink: data?.results ? null : null };
		}

		const justWatchLink: string | null = country.link || null;
		const buckets: Array<{ key: keyof typeof country; type: WatchProvider['type'] }> = [
			{ key: 'flatrate', type: 'flatrate' },
			{ key: 'ads', type: 'ads' },
			{ key: 'free', type: 'free' },
			{ key: 'rent', type: 'rent' },
			{ key: 'buy', type: 'buy' }
		];

		const seen = new Set<number>();
		const providers: WatchProvider[] = [];

		for (const b of buckets) {
			const list = country[b.key];
			if (!Array.isArray(list)) continue;
			for (const p of list) {
				if (!p?.provider_id || seen.has(p.provider_id)) continue;
				seen.add(p.provider_id);
				providers.push({
					name: p.provider_name || 'Provider',
					logo: logoUrl(p.logo_path),
					// TMDB only gives a JustWatch deep link for the whole title, not per provider
					url: justWatchLink,
					type: b.type
				});
			}
		}

		// keep it short for the UI
		return { region, providers: providers.slice(0, 8), justWatchLink };
	} catch (e) {
		console.warn('tmdb providers blew up', e);
		return { region, providers: [], justWatchLink: null };
	}
}
