/**
 * Tiny in-memory TTL cache for outbound JSON API calls (TMDB / iTunes).
 * Cuts repeat poster lookups that burn rate limits.
 */

type CacheEntry = {
	expires: number;
	status: number;
	data: unknown;
};

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min success
const NEGATIVE_TTL_MS = 45 * 1000; // soft-fail / empty
const RATE_LIMIT_TTL_MS = 90 * 1000; // 429 cool-down

const MAX_ENTRIES = 400;

function prune() {
	if (store.size <= MAX_ENTRIES) return;
	const now = Date.now();
	for (const [k, v] of store) {
		if (v.expires <= now) store.delete(k);
	}
	if (store.size <= MAX_ENTRIES) return;
	// drop oldest half
	const keys = [...store.keys()].slice(0, Math.floor(store.size / 2));
	for (const k of keys) store.delete(k);
}

export type CachedJsonResult = {
	ok: boolean;
	status: number;
	data: any | null;
	fromCache: boolean;
};

export async function cachedJsonFetch(
	url: string,
	init?: RequestInit,
	opts?: { ttlMs?: number; cacheKey?: string }
): Promise<CachedJsonResult> {
	const key = opts?.cacheKey || `${init?.method || 'GET'} ${url}`;
	const now = Date.now();
	const hit = store.get(key);
	if (hit && hit.expires > now) {
		return {
			ok: hit.status >= 200 && hit.status < 300,
			status: hit.status,
			data: hit.data,
			fromCache: true
		};
	}

	let pending = inflight.get(key);
	if (!pending) {
		pending = (async (): Promise<CacheEntry> => {
			try {
				const res = await fetch(url, init);
				const status = res.status;
				let data: unknown = null;
				if (status !== 204) {
					try {
						data = await res.json();
					} catch {
						data = null;
					}
				}

				let ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
				if (status === 429 || status === 503) ttl = RATE_LIMIT_TTL_MS;
				else if (!res.ok) ttl = NEGATIVE_TTL_MS;
				else if (
					data == null ||
					(typeof data === 'object' &&
						Array.isArray((data as any).results) &&
						(data as any).results.length === 0)
				) {
					ttl = NEGATIVE_TTL_MS;
				}

				const entry: CacheEntry = {
					expires: Date.now() + ttl,
					status,
					data
				};
				store.set(key, entry);
				prune();
				return entry;
			} catch (e) {
				const entry: CacheEntry = {
					expires: Date.now() + NEGATIVE_TTL_MS,
					status: 0,
					data: null
				};
				store.set(key, entry);
				prune();
				throw e;
			} finally {
				inflight.delete(key);
			}
		})();
		inflight.set(key, pending);
	}

	try {
		const entry = await pending;
		return {
			ok: entry.status >= 200 && entry.status < 300,
			status: entry.status,
			data: entry.data,
			fromCache: false
		};
	} catch (e) {
		console.warn('cachedJsonFetch failed', key, e);
		return { ok: false, status: 0, data: null, fromCache: false };
	}
}
