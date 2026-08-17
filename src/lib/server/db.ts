import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

type AuraDb = ReturnType<typeof drizzle<typeof schema>>;

let client: Client | null = null;
let dbInstance: AuraDb | null = null;

function tursoCreds() {
	let url = (env.TURSO_DB_URL || env.TURSO_DATABASE_URL || '').trim();
	const authToken = (env.TURSO_DB_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || '').trim();
	// libsql client wants libsql:// — people sometimes paste turso:// from the dashboard
	if (url.startsWith('turso://')) url = `libsql://${url.slice('turso://'.length)}`;
	return { url, authToken };
}

/** true when we've got turso creds — otherwise cloud sync just nopes out */
export function isTursoConfigured(): boolean {
	const { url, authToken } = tursoCreds();
	return Boolean(url && (url.startsWith('file:') || authToken));
}

export function getDb(): AuraDb {
	if (dbInstance) return dbInstance;
	const { url, authToken } = tursoCreds();
	if (!url) {
		throw new Error('TURSO_DB_URL is missing — cloud lists need Turso');
	}
	// file: urls don't need a token (handy for local hackathon hacking)
	client = createClient({
		url,
		...(authToken ? { authToken } : {})
	});
	dbInstance = drizzle(client, { schema });
	return dbInstance;
}

/** lazy stand-in so `import { db } from '$lib/server/schema'` just works */
export const db = new Proxy({} as AuraDb, {
	get(_target, prop, receiver) {
		const real = getDb();
		const value = Reflect.get(real, prop, receiver);
		return typeof value === 'function' ? value.bind(real) : value;
	}
});
