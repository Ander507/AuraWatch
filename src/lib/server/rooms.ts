import { and, asc, desc, eq } from 'drizzle-orm';
import {
	parseRoomFilters,
	serializeRoomFilters,
	ROOM_EXPIRED_MSG,
	type RoomFilters
} from '$lib/groupVibe';
import { getDb, getLibsqlClient, isTursoConfigured } from './db';
import { roomParticipants, rooms, type Room, type RoomParticipant } from './schema';
import {
	parseProvidersJson,
	sanitizeCoverUrl,
	sanitizeName,
	sanitizeProvidersJson,
	sanitizeShortText
} from './security';

export { ROOM_EXPIRED_MSG };

const ROOM_FORMATS = new Set([
	'movie',
	'series',
	'anime',
	'songs',
	'games',
	'books',
	'boardgames',
	'roblox'
]);

export const GUEST_COOKIE = 'aura_room_guest';
/** rooms self-destruct after a day so stale links don't pile up */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

let roomsSchemaReady = false;

/** ensure turso has filters_json without requiring a full drizzle push TTY */
export async function ensureRoomsSchema(): Promise<void> {
	if (roomsSchemaReady || !isTursoConfigured()) return;
	const client = getLibsqlClient();
	try {
		await client.execute('ALTER TABLE rooms ADD COLUMN filters_json TEXT');
	} catch (e: unknown) {
		const msg = String((e as { message?: string })?.message || e);
		if (!/duplicate column|already exists/i.test(msg)) {
			console.warn('rooms schema alter', msg.slice(0, 120));
		}
	}
	roomsSchemaReady = true;
}

function rid(prefix = '') {
	const hex = crypto.randomUUID().replace(/-/g, '');
	return prefix ? `${prefix}_${hex.slice(0, 16)}` : hex.slice(0, 16);
}

/** longer than playlist slugs — rooms get shared in group chats */
export function makeRoomSlug(): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	const bytes = crypto.getRandomValues(new Uint8Array(14));
	for (const b of bytes) out += alphabet[b % alphabet.length];
	return out;
}

export function makeGuestToken(): string {
	return rid('guest');
}

export function normalizeRoomSlug(raw: string): string {
	return String(raw || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '')
		.slice(0, 48);
}

export function normalizeRoomFormat(raw: unknown): string {
	const f = String(raw || '')
		.trim()
		.toLowerCase();
	if (ROOM_FORMATS.has(f)) return f;
	if (f === 'tv' || f === 'show') return 'series';
	if (f === 'game' || f === 'gaming') return 'games';
	if (f === 'song' || f === 'music') return 'songs';
	if (f === 'book' || f === 'manga') return 'books';
	if (f === 'board' || f === 'boardgame' || f === 'tabletop') return 'boardgames';
	if (f === 'rbx') return 'roblox';
	return 'movie';
}

export function parseLikedTitles(raw: unknown): string[] {
	if (Array.isArray(raw)) {
		return raw
			.map((t) => sanitizeShortText(t, 120))
			.filter(Boolean)
			.slice(0, 12);
	}
	if (typeof raw === 'string') {
		const s = raw.trim();
		if (!s) return [];
		try {
			const parsed = JSON.parse(s);
			if (Array.isArray(parsed)) return parseLikedTitles(parsed);
		} catch {
			/* comma list */
		}
		return s
			.split(/[,|;]/)
			.map((t) => sanitizeShortText(t, 120))
			.filter(Boolean)
			.slice(0, 12);
	}
	return [];
}

export function serializeLikedTitles(titles: string[]): string {
	return JSON.stringify(titles.slice(0, 12));
}

export type RoomParticipantView = {
	id: number;
	userName: string;
	vibeNotes: string;
	likedTitles: string[];
};

export type CachedRec = {
	title: string;
	cover?: string;
	coverFallbacks?: string[];
	pitch?: string;
	rating?: number | null;
	criticScore?: number;
	mediaType?: string;
	kind?: string;
	genres?: string[];
	seasonInfo?: string;
	artist?: string;
	author?: string;
	creator?: string;
	providers?: Array<{
		name: string;
		logo: string | null;
		url?: string | null;
		type?: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
	}>;
	storeLinks?: Array<{ platform: string; url: string; store?: string }>;
	listen_url?: string;
	watch_link?: string;
	preview_url?: string;
	trailer_youtube_key?: string;
	platforms?: string[];
	priceLabel?: string;
	playerCount?: string | number | null;
	[key: string]: unknown;
};

