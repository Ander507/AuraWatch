// syncing ignored and bookmarked titles to localstorage to prevent repeat recommendations

import { makeId } from '$lib/auraList';

export type LocalTitle = {
	id: string;
	title: string;
	cover: string;
	year?: string;
	mediaType?: string;
	kind?: string;
	artist?: string;
	pitch?: string;
	savedAt: number;
};

const IGNORE_KEY = 'aurawatch_ignored_v1';
const WATCH_KEY = 'aurawatch_watchlist_v1';
const MAX = 120;

export function recLocalId(item: {
	title: string;
	mediaType?: string;
	artist?: string;
}): string {
	return makeId(item.title, item.mediaType, item.artist);
}

export function toLocalTitle(item: {
	title: string;
	cover?: string;
	seasonInfo?: string;
	mediaType?: string;
	kind?: string;
	artist?: string;
	pitch?: string;
}): LocalTitle {
	return {
		id: recLocalId(item),
		title: item.title,
		cover: item.cover || '',
		year: item.seasonInfo,
		mediaType: item.mediaType,
		kind: item.kind,
		artist: item.artist,
		pitch: item.pitch,
		savedAt: Date.now()
	};
}

function parseList(raw: string | null): LocalTitle[] {
	if (!raw) return [];
	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) return [];
		return data
			.filter((x) => x && typeof x.title === 'string')
			.map((x) => ({
				id: String(x.id || recLocalId(x)),
				title: String(x.title),
				cover: String(x.cover || ''),
				year: x.year ? String(x.year) : undefined,
				mediaType: x.mediaType ? String(x.mediaType) : undefined,
				kind: x.kind ? String(x.kind) : undefined,
				artist: x.artist ? String(x.artist) : undefined,
				pitch: x.pitch ? String(x.pitch) : undefined,
				savedAt: typeof x.savedAt === 'number' ? x.savedAt : Date.now()
			}));
	} catch {
		return [];
	}
}

function read(key: string): LocalTitle[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return parseList(localStorage.getItem(key));
	} catch {
		return [];
	}
}

function write(key: string, items: LocalTitle[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(items.slice(0, MAX)));
	} catch {
		/* quota / private mode */
	}
}

export function loadIgnoredList(): LocalTitle[] {
	return read(IGNORE_KEY);
}

export function saveIgnoredList(items: LocalTitle[]): void {
	write(IGNORE_KEY, items);
}

export function loadWatchlist(): LocalTitle[] {
	return read(WATCH_KEY);
}

export function saveWatchlist(items: LocalTitle[]): void {
	write(WATCH_KEY, items);
}

export function upsertLocalTitle(list: LocalTitle[], item: LocalTitle): LocalTitle[] {
	const rest = list.filter((x) => x.id !== item.id);
	return [{ ...item, savedAt: Date.now() }, ...rest].slice(0, MAX);
}

export function removeLocalTitle(list: LocalTitle[], id: string): LocalTitle[] {
	return list.filter((x) => x.id !== id);
}

export function toggleLocalTitle(list: LocalTitle[], item: LocalTitle): LocalTitle[] {
	if (list.some((x) => x.id === item.id)) return removeLocalTitle(list, item.id);
	return upsertLocalTitle(list, item);
}

export function isOnLocalList(list: LocalTitle[], id: string): boolean {
	return list.some((x) => x.id === id);
}
