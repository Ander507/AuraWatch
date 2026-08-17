import { signIn } from '@auth/sveltekit/client';
import { canonicalAuthOrigin, discordRedirectUri } from '$lib/discordAuth';

export function signInWithDiscord(afterPath = '/') {
	const origin = canonicalAuthOrigin(window.location.origin);
	const next = afterPath.startsWith('/') ? afterPath : `/${afterPath}`;
	return signIn(
		'discord',
		{ callbackUrl: `${origin}${next}`, redirectTo: `${origin}${next}` },
		{ redirect_uri: discordRedirectUri(origin) }
	);
}
