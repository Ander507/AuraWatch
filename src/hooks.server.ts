import type { Handle } from '@sveltejs/kit';
import { handle as authHandle } from './auth';
import { DISCORD_CALLBACK_PATH } from '$lib/discordAuth';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname.replace(/\/$/, '') || '/';
	if (path === DISCORD_CALLBACK_PATH) {
		event.locals.auth = async () => null;
		event.locals.getSession = event.locals.auth;
		return resolve(event);
	}
	return authHandle({ event, resolve });
};
