/**
 * Encode / decode AuraWatch filter state for shareable vibe links.
 * Example: /?types=games&vibe=cozy+ocean&price=under20&region=DK
 */

export type VibeUrlState = {
	types: string[];
	genres: string[];
	vibe: string;
	antiVibe: string;
	likes: string[];
	decade: string;
	maturity: string;
	priceRange: string;
	seriesLength: string;
	platforms: string[];
	region: string;
	notesWeight: number | null;
};

const FORMAT_IDS = new Set(['movie', 'series', 'anime', 'songs', 'games']);

function splitList(raw: string | null): string[] {
	if (!raw) return [];
	return raw
		.split(/[,|]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function parseVibeSearchParams(params: URLSearchParams): Partial<VibeUrlState> | null {
	const hasAny =
		params.has('types') ||
		params.has('format') ||
		params.has('vibe') ||
		params.has('prompt') ||
		params.has('genres') ||
		params.has('likes') ||
		params.has('like') ||
		params.has('decade') ||
		params.has('maturity') ||
		params.has('price') ||
		params.has('priceRange') ||
		params.has('seasons') ||
		params.has('seriesLength') ||
		params.has('exclude') ||
		params.has('anti') ||
		params.has('platforms') ||
		params.has('platform');
	if (!hasAny) return null;

	const typesRaw = params.get('types') || params.get('format') || '';
	const types = splitList(typesRaw)
		.map((t) => t.toLowerCase())
		.map((t) => (t === 'tv' || t === 'show' || t === 'shows' ? 'series' : t))
		.map((t) => (t === 'movies' ? 'movie' : t))
		.map((t) => (t === 'game' || t === 'gaming' ? 'games' : t))
		.map((t) => (t === 'song' || t === 'music' ? 'songs' : t))
		.filter((t) => FORMAT_IDS.has(t));

	const weightRaw = params.get('weight') || params.get('notesWeight');
	let notesWeight: number | null = null;
	if (weightRaw != null && weightRaw !== '') {
		const n = Number(weightRaw);
		if (Number.isFinite(n)) notesWeight = Math.max(0, Math.min(100, Math.round(n)));
	}

	return {
		types,
		genres: splitList(params.get('genres')),
		vibe: (params.get('vibe') || params.get('prompt') || '').trim(),
		antiVibe: (params.get('exclude') || params.get('anti') || params.get('antiVibe') || '').trim(),
		likes: splitList(params.get('likes') || params.get('like')),
		decade: (params.get('decade') || params.get('era') || '').trim(),
		maturity: (params.get('maturity') || params.get('rating') || '').trim().toLowerCase(),
		priceRange: (params.get('price') || params.get('priceRange') || '').trim().toLowerCase(),
		seriesLength: (
			params.get('seasons') ||
			params.get('seriesLength') ||
			params.get('length') ||
			''
		)
			.trim()
			.toLowerCase(),
		platforms: splitList(params.get('platforms') || params.get('platform')),
		region: (params.get('region') || '').trim().toUpperCase(),
		notesWeight
	};
}

export function buildVibeSearchParams(state: VibeUrlState): URLSearchParams {
	const p = new URLSearchParams();
	if (state.types.length) p.set('types', state.types.join(','));
	if (state.genres.length) p.set('genres', state.genres.join(','));
	if (state.vibe.trim()) p.set('vibe', state.vibe.trim());
	if (state.antiVibe.trim()) p.set('exclude', state.antiVibe.trim());
	if (state.likes.length) p.set('likes', state.likes.join(','));
	if (state.decade) p.set('decade', state.decade);
	if (state.maturity) p.set('maturity', state.maturity);
	if (state.priceRange) p.set('price', state.priceRange);
	if (state.seriesLength) p.set('seasons', state.seriesLength);
	if (state.platforms.length) p.set('platforms', state.platforms.join(','));
	if (state.region) p.set('region', state.region);
	if (state.notesWeight != null && state.notesWeight !== 70) {
		p.set('weight', String(state.notesWeight));
	}
	return p;
}

export function vibeShareUrl(origin: string, pathname: string, state: VibeUrlState): string {
	const q = buildVibeSearchParams(state).toString();
	const base = `${origin.replace(/\/$/, '')}${pathname || '/'}`;
	return q ? `${base}?${q}` : base;
}
