/** Local Aura List — watchlist / backlog in localStorage */

export type AuraListItem = {
	id: string;
	title: string;
	cover: string;
	year?: string;
	mediaType?: string;
	kind?: 'song' | 'media' | 'game';
	artist?: string;
	pitch?: string;
	savedAt: number;
};

const KEY = 'aurawatch_list_v1';
const MAX = 80;

function safeParse(raw: string | null): AuraListItem[] {
	if (!raw) return [];
	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) return [];
		return data
			.filter((x) => x && typeof x.title === 'string')
			.map((x) => ({
				id: String(x.id || makeId(x.title, x.mediaType, x.artist)),
				title: String(x.title),
				cover: String(x.cover || ''),
				year: x.year ? String(x.year) : undefined,
				mediaType: x.mediaType ? String(x.mediaType) : undefined,
				kind: x.kind === 'song' || x.kind === 'game' ? x.kind : 'media',
				artist: x.artist ? String(x.artist) : undefined,
				pitch: x.pitch ? String(x.pitch) : undefined,
				savedAt: typeof x.savedAt === 'number' ? x.savedAt : Date.now()
			}));
	} catch {
		return [];
	}
}

export function makeId(title: string, mediaType?: string, artist?: string): string {
	return [title, mediaType || '', artist || '']
		.join('|')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function loadAuraList(): AuraListItem[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return safeParse(localStorage.getItem(KEY));
	} catch {
		return [];
	}
}

export function saveAuraList(items: AuraListItem[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
	} catch {
		/* quota / private mode */
	}
}

export function isOnAuraList(list: AuraListItem[], id: string): boolean {
	return list.some((x) => x.id === id);
}

export function toggleAuraListItem(
	list: AuraListItem[],
	item: Omit<AuraListItem, 'savedAt' | 'id'> & { id?: string }
): AuraListItem[] {
	const id = item.id || makeId(item.title, item.mediaType, item.artist);
	if (list.some((x) => x.id === id)) {
		return list.filter((x) => x.id !== id);
	}
	const next: AuraListItem = {
		id,
		title: item.title,
		cover: item.cover || '',
		year: item.year,
		mediaType: item.mediaType,
		kind: item.kind || 'media',
		artist: item.artist,
		pitch: item.pitch,
		savedAt: Date.now()
	};
	return [next, ...list].slice(0, MAX);
}
