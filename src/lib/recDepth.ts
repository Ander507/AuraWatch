/** How far off the beaten path Gemini should wander. */

export type RecDepth = 'popular' | 'balanced' | 'hidden_gem';

export const REC_DEPTH_DEFAULT: RecDepth = 'balanced';

export const REC_DEPTH_OPTIONS: { id: RecDepth; label: string; hint: string }[] = [
	{ id: 'popular', label: 'Popular', hint: 'Crowd favorites' },
	{ id: 'balanced', label: 'Balanced', hint: 'Mix of both' },
	{ id: 'hidden_gem', label: 'Hidden gem', hint: 'Niche / cult' }
];

export function parseRecDepth(raw: unknown): RecDepth {
	const s = String(raw ?? '')
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	if (s === 'popular' || s === 'mainstream' || s === 'well_known' || s === 'wellknown') {
		return 'popular';
	}
	if (
		s === 'hidden_gem' ||
		s === 'hiddengem' ||
		s === 'hidden' ||
		s === 'niche' ||
		s === 'obscure' ||
		s === 'obscurity' ||
		s === 'cult'
	) {
		return 'hidden_gem';
	}
	return REC_DEPTH_DEFAULT;
}

export function recDepthTemperature(depth: RecDepth): number {
	if (depth === 'hidden_gem') return 0.85;
	if (depth === 'popular') return 0.55;
	return 0.7;
}

export function recDepthPromptBlock(depth: RecDepth): string {
	if (depth === 'hidden_gem') {
		return `- Obscurity / Niche (HARD): Exclude universally known blockbuster titles or top 50 all-time entries. Recommend highly rated, niche, indie, or cult-classic entries with matching aesthetic aura.`;
	}
	if (depth === 'popular') {
		return `- Popularity: Prefer widely recognized, easy-to-find titles. Mainstream hits are fine when they match the vibe.`;
	}
	return `- Popularity: Mix familiar titles with lesser-known neighbors. Don't default to the same blockbusters unless they truly fit.`;
}

export function recDepthStrictRule(depth: RecDepth): string {
	if (depth === 'hidden_gem') {
		return `OBSCURITY (HARD): Exclude universally known blockbuster titles or top 50 all-time entries. Recommend highly rated, niche, indie, or cult-classic entries with matching aesthetic aura.`;
	}
	if (depth === 'popular') {
		return `POPULARITY: Prefer well-known, widely available titles a typical viewer would recognize. Skip ultra-obscure festival-only films unless nothing mainstream fits.`;
	}
	return '';
}

// steering gemini prompt toward underground and cult titles when obscurity slider is toggled
export function applyRecDepthToPrompt(prompt: string, depth: RecDepth): string {
	const extra = [recDepthPromptBlock(depth), recDepthStrictRule(depth)].filter(Boolean).join('\n');
	return extra ? `${prompt}\n${extra}` : prompt;
}
