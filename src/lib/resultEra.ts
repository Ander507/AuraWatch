export type ResultEra = 'all' | 'modern' | '2010s' | '2000s' | 'classics';

export const RESULT_ERA_OPTIONS: { id: ResultEra; label: string }[] = [
	{ id: 'all', label: 'All Time' },
	{ id: 'modern', label: 'Modern (2020+)' },
	{ id: '2010s', label: '2010s' },
	{ id: '2000s', label: '2000s' },
	{ id: 'classics', label: 'Classics (<2000)' }
];

export function parseRecYear(seasonInfo?: string | null, title?: string | null): number | null {
	const blob = `${seasonInfo || ''} ${title || ''}`;
	const years = [...blob.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1]));
	const y = years.find((n) => n >= 1900 && n <= 2100);
	return y ?? null;
}

export function matchesResultEra(year: number | null, era: ResultEra): boolean {
	if (era === 'all') return true;
	if (year == null) return false;
	if (era === 'modern') return year >= 2020;
	if (era === '2010s') return year >= 2010 && year <= 2019;
	if (era === '2000s') return year >= 2000 && year <= 2009;
	return year < 2000;
}