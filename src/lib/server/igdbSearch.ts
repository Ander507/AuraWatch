/**
 * IGDB game search / enrichment (Twitch-backed API v4).
 * Server-only — IGDB blocks browser CORS.
 */

import { getIgdbAuth, howManyIgdbCreds, invalidateIgdbToken } from '$lib/server/igdbAuth';
import { certificationAllowed, type MaturityLevel } from '$lib/server/maturity';

const IGDB_BASE = 'https://api.igdb.com/v4';

type CacheEntry = { expires: number; data: any[] };
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Website category / type ids (legacy category + newer website_types). */
const WEB_OFFICIAL = 1;
const WEB_STEAM = 13;
const WEB_ITCH = 15;
const WEB_EPIC = 16;
const WEB_GOG = 17;
const WEB_XBOX = 22;
const WEB_PLAYSTATION = 23;
const WEB_NINTENDO = 24;

/** Age rating org: ESRB = 1, PEGI = 2 */
const ORG_ESRB = 1;
const ORG_PEGI = 2;

/**
 * Legacy age_ratings.rating enum → display label.
 * ESRB: EC=7 E=8 E10=9 T=10 M=11 AO=12 RP=6
 * PEGI: Three=1 Seven=2 Twelve=3 Sixteen=4 Eighteen=5
 */
const RATING_LABEL: Record<number, string> = {
	1: 'PEGI 3',
	2: 'PEGI 7',
	3: 'PEGI 12',
	4: 'PEGI 16',
	5: 'PEGI 18',
	6: 'RP',
	7: 'EC',
	8: 'E',
	9: 'E10+',
	10: 'T',
	11: 'M',
	12: 'AO'
};

export type IgdbPlatform = {
	name: string;
	abbreviation: string | null;
};

export type IgdbStoreLink = {
	name: string;
	url: string;
	logo: string | null;
	/** IGDB website category / type id (1=Official, 13=Steam, 16=Epic, 17=GOG, …) */
	category?: number;
	type?: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
};

export type IgdbGameHit = {
	id: number;
	title: string;
	slug: string | null;
	coverUrl: string | null;
	year: string | null;
	rating: number | null;
	summary: string | null;
	genres: string[];
	platforms: IgdbPlatform[];
	stores: IgdbStoreLink[];
	igdbUrl: string | null;
	contentRating: string | null;
	/** Normalized cert for maturity gate (E / T / M / PEGI 12 …) */
	maturityCert: string | null;
};

export type IgdbSearchResult = {
	id: number;
	mediaType: 'game';
	title: string;
	subtitle: string | null;
	posterUrl: string | null;
	year: string | null;
	rating: number | null;
	kindLabel: 'GAME';
};

function coverUrlFromImageId(imageId: string | null | undefined, size = 'cover_big_2x'): string | null {
	if (!imageId) return null;
	return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

function yearFromUnix(ts: number | null | undefined): string | null {
	if (!ts || !Number.isFinite(ts)) return null;
	const y = new Date(ts * 1000).getUTCFullYear();
	return Number.isFinite(y) && y > 1970 ? String(y) : null;
}

function escapeSearch(q: string) {
	return q.replace(/"/g, '').trim().slice(0, 120);
}

async function igdbPost(endpoint: string, body: string, retried = false): Promise<any[]> {
	if (!howManyIgdbCreds()) return [];

	const cacheKey = `${endpoint}::${body}`;
	const hit = responseCache.get(cacheKey);
	if (hit && hit.expires > Date.now()) return hit.data;

	const { clientId, accessToken } = await getIgdbAuth();
	const url = `${IGDB_BASE}/${endpoint}`;

	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Client-ID': clientId,
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json',
				'Content-Type': 'text/plain'
			},
			body
		});
	} catch {
		return [];
	}

	if (res.status === 401 && !retried) {
		invalidateIgdbToken();
		return igdbPost(endpoint, body, true);
	}

	if (res.status === 429) {
		// brief backoff once
		await new Promise((r) => setTimeout(r, 350));
		if (!retried) return igdbPost(endpoint, body, true);
		return [];
	}

	if (!res.ok) return [];

	let data: unknown = null;
	try {
		data = await res.json();
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];

	responseCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data });
	if (responseCache.size > 200) {
		const first = responseCache.keys().next().value;
		if (first) responseCache.delete(first);
	}
	return data;
}

