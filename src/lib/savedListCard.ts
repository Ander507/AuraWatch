/** Shared shape for My List sidebar + /list/[slug] cards */

export type SavedWatchProvider = {
	name: string;
	logo: string | null;
	url?: string | null;
	type?: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
};

export type SavedListCardItem = {
	id: string;
	title: string;
	cover: string;
	format?: string;
	year?: string;
	description?: string;
	providers?: SavedWatchProvider[];
};
