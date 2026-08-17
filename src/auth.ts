import { SvelteKitAuth } from '@auth/sveltekit';
import type { SvelteKitAuthConfig } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb, isTursoConfigured } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { verifyPassword } from '$lib/server/password';
import { usernameToAuthEmail } from '$lib/usernameAuth';
import { authCookieDomain, canonicalAuthOrigin } from '$lib/discordAuth';

export async function buildAuthConfig(event: RequestEvent): Promise<SvelteKitAuthConfig> {
	const providers = [];

	const secret = (env.AUTH_SECRET || '').trim();
	if (!secret && env.NODE_ENV === 'production') {
		console.error('AUTH_SECRET is missing — set it before shipping or sessions are toast');
	}

	providers.push(
		Credentials({
			id: 'credentials',
			name: 'Email',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' }
			},
			async authorize(creds) {
				const email =
					usernameToAuthEmail(creds?.email) ||
					usernameToAuthEmail((creds as { username?: unknown } | undefined)?.username);
				const password = String(creds?.password || '');
				if (!email || !password) return null;
				if (!isTursoConfigured()) return null;

				const db = getDb();
				const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
				const row = rows[0];
				if (!row) return null;

				const ok = await verifyPassword(password, row.passwordHash);
				if (!ok) return null;

				return {
					id: row.id,
					name: row.name,
					email: row.email,
					image: row.image
				};
			}
		})
	);

	const cookieDomain = authCookieDomain(event.url.origin);
	const secure = event.url.protocol === 'https:';
	const cookiePrefix = secure ? '__Secure-' : '';
	const cookieOpts = {
		httpOnly: true,
		sameSite: 'lax' as const,
		path: '/',
		secure,
		...(cookieDomain ? { domain: cookieDomain } : {})
	};

	return {
		providers,
		secret: secret || undefined,
		trustHost: true,
		basePath: '/auth',
		useSecureCookies: secure,
		pages: {
			signIn: '/signin',
			error: '/signin'
		},
		cookies: {
			sessionToken: { name: `${cookiePrefix}authjs.session-token`, options: cookieOpts },
			callbackUrl: { name: `${cookiePrefix}authjs.callback-url`, options: cookieOpts },
			csrfToken: { name: `${cookiePrefix}authjs.csrf-token`, options: cookieOpts },
			pkceCodeVerifier: {
				name: `${cookiePrefix}authjs.pkce.code_verifier`,
				options: { ...cookieOpts, maxAge: 60 * 15 }
			},
			state: {
				name: `${cookiePrefix}authjs.state`,
				options: { ...cookieOpts, maxAge: 60 * 15 }
			},
			nonce: { name: `${cookiePrefix}authjs.nonce`, options: cookieOpts },
			webauthnChallenge: {
				name: `${cookiePrefix}authjs.challenge`,
				options: { ...cookieOpts, maxAge: 60 * 15 }
			}
		},
		session: {
			strategy: 'jwt'
		},
		callbacks: {
			async jwt({ token, user }) {
				if (user?.id) token.sub = user.id;
				return token;
			},
			async session({ session, token }) {
				if (session.user && token.sub) {
					session.user.id = token.sub;
				}
				return session;
			},
			async redirect({ url, baseUrl }) {
				const home = canonicalAuthOrigin(baseUrl);
				if (url.startsWith('/')) return `${home}${url}`;
				try {
					if (canonicalAuthOrigin(url) === home) return url;
				} catch {
					return `${home}/`;
				}
				return `${home}/`;
			}
		}
	};
}

export const { handle, signIn, signOut } = SvelteKitAuth(buildAuthConfig);