function websiteTypeId(w: any): number {
	const raw = w?.category ?? w?.type;
	if (raw && typeof raw === 'object') return Number(raw.id ?? raw);
	return Number(raw);
}

function isSocialOrWikiUrl(url: string): boolean {
	return /facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|twitch\.tv|reddit\.com|discord\.(gg|com)|wikipedia\.org|fandom\.com|wikia\.com|bluesky\.app/i.test(
		url
	);
}

/**
 * Map an IGDB website row → store link.
 * Category enums win over URL heuristics so Official (1) is never swallowed by microsoft.com → Xbox.
 */
function storeFromWebsite(w: any): IgdbStoreLink | null {
	const url = String(w?.url || '').trim();
	if (!url) return null;
	const cat = websiteTypeId(w);
	const withCat = (name: string, category?: number): IgdbStoreLink => ({
		name,
		url,
		logo: null,
		category: Number.isFinite(category as number)
			? (category as number)
			: Number.isFinite(cat)
				? cat
				: undefined
	});

	// Strict IGDB category / type enums first
	if (cat === WEB_OFFICIAL) return withCat('Official site', WEB_OFFICIAL);
	if (cat === WEB_STEAM) return withCat('Steam', WEB_STEAM);
	if (cat === WEB_EPIC) return withCat('Epic', WEB_EPIC);
	if (cat === WEB_GOG) return withCat('GOG', WEB_GOG);
	if (cat === WEB_ITCH) return withCat('itch.io', WEB_ITCH);
	if (cat === WEB_PLAYSTATION) return withCat('PlayStation Store', WEB_PLAYSTATION);
	if (cat === WEB_XBOX) return withCat('Xbox Store', WEB_XBOX);
	if (cat === WEB_NINTENDO) return withCat('Nintendo eShop', WEB_NINTENDO);

	// URL heuristics when category is missing / unknown
	if (/steampowered\.com/i.test(url)) return withCat('Steam', WEB_STEAM);
	if (/epicgames\.com/i.test(url)) return withCat('Epic', WEB_EPIC);
	if (/gog\.com/i.test(url)) return withCat('GOG', WEB_GOG);
	if (/itch\.io/i.test(url)) return withCat('itch.io', WEB_ITCH);
	if (
		/store\.playstation\.com/i.test(url) ||
		/playstation\.com\/.*(game|product|store)/i.test(url) ||
		/playstation\.com/i.test(url)
	) {
		return withCat('PlayStation Store', WEB_PLAYSTATION);
	}
	if (
		/xbox\.com/i.test(url) ||
		/microsoft\.com\/.*(store|p\/|xbox|games)/i.test(url) ||
		/marketplace\.xbox/i.test(url) ||
		/microsoft\.com/i.test(url)
	) {
		return withCat('Xbox Store', WEB_XBOX);
	}
	if (/nintendo\.com|eshop\.nintendo/i.test(url)) {
		return withCat('Nintendo eShop', WEB_NINTENDO);
	}
	if (!isSocialOrWikiUrl(url) && (!Number.isFinite(cat) || cat === 0)) {
		return withCat('Official site', WEB_OFFICIAL);
	}

	return null;
}

type StoreFamily = 'pc' | 'playstation' | 'xbox' | 'nintendo' | 'mobile' | 'official' | 'igdb' | 'other';

function storeFamily(store: IgdbStoreLink): StoreFamily {
	const n = store.name.toLowerCase();
	const u = store.url.toLowerCase();
	if (n === 'igdb' || /igdb\.com/i.test(u)) return 'igdb';
	if (n.includes('official')) return 'official';
	return storeFamilyFromUrl(u, n);
}

