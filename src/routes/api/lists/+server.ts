import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import { listUserPlaylists, mapPlaylistPack } from '$lib/server/lists';

/** GET /api/lists — all saved lists + items for the signed-in user */
export const GET: RequestHandler = async ({ locals }) => {
	if (!isTursoConfigured()) throw error(503, 'Cloud lists need Turso configured');

	const session = await locals.auth();
	const userId = session?.user?.id;
	if (!userId) throw error(401, 'Sign in to view your lists');

	try {
		// handling server actions for saving items to named lists and fetching them for the user profile view
		const packs = await listUserPlaylists(userId);
		const lists = packs.map(mapPlaylistPack);
		return json({
			ok: true,
			lists,
			totalItems: lists.reduce((n, l) => n + l.items.length, 0)
		});
	} catch (e: any) {
		console.error('GET /api/lists failed', e?.message || e);
		throw error(500, 'Could not load lists');
	}
};
