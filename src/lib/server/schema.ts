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

/** one shareable vibe list per short slug — permanent Turso playlists for each user */
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

// creating user_lists and list_items tables in turso for permanent item saving
// (lists + saved_items — shareable playlists with cover/providers + freeform metadata json)
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
	providersJson: text('providers_json'),
	/** extra fields (rating, overview, pitch, mediaType, …) as json */
	metadata: text('metadata'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type List = typeof lists.$inferSelect;
export type SavedItem = typeof savedItems.$inferSelect;

// creating turso tables for rooms and participants to handle shared multi-user sessions
export const rooms = sqliteTable('rooms', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	creatorName: text('creator_name').notNull(),
	/** signed-in host who opened the room — guests never need this */
	creatorUserId: text('creator_user_id'),
	format: text('format').notNull().default('movie'),
	/** host filter pack (region, decade, maturity, platforms, …) as json */
	filtersJson: text('filters_json'),
	// saving the calculated group recommendations to the room state so everyone sees the exact same synced results
	cachedResults: text('cached_results'),
	matchedAt: integer('matched_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const roomParticipants = sqliteTable('room_participants', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	roomId: text('room_id')
		.notNull()
		.references(() => rooms.id, { onDelete: 'cascade' }),
	userName: text('user_name').notNull(),
	/** anonymous guest cookie token — lets guests update their own row without an account */
	guestToken: text('guest_token'),
	vibeNotes: text('vibe_notes'),
	likedTitles: text('liked_titles')
});

export type Room = typeof rooms.$inferSelect;
export type RoomParticipant = typeof roomParticipants.$inferSelect;