function storeFamilyFromUrl(u: string, n: string): StoreFamily {
	if (
		n.includes('steam') ||
		n.includes('epic') ||
		n.includes('gog') ||
		n.includes('itch') ||
		/steampowered\.com|epicgames\.com|gog\.com|itch\.io/i.test(u)
	) {
		return 'pc';
	}
	if (n.includes('playstation') || /playstation\.com/i.test(u)) return 'playstation';
	if (n.includes('xbox') || /xbox\.com|microsoft\.com/i.test(u)) return 'xbox';
	if (n.includes('nintendo') || /nintendo\.com/i.test(u)) return 'nintendo';
	if (n.includes('official')) return 'official';
	if (/apps\.apple\.com|play\.google\.com/i.test(u)) return 'mobile';
	return 'other';
}

function familiesFromSelectedPlatforms(selected: string[]): Set<StoreFamily> {
	const out = new Set<StoreFamily>();
	for (const raw of selected) {
		const p = String(raw || '').toLowerCase();
		if (!p) continue;
		if (
			/\bpc\b/.test(p) ||
			p === 'mac' ||
			p === 'linux' ||
			p.includes('steam deck') ||
			p.includes('windows')
		) {
			out.add('pc');
		} else if (
			p.includes('playstation') ||
			p === 'psp' ||
			p.includes('ps vita') ||
			/^ps\s*\d/.test(p)
		) {
			out.add('playstation');
		} else if (p.includes('xbox')) {
			out.add('xbox');
		} else if (
			p.includes('nintendo') ||
			p.includes('switch') ||
			p.includes('wii') ||
			p.includes('gamecube') ||
			p.includes('game boy') ||
			p === 'nes' ||
			p === 'snes' ||
			p.includes('nintendo 64') ||
			p === 'n64'
		) {
			out.add('nintendo');
		} else if (p === 'ios' || p === 'android') {
			out.add('mobile');
		}
	}
	return out;
}

/**
 * Prefer store links that match the user's target platforms.
 * Fallback order: matching stores → Official site → other stores → IGDB.
 */
export function rankStoresForPlatforms(
	stores: IgdbStoreLink[],
	selectedPlatforms: string[] = []
): IgdbStoreLink[] {
	if (!stores.length) return [];
	const preferred = familiesFromSelectedPlatforms(selectedPlatforms);
	const scored = stores.map((s, i) => {
		const fam = storeFamily(s);
		let score = 0;
		if (preferred.size) {
			if (preferred.has(fam)) score += 100;
			else if (fam === 'official') score += 40;
			else if (fam === 'igdb') score += 1;
			else score += 10;
		} else {
			// No platform filter — PC stores first, then console stores, official, IGDB last
			if (fam === 'pc') score += 50;
			else if (fam === 'playstation' || fam === 'xbox' || fam === 'nintendo') score += 40;
			else if (fam === 'official') score += 30;
			else if (fam === 'igdb') score += 1;
			else score += 20;
		}
		return { s, score, i };
	});
	scored.sort((a, b) => b.score - a.score || a.i - b.i);
	return scored.map((x) => x.s);
}

/** Primary CTA store after platform ranking (skips bare IGDB when better exists). */
export function primaryStoreLink(
	stores: IgdbStoreLink[],
	selectedPlatforms: string[] = []
): IgdbStoreLink | null {
	const ranked = rankStoresForPlatforms(stores, selectedPlatforms);
	const nonIgdb = ranked.find((s) => s.url && storeFamily(s) !== 'igdb');
	return nonIgdb || ranked.find((s) => s.url) || null;
}

export type GameStoreLink = {
	platform: string;
	url: string;
	/** Store brand for chips / fallback label (Steam, Xbox Store, …) */
	store: string;
};

function familyForPlatformName(raw: string): StoreFamily | null {
	const set = familiesFromSelectedPlatforms([raw]);
	if (set.has('pc')) return 'pc';
	if (set.has('playstation')) return 'playstation';
	if (set.has('xbox')) return 'xbox';
	if (set.has('nintendo')) return 'nintendo';
	if (set.has('mobile')) return 'mobile';
	return null;
}

