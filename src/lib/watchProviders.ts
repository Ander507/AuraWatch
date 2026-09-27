import type { WatchProviderItem } from '$lib/watchProviderTypes';

export type WatchProviderBadge = WatchProviderItem & {
	url: string | null;
};

export type WatchProvidersResponse = {
	ok: boolean;
	region: string;
	flatrate: WatchProviderBadge[];
	providers: WatchProviderBadge[];
	watchLink: string | null;
	error?: string;
};

export function tmdbKindFromLabel(mediaType?: string | null): 'movie' | 'tv' {
	const m = String(mediaType || '').toLowerCase();
	if (m.includes('movie') && !m.includes('series')) return 'movie';
	return 'tv';
}

// extracting regional flatrate providers from tmdb to show instant streaming platforms
export async function fetchWatchProviders(
	mediaType: 'movie' | 'tv',
	id: number,
	region = 'US',
	title = ''
): Promise<WatchProvidersResponse> {
	const params = new URLSearchParams({
		mediaType,
		id: String(id),
		region
	});
	if (title.trim()) params.set('title', title.trim());
	const res = await fetch(`/api/watch-providers?${params}`);
	if (!res.ok) {
		return {
			ok: false,
			region,
			flatrate: [],
			providers: [],
			watchLink: null,
			error: `HTTP ${res.status}`
		};
	}
	return (await res.json()) as WatchProvidersResponse;
}

export function flatrateProviders(
	providers: Array<{ name?: string; logo?: string | null; url?: string | null; type?: string | null }> | undefined
) {
	if (!providers?.length) return [];
	return providers.filter(
		(p) => p?.name && (!p.type || p.type === 'flatrate' || p.type === 'ads' || p.type === 'free')
	);
}
