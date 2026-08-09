/** Curated game platforms for Target Platform filter */

export const GAME_PLATFORMS = [
	'PC',
	'Mac',
	'Linux',
	'PlayStation 5',
	'PlayStation 4',
	'PlayStation 3',
	'PlayStation 2',
	'PlayStation',
	'PSP',
	'PS Vita',
	'Xbox Series X|S',
	'Xbox One',
	'Xbox 360',
	'Nintendo Switch',
	'Wii U',
	'Wii',
	'GameCube',
	'Nintendo 64',
	'iOS',
	'Android'
] as const;

export type GamePlatform = (typeof GAME_PLATFORMS)[number];

export function filterGamePlatforms(query: string, selected: string[]): string[] {
	const q = query.trim().toLowerCase();
	const taken = new Set(selected.map((s) => s.toLowerCase()));
	const pool = GAME_PLATFORMS.filter((p) => !taken.has(p.toLowerCase()));
	if (!q) return [...pool];
	return pool.filter((p) => p.toLowerCase().includes(q));
}

export function parsePlatforms(raw: unknown): string[] {
	const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of list) {
		const t = String(item || '').trim();
		if (!t) continue;
		const key = t.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		const canon = GAME_PLATFORMS.find((p) => p.toLowerCase() === key);
		out.push(canon || t);
		if (out.length >= 8) break;
	}
	return out;
}

export function platformsPromptBlock(platforms: string[]): string {
	if (!platforms.length) return '- Target platforms: Any';
	return `- Target platforms (HARD): ${platforms.join(', ')}`;
}

export function platformsStrictRule(platforms: string[]): string {
	if (!platforms.length) return '';
	return `STRICT REQUIREMENT: The user has specified exact gaming hardware: ${platforms.join(', ')}. You MUST ONLY recommend games natively playable on at least one of these platforms. Do NOT recommend a game if it is exclusive to a platform not listed here.`;
}
