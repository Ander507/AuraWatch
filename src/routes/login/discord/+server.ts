import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authCookieDomain, discordRedirectUri } from '$lib/discordAuth';
import { safeCallbackUrl } from '$lib/authRedirect';
import { OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, randomToken } from '$lib/server/discordSession';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies, url }) => {
	const clientId = env.AUTH_DISCORD_ID || env.DISCORD_CLIENT_ID;
	if (!clientId) throw redirect(303, '/signin?error=Configuration');

	const state = randomToken(16);
	const domain = authCookieDomain(url.origin);
	const cookieBase = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: 60 * 10,
		...(domain ? { domain } : {})
	};

	cookies.set(OAUTH_STATE_COOKIE, state, cookieBase);
	const next = safeCallbackUrl(url.searchParams.get('callbackUrl'));
	cookies.set(OAUTH_NEXT_COOKIE, next, cookieBase);

	const authorize = new URL('https://discord.com/api/oauth2/authorize');
	authorize.searchParams.set('client_id', clientId);
	authorize.searchParams.set('redirect_uri', discordRedirectUri(url.origin));
	authorize.searchParams.set('response_type', 'code');
	authorize.searchParams.set('scope', 'identify email');
	authorize.searchParams.set('state', state);

	throw redirect(303, authorize.toString());
};
