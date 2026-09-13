import { json, error, type RequestHandler } from '@sveltejs/kit';
import { fetchWatchProviders } from '$lib/server/tmdbProviders';
import { normalizeRegion } from '$lib/regions';

export const GET: RequestHandler = async ({ url }) => {
	const mediaTypeRaw = String(url.searchParams.get('mediaType') || '').toLowerCase();
	const mediaType = mediaTypeRaw === 'tv' ? 'tv' : mediaTypeRaw === 'movie' ? 'movie' : null;
	const id = Number(url.searchParams.get('id'));
	const region = normalizeRegion(url.searchParams.get('region') || 'DK');

	if (!mediaType || !Number.isFinite(id) || id <= 0) {
		throw error(400, 'mediaType (movie|tv) and positive id required');
	}

	// extracting regional flatrate providers from tmdb to show instant streaming platforms
	const result = await fetchWatchProviders({
		tmdbId: id,
		mediaType,
		region
	});

	const flatrate = result.providers.filter(
		(p) => p.type === 'flatrate' || p.type === 'ads' || p.type === 'free'
	);

	return json({
		ok: true,
		region: result.region,
		flatrate,
		providers: result.providers,
		watchLink: result.watchLink
	});
};
