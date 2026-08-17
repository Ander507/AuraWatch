export const DISCORD_CALLBACK_PATH = '/auth/callback/discord';

// making the redirect url dynamic so it works locally and in production
export function discordRedirectUri(origin: string) {
	const base = (origin || '').replace(/\/$/, '');
	return `${base}${DISCORD_CALLBACK_PATH}`;
}
