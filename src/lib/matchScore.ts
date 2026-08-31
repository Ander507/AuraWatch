// calculating similarity percentage based on matching genre tags and user priorities

export type MatchTone = 'high' | 'mid' | 'low';

const STOP = new Set([
	'the',
	'and',
	'for',
	'with',
	'that',
	'this',
	'from',
	'your',
	'have',
	'just',
	'like',
	'about',
	'into',
	'some',
	'more',
	'very',
	'really',
	'kind',
	'sort',
	'feel',
	'vibe',
	'want',
	'something',
	'watching',
	'watch'
]);

function norm(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(s: string): string[] {
	return norm(s)
		.split(/\s+/)
		.filter((t) => t.length > 2 && !STOP.has(t));
}

function genreHits(userGenres: string[], itemGenres: string[]): number {
	if (!userGenres.length) return 0;
	let hits = 0;
	for (const user of userGenres) {
		const u = norm(user);
		if (!u) continue;
		const matched = itemGenres.some((g) => {
			const ig = norm(g);
			return ig === u || ig.includes(u) || u.includes(ig);
		});
		if (matched) hits += 1;
	}
	return hits;
}

export function matchPercent(opts: {
	itemGenres: string[];
	userGenres: string[];
	pitch?: string;
	notes?: string;
	notesWeight?: number;
}): number {
	const userGenres = (opts.userGenres || []).map(norm).filter(Boolean);
	const itemGenres = (opts.itemGenres || []).map(norm).filter(Boolean);
	const notes = (opts.notes || '').trim();
	const w = Math.min(100, Math.max(0, opts.notesWeight ?? 70)) / 100;

	let genreScore = 0.55;
	if (userGenres.length) {
		genreScore = genreHits(userGenres, itemGenres) / userGenres.length;
	}

	const hay = `${itemGenres.join(' ')} ${opts.pitch || ''}`.toLowerCase();
	const kws = tokens(notes);
	let kwScore = 0.5;
	if (kws.length) {
		const hits = kws.filter((k) => hay.includes(k)).length;
		kwScore = hits / kws.length;
	}

	let blended: number;
	if (userGenres.length && kws.length) {
		blended = genreScore * (1 - w) + kwScore * w;
	} else if (userGenres.length) {
		blended = genreScore;
	} else if (kws.length) {
		blended = kwScore * 0.7 + 0.22;
	} else {
		blended = 0.72;
	}

	const pct = Math.round(48 + blended * 51);
	return Math.min(99, Math.max(52, pct));
}

export function matchTone(pct: number): MatchTone {
	if (pct > 85) return 'high';
	if (pct >= 70) return 'mid';
	return 'low';
}

export function matchWhyChips(opts: {
	itemGenres: string[];
	userGenres: string[];
	pitch?: string;
	notes?: string;
	likeTitles?: string[];
}): string[] {
	const chips: string[] = [];
	const itemGenres = opts.itemGenres || [];
	const userGenres = opts.userGenres || [];
	for (const g of userGenres) {
		if (genreHits([g], itemGenres) > 0) chips.push(g);
		if (chips.length >= 3) return chips;
	}
	const hay = `${itemGenres.join(' ')} ${opts.pitch || ''}`.toLowerCase();
	for (const k of tokens(opts.notes || '')) {
		if (hay.includes(k) && !chips.some((c) => c.toLowerCase() === k)) chips.push(k);
		if (chips.length >= 3) return chips;
	}
	for (const like of opts.likeTitles || []) {
		const t = like.trim();
		if (t) chips.push(`like ${t}`);
		if (chips.length >= 3) break;
	}
	return chips.slice(0, 3);
}
