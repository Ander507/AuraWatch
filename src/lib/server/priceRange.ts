/** Games price-range filter — prompt hard constraints + card badges */

export type PriceRangeId = 'free' | 'under20' | 'mid' | 'aaa';

const IDS = new Set<string>(['free', 'under20', 'mid', 'aaa']);

export function parsePriceRange(raw: unknown): PriceRangeId | null {
	const v = String(raw ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '');
	if (!v || v === 'any' || v === 'all') return null;
	// aliases
	if (v === 'ftp' || v === 'freetoplay' || v === 'free-to-play' || v === '0') return 'free';
	if (v === 'budget' || v === 'indie' || v === '<20' || v === 'under_20') return 'under20';
	if (v === 'aa' || v === '20-45' || v === 'midtier') return 'mid';
	if (v === 'premium' || v === '50+' || v === 'fullprice') return 'aaa';
	return IDS.has(v) ? (v as PriceRangeId) : null;
}

export function priceRangeBadge(id: PriceRangeId | null): string | null {
	if (!id) return null;
	if (id === 'free') return 'Free to Play';
	if (id === 'under20') return 'Under $20';
	if (id === 'mid') return '$20–$45';
	return 'AAA';
}

/** Soft line in the USER INPUT block. */
export function priceRangePromptBlock(id: PriceRangeId | null): string {
	if (!id) return '- Price range: Any';
	if (id === 'free') {
		return `- Price range (HARD): Free-to-Play only ($0). Examples: CS2, Valorant, League of Legends, Apex Legends, Genshin Impact, Trackmania, Fortnite, Warframe.`;
	}
	if (id === 'under20') {
		return `- Price range (HARD): Budget / indie — normally launches under $20 USD. Examples: Terraria, Hollow Knight, Stardew Valley, Vampire Survivors, Hades, Celeste.`;
	}
	if (id === 'mid') {
		return `- Price range (HARD): Mid-tier / AA — typically $20–$45 USD (incl. common sale-price AA titles).`;
	}
	return `- Price range (HARD): AAA / premium flagship — full-price $50–$70 USD releases.`;
}

/** Strict rule appended to STRICT RULES. */
export function priceRangeStrictRule(id: PriceRangeId | null): string {
	if (!id) return '';
	if (id === 'free') {
		return `STRICT REQUIREMENT: Only suggest Free-to-Play or free games (e.g. CS2, Valorant, League of Legends, Apex Legends, Genshin Impact, Trackmania, etc.). Reject paid premium titles.`;
	}
	if (id === 'under20') {
		return `STRICT REQUIREMENT: Only suggest budget or indie titles that normally launch under $20 USD (e.g., Terraria, Hollow Knight, Stardew Valley, Vampire Survivors). Reject AAA full-price and mid-tier $40+ launches.`;
	}
	if (id === 'mid') {
		return `STRICT REQUIREMENT: Only suggest mid-range or AA games priced between $20 and $45 USD. Reject free-to-play and $50+ AAA flagships.`;
	}
	return `STRICT REQUIREMENT: Only suggest major AAA or full-price flagship releases ($50–$70 USD). Reject free-to-play and budget indie.`;
}
