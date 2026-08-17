import { redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { authCookieDomain, discordRedirectUri } from '$lib/discordAuth';
import { getDb, isTursoConfigured } from '$lib/server/db';
import { accounts, users } from '$lib/server/schema';
import {
	OAUTH_STATE_COOKIE,
	SESSION_COOKIE,
	createUserSession,
	randomToken
} from '$lib/server/discordSession';
import { sanitizeName } from '$lib/server/security';
import type { RequestHandler } from './$types';

type DiscordTokens = {
	access_token?: string;
	refresh_token?: string;
	token_type?: string;
	scope?: string;
	expires_in?: number;
};

type DiscordProfile = {
	id: string;
	username?: string;
	global_name?: string | null;
	avatar?: string | null;
	email?: string | null;
};

function avatarUrl(profile: DiscordProfile) {
	if (!profile.avatar) return null;
	const ext = profile.avatar.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}`;
}

// exchanging the discord authorization code for an access token and fetching user profile data
async function exchangeCode(code: string, redirectUri: string) {
	const clientId = env.AUTH_DISCORD_ID || env.DISCORD_CLIENT_ID;
	const clientSecret = env.AUTH_DISCORD_SECRET || env.DISCORD_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;

	const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!tokenRes.ok) {
		console.warn('discord token exchange failed', tokenRes.status, await tokenRes.text());
		return null;
	}

	const tokens = (await tokenRes.json()) as DiscordTokens;
	if (!tokens.access_token) return null;

	const meRes = await fetch('https://discord.com/api/users/@me', {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});
	if (!meRes.ok) {
		console.warn('discord profile fetch failed', meRes.status);
		return null;
	}

	const profile = (await meRes.json()) as DiscordProfile;
	if (!profile?.id) return null;

	return { tokens, profile };
}

// querying and upserting the user in turso and issuing a secure session cookie
async function upsertDiscordUser(tokens: DiscordTokens, profile: DiscordProfile) {
	const db = getDb();
	const name = sanitizeName(profile.global_name || profile.username) || 'AuraWatcher';
	const email = profile.email ? profile.email.trim().toLowerCase() : null;
	const image = avatarUrl(profile);

	const linked = await db
		.select({ userId: accounts.userId })
		.from(accounts)
		.where(and(eq(accounts.provider, 'discord'), eq(accounts.providerAccountId, profile.id)))
		.limit(1);

	let userId = linked[0]?.userId;

	if (userId) {
		await db
			.update(users)
			.set({ name, image, ...(email ? { email } : {}) })
			.where(eq(users.id, userId));
		return userId;
	}

	if (email) {
		const byEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
		userId = byEmail[0]?.id;
	}

	if (userId) {
		await db.update(users).set({ name, image }).where(eq(users.id, userId));
	} else {
		userId = `user_${randomToken(8)}`;
		await db.insert(users).values({ id: userId, name, email, image, passwordHash: null });
	}

	await db.insert(accounts).values({
		userId,
		type: 'oauth',
		provider: 'discord',
		providerAccountId: profile.id,
		access_token: tokens.access_token ?? null,
		refresh_token: tokens.refresh_token ?? null,
		expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
		token_type: tokens.token_type ?? null,
		scope: tokens.scope ?? null
	});

	return userId;
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const domain = authCookieDomain(url.origin);
	const cookieBase = { path: '/', ...(domain ? { domain } : {}) };

	const expectedState = cookies.get(OAUTH_STATE_COOKIE);
	cookies.delete(OAUTH_STATE_COOKIE, cookieBase);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (url.searchParams.get('error') || !code) throw redirect(303, '/signin?error=OAuthCallback');
	if (!state || !expectedState || state !== expectedState) {
		throw redirect(303, '/signin?error=OAuthState');
	}
	if (!isTursoConfigured()) throw redirect(303, '/signin?error=Configuration');

	let session: { sessionToken: string; expires: Date } | null = null;
	try {
		const exchanged = await exchangeCode(code, discordRedirectUri(url.origin));
		if (exchanged) {
			const userId = await upsertDiscordUser(exchanged.tokens, exchanged.profile);
			session = await createUserSession(userId);
		}
	} catch (e) {
		console.error('discord callback boom', e);
	}

	if (!session) throw redirect(303, '/signin?error=OAuthCallback');

	cookies.set(SESSION_COOKIE, session.sessionToken, {
		...cookieBase,
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		expires: session.expires
	});

	throw redirect(303, '/');
};
