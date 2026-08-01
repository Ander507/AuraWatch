/** Decade / era filter helpers for recommend + catalog + similar paths */

export type DecadeRange = {
	id: string;
	label: string;
	yearFrom: number;
	yearTo: number;
};

export const DECADE_OPTIONS: DecadeRange[] = [
	{ id: '1980s', label: '1980s', yearFrom: 1980, yearTo: 1989 },
	{ id: '1990s', label: '1990s', yearFrom: 1990, yearTo: 1999 },
	{ id: '2000s', label: '2000s', yearFrom: 2000, yearTo: 2009 },
	{ id: '2010s', label: '2010s', yearFrom: 2010, yearTo: 2019 },
	{ id: '2020s', label: '2020s', yearFrom: 2020, yearTo: 2029 }
];

/** Parse decade id like "2010s" / "2010" / omit → null (any era). */
export function parseDecade(raw: unknown): DecadeRange | null {
	if (raw == null || raw === '' || raw === 'any' || raw === 'all') return null;
	const s = String(raw).trim().toLowerCase();
	const match = DECADE_OPTIONS.find(
		(d) => d.id.toLowerCase() === s || d.label.toLowerCase() === s
	);
	if (match) return match;

	const m = s.match(/^(19|20)(\d)0s?$/);
	if (m) {
		const yearFrom = Number(m[1] + m[2] + '0');
		return {
			id: `${yearFrom}s`,
			label: `${yearFrom}s`,
			yearFrom,
			yearTo: yearFrom + 9
		};
	}
	return null;
}

export function yearInDecade(year: number | string | null | undefined, decade: DecadeRange | null): boolean {
	if (!decade) return true;
	const y = typeof year === 'number' ? year : Number(String(year || '').slice(0, 4));
	if (!Number.isFinite(y) || y < 1000) return false;
	return y >= decade.yearFrom && y <= decade.yearTo;
}

export function decadePromptLabel(decade: DecadeRange | null): string {
	if (!decade) return 'Any era';
	return `${decade.label} (${decade.yearFrom}–${decade.yearTo})`;
}
