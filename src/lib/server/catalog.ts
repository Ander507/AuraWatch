// grounded catalog — REAL tags only. UI genres never overwrite these.

export type MediaFormat = 'movie' | 'series' | 'anime' | 'songs';
export type SelectedType = 'all' | MediaFormat;
export type CatalogKind = 'anime_series' | 'anime_movie' | 'movie' | 'series';

export type CatalogTitle = {
	title: string;
	cover: string;
	/** real-world genres — never parrot user picks */
	genres: string[];
	/** vibe keywords for fuzzy prompt match */
	vibes: string[];
	seasons: number;
	episodes: number;
	rating: number;
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	format: MediaFormat;
	kind: CatalogKind;
};

export const CATALOG: CatalogTitle[] = [
	// —— anime series ——
	{
		title: 'Charlotte',
		cover: 'https://cdn.myanimelist.net/images/anime/12/73490.jpg',
		genres: ['Drama', 'School', 'Super Power', 'Romance', 'Supernatural'],
		vibes: [
			'school',
			'superpowers',
			'super power',
			'romance',
			'depressed',
			'depression',
			'sad',
			'1 season',
			'one season',
			'emotional',
			'powers'
		],
		seasons: 1,
		episodes: 13,
		rating: 7.8,
		tmdbId: 61663,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Angel Beats!',
		cover: 'https://cdn.myanimelist.net/images/anime/10/22061.jpg',
		genres: ['Action', 'Comedy', 'Drama', 'Supernatural', 'School'],
		vibes: ['school', 'afterlife', 'sad', 'depressed', '1 season', 'emotional', 'supernatural'],
		seasons: 1,
		episodes: 13,
		rating: 8.1,
		tmdbId: 34554,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Kokoro Connect',
		cover: 'https://cdn.myanimelist.net/images/anime/11/38859.jpg',
		genres: ['Drama', 'Romance', 'School', 'Supernatural', 'Psychological'],
		vibes: ['school', 'romance', 'body swap', 'supernatural', '1 season', 'emotional', 'depressed'],
		seasons: 1,
		episodes: 13,
		rating: 7.7,
		tmdbId: 45790,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Death Note',
		cover: 'https://cdn.myanimelist.net/images/anime/9/9453.jpg',
		genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'],
		vibes: ['dark', 'psychological', 'mind game', 'thriller', 'cat mouse'],
		seasons: 1,
		episodes: 37,
		rating: 8.6,
		tmdbId: 13916,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Monster',
		cover: 'https://cdn.myanimelist.net/images/anime/10/18793.jpg',
		genres: ['Drama', 'Mystery', 'Psychological', 'Thriller'],
		vibes: ['dark', 'psychological', 'long', 'crime', 'thriller'],
		seasons: 1,
		episodes: 74,
		rating: 8.9,
		tmdbId: 221309,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Steins;Gate',
		cover: 'https://cdn.myanimelist.net/images/anime/1935/127974.jpg',
		genres: ['Drama', 'Sci-Fi', 'Thriller', 'Time Travel'],
		vibes: ['time travel', 'sci-fi', 'thriller', 'emotional', 'science'],
		seasons: 1,
		episodes: 24,
		rating: 9.0,
		tmdbId: 42509,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Serial Experiments Lain',
		cover: 'https://cdn.myanimelist.net/images/anime/7/81334.jpg',
		genres: ['Psychological', 'Sci-Fi', 'Mystery'],
		vibes: ['psychological', 'cyber', 'weird', 'identity', '1 season'],
		seasons: 1,
		episodes: 13,
		rating: 8.0,
		tmdbId: 1282,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Your Lie in April',
		cover: 'https://cdn.myanimelist.net/images/anime/3/67177.jpg',
		genres: ['Drama', 'Music', 'Romance', 'School'],
		vibes: ['romance', 'sad', 'school', 'music', 'depressed', 'emotional', '1 season'],
		seasons: 1,
		episodes: 22,
		rating: 8.6,
		tmdbId: 61637,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	{
		title: 'Mob Psycho 100',
		cover: 'https://cdn.myanimelist.net/images/anime/8/80356.jpg',
		genres: ['Action', 'Comedy', 'Supernatural', 'Super Power'],
		vibes: ['superpowers', 'school', 'comedy', 'action', 'powers'],
		seasons: 3,
		episodes: 37,
		rating: 8.5,
		tmdbId: 67075,
		mediaType: 'tv',
		format: 'anime',
		kind: 'anime_series'
	},
	// —— anime movies ——
	{
		title: 'Perfect Blue',
		cover: 'https://cdn.myanimelist.net/images/anime/1637/130758.jpg',
		genres: ['Horror', 'Psychological', 'Thriller'],
		vibes: ['psychological', 'horror', 'thriller', 'movie', 'idol'],
		seasons: 0,
		episodes: 1,
		rating: 8.5,
		tmdbId: 10494,
		mediaType: 'movie',
		format: 'anime',
		kind: 'anime_movie'
	},
	{
		title: 'Your Name',
		cover: 'https://cdn.myanimelist.net/images/anime/5/87048.jpg',
		genres: ['Drama', 'Romance', 'Supernatural'],
		vibes: ['romance', 'body swap', 'movie', 'emotional', 'sad'],
		seasons: 0,
		episodes: 1,
		rating: 8.8,
		tmdbId: 372058,
		mediaType: 'movie',
		format: 'anime',
		kind: 'anime_movie'
	},
	// —— live-action movies ——
	{
		title: 'Inception',
		cover: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
		genres: ['Action', 'Sci-Fi', 'Thriller'],
		vibes: ['mind-bending', 'heist', 'dreams', 'fast-paced'],
		seasons: 0,
		episodes: 1,
		rating: 8.4,
		tmdbId: 27205,
		mediaType: 'movie',
		format: 'movie',
		kind: 'movie'
	},
	{
		title: 'The Dark Knight',
		cover: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
		genres: ['Action', 'Crime', 'Drama', 'Thriller'],
		vibes: ['dark', 'crime', 'action', 'thriller'],
		seasons: 0,
		episodes: 1,
		rating: 9.0,
		tmdbId: 155,
		mediaType: 'movie',
		format: 'movie',
		kind: 'movie'
	},
	{
		title: 'Hereditary',
		cover: 'https://image.tmdb.org/t/p/w500/p9fmuy2o3kleItLfQ6Ra1ENbYGx.jpg',
		genres: ['Horror', 'Drama', 'Mystery'],
		vibes: ['horror', 'disturbing', 'family', 'psychological'],
		seasons: 0,
		episodes: 1,
		rating: 7.3,
		tmdbId: 493922,
		mediaType: 'movie',
		format: 'movie',
		kind: 'movie'
	},
	{
		title: 'Everything Everywhere All at Once',
		cover: 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',
		genres: ['Action', 'Comedy', 'Sci-Fi'],
		vibes: ['multiverse', 'comedy', 'action', 'weird', 'family'],
		seasons: 0,
		episodes: 1,
		rating: 7.8,
		tmdbId: 545611,
		mediaType: 'movie',
		format: 'movie',
		kind: 'movie'
	},
	// —— live-action series ——
	{
		title: 'Breaking Bad',
		cover: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
		genres: ['Crime', 'Drama', 'Thriller'],
		vibes: ['crime', 'dark', 'drugs', 'antihero', 'long'],
		seasons: 5,
		episodes: 62,
		rating: 9.5,
		tmdbId: 1396,
		mediaType: 'tv',
		format: 'series',
		kind: 'series'
	},
	{
		title: 'Stranger Things',
		cover: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
		genres: ['Drama', 'Fantasy', 'Horror', 'Sci-Fi'],
		vibes: ['80s', 'supernatural', 'kids', 'horror', 'nostalgia'],
		seasons: 4,
		episodes: 34,
		rating: 8.7,
		tmdbId: 66732,
		mediaType: 'tv',
		format: 'series',
		kind: 'series'
	},
	{
		title: 'The Bear',
		cover: 'https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg',
		genres: ['Comedy', 'Drama'],
		vibes: ['kitchen', 'stress', 'slice of life', 'emotional'],
		seasons: 3,
		episodes: 28,
		rating: 8.5,
		tmdbId: 136315,
		mediaType: 'tv',
		format: 'series',
		kind: 'series'
	},
	{
		title: 'Dark',
		cover: 'https://image.tmdb.org/t/p/w500/apbrbWs8oZvjkLNWILAHctR2h4B.jpg',
		genres: ['Crime', 'Drama', 'Mystery', 'Sci-Fi'],
		vibes: ['time travel', 'dark', 'mystery', 'german', 'mind-bending'],
		seasons: 3,
		episodes: 26,
		rating: 8.7,
		tmdbId: 70523,
		mediaType: 'tv',
		format: 'series',
		kind: 'series'
	}
];

export function kindLabel(kind: CatalogKind): string {
	if (kind === 'anime_series') return 'Anime Series';
	if (kind === 'anime_movie') return 'Anime Movie';
	if (kind === 'movie') return 'Movie';
	return 'TV Series';
}

export function seasonInfo(show: CatalogTitle): string {
	if (show.kind === 'anime_movie' || show.kind === 'movie') return 'Film';
	if (show.seasons <= 1) return `1 Season (${show.episodes} Episodes)`;
	return `${show.seasons} Seasons (${show.episodes} Episodes)`;
}

export type Intent = {
	wantsSeries: boolean | null; // null = unknown
	wantsMovie: boolean | null;
	maxSeasons: number | null;
	maxEpisodes: number | null;
	titleHint: string | null;
	/** find neighbors of this title — never return the title itself */
	likeTitle?: string | null;
	likeTitles?: string[] | null;
	keywords: string[];
	matchReason: string;
};

/** score catalog row against UI filters + parsed intent — NEVER invent genres */
function scoreCatalog(opts: {
	type: SelectedType;
	userGenres: string[];
	prompt: string;
	intent?: Partial<Intent> | null;
}): { show: CatalogTitle; score: number }[] {
	const prompt = (opts.prompt || '').toLowerCase();
	const intent = opts.intent || {};
	const likeTitles = [
		...(intent.likeTitles || []),
		...(intent.likeTitle ? [intent.likeTitle] : [])
	]
		.map((t) => String(t || '').toLowerCase().trim())
		.filter(Boolean);
	const likeTitle = likeTitles[0] || '';
	const keywords = [
		...opts.userGenres.map((g) => g.toLowerCase()),
		...(intent.keywords || []).map((k) => k.toLowerCase()),
		...prompt.split(/[^a-z0-9+]+/i).filter((w) => w.length > 2)
	];

	// steal vibes from all reference titles when doing "like X"
	const likeRefs = likeTitles
		.map((lt) =>
			CATALOG.find((s) => s.title.toLowerCase().includes(lt) || lt.includes(s.title.toLowerCase()))
		)
		.filter((s): s is CatalogTitle => Boolean(s));
	for (const likeRef of likeRefs) {
		for (const v of likeRef.vibes) keywords.push(v);
		for (const g of likeRef.genres) keywords.push(g.toLowerCase());
	}

	const wantsSeries =
		intent.wantsSeries === true ||
		/\b(1\s*season|one\s*season|episodes?|series|show|tv)\b/i.test(prompt);
	const wantsMovie =
		intent.wantsMovie === true || /\b(movie|film|theatrical)\b/i.test(prompt);

	function isExcluded(title: string) {
		const t = title.toLowerCase();
		return likeTitles.some((lt) => t === lt || t.includes(lt) || lt.includes(t));
	}

	let pool = CATALOG.filter((s) => {
		if (opts.type !== 'all' && s.format !== opts.type) return false;
		if (likeTitles.length && isExcluded(s.title)) return false;
		// anime + "1 season"/episodes → reject anime movies
		if (opts.type === 'anime' && wantsSeries && !wantsMovie && s.kind === 'anime_movie') {
			return false;
		}
		if (opts.type === 'anime' && wantsMovie && !wantsSeries && s.kind === 'anime_series') {
			return false;
		}
		if (opts.type === 'series' && s.kind !== 'series') return false;
		if (opts.type === 'movie' && s.kind !== 'movie') return false;
		return true;
	});

	if (!pool.length) {
		pool = CATALOG.filter((s) => {
			if (opts.type !== 'all' && s.format !== opts.type) return false;
			if (likeTitles.length && isExcluded(s.title)) return false;
			return true;
		});
	}
	if (!pool.length) pool = [...CATALOG];

	const maxSeasons = intent.maxSeasons;
	const maxEpisodes = intent.maxEpisodes;
	const titleHint = (intent.titleHint || '').toLowerCase().trim();

	const scored = pool.map((show) => {
		let score = 0;

		for (const ug of opts.userGenres) {
			const u = ug.toLowerCase();
			if (show.genres.some((g) => g.toLowerCase().includes(u) || u.includes(g.toLowerCase()))) {
				score += 4;
			}
		}

		for (const kw of keywords) {
			if (show.vibes.some((v) => v.includes(kw) || kw.includes(v))) score += 2;
			if (show.genres.some((g) => g.toLowerCase().includes(kw))) score += 1;
			if (show.title.toLowerCase().includes(kw)) score += 3;
		}

		if (!likeTitles.length && titleHint && show.title.toLowerCase().includes(titleHint)) {
			score += 20;
		}

		for (const likeRef of likeRefs) {
			const sharedGenres = show.genres.filter((g) =>
				likeRef.genres.some((lg) => lg.toLowerCase() === g.toLowerCase())
			).length;
			score += sharedGenres * 3;
			if (show.format === likeRef.format) score += 4;
			if (show.kind === likeRef.kind) score += 3;
		}

		if (wantsSeries && (show.kind === 'anime_series' || show.kind === 'series')) score += 8;
		if (wantsMovie && (show.kind === 'anime_movie' || show.kind === 'movie')) score += 8;
		if (wantsSeries && (show.kind === 'anime_movie' || show.kind === 'movie')) score -= 25;

		if (maxSeasons != null) {
			if (show.seasons > 0 && show.seasons <= maxSeasons) score += 10;
			else if (show.seasons > maxSeasons) score -= 15;
		}
		if (maxEpisodes != null) {
			if (show.episodes <= maxEpisodes) score += 6;
			else score -= 8;
		}

		if (wantsSeries && show.seasons === 1 && show.episodes <= 16) score += 3;

		score += show.rating * 0.15;

		return { show, score };
	});

	scored.sort((a, b) => b.score - a.score);
	return scored;
}

export function pickFromCatalog(opts: {
	type: SelectedType;
	userGenres: string[];
	prompt: string;
	intent?: Partial<Intent> | null;
}): CatalogTitle {
	const scored = scoreCatalog(opts);
	return scored[0]?.show || CATALOG[0];
}

export function pickManyFromCatalog(
	opts: {
		type: SelectedType;
		userGenres: string[];
		prompt: string;
		intent?: Partial<Intent> | null;
	},
	limit = 5
): CatalogTitle[] {
	return scoreCatalog(opts)
		.slice(0, Math.min(Math.max(limit, 1), 10))
		.map((x) => x.show);
}
