// tmdb watch providers — /movie/{id}/watch/providers or /tv/{id}/watch/providers
// needs TMDB_API_KEY in .env

import { env } from '$env/dynamic/private';
import { normalizeRegion } from '$lib/regions';
import { providerOfferUrl } from '$lib/watchLinks';

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
 * Keeps Stream / Rent / Buy separate (same service can appear in rent AND buy).
 */
export async function fetchWatchProviders(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	region?: string | null;
	title?: string | null;
}): Promise<{ region: string; providers: WatchProvider[]; watchLink: string | null }> {
	const region = getWatchRegion(opts.region);
	const apiKey = env.TMDB_API_KEY || env.TMDB_READ_ACCESS_TOKEN;

	if (!apiKey || !opts.tmdbId) {
		return { region, providers: [], watchLink: null };
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
			return { region, providers: [], watchLink: null };
		}

		const data = await res.json();
		const country = data?.results?.[region] || data?.results?.US || null;
		if (!country) {
			return { region, providers: [], watchLink: null };
		}

		// TMDB returns a locale watch page (not per-provider deep links).
		// That page has working Stream/Rent/Buy click-throughs via JustWatch.
		const watchLink: string | null = country.link || null;
		const buckets: Array<{ key: keyof typeof country; type: WatchProvider['type'] }> = [
			{ key: 'flatrate', type: 'flatrate' },
			{ key: 'ads', type: 'ads' },
			{ key: 'free', type: 'free' },
			{ key: 'rent', type: 'rent' },
			{ key: 'buy', type: 'buy' }
		];

		const providers: WatchProvider[] = [];

		for (const b of buckets) {
			const list = country[b.key];
			if (!Array.isArray(list)) continue;
			const seen = new Set<number>();
			for (const p of list) {
				if (!p?.provider_id || seen.has(p.provider_id)) continue;
				seen.add(p.provider_id);
				const name = p.provider_name || 'Provider';
				providers.push({
					name,
					logo: logoUrl(p.logo_path),
					// Prefer a provider search/home URL; fall back to TMDB watch page
					url: providerOfferUrl({
						providerName: name,
						title: opts.title || '',
						fallbackUrl: watchLink
					}),
					type: b.type
				});
			}
		}

		return { region, providers, watchLink };
	} catch (e) {
		console.warn('tmdb providers blew up', e);
		return { region, providers: [], watchLink: null };
	}
}
