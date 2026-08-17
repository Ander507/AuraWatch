import { and, eq } from 'drizzle-orm';
import { getDb, isTursoConfigured } from './db';
import { lists, savedItems, users, type List, type SavedItem } from './schema';
import {
	normalizeEmail,
	passwordLooksOk,
	parseProvidersJson,
	sanitizeCoverUrl,
	sanitizeName,
	sanitizeProvidersJson,
	sanitizeShortText,
	type SavedProvider
} from './security';

function rid(prefix = '') {
	const hex = crypto.randomUUID().replace(/-/g, '');
	return prefix ? `${prefix}_${hex.slice(0, 16)}` : hex.slice(0, 16);
}

/** short share slug — looks nicer in urls than a uuid blob */
export function makeShareSlug(): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	const bytes = crypto.getRandomValues(new Uint8Array(10));
	for (const b of bytes) out += alphabet[b % alphabet.length];
	return out;
}

export async function upsertUser(opts: {
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	avatar?: string | null; // old name, still accepted
	passwordHash?: string | null;
}) {
	if (!isTursoConfigured()) return;
	const db = getDb();
	const image = opts.image ?? opts.avatar ?? null;
	const existing = await db.select().from(users).where(eq(users.id, opts.id)).limit(1);
	if (existing[0]) {
		await db
			.update(users)
			.set({
				name: opts.name ?? existing[0].name,
				email: opts.email ?? existing[0].email,
				image: image ?? existing[0].image,
				// only overwrite hash when we actually pass one (register / reset)
				...(opts.passwordHash !== undefined ? { passwordHash: opts.passwordHash } : {})
			})
			.where(eq(users.id, opts.id));
		return;
	}
	await db.insert(users).values({
		id: opts.id,
		name: opts.name ?? null,
		email: opts.email ?? null,
		image,
		passwordHash: opts.passwordHash ?? null
	});
}

export async function findUserByEmail(email: string) {
	if (!isTursoConfigured()) return null;
	const db = getDb();
	const rows = await db
		.select()
		.from(users)
		.where(eq(users.email, email.trim().toLowerCase()))
		.limit(1);
	return rows[0] ?? null;
}

export async function createEmailUser(opts: {
	email: string;
	password: string;
	name?: string;
}) {
	const email = normalizeEmail(opts.email);
	if (!email) throw new Error('bad_email');
	const pw = passwordLooksOk(opts.password);
	if (!pw.ok) throw new Error('bad_password');

	const existing = await findUserByEmail(email);
	if (existing) {
		throw new Error('email_taken');
	}
	const { hashPassword } = await import('./password');
	const passwordHash = await hashPassword(opts.password);
	const id = rid('user');
	await upsertUser({
		id,
		email,
		name: sanitizeName(opts.name) || email.split('@')[0] || 'AuraWatcher',
		image: null,
		passwordHash
	});
	return id;
}

async function uniqueSlug(db: ReturnType<typeof getDb>): Promise<string> {
	for (let i = 0; i < 8; i++) {
		const slug = makeShareSlug();
		const hit = await db.select({ id: lists.id }).from(lists).where(eq(lists.slug, slug)).limit(1);
		if (!hit[0]) return slug;
	}
	return `${makeShareSlug()}${Date.now().toString(36).slice(-4)}`;
}

/** grab their default list, or spin one up the first time they save */
export async function getOrCreateActiveList(userId: string, title = 'My List'): Promise<List> {
	const db = getDb();
	const found = await db.select().from(lists).where(eq(lists.userId, userId)).limit(1);
	if (found[0]) return found[0];
	return createPlaylist(userId, title);
}

// letting users sort stuff into multiple named playlists instead of one big pile
export async function createPlaylist(userId: string, titleRaw: string): Promise<List> {
	const title = sanitizeShortText(titleRaw, 80) || 'Untitled vibe';
	const db = getDb();
	const row: List = {
		id: rid('list'),
		userId,
		title,
		slug: await uniqueSlug(db),
		createdAt: new Date()
	};
	await db.insert(lists).values(row);
	return row;
}

