/** Safe post-login paths — blocks open redirects */

export function safeCallbackUrl(raw: unknown, fallback = '/'): string {
	const s = String(raw || '').trim();
	if (!s) return fallback;
	if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return fallback;
	if (s.startsWith('/signin')) return fallback;
	try {
		const u = new URL(s, 'https://aurawatch.org');
		if (u.origin !== 'https://aurawatch.org') return fallback;
		if (u.pathname.startsWith('/signin') || u.pathname.startsWith('/login')) return fallback;
		return `${u.pathname}${u.search}`;
	} catch {
		return fallback;
	}
}

/** query string for /signin when we need to bounce back */
export function signInQuery(callback?: string | null): string {
	const next = safeCallbackUrl(callback, '/');
	if (next === '/') return '';
	return `?callbackUrl=${encodeURIComponent(next)}`;
}

/** header / CTA link to the full sign-in page, then bounce back here */
export function signInHref(callback?: string | null): string {
	return `/signin${signInQuery(callback)}`;
}
