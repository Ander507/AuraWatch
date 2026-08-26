import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import {
	GUEST_COOKIE,
	getRoomBySlug,
	joinRoom,
	makeGuestToken,
	normalizeRoomSlug,
	ROOM_EXPIRED_MSG,
	roomPublicJson
} from '$lib/server/rooms';

function guestCookieOpts(token: string) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 365,
		value: token
	};
}

/** POST /api/rooms/[slug]/join — guests join with a nickname only (no login) */
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	if (!isTursoConfigured()) throw error(503, 'Group rooms need Turso configured');

	const slug = normalizeRoomSlug(params.slug || '');
	if (!slug) throw error(404, 'Room not found');

	let body: Record<string, unknown> = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'need json body');
	}

	const existing = cookies.get(GUEST_COOKIE)?.trim();
	const guestToken = existing || makeGuestToken();

	try {
		const pack = await joinRoom({
			slug,
			userName: String(body.userName || body.name || ''),
			guestToken,
			vibeNotes: String(body.vibeNotes || body.notes || body.prompt || ''),
			likedTitles: body.likedTitles ?? body.likes ?? body.likeTitles
		});
		cookies.set(GUEST_COOKIE, pack.guestToken, guestCookieOpts(pack.guestToken));
		return json(roomPublicJson(pack));
	} catch (e: any) {
		const msg = String(e?.message || e);
		if (msg === 'room_not_found') throw error(404, 'Room not found');
		if (msg === 'room_expired') throw error(410, ROOM_EXPIRED_MSG);
		if (msg === 'bad_name') throw error(400, 'name required');
		if (msg === 'room_full') throw error(400, 'room is full (12 max)');
		if (msg === 'turso_missing') throw error(503, 'Group rooms need Turso configured');
		console.error('join room failed', msg);
		throw error(500, 'could not join room');
	}
};

export const GET: RequestHandler = async ({ params }) => {
	if (!isTursoConfigured()) throw error(503, 'Group rooms need Turso configured');
	const slug = normalizeRoomSlug(params.slug || '');
	if (!slug) throw error(404, 'Room not found');
	try {
		const pack = await getRoomBySlug(slug);
		if (!pack) throw error(404, 'Room not found');
		return json(roomPublicJson(pack));
	} catch (e: any) {
		const msg = String(e?.message || e);
		if (msg === 'room_expired') throw error(410, ROOM_EXPIRED_MSG);
		if (e?.status) throw e;
		throw e;
	}
};