export type RoomPack = {
	room: Room;
	participants: RoomParticipantView[];
	cachedResults: CachedRec[];
	matchedAt: string | null;
	filters: RoomFilters;
};

function mapParticipant(row: RoomParticipant): RoomParticipantView {
	return {
		id: row.id,
		userName: row.userName,
		vibeNotes: row.vibeNotes || '',
		likedTitles: parseLikedTitles(row.likedTitles || '[]')
	};
}

function httpsUrl(raw: unknown): string | undefined {
	const u = sanitizeCoverUrl(raw);
	return u || undefined;
}

function youtubeKey(raw: unknown): string | undefined {
	const s = String(raw || '').trim();
	if (!/^[A-Za-z0-9_-]{6,20}$/.test(s)) return undefined;
	return s;
}

function slimStoreLinks(raw: unknown): CachedRec['storeLinks'] {
	if (!Array.isArray(raw)) return undefined;
	const out: NonNullable<CachedRec['storeLinks']> = [];
	for (const row of raw.slice(0, 8)) {
		if (!row || typeof row !== 'object') continue;
		const l = row as Record<string, unknown>;
		const url = httpsUrl(l.url);
		const platform = sanitizeShortText(l.platform || l.store, 40);
		if (!url || !platform) continue;
		const store = sanitizeShortText(l.store, 40) || undefined;
		out.push(store ? { platform, url, store } : { platform, url });
	}
	return out.length ? out : undefined;
}

/** persist the same card payload the home page renders — providers, store/play links, trailers */
export function slimRoomRec(raw: unknown): CachedRec | null {
	const r = (raw || {}) as Record<string, unknown>;
	const title = sanitizeShortText(r.title, 200);
	if (!title) return null;

	const providersJson = sanitizeProvidersJson(r.providers);
	const providers = providersJson ? parseProvidersJson(providersJson) : [];

	const cover =
		httpsUrl(r.cover) || httpsUrl(r.poster_path) || httpsUrl(r.image) || undefined;
	const coverFallbacks = Array.isArray(r.coverFallbacks)
		? r.coverFallbacks.map(httpsUrl).filter((u): u is string => Boolean(u)).slice(0, 4)
		: [];

	const rating =
		typeof r.rating === 'number'
			? r.rating
			: typeof r.vote_average === 'number'
				? r.vote_average
				: null;

	const criticScore = typeof r.criticScore === 'number' ? r.criticScore : undefined;
	const pitch = sanitizeShortText(
		r.pitch || r.matchReason || r.overview || r.description,
		800
	);

	const genres = Array.isArray(r.genres)
		? r.genres.map((g) => sanitizeShortText(g, 40)).filter(Boolean).slice(0, 8)
		: Array.isArray(r.actualGenres)
			? r.actualGenres.map((g) => sanitizeShortText(g, 40)).filter(Boolean).slice(0, 8)
			: [];

	const platforms = Array.isArray(r.platforms)
		? r.platforms.map((p) => sanitizeShortText(p, 40)).filter(Boolean).slice(0, 8)
		: [];

	const rec: CachedRec = {
		title,
		cover,
		pitch: pitch || undefined,
		rating,
		mediaType: r.mediaType ? sanitizeShortText(r.mediaType, 40) : undefined,
		kind: r.kind ? sanitizeShortText(r.kind, 24) : undefined
	};

	if (coverFallbacks.length) rec.coverFallbacks = coverFallbacks;
	if (criticScore != null) rec.criticScore = criticScore;
	if (genres.length) rec.genres = genres;
	if (platforms.length) rec.platforms = platforms;
	if (providers.length) rec.providers = providers;

	const seasonInfo = sanitizeShortText(r.seasonInfo || r.releaseYear || r.year, 40);
	if (seasonInfo) rec.seasonInfo = seasonInfo;

	const artist = sanitizeShortText(r.artist, 80);
	if (artist) rec.artist = artist;
	const author = sanitizeShortText(r.author || r.creator, 80);
	if (author) rec.author = author;
	const creator = sanitizeShortText(r.creator, 80);
	if (creator) rec.creator = creator;

	const storeLinks = slimStoreLinks(r.storeLinks);
	if (storeLinks) rec.storeLinks = storeLinks;

	const listen = httpsUrl(r.listen_url || r.zflix_url);
	if (listen) rec.listen_url = listen;
	const watch = httpsUrl(r.watch_link || r.watchLink);
	if (watch) rec.watch_link = watch;
	const preview = httpsUrl(r.preview_url || r.previewUrl);
	if (preview) rec.preview_url = preview;

	const trailer = youtubeKey(r.trailer_youtube_key || r.trailerYoutubeKey);
	if (trailer) rec.trailer_youtube_key = trailer;

	const priceLabel = sanitizeShortText(r.priceLabel, 40);
	if (priceLabel) rec.priceLabel = priceLabel;

	if (r.playerCount != null && (typeof r.playerCount === 'number' || typeof r.playerCount === 'string')) {
		rec.playerCount = r.playerCount;
	}

	return rec;
}

