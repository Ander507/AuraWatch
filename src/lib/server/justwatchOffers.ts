/**
 * JustWatch GraphQL offers — real title deep links (Disney+/Apple TV/etc.).
 * TMDB's public watch/providers API only returns logos + a shared /watch page;
 * these standardWebURL values are what TMDB embeds behind click.justwatch.com.
 */

const JW_GQL = 'https://apis.justwatch.com/graphql';
const JW_IMG = 'https://images.justwatch.com';

export type JustWatchProvider = {
	name: string;
	logo: string | null;
	url: string | null;
	type: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
};

type JwOffer = {
	monetizationType?: string;
	presentationType?: string;
	standardWebURL?: string | null;
	package?: {
		packageId?: number;
		clearName?: string;
		icon?: string | null;
	} | null;
};

type JwTitleNode = {
	id?: string;
	objectType?: string;
	content?: {
		title?: string;
		fullPath?: string | null;
		externalIds?: { tmdbId?: string | null } | null;
	} | null;
	offers?: JwOffer[] | null;
};

const QUALITY_RANK: Record<string, number> = {
	_4K: 4,
	'4K': 4,
	HD: 3,
	SD: 2,
	ADS: 1
};

function iconUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	const resolved = path.replace('{profile}', 's100').replace('{format}', 'png');
	if (resolved.startsWith('http')) return resolved;
	return `${JW_IMG}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
}

function mapMonetization(raw: string | undefined): JustWatchProvider['type'] | null {
	const t = String(raw || '').toUpperCase();
	if (t === 'FLATRATE') return 'flatrate';
	if (t === 'RENT') return 'rent';
	if (t === 'BUY') return 'buy';
	if (t === 'ADS') return 'ads';
	if (t === 'FREE') return 'free';
	return null;
}

async function jwGraphql<T>(
	query: string,
	variables: Record<string, unknown>
): Promise<T | null> {
	try {
		const res = await fetch(JW_GQL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'User-Agent': 'AuraWatch/1.0'
			},
			body: JSON.stringify({ query, variables })
		});
		if (!res.ok) {
			console.warn('justwatch graphql http', res.status);
			return null;
		}
		const json = await res.json();
		if (json?.errors?.length) {
			console.warn('justwatch graphql errors', json.errors[0]?.message || json.errors);
			return null;
		}
		return (json?.data as T) || null;
	} catch (e) {
		console.warn('justwatch graphql blew up', e);
		return null;
	}
}

/** Find JustWatch node id whose external TMDB id matches. */
async function resolveJustWatchTitle(opts: {
	title: string;
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	country: string;
}): Promise<{ id: string; fullPath: string | null } | null> {
	const objectType = opts.mediaType === 'tv' ? 'SHOW' : 'MOVIE';
	const data = await jwGraphql<{
		popularTitles?: { edges?: Array<{ node?: JwTitleNode }> };
	}>(
		`query ResolveTitle($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) {
			popularTitles(country: $country, first: $first, filter: $filter) {
				edges {
					node {
						id
						objectType
						content(country: $country, language: $language) {
							title
							fullPath
							externalIds { tmdbId }
						}
					}
				}
			}
		}`,
		{
			country: opts.country,
			language: 'en',
			first: 8,
			filter: {
				searchQuery: opts.title,
				objectTypes: [objectType]
			}
		}
	);

	const edges = data?.popularTitles?.edges || [];
	const want = String(opts.tmdbId);
	const exact = edges.find((e) => e?.node?.content?.externalIds?.tmdbId === want)?.node;
	if (!exact?.id) return null;
	return { id: exact.id, fullPath: exact.content?.fullPath || null };
}

function dedupeOffers(offers: JwOffer[]): JustWatchProvider[] {
	const best = new Map<string, { provider: JustWatchProvider; quality: number }>();

	for (const offer of offers) {
		const type = mapMonetization(offer.monetizationType);
		const url = offer.standardWebURL?.trim() || null;
		const packageId = offer.package?.packageId;
		const name = offer.package?.clearName?.trim();
		if (!type || !url || !packageId || !name) continue;

		const key = `${packageId}:${type}`;
		const quality = QUALITY_RANK[String(offer.presentationType || '').toUpperCase()] ?? 0;
		const prev = best.get(key);
		if (prev && prev.quality >= quality) continue;

		best.set(key, {
			quality,
			provider: {
				name,
				logo: iconUrl(offer.package?.icon),
				url,
				type
			}
		});
	}

	const order: JustWatchProvider['type'][] = ['flatrate', 'ads', 'free', 'rent', 'buy'];
	return [...best.values()]
		.map((v) => v.provider)
		.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

/**
 * Pull Stream/Rent/Buy offers with real provider deep links for a TMDB title.
 */
export async function fetchJustWatchProviders(opts: {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	region: string;
	title: string;
}): Promise<{ providers: JustWatchProvider[]; justWatchPath: string | null } | null> {
	if (!opts.tmdbId || !opts.title.trim()) return null;

	const country = opts.region.toUpperCase();
	const resolved = await resolveJustWatchTitle({
		title: opts.title.trim(),
		tmdbId: opts.tmdbId,
		mediaType: opts.mediaType,
		country
	});
	if (!resolved) return null;

	const data = await jwGraphql<{ node?: JwTitleNode | null }>(
		`query TitleOffers($country: Country!, $id: ID!) {
			node(id: $id) {
				... on Movie {
					id
					offers(country: $country, platform: WEB) {
						monetizationType
						presentationType
						standardWebURL
						package { packageId clearName icon }
					}
				}
				... on Show {
					id
					offers(country: $country, platform: WEB) {
						monetizationType
						presentationType
						standardWebURL
						package { packageId clearName icon }
					}
				}
			}
		}`,
		{ country, id: resolved.id }
	);

	const offers = data?.node?.offers;
	if (!Array.isArray(offers) || !offers.length) return null;

	const providers = dedupeOffers(offers);
	if (!providers.length) return null;

	return { providers, justWatchPath: resolved.fullPath };
}
