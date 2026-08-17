/** tiny helpers so we don't ship footguns on a public repo */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
	const email = String(raw || '')
		.trim()
		.toLowerCase()
		.slice(0, 254);
	if (!email || !EMAIL_RE.test(email)) return null;
	return email;
}

export function sanitizeName(raw: unknown): string {
	return String(raw || '')
		.replace(/[\u0000-\u001f<>]/g, '')
		.trim()
		.slice(0, 80);
}

export function sanitizeShortText(raw: unknown, max = 200): string {
	return String(raw || '')
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
		.trim()
		.slice(0, max);
}

export type SavedProvider = {
	name: string;
	logo: string | null;
	url?: string | null;
	type?: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
};

/** yank a tiny providers array out of form/json junk before we stash it in turso */
export function sanitizeProvidersJson(raw: unknown): string | null {
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		const s = raw.trim();
		if (!s) return null;
		try {
			parsed = JSON.parse(s);
		} catch {
			return null;
		}
	}
	if (!Array.isArray(parsed)) return null;

	const out: SavedProvider[] = [];
	for (const row of parsed.slice(0, 24)) {
		if (!row || typeof row !== 'object') continue;
		const r = row as Record<string, unknown>;
		const name = sanitizeShortText(r.name, 80);
		if (!name) continue;
		const logoRaw = r.logo != null ? String(r.logo) : '';
		const logo = logoRaw ? sanitizeCoverUrl(logoRaw) : null;
		const url = r.url != null ? sanitizeCoverUrl(String(r.url)) : null;
		const typeRaw = String(r.type || '');
		const type =
			typeRaw === 'flatrate' ||
			typeRaw === 'rent' ||
			typeRaw === 'buy' ||
			typeRaw === 'ads' ||
			typeRaw === 'free'
				? typeRaw
				: undefined;
		out.push({ name, logo, url, type });
	}
	if (!out.length) return null;
	return JSON.stringify(out);
}

export function parseProvidersJson(raw: string | null | undefined): SavedProvider[] {
	if (!raw) return [];
	try {
		const sanitized = sanitizeProvidersJson(raw);
		if (!sanitized) return [];
		return JSON.parse(sanitized) as SavedProvider[];
	} catch {
		return [];
	}
}

/** only allow http(s) covers — blocks javascript: / weird schemes */
export function sanitizeCoverUrl(raw: unknown): string | null {
	const u = String(raw || '').trim();
	if (!u) return null;
	if (u.length > 2048) return null;
	if (u.startsWith('data:image/')) return u.slice(0, 2048);
	try {
		const parsed = new URL(u);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

export function passwordLooksOk(password: string): { ok: true } | { ok: false; error: string } {
	if (password.length < 8) return { ok: false, error: 'Password needs at least 8 characters' };
	// bcrypt blows up / gets silly slow on mega strings
	if (password.length > 72) return { ok: false, error: 'Password is too long (72 max)' };
	return { ok: true };
}

// super basic in-memory throttle — resets on cold start, good enough vs casual spam
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hitRateLimit(key: string, limit = 12, windowMs = 10 * 60 * 1000): boolean {
	const now = Date.now();
	const hit = buckets.get(key);
	if (!hit || hit.resetAt < now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}
	hit.count += 1;
	if (hit.count > limit) return true;
	return false;
}

export function clientIp(request: Request, getClientAddress?: () => string): string {
	try {
		if (getClientAddress) return getClientAddress() || 'unknown';
	} catch {
		/* shrug */
	}
	const xf = request.headers.get('x-forwarded-for');
	if (xf) return xf.split(',')[0]?.trim() || 'unknown';
	return 'unknown';
}
