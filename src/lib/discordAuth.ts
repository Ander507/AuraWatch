/** Auth.js SvelteKit Discord callback — this exact path has to be in the Discord portal */
export const DISCORD_CALLBACK_PATH = '/auth/callback/discord';

export function discordRedirectUri(origin: string) {
	const base = (origin || '').replace(/\/$/, '');
	return `${base}${DISCORD_CALLBACK_PATH}`;
}
