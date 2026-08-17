import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// drizzle-kit chokes on turso:// — normalize to libsql://
function tursoUrl() {
	let url = (process.env.TURSO_DB_URL || process.env.TURSO_DATABASE_URL || '').trim();
	if (url.startsWith('turso://')) url = `libsql://${url.slice('turso://'.length)}`;
	return url;
}

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './drizzle',
	dialect: 'turso',
	dbCredentials: {
		url: tursoUrl(),
		authToken: process.env.TURSO_DB_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || ''
	}
});
