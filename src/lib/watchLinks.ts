export type MediaType = 'movie' | 'tv' | 'anime';

export interface WatchOption {
	name: string;
	url: string;
	icon?: string;
	isCustom?: boolean;
}

/** Deep-link search on Zflix for a title. */
export function getZflixUrl(title: string): string {
	return `https://www.zflix.lol/search?q=${encodeURIComponent(title)}`;
}

/**
 * Build "where to watch / look this up" links for a recommendation.
 * `tmdbId` is optional — when present, TMDB gets a direct title page.
 */
export function generateWatchLinks(
	title: string,
	type: MediaType = 'movie',
	tmdbId?: number
): WatchOption[] {
	const encodedTitle = encodeURIComponent(title);
	const links: WatchOption[] = [
		{
			name: 'Zflix',
			url: getZflixUrl(title),
			isCustom: true
		},
		{
			name: 'JustWatch',
			url: `https://www.justwatch.com/us/search?q=${encodedTitle}`
		}
	];

	if (type === 'anime') {
		links.push(
			{
				name: 'Crunchyroll',
				url: `https://www.crunchyroll.com/search?q=${encodedTitle}`
			},
			{
				name: 'MyAnimeList',
				url: `https://myanimelist.net/search/all?q=${encodedTitle}`
			}
		);
	} else {
		if (tmdbId) {
			links.push({
				name: 'TMDB',
				url: `https://www.themoviedb.org/${type}/${tmdbId}`
			});
		}
		links.push({
			name: 'IMDb',
			url: `https://www.imdb.com/find/?q=${encodedTitle}`
		});
	}

	return links;
}

/** Map AuraWatch / Gemini media_type into our link generator. */
export function resolveMediaType(raw?: string | null): MediaType {
	const t = String(raw || '').toLowerCase().trim();
	if (t === 'anime') return 'anime';
	if (t === 'tv' || t === 'show' || t === 'series') return 'tv';
	if (t === 'movie' || t === 'film') return 'movie';
	// AuraWatch sometimes returns "either" — default to anime-friendly links
	// since the mock catalog is anime-heavy.
	if (t === 'either' || t === '') return 'anime';
	return 'movie';
}