function bestStoreForFamily(stores: IgdbStoreLink[], fam: StoreFamily): IgdbStoreLink | null {
	const ranked = [...stores].filter((s) => s.url && storeFamily(s) === fam);
	if (ranked.length) return ranked[0];
	return null;
}

function findStoreByDomainOrName(
	stores: IgdbStoreLink[],
	opts: { nameIncludes: string; domain: RegExp }
): IgdbStoreLink | null {
	for (const s of stores) {
		if (!s.url) continue;
		const n = s.name.toLowerCase();
		const u = s.url.toLowerCase();
		if (n.includes(opts.nameIncludes) || opts.domain.test(u)) return s;
	}
	return null;
}

function wantsPcStores(selected: string[]): boolean {
	return selected.some((p) => familyForPlatformName(p) === 'pc');
}

function gameSupportsFamily(gamePlatforms: IgdbPlatform[], fam: StoreFamily): boolean {
	if (!gamePlatforms.length) return true;
	return gamePlatforms.some((gp) => {
		const name = `${gp.name} ${gp.abbreviation || ''}`.toLowerCase();
		if (fam === 'pc') return /\b(pc|windows|mac|linux|steam)\b/.test(name);
		if (fam === 'playstation') return /playstation|psp|ps vita|\bps[1-5]\b/.test(name);
		if (fam === 'xbox') return /xbox/.test(name);
		if (fam === 'nintendo')
			return /nintendo|switch|wii|gamecube|game boy|\bn64\b|\bnes\b|\bsnes\b/.test(name);
		if (fam === 'mobile') return /\bios\b|android|iphone|ipad/.test(name);
		return false;
	});
}

function findStoreByCategory(
	stores: IgdbStoreLink[],
	category: number
): IgdbStoreLink | null {
	return stores.find((s) => s.category === category && s.url) || null;
}

function findPcStorefronts(stores: IgdbStoreLink[]): {
	steam: IgdbStoreLink | null;
	epic: IgdbStoreLink | null;
	gog: IgdbStoreLink | null;
} {
	return {
		steam:
			findStoreByCategory(stores, WEB_STEAM) ||
			findStoreByDomainOrName(stores, { nameIncludes: 'steam', domain: /steampowered\.com/i }),
		epic:
			findStoreByCategory(stores, WEB_EPIC) ||
			findStoreByDomainOrName(stores, { nameIncludes: 'epic', domain: /epicgames\.com/i }),
		gog:
			findStoreByCategory(stores, WEB_GOG) ||
			findStoreByDomainOrName(stores, { nameIncludes: 'gog', domain: /gog\.com/i })
	};
}

/** Strict Official site: IGDB category/type 1 first, then name/family, then non-store URL. */
function findOfficialSite(stores: IgdbStoreLink[]): IgdbStoreLink | null {
	const byCat = findStoreByCategory(stores, WEB_OFFICIAL);
	if (byCat) return byCat;
	const byFamily = stores.find((s) => storeFamily(s) === 'official' && s.url);
	if (byFamily) return byFamily;
	return (
		stores.find(
			(s) =>
				s.url &&
				!/steampowered\.com|epicgames\.com|gog\.com|itch\.io|store\.playstation\.com|playstation\.com|xbox\.com|microsoft\.com|nintendo\.com|igdb\.com/i.test(
					s.url
				)
		) || null
	);
}

/**
 * Build CTA storeLinks for the user's selected platforms.
 * PC/Mac/Linux → category 13/16/17 (Steam/Epic/GOG); if none → category 1 Official Site.
 * Consoles → PlayStation / Xbox / Nintendo by website URL or type id.
 */
