/**
 * Snack / drink pairing for Full Vibe mode.
 * CocktailDB first; if that misses we just keep Gemini's fun blurb.
 */

import { cachedJsonFetch } from '$lib/server/httpCache';

export type SnackHit = {
	name: string;
	kind: 'drink' | 'snack';
	thumb: string | null;
	recipeUrl: string | null;
	instructions: string | null;
	pitch: string;
};

/** look up a drink name on the free CocktailDB */
export async function lookupCocktail(name: string): Promise<SnackHit | null> {
	const q = String(name || '').trim();
	if (!q) return null;
	const url = `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
	try {
		const res = await cachedJsonFetch(url, undefined, { ttlMs: 24 * 60 * 60 * 1000 });
		if (!res.ok || !res.data?.drinks?.length) return null;
		const d = res.data.drinks[0];
		return {
			name: String(d.strDrink || q),
			kind: 'drink',
			thumb: d.strDrinkThumb || null,
			recipeUrl: d.idDrink
				? `https://www.thecocktaildb.com/drink/${d.idDrink}`
				: null,
			instructions: d.strInstructions ? String(d.strInstructions).slice(0, 320) : null,
			pitch: d.strInstructions
				? String(d.strInstructions).slice(0, 160)
				: `A ${d.strAlcoholic || 'tasty'} pour to match the vibe.`
		};
	} catch (e) {
		console.warn('cocktaildb lookup flopped', e);
		return null;
	}
}

/** Gemini already wrote something cute — wrap it so the UI has a stable shape */
export function snackFromGemini(opts: {
	name: string;
	pitch: string;
	kind?: 'drink' | 'snack';
}): SnackHit {
	return {
		name: opts.name.trim() || 'Vibe snack',
		kind: opts.kind || 'snack',
		thumb: null,
		recipeUrl: null,
		instructions: null,
		pitch: opts.pitch.trim() || 'Something cozy that fits the night.'
	};
}

export async function resolveSnackPairing(opts: {
	name: string;
	pitch: string;
	kind?: 'drink' | 'snack' | string;
}): Promise<SnackHit> {
	const kind = String(opts.kind || 'snack').toLowerCase();
	const isDrink = kind.includes('drink') || kind.includes('cocktail') || kind.includes('beverage');
	if (isDrink) {
		const hit = await lookupCocktail(opts.name);
		if (hit) {
			// keep gemini's vibe line if cocktaildb instructions are dry
			if (opts.pitch.trim()) hit.pitch = opts.pitch.trim();
			return hit;
		}
	}
	return snackFromGemini({
		name: opts.name,
		pitch: opts.pitch,
		kind: isDrink ? 'drink' : 'snack'
	});
}