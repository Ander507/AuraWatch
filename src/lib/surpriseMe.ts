/** One-click vibe roulette — random notes (+ light filters), keeps current Format */

export type SurpriseFormat = 'movie' | 'series' | 'anime' | 'songs' | 'games';

export type SurpriseRoll = {
	types: SurpriseFormat[];
	vibe: string;
	genres?: string[];
	maturity?: string;
	priceRange?: string;
	seriesLength?: string;
	decade?: string;
};

const VIBES: Record<SurpriseFormat, string[]> = {
	movie: [
		'cozy ocean exploration with a dark secret',
		'neon cyberpunk heist that still feels human',
		'rainy-night road trip with a killer soundtrack',
		'found-family comedy with sharp banter',
		'slow-burn mystery in a small town',
		'time loop that gets weirder every reset',
		'feel-good underdog sports with real stakes',
		'stylish revenge thriller, not mindless gore'
	],
	series: [
		'workplace comedy that sneaks in real emotion',
		'tight miniseries mystery you can finish in a weekend',
		'political intrigue with personal cost',
		'sci-fi anthology vibes without being cold',
		'true-crime adjacent drama that respects the victims',
		'found family on the road',
		'prestige heist with double-crosses',
		'cozy detective show with witty dialogue'
	],
	anime: [
		'slice of life with a quiet ache underneath',
		'mecha that cares more about people than robots',
		'dark fantasy with beautiful worldbuilding',
		'sports anime that makes you want to train',
		'time travel romance that actually hurts',
		'psychological thriller with unreliable friends',
		'isekai that subverts the usual power fantasy',
		'music-centered story with real practice montage energy'
	],
	songs: [
		'late-night drive songs with heavy bass',
		'bittersweet indie that feels like summer ending',
		'high-energy workout hype without being corny',
		'rainy window melancholic R&B',
		'nostalgic 2010s alt that still hits',
		'cinematic instrumental that feels like a final boss',
		'feel-good morning playlist opener energy',
		'dark pop for walking home alone'
	],
	games: [
		'cozy ocean exploration with a dark secret',
		'competitive tactical shooter for sweaty evenings',
		'short indie narrative you can finish after work',
		'base-building with friends and betrayal',
		'roguelike that respects your time',
		'atmospheric horror, more dread than jump scares',
		'co-op crafting and exploration',
		'stylish action game with a strong soundtrack'
	]
};

const GENRE_POOLS: Record<SurpriseFormat, string[][]> = {
	movie: [
		['Thriller', 'Mystery'],
		['Comedy', 'Drama'],
		['Sci-Fi', 'Action'],
		['Horror', 'Thriller'],
		['Romance', 'Comedy'],
		['Crime', 'Drama']
	],
	series: [
		['Drama', 'Crime'],
		['Comedy', 'Romance'],
		['Sci-Fi', 'Mystery'],
		['Thriller', 'Drama'],
		['Heist', 'Crime']
	],
	anime: [
		['Action', 'Fantasy'],
		['Romance', 'Drama'],
		['Horror', 'Psychological'],
		['Comedy', 'Slice of Life'],
		['Sci-Fi', 'Action']
	],
	songs: [['Pop'], ['Indie'], ['Hip-Hop'], ['Electronic'], ['R&B'], ['Rock']],
	games: [
		['Indie', 'Adventure'],
		['Action', 'Shooter'],
		['RPG', 'Open World'],
		['Horror', 'Survival'],
		['Co-op', 'Sandbox'],
		['Roguelike', 'Action']
	]
};

const ALL_FORMATS: SurpriseFormat[] = ['movie', 'series', 'anime', 'songs', 'games'];

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function maybe<T>(arr: T[], chance = 0.45): T | undefined {
	if (Math.random() > chance) return undefined;
	return pick(arr);
}

function asSurpriseFormat(raw: string): SurpriseFormat | null {
	return ALL_FORMATS.includes(raw as SurpriseFormat) ? (raw as SurpriseFormat) : null;
}

/**
 * Roll a fresh Surprise Me combo.
 * Keeps the user's current Format selection — only randomizes vibe / light filters.
 */
export function rollSurpriseMe(currentTypes: readonly string[] = []): SurpriseRoll {
	const formats = currentTypes
		.map((t) => asSurpriseFormat(String(t || '').trim()))
		.filter((t): t is SurpriseFormat => Boolean(t));

	// Vibe/genre pools follow a selected format (or a mixed pool if none selected)
	const poolKey: SurpriseFormat | null = formats.length
		? formats.length === 1
			? formats[0]
			: pick(formats)
		: null;

	const vibe = poolKey
		? pick(VIBES[poolKey])
		: pick(ALL_FORMATS.flatMap((f) => VIBES[f]));

	const roll: SurpriseRoll = {
		types: [...formats],
		vibe
	};

	if (poolKey) {
		roll.genres = [...pick(GENRE_POOLS[poolKey])];
	}

	if (formats.includes('series')) {
		const len = maybe(['mini', 'short', 'medium', 'binge'] as const, 0.55);
		if (len) roll.seriesLength = len;
	}
	if (formats.includes('games')) {
		const price = maybe(['free', 'under20', 'mid', 'aaa'] as const, 0.5);
		if (price) roll.priceRange = price;
	}
	if (formats.length && !formats.every((f) => f === 'songs')) {
		const mat = maybe(['', 'family', 'teen', 'mature'] as const, 0.35);
		if (mat) roll.maturity = mat;
	}
	const decade = maybe(['', '1990s', '2000s', '2010s', '2020s'] as const, 0.3);
	if (decade) roll.decade = decade;

	return roll;
}