export function buildStoreLinksForPlatforms(
	stores: IgdbStoreLink[],
	selectedPlatforms: string[] = [],
	gamePlatforms: IgdbPlatform[] = []
): GameStoreLink[] {
	const usable = stores.filter((s) => s.url && storeFamily(s) !== 'igdb');
	const out: GameStoreLink[] = [];
	const seenUrls = new Set<string>();
	const seenPlatforms = new Set<string>();

	const push = (platform: string, store: IgdbStoreLink) => {
		const url = String(store.url || '').trim();
		const platKey = platform.toLowerCase();
		if (!url || seenUrls.has(url) || seenPlatforms.has(platKey)) return;
		seenUrls.add(url);
		seenPlatforms.add(platKey);
		out.push({ platform, url, store: store.name });
	};

	/** Category 13/16/17 first; if none found, MUST push category 1 Official Site. */
	const pushPcStoresWithOfficialFallback = () => {
		const { steam, epic, gog } = findPcStorefronts(usable);
		if (steam) push('Steam', steam);
		if (epic) push('Epic', epic);
		if (gog) push('GOG', gog);
		if (!steam && !epic && !gog) {
			const official = findOfficialSite(usable);
			if (official) {
				push('Official Site', {
					...official,
					name: 'Official Site',
					category: WEB_OFFICIAL
				});
			}
		}
	};

	const selected = selectedPlatforms.map((p) => p.trim()).filter(Boolean);

	if (selected.length) {
		if (wantsPcStores(selected) && gameSupportsFamily(gamePlatforms, 'pc')) {
			pushPcStoresWithOfficialFallback();
		}

		const handledFamilies = new Set<StoreFamily>();
		if (wantsPcStores(selected)) handledFamilies.add('pc');

		for (const plat of selected) {
			const fam = familyForPlatformName(plat);
			if (!fam || fam === 'pc') continue;
			if (handledFamilies.has(fam)) continue;
			if (!gameSupportsFamily(gamePlatforms, fam)) continue;
			handledFamilies.add(fam);

			const match =
				bestStoreForFamily(usable, fam) ||
				(fam === 'playstation'
					? findStoreByCategory(usable, WEB_PLAYSTATION) ||
						findStoreByDomainOrName(usable, {
							nameIncludes: 'playstation',
							domain: /store\.playstation\.com|playstation\.com/i
						})
					: fam === 'xbox'
						? findStoreByCategory(usable, WEB_XBOX) ||
							findStoreByDomainOrName(usable, {
								nameIncludes: 'xbox',
								domain: /xbox\.com|microsoft\.com/i
							})
						: fam === 'nintendo'
							? findStoreByCategory(usable, WEB_NINTENDO) ||
								findStoreByDomainOrName(usable, {
									nameIncludes: 'nintendo',
									domain: /nintendo\.com/i
								})
							: null);
			if (!match) continue;

			const label =
				fam === 'playstation'
					? 'PlayStation'
					: fam === 'xbox'
						? 'Xbox'
						: fam === 'nintendo'
							? plat.toLowerCase().includes('switch')
								? 'Nintendo Switch'
								: 'Nintendo'
							: fam === 'mobile'
								? plat
								: match.name;
			push(label, match);
		}

		if (!out.length) {
			const official = findOfficialSite(usable);
			if (official) {
				push('Official Site', {
					...official,
					name: 'Official Site',
					category: WEB_OFFICIAL
				});
			}
		}
		return out;
	}

	pushPcStoresWithOfficialFallback();
	for (const fam of ['playstation', 'xbox', 'nintendo'] as StoreFamily[]) {
		const match =
			bestStoreForFamily(usable, fam) ||
			(fam === 'playstation'
				? findStoreByCategory(usable, WEB_PLAYSTATION) ||
					findStoreByDomainOrName(usable, {
						nameIncludes: 'playstation',
						domain: /store\.playstation\.com|playstation\.com/i
					})
				: fam === 'xbox'
					? findStoreByCategory(usable, WEB_XBOX) ||
						findStoreByDomainOrName(usable, {
							nameIncludes: 'xbox',
							domain: /xbox\.com|microsoft\.com/i
						})
					: findStoreByCategory(usable, WEB_NINTENDO) ||
						findStoreByDomainOrName(usable, {
							nameIncludes: 'nintendo',
							domain: /nintendo\.com/i
						}));
		if (!match) continue;
		const label =
			fam === 'playstation' ? 'PlayStation' : fam === 'xbox' ? 'Xbox' : 'Nintendo';
		push(label, match);
	}
	if (!out.length) {
		const official = findOfficialSite(usable);
		if (official) {
			push('Official Site', {
				...official,
				name: 'Official Site',
				category: WEB_OFFICIAL
			});
		}
	}
	return out;
}