export function parseCachedResults(raw: string | null | undefined): CachedRec[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(slimRoomRec).filter((r): r is CachedRec => Boolean(r));
	} catch {
		return [];
	}
}

function toPack(room: Room, people: RoomParticipant[]): RoomPack {
	return {
		room,
		participants: people.map(mapParticipant),
		cachedResults: parseCachedResults(room.cachedResults),
		matchedAt: room.matchedAt ? new Date(room.matchedAt).toISOString() : null,
		filters: parseRoomFilters(room.filtersJson, room.format)
	};
}

// checking if a room is older than 24 hours and marking it as expired/deleting it automatically
export function isRoomExpired(createdAt: Date | string | number | null | undefined): boolean {
	if (createdAt == null) return false;
	const t =
		createdAt instanceof Date
			? createdAt.getTime()
			: typeof createdAt === 'number'
				? createdAt
				: new Date(createdAt).getTime();
	if (!Number.isFinite(t)) return false;
	return Date.now() - t > ROOM_TTL_MS;
}

export async function deleteRoomCascade(roomId: string): Promise<void> {
	if (!isTursoConfigured() || !roomId) return;
	const db = getDb();
	await db.delete(roomParticipants).where(eq(roomParticipants.roomId, roomId));
	await db.delete(rooms).where(eq(rooms.id, roomId));
}

async function assertRoomFresh(room: Room): Promise<void> {
	if (!isRoomExpired(room.createdAt)) return;
	await deleteRoomCascade(room.id);
	throw new Error('room_expired');
}

export type MyRoomSummary = {
	id: string;
	slug: string;
	format: string;
	creatorName: string;
	createdAt: string;
};

/** querying turso for rooms created by the logged-in user to display in a 'my rooms' dashboard section */
export async function listMyActiveRooms(creatorUserId: string): Promise<MyRoomSummary[]> {
	if (!isTursoConfigured()) return [];
	const uid = String(creatorUserId || '').trim();
	if (!uid) return [];

	await ensureRoomsSchema();
	const db = getDb();
	const rows = await db
		.select()
		.from(rooms)
		.where(eq(rooms.creatorUserId, uid))
		.orderBy(desc(rooms.createdAt));

	const active: MyRoomSummary[] = [];
	for (const room of rows) {
		if (isRoomExpired(room.createdAt)) {
			await deleteRoomCascade(room.id);
			continue;
		}
		active.push({
			id: room.id,
			slug: room.slug,
			format: room.format,
			creatorName: room.creatorName,
			createdAt: room.createdAt ? new Date(room.createdAt).toISOString() : new Date().toISOString()
		});
	}
	return active;
}

/** host-only — wipe a room and its participants for good */
export async function deleteOwnedRoom(opts: {
	slug: string;
	userId: string;
}): Promise<boolean> {
	if (!isTursoConfigured()) throw new Error('turso_missing');
	const userId = String(opts.userId || '').trim();
	if (!userId) throw new Error('auth_required');
	const needle = normalizeRoomSlug(opts.slug);
	if (!needle) throw new Error('room_not_found');

	const db = getDb();
	const rows = await db.select().from(rooms).where(eq(rooms.slug, needle)).limit(1);
	const room = rows[0];
	if (!room) throw new Error('room_not_found');
	if (room.creatorUserId !== userId) throw new Error('forbidden');

	await deleteRoomCascade(room.id);
	return true;
}

