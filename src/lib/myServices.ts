/** Pin the apps they actually pay for so picks can start in two clicks. */

export type StreamService = {
	id: string;
	label: string;
	aliases: string[];
};

export const STREAM_SERVICES: StreamService[] = [
	{ id: 'netflix', label: 'Netflix', aliases: ['netflix'] },
	{ id: 'disney', label: 'Disney+', aliases: ['disney plus', 'disney+'] },
	{ id: 'prime', label: 'Prime Video', aliases: ['amazon prime', 'prime video', 'amazon video'] },
	{ id: 'max', label: 'Max', aliases: ['max', 'hbo max', 'hbo'] },
	{ id: 'hulu', label: 'Hulu', aliases: ['hulu'] },
	{ id: 'apple', label: 'Apple TV', aliases: ['apple tv', 'apple tv+', 'appletv'] },
	{ id: 'crunchyroll', label: 'Crunchyroll', aliases: ['crunchyroll'] },
	{ id: 'paramount', label: 'Paramount+', aliases: ['paramount+', 'paramount plus', 'paramount'] }
];

const KEY = 'aurawatch_services_v1';

function norm(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();
}

export function parseServiceIds(raw: unknown): string[] {
	const ids = new Set(STREAM_SERVICES.map((s) => s.id));
	const list = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,|]/);
	return list
		.map((x) => String(x).trim().toLowerCase())
		.filter((id) => ids.has(id));
}

export function loadMyServices(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return parseServiceIds(JSON.parse(localStorage.getItem(KEY) || '[]'));
	} catch {
		return [];
	}
}

export function saveMyServices(ids: string[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(parseServiceIds(ids)));
	} catch {
		/* quota */
	}
}

export function providerHitsService(
	providerName: string,
	service: StreamService
): boolean {
	const n = norm(providerName);
	if (!n) return false;
	// "Max" should still hit the "hbo max" alias, but a two-letter scrap
	// shouldn't wildcard its way into every service
	return service.aliases.some((a) => n.includes(a) || (n.length >= 3 && a.includes(n)));
}

export function itemOnMyServices(
	providers: Array<{ name?: string | null }> | undefined,
	selectedIds: string[]
): boolean {
	if (!selectedIds.length) return true;
	if (!providers?.length) return true;
	const wanted = STREAM_SERVICES.filter((s) => selectedIds.includes(s.id));
	return providers.some((p) =>
		wanted.some((s) => providerHitsService(String(p.name || ''), s))
	);
}

export function servicesPromptBlock(ids: string[]): string {
	const labels = STREAM_SERVICES.filter((s) => ids.includes(s.id)).map((s) => s.label);
	if (!labels.length) return '';
	return `- Streaming apps they actually have (HARD preference): ${labels.join(', ')}. Prefer titles likely to be on those services in their region. Skip "rent only" if a streamer match exists.`;
}
