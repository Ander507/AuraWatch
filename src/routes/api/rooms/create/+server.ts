import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import { createRoom } from '$lib/server/rooms';
import { sanitizeName } from '$lib/server/security';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isTursoConfigured()) {
		throw error(503, 'Group rooms need Turso configured');
	}

	const session = await locals.auth();
	const userId = session?.user?.id;
	if (!userId) {
		throw error(401, 'Sign in to create a Group Vibe Room — guests can join the link without logging in');
	}

	let body: Record<string, unknown> = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'need json body');
	}

	const creatorName =
		sanitizeName(body.creatorName || body.name || body.host) ||
		sanitizeName(session.user?.name) ||
		'Host';

	try {
		const room = await createRoom({
			creatorName,
			creatorUserId: userId,
			format: body.format as string | undefined,
			filters: body.filters ?? body
		});
		return json({
			ok: true,
			id: room.id,
			slug: room.slug,
			url: `/room/${room.slug}`
		});
	} catch (e: any) {
		console.error('create room failed', e?.message || e);
		if (e?.message === 'turso_missing') throw error(503, 'Group rooms need Turso configured');
		if (e?.message === 'auth_required') throw error(401, 'Sign in to create a room');
		throw error(500, 'could not create room');
	}
};
