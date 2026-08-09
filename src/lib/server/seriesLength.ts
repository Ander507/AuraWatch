/** TV Series length filter — Gemini hard constraints + season-count gate */

export type SeriesLengthId = 'mini' | 'short' | 'medium' | 'binge';

const IDS = new Set<string>(['mini', 'short', 'medium', 'binge']);

export function parseSeriesLength(raw: unknown): SeriesLengthId | null {
	const v = String(raw ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '');
	if (!v || v === 'any' || v === 'all') return null;
	if (v === '1' || v === '1season' || v === 'miniseries' || v === 'limited') return 'mini';
	if (v === '2-3' || v === '2to3' || v === 'few') return 'short';
	if (v === '4-7' || v === '4to7') return 'medium';
	if (v === '8+' || v === '8plus' || v === 'long' || v === 'epic') return 'binge';
	return IDS.has(v) ? (v as SeriesLengthId) : null;
}

export function seriesLengthBadge(id: SeriesLengthId | null): string | null {
	if (!id) return null;
	if (id === 'mini') return '1 Season';
	if (id === 'short') return '2–3 Seasons';
	if (id === 'medium') return '4–7 Seasons';
	return '8+ Seasons';
}

export function seasonsLabel(count: number | null | undefined): string | null {
	if (count == null || !Number.isFinite(count) || count < 1) return null;
	const n = Math.round(count);
	return n === 1 ? '1 Season' : `${n} Seasons`;
}

/** True if season count fits the selected band. Unknown count → allow (LLM already filtered). */
export function seasonCountAllowed(
	count: number | null | undefined,
	id: SeriesLengthId | null
): boolean {
	if (!id) return true;
	if (count == null || !Number.isFinite(count) || count < 1) return true;
	const n = Math.round(count);
	if (id === 'mini') return n === 1;
	if (id === 'short') return n >= 2 && n <= 3;
	if (id === 'medium') return n >= 4 && n <= 7;
	return n >= 8;
}

export function seriesLengthPromptBlock(id: SeriesLengthId | null): string {
	if (!id) return '- Series length: Any';
	if (id === 'mini') {
		return `- Series length (HARD): Single-season limited series / miniseries only (exactly 1 season).`;
	}
	if (id === 'short') {
		return `- Series length (HARD): Shows with 2 to 3 seasons only.`;
	}
	if (id === 'medium') {
		return `- Series length (HARD): Shows with 4 to 7 seasons only.`;
	}
	return `- Series length (HARD): Long-running shows with 8 or more seasons.`;
}

export function seriesLengthStrictRule(id: SeriesLengthId | null): string {
	if (!id) return '';
	if (id === 'mini') {
		return `STRICT REQUIREMENT: Only suggest single-season limited series or miniseries (exactly 1 season). Reject multi-season shows.`;
	}
	if (id === 'short') {
		return `STRICT REQUIREMENT: Only suggest shows with 2 to 3 seasons. Reject 1-season miniseries and 4+ season runs.`;
	}
	if (id === 'medium') {
		return `STRICT REQUIREMENT: Only suggest shows with 4 to 7 seasons. Reject short runs and 8+ epics.`;
	}
	return `STRICT REQUIREMENT: Only suggest massive, long-running shows with 8 or more seasons.`;
}
