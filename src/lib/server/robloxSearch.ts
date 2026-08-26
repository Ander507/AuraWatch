/**
 * Roblox experience search + enrich — public web APIs (omni-search, games, thumbnails).
 * No Open Cloud API key required.
 */

const UA = 'AuraWatch/1.0 (+https://aurawatch.org)';
const SEARCH_TIMEOUT_MS = 6000;
const DETAIL_TIMEOUT_MS = 5000;

export type RobloxHit = {
	id: number;
	universeId: number;
	placeId: number;
	title: string;
	description: string | null;
	coverUrl: string | null;
	playUrl: string;
	playerCount: number | null;
	visits: number | null;
	creator: string | null;
	genre: string | null;
	year: string | null;
	rating: number | null;
	maturity: string | null;
	poster_path: string | null;
	image: string | null;
	overview: string | null;
	vote_average: number | null;
	format: 'Roblox';
};

export type RobloxSearchResult = {
	id: number;
	mediaType: 'roblox';
	title: string;
	subtitle: string | null;
	posterUrl: string | null;
	image: string | null;
	poster_path: string | null;
	year: string | null;
	rating: number | null;
	kindLabel: 'ROBLOX';
};

type OmniGame = {
	universeId?: number;
	name?: string;
	description?: string;
	playerCount?: number;
	totalUpVotes?: number;
	totalDownVotes?: number;
	rootPlaceId?: number;
	creatorName?: string;
	contentMaturity?: string;
	ageRecommendationDisplayName?: string;
	canonicalUrlPath?: string;
};

function sessionId(): string {
	return crypto.randomUUID();
}

