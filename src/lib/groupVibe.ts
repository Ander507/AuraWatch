/** Client + server helper for Group Vibe Room recommend payloads */

import { parsePlatforms } from '$lib/gamePlatforms';
import { DEFAULT_LANGUAGE, normalizeLanguage, getLanguageLabel } from '$lib/languages';
import { getRegionLabel, normalizeRegion } from '$lib/regions';

export const ROOM_EXPIRED_MSG =
	'This room expired — Group Vibe Rooms automatically self-destruct after 24 hours';

export type GroupParticipant = {
	userName: string;
	vibeNotes: string;
	likedTitles: string[] | string;
};

export type RoomFilters = {
	region: string;
	language: string;
	decade: string | null;
	maturity: string | null;
	platforms: string[];
	antiVibe: string;
};

export const EMPTY_ROOM_FILTERS: RoomFilters = {
	region: 'US',
	language: DEFAULT_LANGUAGE,
	decade: null,
	maturity: null,
	platforms: [],
	antiVibe: ''
};

export type GroupRoom = {
	format: string;
	participants: GroupParticipant[];
	filters?: RoomFilters | null;
};

const DECADE_IDS = new Set(['1980s', '1990s', '2000s', '2010s', '2020s']);
const MATURITY_IDS = new Set(['family', 'teen', 'mature']);

function parseDecadeId(raw: unknown): string | null {
	if (raw == null || raw === '' || raw === 'any' || raw === 'all') return null;
	const s = String(raw).trim();
	if (DECADE_IDS.has(s)) return s;
	const lower = s.toLowerCase();
	for (const id of DECADE_IDS) {
		if (id.toLowerCase() === lower) return id;
	}
	return null;
}

function parseMaturityId(raw: unknown): string | null {
	if (raw == null || raw === '' || raw === 'any' || raw === 'all') return null;
	const s = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
	if (s === 'family' || s === 'familyfriendly' || s === 'kids') return 'family';
	if (s === 'teen' || s === 'teens' || s === 'pg13') return 'teen';
	if (s === 'mature' || s === 'adult' || s === 'unrestricted') return 'mature';
	if (MATURITY_IDS.has(s)) return s;
	return null;
}

function parseAntiVibe(raw: unknown): string {
	return String(raw ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.slice(0, 280);
}

/** sanitize a host's filter pack — safe on client and server */
export function parseRoomFilters(raw: unknown, format?: string): RoomFilters {
	let src: Record<string, unknown> = {};
	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				src = parsed as Record<string, unknown>;
			}
		} catch {
			src = {};
		}
	} else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		src = raw as Record<string, unknown>;
	}

	const games = String(format || '').toLowerCase() === 'games';
	const regionRaw = src.region != null ? String(src.region) : null;
	const langRaw = src.language ?? src.lang ?? src.locale;
	return {
		region: normalizeRegion(regionRaw),
		language: normalizeLanguage(langRaw != null ? String(langRaw) : undefined),
		decade: parseDecadeId(src.decade ?? src.era),
		maturity: parseMaturityId(src.maturity ?? src.contentRating),
		platforms: games ? parsePlatforms(src.platforms ?? src.platform) : [],
		antiVibe: parseAntiVibe(src.antiVibe ?? src.anti_vibe ?? src.exclude)
	};
}

export function serializeRoomFilters(filters: RoomFilters): string {
	return JSON.stringify({
		region: filters.region,
		language: filters.language,
		decade: filters.decade,
		maturity: filters.maturity,
		platforms: filters.platforms.slice(0, 8),
		antiVibe: filters.antiVibe
	});
}

const MATURITY_LABEL: Record<string, string> = {
	family: 'Family',
	teen: 'Teen',
	mature: 'Mature'
};

/** compact line for the room header — "Movies · US · Teen · 2010s" */
export function roomFiltersSummary(formatLabel: string, filters: RoomFilters | null | undefined): string {
	const f = filters || EMPTY_ROOM_FILTERS;
	const bits = [formatLabel];
	if (f.region) bits.push(getRegionLabel(f.region));
	if (f.language && f.language !== DEFAULT_LANGUAGE) bits.push(getLanguageLabel(f.language));
	if (f.decade) bits.push(f.decade);
	if (f.maturity) bits.push(MATURITY_LABEL[f.maturity] || f.maturity);
	if (f.platforms.length) bits.push(f.platforms.slice(0, 3).join(', '));
	if (f.antiVibe) bits.push(`not ${f.antiVibe}`);
	return bits.join(' · ');
}

function titlesOf(p: GroupParticipant): string[] {
	if (Array.isArray(p.likedTitles)) {
		return p.likedTitles.map((t) => String(t).trim()).filter(Boolean);
	}
	return String(p.likedTitles || '')
		.split(/[,|;]/)
		.map((t) => t.trim())
		.filter(Boolean);
}

export function buildGroupRecommendBody(room: GroupRoom) {
	// querying all participants in the room and combining their vibes and likes into a single master prompt for the AI engine
	const combinedNotes = room.participants
		.map((p) => String(p.vibeNotes || '').trim())
		.filter(Boolean)
		.join(' + ');

	// ensuring the group match considers every user's input equally
	const combinedLikes = [...new Set(room.participants.flatMap((p) => titlesOf(p)))].slice(0, 24);

	const perPerson = room.participants
		.map((p) => {
			const likes = titlesOf(p);
			const vibe = String(p.vibeNotes || '').trim() || 'open to overlap';
			const likeBit = likes.length ? `; likes ${likes.join(', ')}` : '';
			return `${p.userName}: ${vibe}${likeBit}`;
		})
		.join('\n');

	const prompt = [
		'GROUP VIBE ROOM — find titles that satisfy EVERYONE equally.',
		'Do not favor only the first or loudest person. Prefer the overlapping sweet spot.',
		`Combined notes: ${combinedNotes || '(none)'}`,
		combinedLikes.length ? `Combined likes: ${combinedLikes.join(', ')}` : '',
		'Per participant:',
		perPerson || '(no participants yet)'
	]
		.filter(Boolean)
		.join('\n');

	const filters = room.filters || EMPTY_ROOM_FILTERS;

	return {
		types: [room.format],
		prompt,
		likeTitles: combinedLikes.length ? combinedLikes : undefined,
		notesWeight: 85,
		region: filters.region,
		language: filters.language,
		decade: filters.decade || undefined,
		maturity: filters.maturity || undefined,
		platforms: filters.platforms.length ? filters.platforms : undefined,
		antiVibe: filters.antiVibe || undefined
	};
}
