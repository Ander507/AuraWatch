import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { signIn } from '../../auth';
import { createEmailUser } from '$lib/server/lists';
import { isTursoConfigured } from '$lib/server/db';
import { usernameToAuthEmail } from '$lib/usernameAuth';
import {
	clientIp,
	hitRateLimit,
	passwordLooksOk,
	sanitizeName
} from '$lib/server/security';

function redirectWasAuthError(e: unknown): boolean {
	if (!isRedirect(e)) return false;
	const loc = String(e.location || '');
	return /error=/i.test(loc) || /CredentialsSignin/i.test(loc);
}

/** auth.js's action only eats a RequestEvent, so we rebuild the form with providerId */
async function signInWithCredentials(event: RequestEvent, email: string, password: string) {
	const fd = new FormData();
	fd.set('providerId', 'credentials');
	fd.set('email', email);
	fd.set('password', password);
	fd.set('redirectTo', '/');

	const headers = new Headers();
	const cookie = event.request.headers.get('cookie');
	if (cookie) headers.set('cookie', cookie);

	const request = new Request(event.url.href, {
		method: 'POST',
		headers,
		body: fd
	});

	await signIn({ ...event, request });
}

export async function handleCredentialsLogin(event: RequestEvent) {
	const ip = clientIp(event.request, event.getClientAddress);
	if (hitRateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
		return fail(429, {
			error: 'Too many tries — slow down a bit',
			email: '',
			mode: 'login' as const
		});
	}

	const data = await event.request.formData();
	const email = usernameToAuthEmail(data.get('username') ?? data.get('email'));
	const password = String(data.get('password') || '');

	if (!email || !password) {
		return fail(400, {
			error: 'Username and password required',
			email: email || '',
			mode: 'login' as const
		});
	}
	if (!isTursoConfigured()) {
		return fail(503, {
			error: 'Auth isn’t hooked up yet (Turso missing)',
			email,
			mode: 'login' as const
		});
	}

	try {
		await signInWithCredentials(event, email, password);
	} catch (e) {
		if (redirectWasAuthError(e)) {
			return fail(400, {
				error: 'Wrong username or password',
				email,
				mode: 'login' as const
			});
		}
		if (isRedirect(e)) throw e;
		console.warn('credentials login flopped', e);
		return fail(400, {
			error: 'Wrong username or password',
			email,
			mode: 'login' as const
		});
	}

	throw redirect(303, '/');
}

export async function handleCredentialsRegister(event: RequestEvent) {
	const ip = clientIp(event.request, event.getClientAddress);
	if (hitRateLimit(`register:${ip}`, 8, 30 * 60 * 1000)) {
		return fail(429, {
			error: 'Too many signups from here — try later',
			email: '',
			mode: 'register' as const
		});
	}

	const data = await event.request.formData();
	const email = usernameToAuthEmail(data.get('username') ?? data.get('email'));
	const password = String(data.get('password') || '');
	const name = sanitizeName(data.get('name'));

	if (!email || !password) {
		return fail(400, {
			error: 'Username and password required',
			email: email || '',
			mode: 'register' as const
		});
	}
	const pw = passwordLooksOk(password);
	if (!pw.ok) {
		return fail(400, { error: pw.error, email, mode: 'register' as const });
	}
	if (!isTursoConfigured()) {
		return fail(503, {
			error: 'Auth isn’t hooked up yet (Turso missing)',
			email,
			mode: 'register' as const
		});
	}

	try {
		await createEmailUser({ email, password, name: name || undefined });
	} catch (e: any) {
		if (e?.message === 'email_taken') {
			return fail(400, {
				error: 'That username’s already taken — try logging in',
				email,
				mode: 'register' as const
			});
		}
		if (e?.message === 'bad_email') {
			return fail(400, { error: 'That username looks off', email: '', mode: 'register' as const });
		}
		if (e?.message === 'bad_password') {
			return fail(400, { error: pw.error, email, mode: 'register' as const });
		}
		console.error('register boom', e);
		return fail(500, {
			error: 'Couldn’t create account',
			email,
			mode: 'register' as const
		});
	}

	return { ok: true, email, mode: 'register' as const };
}
