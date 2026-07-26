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
 * Build a useful destination for a TMDB watch provider icon.
 * TMDB only gives a shared /watch?locale= page (not Netflix/Disney deep links),
 * so we prefer a provider search URL when we recognize the service.
 */
export function providerOfferUrl(opts: {
	providerName: string;
	title: string;
	fallbackUrl?: string | null;
}): string | null {
	const name = opts.providerName.toLowerCase().trim();
	const q = encodeURIComponent(opts.title.trim());
	const hasTitle = Boolean(opts.title.trim());

	const search = (base: string) => (hasTitle ? `${base}${q}` : null);

	if (name.includes('netflix')) return search('https://www.netflix.com/search?q=');
	if (name.includes('disney')) return search('https://www.disneyplus.com/search?q=');
	if (name.includes('prime') || name === 'amazon video' || name.includes('amazon prime')) {
		return search('https://www.primevideo.com/search?phrase=');
	}
	if (name.includes('apple')) return search('https://tv.apple.com/search?term=');
	if (name.includes('google play') || name.includes('google tv')) {
		return search('https://play.google.com/store/search?c=movies&q=');
	}
	if (name.includes('youtube')) return search('https://www.youtube.com/results?search_query=');
	if (name.includes('hulu')) return search('https://www.hulu.com/search?q=');
	if (name === 'max' || name.includes('hbo max') || name.startsWith('hbo')) {
		return search('https://www.max.com/search?q=');
	}
	if (name.includes('paramount')) return search('https://www.paramountplus.com/search/?q=');
	if (name.includes('peacock')) return search('https://www.peacocktv.com/search?q=');
	if (name.includes('crunchyroll')) return search('https://www.crunchyroll.com/search?q=');
	if (name.includes('viaplay')) return search('https://viaplay.com/search?query=');
	if (name.includes('rakuten')) return search('https://www.rakuten.tv/search?q=');
	if (name.includes('mubi')) return search('https://mubi.com/search?query=');
	if (name.includes('curiosity')) return search('https://curiositystream.com/search?q=');
	if (name.includes('pluto')) return search('https://pluto.tv/search?q=');
	if (name.includes('tubi')) return search('https://tubitv.com/search/');
	if (name.includes('sky showtime') || name === 'showtime') {
		return search('https://www.skyshowtime.com/search?q=');
	}
	if (name.includes('sf anytime')) return search('https://www.sfanytime.com/search?q=');
	if (name.includes('blockbuster')) return search('https://www.blockbuster.dk/search?q=');
	if (name.includes('itunes')) return search('https://tv.apple.com/search?term=');

	return opts.fallbackUrl || null;
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
