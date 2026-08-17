import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { isTursoConfigured } from '$lib/server/db';
import { debugListSlugs } from '$lib/server/lists';

// temporary debug dump — hit /api/debug/lists then check the network tab / console
export const GET: RequestHandler = async () => {
	const unlocked = dev || env.DEBUG_LISTS === '1';
	if (!unlocked) {
		error(404, 'Not found');
	}

	if (!isTursoConfigured()) {
		return json({ ok: false, error: 'turso_not_configured', lists: [] }, { status: 503 });
	}

	try {
		const lists = await debugListSlugs(50);
		// also spam the server terminal so it's obvious during npm run dev
		console.log('[debug/lists] turso dump', lists);
		return json({
			ok: true,
			count: lists.length,
			lists,
			hint: 'open this url then check the terminal — or read the json response'
		});
	} catch (e: any) {
		console.error('[debug/lists] boom', e);
		return json({ ok: false, error: e?.message || 'failed', lists: [] }, { status: 500 });
	}
};
