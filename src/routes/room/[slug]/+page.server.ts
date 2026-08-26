import { error, isHttpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import {
	getRoomBySlug,
	normalizeRoomSlug,
	ROOM_EXPIRED_MSG,
	roomPublicJson
} from '$lib/server/rooms';

export const load: PageServerLoad = async ({ params }) => {
	if (!isTursoConfigured()) {
		error(503, 'Group rooms need Turso configured');
	}

	const slug = normalizeRoomSlug(params.slug || '');
	if (!slug) error(404, 'Room not found');

	try {
		const pack = await getRoomBySlug(slug);
		if (!pack) error(404, 'Room not found');
		const pub = roomPublicJson(pack);
		return {
			room: pub.room,
			participants: pub.participants,
			recommendations: pub.recommendations,
			matchedAt: pub.matchedAt,
			filters: pub.filters
		};
	} catch (e: unknown) {
		if (isHttpError(e)) throw e;
		const msg = e instanceof Error ? e.message : String(e);
		// checking if a room is older than 24 hours and marking it as expired/deleting it automatically
		if (msg === 'room_expired') error(410, ROOM_EXPIRED_MSG);
		console.error('room slug load boom', { slug, err: e });
		error(500, 'Could not load room');
	}
};