function pickContentRating(ageRatings: any[] | undefined): {
	label: string | null;
	maturityCert: string | null;
} {
	if (!Array.isArray(ageRatings) || !ageRatings.length) {
		return { label: null, maturityCert: null };
	}

	// Prefer ESRB, then PEGI
	const ordered = [...ageRatings].sort((a, b) => {
		const rank = (x: any) => {
			const org = Number(x?.category ?? x?.organization);
			if (org === ORG_ESRB) return 0;
			if (org === ORG_PEGI) return 1;
			return 2;
		};
		return rank(a) - rank(b);
	});

	for (const ar of ordered) {
		// Legacy enum (rating) — still returned during IGDB migration window
		const ratingNum = Number(ar?.rating);
		if (Number.isFinite(ratingNum) && RATING_LABEL[ratingNum]) {
			const label = RATING_LABEL[ratingNum];
			return { label, maturityCert: label };
		}

		// New table field: rating_category.rating (string like "T" / "M")
		const catName = String(
			ar?.rating_category?.rating || ar?.rating_category?.name || ''
		).trim();
		if (catName) {
			return { label: catName, maturityCert: catName };
		}
	}

	return { label: null, maturityCert: null };
}

function mapGame(raw: any): IgdbGameHit | null {
	const id = Number(raw?.id);
	const title = String(raw?.name || '').trim();
	if (!id || !title) return null;

	const platforms: IgdbPlatform[] = [];
	if (Array.isArray(raw?.platforms)) {
		for (const p of raw.platforms) {
			const name = String(p?.name || p?.abbreviation || '').trim();
			if (!name) continue;
			platforms.push({
				name,
				abbreviation: p?.abbreviation ? String(p.abbreviation) : null
			});
		}
	}

	const genres: string[] = [];
	if (Array.isArray(raw?.genres)) {
		for (const g of raw.genres) {
			const n = String(g?.name || '').trim();
			if (n) genres.push(n);
		}
	}

	const stores: IgdbStoreLink[] = [];
	const seenUrls = new Set<string>();
	const seenNames = new Set<string>();
	if (Array.isArray(raw?.websites)) {
		// Prefer Official / PC storefronts so category 1 isn't lost to later duplicates
		const ranked = [...raw.websites].sort((a, b) => {
			const rank = (w: any) => {
				const c = websiteTypeId(w);
				if (c === WEB_OFFICIAL) return 0;
				if (c === WEB_STEAM || c === WEB_EPIC || c === WEB_GOG) return 1;
				return 2;
			};
			return rank(a) - rank(b);
		});
		for (const w of ranked) {
			const link = storeFromWebsite(w);
			if (!link?.url) continue;
			const urlKey = link.url.toLowerCase();
			const nameKey = link.name.toLowerCase();
			if (seenUrls.has(urlKey) || seenNames.has(nameKey)) continue;
			seenUrls.add(urlKey);
			seenNames.add(nameKey);
			stores.push(link);
		}
	}

	const slug = raw?.slug ? String(raw.slug) : null;
	const igdbUrl =
		raw?.url && String(raw.url).startsWith('http')
			? String(raw.url)
			: slug
				? `https://www.igdb.com/games/${slug}`
				: `https://www.igdb.com/games/${id}`;

	if (!stores.some((s) => s.name === 'IGDB')) {
		stores.push({ name: 'IGDB', url: igdbUrl, logo: null });
	}

	const { label, maturityCert } = pickContentRating(raw?.age_ratings);
	const rating =
		typeof raw?.total_rating === 'number'
			? Math.round(raw.total_rating * 10) / 10
			: typeof raw?.rating === 'number'
				? Math.round(raw.rating * 10) / 10
				: null;

	return {
		id,
		title,
		slug,
		coverUrl: coverUrlFromImageId(raw?.cover?.image_id),
		year: yearFromUnix(raw?.first_release_date),
		rating,
		summary: raw?.summary ? String(raw.summary).trim() : null,
		genres,
		platforms,
		stores,
		igdbUrl,
		contentRating: label,
		maturityCert
	};
}

