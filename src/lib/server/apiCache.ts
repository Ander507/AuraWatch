/**
 * Server cache for the heavy recommend/search stuff.
 * In-memory Map by default; if Upstash REST env is set we also hit Redis
 * so serverless cold starts don't forget everything.
 */

import { env } from '$env/dynamic/private';

type CacheEntry = {
	expires: number;
	value: unknown;
};

const mem = new Map<string, CacheEntry>();
const MAX_MEM = 250;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — same vibe = same answer

function pruneMem() {
	if (mem.size <= MAX_MEM) return;
	const now = Date.now();
	for (const [k, v] of mem) {
		if (v.expires <= now) mem.delete(k);
	}
	if (mem.size <= MAX_MEM) return;
	// nuke the oldest half if we're still packed
	const drop = [...mem.keys()].slice(0, Math.floor(mem.size / 2));
	for (const k of drop) mem.delete(k);
}

function redisCreds(): { url: string; token: string } | null {
	const url = (env.UPSTASH_REDIS_REST_URL || env.REDIS_REST_URL || '').trim();
	const token = (env.UPSTASH_REDIS_REST_TOKEN || env.REDIS_REST_TOKEN || '').trim();
	if (!url || !token) return null;
	return { url: url.replace(/\/$/, ''), token };
}

async function redisCmd(creds: { url: string; token: string }, cmd: unknown[]): Promise<any> {
	const res = await fetch(creds.url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${creds.token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(cmd)
	});
	if (!res.ok) return null;
	return res.json();
}

async function redisGet(key: string): Promise<unknown | null> {
	const creds = redisCreds();
	if (!creds) return null;
	try {
		const data = await redisCmd(creds, ['GET', key]);
		if (data?.result == null) return null;
		const raw = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
		return JSON.parse(raw);
	} catch (e) {
		console.warn('redis get flopped, falling back to memory', e);
		return null;
	}
}

async function redisSet(key: string, value: unknown, ttlMs: number): Promise<void> {
	const creds = redisCreds();
	if (!creds) return;
	try {
		const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
		// POST command API so fat JSON doesn't blow up the URL
		await redisCmd(creds, ['SET', key, JSON.stringify(value), 'EX', ttlSec]);
	} catch (e) {
		console.warn('redis set flopped (mem still has it)', e);
	}
}

/** Stable key from whatever filters the user picked. */
export function buildCacheKey(prefix: string, parts: Record<string, unknown>): string {
	const normalized: Record<string, unknown> = {};
	for (const k of Object.keys(parts).sort()) {
		const v = parts[k];
		if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
		if (Array.isArray(v)) {
			normalized[k] = [...v].map(String).map((s) => s.trim().toLowerCase()).sort();
		} else if (typeof v === 'string') {
			normalized[k] = v.trim().toLowerCase();
		} else {
			normalized[k] = v;
		}
	}
	return `${prefix}:${JSON.stringify(normalized)}`;
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
	const now = Date.now();
	const local = mem.get(key);
	if (local && local.expires > now) {
		return local.value as T;
	}
	if (local) mem.delete(key);

	const remote = await redisGet(key);
	if (remote != null) {
		// warm local so the next hit on this instance is instant
		mem.set(key, { expires: now + DEFAULT_TTL_MS, value: remote });
		pruneMem();
		return remote as T;
	}
	return null;
}

export async function cacheSet(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): Promise<void> {
	mem.set(key, { expires: Date.now() + ttlMs, value });
	pruneMem();
	await redisSet(key, value, ttlMs);
}

export const API_CACHE_TTL_MS = DEFAULT_TTL_MS;
