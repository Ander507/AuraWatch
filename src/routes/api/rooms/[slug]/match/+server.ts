import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import {
	getRoomBySlug,
	normalizeRoomSlug,
	ROOM_EXPIRED_MSG,
	roomPublicJson,
	saveRoomMatchResults
} from '$lib/server/rooms';
import { buildGroupRecommendBody } from '$lib/groupVibe';
import { hitRateLimit } from '$lib/server/security';

/** POST /api/rooms/[slug]/match — host-only: aggregate everyone, recommend, persist shared picks */
export const POST: RequestHandler = async ({ params, fetch, locals }) => {
	if (!isTursoConfigured()) throw error(503, 'Group rooms need Turso configured');

	const session = await locals.auth();
	const userId = session?.user?.id;
	if (!userId) {
		throw error(401, 'Sign in as the host to calculate the group match');
	}

	const slug = normalizeRoomSlug(params.slug || '');
	if (!slug) throw error(404, 'Room not found');

	let pack;
	try {
		// querying all participants in the room and combining their vibes and likes into a single master prompt for the AI engine
		pack = await getRoomBySlug(slug);
	} catch (e: unknown) {
		if (String((e as { message?: string })?.message || e) === 'room_expired') {
			throw error(410, ROOM_EXPIRED_MSG);
		}
		throw e;
	}
	if (!pack) throw error(404, 'Room not found');
	if (!pack.room.creatorUserId || pack.room.creatorUserId !== userId) {
		throw error(403, 'Only the host can calculate the group match');
	}
	if (!pack.participants.length) {
		throw error(400, 'Need at least one participant before matching');
	}

	if (hitRateLimit(`room-match:${userId}`, 6, 10 * 60 * 1000)) {
		throw error(429, 'Too many group matches — wait a few minutes');
	}

	// ensuring the group match considers every user's input equally
	const body = buildGroupRecommendBody({
		format: pack.room.format,
		participants: pack.participants.map((p) => ({
			userName: p.userName,
			vibeNotes: p.vibeNotes,
			likedTitles: p.likedTitles
		})),
		filters: pack.filters
	});

	const recRes = await fetch('/api/recommend', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

	const payload = await recRes.json().catch(() => ({}));
	if (!recRes.ok) {
		return json(
			{
				ok: false,
				error: payload?.message || payload?.error || 'recommendation failed',
				message: payload?.message || payload?.error || 'recommendation failed',
				participantCount: pack.participants.length
			},
			{ status: recRes.status >= 400 ? recRes.status : 502 }
		);
	}

	const list = Array.isArray(payload?.recommendations)
		? payload.recommendations
		: payload?.recommendation
			? [payload.recommendation]
			: [];

	// saving the calculated group recommendations to the room state so everyone sees the exact same synced results
	const saved = await saveRoomMatchResults(slug, list);
	if (!saved) throw error(500, 'could not save room match');

	return json({
		...roomPublicJson(saved),
		mode: payload?.mode || 'group',
		participantCount: saved.participants.length,
		promptPreview: body.prompt,
		likeTitles: body.likeTitles || []
	});
};
