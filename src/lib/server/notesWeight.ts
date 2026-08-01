/** Notes vs Similar-to weighting (0 = Similar-to heavy, 100 = Notes heavy). */

export const NOTES_WEIGHT_DEFAULT = 70;
export const NOTES_WEIGHT_MIN = 0;
export const NOTES_WEIGHT_MAX = 100;

export function parseNotesWeight(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n)) return NOTES_WEIGHT_DEFAULT;
	return Math.min(NOTES_WEIGHT_MAX, Math.max(NOTES_WEIGHT_MIN, Math.round(n)));
}

export type WeightBand = 'similar' | 'balanced' | 'notes';

export function notesWeightBand(weight: number): WeightBand {
	if (weight <= 35) return 'similar';
	if (weight <= 55) return 'balanced';
	return 'notes';
}

/** Copy for Gemini PRIORITY WEIGHTING block. */
export function buildWeightingBlock(opts: {
	weight: number;
	hasNotes: boolean;
	hasLikes: boolean;
	kind?: 'media' | 'music';
}): string {
	const { weight, hasNotes, hasLikes } = opts;
	if (!hasNotes && !hasLikes) return '';
	if (!hasNotes) return ''; // no Notes → no Notes-vs-Similar block needed

	const band = notesWeightBand(weight);
	const likesLabel = opts.kind === 'music' ? 'Similar-to songs/artists' : 'Similar-to titles';
	const notesPct = weight;
	const likesPct = 100 - weight;

	if (!hasLikes) {
		return `
PRIORITY WEIGHTING:
- User Notes weight: ${notesPct}/100 (no Similar-to references provided).
- Treat Notes / Vibe as the primary predictor for every pick.`;
	}

	if (band === 'notes') {
		return `
PRIORITY WEIGHTING (CRITICAL) — user set Notes weight ${notesPct}/100 (Similar-to ${likesPct}/100):
- Notes / Vibe/Prompt is the PRIMARY, highest-weighted predictor for every recommendation.
- ${likesLabel} are SECONDARY taste hints only — never let structural similarity override Notes.
- When Notes and Similar-to disagree, obey Notes and discard off-vibe candidates.
- Rank candidates by: (1) Notes/vibe fit, (2) Format + Genres + Era, (3) soft Similar-to taste, (4) quality. Never reverse that order.`;
	}

	if (band === 'balanced') {
		return `
PRIORITY WEIGHTING — user set Notes weight ${notesPct}/100 (Similar-to ${likesPct}/100):
- Balance Notes/Vibe and ${likesLabel} roughly evenly.
- A pick must reasonably fit the Notes vibe AND feel like a neighbor of the Similar-to references.
- If they conflict, prefer the candidate that covers both as well as possible; do not ignore Notes.`;
	}

	return `
PRIORITY WEIGHTING — user set Notes weight ${notesPct}/100 (Similar-to ${likesPct}/100):
- ${likesLabel} are the PRIMARY predictor (structure, tone, audience of those references).
- Notes / Vibe are a softer steer — use them to bias among Similar-to neighbors, not to replace them.
- Still never return the Similar-to references themselves.
- Rank candidates by: (1) Similar-to neighbor fit, (2) Format + Genres + Era, (3) Notes/vibe bias, (4) quality.`;
}
