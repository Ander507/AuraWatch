import { eq } from 'drizzle-orm';
import type { Session } from '@auth/sveltekit';
import { getDb, isTursoConfigured } from './db';
import { sessions, users } from './schema';

export const SESSION_COOKIE = 'aura_session';
export const OAUTH_STATE_COOKIE = 'aura_oauth_state';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function randomToken(bytes = 32) {
	const buf = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createUserSession(userId: string) {
	const db = getDb();
	const sessionToken = randomToken();
	const expires = new Date(Date.now() + SESSION_MS);
	await db.insert(sessions).values({ sessionToken, userId, expires });
	return { sessionToken, expires };
}

export async function readUserSession(sessionToken?: string): Promise<Session | null> {
	if (!sessionToken || !isTursoConfigured()) return null;

	try {
		const db = getDb();
		const rows = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				expires: sessions.expires
			})
			.from(sessions)
			.innerJoin(users, eq(sessions.userId, users.id))
			.where(eq(sessions.sessionToken, sessionToken))
			.limit(1);

		const row = rows[0];
		if (!row) return null;

		if (row.expires.getTime() < Date.now()) {
			await deleteUserSession(sessionToken);
			return null;
		}

		return {
			user: { id: row.id, name: row.name, email: row.email, image: row.image },
			expires: row.expires.toISOString()
		};
	} catch (e) {
		console.warn('turso session lookup flopped', e);
		return null;
	}
}

export async function deleteUserSession(sessionToken: string) {
	if (!isTursoConfigured()) return;
	try {
		await getDb().delete(sessions).where(eq(sessions.sessionToken, sessionToken));
	} catch (e) {
		console.warn('turso session delete flopped', e);
	}
}
