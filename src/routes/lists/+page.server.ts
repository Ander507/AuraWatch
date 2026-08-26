import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import {
	listUserPlaylists,
	mapPlaylistPack,
	removeSavedItem,
	removeSavedItemByTitle
} from '$lib/server/lists';

// handling server actions for saving items to named lists and fetching them for the user profile view

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/signin?callbackUrl=${encodeURIComponent(url.pathname)}`);
	}

	if (!isTursoConfigured()) {
		return { lists: [], tursoReady: false, session };
	}

	try {
		const packs = await listUserPlaylists(session.user.id);
		return {
			lists: packs.map(mapPlaylistPack),
			tursoReady: true,
			session
		};
	} catch (e) {
		console.warn('lists page load flopped', e);
		return { lists: [], tursoReady: true, session };
	}
};

export const actions: Actions = {
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
			console.error('lists removeItem boom', e);
			return fail(500, { error: e?.message || 'remove_failed' });
		}
	}
};
