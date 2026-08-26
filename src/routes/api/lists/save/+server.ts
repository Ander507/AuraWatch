import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import {
	addSavedItem,
	createPlaylist,
	listUserPlaylists,
	mapPlaylistPack,
	parseItemMetadata
} from '$lib/server/lists';

/** POST /api/lists/save — permanently save a recommendation into a named Turso list */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isTursoConfigured()) throw error(503, 'Cloud lists need Turso configured');

	const session = await locals.auth();
	const userId = session?.user?.id;
	if (!userId) throw error(401, 'Sign in to save to a list');

	let body: Record<string, unknown> = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'need json body');
	}

	const title = String(body.title || '').trim();
	const format = String(body.format || 'media').trim() || 'media';
	const listId = String(body.listId || body.list_id || '').trim() || null;
	const listName =
		String(body.listName || body.list_name || body.name || '').trim() || null;

	if (!title) throw error(400, 'title required');

	const metadataRaw = body.metadata;
	let metadata: Record<string, unknown> | null = null;
	if (metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)) {
		metadata = metadataRaw as Record<string, unknown>;
	} else if (typeof metadataRaw === 'string') {
		metadata = parseItemMetadata(metadataRaw);
	} else {
		metadata = {};
		if (body.rating != null) metadata.rating = body.rating;
		if (body.overview) metadata.overview = body.overview;
		if (body.pitch) metadata.pitch = body.pitch;
		if (body.mediaType) metadata.mediaType = body.mediaType;
		if (body.year) metadata.year = body.year;
	}

	try {
		// handling server actions for saving items to named lists and fetching them for the user profile view
		if (!listId && listName && listName.toLowerCase() !== 'my list') {
			const packs = await listUserPlaylists(userId);
			const hit = packs.find((p) => p.list.title.toLowerCase() === listName.toLowerCase());
			if (!hit) await createPlaylist(userId, listName);
		}

		const item = await addSavedItem(userId, {
			title,
			format,
			listId,
			listName: listId ? null : listName || 'My List',
			coverUrl: String(body.coverUrl || body.cover || body.image || '') || null,
			description:
				String(body.description || body.overview || body.pitch || '') || null,
			externalId: String(body.externalId || body.id || '') || null,
			providers: (body.providers as any) ?? null,
			metadata
		});

		const packs = await listUserPlaylists(userId);
		return json({
			ok: true,
			itemId: item.id,
			listId: item.listId,
			lists: packs.map(mapPlaylistPack)
		});
	} catch (e: any) {
		const msg = String(e?.message || e);
		if (msg === 'missing_title') throw error(400, 'title required');
		if (msg === 'bad_list') throw error(400, 'list not found');
		console.error('POST /api/lists/save failed', msg);
		throw error(500, 'Could not save item');
	}
};