const GAME_FIELDS = `
fields name,slug,first_release_date,summary,total_rating,rating,
  cover.image_id,
  platforms.name,platforms.abbreviation,
  genres.name,
  websites.url,websites.category,websites.type,
  age_ratings.category,age_ratings.rating,age_ratings.organization,
  age_ratings.rating_category.rating,
  url;
`.replace(/\s+/g, ' ').trim();

/** Autocomplete search for LikeTitleSelect */
export async function searchIgdbGames(
	query: string,
	opts?: { limit?: number }
): Promise<{ results: IgdbSearchResult[]; total: number }> {
	const q = escapeSearch(query);
	if (!q || !howManyIgdbCreds()) return { results: [], total: 0 };

	const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 20);
	const body = `
${GAME_FIELDS}
search "${q}";
where version_parent = null;
limit ${limit};
`.trim();

	const rows = await igdbPost('games', body);
	const results: IgdbSearchResult[] = [];
	for (const raw of rows) {
		const g = mapGame(raw);
		if (!g) continue;
		const platformHint = g.platforms
			.slice(0, 2)
			.map((p) => p.abbreviation || p.name)
			.join(', ');
		results.push({
			id: g.id,
			mediaType: 'game',
			title: g.title,
			subtitle: platformHint || null,
			posterUrl: g.coverUrl,
			year: g.year,
			rating: g.rating,
			kindLabel: 'GAME'
		});
	}
	return { results, total: results.length };
}

/** Enrich a Gemini game pick by title (+ optional year). */
export async function lookupIgdbGame(opts: {
	searchQuery: string;
	title?: string;
	releaseYear?: string | null;
}): Promise<IgdbGameHit | null> {
	if (!howManyIgdbCreds()) return null;

	const rawQ = escapeSearch(opts.searchQuery || opts.title || '');
	if (!rawQ) return null;

	// Strip trailing (YYYY) for search
	const paren = rawQ.match(/^(.*?)\s*\((\d{4})\)\s*$/);
	const title = paren ? paren[1].trim() : rawQ;
	const yearHint = paren?.[2] || (opts.releaseYear ? String(opts.releaseYear).slice(0, 4) : null);

	const body = `
${GAME_FIELDS}
search "${title}";
where version_parent = null;
limit 8;
`.trim();

	const rows = await igdbPost('games', body);
	if (!rows.length) return null;

	const want = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
	let best: IgdbGameHit | null = null;
	let bestScore = -1;

	for (const raw of rows) {
		const g = mapGame(raw);
		if (!g) continue;
		const got = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
		let score = 0;
		if (got === want) score += 100;
		else if (got.includes(want) || want.includes(got)) score += 40;
		else score += 5;
		if (yearHint && g.year === yearHint) score += 30;
		else if (yearHint && g.year && Math.abs(Number(g.year) - Number(yearHint)) <= 1) score += 10;
		if (g.coverUrl) score += 5;
		if (score > bestScore) {
			bestScore = score;
			best = g;
		}
	}

	return best;
}

/** Platforms as provider-style chips (text, no logos from IGDB platforms easily). */
export function platformsAsProviders(platforms: IgdbPlatform[]): IgdbStoreLink[] {
	return platforms.slice(0, 6).map((p) => ({
		name: p.abbreviation || p.name,
		url: '',
		logo: null
	}));
}

export function gamePassesMaturity(
	maturityCert: string | null,
	maturity: MaturityLevel | null
): boolean {
	if (!maturity || maturity === 'mature') return true;
	if (!maturityCert) return true;
	return certificationAllowed(maturityCert, maturity);
}