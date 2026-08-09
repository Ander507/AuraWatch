/** Twitch OAuth client-credentials for IGDB API v4 */

import { env } from '$env/dynamic/private';

type TokenCache = {
	accessToken: string;
	expiresAt: number;
	clientId: string;
};

let tokenCache: TokenCache | null = null;
let inflight: Promise<TokenCache> | null = null;

export function igdbCredentials(): { clientId: string; clientSecret: string } | null {
	const clientId = (
		env.IGDB_CLIENT_ID ||
		env.TWITCH_CLIENT_ID ||
		env.TWITCH_CLIENT_ID_IGDB ||
		''
	).trim();
	const clientSecret = (
		env.IGDB_CLIENT_SECRET ||
		env.TWITCH_CLIENT_SECRET ||
		env.TWITCH_CLIENT_SECRET_IGDB ||
		''
	).trim();
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

export function howManyIgdbCreds(): number {
	return igdbCredentials() ? 1 : 0;
}

async function fetchNewToken(clientId: string, clientSecret: string): Promise<TokenCache> {
	const url = new URL('https://id.twitch.tv/oauth2/token');
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('client_secret', clientSecret);
	url.searchParams.set('grant_type', 'client_credentials');

	const res = await fetch(url.toString(), { method: 'POST' });
	if (!res.ok) {
		const txt = await res.text().catch(() => '');
		throw new Error(`IGDB auth failed: ${res.status} ${txt.slice(0, 160)}`);
	}
	const data = (await res.json()) as {
		access_token?: string;
		expires_in?: number;
	};
	if (!data.access_token) throw new Error('IGDB auth returned no access_token');

	const expiresIn = Number(data.expires_in) || 3600;
	// refresh a bit early
	return {
		accessToken: data.access_token,
		expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000,
		clientId
	};
}

export async function getIgdbAuth(): Promise<{ clientId: string; accessToken: string }> {
	const creds = igdbCredentials();
	if (!creds) throw new Error('IGDB needs IGDB_CLIENT_ID + IGDB_CLIENT_SECRET (Twitch app)');

	if (tokenCache && tokenCache.clientId === creds.clientId && tokenCache.expiresAt > Date.now()) {
		return { clientId: tokenCache.clientId, accessToken: tokenCache.accessToken };
	}

	if (!inflight) {
		inflight = fetchNewToken(creds.clientId, creds.clientSecret)
			.then((t) => {
				tokenCache = t;
				return t;
			})
			.finally(() => {
				inflight = null;
			});
	}

	const t = await inflight;
	return { clientId: t.clientId, accessToken: t.accessToken };
}

/** Bust token if IGDB returns 401. */
export function invalidateIgdbToken() {
	tokenCache = null;
}