export async function createRoom(opts: {
	creatorName: string;
	creatorUserId: string;
	format?: string;
	filters?: unknown;
}): Promise<{ id: string; slug: string }> {
	if (!isTursoConfigured()) throw new Error('turso_missing');
	await ensureRoomsSchema();
	const creatorUserId = String(opts.creatorUserId || '').trim();
	if (!creatorUserId) throw new Error('auth_required');
	const creatorName = sanitizeName(opts.creatorName) || 'Host';
	const format = normalizeRoomFormat(opts.format);
	const filtersJson = serializeRoomFilters(parseRoomFilters(opts.filters, format));
	const db = getDb();
	const createdAt = new Date();

	for (let attempt = 0; attempt < 6; attempt++) {
		const id = rid('room');
		const slug = makeRoomSlug();
		try {
			await db.insert(rooms).values({
				id,
				slug,
				creatorName,
				creatorUserId,
				format,
				filtersJson,
				createdAt
			});
			return { id, slug };
		} catch (e) {
			console.warn('createRoom slug collision?', e);
		}
	}
	throw new Error('slug_failed');
}

export async function getRoomBySlug(slug: string): Promise<RoomPack | null> {
	if (!isTursoConfigured()) return null;
	await ensureRoomsSchema();
	const needle = normalizeRoomSlug(slug);
	if (!needle) return null;
	const db = getDb();
	const roomRows = await db.select().from(rooms).where(eq(rooms.slug, needle)).limit(1);
	const room = roomRows[0];
	if (!room) return null;

	await assertRoomFresh(room);

	const people = await db
		.select()
		.from(roomParticipants)
		.where(eq(roomParticipants.roomId, room.id))
		.orderBy(asc(roomParticipants.id));

	return toPack(room, people);
}

/** allowing unauthenticated guests to join a room with just a nickname while the host creates it */
export async function joinRoom(opts: {
	slug: string;
	userName: string;
	guestToken: string;
	vibeNotes?: string;
	likedTitles?: unknown;
}): Promise<RoomPack & { guestToken: string }> {
	if (!isTursoConfigured()) throw new Error('turso_missing');
	const pack = await getRoomBySlug(opts.slug);
	if (!pack) throw new Error('room_not_found');

	const userName = sanitizeName(opts.userName);
	if (!userName) throw new Error('bad_name');
	const guestToken = String(opts.guestToken || '').trim() || makeGuestToken();
	const vibeNotes = sanitizeShortText(opts.vibeNotes, 500);
	const likedTitles = parseLikedTitles(opts.likedTitles);

	const db = getDb();

	const byToken = await db
		.select()
		.from(roomParticipants)
		.where(
			and(eq(roomParticipants.roomId, pack.room.id), eq(roomParticipants.guestToken, guestToken))
		)
		.limit(1);

	if (byToken[0]) {
		await db
			.update(roomParticipants)
			.set({
				userName,
				vibeNotes: vibeNotes || null,
				likedTitles: serializeLikedTitles(likedTitles)
			})
			.where(eq(roomParticipants.id, byToken[0].id));
	} else {
		if (pack.participants.length >= 12) throw new Error('room_full');
		await db.insert(roomParticipants).values({
			roomId: pack.room.id,
			userName,
			guestToken,
			vibeNotes: vibeNotes || null,
			likedTitles: serializeLikedTitles(likedTitles)
		});
	}

	const refreshed = await getRoomBySlug(opts.slug);
	if (!refreshed) throw new Error('room_not_found');
	return { ...refreshed, guestToken };
}

// saving the calculated group recommendations to the room state so everyone sees the exact same synced results
export async function saveRoomMatchResults(
	slug: string,
	recommendations: unknown[]
): Promise<RoomPack | null> {
	if (!isTursoConfigured()) throw new Error('turso_missing');
	const pack = await getRoomBySlug(slug);
	if (!pack) return null;

	const slim = recommendations
		.slice(0, 12)
		.map(slimRoomRec)
		.filter((r): r is CachedRec => Boolean(r));

	const db = getDb();
	const matchedAt = new Date();
	await db
		.update(rooms)
		.set({
			cachedResults: JSON.stringify(slim),
			matchedAt
		})
		.where(eq(rooms.id, pack.room.id));

	return getRoomBySlug(slug);
}

export function roomPublicJson(pack: RoomPack) {
	return {
		ok: true as const,
		room: {
			id: pack.room.id,
			slug: pack.room.slug,
			creatorName: pack.room.creatorName,
			creatorUserId: pack.room.creatorUserId || null,
			format: pack.room.format,
			createdAt: pack.room.createdAt?.toISOString?.() ?? null,
			matchedAt: pack.matchedAt,
			filters: pack.filters
		},
		participants: pack.participants,
		recommendations: pack.cachedResults,
		matchedAt: pack.matchedAt,
		filters: pack.filters
	};
}