export async function getOwnedList(userId: string, listId: string): Promise<List | null> {
	const db = getDb();
	const rows = await db
		.select()
		.from(lists)
		.where(and(eq(lists.id, listId), eq(lists.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

export async function listUserPlaylists(userId: string): Promise<
	Array<{
		list: List;
		items: SavedItem[];
	}>
> {
	const db = getDb();
	let rows = await db.select().from(lists).where(eq(lists.userId, userId));
	if (!rows.length) {
		const created = await createPlaylist(userId, 'My List');
		rows = [created];
	}
	// oldest first so "My List" (first created) stays on top
	rows = [...rows].sort((a, b) => {
		const at = a.createdAt?.getTime?.() ?? 0;
		const bt = b.createdAt?.getTime?.() ?? 0;
		return at - bt;
	});

	const out = [];
	for (const list of rows) {
		const items = await db.select().from(savedItems).where(eq(savedItems.listId, list.id));
		out.push({ list, items });
	}
	return out;
}

/** normalize so " 4W272B9YNM " still hits the row */
export function normalizeListSlug(raw: string): string {
	return String(raw || '')
		.trim()
		.toLowerCase();
}

export async function getListBySlug(slug: string): Promise<{
	list: List;
	ownerName: string | null;
	items: SavedItem[];
} | null> {
	const db = getDb();
	const needle = normalizeListSlug(slug);
	if (!needle) return null;

	// double checking if the slug column in turso matches what we are searching for
	const found = await db.select().from(lists).where(eq(lists.slug, needle)).limit(1);
	let list = found[0];

	// case-insensitive fallback in case an older row slipped in with weird casing
	if (!list) {
		const all = await db.select({ id: lists.id, slug: lists.slug }).from(lists).limit(200);
		const soft = all.find((r) => normalizeListSlug(r.slug) === needle);
		if (soft) {
			const again = await db.select().from(lists).where(eq(lists.id, soft.id)).limit(1);
			list = again[0];
		}
	}

	if (!list) {
		console.warn('[lists] no row for slug', { needle, triedExact: true });
		return null;
	}

	const owner = await db.select().from(users).where(eq(users.id, list.userId)).limit(1);
	// items live on saved_items.list_id — grab everything on this list
	const items = await db.select().from(savedItems).where(eq(savedItems.listId, list.id));

	return {
		list,
		ownerName: owner[0]?.name ?? null,
		items
	};
}

/** tiny dump for local debugging — don't expose this in prod without DEBUG_LISTS */
export async function debugListSlugs(limit = 50): Promise<
	Array<{ id: string; slug: string; title: string; itemCount: number }>
> {
	const db = getDb();
	const rows = await db.select().from(lists).limit(Math.min(Math.max(limit, 1), 100));
	const out = [];
	for (const row of rows) {
		const items = await db.select().from(savedItems).where(eq(savedItems.listId, row.id));
		out.push({
			id: row.id,
			slug: row.slug,
			title: row.title,
			itemCount: items.length
		});
	}
	return out;
}

export type SaveItemInput = {
	format: string;
	title: string;
	externalId?: string | null;
	coverUrl?: string | null;
	description?: string | null;
	providers?: SavedProvider[] | string | null;
	listId?: string | null;
};

export async function addSavedItem(userId: string, input: SaveItemInput): Promise<SavedItem> {
	const title = sanitizeShortText(input.title, 200);
	const format = sanitizeShortText(input.format, 40) || 'media';
	if (!title) throw new Error('missing_title');

	const providersJson = sanitizeProvidersJson(input.providers);
	let list: List | null = null;
	if (input.listId) {
		list = await getOwnedList(userId, input.listId);
		if (!list) throw new Error('bad_list');
	} else {
		list = await getOrCreateActiveList(userId);
	}
	const db = getDb();

	// don't double-save the same title on this playlist
	const existing = await db.select().from(savedItems).where(eq(savedItems.listId, list.id));
	const hit = existing.find(
		(x) =>
			x.title.toLowerCase() === title.toLowerCase() &&
			x.format.toLowerCase() === format.toLowerCase()
	);
	if (hit) {
		// refresh providers if we got newer where-to-watch data on a re-save
		if (providersJson && providersJson !== hit.providersJson) {
			await db.update(savedItems).set({ providersJson }).where(eq(savedItems.id, hit.id));
			return { ...hit, providersJson };
		}
		return hit;
	}

	const row: SavedItem = {
		id: rid('item'),
		listId: list.id,
		format,
		title,
		externalId: sanitizeShortText(input.externalId, 80) || null,
		coverUrl: sanitizeCoverUrl(input.coverUrl),
		description: sanitizeShortText(input.description, 1200) || null,
		providersJson
	};
	await db.insert(savedItems).values(row);
	return row;
}

export function savedItemProviders(item: SavedItem): SavedProvider[] {
	return parseProvidersJson(item.providersJson);
}

export async function removeSavedItem(userId: string, itemId: string): Promise<boolean> {
	const db = getDb();
	const rows = await db.select().from(savedItems).where(eq(savedItems.id, itemId)).limit(1);
	const row = rows[0];
	if (!row) return false;
	const owned = await getOwnedList(userId, row.listId);
	if (!owned) return false;
	await db.delete(savedItems).where(eq(savedItems.id, itemId));
	return true;
}

export async function removeSavedItemByTitle(
	userId: string,
	title: string,
	format: string,
	listId?: string | null
): Promise<boolean> {
	const needleTitle = title.trim().toLowerCase();
	const needleFormat = (format || 'media').trim().toLowerCase();
	if (!needleTitle) return false;

	const packs = await listUserPlaylists(userId);
	const db = getDb();
	let removed = false;
	for (const pack of packs) {
		if (listId && pack.list.id !== listId) continue;
		const hit = pack.items.find(
			(x) =>
				x.title.toLowerCase() === needleTitle && x.format.toLowerCase() === needleFormat
		);
		if (!hit) continue;
		await db.delete(savedItems).where(eq(savedItems.id, hit.id));
		removed = true;
		if (listId) break;
	}
	return removed;
}

/** @deprecated prefer listUserPlaylists — kept for older call sites */
export async function listUserSavedItems(userId: string): Promise<{
	list: List;
	items: SavedItem[];
}> {
	const packs = await listUserPlaylists(userId);
	const first = packs[0];
	return { list: first.list, items: first.items };
}
