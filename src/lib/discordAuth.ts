export const DISCORD_CALLBACK_PATH = '/auth/callback/discord';

export function canonicalAuthOrigin(origin: string) {
	try {
		const url = new URL(origin.includes('://') ? origin : `https://${origin}`);
		url.hostname = url.hostname.replace(/^www\./i, '');
		return url.origin;
	} catch {
		return String(origin || '')
			.replace(/\/$/, '')
			.replace(/^(https?:\/\/)www\./i, '$1');
	}
}

export function discordRedirectUri(origin: string) {
	return `${canonicalAuthOrigin(origin)}${DISCORD_CALLBACK_PATH}`;
}
