import {
	sqliteTable,
	text,
	integer,
	primaryKey
} from 'drizzle-orm/sqlite-core';
import type { AdapterAccountType } from '@auth/core/adapters';

// auth.js adapter expects these exact column names or it throws a fit
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
	image: text('image'),
	// ours — discord accounts leave this null
	passwordHash: text('passwordHash')
});

export const accounts = sqliteTable(
	'accounts',
	{
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<AdapterAccountType>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('providerAccountId').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	sessionToken: text('sessionToken').notNull().unique(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: integer('expires', { mode: 'timestamp_ms' }).notNull()
});

/** one shareable vibe list per short slug */
export const lists = sqliteTable('lists', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull().default('My List'),
	slug: text('slug').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

// drizzle schema for the saved media. external_id is the tmdb or igdb id so we don't lose it
export const savedItems = sqliteTable('saved_items', {
	id: text('id').primaryKey(),
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	format: text('format').notNull(),
	title: text('title').notNull(),
	externalId: text('external_id'),
	coverUrl: text('cover_url'),
	description: text('description'),
	// json blob of where-to-watch providers so shared lists keep the badges
	providersJson: text('providers_json')
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type List = typeof lists.$inferSelect;
export type SavedItem = typeof savedItems.$inferSelect;
