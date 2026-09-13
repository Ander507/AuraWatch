/** Shared watch-provider shape for API responses, saved lists, and UI */

export type WatchProviderType = 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';

export type WatchProviderItem = {
	name: string;
	logo: string | null;
	url?: string | null;
	type?: WatchProviderType;
	/** Pre-formatted price label from JustWatch (e.g. "kr 29,00") */
	price?: string | null;
	currency?: string | null;
	/** SD, HD, or 4K */
	quality?: string | null;
};
