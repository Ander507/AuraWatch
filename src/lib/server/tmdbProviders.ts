// tmdb watch providers — /movie/{id}/watch/providers or /tv/{id}/watch/providers
// needs TMDB_API_KEY in .env
// Deep links come from JustWatch GraphQL (same destinations as TMDB's click.justwatch.com links).

import { env } from '$env/dynamic/private';
import { normalizeRegion } from '$lib/regions';
import { providerOfferUrl } from '$lib/watchLinks';
import { fetchJustWatchProviders } from '$lib/server/justwatchOffers';

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

function normalizeName(name: string) {
	return name
		.toLowerCase()
		.replace(/\+/g, ' plus ')
		.replace(/\b(store|video|movies?)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Prefer TMDB logos when we can match a JustWatch offer to a TMDB provider. */
function mergeTmdbLogos(
	jwProviders: WatchProvider[],
	tmdbProviders: WatchProvider[]
): WatchProvider[] {
	return jwProviders.map((p) => {
		const key = normalizeName(p.name);
		const hit = tmdbProviders.find((t) => {
			const tk = normalizeName(t.name);
			return tk === key || tk.includes(key) || key.includes(tk);
		});
		return hit?.logo ? { ...p, logo: hit.logo } : p;
	});
}

async function fetchTmdbProviderBuckets(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	region: string;
	title?: string | null;
}): Promise<{ watchLink: string | null; providers: WatchProvider[] }> {
	const apiKey = env.TMDB_API_KEY || env.TMDB_READ_ACCESS_TOKEN;
	if (!apiKey || !opts.tmdbId) {
		return { watchLink: null, providers: [] };
	}

	const kind = opts.mediaType === 'movie' ? 'movie' : 'tv';
	const url = `https://api.themoviedb.org/3/${kind}/${opts.tmdbId}/watch/providers?api_key=${apiKey}`;

	try {
		const headers: Record<string, string> = { Accept: 'application/json' };
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
			return { watchLink: null, providers: [] };
		}

		const data = await res.json();
		const country = data?.results?.[opts.region] || data?.results?.US || null;
		if (!country) {
			return { watchLink: null, providers: [] };
		}

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
					url: providerOfferUrl({
						providerName: name,
						title: opts.title || '',
						fallbackUrl: watchLink
					}),
					type: b.type
				});
			}
		}

		return { watchLink, providers };
	} catch (e) {
		console.warn('tmdb providers blew up', e);
		return { watchLink: null, providers: [] };
	}
}

/**
 * Grab streaming / rent / buy providers for a title in a region.
 * Prefers JustWatch deep links (same destinations as TMDB's affiliate clicks);
 * falls back to TMDB logos + search URLs when JustWatch is unavailable.
 */
export async function fetchWatchProviders(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	region?: string | null;
	title?: string | null;
}): Promise<{ region: string; providers: WatchProvider[]; watchLink: string | null }> {
	const region = getWatchRegion(opts.region);
	const title = opts.title?.trim() || '';

	const [tmdb, jw] = await Promise.all([
		fetchTmdbProviderBuckets({
			tmdbId: opts.tmdbId,
			mediaType: opts.mediaType,
			region,
			title
		}),
		title
			? fetchJustWatchProviders({
					tmdbId: opts.tmdbId,
					mediaType: opts.mediaType,
					region,
					title
				})
			: Promise.resolve(null)
	]);

	if (jw?.providers?.length) {
		return {
			region,
			providers: mergeTmdbLogos(jw.providers, tmdb.providers),
			watchLink: tmdb.watchLink
		};
	}

	return { region, providers: tmdb.providers, watchLink: tmdb.watchLink };
}
