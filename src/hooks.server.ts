import type { Handle } from '@sveltejs/kit';
import { handle as authHandle } from './auth';
import { DISCORD_CALLBACK_PATH } from '$lib/discordAuth';
import { SESSION_COOKIE, readUserSession } from '$lib/server/discordSession';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === DISCORD_CALLBACK_PATH) {
		event.locals.auth = () => readUserSession(event.cookies.get(SESSION_COOKIE));
		event.locals.getSession = event.locals.auth;
		return resolve(event);
	}

	return authHandle({
		event,
		resolve: (inner) => {
			const authjsSession = inner.locals.auth;
			inner.locals.auth = async () =>
				(await readUserSession(inner.cookies.get(SESSION_COOKIE))) ?? (await authjsSession());
			inner.locals.getSession = inner.locals.auth;
			return resolve(inner);
		}
	});
};
