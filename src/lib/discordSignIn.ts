import { signIn } from '@auth/sveltekit/client';

export function signInWithDiscord(afterPath = '/') {
	const origin = window.location.origin;
	const next = afterPath.startsWith('/') ? afterPath : `/${afterPath}`;
	return signIn(
		'discord',
		{ callbackUrl: `${origin}${next}`, redirectTo: `${origin}${next}` },
		{ redirect_uri: window.location.origin + '/auth/callback/discord' }
	);
}
