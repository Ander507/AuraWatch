import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import {
	addSavedItem,
	createPlaylist,
	listUserPlaylists,
	removeSavedItem,
	removeSavedItemByTitle,
	savedItemProviders
} from '$lib/server/lists';
import type { SavedItem } from '$lib/server/schema';

function mapItem(i: SavedItem) {
	return {
		id: i.id,
		format: i.format,
		title: i.title,
		coverUrl: i.coverUrl,
		description: i.description,
		externalId: i.externalId,
		providers: savedItemProviders(i)
	};
}

export const load: PageServerLoad = async ({ parent }) => {
	const { session } = await parent();
	const userId = session?.user?.id;

	if (!userId || !isTursoConfigured()) {
		return { cloudPlaylists: [] as CloudPlaylist[] };
	}

	try {
		const packs = await listUserPlaylists(userId);
		const cloudPlaylists: CloudPlaylist[] = packs.map(({ list, items }) => ({
			id: list.id,
			slug: list.slug,
			title: list.title,
			items: items.map(mapItem)
		}));
		return { cloudPlaylists };
	} catch (e) {
		console.warn('cloud playlists load flopped', e);
		return { cloudPlaylists: [] as CloudPlaylist[] };
	}
};

type CloudPlaylist = {
	id: string;
	slug: string;
	title: string;
	items: ReturnType<typeof mapItem>[];
};

export const actions: Actions = {
	// wrapping this in auth so randoms can't edit other people's vibe lists
	saveItem: async ({ request, locals }) => {
		const session = await locals.auth();
		const userId = session?.user?.id;
		if (!userId) return fail(401, { error: 'login_required' });
		if (!isTursoConfigured()) return fail(503, { error: 'turso_not_configured' });

		const fd = await request.formData();
		const title = String(fd.get('title') || '').trim();
		const format = String(fd.get('format') || 'media').trim() || 'media';
		const listId = String(fd.get('listId') || '').trim() || null;
		if (!title) return fail(400, { error: 'missing_title' });

		try {
			const item = await addSavedItem(userId, {
				title,
				format,
				listId,
				coverUrl: String(fd.get('coverUrl') || '') || null,
				description: String(fd.get('description') || '') || null,
				externalId: String(fd.get('externalId') || '') || null,
				providers: String(fd.get('providers') || '') || null
			});
			return { ok: true, itemId: item.id, listId: item.listId };
		} catch (e: any) {
			console.error('saveItem boom', e);
			return fail(500, { error: e?.message || 'save_failed' });
		}
	},

	createPlaylist: async ({ request, locals }) => {
		const session = await locals.auth();
		const userId = session?.user?.id;
		if (!userId) return fail(401, { error: 'login_required' });
		if (!isTursoConfigured()) return fail(503, { error: 'turso_not_configured' });

		const fd = await request.formData();
		const title = String(fd.get('title') || '').trim();
		if (!title) return fail(400, { error: 'missing_title' });

		try {
			const list = await createPlaylist(userId, title);
			return { ok: true, listId: list.id, slug: list.slug, title: list.title };
		} catch (e: any) {
			console.error('createPlaylist boom', e);
			return fail(500, { error: e?.message || 'create_failed' });
		}
	},

	removeItem: async ({ request, locals }) => {
		const session = await locals.auth();
		const userId = session?.user?.id;
		if (!userId) return fail(401, { error: 'login_required' });
		if (!isTursoConfigured()) return fail(503, { error: 'turso_not_configured' });

		const fd = await request.formData();
		const itemId = String(fd.get('itemId') || '').trim();
		const title = String(fd.get('title') || '').trim();
		const format = String(fd.get('format') || 'media').trim() || 'media';
		const listId = String(fd.get('listId') || '').trim() || null;

		try {
			if (itemId) {
				await removeSavedItem(userId, itemId);
			} else if (title) {
				await removeSavedItemByTitle(userId, title, format, listId);
			} else {
				return fail(400, { error: 'missing_id' });
			}
			return { ok: true };
		} catch (e: any) {
			console.error('removeItem boom', e);
			return fail(500, { error: e?.message || 'remove_failed' });
		}
	}
};
