import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorkingGeminiKey, howManyKeysWeGot, discoverModelViaList, grabKeysFromEnv } from '$lib/server/geminiRotator';
import { howManyIgdbCreds, getIgdbAuth } from '$lib/server/igdbAuth';
import { env } from '$env/dynamic/private';

/**
 * Lightweight warm-up for Vercel cold starts.
 * Runs listModels once so the first /api/recommend hits a warm model cache.
 * Also refreshes IGDB Twitch token when configured.
 */
export const GET: RequestHandler = async () => {
	const started = Date.now();
	const keys = howManyKeysWeGot();
	const hasTmdb = Boolean(env.TMDB_API_KEY || env.TMDB_READ_ACCESS_TOKEN);
	const hasIgdb = howManyIgdbCreds() > 0;

	let gemini: { ok: boolean; model?: string; err?: string } = { ok: false };
	let igdb: { ok: boolean; err?: string } = { ok: false };

	if (keys > 0) {
		try {
			const first = grabKeysFromEnv()[0];
			const listed = first ? await discoverModelViaList(first) : null;
			if (listed) {
				gemini = { ok: true, model: listed };
			} else {
				const { model } = await getWorkingGeminiKey();
				gemini = { ok: true, model };
			}
		} catch (e: any) {
			gemini = { ok: false, err: e?.message || 'gemini warm failed' };
		}
	}

	if (hasIgdb) {
		try {
			await getIgdbAuth();
			igdb = { ok: true };
		} catch (e: any) {
			igdb = { ok: false, err: e?.message || 'igdb warm failed' };
		}
	}

	return json({
		ok: true,
		warm: true,
		ms: Date.now() - started,
		keys,
		tmdb: hasTmdb,
		igdb,
		gemini
	});
};
