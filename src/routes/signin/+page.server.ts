import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { signIn } from '../../auth';
import { createEmailUser } from '$lib/server/lists';
import { isTursoConfigured } from '$lib/server/db';
import {
	clientIp,
	hitRateLimit,
	normalizeEmail,
	passwordLooksOk,
	sanitizeName
} from '$lib/server/security';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	if (session?.user) {
		throw redirect(303, '/');
	}
	const err = url.searchParams.get('error');
	return {
		error:
			err === 'CredentialsSignin'
				? 'Wrong email or password'
				: err
					? 'Sign-in failed — try again'
					: null
	};
};

/** auth.js's action only eats a RequestEvent, so we rebuild the form with providerId */
async function signInWithCredentials(event: RequestEvent, email: string, password: string) {
	const fd = new FormData();
	fd.set('providerId', 'credentials');
	fd.set('email', email);
	fd.set('password', password);
	fd.set('redirectTo', '/');

	const request = new Request(event.request.url, {
		method: 'POST',
		headers: event.request.headers,
		body: fd
	});

	await signIn({ ...event, request });
}

function redirectWasAuthError(e: unknown): boolean {
	if (!isRedirect(e)) return false;
	const loc = String(e.location || '');
	return /error=/i.test(loc) || /CredentialsSignin/i.test(loc);
}

export const actions: Actions = {
	login: async (event) => {
		const ip = clientIp(event.request, event.getClientAddress);
		if (hitRateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
			return fail(429, {
				error: 'Too many tries — slow down a bit',
				email: '',
				mode: 'login' as const
			});
		}

		const data = await event.request.formData();
		const email = normalizeEmail(data.get('email'));
		const password = String(data.get('password') || '');

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password required',
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
					error: 'Wrong email or password',
					email,
					mode: 'login' as const
				});
			}
			if (isRedirect(e)) throw e;
			console.warn('credentials login flopped');
			return fail(400, {
				error: 'Wrong email or password',
				email,
				mode: 'login' as const
			});
		}

		throw redirect(303, '/');
	},

	register: async (event) => {
		const ip = clientIp(event.request, event.getClientAddress);
		if (hitRateLimit(`register:${ip}`, 8, 30 * 60 * 1000)) {
			return fail(429, {
				error: 'Too many signups from here — try later',
				email: '',
				mode: 'register' as const
			});
		}

		const data = await event.request.formData();
		const email = normalizeEmail(data.get('email'));
		const password = String(data.get('password') || '');
		const name = sanitizeName(data.get('name'));

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password required',
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
					error: 'That email’s already registered — try logging in',
					email,
					mode: 'register' as const
				});
			}
			if (e?.message === 'bad_email') {
				return fail(400, { error: 'That email looks off', email: '', mode: 'register' as const });
			}
			console.error('register boom');
			return fail(500, {
				error: 'Couldn’t create account',
				email,
				mode: 'register' as const
			});
		}

		// auto-login after signup so they don’t have to type it twice
		try {
			await signInWithCredentials(event, email, password);
		} catch (e) {
			if (redirectWasAuthError(e)) {
				return fail(400, {
					error: 'Account created — try signing in',
					email,
					mode: 'login' as const
				});
			}
			if (isRedirect(e)) throw e;
			return fail(400, {
				error: 'Account created — try signing in',
				email,
				mode: 'login' as const
			});
		}

		throw redirect(303, '/');
	}
};
