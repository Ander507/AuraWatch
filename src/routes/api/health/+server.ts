import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getWorkingGeminiKey,
	howManyKeysWeGot,
	discoverModelViaList,
	grabKeysFromEnv
} from '$lib/server/geminiRotator';
import { howManyIgdbCreds, getIgdbAuth } from '$lib/server/igdbAuth';
import { env } from '$env/dynamic/private';
import { isTursoConfigured } from '$lib/server/db';

/**
 * Lightweight warm-up for Vercel cold starts.
 * Keep this boring on purpose — don't leak key counts / raw errors publicly.
 */
export const GET: RequestHandler = async () => {
	const started = Date.now();
	const keys = howManyKeysWeGot();
	const hasTmdb = Boolean(env.TMDB_API_KEY || env.TMDB_READ_ACCESS_TOKEN);
	const hasIgdb = howManyIgdbCreds() > 0;

	let geminiOk = false;
	let igdbOk = false;

	if (keys > 0) {
		try {
			const first = grabKeysFromEnv()[0];
			const listed = first ? await discoverModelViaList(first) : null;
			if (listed) {
				geminiOk = true;
			} else {
				await getWorkingGeminiKey();
				geminiOk = true;
			}
		} catch {
			geminiOk = false;
		}
	}

	if (hasIgdb) {
		try {
			await getIgdbAuth();
			igdbOk = true;
		} catch {
			igdbOk = false;
		}
	}

	return json({
		ok: true,
		warm: true,
		ms: Date.now() - started,
		// booleans only — no key counts, model names, or error strings
		services: {
			gemini: geminiOk,
			tmdb: hasTmdb,
			igdb: igdbOk,
			turso: isTursoConfigured(),
			auth: Boolean((env.AUTH_SECRET || '').trim())
		}
	});
};
