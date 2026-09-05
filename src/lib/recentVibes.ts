/** Last few vibe shots so you can re-fire Friday night without rebuilding the form. */

export type RecentVibe = {
	id: string;
	label: string;
	vibe: string;
	types: string[];
	genres: string[];
	runtime?: string;
	services?: string[];
	likes?: string[];
	antiVibe?: string;
	decade?: string;
	savedAt: number;
};

const KEY = 'aurawatch_recent_vibes_v1';
const MAX = 8;

export function loadRecentVibes(): RecentVibe[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const data = JSON.parse(localStorage.getItem(KEY) || '[]');
		if (!Array.isArray(data)) return [];
		return data
			.filter((x) => x && typeof x.vibe === 'string')
			.map((x, i) => ({
				// older entries may predate ids — index keeps the chip list keyable
				id: String(x.id || `${x.savedAt || 'vibe'}-${i}`),
				label: String(x.label || x.vibe || 'vibe'),
				vibe: String(x.vibe || ''),
				types: Array.isArray(x.types) ? x.types.map(String) : [],
				genres: Array.isArray(x.genres) ? x.genres.map(String) : [],
				runtime: typeof x.runtime === 'string' ? x.runtime : undefined,
				services: Array.isArray(x.services) ? x.services.map(String) : undefined,
				likes: Array.isArray(x.likes) ? x.likes.map(String) : undefined,
				antiVibe: typeof x.antiVibe === 'string' ? x.antiVibe : undefined,
				decade: typeof x.decade === 'string' ? x.decade : undefined,
				savedAt: typeof x.savedAt === 'number' ? x.savedAt : Date.now()
			}))
			.slice(0, MAX);
	} catch {
		return [];
	}
}

export function pushRecentVibe(
	list: RecentVibe[],
	entry: Omit<RecentVibe, 'id' | 'savedAt' | 'label'> & { label?: string }
): RecentVibe[] {
	const vibe = entry.vibe.trim();
	if (!vibe && !entry.genres.length) return list;
	const label = (entry.label || vibe || entry.genres.slice(0, 2).join(' / ') || 'vibe').slice(
		0,
		42
	);
	const id = `${vibe}|${entry.types.join(',')}|${entry.genres.join(',')}|${entry.runtime || ''}|${(entry.services || []).join(',')}`.toLowerCase();
	const next: RecentVibe = {
		id,
		label,
		vibe,
		types: entry.types,
		genres: entry.genres,
		runtime: entry.runtime,
		services: entry.services,
		likes: entry.likes,
		antiVibe: entry.antiVibe,
		decade: entry.decade,
		savedAt: Date.now()
	};
	const rest = list.filter((x) => x.id !== id);
	const out = [next, ...rest].slice(0, MAX);
	try {
		if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(out));
	} catch {
		/* quota */
	}
	return out;
}
