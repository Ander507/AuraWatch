import { safeCallbackUrl } from '$lib/authRedirect';

export function signInWithDiscord(callbackUrl?: string | null) {
	const next = safeCallbackUrl(callbackUrl, '/');
	const q = next === '/' ? '' : `?callbackUrl=${encodeURIComponent(next)}`;
	window.location.href = `/login/discord${q}`;
}

export function signOutEverywhere() {
	window.location.href = '/logout';
}
