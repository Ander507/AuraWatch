const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// swapping email for username in the ui and mapping it to a local domain behind the scenes for the auth backend
export function usernameToAuthEmail(raw: unknown): string | null {
	const username = String(raw || '').trim().toLowerCase();
	if (!username) return null;
	if (username.includes('@')) {
		const email = username.slice(0, 254);
		return EMAIL_RE.test(email) ? email : null;
	}
	const safe = username.replace(/[^a-z0-9._-]/g, '').slice(0, 32);
	if (!safe) return null;
	return `${safe}@aurawatch.local`;
}
