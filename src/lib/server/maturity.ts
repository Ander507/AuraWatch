/** Content maturity filter — Family / Teen / Mature (prompt + TMDB cert gate) */

export type MaturityLevel = 'family' | 'teen' | 'mature';

export type MaturityFilter = {
	id: MaturityLevel;
	label: string;
	/** Highest cert bucket allowed (1=family, 2=teen, 3=mature/any) */
	maxBucket: 1 | 2 | 3;
};

export const MATURITY_OPTIONS: MaturityFilter[] = [
	{ id: 'family', label: 'Family Friendly', maxBucket: 1 },
	{ id: 'teen', label: 'Teen', maxBucket: 2 },
	{ id: 'mature', label: 'Mature', maxBucket: 3 }
];

/** Parse body.maturity / contentRating. Empty / any → null (no filter). */
export function parseMaturity(raw: unknown): MaturityLevel | null {
	if (raw == null || raw === '' || raw === 'any' || raw === 'all') return null;
	const s = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
	if (s === 'family' || s === 'familyfriendly' || s === 'kids' || s === 'pg') return 'family';
	if (s === 'teen' || s === 'teens' || s === 'pg13' || s === 'pg-13') return 'teen';
	if (s === 'mature' || s === 'adult' || s === 'r' || s === 'unrestricted') return 'mature';
	return null;
}

export function maturityFilter(level: MaturityLevel | null): MaturityFilter | null {
	if (!level) return null;
	return MATURITY_OPTIONS.find((o) => o.id === level) ?? null;
}

/**
 * Map a US cert string to a bucket.
 * 1 = G/PG/E family, 2 = PG-13/TV-14/T teen, 3 = R/TV-MA/M mature.
 * null = unknown / unrated — treat as pass-through.
 */
export function certBucket(cert: string | null | undefined): 1 | 2 | 3 | null {
	if (!cert) return null;
	const c = cert.trim().toUpperCase().replace(/\s+/g, '-');
	if (!c || c === 'NR' || c === 'NOT-RATED' || c === 'UNRATED' || c === 'N/A' || c === 'RP') return null;

	// Family — movies/TV + ESRB/PEGI games
	if (
		c === 'G' ||
		c === 'TV-Y' ||
		c === 'TV-Y7' ||
		c === 'TV-Y7-FV' ||
		c === 'TV-G' ||
		c === 'PG' ||
		c === 'TV-PG' ||
		c === 'E' ||
		c === 'EC' ||
		c === 'E10' ||
		c === 'E10+' ||
		c === 'PEGI-3' ||
		c === 'PEGI-7' ||
		c === 'PEGI3' ||
		c === 'PEGI7'
	) {
		return 1;
	}

	// Teen
	if (
		c === 'PG-13' ||
		c === 'TV-14' ||
		c === '12' ||
		c === '12A' ||
		c === '13' ||
		c === '14' ||
		c === '15' ||
		c === 'T' ||
		c === 'PEGI-12' ||
		c === 'PEGI-16' ||
		c === 'PEGI12' ||
		c === 'PEGI16'
	) {
		return 2;
	}

	// Mature
	if (
		c === 'R' ||
		c === 'NC-17' ||
		c === 'TV-MA' ||
		c === 'X' ||
		c === '18' ||
		c === '18+' ||
		c === 'R18' ||
		c === 'MA15+' ||
		c === 'R21' ||
		c === 'M' ||
		c === 'AO' ||
		c === 'PEGI-18' ||
		c === 'PEGI18'
	) {
		return 3;
	}

	return null;
}

export function certificationAllowed(
	cert: string | null | undefined,
	maturity: MaturityLevel | null
): boolean {
	if (!maturity || maturity === 'mature') return true;
	const bucket = certBucket(cert);
	if (bucket == null) return true; // unknown — keep, don't over-filter
	const max = maturity === 'family' ? 1 : 2;
	return bucket <= max;
}

export function maturityPromptLabel(maturity: MaturityLevel | null): string {
	if (!maturity) return 'Any';
	if (maturity === 'family') return 'Family Friendly (G / PG / TV-Y–TV-PG only)';
	if (maturity === 'teen') return 'Teen (up to PG-13 / TV-14)';
	return 'Mature (any rating, including R / TV-MA)';
}

/** Hard constraint block for Gemini concierge / music / games prompts. */
export function maturityPromptBlock(
	maturity: MaturityLevel | null,
	kind: 'media' | 'music' | 'games'
): string {
	if (!maturity || maturity === 'mature') {
		if (kind === 'games') {
			return `- Content rating: Any (including ESRB M / AO when it fits the vibe)`;
		}
		return kind === 'media'
			? `- Content rating: Any (including R / TV-MA when it fits the vibe)`
			: `- Content: Explicit / mature lyrics OK when they fit the vibe`;
	}

	if (maturity === 'family') {
		if (kind === 'games') {
			return `- Content rating (HARD): Family Friendly — ONLY games rated ESRB E / E10+ / EC (or PEGI 3–7). NEVER recommend ESRB T/M/AO or PEGI 16/18 titles.`;
		}
		return kind === 'media'
			? `- Content rating (HARD): Family Friendly — ONLY titles rated G, PG, TV-Y, TV-Y7, TV-G, or TV-PG (or equivalent). NEVER recommend R, NC-17, TV-MA, or titles known for graphic violence, sex, or strong language.`
			: `- Content (HARD): Family Friendly — no explicit lyrics, sexual content, or extreme violence. Prefer clean / radio edits.`;
	}

	// teen
	if (kind === 'games') {
		return `- Content rating (HARD): Teen — ONLY games rated ESRB T or lower (E, E10+, T) / PEGI 16 or lower. NEVER recommend ESRB M / AO or PEGI 18.`;
	}
	return kind === 'media'
		? `- Content rating (HARD): Teen — ONLY titles rated PG-13 / TV-14 or lower (G, PG, PG-13, TV-Y–TV-14). NEVER recommend R, NC-17, or TV-MA.`
		: `- Content (HARD): Teen-appropriate — avoid heavily explicit / X-rated tracks; mild language OK.`;
}

export function maturityStrictRule(
	maturity: MaturityLevel | null,
	kind: 'media' | 'music' | 'games'
): string {
	if (!maturity || maturity === 'mature') return '';
	if (kind === 'music') {
		return maturity === 'family'
			? `CONTENT (HARD): Every song must be family-friendly — no explicit versions.`
			: `CONTENT (HARD): Keep songs teen-appropriate — no heavily explicit tracks.`;
	}
	if (kind === 'games') {
		return maturity === 'family'
			? `CONTENT RATING (HARD): Every game must be Family Friendly (ESRB E/E10+ or equivalent). Reject T / M / AO.`
			: `CONTENT RATING (HARD): Every game must be Teen or lower (ESRB T max). Reject M / AO.`;
	}
	return maturity === 'family'
		? `CONTENT RATING (HARD): Every title must be Family Friendly (G/PG/TV-PG or lower). Reject R / NC-17 / TV-MA.`
		: `CONTENT RATING (HARD): Every title must be Teen or lower (PG-13 / TV-14 max). Reject R / NC-17 / TV-MA.`;
}