import { SvelteKitAuth } from '@auth/sveltekit';
import Discord from '@auth/sveltekit/providers/discord';
import Credentials from '@auth/sveltekit/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb, isTursoConfigured } from '$lib/server/db';
import { users, accounts, sessions } from '$lib/server/schema';
import { verifyPassword } from '$lib/server/password';
import { usernameToAuthEmail } from '$lib/usernameAuth';
import { discordRedirectUri } from '$lib/discordAuth';

// discord + email/password only — credentials need jwt even with the drizzle adapter
export const { handle, signIn, signOut } = SvelteKitAuth(async (event: RequestEvent) => {
	const providers = [];

	const secret = (env.AUTH_SECRET || '').trim();
	if (!secret && env.NODE_ENV === 'production') {
		console.error('AUTH_SECRET is missing — set it before shipping or sessions are toast');
	}

	const dcId = env.AUTH_DISCORD_ID || env.DISCORD_CLIENT_ID;
	const dcSecret = env.AUTH_DISCORD_SECRET || env.DISCORD_CLIENT_SECRET;
	if (dcId && dcSecret) {
		// dynamically setting the oauth redirect origin so discord doesn't reject the callback url
		const redirectUri = discordRedirectUri(event.url.origin);
		providers.push(
			Discord({
				clientId: dcId,
				clientSecret: dcSecret,
				authorization: {
					params: {
						redirect_uri: redirectUri
					}
				}
			})
		);
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
				const email = usernameToAuthEmail(creds?.email) || usernameToAuthEmail(creds?.username);
				const password = String(creds?.password || '');
				if (!email || !password) return null;
				if (!isTursoConfigured()) return null;

				const db = getDb();
				const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
				const row = rows[0];
				if (!row) return null;

				// checking the password hash against what they typed in
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

	const tursoReady = isTursoConfigured();

	return {
		providers,
		secret: secret || undefined,
		trustHost: true,
		basePath: '/auth',
		pages: {
			signIn: '/signin'
		},
		// adapter stores discord accounts/sessions in turso; jwt still required for credentials
		...(tursoReady
			? {
					adapter: DrizzleAdapter(getDb(), {
						usersTable: users,
						accountsTable: accounts,
						sessionsTable: sessions
					})
				}
			: {}),
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
			}
		}
	};
});
