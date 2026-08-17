import { redirect } from '@sveltejs/kit';
import { authCookieDomain } from '$lib/discordAuth';
import { SESSION_COOKIE, deleteUserSession } from '$lib/server/discordSession';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const domain = authCookieDomain(url.origin);
	const cookieBase = { path: '/', ...(domain ? { domain } : {}) };

	const token = cookies.get(SESSION_COOKIE);
	if (token) await deleteUserSession(token);
	cookies.delete(SESSION_COOKIE, cookieBase);

	const prefix = url.protocol === 'https:' ? '__Secure-' : '';
	cookies.delete(`${prefix}authjs.session-token`, cookieBase);

	throw redirect(303, '/');
};
