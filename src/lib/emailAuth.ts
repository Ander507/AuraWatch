import { signIn } from '@auth/sveltekit/client';
import { deserialize } from '$app/forms';
import { safeCallbackUrl } from '$lib/authRedirect';

export type EmailAuthResult = { ok: true } | { ok: false; error: string };

async function csrfToken() {
	try {
		const res = await fetch('/auth/csrf');
		const data = await res.json();
		return typeof data?.csrfToken === 'string' ? data.csrfToken : '';
	} catch {
		return '';
	}
}

export async function signInWithEmail(
	email: string,
	password: string,
	after?: string
): Promise<EmailAuthResult> {
	const csrf = await csrfToken();
	const path = safeCallbackUrl(after, '/');
	const redirectTo = `${window.location.origin}${path}`;
	try {
		const result = await signIn('credentials', {
			email,
			password,
			...(csrf ? { csrfToken: csrf } : {}),
			redirect: false,
			redirectTo
		});
		if (result?.error) {
			return { ok: false, error: 'Wrong username or password' };
		}
		return { ok: true };
	} catch {
		try {
			const body = new URLSearchParams({
				email,
				password,
				callbackUrl: redirectTo,
				json: 'true',
				...(csrf ? { csrfToken: csrf } : {})
			});
			const res = await fetch('/auth/callback/credentials', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'X-Auth-Return-Redirect': '1'
				},
				body
			});
			const data = await res.json().catch(() => ({}));
			const url = String((data as { url?: string })?.url || '');
			if (!res.ok || /error=/i.test(url)) {
				return { ok: false, error: 'Wrong username or password' };
			}
			return { ok: true };
		} catch {
			return { ok: false, error: 'Couldn’t sign in — try again' };
		}
	}
}

export async function registerWithEmail(opts: {
	email: string;
	password: string;
	name?: string;
	after?: string;
}): Promise<EmailAuthResult> {
	const fd = new FormData();
	fd.set('email', opts.email);
	fd.set('password', opts.password);
	if (opts.name) fd.set('name', opts.name);

	try {
		const res = await fetch('?/register', { method: 'POST', body: fd });
		const result = deserialize(await res.text());
		if (result.type === 'failure') {
			const data = result.data as { error?: string } | undefined;
			return { ok: false, error: data?.error || 'Couldn’t create account' };
		}
		if (result.type === 'error') {
			return { ok: false, error: 'Couldn’t create account' };
		}
	} catch {
		return { ok: false, error: 'Couldn’t create account' };
	}

	return signInWithEmail(opts.email, opts.password, opts.after);
}
