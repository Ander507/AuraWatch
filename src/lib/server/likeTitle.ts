// yank "like Charlotte" / "similar to TED" out of freeform notes
// regex hell. if it breaks just add another pattern and pray

const LIKE_PATTERNS: RegExp[] = [
	/\b(?:shows?|series|anime|movies?|films?|something|anything)?\s*(?:that\s+(?:feels?|is)\s+)?(?:like|similar\s+to)\s+["“]?([^"”\n,.!?]+)["”]?/i,
	/\b(?:remind(?:s|ed)?\s+me\s+of|in\s+the\s+vein\s+of|à\s+la)\s+["“]?([^"”\n,.!?]+)["”]?/i
];

// these are never titles. trust me.
const JUNK = new Set([
	'this',
	'that',
	'it',
	'one',
	'something',
	'anything',
	'those',
	'these',
	'before',
	'after'
]);

export function parseLikeTitle(prompt: string): string | null {
	const raw = String(prompt || '').trim();
	if (!raw) return null;

	for (const re of LIKE_PATTERNS) {
		const m = raw.match(re);
		if (!m?.[1]) continue;
		const title = cleanLikeTitle(m[1]);
		if (title) return title;
	}

	// "TED series" / "Charlotte anime" without the word like
	if (raw.length <= 40 && !/,/.test(raw) && !/[?!]/.test(raw)) {
		const titled = raw.match(/^(.+?)\s+(series|anime|show|movie|film|tv)$/i);
		if (titled?.[1]) {
			const title = cleanLikeTitle(titled[1]);
			if (title) return title;
		}
	}

	return null;
}

export function cleanLikeTitle(raw: string): string | null {
	let t = String(raw || '').trim();
	t = t.replace(/^(the\s+show|the\s+series|the\s+anime|the\s+movie|an?\s+)\s+/i, '');
	t = t.replace(/\s+(series|show|anime|movie|film|tv)\s*$/i, '');
	t = t.replace(/\s+/g, ' ').trim();

	if (t.length < 2) return null;
	if (JUNK.has(t.toLowerCase())) return null;

	// sometimes we capture "Charlotte with a sad ending" — chop the vibe crumb
	t = t.replace(/\s+(with|and|but|that|which)\s+.*/i, '').trim();
	if (t.length < 2) return null;
	return t;
}

// leftover notes after ripping out the like-clause
export function stripLikeClause(prompt: string, likeTitle?: string | null): string {
	let s = String(prompt || '').trim();
	if (!s) return '';

	for (const re of LIKE_PATTERNS) {
		s = s.replace(re, ' ').trim();
	}

	if (likeTitle) {
		// escape regex specials the lazy way
		const esc = likeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		s = s.replace(new RegExp('\\b' + esc + '\\b', 'ig'), ' ').trim();
	}

	s = s.replace(/\s{2,}/g, ' ');
	s = s.replace(/^[,.\-–—\s]+|[,.\-–—\s]+$/g, '').trim();
	return s;
}