function cleanTitle(raw: string): string {
	return String(raw || '')
		.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeKey(s: string): string {
	return cleanTitle(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

export function formatPlayerCount(n: number | null | undefined): string | null {
	if (n == null || !Number.isFinite(n) || n < 0) return null;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M playing`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K playing`;
	return `${Math.round(n).toLocaleString('en-US')} playing`;
}

function upvoteRatio(up?: number, down?: number): number | null {
	const u = Number(up) || 0;
	const d = Number(down) || 0;
	const t = u + d;
	if (t < 50) return null;
	return Math.round((u / t) * 1000) / 100;
}

function playUrlFrom(placeId: number, canonical?: string | null): string {
	if (canonical && canonical.startsWith('/')) {
		return `https://www.roblox.com${canonical}`;
	}
	return `https://www.roblox.com/games/${placeId}`;
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: {
				Accept: 'application/json',
				'User-Agent': UA
			}
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

function flattenOmniGames(payload: any): OmniGame[] {
	const groups = Array.isArray(payload?.searchResults) ? payload.searchResults : [];
	const out: OmniGame[] = [];
	const seen = new Set<number>();
	for (const group of groups) {
		if (String(group?.contentGroupType || '') !== 'Game') continue;
		const contents = Array.isArray(group?.contents) ? group.contents : [];
		for (const c of contents) {
			const uid = Number(c?.universeId ?? c?.contentId);
			if (!Number.isFinite(uid) || seen.has(uid)) continue;
			seen.add(uid);
			out.push(c as OmniGame);
		}
	}
	return out;
}

async function fetchIcons(universeIds: number[]): Promise<Map<number, string>> {
	const map = new Map<number, string>();
	const ids = universeIds.filter((n) => Number.isFinite(n)).slice(0, 50);
	if (!ids.length) return map;
	const url = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids.join(',')}&size=512x512&format=Png&isCircular=false`;
	const json = await fetchJson<{ data?: Array<{ targetId?: number; imageUrl?: string; state?: string }> }>(
		url,
		DETAIL_TIMEOUT_MS
	);
	for (const row of json?.data || []) {
		const id = Number(row?.targetId);
		const img = String(row?.imageUrl || '').trim();
		if (Number.isFinite(id) && img && row?.state === 'Completed') map.set(id, img);
	}
	return map;
}

async function fetchGameDetails(universeIds: number[]): Promise<Map<number, any>> {
	const map = new Map<number, any>();
	const ids = universeIds.filter((n) => Number.isFinite(n)).slice(0, 50);
	if (!ids.length) return map;
	const url = `https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`;
	const json = await fetchJson<{ data?: any[] }>(url, DETAIL_TIMEOUT_MS);
	for (const row of json?.data || []) {
		const id = Number(row?.id);
		if (Number.isFinite(id)) map.set(id, row);
	}
	return map;
}

function scoreMatch(query: string, title: string): number {
	const q = normalizeKey(query);
	const t = normalizeKey(title);
	if (!q || !t) return 0;
	if (q === t) return 100;
	if (t.startsWith(q) || q.startsWith(t)) return 85;
	if (t.includes(q)) return 70;
	const qParts = q.split(' ').filter(Boolean);
	const hits = qParts.filter((p) => t.includes(p)).length;
	return hits ? (hits / qParts.length) * 55 : 0;
}

function hitFromOmni(
	g: OmniGame,
	icon: string | null,
	detail?: any
): RobloxHit | null {
	const universeId = Number(g.universeId);
	const placeId = Number(detail?.rootPlaceId ?? g.rootPlaceId);
	if (!Number.isFinite(universeId) || !Number.isFinite(placeId) || placeId <= 0) return null;

	const title = cleanTitle(String(detail?.name || g.name || '')).replace(/^\[.*?\]\s*/, '') || String(g.name || 'Untitled');
	const cover = icon || null;
	const players = Number(detail?.playing ?? g.playerCount);
	const visits = Number(detail?.visits);
	const created = String(detail?.created || '').slice(0, 4);
	const year = /^\d{4}$/.test(created) ? created : null;
	const rating = upvoteRatio(g.totalUpVotes, g.totalDownVotes);
	const creator =
		String(detail?.creator?.name || g.creatorName || '').trim() || null;
	const genre = String(detail?.genre_l1 || detail?.genre || '').trim() || null;
	const description =
		String(detail?.description || g.description || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 600) || null;
	const maturity =
		String(g.ageRecommendationDisplayName || g.contentMaturity || '').trim() || null;

	return {
		id: universeId,
		universeId,
		placeId,
		title,
		description,
		coverUrl: cover,
		playUrl: playUrlFrom(placeId, detail?.canonicalUrlPath || g.canonicalUrlPath),
		playerCount: Number.isFinite(players) ? players : null,
		visits: Number.isFinite(visits) ? visits : null,
		creator,
		genre,
		year,
		rating,
		maturity,
		poster_path: cover,
		image: cover,
		overview: description,
		vote_average: rating,
		format: 'Roblox'
	};
}

export async function searchRobloxExperiences(
	query: string,
	opts: { limit?: number } = {}
): Promise<{ results: RobloxSearchResult[]; total: number }> {
	const q = String(query || '').trim();
	const limit = Math.max(1, Math.min(20, opts.limit ?? 8));
	if (!q) return { results: [], total: 0 };

	try {
		const url = new URL('https://apis.roblox.com/search-api/omni-search');
		url.searchParams.set('searchQuery', q);
		url.searchParams.set('sessionId', sessionId());
		url.searchParams.set('pageType', 'all');

		const payload = await fetchJson<any>(url.toString(), SEARCH_TIMEOUT_MS);
		const games = flattenOmniGames(payload).slice(0, limit);
		if (!games.length) return { results: [], total: 0 };

		const ids = games.map((g) => Number(g.universeId)).filter(Number.isFinite);
		const icons = await fetchIcons(ids);

		const results: RobloxSearchResult[] = [];
		for (const g of games) {
			const uid = Number(g.universeId);
			const title = cleanTitle(String(g.name || '')).replace(/^\[.*?\]\s*/, '') || String(g.name || '');
			if (!title) continue;
			const players = formatPlayerCount(g.playerCount ?? null);
			const cover = icons.get(uid) || null;
			results.push({
				id: uid,
				mediaType: 'roblox',
				title,
				subtitle: players || g.creatorName || 'Roblox',
				posterUrl: cover,
				image: cover,
				poster_path: cover,
				year: null,
				rating: upvoteRatio(g.totalUpVotes, g.totalDownVotes),
				kindLabel: 'ROBLOX'
			});
			if (results.length >= limit) break;
		}
		return { results, total: results.length };
	} catch (e) {
		console.warn('searchRobloxExperiences flopped', e);
		return { results: [], total: 0 };
	}
}

export async function lookupRobloxExperience(opts: {
	searchQuery: string;
	title?: string;
}): Promise<RobloxHit | null> {
	const q = String(opts.searchQuery || opts.title || '').trim();
	if (!q) return null;

	try {
		const url = new URL('https://apis.roblox.com/search-api/omni-search');
		url.searchParams.set('searchQuery', q);
		url.searchParams.set('sessionId', sessionId());
		url.searchParams.set('pageType', 'all');

		const payload = await fetchJson<any>(url.toString(), SEARCH_TIMEOUT_MS);
		const games = flattenOmniGames(payload);
		if (!games.length) return null;

		const ranked = [...games].sort(
			(a, b) =>
				scoreMatch(q, String(b.name || '')) - scoreMatch(q, String(a.name || '')) ||
				(Number(b.playerCount) || 0) - (Number(a.playerCount) || 0)
		);
		const best = ranked[0];
		const uid = Number(best.universeId);
		if (!Number.isFinite(uid)) return null;

		const [icons, details] = await Promise.all([
			fetchIcons([uid]),
			fetchGameDetails([uid])
		]);

		return hitFromOmni(best, icons.get(uid) || null, details.get(uid));
	} catch (e) {
		console.warn('lookupRobloxExperience flopped', e);
		return null;
	}
}

export function robloxLinks(hit: RobloxHit) {
	return [{ name: 'Roblox', url: hit.playUrl, logo: null as string | null }];
}
