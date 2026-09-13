import type { WatchProviderItem, WatchProviderType } from '$lib/watchProviderTypes';

export type ProviderGroup = { label: string; items: WatchProviderItem[] };

/** Group providers into Stream / Rent / Buy like the TMDB watch page. */
export function providerGroups(providers: WatchProviderItem[] | undefined): ProviderGroup[] {
	if (!providers?.length) return [];
	const hasTypes = providers.some((p) => p.type);
	if (!hasTypes) {
		return [{ label: '', items: providers }];
	}

	const buckets: Array<{ label: string; types: WatchProviderType[] }> = [
		{ label: 'Stream', types: ['flatrate', 'ads', 'free'] },
		{ label: 'Rent', types: ['rent'] },
		{ label: 'Buy', types: ['buy'] }
	];

	return buckets
		.map((b) => ({
			label: b.label,
			items: providers.filter((p) => p.type && b.types.includes(p.type))
		}))
		.filter((g) => g.items.length > 0);
}

export function qualityBadgeLabel(quality: string | null | undefined): string | null {
	const t = String(quality || '').toUpperCase();
	if (!t || t === 'ADS') return null;
	if (t === '_4K' || t === '4K') return '4K';
	if (t === 'HD' || t === 'SD') return t;
	return null;
}

export function providerPriceLabel(p: WatchProviderItem): string | null {
	if (p.price?.trim()) return p.price.trim();
	return null;
}
