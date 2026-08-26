<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { enhance, deserialize } from '$app/forms';
	import { signOutEverywhere } from '$lib/discordSignIn';
	import { getZflixUrl } from '$lib/watchLinks';
	import { detectRegionFromLocale, normalizeRegion } from '$lib/regions';
	import {
		CONTENT_LANGUAGES,
		DEFAULT_LANGUAGE,
		normalizeLanguage
	} from '$lib/languages';
	import { desktopCardEntrance } from '$lib/animations/desktop';
	import RegionSelect from '$lib/components/RegionSelect.svelte';
	import LikeTitleSelect from '$lib/components/LikeTitleSelect.svelte';
	import PlatformSelect from '$lib/components/PlatformSelect.svelte';
	import DesktopLoading from '$lib/components/DesktopLoading.svelte';
	import SavedListCard from '$lib/components/SavedListCard.svelte';
	import { coverFallbackStyle, mediaInitials } from '$lib/mediaInitials';
	import { buildVibeSearchParams, parseVibeSearchParams, vibeShareUrl } from '$lib/vibeUrl';
	import { rollSurpriseMe } from '$lib/surpriseMe';
	import { SITE } from '$lib/seo';
	import { BOARD_GAMES_COMING_SOON, BOARD_GAMES_SOON_COPY } from '$lib/boardGamesGate';
	import { ROBLOX_COMING_SOON, ROBLOX_SOON_COPY } from '$lib/robloxGate';
	import { signInWithDiscord } from '$lib/discordSignIn';
	import { registerWithEmail, signInWithEmail } from '$lib/emailAuth';
	import { usernameToAuthEmail } from '$lib/usernameAuth';
	import {
		loadAuraList,
		saveAuraList,
		type AuraListItem
	} from '$lib/auraList';
	import { formatLetterboxdChecklist } from '$lib/letterboxdExport';
	import { ui, setUiTheme, setDeskMode, hydrateUiTheme, applyThemeToDocument } from '$lib/uiTheme.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	const REGION_KEY = 'aurawatch_region';
	const LANG_KEY = 'aurawatch_language';
	const ZFLIX_KEY = 'aurawatch_zflix';
	const NOTES_WEIGHT_DEFAULT = 70;
	const LINK_COPIED_TOAST = '[SYSTEM]: Link copied to clipboard successfully.';

	const FORMAT_OPTIONS = [
		{ id: 'movie' as const, label: 'Movies' },
		{ id: 'series' as const, label: 'TV Series' },
		{ id: 'anime' as const, label: 'Anime' },
		{ id: 'songs' as const, label: 'Songs' },
		{ id: 'games' as const, label: 'Games' },
		{ id: 'books' as const, label: 'Books & Manga' },
		{ id: 'boardgames' as const, label: 'Board Games' },
		{ id: 'roblox' as const, label: 'Roblox' }
	];

	const DECADE_OPTIONS = [
		{ id: '' as const, label: 'Any' },
		{ id: '1980s' as const, label: '1980s' },
		{ id: '1990s' as const, label: '1990s' },
		{ id: '2000s' as const, label: '2000s' },
		{ id: '2010s' as const, label: '2010s' },
		{ id: '2020s' as const, label: '2020s' }
	];

	const MATURITY_OPTIONS = [
		{ id: '' as const, label: 'Any', mediaCerts: 'All', gameCerts: 'All', songCerts: 'All' },
		{
			id: 'family' as const,
			label: 'Family',
			mediaCerts: 'G · PG',
			gameCerts: 'E · E10+',
			songCerts: 'Clean'
		},
		{
			id: 'teen' as const,
			label: 'Teen',
			mediaCerts: '≤ PG-13',
			gameCerts: '≤ T',
			songCerts: 'Mild'
		},
		{
			id: 'mature' as const,
			label: 'Mature',
			mediaCerts: 'R · TV-MA',
			gameCerts: 'M · AO',
			songCerts: 'Explicit'
		}
	];

	const PRICE_RANGE_OPTIONS = [
		{ id: '' as const, label: 'Any', hint: 'All prices' },
		{ id: 'free' as const, label: 'Free', hint: '$0' },
		{ id: 'under20' as const, label: '<$20', hint: 'Indie / Budget' },
		{ id: 'mid' as const, label: '$20–$45', hint: 'Mid-tier' },
		{ id: 'aaa' as const, label: '$50+', hint: 'AAA' }
	];

	const PRICE_RANGE_BADGE: Record<string, string> = {
		free: 'Free to Play',
		under20: 'Under $20',
		mid: '$20–$45',
		aaa: 'AAA'
	};

	const SERIES_LENGTH_OPTIONS = [
		{ id: '' as const, label: 'Any', hint: 'Any length' },
		{ id: 'mini' as const, label: '1 Season', hint: 'Miniseries' },
		{ id: 'short' as const, label: '2–3', hint: 'Short run' },
		{ id: 'medium' as const, label: '4–7', hint: 'Solid run' },
		{ id: 'binge' as const, label: '8+', hint: 'Long binge' }
	];

	type ChipFormatId = (typeof FORMAT_OPTIONS)[number]['id'];
	type FormatId = ChipFormatId | 'fullvibe';

	const ALL_MEDIA_GENRES = [
		'Action',
		'Comedy',
		'Drama',
		'Horror',
		'Psychological',
		'Sci-Fi',
		'Thriller',
		'Romance',
		'Fantasy',
		'Mystery',
		'Crime',
		'Western',
		'Slice of Life'
	];

	const GENRES_BY_FORMAT: Record<ChipFormatId, string[]> = {
		movie: [
			'Action',
			'Comedy',
			'Drama',
			'Horror',
			'Thriller',
			'Sci-Fi',
			'Romance',
			'Crime',
			'Western',
			'Documentary',
			'Fantasy',
			'Mystery',
			'Adventure'
		],
		series: [
			'Drama',
			'Comedy',
			'Crime',
			'Thriller',
			'Sci-Fi',
			'Horror',
			'Mystery',
			'Western',
			'Documentary',
			'Heist',
			'Political',
			'Medical',
			'Romance'
		],
		anime: [
			'Action',
			'Romance',
			'Drama',
			'Comedy',
			'Horror',
			'Psychological',
			'Sci-Fi',
			'Fantasy',
			'Mystery',
			'Slice of Life',
			'Supernatural',
			'Shojo',
			'Shonen',
			'Seinen',
			'Isekai',
			'Mecha',
			'School',
			'Super Power'
		],
		songs: [
			'Pop',
			'Rock',
			'Hip-Hop',
			'R&B',
			'Indie',
			'Electronic',
			'Metal',
			'Jazz',
			'Folk',
			'Country',
			'Punk',
			'Soul',
			'Alternative',
			'K-Pop'
		],
		games: [
			'RPG',
			'FPS',
			'Sandbox',
			'Strategy',
			'Simulation',
			'Adventure',
			'Horror',
			'Platformer',
			'Puzzle',
			'Sports',
			'Racing',
			'Fighting',
			'MOBA',
			'Roguelike',
			'Survival',
			'Indie',
			'Open World',
			'Co-op',
			'Competitive'
		],
		books: [
			'Fantasy',
			'Sci-Fi',
			'Romance',
			'Mystery',
			'Thriller',
			'Horror',
			'Literary',
			'Nonfiction',
			'Memoir',
			'Manga',
			'Shonen',
			'Shojo',
			'Seinen',
			'Slice of Life',
			'Historical',
			'Graphic Novel'
		],
		boardgames: [
			'Strategy',
			'Party',
			'Co-op',
			'Legacy',
			'Deckbuilding',
			'Worker Placement',
			'Area Control',
			'Social Deduction',
			'Family',
			'Solo',
			'2-Player',
			'Euro',
			'Ameritrash',
			'Campaign',
			'Light',
			'Heavy'
		],
		roblox: [
			'Obby',
			'Parkour',
			'Roleplay',
			'Tycoon',
			'Simulator',
			'Horror',
			'Survival',
			'PvP',
			'Fighting',
			'Story',
			'Adventure',
			'Pet',
			'Racing',
			'Social',
			'Fashion',
			'Tower Defense'
		]
	};

	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
	let selectedTypes = $state<FormatId[]>([]);
	let selectedGenres = $state<string[]>([]);
	let vibePrompt = $state('');
	let antiVibe = $state('');
	let likeTitles = $state<string[]>([]);
	let notesWeight = $state(NOTES_WEIGHT_DEFAULT);
	let watchRegion = $state('US');
	let selectedLanguage = $state(DEFAULT_LANGUAGE);
	let zflixEnabled = $state(false);
	let selectedDecade = $state('');
	let selectedMaturity = $state('');
	let selectedPriceRange = $state('');
	let selectedPlatforms = $state<string[]>([]);
	let selectedSeasonCount = $state('');
	let showAdvanced = $state(false);
	let isLoading = $state(false);
	let errMsg = $state('');
	let clockLabel = $state('');
	let playingPreview = $state<string | null>(null); // unique key per card
	let loadedCovers = new SvelteSet<string>();
	let shareToast = $state('');
	let shareToastTimer: ReturnType<typeof setTimeout> | null = null;
	// adding a clean zero-result fallback state so the UI never breaks when a query comes back empty
	let vibeMissed = $state(false);
	let auraList = $state<AuraListItem[]>([]);
	let viewMode = $state<'match' | 'list'>('match');
	// moving tabs to a bottom nav bar because making users reach to the top of their phone is terrible ux
	let mobilePane = $state<'vibe' | 'match' | 'list'>('vibe');

	function setMobilePane(pane: 'vibe' | 'match' | 'list') {
		mobilePane = pane;
		if (pane === 'match') viewMode = 'match';
		if (pane === 'list') viewMode = 'list';
	}
	// which pick the sticky save fab is aimed at (defaults to first result)
	let fabSaveIndex = $state(0);
	let showLoginPrompt = $state(false);
	// toggling a local state variable so the auth modal switches between sign in and register inline without navigating away
	let isRegistering = $state(false);
	let authError = $state('');
	let authBusy = $state(false);
	let saveBusy = $state(false);
	// dropdown for picking which playlist to drop the saved item into
	let savePickerItem = $state<Rec | null>(null);
	let newPlaylistTitle = $state('');
	let playlistBusy = $state(false);
	let savingListId = $state<string | null>(null);

	function openLoginPrompt() {
		isRegistering = false;
		authError = '';
		showLoginPrompt = true;
	}

	function closeLoginPrompt() {
		showLoginPrompt = false;
		isRegistering = false;
		authError = '';
		authBusy = false;
	}

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return () => {
			node.remove();
		};
	}

	async function submitEmailAuth(e: SubmitEvent) {
		e.preventDefault();
		const formEl = e.currentTarget as HTMLFormElement;
		const fd = new FormData(formEl);
		const username = String(fd.get('username') || '');
		const email = usernameToAuthEmail(username);
		const password = String(fd.get('password') || '');
		const name = String(fd.get('name') || '');
		authBusy = true;
		authError = '';
		try {
			if (!email || !password) {
				authError = 'Username and password required';
				return;
			}
			const result = isRegistering
				? await registerWithEmail({ email, password, name })
				: await signInWithEmail(email, password);
			if (!result.ok) {
				authError = result.error;
				return;
			}
			closeLoginPrompt();
			await invalidateAll();
		} catch {
			authError = 'Couldn’t do that — try again';
		} finally {
			authBusy = false;
		}
	}

	type CloudPlaylistClient = {
		id: string;
		slug: string;
		title: string;
		items: Array<{
			id: string;
			title: string;
			coverUrl?: string | null;
			format?: string;
			description?: string | null;
			providers?: AuraListItem['providers'];
		}>;
	};

	// optimistic playlist overlay so the picker can close before turso answers
	let playlistOverride = $state<CloudPlaylistClient[] | null>(null);

	let session = $derived(page.data.session);
	let cloudPlaylists = $derived(
		(playlistOverride ?? page.data.cloudPlaylists ?? []) as CloudPlaylistClient[]
	);
	let totalSavedCount = $derived(
		cloudPlaylists.reduce((n: number, p: CloudPlaylistClient) => n + (p.items?.length || 0), 0)
	);

	type Provider = {
		name: string;
		logo: string | null;
		url?: string | null;
		type?: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
	};

	type Rec = {
		title: string;
		cover: string;
		pitch: string;
		genres?: string[];
		mediaType?: string;
		seasonInfo?: string;
		number_of_seasons?: number;
		seasons_label?: string;
		rating?: number;
		providers?: Provider[];
		region?: string;
		watchLink?: string | null;
		likeTitle?: string;
		likeTitles?: string[];
		coverFallbacks?: string[];
		coverBroken?: boolean;
		artist?: string;
		author?: string;
		creator?: string;
		kind?: 'song' | 'media' | 'game' | 'book' | 'boardgame' | 'roblox' | 'vibe' | 'snack';
		listen_url?: string;
		preview_url?: string;
		trailer_youtube_key?: string;
		content_rating?: string;
		platforms?: string[];
		price_range?: string;
		priceLabel?: string;
		store_name?: string;
		storeLinks?: Array<{ platform: string; url: string; store?: string }>;
		complexity?: string;
		playingTime?: number;
		criticScore?: number;
		vibeLabel?: string;
		watch?: Rec;
		music?: Rec;
		snack?: Rec;
	};

	// exclusive format lanes (can't mix with movie/tv multi-select)
	let isSongs = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'songs');
	let isGames = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'games');
	let isBooks = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'books');
	let isBoardGames = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'boardgames');
	// bgg api is still pending approval, parking the tabletop lane so nothing half-broken ships
	let boardGamesSoon = $derived(isBoardGames && BOARD_GAMES_COMING_SOON);
	let isRoblox = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'roblox');
	let robloxSoon = $derived(isRoblox && ROBLOX_COMING_SOON);
	let isFullVibe = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'fullvibe');
	let isExclusiveLane = $derived(
		isSongs || isGames || isBooks || isBoardGames || isRoblox || isFullVibe
	);
	// only show the tmdb language stuff if we're actually looking at movies/tv/anime
	let isMediaLane = $derived(!isExclusiveLane);
	let showSeriesLength = $derived(
		selectedTypes.includes('series') && !isExclusiveLane
	);

	let results = $state<Rec[]>([]);

	let visibleGenres = $derived.by(() => {
		if (isSongs) return GENRES_BY_FORMAT.songs;
		if (isGames) return GENRES_BY_FORMAT.games;
		if (isBooks) return GENRES_BY_FORMAT.books;
		if (isBoardGames) return GENRES_BY_FORMAT.boardgames;
		if (isRoblox) return GENRES_BY_FORMAT.roblox;
		if (isFullVibe) return ALL_MEDIA_GENRES;
		if (!selectedTypes.length) return ALL_MEDIA_GENRES;
		const set = new Set<string>();
		for (const t of selectedTypes) {
			if (t === 'fullvibe') continue;
			for (const g of GENRES_BY_FORMAT[t] || []) set.add(g);
		}
		return [...set];
	});

	let canSubmit = $derived(
		isFullVibe
			? Boolean(vibePrompt.trim()) || selectedGenres.length > 0
			: Boolean(vibePrompt.trim()) ||
					likeTitles.length > 0 ||
					selectedGenres.length > 0 ||
					selectedTypes.length > 0
	);

	let notesWeightLabel = $derived(
		notesWeight <= 35 ? 'Similar-to leads' : notesWeight <= 55 ? 'Balanced' : 'Notes lead'
	);

	/** Count of advanced-drawer filters that differ from defaults. */
	let activeAdvancedCount = $derived(
		(antiVibe.trim() ? 1 : 0) +
			(selectedDecade ? 1 : 0) +
			(notesWeight !== NOTES_WEIGHT_DEFAULT ? 1 : 0) +
			(zflixEnabled && isMediaLane ? 1 : 0) +
			(selectedMaturity && isMediaLane ? 1 : 0) +
			(selectedLanguage !== DEFAULT_LANGUAGE && isMediaLane ? 1 : 0)
	);

	/** Actual API genres only — never parrot user picks */
	function itemGenres(item: Rec): string[] {
		return item.genres?.length ? item.genres : [];
	}

	function showCoverImg(item: Rec): boolean {
		return Boolean(item.cover) && !item.coverBroken;
	}

	function itemMetaLine(item: Rec): string {
		const parts: string[] = [];
		// songs reuse seasonInfo for year-ish stuff, dont ask
		if (item.kind === 'song' || item.mediaType === 'Song') {
			if (item.artist) parts.push(item.artist);
			if (item.seasonInfo) parts.push(item.seasonInfo);
			return parts.join(' · ');
		}
		const isGame = item.kind === 'game' || item.mediaType === 'Game';
		const isBoard = item.kind === 'boardgame' || item.mediaType === 'Board Game';
		if (isGame || isBoard) {
			if (item.platforms?.length) parts.push(item.platforms.slice(0, 3).join(', '));
			else if (item.mediaType) parts.push(item.mediaType);
			if (item.seasonInfo) parts.push(item.seasonInfo);
			// scores render in the Metacritic-style breakdown row below
			return parts.join(' · ');
		}
		if (item.mediaType) parts.push(item.mediaType);
		if (item.seasonInfo) parts.push(item.seasonInfo);
		const seasonInfoHasSeasons = /season/i.test(item.seasonInfo || '');
		if (!seasonInfoHasSeasons) {
			if (item.seasons_label) parts.push(item.seasons_label);
			else if (item.number_of_seasons && item.number_of_seasons > 0) {
				parts.push(
					item.number_of_seasons === 1
						? '1 Season'
						: `${item.number_of_seasons} Seasons`
				);
			}
		}
		// age rating shown as badge — skip here
		if (item.rating != null) parts.push(`★ ${formatRating(item.rating)}`);
		// adding rotten tomatoes ratings next to the user score so users can see critic consensus at a glance
		if (
			item.criticScore != null &&
			item.kind !== 'roblox' &&
			item.kind !== 'book' &&
			item.mediaType !== 'Roblox' &&
			item.mediaType !== 'Book' &&
			item.mediaType !== 'Manga'
		) {
			parts.push(`🍅 ${Math.round(item.criticScore)}%`);
		}
		return parts.join(' · ');
	}

	function hasScoreBreakdown(item: Rec): boolean {
		const gameOrBoard =
			item.kind === 'game' ||
			item.kind === 'boardgame' ||
			item.mediaType === 'Game' ||
			item.mediaType === 'Board Game';
		return gameOrBoard && (item.rating != null || item.criticScore != null);
	}

	function criticBand(score: number): 'high' | 'mid' | 'low' {
		if (score >= 75) return 'high';
		if (score >= 50) return 'mid';
		return 'low';
	}

	function criticLabel(item: Rec): string {
		return item.kind === 'boardgame' || item.mediaType === 'Board Game' ? 'Geek' : 'Critic';
	}

	function likeLabel(item: Rec): string {
		if (item.likeTitles?.length) return `like ${item.likeTitles.join(' · ')}`;
		if (item.likeTitle) return `like ${item.likeTitle}`;
		// fallback badge text when gemini forgot the refs lol
		if (item.kind === 'song' || item.mediaType === 'Song') return 'song picks';
		if (item.kind === 'game' || item.mediaType === 'Game') return 'game picks';
		if (item.kind === 'book' || item.mediaType === 'Book' || item.mediaType === 'Manga')
			return 'book picks';
		if (item.kind === 'boardgame' || item.mediaType === 'Board Game') return 'tabletop picks';
		if (item.kind === 'roblox' || item.mediaType === 'Roblox') return 'roblox picks';
		if (item.kind === 'vibe') return item.vibeLabel || 'full vibe';
		return "tonight's pick";
	}

	function primaryListenUrl(item: Rec): string {
		if (item.listen_url) return item.listen_url;
		const first = item.providers?.find((p) => p.url);
		if (first?.url) return first.url;
		// last resort: yeet them at youtube search
		const q = encodeURIComponent(
			item.artist ? `${item.artist} ${item.title}` : item.title
		);
		return `https://www.youtube.com/results?search_query=${q}`;
	}

	function gameStoreLinks(item: Rec): Array<{ platform: string; url: string; store?: string }> {
		const raw = item.storeLinks?.length
			? item.storeLinks
			: (() => {
					const url = primaryGameUrl(item);
					const label =
						item.store_name ||
						item.providers?.find((p) => p.url)?.name ||
						'Store';
					return url ? [{ platform: label, url, store: label }] : [];
				})();
		return raw.filter((l) => !/amazon/i.test(l.platform || l.store || ''));
	}

	function storeCtaLabel(link: { platform: string; store?: string }): string {
		const name = link.platform || link.store || 'Store';
		if (/roblox/i.test(name)) return 'Play on Roblox';
		return `View on ${name}`;
	}

	// grouping ireland with the uk and funneling all of mainland europe into the german store
	function getAmazonAffiliateLink(item: Rec, regionCode: string): string {
		const title = String(item.title || '').trim();
		const author = String(item.author || item.creator || item.artist || '').trim();
		const manga = /manga/i.test(item.mediaType || '');
		let searchText = title;
		let extra = '';

		if (isBookRec(item)) {
			// appending the author and locking the search to the stripbooks index so users get the actual book instead of a movie rental
			searchText = author ? `${title} ${author}` : `${title} ${manga ? 'manga' : 'book'}`;
			extra = '&i=stripbooks';
		} else if (isBoardRec(item)) {
			// adding category keywords to keep amazon search results precise
			if (!/board\s*game/i.test(title)) searchText = `${title} board game`;
		}

		const query = encodeURIComponent(searchText);
		const region = String(regionCode || '').trim().toUpperCase();

		if (region === 'GB' || region === 'IE') {
			return `https://www.amazon.co.uk/s?k=${query}${extra}&tag=chloechecksit-20`;
		}
		if (region === 'IT') {
			return `https://www.amazon.it/s?k=${query}${extra}&tag=chloechecksit-20`;
		}
		if (region === 'US') {
			return `https://www.amazon.com/s?k=${query}${extra}&tag=chloechecksit-20`;
		}

		const mainlandEurope = [
			'DE',
			'DK',
			'FR',
			'ES',
			'NL',
			'SE',
			'NO',
			'FI',
			'PL',
			'BE',
			'AT',
			'CH',
			'PT'
		];
		if (mainlandEurope.includes(region)) {
			return `https://www.amazon.de/s?k=${query}${extra}&tag=chloechecksit-21`;
		}

		return `https://www.amazon.com/s?k=${query}${extra}&tag=chloechecksit-20`;
	}

	function primaryGameUrl(item: Rec): string {
		if (item.storeLinks?.[0]?.url) return item.storeLinks[0].url;
		if (item.listen_url) return item.listen_url;
		const withUrl = item.providers?.find((p) => p.url);
		if (withUrl?.url) return withUrl.url;
		return `https://www.igdb.com/search?type=1&q=${encodeURIComponent(item.title)}`;
	}

	// api sometimes sends kind, sometimes mediaType="Song" — either works
	function isSongRec(item: Rec): boolean {
		return item.kind === 'song' || item.mediaType === 'Song';
	}

	function isGameRec(item: Rec): boolean {
		return item.kind === 'game' || item.mediaType === 'Game';
	}

	function isBookRec(item: Rec): boolean {
		return (
			item.kind === 'book' || item.mediaType === 'Book' || item.mediaType === 'Manga'
		);
	}

	function isBoardRec(item: Rec): boolean {
		return item.kind === 'boardgame' || item.mediaType === 'Board Game';
	}

	function isRobloxRec(item: Rec): boolean {
		return item.kind === 'roblox' || item.mediaType === 'Roblox';
	}

	function isVibeRec(item: Rec): boolean {
		return item.kind === 'vibe' || item.mediaType === 'Vibe Package';
	}

	function previewKey(item: Rec, i: number) {
		return `${item.title}::${i}`;
	}

	function toggleTrailer(item: Rec, i: number) {
		const key = previewKey(item, i);
		playingPreview = playingPreview === key ? null : key;
	}

	function onCoverError(index: number) {
		results = results.map((r, j) => {
			if (j !== index) return r;
			if (r.cover) loadedCovers.delete(r.cover);
			const fallbacks = r.coverFallbacks?.length ? [...r.coverFallbacks] : [];
			if (fallbacks.length > 0) {
				const next = fallbacks.shift()!;
				return { ...r, cover: next, coverFallbacks: fallbacks, coverBroken: false };
			}
			return { ...r, coverBroken: true };
		});
	}

	function markCoverLoaded(url: string) {
		if (url) loadedCovers.add(url);
	}

	function normalizeRec(raw: Record<string, any> | null | undefined): Rec {
		// song vs game vs book vs board vs vibe package — backend field names wander a bit
		const kind: Rec['kind'] =
			raw?.kind === 'song' || raw?.mediaType === 'Song'
				? 'song'
				: raw?.kind === 'game' || raw?.mediaType === 'Game'
					? 'game'
					: raw?.kind === 'book' ||
						  raw?.mediaType === 'Book' ||
						  raw?.mediaType === 'Manga'
						? 'book'
						: raw?.kind === 'boardgame' || raw?.mediaType === 'Board Game'
							? 'boardgame'
							: raw?.kind === 'roblox' || raw?.mediaType === 'Roblox'
								? 'roblox'
								: raw?.kind === 'vibe' || raw?.mediaType === 'Vibe Package'
									? 'vibe'
									: raw?.kind === 'snack'
										? 'snack'
										: 'media';
		return {
			title: raw?.title || '???',
			cover: raw?.cover || raw?.poster_path || raw?.image || '',
			pitch: raw?.pitch || raw?.matchReason || raw?.overview || raw?.description || '',
			genres: raw?.genres || raw?.actualGenres || [],
			mediaType: raw?.mediaType,
			seasonInfo:
				raw?.seasonInfo ||
				(raw?.releaseYear
					? String(raw.releaseYear)
					: raw?.year
						? String(raw.year)
						: raw?.release_date
							? String(raw.release_date)
							: undefined),
			rating: raw?.rating ?? raw?.vote_average,
			criticScore:
				typeof raw?.criticScore === 'number'
					? raw.criticScore
					: typeof raw?.rtScore === 'number'
						? raw.rtScore
						: typeof raw?.tomatoMeter === 'number'
							? raw.tomatoMeter
							: undefined,
			providers: raw?.providers || [],
			region: raw?.region,
			watchLink: raw?.watch_link || raw?.watchLink || raw?.recipeUrl || null,
			likeTitle: raw?.likeTitle || (likeTitles.length ? likeTitles.join(', ') : undefined),
			likeTitles: raw?.likeTitles || (likeTitles.length ? likeTitles : undefined),
			coverFallbacks: Array.isArray(raw?.coverFallbacks)
				? raw.coverFallbacks.filter(Boolean)
				: [],
			coverBroken: false,
			artist: raw?.artist,
			author: raw?.author || raw?.creator || raw?.artist,
			creator: raw?.creator,
			kind,
			listen_url: raw?.listen_url || raw?.zflix_url,
			preview_url: raw?.preview_url || raw?.previewUrl || undefined,
			trailer_youtube_key: raw?.trailer_youtube_key || raw?.trailerYoutubeKey || undefined,
			content_rating: raw?.content_rating || raw?.contentRating || undefined,
			platforms: Array.isArray(raw?.platforms)
				? raw.platforms.map((p: any) => String(p)).filter(Boolean)
				: undefined,
			price_range: raw?.price_range || raw?.priceRange || undefined,
			priceLabel:
				typeof raw?.priceLabel === 'string' && raw.priceLabel.trim()
					? raw.priceLabel.trim()
					: undefined,
			store_name:
				typeof raw?.store_name === 'string' && raw.store_name.trim()
					? raw.store_name.trim()
					: typeof raw?.storeName === 'string' && raw.storeName.trim()
						? raw.storeName.trim()
						: undefined,
			storeLinks: Array.isArray(raw?.storeLinks)
				? raw.storeLinks
						.map((l: any) => ({
							platform: String(l?.platform || l?.store || '').trim(),
							url: String(l?.url || '').trim(),
							store: l?.store ? String(l.store).trim() : undefined
						}))
						.filter((l: { platform: string; url: string }) => l.platform && l.url)
				: undefined,
			number_of_seasons:
				typeof raw?.number_of_seasons === 'number'
					? raw.number_of_seasons
					: typeof raw?.numberOfSeasons === 'number'
						? raw.numberOfSeasons
						: undefined,
			seasons_label:
				typeof raw?.seasons_label === 'string' && raw.seasons_label.trim()
					? raw.seasons_label.trim()
					: typeof raw?.seasonsLabel === 'string' && raw.seasonsLabel.trim()
						? raw.seasonsLabel.trim()
						: undefined,
			complexity: raw?.complexity ? String(raw.complexity) : undefined,
			playingTime:
				typeof raw?.playingTime === 'number'
					? raw.playingTime
					: typeof raw?.playing_time === 'number'
						? raw.playing_time
						: undefined,
			vibeLabel: raw?.vibeLabel ? String(raw.vibeLabel) : undefined,
			watch: raw?.watch ? normalizeRec(raw.watch) : undefined,
			music: raw?.music ? normalizeRec(raw.music) : undefined,
			snack: raw?.snack ? normalizeRec(raw.snack) : undefined
		};
	}

	function currentVibeState() {
		return {
			types: selectedTypes,
			genres: selectedGenres,
			vibe: vibePrompt,
			antiVibe,
			likes: likeTitles,
			decade: selectedDecade,
			maturity: selectedMaturity,
			priceRange: selectedPriceRange,
			platforms: selectedPlatforms,
			seriesLength: selectedSeasonCount,
			region: watchRegion,
			language: selectedLanguage,
			notesWeight
		};
	}

	function syncVibeUrl() {
		if (typeof window === 'undefined') return;
		const params = buildVibeSearchParams(currentVibeState());
		const qs = params.toString();
		const next = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
		const cur = `${page.url.pathname}${page.url.search}`;
		if (next === cur) return;
		// Query-only sync — avoid goto/replaceState resolve lint; keep scroll/focus
		history.replaceState(history.state, '', next);
	}

	// dropping a retro terminal toast notification so users actually know when their link was copied
	function showShareToast(msg: string) {
		shareToast = msg;
		if (shareToastTimer) clearTimeout(shareToastTimer);
		shareToastTimer = setTimeout(() => {
			shareToast = '';
			shareToastTimer = null;
		}, 3000);
	}

	async function copyVibeLink() {
		const url = vibeShareUrl(
			typeof window !== 'undefined' ? window.location.origin : page.url.origin,
			page.url.pathname,
			currentVibeState()
		);
		try {
			await navigator.clipboard.writeText(url);
			showShareToast(LINK_COPIED_TOAST);
			syncVibeUrl();
		} catch {
			try {
				const ta = document.createElement('textarea');
				ta.value = url;
				ta.setAttribute('readonly', '');
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
				showShareToast(LINK_COPIED_TOAST);
				syncVibeUrl();
			} catch {
				showShareToast('Could not copy link');
			}
		}
	}

	function letterboxdYearFrom(title: string, seasonInfo?: string | null, yearHint?: string | null): string | undefined {
		const hint = (yearHint || '').trim();
		if (/^\d{4}$/.test(hint)) return hint;
		const si = (seasonInfo || '').trim();
		if (/^\d{4}$/.test(si)) return si;
		const m = title.match(/\((\d{4})\)\s*$/);
		return m ? m[1] : undefined;
	}

	function isLetterboxdMediaKind(kind?: string, mediaType?: string): boolean {
		if (
			kind === 'song' ||
			kind === 'game' ||
			kind === 'book' ||
			kind === 'boardgame' ||
			kind === 'roblox' ||
			kind === 'snack' ||
			kind === 'vibe'
		)
			return false;
		const mt = (mediaType || '').toLowerCase();
		if (
			mt === 'song' ||
			mt === 'game' ||
			mt === 'book' ||
			mt === 'manga' ||
			mt === 'board game' ||
			mt === 'roblox' ||
			mt === 'vibe package'
		)
			return false;
		// media / movie / tv / anime — anything watchable enough for letterboxd
		return true;
	}

	function letterboxdPicksFromResults() {
		const picks: { title: string; year?: string }[] = [];
		for (const item of results) {
			if (item.kind === 'vibe' || item.mediaType === 'Vibe Package') {
				const w = item.watch;
				if (!w?.title?.trim()) continue;
				picks.push({
					title: w.title.trim(),
					year: letterboxdYearFrom(w.title, w.seasonInfo)
				});
				continue;
			}
			if (item.kind !== 'media') continue;
			if (!item.title?.trim()) continue;
			picks.push({
				title: item.title.trim(),
				year: letterboxdYearFrom(item.title, item.seasonInfo)
			});
		}
		return picks;
	}

	function letterboxdPicksFromAuraList() {
		return auraList
			.filter((x) => isLetterboxdMediaKind(x.kind, x.mediaType))
			.map((x) => ({
				title: x.title.trim(),
				year: letterboxdYearFrom(x.title, undefined, x.year)
			}))
			.filter((x) => x.title);
	}

	let letterboxdExportable = $derived(
		viewMode === 'list' ? letterboxdPicksFromAuraList().length > 0 : letterboxdPicksFromResults().length > 0
	);

	async function copyLetterboxdList() {
		if (!session?.user) {
			openLoginPrompt();
			return;
		}
		const picks = viewMode === 'list' ? letterboxdPicksFromAuraList() : letterboxdPicksFromResults();
		if (!picks.length) {
			showShareToast('Nothing to export');
			return;
		}
		const md = formatLetterboxdChecklist(picks);
		try {
			await navigator.clipboard.writeText(md);
			showShareToast('Copied for Letterboxd');
		} catch {
			try {
				const ta = document.createElement('textarea');
				ta.value = md;
				ta.setAttribute('readonly', '');
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
				showShareToast('Copied for Letterboxd');
			} catch {
				showShareToast('Could not copy');
			}
		}
	}

	function applyVibeFromUrl(params: URLSearchParams): boolean {
		const parsed = parseVibeSearchParams(params);
		if (!parsed) return false;

		if (parsed.types?.length) {
			selectedTypes = parsed.types.filter(
				(t): t is FormatId =>
					t === 'fullvibe' || FORMAT_OPTIONS.some((f) => f.id === t)
			) as FormatId[];
		}
		if (parsed.genres?.length) selectedGenres = parsed.genres;
		if (parsed.vibe != null) vibePrompt = parsed.vibe;
		if (parsed.antiVibe != null) antiVibe = parsed.antiVibe;
		if (parsed.likes?.length) likeTitles = parsed.likes;
		if (parsed.decade != null) {
			selectedDecade = DECADE_OPTIONS.some((d) => d.id === parsed.decade)
				? parsed.decade
				: '';
		}
		if (parsed.maturity != null) {
			const m = parsed.maturity;
			selectedMaturity = MATURITY_OPTIONS.some((o) => o.id === m) ? m : '';
		}
		if (parsed.priceRange != null) {
			const p = parsed.priceRange;
			selectedPriceRange = PRICE_RANGE_OPTIONS.some((o) => o.id === p) ? p : '';
		}
		if (parsed.platforms?.length) selectedPlatforms = [...parsed.platforms];
		if (parsed.seriesLength != null) {
			const s = parsed.seriesLength;
			selectedSeasonCount = SERIES_LENGTH_OPTIONS.some((o) => o.id === s) ? s : '';
		}
		if (parsed.region) watchRegion = normalizeRegion(parsed.region);
		if (parsed.language) selectedLanguage = normalizeLanguage(parsed.language);
		if (parsed.notesWeight != null) notesWeight = parsed.notesWeight;
		return true;
	}

	function priceBadgeLabel(item: Rec): string | undefined {
		if (item.priceLabel) return item.priceLabel;
		const id = item.price_range;
		if (!id) return undefined;
		return PRICE_RANGE_BADGE[id] || id;
	}

	type ProviderGroup = { label: string; items: Provider[] };

	/** Group TMDB providers into Stream / Rent / Buy like the TMDB watch page. */
	function providerGroups(providers: Provider[] | undefined): ProviderGroup[] {
		if (!providers?.length) return [];
		const hasTypes = providers.some((p) => p.type);
		if (!hasTypes) {
			return [{ label: '', items: providers }];
		}

		const buckets: Array<{ label: string; types: NonNullable<Provider['type']>[] }> = [
			{ label: 'Stream', types: ['flatrate', 'ads', 'free'] },
			{ label: 'Rent', types: ['rent'] },
			{ label: 'Buy', types: ['buy'] }
		];

		return buckets
			.map((b) => ({
				label: b.label,
				items: providers.filter((p) => p.type && b.types.includes(p.type))
			}))
			.filter((g) => g.items.length > 0);
	}

	function formatClock(d = new Date()) {
		const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${weekday}, ${hh}:${mm}`;
	}


	function cloudPlaylistsToAura(
		playlists: Array<{
			id: string;
			slug: string;
			title: string;
			items: Array<{
				id: string;
				title: string;
				coverUrl?: string | null;
				format?: string;
				description?: string | null;
				providers?: AuraListItem['providers'];
			}>;
		}>
	): AuraListItem[] {
		const out: AuraListItem[] = [];
		for (const pl of playlists) {
			for (const i of pl.items || []) {
				out.push({
					id: i.id,
					title: i.title,
					cover: i.coverUrl || '',
					mediaType: i.format || undefined,
					kind: 'media',
					pitch: i.description || undefined,
					providers: i.providers,
					listId: pl.id,
					listSlug: pl.slug,
					listTitle: pl.title,
					savedAt: Date.now()
				});
			}
		}
		return out;
	}

	// when turso playlists land (or we optimistic-save), mirror them into the local vibe list ui
	$effect(() => {
		if (!page.data.session?.user) return;
		auraList = cloudPlaylistsToAura(cloudPlaylists);
	});

	function recSaveFormat(item: Rec): string {
		return item.kind === 'snack'
			? 'media'
			: String(item.kind || item.mediaType || 'media');
	}

	function clonePlaylists(list: CloudPlaylistClient[]): CloudPlaylistClient[] {
		return list.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) }));
	}

	function optimisticAddToPlaylist(listId: string, item: Rec): CloudPlaylistClient[] {
		const format = recSaveFormat(item);
		const titleKey = item.title.toLowerCase();
		return clonePlaylists(cloudPlaylists).map((pl) => {
			if (pl.id !== listId) return pl;
			if (pl.items.some((i) => i.title.toLowerCase() === titleKey)) return pl;
			return {
				...pl,
				items: [
					...pl.items,
					{
						id: `opt_${Date.now()}`,
						title: item.title,
						coverUrl: item.cover || '',
						format,
						description: item.pitch || null,
						providers: item.providers
					}
				]
			};
		});
	}

	function itemIsSaved(item: Rec): boolean {
		const title = item.title.toLowerCase();
		return auraList.some((x) => x.title.toLowerCase() === title);
	}

	function playlistShareUrl(slug: string) {
		return `${page.url.origin}/list/${slug}`;
	}

	async function copyPlaylistShare(slug: string) {
		const url = playlistShareUrl(slug);
		try {
			await navigator.clipboard.writeText(url);
			showShareToast(LINK_COPIED_TOAST);
		} catch {
			showShareToast(url);
		}
	}

	onMount(() => {
		if (!page.data.session?.user) {
			auraList = loadAuraList();
		}

		try {
			const saved = localStorage.getItem(REGION_KEY);
			if (saved) {
				watchRegion = normalizeRegion(saved);
			} else {
				watchRegion = normalizeRegion(detectRegionFromLocale() || 'US');
			}
		} catch {
			watchRegion = normalizeRegion(detectRegionFromLocale() || 'US');
		}

		try {
			const savedLang = localStorage.getItem(LANG_KEY);
			if (savedLang) selectedLanguage = normalizeLanguage(savedLang);
		} catch {
			/* shrug */
		}

		hydrateUiTheme();

		try {
			const savedZflix = localStorage.getItem(ZFLIX_KEY);
			if (savedZflix === '1' || savedZflix === 'true') {
				zflixEnabled = true;
			} else if (savedZflix === '0' || savedZflix === 'false') {
				zflixEnabled = false;
			}
		} catch {
			/* shrug */
		}

		try {
			document.getElementById('aw-boot')?.setAttribute('hidden', '');
		} catch {
			/* shrug */
		}

		// warm cold-start serverless / match engine — fire and forget
		void fetch('/api/health').catch(() => {});

		const hadVibeParams = applyVibeFromUrl(new URLSearchParams(window.location.search));
		if (hadVibeParams && activeAdvancedCount > 0) {
			showAdvanced = true;
		}

		clockLabel = formatClock();
		const id = setInterval(() => {
			clockLabel = formatClock();
		}, 60_000);

		if (hadVibeParams) {
			// Shared vibe link — restore filters then auto-run
			queueMicrotask(() => {
				if (canSubmit) void findMyVibe();
			});
		}

		return () => {
			clearInterval(id);
			if (shareToastTimer) clearTimeout(shareToastTimer);
		};
	});

	$effect(() => {
		applyThemeToDocument(uiTheme, deskMode);
	});

	function persistRegion() {
		try {
			localStorage.setItem(REGION_KEY, normalizeRegion(watchRegion));
		} catch {
			/* shrug */
		}
	}

	function persistLanguage() {
		try {
			localStorage.setItem(LANG_KEY, normalizeLanguage(selectedLanguage));
		} catch {
			/* shrug */
		}
	}

	function setZflixEnabled(next: boolean) {
		zflixEnabled = next;
		try {
			localStorage.setItem(ZFLIX_KEY, next ? '1' : '0');
		} catch {
			/* shrug */
		}
	}

	function toggleFormat(id: FormatId) {
		const exclusiveIds: FormatId[] = ['songs', 'games', 'books', 'boardgames', 'roblox'];
		const wasExclusive = exclusiveIds.includes(selectedTypes[0] as FormatId) && selectedTypes.length === 1;
		let next: FormatId[];
		if (exclusiveIds.includes(id)) next = [id];
		else if (wasExclusive) next = [id];
		else if (selectedTypes.includes(id)) next = selectedTypes.filter((t) => t !== id);
		else next = [...selectedTypes.filter((t) => t !== 'fullvibe'), id];

		selectedTypes = next;
		const nowExclusive = exclusiveIds.includes(next[0] as FormatId) && next.length === 1;
		const allowed = nowExclusive && next[0] !== 'fullvibe'
			? GENRES_BY_FORMAT[next[0] as ChipFormatId] || ALL_MEDIA_GENRES
			: next.length
				? [
						...new Set(
							next.flatMap((t) =>
								t === 'fullvibe' ? ALL_MEDIA_GENRES : GENRES_BY_FORMAT[t] || []
							)
						)
					]
				: ALL_MEDIA_GENRES;
		selectedGenres = selectedGenres.filter((g) => allowed.includes(g));
		if (wasExclusive !== nowExclusive || (wasExclusive && selectedTypes[0] !== next[0])) {
			likeTitles = [];
		}
		if (selectedTypes[0] !== 'games') {
			selectedPriceRange = '';
			selectedPlatforms = [];
		}
		if (!next.includes('series')) selectedSeasonCount = '';
	}

	function runFullVibe() {
		// glowing pill toggle — don't auto-fire, just flip into wildcard mode
		if (isFullVibe) {
			selectedTypes = [];
			return;
		}
		selectedTypes = ['fullvibe'];
		likeTitles = [];
		selectedPriceRange = '';
		selectedPlatforms = [];
		selectedSeasonCount = '';
		selectedMaturity = '';
	}

	function toggleGenre(g: string) {
		if (selectedGenres.includes(g)) {
			selectedGenres = selectedGenres.filter((x) => x !== g);
		} else {
			selectedGenres = [...selectedGenres, g];
		}
	}

	async function findMyVibe(e?: Event) {
		e?.preventDefault?.();
		errMsg = '';

		if (!canSubmit) {
			errMsg = 'pick a format, genres, a like-title, or add a note…';
			return;
		}

		// don't hit the api while tabletop/roblox is parked behind the gate
		if (boardGamesSoon) {
			errMsg = BOARD_GAMES_SOON_COPY.body;
			showShareToast(BOARD_GAMES_SOON_COPY.title);
			return;
		}
		if (robloxSoon) {
			errMsg = ROBLOX_SOON_COPY.body;
			showShareToast(ROBLOX_SOON_COPY.title);
			return;
		}

		isLoading = true;
		playingPreview = null;
		vibeMissed = false;
		// forcefully flipping the tab back to 'match' when they hit get picks so they aren't staring at their old lists wondering where the new stuff went
		viewMode = 'match';
		mobilePane = 'match';

		try {
			const res = await fetch('/api/recommend', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					types: selectedTypes,
					genres: selectedGenres,
					prompt: vibePrompt,
					antiVibe: antiVibe || undefined,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					notesWeight,
					region: watchRegion,
					language: selectedLanguage,
					decade: selectedDecade || undefined,
					maturity: selectedMaturity || undefined,
					priceRange: selectedPriceRange || undefined,
					platforms: selectedPlatforms.length ? selectedPlatforms : undefined,
					seriesLength: selectedSeasonCount || undefined
				})
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				results = [];
				vibeMissed = true;
				errMsg = data?.message || data?.error || `request failed (${res.status})`;
				isLoading = false;
				return;
			}

			const list =
				Array.isArray(data.recommendations) && data.recommendations.length
					? data.recommendations
					: data.recommendation
						? [data.recommendation]
						: [];
			results = list.map((raw: Record<string, any>) => normalizeRec(raw));
			vibeMissed = results.length === 0;
			fabSaveIndex = 0;
			syncVibeUrl();
		} catch (err: any) {
			console.log('oops', err);
			results = [];
			vibeMissed = true;
			errMsg = err?.message || 'something went sideways';
		} finally {
			isLoading = false;
		}
	}

	function resetVibeFilters() {
		selectedGenres = [];
		vibePrompt = '';
		antiVibe = '';
		likeTitles = [];
		selectedDecade = '';
		selectedMaturity = '';
		selectedPriceRange = '';
		selectedPlatforms = [];
		selectedSeasonCount = '';
		notesWeight = NOTES_WEIGHT_DEFAULT;
		vibeMissed = false;
		results = [];
		errMsg = '';
		mobilePane = 'vibe';
		syncVibeUrl();
	}

	function onKeyDown(ev: KeyboardEvent) {
		// ctrl/cmd+enter — muscle memory from chat apps
		if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
			findMyVibe();
		}
	}

	async function surpriseMe() {
		// surprise me still shouldn't fire gated rolls until the token lands
		if (boardGamesSoon) {
			errMsg = BOARD_GAMES_SOON_COPY.body;
			showShareToast(BOARD_GAMES_SOON_COPY.title);
			return;
		}
		if (robloxSoon) {
			errMsg = ROBLOX_SOON_COPY.body;
			showShareToast(ROBLOX_SOON_COPY.title);
			return;
		}
		const roll = rollSurpriseMe(selectedTypes);
		viewMode = 'match';
		mobilePane = 'match';
		// Keep Format as-is — Surprise Me only randomizes vibe / light filters
		vibePrompt = roll.vibe;
		selectedGenres = roll.genres ? [...roll.genres] : [];
		likeTitles = [];
		selectedMaturity = roll.maturity || '';
		selectedPriceRange = roll.priceRange || '';
		selectedPlatforms = [];
		selectedSeasonCount = roll.seriesLength || '';
		selectedDecade = roll.decade || '';
		await findMyVibe();
	}

	async function toggleSave(item: Rec) {
		// guest? bounce them to login instead of stuffing localStorage forever
		if (!session?.user) {
			openLoginPrompt();
			return;
		}
		if (saveBusy) return;

		const wasOn = itemIsSaved(item);
		if (wasOn) {
			// already saved somewhere — yank matching titles across playlists
			saveBusy = true;
			const matches = auraList.filter((x) => x.title.toLowerCase() === item.title.toLowerCase());
			try {
				for (const m of matches) {
					const fd = new FormData();
					fd.set('itemId', m.id);
					await fetch('?/removeItem', { method: 'POST', body: fd });
				}
				showShareToast('Removed from playlists');
				await invalidateAll();
			} catch (e) {
				console.warn('cloud remove flopped', e);
				showShareToast('Couldn’t sync — try again');
			} finally {
				saveBusy = false;
			}
			return;
		}

		// open playlist picker instead of dumping into one big pile
		savePickerItem = item;
		newPlaylistTitle = '';
	}

	async function saveToPlaylist(listId: string) {
		const item = savePickerItem;
		if (!item || !session?.user || saveBusy) return;
		saveBusy = true;
		savingListId = listId;

		const format = recSaveFormat(item);
		const payload = {
			title: item.title,
			format: String(format),
			coverUrl: item.cover || '',
			description: item.pitch || '',
			listId,
			providers: item.providers?.length ? item.providers : undefined,
			metadata: {
				pitch: item.pitch || '',
				rating: item.rating ?? undefined,
				mediaType: item.mediaType || undefined,
				year: item.seasonInfo || undefined
			}
		};

		// slam the modal shut before turso roundtrips so save doesn't feel like dial-up
		const prevOverride = playlistOverride;
		playlistOverride = optimisticAddToPlaylist(listId, item);
		savePickerItem = null;
		showShareToast('Saved to playlist');

		try {
			const res = await fetch('/api/lists/save', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.message || 'save failed');
			await invalidateAll();
			playlistOverride = null;
		} catch (e) {
			console.warn('cloud save flopped', e);
			playlistOverride = prevOverride;
			showShareToast('Couldn’t sync — try again');
			savePickerItem = item;
		} finally {
			saveBusy = false;
			savingListId = null;
		}
	}

	async function createPlaylistAndMaybeSave() {
		if (!session?.user || playlistBusy) return;
		const title = newPlaylistTitle.trim();
		if (!title) {
			showShareToast('Name your playlist first');
			return;
		}
		playlistBusy = true;
		try {
			const pending = savePickerItem;
			if (pending) {
				const format = recSaveFormat(pending);
				const res = await fetch('/api/lists/save', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						title: pending.title,
						format: String(format),
						coverUrl: pending.cover || '',
						description: pending.pitch || '',
						listName: title,
						providers: pending.providers?.length ? pending.providers : undefined,
						metadata: {
							pitch: pending.pitch || '',
							rating: pending.rating ?? undefined,
							mediaType: pending.mediaType || undefined
						}
					})
				});
				const body = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(body?.message || 'save failed');
				newPlaylistTitle = '';
				savePickerItem = null;
				showShareToast('Saved to playlist');
				await invalidateAll();
				return;
			}

			const fd = new FormData();
			fd.set('title', title);
			const res = await fetch('?/createPlaylist', { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			if (result.type !== 'success') throw new Error('create failed');
			newPlaylistTitle = '';
			showShareToast('Playlist created');
			await invalidateAll();
		} catch (e) {
			console.warn('create playlist flopped', e);
			showShareToast('Couldn’t create playlist');
		} finally {
			playlistBusy = false;
		}
	}

	async function createPlaylistOnly() {
		if (!session?.user || playlistBusy) return;
		const title = newPlaylistTitle.trim();
		if (!title) {
			showShareToast('Name your playlist first');
			return;
		}
		playlistBusy = true;
		const fd = new FormData();
		fd.set('title', title);
		try {
			const res = await fetch('?/createPlaylist', { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			if (result.type !== 'success') throw new Error('create failed');
			newPlaylistTitle = '';
			showShareToast('Playlist created');
			await invalidateAll();
		} catch (e) {
			console.warn('create playlist flopped', e);
			showShareToast('Couldn’t create playlist');
		} finally {
			playlistBusy = false;
		}
	}

	let fabItem = $derived.by(() => {
		if (!results.length) return null;
		const i = Math.min(Math.max(fabSaveIndex, 0), results.length - 1);
		return results[i] || results[0] || null;
	});

	let fabIsSaved = $derived.by(() => {
		const item = fabItem;
		if (!item) return false;
		return itemIsSaved(item);
	});

	function toggleFabSave() {
		if (!fabItem) return;
		void toggleSave(fabItem);
	}

	async function removeAuraItem(id: string) {
		if (!session?.user) {
			auraList = auraList.filter((x) => x.id !== id);
			saveAuraList(auraList);
			showShareToast('Removed from My List');
			return;
		}
		const fd = new FormData();
		fd.set('itemId', id);
		try {
			await fetch('?/removeItem', { method: 'POST', body: fd });
			await invalidateAll();
			showShareToast('Removed from playlist');
		} catch {
			showShareToast('Couldn’t remove — try again');
		}
	}

	function formatRating(n: number) {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#snippet formFields()}
	<form class="vibe-form" onsubmit={findMyVibe}>
		<!-- adding bottom padding to the form so users can actually scroll down to the bottom inputs -->
		<div class="form-stack max-lg:pb-32">
		<div class="field">
			<span class="field-label" id="format-label">Format</span>
			<!-- nuking the grid layout for flex pills because that empty square was driving me crazy -->
			<!-- ripping off the coming soon badge because board games are officially live -->
			<div class="format-pills" role="group" aria-labelledby="format-label">
				{#each FORMAT_OPTIONS as opt (opt.id)}
					<button
						type="button"
						class="format-pill"
						class:active={selectedTypes.includes(opt.id)}
						aria-pressed={selectedTypes.includes(opt.id)}
						onclick={() => toggleFormat(opt.id)}
						disabled={isLoading}
					>
						{opt.label}
					</button>
				{/each}
				<button
					type="button"
					class="format-pill full-vibe-pill"
					class:active={isFullVibe}
					aria-pressed={isFullVibe}
					disabled={isLoading}
					onclick={() => runFullVibe()}
					title="Movie/show + music + snack for one vibe"
				>
					Full Vibe
				</button>
			</div>
			{#if isFullVibe}
				<p class="field-hint">Wildcard mode — movie/show + music + snack for one vibe</p>
			{:else if boardGamesSoon}
				<p class="field-hint">{BOARD_GAMES_SOON_COPY.eyebrow} — picks stay parked until review clears</p>
			{:else if robloxSoon}
				<p class="field-hint">{ROBLOX_SOON_COPY.eyebrow} — picks stay parked until catalog is stable</p>
			{/if}
		</div>

		<!-- tucking the massive genre list into an accordion so it doesn't eat the whole screen -->
		<div class="field">
			<details class="genre-acc">
				<summary class="genre-acc-summary">
					Show Genres
					{#if selectedGenres.length}
						<span class="genre-acc-count">{selectedGenres.length}</span>
					{/if}
				</summary>
				<span class="field-label genre-acc-desk-label" id="genre-label">Genres</span>
				<div class="genre-grid" role="group" aria-labelledby="genre-label">
					{#each visibleGenres as g (g)}
						<button
							type="button"
							class="genre-toggle"
							class:active={selectedGenres.includes(g)}
							aria-pressed={selectedGenres.includes(g)}
							onclick={() => toggleGenre(g)}
							disabled={isLoading}
						>
							<span class="genre-mark" aria-hidden="true"></span>
							{g}
						</button>
					{/each}
				</div>
			</details>
		</div>

		{#if !isFullVibe}
			<div class="field">
				<label class="field-label" for="like-title">
					{isGames
						? 'Like these games'
						: isRoblox
							? 'Like these Roblox experiences'
							: isBoardGames
								? 'Like these board games'
								: isBooks
									? 'Like these books'
									: isSongs
										? 'Like these'
										: 'Like these titles'}
					<span class="optional">(optional)</span>
				</label>
				<LikeTitleSelect
					id="like-title"
					bind:values={likeTitles}
					disabled={isLoading}
					variant={uiTheme === 'desktop' ? 'desktop' : 'dark'}
					kind={isGames
						? 'games'
						: isRoblox
							? 'roblox'
							: isBoardGames
								? 'boardgames'
								: isBooks
									? 'books'
									: isSongs
										? 'music'
										: 'media'}
					language={selectedLanguage}
				/>
				<p class="field-hint">
					{isGames
						? 'Add games — find titles in the same vibe'
						: isRoblox
							? 'Add Roblox experiences — find neighbors in the same vibe'
							: isBoardGames
								? 'Add tabletop titles — find games in the same vibe'
								: isBooks
									? 'Add books or manga — find neighbors in tone'
									: isSongs
										? 'Add songs or artists — find tracks in the same vibe'
										: 'Add one or more — find something in the same vein'}
				</p>
			</div>
		{/if}

		{#if isGames}
			<div class="field">
				<label class="field-label" for="platforms"
					>Platforms <span class="optional">(optional)</span></label
				>
				<PlatformSelect
					id="platforms"
					bind:values={selectedPlatforms}
					disabled={isLoading}
					variant={uiTheme === 'desktop' ? 'desktop' : 'dark'}
				/>
				<p class="field-hint">Only suggest games natively on these platforms.</p>
			</div>
			<div class="field">
				<span class="field-label" id="price-range-label">Price range</span>
				<div
					class="segment price-segment"
					role="group"
					aria-labelledby="price-range-label"
				>
					{#each PRICE_RANGE_OPTIONS as opt (opt.id || 'any')}
						<button
							type="button"
							class="segment-btn maturity-btn"
							class:active={selectedPriceRange === opt.id}
							aria-pressed={selectedPriceRange === opt.id}
							aria-label="{opt.label}, {opt.hint}"
							onclick={() => (selectedPriceRange = opt.id)}
							disabled={isLoading}
						>
							<span class="maturity-label">{opt.label}</span>
							<span class="maturity-certs">{opt.hint}</span>
						</button>
					{/each}
				</div>
				<p class="field-hint">Steers game picks by typical store price tier.</p>
			</div>
		{/if}

		{#if showSeriesLength}
			<div class="field">
				<span class="field-label" id="series-length-label">Series length</span>
				<div
					class="segment price-segment series-length-segment"
					role="group"
					aria-labelledby="series-length-label"
				>
					{#each SERIES_LENGTH_OPTIONS as opt (opt.id || 'any')}
						<button
							type="button"
							class="segment-btn maturity-btn"
							class:active={selectedSeasonCount === opt.id}
							aria-pressed={selectedSeasonCount === opt.id}
							aria-label="{opt.label}, {opt.hint}"
							onclick={() => (selectedSeasonCount = opt.id)}
							disabled={isLoading}
						>
							<span class="maturity-label">{opt.label}</span>
							<span class="maturity-certs">{opt.hint}</span>
						</button>
					{/each}
				</div>
				<p class="field-hint">How many seasons — miniseries through long binge.</p>
			</div>
		{/if}

		{#if isMediaLane}
			<div class="field region-field">
				<label class="field-label" for="region">Streaming region</label>
				<RegionSelect
					id="region"
					bind:value={watchRegion}
					onchange={persistRegion}
					disabled={isLoading}
					variant={uiTheme === 'minimal' ? 'minimal' : 'desktop'}
				/>
				<p class="field-hint">Used for Where to Watch providers</p>
			</div>
		{/if}

		<div class="field">
			<label class="field-label" for="vibe"
				>Notes <span class="optional">(optional)</span></label
			>
			<textarea
				id="vibe"
				class="vibe-input"
				bind:value={vibePrompt}
				onkeydown={onKeyDown}
				placeholder={isFullVibe
					? 'rainy sunday cozy, neon date night, slow morning…'
					: isRoblox
						? 'obby with friends, tycoon grind, horror roleplay…'
						: isBoardGames
							? 'cozy 2-player engine builder, loud party game…'
							: isBooks
								? 'quiet fantasy, bingeable manga, literary thriller…'
								: isGames
									? 'competitive tactical shooter, cozy farming, deep crafting…'
									: isSongs
										? 'late night drive, soft vocals, no pop…'
										: 'cyberpunk vibe, cozy ending, or movies with Nightcall / Radiohead…'}
				rows="3"
				disabled={isLoading}
			></textarea>
		</div>

		<button
			type="button"
			class="advanced-toggle"
			aria-expanded={showAdvanced}
			onclick={() => (showAdvanced = !showAdvanced)}
		>
			<span class="advanced-toggle-label">
				{showAdvanced ? 'Hide advanced' : 'Advanced Filters'}
			</span>
			{#if activeAdvancedCount > 0}
				<span class="advanced-toggle-badge" title="{activeAdvancedCount} active"
					>{activeAdvancedCount}</span
				>
			{/if}
			<span class="advanced-toggle-chevron" aria-hidden="true"
				>{showAdvanced ? '▲' : '▼'}</span
			>
		</button>

		{#if showAdvanced}
			<div class="advanced-fields" transition:slide={{ duration: 200 }}>
				<div class="field">
					<label class="field-label" for="anti-vibe"
						>Exclude / Anti-vibe <span class="optional">(optional)</span></label
					>
					<textarea
						id="anti-vibe"
						class="vibe-input anti-vibe-input"
						bind:value={antiVibe}
						placeholder="horror, romance, jump scares…"
						rows="2"
						disabled={isLoading}
					></textarea>
				</div>

				<div class="field">
					<span class="field-label" id="decade-label">Decade / Era</span>
					<div class="segment decade-segment" role="group" aria-labelledby="decade-label">
						{#each DECADE_OPTIONS as opt (opt.id || 'any')}
							<button
								type="button"
								class="segment-btn"
								class:active={selectedDecade === opt.id}
								aria-pressed={selectedDecade === opt.id}
								onclick={() => (selectedDecade = opt.id)}
								disabled={isLoading}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="field weight-field">
					<div class="weight-label-row">
						<label class="field-label" for="notes-weight">Match priority</label>
						<span class="weight-value">{notesWeightLabel} · {notesWeight}</span>
					</div>
					<div class="weight-slider-row">
						<span class="weight-end" aria-hidden="true">Similar-to</span>
						<input
							id="notes-weight"
							class="weight-slider"
							type="range"
							min="0"
							max="100"
							step="5"
							value={notesWeight}
							oninput={(e) => {
								notesWeight = Number(e.currentTarget.value);
							}}
							disabled={isLoading}
						/>
						<span class="weight-end" aria-hidden="true">Notes</span>
					</div>
					<p class="field-hint">
						{likeTitles.length
							? 'Default favors Notes when both are set. Drag left to lean on liked titles.'
							: 'Add like-titles to use Similar-to. Default (70) favors Notes.'}
					</p>
				</div>

				{#if isMediaLane}
					<div class="field">
						<span class="field-label" id="maturity-label">Content rating</span>
						<div
							class="segment maturity-segment"
							role="group"
							aria-labelledby="maturity-label"
						>
							{#each MATURITY_OPTIONS as opt (opt.id || 'any')}
								{@const certs = opt.mediaCerts}
								<button
									type="button"
									class="segment-btn maturity-btn"
									class:active={selectedMaturity === opt.id}
									aria-pressed={selectedMaturity === opt.id}
									aria-label="{opt.label}, {certs}"
									onclick={() => (selectedMaturity = opt.id)}
									disabled={isLoading}
								>
									<span class="maturity-label">{opt.label}</span>
									<span class="maturity-certs">{certs}</span>
								</button>
							{/each}
						</div>
						<p class="field-hint">Shown on picks as TMDB age badges (G, PG-13, R…).</p>
					</div>

					<div class="field language-field">
						<label class="field-label" for="language">Language</label>
						<select
							id="language"
							class="lang-select"
							bind:value={selectedLanguage}
							onchange={persistLanguage}
							disabled={isLoading}
						>
							{#each CONTENT_LANGUAGES as lang (lang.code)}
								<option value={lang.code}>{lang.label}</option>
							{/each}
						</select>
						<p class="field-hint">Titles & descriptions from TMDB in this language</p>
					</div>

					<!-- stashed under advanced so the main form stays cleaner -->
					<label class="field zflix-switch-row">
						<span class="zflix-switch-copy">
							<span class="field-label">ZFlix links</span>
							<span class="field-hint"
								>Show Watch on Zflix buttons on results. Warning: ZFlix may show weird ads.</span
							>
						</span>
						<button
							type="button"
							class="zflix-switch"
							class:on={zflixEnabled}
							role="switch"
							aria-checked={zflixEnabled}
							aria-label={zflixEnabled ? 'Disable ZFlix links' : 'Enable ZFlix links'}
							disabled={isLoading}
							onclick={() => setZflixEnabled(!zflixEnabled)}
						>
							<span class="zflix-switch-thumb" aria-hidden="true"></span>
						</button>
					</label>
				{/if}
			</div>
		{/if}

		</div>

		<!-- swapping the glitchy gradient for a solid background so the buttons don't bleed into the text -->
		<div
			class="cta-row max-lg:sticky max-lg:bottom-[80px] max-lg:z-20 max-lg:border-t max-lg:border-black/10 max-lg:bg-[var(--window,var(--bg,#ffffff))] max-lg:pt-4 max-lg:pb-4"
		>
			<button class="cta" type="submit" disabled={isLoading || !canSubmit || boardGamesSoon || robloxSoon}>
				{#if isLoading}
					<span class="spinner" aria-hidden="true"></span>
					{uiTheme === 'minimal' ? 'Searching…' : 'searching…'}
				{:else if boardGamesSoon || robloxSoon}
					{uiTheme === 'minimal' ? 'Coming soon' : 'coming soon'}
				{:else if isSongs}
					{uiTheme === 'minimal' ? 'Get song picks' : 'get song picks'}
				{:else if isGames}
					{uiTheme === 'minimal' ? 'Get game picks' : 'get game picks'}
				{:else if isRoblox}
					{uiTheme === 'minimal' ? 'Get Roblox picks' : 'get roblox picks'}
				{:else if isBoardGames}
					{uiTheme === 'minimal' ? 'Get board game picks' : 'get board game picks'}
				{:else}
					{uiTheme === 'minimal' ? 'Get picks' : 'get picks'}
				{/if}
			</button>
			<button
				type="button"
				class="cta cta-surprise"
				disabled={isLoading || boardGamesSoon || robloxSoon}
				onclick={() => void surpriseMe()}
			>
				{uiTheme === 'minimal' ? 'Surprise me' : 'surprise me'}
			</button>
		</div>
	</form>

	{#if errMsg}
		<p class="err" transition:fade={{ duration: 200 }}>{errMsg}</p>
	{/if}
{/snippet}

{#snippet resultContent()}
	{#if viewMode === 'list'}
		<div class="aura-list" in:fly={{ y: 8, duration: 280, easing: quintOut }} out:fade={{ duration: 140 }}>
			<div class="rec-list-toolbar">
				<p class="rec-list-header">
					{totalSavedCount || auraList.length} saved · {cloudPlaylists.length || 1} playlist{(cloudPlaylists.length || 1) === 1
						? ''
						: 's'}
				</p>
				{#if session?.user && letterboxdExportable}
					<button type="button" class="share-vibe-btn" onclick={() => void copyLetterboxdList()}>
						Letterboxd
					</button>
				{/if}
			</div>

			{#if session?.user}
				<div class="playlist-create">
					<input
						class="playlist-input"
						type="text"
						placeholder="New playlist name…"
						bind:value={newPlaylistTitle}
						disabled={playlistBusy}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								void createPlaylistOnly();
							}
						}}
					/>
					<button
						type="button"
						class="share-vibe-btn"
						disabled={playlistBusy || !newPlaylistTitle.trim()}
						onclick={() => void createPlaylistOnly()}
					>
						Create
					</button>
				</div>
			{/if}

			{#if cloudPlaylists.length}
				{#each cloudPlaylists as pl (pl.id)}
					<section class="playlist-group">
						<div class="playlist-head">
							<h3 class="playlist-title">{pl.title}</h3>
							<div class="rec-list-actions">
								<span class="playlist-count">{pl.items.length}</span>
								<button
									type="button"
									class="share-vibe-btn"
									onclick={() => void copyPlaylistShare(pl.slug)}
								>
									Share
								</button>
							</div>
						</div>
						{#if pl.items.length}
							{#each pl.items as saved (saved.id)}
								<SavedListCard
									variant={uiTheme}
									showRemove
									item={{
										id: saved.id,
										title: saved.title,
										cover: saved.coverUrl || '',
										format: saved.format,
										description: saved.description || undefined,
										providers: saved.providers
									}}
									onRemove={() => removeAuraItem(saved.id)}
								/>
							{/each}
						{:else}
							<p class="empty-state playlist-empty">Nothing in this playlist yet.</p>
						{/if}
					</section>
				{/each}
			{:else if auraList.length}
				{#each auraList as saved (saved.id)}
					<SavedListCard
						variant={uiTheme}
						showRemove
						item={{
							id: saved.id,
							title: saved.title,
							cover: saved.cover,
							format: saved.mediaType,
							year: saved.year,
							description: saved.pitch,
							providers: saved.providers
						}}
						onRemove={() => removeAuraItem(saved.id)}
					/>
				{/each}
			{:else}
				<p class="empty-state">
					Nothing saved yet — hit Save on a pick and choose a playlist.
				</p>
			{/if}
		</div>
	{:else if isLoading && !results.length}
		<div class="loading-block" transition:fade={{ duration: 250 }}>
			<DesktopLoading
				hint={uiTheme === 'minimal' ? 'Waking match engine…' : 'waking match engine…'}
				variant={uiTheme}
			/>
		</div>
		<div class="rec-list" aria-hidden="true">
			{#each [0, 1, 2] as i (i)}
				<div class="rec-card rec-skeleton">
					<div class="rec-grid">
						<div class="skel-cover"></div>
						<div class="skel-copy">
							<div class="skel-line skel-line-sm"></div>
							<div class="skel-line skel-line-lg"></div>
							<div class="skel-line skel-line-md"></div>
							<div class="skel-line"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if results.length}
		{#if isLoading}
			<div class="loading-block loading-refresh" transition:fade={{ duration: 200 }}>
				<DesktopLoading
					hint={uiTheme === 'minimal' ? 'Refreshing picks…' : 'refreshing picks…'}
					variant={uiTheme}
				/>
			</div>
		{/if}
		<div
			class="rec-list"
			class:rec-list-dimmed={isLoading}
			in:fly={{ y: uiTheme === 'desktop' ? 0 : 10, duration: uiTheme === 'desktop' ? 0 : 320, easing: quintOut }}
			out:fade={{ duration: 140 }}
		>
			<div class="rec-list-toolbar">
				<p class="rec-list-header">{results.length} picks</p>
				<div class="rec-list-actions">
					{#if session?.user && letterboxdExportable}
						<button
							type="button"
							class="share-vibe-btn"
							onclick={() => void copyLetterboxdList()}
							disabled={isLoading}
						>
							Letterboxd
						</button>
					{/if}
					<button
						type="button"
						class="share-vibe-btn"
						onclick={() => void copyVibeLink()}
						disabled={isLoading}
					>
						Copy link
					</button>
				</div>
			</div>
			{#each results as item, i (item.title + String(i))}
				{@const genres = itemGenres(item)}
				{@const meta = itemMetaLine(item)}
				{@const song = isSongRec(item)}
				{@const game = isGameRec(item)}
				{@const book = isBookRec(item)}
				{@const board = isBoardRec(item)}
				{@const roblox = isRobloxRec(item)}
				{@const vibe = isVibeRec(item)}
				{@const priceBadge = game ? priceBadgeLabel(item) : undefined}
				{@const saved = itemIsSaved(item)}
				<article
					class="rec-card"
					class:vibe-package={vibe}
					{@attach uiTheme === 'desktop' && desktopCardEntrance(i)}
					onpointerenter={() => (fabSaveIndex = i)}
					onfocusin={() => (fabSaveIndex = i)}
				>
					{#if vibe && item.watch && item.music && item.snack}
						<!-- cohesive night-in package card -->
						<div class="vibe-pack">
							<div class="vibe-pack-head">
								<p class="rec-label">{likeLabel(item)}</p>
								<div class="rec-title-row">
									<h2 class="rec-title">{item.vibeLabel || item.title}</h2>
									<button
										type="button"
										class="save-btn max-lg:min-h-11 max-lg:px-4 max-lg:py-2.5"
										class:saved
										aria-label={saved ? 'Remove from My List' : 'Save to My List'}
										aria-pressed={saved}
										onclick={() => {
											fabSaveIndex = i;
											toggleSave(item);
										}}
									>
										<span class="save-btn-icon" aria-hidden="true">{saved ? '★' : '☆'}</span>
										<span class="save-btn-label">{saved ? 'Saved' : 'Save'}</span>
									</button>
								</div>
								<p class="rec-pitch">{item.pitch}</p>
							</div>
							<div class="vibe-pack-grid">
								<section class="vibe-slot">
									<p class="vibe-slot-label">Watch</p>
									{#if showCoverImg(item.watch)}
										<img class="vibe-slot-cover" src={item.watch.cover} alt="" loading="lazy" />
									{/if}
									<h3 class="vibe-slot-title">{item.watch.title}</h3>
									<p class="vibe-slot-pitch">{item.watch.pitch}</p>
									{#if item.watch.watchLink || item.watch.providers?.length}
										<a
											class="watch-cta"
											href={item.watch.watchLink || item.watch.providers?.find((p) => p.url)?.url || '#'}
											target="_blank"
											rel="noopener noreferrer">Where to watch</a
										>
									{/if}
								</section>
								<section class="vibe-slot">
									<p class="vibe-slot-label">Listen</p>
									{#if showCoverImg(item.music)}
										<img
											class="vibe-slot-cover vibe-slot-cover-sq"
											src={item.music.cover}
											alt=""
											loading="lazy"
										/>
									{/if}
									<h3 class="vibe-slot-title">{item.music.title}</h3>
									{#if item.music.artist}
										<p class="rec-artist">{item.music.artist}</p>
									{/if}
									<p class="vibe-slot-pitch">{item.music.pitch}</p>
									{#if item.music.preview_url}
										<audio class="media-preview audio-preview" controls preload="none" src={item.music.preview_url}
										></audio>
									{/if}
									<a
										class="watch-cta"
										href={primaryListenUrl(item.music)}
										target="_blank"
										rel="noopener noreferrer">Open listen link</a
									>
								</section>
								<section class="vibe-slot">
									<p class="vibe-slot-label">{item.snack.mediaType || 'Snack'}</p>
									{#if showCoverImg(item.snack)}
										<img class="vibe-slot-cover vibe-slot-cover-sq" src={item.snack.cover} alt="" loading="lazy" />
									{/if}
									<h3 class="vibe-slot-title">{item.snack.title}</h3>
									<p class="vibe-slot-pitch">{item.snack.pitch}</p>
									{#if item.snack.watchLink}
										<a
											class="watch-cta"
											href={item.snack.watchLink}
											target="_blank"
											rel="noopener noreferrer">Recipe</a
										>
									{/if}
								</section>
							</div>
						</div>
					{:else}
					<div class="rec-grid">
						<div class="cover-wrap aspect-[2/3]" class:cover-square={song}>
							{#if showCoverImg(item)}
								<!-- swapping ugly alt-text boxes with clean skeleton loaders while posters load in -->
								{#if !loadedCovers.has(item.cover)}
									<div
										class="cover-skel animate-pulse bg-zinc-200 dark:bg-zinc-800 border-2 border-black aspect-[2/3]"
										class:cover-square={song}
										aria-hidden="true"
									></div>
								{/if}
								<img
									src={item.cover}
									alt=""
									class="cover"
									class:cover-in={loadedCovers.has(item.cover)}
									class:cover-square={song}
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
									onload={() => markCoverLoaded(item.cover)}
									onerror={() => onCoverError(i)}
									{@attach (node) => {
										const img = node as HTMLImageElement;
										if (img.complete && img.naturalWidth > 0) markCoverLoaded(item.cover);
									}}
								/>
							{:else}
								<div
									class="cover-fallback"
									class:cover-square={song}
									style={coverFallbackStyle(item.artist ? `${item.artist} ${item.title}` : item.title)}
									aria-hidden="true"
									title={item.title}
								>
									<span class="cover-fallback-initials">
										{mediaInitials(item.title, item.artist)}
									</span>
								</div>
							{/if}
						</div>

						<div class="rec-copy">
							<p class="rec-label">{likeLabel(item)}</p>
							<div class="rec-title-row">
								<h2 class="rec-title">{item.title}</h2>
								{#if item.content_rating && !song}
									<span class="age-badge" title="Content rating">{item.content_rating}</span>
								{/if}
								{#if priceBadge}
									<span class="age-badge price-badge" title="Price range">{priceBadge}</span>
								{/if}
								{#if item.complexity && board}
									<span class="age-badge" title="Complexity">{item.complexity}</span>
								{/if}
								<button
									type="button"
									class="save-btn max-lg:min-h-11 max-lg:px-4 max-lg:py-2.5"
									class:saved
									aria-label={saved ? 'Remove from My List' : 'Save to My List'}
									aria-pressed={saved}
									onclick={() => {
										fabSaveIndex = i;
										toggleSave(item);
									}}
								>
									<span class="save-btn-icon" aria-hidden="true">{saved ? '★' : '☆'}</span>
									<span class="save-btn-label">{saved ? 'Saved' : 'Save'}</span>
								</button>
							</div>
							{#if (song || book) && item.artist}
								<p class="rec-artist">{item.artist}</p>
							{/if}

							{#if meta && !song}
								<p class="meta-line">{meta}</p>
							{:else if song && item.seasonInfo}
								<p class="meta-line">{item.seasonInfo}</p>
							{/if}

							{#if hasScoreBreakdown(item)}
								<div
									class="score-breakdown"
									aria-label="Ratings"
								>
									{#if item.criticScore != null}
										<span
											class="metascore metascore-{criticBand(item.criticScore)}"
											title="{criticLabel(item)} score"
										>
											<span class="metascore-num">{Math.round(item.criticScore)}</span>
											<span class="metascore-label">{criticLabel(item)}</span>
										</span>
									{/if}
									{#if item.rating != null}
										<span class="userscore" title="Community / user score">
											<span class="userscore-num">★ {formatRating(item.rating)}</span>
											<span class="userscore-label">User</span>
										</span>
									{/if}
								</div>
							{/if}

							{#if genres.length}
								<p class="genre-line">{genres.join(' · ')}</p>
							{/if}

							<p class="rec-pitch">{item.pitch}</p>

							{#if song && item.preview_url}
								<audio
									class="media-preview audio-preview"
									controls
									preload="none"
									src={item.preview_url}
								></audio>
							{:else if !song && !game && !book && !board && !roblox && item.trailer_youtube_key}
								{#if playingPreview === previewKey(item, i)}
									<div class="trailer-wrap">
										<iframe
											class="media-preview trailer-frame"
											src={`https://www.youtube-nocookie.com/embed/${item.trailer_youtube_key}?autoplay=1&rel=0`}
											title="Trailer"
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
											allowfullscreen
										></iframe>
										<button
											type="button"
											class="preview-btn preview-close max-lg:min-h-11 max-lg:px-4 max-lg:py-2.5"
											onclick={() => toggleTrailer(item, i)}
										>
											Close video
										</button>
									</div>
								{:else}
									<button
										type="button"
										class="preview-btn max-lg:min-h-11 max-lg:px-4 max-lg:py-2.5"
										onclick={() => toggleTrailer(item, i)}
									>
										{item.mediaType === 'YouTube' ? 'Play video' : 'Play trailer'}
									</button>
								{/if}
							{/if}

							{#if game || board || roblox}
								{@const platforms = item.platforms?.filter(Boolean) ?? []}
								{@const links = gameStoreLinks(item)}
								<div class="where-watch">
									<div class="watch-heading">
										<span class="watch-label"
											>{roblox ? 'On Roblox' : board ? 'Tabletop' : 'Playable on'}</span
										>
									</div>
									{#if platforms.length}
										<p class="game-platform-line">{platforms.join(', ')}</p>
										<div class="game-store-sep" aria-hidden="true"></div>
									{/if}
									<div class="game-cta-row flex flex-wrap gap-2">
										{#each links as link (link.url + link.platform)}
											<a
												class="zflix-cta"
												href={link.url}
												target="_blank"
												rel="noopener noreferrer"
											>
												{storeCtaLabel(link)}
											</a>
										{/each}
										{#if !roblox}
											<!-- enforcing 'buy on amazon' everywhere so we don't catch a TOS violation from vague button text -->
											{@render amazonCta(item)}
										{/if}
									</div>
								</div>
							{:else}
								<div class="where-watch">
									<div class="watch-heading">
										{#if item.watchLink && !song && !book}
											<a
												class="watch-label watch-label-link"
												href={item.watchLink}
												target="_blank"
												rel="external noopener noreferrer"
											>
												Where to Watch
											</a>
										{:else}
											<span class="watch-label"
												>{song ? 'Listen' : book ? 'Read' : 'Where to Watch'}</span
											>
										{/if}
										{#if item.region && !song && !book}
											<span class="watch-region">{item.region}</span>
										{/if}
									</div>
									{#if song || book}
										<div class="provider-row provider-row-text">
											{#each item.providers || [] as p, pi (p.name + String(pi))}
												{#if p.url}
													<a
														class="provider-btn provider-text"
														href={p.url}
														target="_blank"
														rel="external noopener noreferrer"
														title={p.name}
														aria-label={p.name}
													>
														<span class="provider-fallback">{p.name}</span>
													</a>
												{:else}
													<span
														class="provider-btn provider-text"
														title={p.name}
														aria-label={p.name}
													>
														<span class="provider-fallback">{p.name}</span>
													</span>
												{/if}
											{/each}
										</div>
									{:else if item.providers?.length}
										<div class="provider-groups">
											{#each providerGroups(item.providers) as group (group.label)}
												<div class="provider-group">
													{#if group.label}
														<span class="provider-category">{group.label}</span>
													{/if}
													<div class="provider-row">
														{#each group.items as p, pi (p.name + (p.type || '') + String(pi))}
															{#if p.url}
																<a
																	class="provider-btn max-lg:h-11 max-lg:w-11 max-lg:rounded-lg"
																	href={p.url}
																	target="_blank"
																	rel="external noopener noreferrer"
																	title={p.name}
																	aria-label="{group.label ? `${group.label}: ` : ''}{p.name}"
																>
																	{#if p.logo}
																		<img src={p.logo} alt="" class="provider-logo" />
																	{:else}
																		<span class="provider-fallback">{p.name.slice(0, 2)}</span>
																	{/if}
																</a>
															{:else}
																<span
																	class="provider-btn max-lg:h-11 max-lg:w-11 max-lg:rounded-lg"
																	title={p.name}
																	aria-label="{group.label ? `${group.label}: ` : ''}{p.name}"
																>
																	{#if p.logo}
																		<img src={p.logo} alt="" class="provider-logo" />
																	{:else}
																		<span class="provider-fallback">{p.name.slice(0, 2)}</span>
																	{/if}
																</span>
															{/if}
														{/each}
													</div>
												</div>
											{/each}
										</div>
									{/if}
									{#if book}
										{@render amazonCta(item)}
									{:else if song}
										<a
											class="zflix-cta"
											href={primaryListenUrl(item)}
											target="_blank"
											rel="external noopener noreferrer"
										>
											Open listen link
										</a>
									{:else if zflixEnabled && item.mediaType !== 'YouTube'}
										<a
											class="zflix-cta"
											href={getZflixUrl(item.title)}
											target="_blank"
											rel="external noopener noreferrer"
										>
											Watch on Zflix
										</a>
									{/if}
								</div>
							{/if}
						</div>
					</div>
					{/if}
				</article>
			{/each}
		</div>
	{:else if boardGamesSoon}
		<!-- placeholder state for board games until the token goes live -->
		<article class="board-soon-card" transition:fade={{ duration: 220 }}>
			<p class="board-soon-eyebrow">{BOARD_GAMES_SOON_COPY.eyebrow}</p>
			<h2 class="board-soon-title">{BOARD_GAMES_SOON_COPY.title}</h2>
			<p class="board-soon-body">{BOARD_GAMES_SOON_COPY.body}</p>
		</article>
	{:else if robloxSoon}
		<article class="board-soon-card" transition:fade={{ duration: 220 }}>
			<p class="board-soon-eyebrow">{ROBLOX_SOON_COPY.eyebrow}</p>
			<h2 class="board-soon-title">{ROBLOX_SOON_COPY.title}</h2>
			<p class="board-soon-body">{ROBLOX_SOON_COPY.body}</p>
		</article>
	{:else if vibeMissed}
		<!-- adding a clean zero-result fallback state so the UI never breaks when a query comes back empty -->
		<article class="vibe-miss-card" transition:fade={{ duration: 220 }}>
			<p class="vibe-miss-code">[ERROR]: No vibes match this exact query.</p>
			<div class="vibe-miss-actions">
				<button type="button" class="vibe-miss-btn primary" onclick={() => void surpriseMe()}>
					[SURPRISE ME]
				</button>
				<button type="button" class="vibe-miss-btn" onclick={resetVibeFilters}>
					[RESET FILTERS]
				</button>
			</div>
		</article>
	{:else}
		<p class="empty-state" transition:fade={{ duration: 220 }}>
			{uiTheme === 'minimal' ? 'Nothing queued yet' : 'Your match appears here'}
		</p>
	{/if}
{/snippet}

{#snippet amazonCta(item: Rec)}
	<!-- enabling amazon affiliate button for books and manga -->
	<a
		class="zflix-cta amazon-cta"
		href={getAmazonAffiliateLink(item, watchRegion)}
		target="_blank"
		rel="noopener noreferrer"
	>
		<svg
			viewBox="0 0 24 24"
			width="14"
			height="14"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="9" cy="21" r="1" />
			<circle cx="20" cy="21" r="1" />
			<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
		</svg>
		Buy on Amazon
	</a>
{/snippet}

{#snippet authControls()}
	<div class="auth-controls">
		{#if session?.user}
			{#if session.user.image}
				<img class="auth-avatar" src={session.user.image} alt="" width="28" height="28" />
			{/if}
			<span class="auth-name">{session.user.name || 'You'}</span>
			<button type="button" class="auth-btn" onclick={() => signOutEverywhere()}>Sign out</button>
		{:else}
			<button type="button" class="auth-btn" onclick={() => openLoginPrompt()}>Sign in</button>
		{/if}
	</div>
{/snippet}

{#snippet viewTabs()}
	<div class="view-tabs hidden lg:inline-flex" role="group" aria-label="App views">
		<a class="view-tab-btn room-nav-link" href={resolve('/room')}>Group Room</a>
		<button
			type="button"
			class="view-tab-btn"
			class:active={viewMode === 'match'}
			aria-pressed={viewMode === 'match'}
			onclick={() => {
				viewMode = 'match';
				mobilePane = 'match';
			}}
		>
			Match
		</button>
		<a
			class="view-tab-btn"
			class:active={viewMode === 'list'}
			href={resolve('/lists')}
			data-sveltekit-preload-data="hover"
		>
			<!-- renaming this to plural since users can sort things into multiple playlists now -->
			My lists ({totalSavedCount || auraList.length})
		</a>
	</div>
{/snippet}

{#snippet mobileBottomNav()}
	<!-- moving tabs to a bottom nav bar because making users reach to the top of their phone is terrible ux -->
	<nav
		class="app-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-gray-800 bg-black/90 backdrop-blur-md lg:hidden"
		aria-label="App"
	>
		<button
			type="button"
			class="app-nav-btn"
			class:active={mobilePane === 'vibe'}
			aria-current={mobilePane === 'vibe' ? 'page' : undefined}
			onclick={() => setMobilePane('vibe')}
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M4 7h16M7 12h10M9 17h6"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
			Vibe
		</button>
		<button
			type="button"
			class="app-nav-btn"
			class:active={mobilePane === 'match'}
			aria-current={mobilePane === 'match' ? 'page' : undefined}
			onclick={() => setMobilePane('match')}
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
				<path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
			</svg>
			Match
		</button>
		<button
			type="button"
			class="app-nav-btn"
			class:active={mobilePane === 'list'}
			aria-current={mobilePane === 'list' ? 'page' : undefined}
			onclick={() => goto(resolve('/lists'))}
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
			My Lists
		</button>
	</nav>
{/snippet}

{#snippet themeSwitcher()}
	<div class="theme-switcher-stack">
		<div class="theme-segment" role="group" aria-label="Interface theme">
			<button
				type="button"
				class="theme-seg-btn"
				class:active={uiTheme === 'minimal'}
				aria-pressed={uiTheme === 'minimal'}
				onclick={() => setUiTheme('minimal')}
			>
				Minimal
			</button>
			<button
				type="button"
				class="theme-seg-btn"
				class:active={uiTheme === 'desktop'}
				aria-pressed={uiTheme === 'desktop'}
				onclick={() => setUiTheme('desktop')}
			>
				Desktop
			</button>
		</div>
		{#if uiTheme === 'desktop'}
			<div class="theme-segment desk-mode-segment" role="group" aria-label="Desktop light or dark">
				<button
					type="button"
					class="theme-seg-btn"
					class:active={deskMode === 'light'}
					aria-pressed={deskMode === 'light'}
					onclick={() => setDeskMode('light')}
				>
					Light
				</button>
				<button
					type="button"
					class="theme-seg-btn"
					class:active={deskMode === 'dark'}
					aria-pressed={deskMode === 'dark'}
					onclick={() => setDeskMode('dark')}
				>
					Dark
				</button>
			</div>
		{/if}
	</div>
{/snippet}

{#if uiTheme === 'minimal'}
	<main class="minimal mobile-shell-{mobilePane} w-full max-w-full overflow-x-hidden max-lg:pb-[80px]">
		<!-- updating the top nav so the buttons don't crush each other on phones -->
		<header class="min-top flex flex-wrap">
			<h1 class="min-brand">AuraWatch</h1>
			<div class="header-controls flex flex-wrap">
				{@render viewTabs()}
				{@render themeSwitcher()}
				{@render authControls()}
			</div>
		</header>

		<p class="min-headline">
			Can’t find what to watch? Get one movie, show, anime, song, or game that fits your vibe.
		</p>

		<!-- making sure the main container actually uses flex-col on small screens so it stacks properly -->
		<div class="min-workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
			<!-- stripping out hardcoded pixel widths that were breaking the mobile view and causing the black void -->
			<section class="min-form w-full min-w-0 lg:w-1/2" aria-label="Recommend">
				{@render formFields()}
			</section>
			<section
				class="min-result w-full min-w-0 lg:w-1/2"
				id="result-window"
				aria-live="polite"
				aria-label="Match result"
			>
				{@render resultContent()}
			</section>
		</div>
	</main>
{:else}
	<main
		class="desktop mobile-shell-{mobilePane} w-full max-w-full overflow-x-hidden max-lg:pb-[80px]"
		class:desk-dark={deskMode === 'dark'}
	>
		<!-- updating the top nav so the buttons don't crush each other on phones -->
		<header class="menubar flex flex-wrap">
			<div class="menubar-left">
				<span class="menu-brand">AuraWatch</span>
			</div>
			<div class="menubar-right flex flex-wrap">
				{@render viewTabs()}
				{@render themeSwitcher()}
				{@render authControls()}
				<time class="menu-clock" datetime={clockLabel || undefined}>{clockLabel || '—'}</time>
			</div>
		</header>

		<!-- making sure the main container actually uses flex-col on small screens so it stacks properly -->
		<div class="workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
			<!-- stripping out hardcoded pixel widths that were breaking the mobile view and causing the black void -->
			<section class="window form-window w-full min-w-0 lg:w-1/2" aria-label="Recommend">
				<div class="titlebar">
					<div class="traffic" aria-hidden="true">
						<span class="dot red"></span>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">~/AuraWatch — Recommend</span>
					<span class="titlebar-tag">LIVE</span>
				</div>
				<div class="window-body form-body">
					<p class="path-line">C:\AuraWatch\</p>
					<h1 class="brand">AuraWatch</h1>
					<p class="subhead">can’t find what to watch?</p>
					<p class="lede">
						Pick a format and genres. We’ll hand you a movie, show, anime, song, or game that
						fits — so you stop scrolling and start watching or playing.
					</p>

					{@render formFields()}
				</div>
			</section>

			<section
				class="window result-window w-full min-w-0 lg:w-1/2"
				id="result-window"
				aria-live="polite"
				aria-label="Match result"
			>
				<div class="titlebar">
					<div class="traffic" aria-hidden="true">
						<span class="dot red"></span>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">{viewMode === 'list' ? 'Vibe Playlists' : 'Match'}</span>
					<span class="titlebar-tag">{viewMode === 'list' ? 'LIST' : 'PICK'}</span>
				</div>
				<div class="window-body result-body">
					{@render resultContent()}
				</div>
			</section>
		</div>

		<footer class="taskbar hidden lg:flex">
			<span class="start-btn">AuraWatch</span>
			<span class="taskbar-tag">can’t find what to watch?</span>
		</footer>
	</main>
{/if}

{@render mobileBottomNav()}

{#if shareToast}
	<!-- dropping a retro terminal toast notification so users actually know when their link was copied -->
	<div class="share-toast" role="status" aria-live="polite" transition:fade={{ duration: 160 }}>
		{shareToast}
	</div>
{/if}

{#if showLoginPrompt}
	<!-- centering the auth modal dead-center on the screen using flex items-center justify-center -->
	<div
		{@attach portalToBody}
		class="auth-modal-backdrop login-prompt-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		class:minimal-backdrop={uiTheme === 'minimal'}
		role="presentation"
		onclick={() => closeLoginPrompt()}
		onkeydown={(e) => {
			// esc closes the login sheet
			if (e.key === 'Escape') closeLoginPrompt();
		}}
		transition:fade={{ duration: 160 }}
	>
		<div
			class="term-modal mx-auto my-auto h-fit min-h-0 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
			class:modal-desktop={uiTheme === 'desktop'}
			class:modal-desk-dark={uiTheme === 'desktop' && deskMode === 'dark'}
			class:modal-minimal={uiTheme === 'minimal'}
			role="dialog"
			aria-modal="true"
			aria-labelledby="login-prompt-title"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Escape') closeLoginPrompt();
			}}
		>
			{#if uiTheme === 'desktop'}
				<!-- hiding the fake mac window buttons when we aren't in desktop mode -->
				<div class="term-titlebar">
					<div class="traffic" aria-hidden="true">
						<button
							type="button"
							class="dot red"
							aria-label="Close"
							onclick={() => closeLoginPrompt()}
						></button>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">~/AuraWatch — {isRegistering ? 'Register' : 'Sign in'}</span>
					<span class="titlebar-tag">AUTH</span>
				</div>
			{/if}
			<div class="term-modal-body">
				<h2 id="login-prompt-title">{isRegistering ? 'Create account' : 'Sign in to save'}</h2>
				<p>Cloud sync needs a login so you can share your vibe list.</p>
				<div class="login-prompt-actions">
					<button
						type="button"
						class="term-btn primary discord"
						onclick={() => void signInWithDiscord()}
					>
						Login with Discord
					</button>
					<!-- hooking up the email and password submit handlers to the auth client so regular sign-in actually works -->
					<form class="login-cred-form" onsubmit={submitEmailAuth}>
						{#if isRegistering}
							<!-- dynamically rendering the name field and changing button text when creating an account -->
							<input
								type="text"
								name="name"
								autocomplete="name"
								placeholder="What should we call you"
							/>
						{/if}
						<input
							type="text"
							name="username"
							required
							placeholder="Enter your username"
							autocomplete="username"
							spellcheck="false"
						/>
						<input
							type="password"
							name="password"
							required
							placeholder="Password"
							autocomplete={isRegistering ? 'new-password' : 'current-password'}
							minlength={isRegistering ? 8 : undefined}
						/>
						{#if authError}
							<p class="auth-modal-err" role="alert">{authError}</p>
						{/if}
						<button type="submit" class="term-btn primary" disabled={authBusy}>
							{authBusy ? 'Working…' : isRegistering ? 'CREATE ACCOUNT' : 'SIGN IN'}
						</button>
					</form>
					<button
						type="button"
						class="auth-link"
						onclick={() => {
							isRegistering = !isRegistering;
							authError = '';
						}}
					>
						{isRegistering ? 'Already registered? Sign in <-' : 'Need an account? Register ->'}
					</button>
					<button type="button" class="term-btn" onclick={() => closeLoginPrompt()}>Not now</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if savePickerItem}
	<!-- centering the save to playlist modal dead-center on the screen so it matches the sign-in modal -->
	<div
		{@attach portalToBody}
		class="auth-modal-backdrop login-prompt-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		class:minimal-backdrop={uiTheme === 'minimal'}
		role="presentation"
		onclick={() => {
			if (!saveBusy) savePickerItem = null;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape' && !saveBusy) savePickerItem = null;
		}}
		transition:fade={{ duration: 160 }}
	>
		<div
			class="term-modal playlist-picker mx-auto my-auto h-fit min-h-0 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
			class:modal-desktop={uiTheme === 'desktop'}
			class:modal-desk-dark={uiTheme === 'desktop' && deskMode === 'dark'}
			class:modal-minimal={uiTheme === 'minimal'}
			role="dialog"
			aria-modal="true"
			aria-labelledby="playlist-picker-title"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Escape' && !saveBusy) savePickerItem = null;
			}}
		>
			{#if uiTheme === 'desktop'}
				<div class="term-titlebar">
					<div class="traffic" aria-hidden="true">
						<button
							type="button"
							class="dot red"
							aria-label="Close"
							onclick={() => {
								if (!saveBusy) savePickerItem = null;
							}}
						></button>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">~/AuraWatch — Save to playlist</span>
					<span class="titlebar-tag">SAVE</span>
				</div>
			{/if}
			<div class="term-modal-body">
				<h2 id="playlist-picker-title">Save to playlist</h2>
				<p>“{savePickerItem.title}” — pick a vibe group.</p>
				<div class="login-prompt-actions">
					{#each cloudPlaylists as pl (pl.id)}
						{@const already = pl.items.some(
							(i: CloudPlaylistClient['items'][number]) =>
								i.title.toLowerCase() === savePickerItem!.title.toLowerCase()
						)}
						<button
							type="button"
							class="term-btn primary playlist-pick-btn"
							class:already
							disabled={saveBusy || already}
							onclick={() => void saveToPlaylist(pl.id)}
						>
							{#if saveBusy && savingListId === pl.id}
								{uiTheme === 'minimal' ? 'Saving…' : '[ SAVING... ]'}
							{:else if already}
								In {pl.title}
							{:else}
								{pl.title}
							{/if}
						</button>
					{/each}
					{#if !cloudPlaylists.length}
						<button
							type="button"
							class="term-btn primary"
							disabled={saveBusy || playlistBusy}
							onclick={() => {
								newPlaylistTitle = newPlaylistTitle.trim() || 'My List';
								void createPlaylistAndMaybeSave();
							}}
						>
							{playlistBusy || saveBusy
								? uiTheme === 'minimal'
									? 'Saving…'
									: '[ SAVING... ]'
								: 'Save to My List'}
						</button>
					{/if}
					<div class="playlist-create picker-create">
						<input
							class="playlist-input"
							type="text"
							placeholder="New playlist name…"
							bind:value={newPlaylistTitle}
							disabled={playlistBusy || saveBusy}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									void createPlaylistAndMaybeSave();
								}
							}}
						/>
						<button
							type="button"
							class="term-btn"
							disabled={playlistBusy || saveBusy || !newPlaylistTitle.trim()}
							onclick={() => void createPlaylistAndMaybeSave()}
						>
							{playlistBusy
								? uiTheme === 'minimal'
									? 'Saving…'
									: '[ SAVING... ]'
								: 'Create & save'}
						</button>
					</div>
					<button
						type="button"
						class="term-btn"
						disabled={saveBusy}
						onclick={() => (savePickerItem = null)}>Cancel</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if viewMode === 'match' && results.length && !isLoading && fabItem}
	<!-- sticky save button - users couldn't find the old one -->
	<button
		type="button"
		class={[
			'save-fab max-lg:min-h-12 max-lg:px-5 max-lg:py-3',
			mobilePane !== 'match' && 'save-fab-mobile-hide'
		]}
		class:saved={fabIsSaved}
		class:minimal-fab={uiTheme === 'minimal'}
		aria-label={fabIsSaved ? `Remove ${fabItem.title} from My List` : `Save ${fabItem.title} to My List`}
		aria-pressed={fabIsSaved}
		onclick={toggleFabSave}
		transition:fly={{ y: 24, duration: 220, easing: quintOut }}
	>
		<span class="save-fab-icon" aria-hidden="true">{fabIsSaved ? '★' : '☆'}</span>
		<span class="save-fab-copy">
			<span class="save-fab-label">{fabIsSaved ? 'Saved' : 'Save to List'}</span>
			<span class="save-fab-title">{fabItem.title}</span>
		</span>
	</button>
{/if}

<!-- Crawlable copy for search engines (kept out of the hero composition) -->
<section class="seo-faq" aria-label="About AuraWatch">
	<h2>Can’t find what to watch tonight?</h2>
	<p>
		AuraWatch is a free vibe-based recommender for people stuck in Netflix decision fatigue. Tell
		it your format, genres, decade, and titles you already like — it returns one strong match with
		posters, trailers or song previews, and where-to-watch or listen links.
	</p>
	<h3>What should I watch if nothing sounds good?</h3>
	<p>
		Add a short note about the mood you want (cozy, western, high-energy), pick a few genres, and
		optionally a show or movie you already love. AuraWatch scores picks against that vibe instead
		of dumping endless rows.
	</p>
	<h3>Movie, TV, anime, song, and game picks</h3>
	<p>
		Use Movies, TV Series, Anime, Songs, or Games mode. Song mode includes listen links for Apple
		Music, Spotify, and YouTube when available. Games mode pulls covers, platforms, and store links
		from IGDB.
	</p>
</section>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		min-height: 100%;
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
		background: #0e0e12;
		color: #f3f4f6;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	/* fixing top nav bar button spacing and border collision */
	.view-tabs {
		display: none;
		align-items: center;
		gap: 0;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
	}

	@media (min-width: 1024px) {
		.view-tabs {
			display: inline-flex;
		}
	}

	/* tucking the massive genre list into an accordion so it doesn't eat the whole screen */
	.genre-acc {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.genre-acc-summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted, #9ca3af);
		padding: 0.55rem 0;
	}
	.genre-acc-summary::-webkit-details-marker {
		display: none;
	}
	.genre-acc-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: var(--accent, #8b7cf7);
		color: #fff;
		font-size: 0.65rem;
	}
	.genre-acc-desk-label {
		display: none;
	}

	.genre-acc:not([open]) .genre-grid,
	.genre-acc:not([open]) .genre-acc-desk-label {
		display: none;
	}

	@media (min-width: 1024px) {
		.genre-acc > summary {
			display: none;
		}
		.genre-acc-desk-label {
			display: block;
		}
		.genre-acc .genre-grid,
		.genre-acc:not([open]) .genre-grid {
			display: flex !important;
		}
	}

	/* moving tabs to a bottom nav bar because making users reach to the top of their phone is terrible ux */
	.app-bottom-nav {
		display: flex;
		align-items: stretch;
		justify-content: space-around;
		padding: 0.35rem 0.5rem calc(0.35rem + env(safe-area-inset-bottom));
	}
	.app-nav-btn {
		appearance: none;
		border: none;
		background: transparent;
		color: #9ca3af;
		cursor: pointer;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		padding: 0.45rem 0.25rem;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		min-height: 3.15rem;
	}
	.app-nav-btn.active {
		color: #fff;
	}
	.app-nav-icon {
		width: 1.35rem;
		height: 1.35rem;
	}

	@media (min-width: 1024px) {
		.app-bottom-nav {
			display: none;
		}
	}

	@media (max-width: 1023px) {
		.mobile-shell-match .min-form,
		.mobile-shell-list .min-form,
		.mobile-shell-match .form-window,
		.mobile-shell-list .form-window,
		.mobile-shell-vibe .min-result,
		.mobile-shell-vibe .result-window {
			display: none !important;
		}
		.mobile-shell-match .min-headline,
		.mobile-shell-list .min-headline {
			display: none;
		}
		.desktop .titlebar,
		.desktop .taskbar,
		.desktop .menu-clock {
			display: none;
		}
	}

	.view-tab-btn {
		appearance: none;
		border: none;
		border-right: 1px solid rgba(255, 255, 255, 0.14);
		cursor: pointer;
		padding: 0.4rem 0.65rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: #9ca3af;
		background: transparent;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		text-decoration: none;
		line-height: 1.2;
		min-height: 1.85rem;
	}
	.view-tab-btn:last-child {
		border-right: none;
	}
	.view-tab-btn:hover:not(.active) {
		color: #f3f4f6;
		background: rgba(255, 255, 255, 0.06);
	}
	.view-tab-btn.active {
		color: #0e0e12;
		background: #f3f4f6;
		font-weight: 600;
	}
	.view-tab-btn:focus-visible {
		outline: 2px solid #8b7cf7;
		outline-offset: -2px;
		z-index: 1;
	}

	.theme-switcher-stack {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.theme-segment {
		display: inline-grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
	}

	.theme-seg-btn {
		appearance: none;
		border: none;
		cursor: pointer;
		padding: 0.4rem 0.75rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: #9ca3af;
		background: transparent;
		white-space: nowrap;
	}
	.theme-seg-btn:hover:not(.active) {
		color: #f3f4f6;
		background: rgba(255, 255, 255, 0.06);
	}
	.theme-seg-btn.active {
		color: #0e0e12;
		background: #f3f4f6;
		font-weight: 600;
	}
	.theme-seg-btn:focus-visible {
		outline: 2px solid #8b7cf7;
		outline-offset: -2px;
		z-index: 1;
	}

	/* ── Desktop shell ── */
	.desktop {
		--desk: #7b8a9d;
		--window: #ffffff;
		--bar: #1a1a1a;
		--menu: #f2f2f2;
		--accent: #ff4c00;
		--ink: #111111;
		--muted: #666666;
		--line: #111111;
		--hover: #f5f5f5;
		--soft: #f7f7f7;
		--chrome: #e8eaed;
		--rule-soft: #dddddd;
		--on-accent: #ffffff;
		--invert: #111111;
		--panel: #ffffff;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
		background: var(--desk);
		color: var(--ink);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	.desktop.desk-dark {
		--desk: #0b0d11;
		--window: #080a0e;
		--bar: #050608;
		--menu: #0e1015;
		--accent: #ff4c00;
		--ink: #e8eaed;
		--muted: #8b929e;
		--line: #2a2f38;
		--hover: #141820;
		--soft: #0c0f14;
		--chrome: #12151a;
		--rule-soft: #22262e;
		--on-accent: #ffffff;
		--invert: #e8eaed;
		--panel: #080a0e;
	}

	.desktop .view-tabs,
	.desktop .theme-segment {
		border: 2px solid var(--line);
		border-radius: 0;
		background: var(--window);
	}
	.desktop .view-tab-btn,
	.desktop .theme-seg-btn {
		padding: 0.15rem 0.55rem;
		font-size: 0.72rem;
		color: var(--muted);
		min-height: 1.55rem;
	}
	.desktop .view-tab-btn {
		border-right: 2px solid var(--line);
	}
	.desktop .view-tab-btn:last-child {
		border-right: none;
	}
	.desktop .view-tab-btn:hover:not(.active),
	.desktop .theme-seg-btn:hover:not(.active) {
		color: var(--ink);
		background: var(--hover);
	}
	.desktop .view-tab-btn.active,
	.desktop .theme-seg-btn.active {
		color: var(--window);
		background: var(--invert);
		font-weight: 700;
	}
	.desktop .view-tab-btn:focus-visible,
	.desktop .theme-seg-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	/* updating the top nav so the buttons don't crush each other on phones */
	.desktop .menubar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.55rem 1rem;
		flex-wrap: wrap;
		flex-shrink: 0;
		height: auto;
		min-height: 28px;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		padding: 0.2rem 0.75rem;
		background: var(--menu);
		border-bottom: 2px solid var(--line);
		font-size: 0.78rem;
		box-sizing: border-box;
	}

	.desktop .menubar-left {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}

	.desktop .menubar-right {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		min-width: 0;
		max-width: 100%;
	}

	.desktop .menu-brand {
		font-weight: 700;
		color: var(--ink);
		white-space: nowrap;
	}

	.desktop .menu-clock {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
		white-space: nowrap;
	}

	/* making sure the main container actually uses flex-col on small screens so it stacks properly */
	.desktop .workspace {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: min(1100px, 100%);
		min-width: 0;
		overflow-x: hidden;
		margin: 0 auto;
		padding: 1rem 0.85rem 1.25rem;
		box-sizing: border-box;
	}

	@media (min-width: 1024px) {
		.desktop .workspace {
			flex-direction: row;
			align-items: stretch;
			gap: 1.15rem;
			padding: 1.35rem 1.25rem 1.5rem;
		}
	}

	.desktop .window {
		display: flex;
		flex-direction: column;
		background: var(--window);
		border: 2px solid var(--line);
		border-radius: 0;
		min-width: 0;
		width: 100%;
		flex: 1;
	}

	/* stripping out hardcoded pixel widths that were breaking the mobile view and causing the black void */
	.desktop .form-window,
	.desktop .result-window {
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}

	@media (min-width: 1024px) {
		.desktop .form-window,
		.desktop .result-window {
			flex: 1 1 50%;
			width: 50%;
		}
	}

	.desktop .titlebar {
		display: none;
		align-items: center;
		gap: 0.55rem;
		flex-shrink: 0;
		height: 28px;
		padding: 0 0.55rem;
		background: var(--bar);
		color: #f5f5f5;
		font-size: 0.72rem;
	}

	@media (min-width: 1024px) {
		.desktop .titlebar {
			display: flex;
		}
	}

	.desktop .traffic {
		display: flex;
		align-items: center;
		gap: 0.28rem;
		flex-shrink: 0;
	}

	.desktop .dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.35);
	}
	.desktop .dot.red {
		background: #ff5f57;
	}
	.desktop .dot.yellow {
		background: #febc2e;
	}
	.desktop .dot.green {
		background: #28c840;
	}

	.desktop .titlebar-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.desktop .titlebar-tag {
		flex-shrink: 0;
		padding: 0.1rem 0.35rem;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1.2;
	}

	.desktop .window-body {
		flex: 1;
		padding: 1.1rem 1.15rem 1.25rem;
		background: var(--window);
		box-sizing: border-box;
		min-width: 0;
		overflow-x: clip;
	}

	.desktop .form-body {
		background-image: repeating-linear-gradient(
			90deg,
			transparent,
			transparent 11px,
			rgba(0, 0, 0, 0.035) 11px,
			rgba(0, 0, 0, 0.035) 12px
		);
	}

	.desktop .path-line {
		margin: 0 0 0.55rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.desktop .brand {
		margin: 0 0 0.35rem;
		font-size: clamp(2.4rem, 8vw, 3.6rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 0.95;
		color: var(--ink);
		animation: brand-in 0.45s ease-out both;
	}

	.desktop .subhead {
		margin: 0 0 0.55rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--accent);
	}

	.desktop .lede {
		margin: 0 0 1.35rem;
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--muted);
		max-width: 28rem;
	}

	.desktop .vibe-form {
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
	}

	.form-stack {
		display: flex;
		flex-direction: column;
		gap: inherit;
	}

	.desktop .field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.desktop .field-label {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}

	.desktop .optional {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		opacity: 0.8;
	}

	.desktop .field-hint {
		margin: 0;
		font-size: 0.7rem;
		color: var(--muted);
	}

	.desktop .advanced-toggle {
		appearance: none;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.55rem 0.7rem;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		background: transparent;
		border: 2px solid var(--line);
		border-radius: 0;
		cursor: pointer;
		text-align: left;
	}
	.desktop .advanced-toggle:hover {
		color: var(--text);
		border-color: color-mix(in srgb, var(--muted) 70%, var(--line));
		background: color-mix(in srgb, var(--window) 92%, var(--muted));
	}
	.desktop .advanced-toggle:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.desktop .advanced-toggle-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.15rem;
		height: 1.15rem;
		padding: 0 0.28rem;
		font-size: 0.62rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
		text-transform: none;
		color: var(--on-accent);
		background: var(--accent);
		border-radius: 0;
	}
	.desktop .advanced-toggle-chevron {
		margin-left: auto;
		font-size: 0.58rem;
		opacity: 0.75;
	}
	.desktop .advanced-fields {
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
	}

	.desktop .weight-label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.desktop .weight-value {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.desktop .weight-slider-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.55rem;
		align-items: center;
	}

	.desktop .weight-end {
		font-size: 0.58rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		white-space: nowrap;
	}

	.desktop .weight-slider {
		width: 100%;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.desktop .weight-slider:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.desktop .region-field :global(.region-select) {
		width: 100%;
	}

	.desktop .zflix-switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		cursor: pointer;
	}
	.desktop .zflix-switch-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.desktop .zflix-switch-copy .field-hint {
		margin: 0;
	}
	.desktop .zflix-switch {
		appearance: none;
		flex-shrink: 0;
		width: 2.75rem;
		height: 1.45rem;
		padding: 0;
		border: 2px solid var(--line);
		border-radius: 0;
		background: var(--window);
		cursor: pointer;
		position: relative;
		transition: background 0.15s ease;
	}
	.desktop .zflix-switch.on {
		background: var(--accent);
	}
	.desktop .zflix-switch:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.desktop .zflix-switch:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.desktop .zflix-switch-thumb {
		position: absolute;
		top: 1px;
		left: 1px;
		width: calc(1.45rem - 6px);
		height: calc(1.45rem - 6px);
		background: var(--line);
		border-radius: 0;
		transition: transform 0.15s ease;
	}
	.desktop .zflix-switch.on .zflix-switch-thumb {
		transform: translateX(1.3rem);
		background: #fff;
	}

	.desktop .segment {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0;
		border: 2px solid var(--line);
		border-radius: 0;
		overflow: hidden;
		background: var(--window);
	}

	.desktop .segment-btn {
		appearance: none;
		border: none;
		border-right: 2px solid var(--line);
		cursor: pointer;
		border-radius: 0;
		padding: 0.55rem 0.2rem;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 500;
		color: var(--muted);
		background: transparent;
	}
	.desktop .segment-btn:last-child {
		border-right: none;
	}
	.desktop .segment-btn:hover:not(:disabled):not(.active) {
		color: var(--ink);
		background: var(--hover);
	}
	.desktop .segment-btn.active {
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 700;
	}
	.desktop .segment-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* nuking the grid layout for flex pills because that empty square was driving me crazy */
	.desktop .format-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.desktop .format-pill {
		appearance: none;
		border: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		cursor: pointer;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		line-height: 1.2;
		transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
	}
	.desktop .format-pill:hover:not(:disabled):not(.active) {
		border-color: var(--accent);
		color: var(--accent);
	}
	.desktop .format-pill.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
	.desktop .format-pill:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.desktop .format-pill.full-vibe-pill {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.desktop .format-pill.full-vibe-pill.active {
		box-shadow: 2px 2px 0 var(--line);
	}

	.desktop .vibe-pack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
	}
	.desktop .vibe-pack-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
	}
	.desktop .vibe-slot {
		border: 2px solid var(--line);
		background: var(--soft);
		padding: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}
	.desktop .vibe-slot-label {
		margin: 0;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--accent);
	}
	.desktop .vibe-slot-cover {
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border: 2px solid var(--line);
		background: var(--rule-soft);
	}
	.desktop .vibe-slot-cover-sq {
		aspect-ratio: 1 / 1;
	}
	.desktop .vibe-slot-title {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.25;
	}
	.desktop .vibe-slot-pitch {
		margin: 0;
		font-size: 0.72rem;
		color: var(--muted);
		line-height: 1.35;
	}
	@media (max-width: 900px) {
		.desktop .vibe-pack-grid {
			grid-template-columns: 1fr;
		}
	}

	.desktop .maturity-segment {
		grid-template-columns: repeat(4, 1fr);
	}
	.desktop .maturity-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		padding: 0.45rem 0.15rem 0.5rem;
		line-height: 1.15;
	}
	.desktop .maturity-label {
		font-size: 0.68rem;
		font-weight: inherit;
	}
	.desktop .maturity-certs {
		font-size: 0.58rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		opacity: 0.72;
		white-space: nowrap;
	}
	.desktop .maturity-btn.active .maturity-certs {
		opacity: 0.95;
	}

	.desktop .price-segment {
		grid-template-columns: repeat(5, 1fr);
	}

	@media (max-width: 640px) {
		.desktop .format-pill {
			font-size: 0.68rem;
			padding: 0.35rem 0.7rem;
		}
	}

	@media (max-width: 560px) {
		.desktop
			.segment:not(.format-segment):not(.decade-segment):not(.maturity-segment):not(
				.price-segment
			) {
			grid-template-columns: repeat(2, 1fr);
		}
		.desktop
			.segment:not(.format-segment):not(.decade-segment):not(.maturity-segment):not(
				.price-segment
			)
			.segment-btn:nth-child(2n) {
			border-right: none;
		}
		.desktop
			.segment:not(.format-segment):not(.decade-segment):not(.maturity-segment):not(
				.price-segment
			)
			.segment-btn:nth-child(-n + 2) {
			border-bottom: 2px solid var(--line);
		}

		.desktop .price-segment {
			grid-template-columns: repeat(3, 1fr);
		}
		.desktop .price-segment .segment-btn {
			border-right: 2px solid var(--line);
			border-bottom: 2px solid var(--line);
		}
		.desktop .price-segment .segment-btn:nth-child(3n) {
			border-right: none;
		}
		.desktop .price-segment .segment-btn:nth-child(n + 4) {
			border-bottom: none;
		}
	}

	.desktop .decade-segment {
		grid-template-columns: repeat(6, 1fr);
	}
	@media (max-width: 560px) {
		.desktop .decade-segment {
			grid-template-columns: repeat(3, 1fr);
		}
		.desktop .decade-segment .segment-btn {
			border-right: 2px solid var(--line);
			border-bottom: 2px solid var(--line);
		}
		.desktop .decade-segment .segment-btn:nth-child(3n) {
			border-right: none;
		}
		.desktop .decade-segment .segment-btn:nth-child(n + 4) {
			border-bottom: none;
		}
	}

	.desktop .rec-title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.5rem;
		margin: 0 0 0.3rem;
	}
	.desktop .rec-title-row .rec-title {
		margin: 0;
		flex: 1 1 10rem;
		min-width: 0;
	}
	.desktop .rec-title-row .save-btn {
		margin-left: auto;
		flex-shrink: 0;
	}
	.desktop .age-badge {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		padding: 0.12rem 0.4rem;
		border: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.desktop .media-preview.audio-preview {
		display: block;
		width: 100%;
		max-width: 280px;
		height: 32px;
		margin-top: 0.75rem;
	}
	.desktop .trailer-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		width: 100%;
		max-width: 320px;
		margin-top: 0.75rem;
	}
	.desktop .media-preview.trailer-frame {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		border: 2px solid var(--line);
		border-radius: 0;
		background: #000;
	}
	.desktop .preview-btn {
		appearance: none;
		cursor: pointer;
		margin-top: 0.75rem;
		padding: 0.35rem 0.65rem;
		border: 2px solid var(--line);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.desktop .preview-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.desktop .preview-btn.preview-close {
		margin-top: 0;
	}

	.desktop .genre-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.85rem;
		max-height: 7.5rem;
		overflow-y: auto;
		padding: 0.1rem 0;
		scrollbar-width: thin;
		scrollbar-color: var(--muted) transparent;
	}

	.desktop .genre-toggle {
		appearance: none;
		border: none;
		cursor: pointer;
		border-radius: 0;
		padding: 0.25rem 0;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 400;
		color: var(--muted);
		background: transparent;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-bottom: 1px solid transparent;
	}
	.desktop .genre-toggle:hover:not(:disabled):not(.active) {
		color: var(--ink);
	}
	.desktop .genre-toggle.active {
		color: var(--ink);
		font-weight: 700;
		border-bottom-color: var(--accent);
	}
	.desktop .genre-toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.desktop .genre-mark {
		width: 0.7rem;
		height: 0.7rem;
		border: 2px solid var(--line);
		border-radius: 0;
		box-sizing: border-box;
		flex-shrink: 0;
		background: transparent;
		position: relative;
	}
	.desktop .genre-toggle.active .genre-mark {
		border-color: var(--accent);
		background: var(--accent);
	}
	.desktop .genre-toggle.active .genre-mark::after {
		content: '';
		position: absolute;
		left: 0.12rem;
		top: 0;
		width: 0.18rem;
		height: 0.34rem;
		border: solid #fff;
		border-width: 0 1.5px 1.5px 0;
		transform: rotate(45deg);
	}

	.desktop .vibe-input {
		width: 100%;
		resize: none;
		border-radius: 0;
		border: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		padding: 0.55rem 0.65rem;
		font: inherit;
		font-size: 0.85rem;
		line-height: 1.5;
		outline: none;
		box-sizing: border-box;
	}
	.desktop .vibe-input::placeholder {
		color: var(--muted);
		opacity: 0.75;
	}
	.desktop .vibe-input:focus {
		border-color: var(--accent);
		outline: none;
	}
	.desktop .vibe-input:disabled {
		opacity: 0.55;
	}

	.desktop .cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.2rem;
		align-items: stretch;
	}

	@media (max-width: 1023px) {
		.desktop .cta-row,
		.minimal .cta-row {
			position: sticky;
			bottom: 80px;
			z-index: 20;
			padding: 1rem 0;
			margin-top: 0;
			background: var(--window, var(--bg, #ffffff));
			border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
		}
		.form-stack {
			padding-bottom: 8rem;
		}
		.desktop .genre-grid,
		.minimal .genre-grid {
			max-height: min(42vh, 16rem);
		}
	}
	.desktop .cta {
		appearance: none;
		border: 2px solid var(--accent);
		cursor: pointer;
		border-radius: 0;
		padding: 0.75rem 1.1rem;
		font: inherit;
		font-weight: 700;
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--on-accent);
		background: var(--accent);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0;
		flex: 1 1 auto;
		min-width: 8rem;
	}
	.desktop .cta:hover:not(:disabled) {
		filter: brightness(1.05);
	}
	.desktop .cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.desktop .cta-surprise {
		flex: 0 1 auto;
		color: var(--ink);
		background: var(--window);
		border-color: var(--line);
	}
	.desktop .cta-surprise:hover:not(:disabled) {
		filter: none;
		border-color: var(--accent);
		color: var(--accent);
	}
	.desktop .save-btn {
		appearance: none;
		margin-left: auto;
		border: 2px solid var(--line);
		background: var(--accent);
		color: var(--on-accent);
		cursor: pointer;
		padding: 0.2rem 0.55rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.2;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		box-shadow: 3px 3px 0 var(--line);
	}
	.desktop .save-btn:hover {
		filter: brightness(1.05);
	}
	.desktop .save-btn.saved {
		background: var(--window);
		color: var(--accent);
		border-color: var(--accent);
	}
	.desktop .lang-select {
		width: 100%;
		border: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		font: inherit;
		font-size: 0.9rem;
		padding: 0.45rem 0.55rem;
		appearance: auto;
	}
	.desktop .lang-select:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.desktop .aura-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.desktop .spinner {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		animation: spin 0.7s linear infinite;
	}

	.desktop .err {
		margin: 0.9rem 0 0;
		color: var(--accent);
		font-size: 0.8rem;
	}

	.desktop .result-body {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		min-height: 14rem;
		max-height: min(70vh, 42rem);
		overflow-y: auto;
		scrollbar-width: thin;
	}

	@media (min-width: 960px) {
		.desktop .result-window {
			max-height: calc(100dvh - 28px - 36px - 2.5rem);
			min-height: 0;
		}
		.desktop .result-body {
			min-height: 0;
			max-height: none;
			flex: 1;
			overflow-y: auto;
		}
	}

	.desktop .rec-list {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 0;
	}

	.desktop .rec-list-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0 0 0.35rem;
	}

	.desktop .rec-list-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.desktop .rec-list-header {
		margin: 0;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}

	.desktop .share-vibe-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		padding: 0.28rem 0.55rem;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink);
		background: var(--panel);
		border: 1.5px solid var(--line);
		cursor: pointer;
	}
	.desktop .share-vibe-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--hover);
	}
	.desktop .share-vibe-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.desktop .rec-card {
		padding: 1rem 0;
	}
	.desktop .rec-card + .rec-card {
		border-top: 2px solid var(--line);
	}

	.desktop .empty-state {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
		text-align: left;
	}

	.desktop .board-soon-card {
		margin: 0;
		padding: 1rem 0;
		border-top: 2px solid var(--line);
		border-bottom: 2px solid var(--line);
	}
	.desktop .board-soon-eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.desktop .board-soon-title {
		margin: 0 0 0.45rem;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.desktop .board-soon-body {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
		color: var(--muted);
		max-width: 36rem;
	}

	.desktop .vibe-miss-card {
		margin: 0;
		padding: 1rem 1rem 1.1rem;
		border: 2px solid var(--line);
		border-left: 6px solid var(--accent);
		background: var(--window);
		box-shadow: 4px 4px 0 var(--line);
	}
	.desktop .vibe-miss-code {
		margin: 0 0 0.9rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
		color: var(--ink);
	}
	.desktop .vibe-miss-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.desktop .vibe-miss-btn {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		padding: 0.55rem 0.8rem;
		min-height: 44px;
		border: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		cursor: pointer;
	}
	.desktop .vibe-miss-btn.primary {
		background: var(--accent);
		color: var(--on-accent);
	}
	.desktop .vibe-miss-btn:hover {
		translate: 1px 1px;
		box-shadow: 2px 2px 0 var(--line);
	}

	.desktop .loading-block {
		width: 100%;
		display: flex;
		justify-content: flex-start;
	}

	.desktop .loading-refresh {
		margin-bottom: 0.65rem;
		padding-bottom: 0.55rem;
		border-bottom: 2px solid var(--line);
	}

	.desktop .rec-list-dimmed {
		opacity: 0.55;
		pointer-events: none;
	}

	.desktop .rec-skeleton {
		pointer-events: none;
	}

	.desktop .skel-cover {
		width: 120px;
		aspect-ratio: 2 / 3;
		border: 2px solid var(--line);
		background: var(--chrome);
		animation: skel-pulse 1.2s ease-in-out infinite;
	}

	@media (min-width: 960px) {
		.desktop .skel-cover {
			width: 150px;
		}
	}

	.desktop .skel-copy {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding-top: 0.15rem;
	}

	.desktop .skel-line {
		height: 0.7rem;
		width: 88%;
		background: var(--chrome);
		animation: skel-pulse 1.2s ease-in-out infinite;
	}

	.desktop .skel-line-sm {
		width: 28%;
		height: 0.55rem;
	}

	.desktop .skel-line-lg {
		width: 62%;
		height: 1.05rem;
	}

	.desktop .skel-line-md {
		width: 44%;
	}

	.desktop .rec-grid {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		gap: 1.1rem;
		align-items: start;
		min-width: 0;
	}

	@media (min-width: 960px) {
		.desktop .rec-grid {
			grid-template-columns: 150px 1fr;
			gap: 1.25rem;
		}
	}

	@media (max-width: 560px) {
		.desktop .rec-grid {
			grid-template-columns: 1fr;
		}
	}

	.desktop .cover-wrap {
		position: relative;
		border-radius: 0;
		overflow: hidden;
		border: 2px solid var(--line);
		width: 120px;
	}
	@media (min-width: 960px) {
		.desktop .cover-wrap {
			width: 150px;
		}
	}

	.desktop .cover {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.35s ease;
	}
	.desktop .cover.cover-in {
		opacity: 1;
	}
	.desktop .cover-skel {
		position: absolute;
		inset: 0;
		z-index: 1;
		box-sizing: border-box;
	}
	.desktop .cover.cover-square,
	.desktop .cover-fallback.cover-square {
		aspect-ratio: 1 / 1;
	}
	.desktop .cover-wrap.cover-square {
		width: 110px;
	}
	@media (min-width: 960px) {
		.desktop .cover-wrap.cover-square {
			width: 130px;
		}
	}

	.desktop .cover-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 2 / 3;
		padding: 0.65rem;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
		text-align: center;
	}
	.desktop .cover-fallback-initials {
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		font-weight: 700;
		font-size: clamp(1.6rem, 4vw, 2.35rem);
		letter-spacing: -0.04em;
		line-height: 1;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 1px 10px rgba(0, 0, 0, 0.35);
		user-select: none;
	}

	.desktop .rec-label {
		margin: 0 0 0.25rem;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent);
	}
	.desktop .rec-title {
		font-weight: 700;
		font-size: clamp(1.25rem, 2.6vw, 1.7rem);
		letter-spacing: -0.03em;
		margin: 0 0 0.45rem;
		line-height: 1.15;
		color: var(--ink);
	}
	.desktop .rec-artist {
		margin: -0.2rem 0 0.45rem;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.desktop .meta-line {
		/* cleaning up the metadata spacing so titles and tags don't feel crowded on mobile screens */
		margin: 0.1rem 0 0.35rem;
		font-size: 0.72rem;
		line-height: 1.45;
		letter-spacing: 0.01em;
		color: var(--muted);
		max-width: 100%;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.desktop .score-breakdown {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 0.45rem 0.55rem;
		margin: 0.15rem 0 0.4rem;
	}
	.desktop .metascore {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.4rem 0.2rem 0.2rem;
		border: 2px solid var(--line);
		background: var(--window);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		line-height: 1;
	}
	.desktop .metascore-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.7rem;
		height: 1.7rem;
		padding: 0 0.2rem;
		border: 2px solid var(--line);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--on-accent, #fff);
		background: var(--ink);
	}
	.desktop .metascore-high .metascore-num {
		background: #2f6b3a;
		border-color: #2f6b3a;
	}
	.desktop .metascore-mid .metascore-num {
		background: #b07a12;
		border-color: #b07a12;
	}
	.desktop .metascore-low .metascore-num {
		background: #8b2e2e;
		border-color: #8b2e2e;
	}
	.desktop .metascore-label,
	.desktop .userscore-label {
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.desktop .userscore {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.45rem;
		border: 2px solid var(--line);
		background: var(--soft);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		line-height: 1;
	}
	.desktop .userscore-num {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}

	.desktop .genre-line {
		margin: 0 0 0.1rem;
		font-size: 0.7rem;
		line-height: 1.3;
		letter-spacing: 0.01em;
		color: var(--muted);
	}

	.desktop .rec-pitch {
		margin: 0.65rem 0 0;
		line-height: 1.55;
		color: var(--ink);
		font-size: 0.85rem;
	}

	.desktop .where-watch {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.65rem;
		margin-top: 1.1rem;
	}
	.desktop .watch-heading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.desktop .watch-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	.desktop .watch-region {
		font-size: 0.65rem;
		color: var(--muted);
	}
	.desktop .watch-label-link {
		text-decoration: none;
		color: var(--muted);
	}
	.desktop .watch-label-link:hover {
		color: var(--accent);
	}
	.desktop .provider-groups {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: 100%;
	}
	.desktop .provider-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.3rem;
	}
	.desktop .provider-category {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink);
	}
	.desktop .provider-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.desktop .provider-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		padding: 0;
		border-radius: 0;
		border: 2px solid var(--line);
		background: var(--window);
		overflow: hidden;
		text-decoration: none;
	}
	.desktop a.provider-btn:hover {
		border-color: var(--accent);
	}
	.desktop .provider-logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.desktop .provider-fallback {
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--ink);
		text-transform: uppercase;
	}
	.desktop .provider-btn.provider-text {
		width: auto;
		height: auto;
		padding: 0.35rem 0.55rem;
	}
	.desktop .provider-btn.provider-text .provider-fallback {
		font-size: 0.68rem;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 600;
	}
	.desktop .zflix-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.95rem;
		border-radius: 0;
		border: 2px solid var(--line);
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
	}
	.desktop .zflix-cta:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.desktop .amazon-cta {
		gap: 0.4rem;
	}
	.desktop .game-platform-line {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.desktop .game-store-sep {
		width: 100%;
		margin: 0.1rem 0;
		border-top: 1px solid var(--line);
	}
	.desktop .game-cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.desktop .taskbar {
		display: none;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
		height: 36px;
		padding: 0 0.65rem;
		background: var(--bar);
		border-top: 2px solid var(--line);
		color: var(--muted);
		font-size: 0.75rem;
	}

	@media (min-width: 1024px) {
		.desktop .taskbar {
			display: flex;
		}
	}

	.desktop .start-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.28rem 0.7rem;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
		border: 2px solid #c43a00;
		border-radius: 0;
		white-space: nowrap;
	}

	.desktop .taskbar-tag {
		color: #999;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── Minimal shell (dark charcoal) ── */
	.minimal {
		--bg: #0e0e12;
		--ink: #f3f4f6;
		--muted: #9ca3af;
		--line: rgba(255, 255, 255, 0.1);
		--accent: #8b7cf7;
		--panel: #16161c;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
		background: var(--bg);
		color: var(--ink);
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		box-sizing: border-box;
		padding: 1.5rem 1.25rem 3rem;
	}

	@media (min-width: 900px) {
		.minimal {
			padding: 2.25rem 2.5rem 4rem;
		}
	}

	.minimal .min-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.35rem;
	}

	.minimal .min-brand {
		margin: 0;
		font-size: clamp(2.6rem, 7vw, 4rem);
		font-weight: 700;
		letter-spacing: -0.045em;
		line-height: 0.95;
		color: var(--ink);
		animation: brand-in 0.45s ease-out both;
	}

	.minimal .min-headline {
		margin: 0 0 2rem;
		font-size: 1.05rem;
		font-weight: 400;
		color: var(--muted);
		letter-spacing: -0.01em;
		max-width: 36rem;
	}

	/* SEO FAQ: readable to crawlers, visually quiet for humans */
	.seo-faq {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 3.5rem;
		color: rgba(243, 244, 246, 0.55);
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.seo-faq h2,
	.seo-faq h3 {
		color: rgba(243, 244, 246, 0.78);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 1.25rem 0 0.4rem;
	}

	.seo-faq h2 {
		font-size: 1.15rem;
		margin-top: 0;
	}

	.seo-faq p {
		margin: 0 0 0.75rem;
	}

	/* making sure the main container actually uses flex-col on small screens so it stacks properly */
	.minimal .min-workspace {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		width: 100%;
		max-width: min(1040px, 100%);
		min-width: 0;
		overflow-x: hidden;
		margin: 0 auto;
		flex: 1;
	}

	.minimal .min-form,
	.minimal .min-result {
		width: 100%;
		min-width: 0;
	}

	.minimal .min-result {
		overflow-y: auto;
		max-height: min(70vh, 42rem);
		scrollbar-width: thin;
		scrollbar-color: var(--muted) transparent;
	}

	@media (min-width: 1024px) {
		.minimal .min-workspace {
			flex-direction: row;
			align-items: stretch;
			gap: 0;
		}

		.minimal .min-form {
			flex: 1 1 50%;
			width: 50%;
			padding-right: 2rem;
			border-right: 1px solid var(--line);
		}

		.minimal .min-result {
			flex: 1 1 50%;
			width: 50%;
			padding-left: 2rem;
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			min-height: 0;
			max-height: calc(100dvh - 8rem);
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--muted) transparent;
		}
	}

	.minimal .rec-list {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 0;
	}

	.minimal .rec-list-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0 0 0.4rem;
	}

	.minimal .rec-list-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.minimal .rec-list-header {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	.minimal .share-vibe-btn {
		flex-shrink: 0;
		padding: 0.3rem 0.6rem;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text, #eee);
		background: transparent;
		border: 1px solid var(--line);
		cursor: pointer;
	}
	.minimal .share-vibe-btn:hover:not(:disabled) {
		border-color: var(--accent, #e85d04);
		color: var(--accent, #e85d04);
	}
	.minimal .share-vibe-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.minimal .rec-card {
		padding: 1.15rem 0;
	}
	.minimal .rec-card + .rec-card {
		border-top: 1px solid var(--line);
	}

	.minimal .vibe-form {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
	}

	.minimal .field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.minimal .field-label {
		font-size: 0.72rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	.minimal .optional {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		opacity: 0.85;
	}

	.minimal .field-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
	}

	.minimal .advanced-toggle {
		appearance: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.65rem 0.85rem;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
	}
	.minimal .advanced-toggle:hover {
		color: var(--text);
		border-color: rgba(160, 140, 240, 0.45);
		background: rgba(255, 255, 255, 0.03);
	}
	.minimal .advanced-toggle:focus-visible {
		outline: 2px solid rgba(160, 140, 240, 0.7);
		outline-offset: 2px;
	}
	.minimal .advanced-toggle-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.2rem;
		height: 1.2rem;
		padding: 0 0.3rem;
		font-size: 0.65rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
		text-transform: none;
		color: #0e0e12;
		background: var(--accent);
		border-radius: 999px;
	}
	.minimal .advanced-toggle-chevron {
		margin-left: auto;
		font-size: 0.62rem;
		opacity: 0.7;
	}
	.minimal .advanced-fields {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
	}

	.minimal .weight-label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.minimal .weight-value {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.minimal .weight-slider-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.6rem;
		align-items: center;
	}

	.minimal .weight-end {
		font-size: 0.62rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		white-space: nowrap;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	.minimal .weight-slider {
		width: 100%;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.minimal .weight-slider:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.minimal .region-field :global(.region-select) {
		width: 100%;
	}

	.minimal .zflix-switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		cursor: pointer;
	}
	.minimal .zflix-switch-copy {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.minimal .zflix-switch-copy .field-hint {
		margin: 0;
	}
	.minimal .zflix-switch {
		appearance: none;
		flex-shrink: 0;
		width: 2.75rem;
		height: 1.5rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--panel);
		cursor: pointer;
		position: relative;
		transition: background 0.18s ease, border-color 0.18s ease;
	}
	.minimal .zflix-switch.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.minimal .zflix-switch:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.minimal .zflix-switch:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}
	.minimal .zflix-switch-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: calc(1.5rem - 6px);
		height: calc(1.5rem - 6px);
		background: var(--muted);
		border-radius: 999px;
		transition: transform 0.18s ease, background 0.18s ease;
	}
	.minimal .zflix-switch.on .zflix-switch-thumb {
		transform: translateX(1.25rem);
		background: #0e0e12;
	}

	.minimal .segment {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0;
		border: 1px solid var(--line);
		border-radius: 8px;
		overflow: hidden;
		background: var(--panel);
	}

	.minimal .segment-btn {
		appearance: none;
		border: none;
		border-right: 1px solid var(--line);
		cursor: pointer;
		border-radius: 0;
		padding: 0.55rem 0.15rem;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 400;
		color: var(--muted);
		background: transparent;
	}
	.minimal .segment-btn:last-child {
		border-right: none;
	}
	.minimal .segment-btn:hover:not(:disabled):not(.active) {
		color: var(--ink);
		background: rgba(255, 255, 255, 0.04);
	}
	.minimal .segment-btn.active {
		color: #0e0e12;
		background: #f3f4f6;
		font-weight: 600;
	}
	.minimal .segment-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.minimal .format-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.minimal .format-pill {
		appearance: none;
		border: 1px solid var(--line);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		line-height: 1.2;
	}
	.minimal .format-pill:hover:not(:disabled):not(.active) {
		color: var(--ink);
		border-color: rgba(160, 140, 240, 0.45);
	}
	.minimal .format-pill.active {
		color: #0e0e12;
		background: #f3f4f6;
		border-color: #f3f4f6;
		font-weight: 600;
	}
	.minimal .format-pill:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.minimal .format-pill.full-vibe-pill {
		border-color: rgba(160, 140, 240, 0.55);
		box-shadow: 0 0 16px rgba(124, 108, 240, 0.25);
	}
	.minimal .format-pill.full-vibe-pill.active {
		background: rgba(124, 108, 240, 0.85);
		border-color: transparent;
		color: #fff;
	}
	.minimal .vibe-pack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}
	.minimal .vibe-pack-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}
	.minimal .vibe-slot {
		border-bottom: 1px solid var(--line);
		padding-bottom: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}
	.minimal .vibe-slot-label {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #c4b5fd;
	}
	.minimal .vibe-slot-cover {
		width: 100%;
		max-width: 8rem;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border-radius: 8px;
		background: #222;
	}
	.minimal .vibe-slot-cover-sq {
		aspect-ratio: 1 / 1;
	}
	.minimal .vibe-slot-title {
		margin: 0;
		font-size: 0.95rem;
	}
	.minimal .vibe-slot-pitch {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
		line-height: 1.4;
	}
	@media (max-width: 900px) {
		.minimal .vibe-pack-grid {
			grid-template-columns: 1fr;
		}
	}

	.minimal .maturity-segment {
		grid-template-columns: repeat(4, 1fr);
	}
	.minimal .maturity-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.12rem;
		padding: 0.48rem 0.12rem 0.52rem;
		line-height: 1.15;
	}
	.minimal .maturity-label {
		font-size: 0.72rem;
		font-weight: inherit;
	}
	.minimal .maturity-certs {
		font-size: 0.6rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		opacity: 0.65;
		white-space: nowrap;
	}
	.minimal .maturity-btn.active .maturity-certs {
		opacity: 0.9;
	}

	.minimal .price-segment {
		grid-template-columns: repeat(5, 1fr);
	}

	@media (max-width: 640px) {
		.minimal .format-pill {
			font-size: 0.72rem;
			padding: 0.35rem 0.75rem;
		}
	}

	@media (max-width: 560px) {
		.minimal
			.segment:not(.format-segment):not(.decade-segment):not(.maturity-segment):not(
				.price-segment
			) {
			grid-template-columns: repeat(2, 1fr);
		}
		.minimal
			.segment:not(.format-segment):not(.decade-segment):not(.maturity-segment):not(
				.price-segment
			)
			.segment-btn:nth-child(2n) {
			border-right: none;
		}
		.minimal
			.segment:not(.format-segment):not(.decade-segment):not(.maturity-segment):not(
				.price-segment
			)
			.segment-btn:nth-child(-n + 2) {
			border-bottom: 1px solid var(--line);
		}

		.minimal .price-segment {
			grid-template-columns: repeat(3, 1fr);
		}
		.minimal .price-segment .segment-btn {
			border-right: 1px solid var(--line);
			border-bottom: 1px solid var(--line);
		}
		.minimal .price-segment .segment-btn:nth-child(3n) {
			border-right: none;
		}
		.minimal .price-segment .segment-btn:nth-child(n + 4) {
			border-bottom: none;
		}
	}

	.minimal .decade-segment {
		grid-template-columns: repeat(6, 1fr);
	}
	@media (max-width: 560px) {
		.minimal .decade-segment {
			grid-template-columns: repeat(3, 1fr);
		}
		.minimal .decade-segment .segment-btn {
			border-right: 1px solid var(--line);
			border-bottom: 1px solid var(--line);
		}
		.minimal .decade-segment .segment-btn:nth-child(3n) {
			border-right: none;
		}
		.minimal .decade-segment .segment-btn:nth-child(n + 4) {
			border-bottom: none;
		}
	}

	.minimal .rec-title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.5rem;
		margin: 0 0 0.35rem;
	}
	.minimal .rec-title-row .rec-title {
		margin: 0;
		flex: 1 1 10rem;
		min-width: 0;
	}
	.minimal .rec-title-row .save-btn {
		margin-left: auto;
		flex-shrink: 0;
	}
	.minimal .age-badge {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		padding: 0.14rem 0.42rem;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--ink);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.minimal .media-preview.audio-preview {
		display: block;
		width: 100%;
		max-width: 280px;
		height: 32px;
		margin-top: 0.85rem;
	}
	.minimal .trailer-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
		width: 100%;
		max-width: 320px;
		margin-top: 0.85rem;
	}
	.minimal .media-preview.trailer-frame {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: #000;
	}
	.minimal .preview-btn {
		appearance: none;
		cursor: pointer;
		margin-top: 0.85rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 8px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
	}
	.minimal .preview-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.minimal .preview-btn.preview-close {
		margin-top: 0;
	}

	.minimal .genre-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem 1rem;
		max-height: 8rem;
		overflow-y: auto;
		padding: 0.1rem 0;
		scrollbar-width: thin;
		scrollbar-color: var(--muted) transparent;
	}

	.minimal .genre-toggle {
		appearance: none;
		border: none;
		cursor: pointer;
		border-radius: 0;
		padding: 0.3rem 0;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 400;
		color: var(--muted);
		background: transparent;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border-bottom: 1px solid transparent;
	}
	.minimal .genre-toggle:hover:not(:disabled):not(.active) {
		color: var(--ink);
	}
	.minimal .genre-toggle.active {
		color: var(--ink);
		font-weight: 600;
		border-bottom-color: var(--accent);
	}
	.minimal .genre-toggle:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.minimal .genre-mark {
		width: 0.7rem;
		height: 0.7rem;
		border: 1px solid var(--muted);
		border-radius: 0;
		box-sizing: border-box;
		flex-shrink: 0;
		background: transparent;
		position: relative;
	}
	.minimal .genre-toggle.active .genre-mark {
		border-color: var(--accent);
		background: var(--accent);
	}
	.minimal .genre-toggle.active .genre-mark::after {
		content: '';
		position: absolute;
		left: 0.14rem;
		top: 0.02rem;
		width: 0.16rem;
		height: 0.32rem;
		border: solid #fff;
		border-width: 0 1.5px 1.5px 0;
		transform: rotate(45deg);
	}

	.minimal .vibe-input {
		width: 100%;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--panel);
		color: var(--ink);
		padding: 0.72rem 0.9rem;
		font: inherit;
		font-size: 0.95rem;
		outline: none;
		box-sizing: border-box;
		resize: none;
		line-height: 1.55;
	}
	.minimal .vibe-input::placeholder {
		color: var(--muted);
		opacity: 0.7;
	}
	.minimal .vibe-input:focus {
		border-color: rgba(160, 140, 240, 0.9);
		box-shadow: 0 0 0 1px rgba(140, 120, 220, 0.25);
		outline: none;
	}
	.minimal .vibe-input:disabled {
		opacity: 0.5;
	}

	.minimal .cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.35rem;
		align-items: stretch;
		align-self: stretch;
	}
	.minimal .cta {
		appearance: none;
		border: none;
		cursor: pointer;
		border-radius: 8px;
		padding: 0.85rem 1.15rem;
		font: inherit;
		font-weight: 600;
		font-size: 0.9rem;
		letter-spacing: 0.01em;
		color: #0e0e12;
		background: #f3f4f6;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0;
		flex: 1 1 auto;
		min-width: 8rem;
	}
	.minimal .cta:hover:not(:disabled) {
		background: #fff;
	}
	.minimal .cta:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.minimal .cta-surprise {
		flex: 0 1 auto;
		color: var(--muted);
		background: transparent;
		border: 1px solid var(--line);
	}
	.minimal .cta-surprise:hover:not(:disabled) {
		color: var(--ink);
		border-color: rgba(160, 140, 240, 0.55);
		background: rgba(255, 255, 255, 0.04);
	}
	.minimal .save-btn {
		appearance: none;
		margin-left: auto;
		border: 1px solid rgba(160, 140, 240, 0.55);
		background: rgba(160, 140, 240, 0.18);
		color: var(--ink);
		cursor: pointer;
		border-radius: 8px;
		padding: 0.28rem 0.65rem;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1.2;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.minimal .save-btn:hover {
		color: var(--ink);
		border-color: rgba(160, 140, 240, 0.85);
		background: rgba(160, 140, 240, 0.28);
	}
	.minimal .save-btn.saved {
		color: #c4b5fd;
		border-color: rgba(160, 140, 240, 0.55);
		background: transparent;
	}
	.minimal .lang-select {
		width: 100%;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.03);
		color: var(--ink);
		font: inherit;
		font-size: 0.9rem;
		padding: 0.5rem 0.6rem;
		border-radius: 8px;
		appearance: auto;
	}
	.minimal .lang-select:focus {
		outline: 1px solid rgba(160, 140, 240, 0.55);
		outline-offset: 1px;
	}
	.minimal .aura-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
	}

	.minimal .spinner {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		border: 2px solid rgba(14, 14, 18, 0.25);
		border-top-color: #0e0e12;
		animation: spin 0.7s linear infinite;
	}

	.minimal .err {
		margin: 1rem 0 0;
		color: #f87171;
		font-size: 0.85rem;
	}

	.minimal .empty-state {
		margin: 0;
		font-size: 0.95rem;
		color: var(--muted);
		text-align: left;
	}

	.minimal .board-soon-card {
		margin: 0;
		padding: 1rem 0.15rem;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.minimal .board-soon-eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.minimal .board-soon-title {
		margin: 0 0 0.45rem;
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.minimal .board-soon-body {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--muted);
		max-width: 36rem;
	}

	.minimal .vibe-miss-card {
		margin: 0;
		padding: 1rem 1rem 1.1rem;
		border: 2px solid #111;
		border-left: 6px solid #ff4c00;
		background: #16161c;
		box-shadow: 4px 4px 0 #000;
	}
	.minimal .vibe-miss-code {
		margin: 0 0 0.9rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
		color: #f2f2f5;
	}
	.minimal .vibe-miss-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.minimal .vibe-miss-btn {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		padding: 0.55rem 0.8rem;
		min-height: 44px;
		border: 2px solid #111;
		background: #0e0e12;
		color: #f2f2f5;
		cursor: pointer;
	}
	.minimal .vibe-miss-btn.primary {
		background: #ff4c00;
		color: #fff;
		border-color: #111;
	}
	.minimal .vibe-miss-btn:hover {
		border-color: #ff4c00;
	}

	.minimal .loading-block {
		width: 100%;
		display: flex;
		justify-content: flex-start;
	}

	.minimal .loading-refresh {
		margin-bottom: 0.75rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid var(--line);
	}

	.minimal .rec-list-dimmed {
		opacity: 0.5;
		pointer-events: none;
	}

	.minimal .rec-skeleton {
		pointer-events: none;
	}

	.minimal .skel-cover {
		width: 110px;
		aspect-ratio: 2 / 3;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.08);
		animation: skel-pulse 1.2s ease-in-out infinite;
	}

	@media (min-width: 900px) {
		.minimal .skel-cover {
			width: 140px;
		}
	}

	.minimal .skel-copy {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.2rem;
	}

	.minimal .skel-line {
		height: 0.75rem;
		width: 88%;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		animation: skel-pulse 1.2s ease-in-out infinite;
	}

	.minimal .skel-line-sm {
		width: 26%;
		height: 0.55rem;
	}

	.minimal .skel-line-lg {
		width: 58%;
		height: 1.1rem;
	}

	.minimal .skel-line-md {
		width: 42%;
	}

	.minimal .rec-grid {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
		min-width: 0;
	}

	@media (min-width: 900px) {
		.minimal .rec-grid {
			grid-template-columns: 140px 1fr;
			gap: 1.5rem;
		}
	}

	@media (max-width: 560px) {
		.minimal .rec-grid {
			grid-template-columns: 1fr;
		}
	}

	.minimal .cover-wrap {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--line);
		width: 110px;
		background: var(--panel);
	}
	@media (min-width: 900px) {
		.minimal .cover-wrap {
			width: 140px;
		}
	}

	.minimal .cover {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.35s ease;
	}
	.minimal .cover.cover-in {
		opacity: 1;
	}
	.minimal .cover-skel {
		position: absolute;
		inset: 0;
		z-index: 1;
		box-sizing: border-box;
	}
	.minimal .cover.cover-square,
	.minimal .cover-fallback.cover-square {
		aspect-ratio: 1 / 1;
	}
	.minimal .cover-wrap.cover-square {
		width: 100px;
	}
	@media (min-width: 900px) {
		.minimal .cover-wrap.cover-square {
			width: 120px;
		}
	}

	.minimal .cover-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 2 / 3;
		padding: 0.65rem;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		text-align: center;
	}
	.minimal .cover-fallback-initials {
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		font-weight: 700;
		font-size: clamp(1.5rem, 3.5vw, 2.1rem);
		letter-spacing: -0.04em;
		line-height: 1;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 1px 10px rgba(0, 0, 0, 0.4);
		user-select: none;
	}

	.minimal .rec-label {
		margin: 0 0 0.3rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	.minimal .rec-title {
		font-weight: 700;
		font-size: clamp(1.35rem, 2.8vw, 1.85rem);
		letter-spacing: -0.03em;
		margin: 0 0 0.5rem;
		line-height: 1.15;
		color: var(--ink);
	}
	.minimal .rec-artist {
		margin: -0.25rem 0 0.5rem;
		font-size: 0.95rem;
		color: var(--muted);
	}

	.minimal .meta-line {
		margin: 0.1rem 0 0.35rem;
		font-size: 0.78rem;
		line-height: 1.45;
		letter-spacing: 0.01em;
		color: var(--muted);
		max-width: 100%;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.minimal .score-breakdown {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 0.45rem 0.55rem;
		margin: 0.2rem 0 0.45rem;
	}
	.minimal .metascore {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.22rem 0.45rem 0.22rem 0.22rem;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		line-height: 1;
	}
	.minimal .metascore-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.75rem;
		height: 1.75rem;
		padding: 0 0.2rem;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #fff;
		background: #3a3a42;
	}
	.minimal .metascore-high .metascore-num {
		background: #3d8b52;
	}
	.minimal .metascore-mid .metascore-num {
		background: #c4921a;
	}
	.minimal .metascore-low .metascore-num {
		background: #b04444;
	}
	.minimal .metascore-label,
	.minimal .userscore-label {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.minimal .userscore {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.22rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		line-height: 1;
	}
	.minimal .userscore-num {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}

	.minimal .genre-line {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		line-height: 1.3;
		letter-spacing: 0.01em;
		color: var(--muted);
	}

	.minimal .rec-pitch {
		margin: 0.75rem 0 0;
		line-height: 1.6;
		color: var(--ink);
		font-size: 0.95rem;
	}

	.minimal .where-watch {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.7rem;
		margin-top: 1.35rem;
	}
	.minimal .watch-heading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.minimal .watch-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.minimal .watch-region {
		font-size: 0.7rem;
		color: var(--muted);
	}
	.minimal .watch-label-link {
		text-decoration: none;
		color: var(--muted);
	}
	.minimal .watch-label-link:hover {
		color: var(--accent);
	}
	.minimal .provider-groups {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		width: 100%;
	}
	.minimal .provider-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
	}
	.minimal .provider-category {
		font-size: 0.68rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink);
	}
	.minimal .provider-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.minimal .provider-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		padding: 0;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: var(--panel);
		overflow: hidden;
		text-decoration: none;
	}
	.minimal a.provider-btn:hover {
		border-color: var(--accent);
	}
	.minimal .provider-logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.minimal .provider-fallback {
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--ink);
		text-transform: uppercase;
	}
	.minimal .provider-btn.provider-text {
		width: auto;
		height: auto;
		padding: 0.4rem 0.65rem;
	}
	.minimal .provider-btn.provider-text .provider-fallback {
		font-size: 0.72rem;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
	}
	.minimal .zflix-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.95rem;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 8px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		letter-spacing: 0.01em;
		text-decoration: none;
	}
	.minimal .zflix-cta:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.minimal .amazon-cta {
		gap: 0.4rem;
	}
	.minimal .game-platform-line {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.minimal .game-store-sep {
		width: 100%;
		margin: 0.15rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.18);
	}
	.minimal .game-cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}

	/* sticky save fab — hard to miss on purpose */
	.save-fab {
		position: fixed;
		right: 1rem;
		bottom: 3.25rem; /* sit above the desktop taskbar */
		z-index: 70;
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		max-width: min(20rem, calc(100vw - 2rem));
		padding: 0.7rem 1rem;
		border: 2px solid #1a1a1a;
		background: #ff4c00;
		color: #fff;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		cursor: pointer;
		box-shadow: 4px 4px 0 #1a1a1a;
		text-align: left;
	}
	.save-fab:hover {
		filter: brightness(1.06);
	}
	.save-fab.saved {
		background: #fff;
		color: #ff4c00;
	}
	.save-fab-icon {
		font-size: 1.35rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.save-fab-copy {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.save-fab-label {
		text-transform: uppercase;
		line-height: 1.1;
	}
	.save-fab-title {
		font-weight: 500;
		font-size: 0.68rem;
		opacity: 0.9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 14rem;
	}
	.save-fab.minimal-fab {
		bottom: 1.15rem;
		border: 1px solid rgba(160, 140, 240, 0.65);
		background: #7c6cf0;
		color: #fff;
		border-radius: 999px;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
	}
	.save-fab.minimal-fab.saved {
		background: #16161c;
		color: #c4b5fd;
	}
	@media (max-width: 640px) {
		.save-fab {
			left: 1rem;
			right: 1rem;
			max-width: none;
			justify-content: center;
		}
		.save-fab-title {
			max-width: 60vw;
		}
	}

	@media (max-width: 1023px) {
		/* bumping up the provider icon sizes so users don't fat-finger the wrong streaming service on their phone */
		.desktop .provider-btn:not(.provider-text),
		.minimal .provider-btn:not(.provider-text) {
			width: 2.75rem;
			height: 2.75rem;
			border-radius: 0.5rem;
		}
		.desktop .provider-row,
		.minimal .provider-row {
			gap: 0.5rem;
		}

		/* adding generous touch padding to all buttons so they meet mobile ergonomics standards */
		.desktop .save-btn,
		.minimal .save-btn,
		.desktop .preview-btn,
		.minimal .preview-btn,
		.desktop .zflix-cta,
		.minimal .zflix-cta,
		.desktop .share-vibe-btn,
		.minimal .share-vibe-btn,
		.desktop .vibe-miss-btn,
		.minimal .vibe-miss-btn,
		.watch-cta {
			min-height: 44px;
			padding: 0.625rem 1rem;
			box-sizing: border-box;
		}
		.desktop .provider-btn.provider-text,
		.minimal .provider-btn.provider-text {
			min-height: 44px;
			padding: 0.625rem 1rem;
		}

		/* adding bottom offset so action buttons float cleanly above the mobile nav bar */
		.save-fab,
		.save-fab.minimal-fab {
			bottom: calc(80px + 1.25rem + env(safe-area-inset-bottom, 0px));
			min-height: 48px;
			padding: 0.85rem 1.15rem;
			font-size: 0.9rem;
			font-weight: 800;
			letter-spacing: 0.02em;
		}
		.save-fab-label {
			font-size: 0.82rem;
			letter-spacing: 0.06em;
		}
		.save-fab-title {
			font-size: 0.75rem;
		}
		.save-fab.save-fab-mobile-hide {
			display: none;
		}
		.desktop .result-body,
		.minimal .min-result {
			padding-bottom: 5.5rem;
		}
		.desktop .rec-title-row,
		.minimal .rec-title-row {
			align-items: center;
		}
	}

	.share-toast {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		left: auto;
		z-index: 80;
		padding: 0.65rem 0.95rem 0.65rem 0.85rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.35;
		color: #111;
		background: #fff;
		border: 2px solid #111;
		border-left: 6px solid #ff4c00;
		box-shadow: 4px 4px 0 #111;
		pointer-events: none;
		max-width: min(22rem, calc(100vw - 2rem));
	}

	@media (max-width: 1023px) {
		.share-toast {
			left: 50%;
			right: auto;
			transform: translateX(-50%);
			bottom: calc(80px + env(safe-area-inset-bottom, 0px) + 0.75rem);
		}
	}

	:global(html[data-ui='minimal']) .share-toast {
		color: #f2f2f5;
		background: #111118;
		border-color: #111;
		border-left-color: #ff4c00;
		box-shadow: 4px 4px 0 #000;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes brand-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes skel-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
	}

	.auth-controls {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}
	.auth-avatar {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		object-fit: cover;
	}
	.auth-name {
		font-size: 0.75rem;
		color: #9ca3af;
		max-width: 7rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.auth-btn {
		border: 1px solid #333;
		background: #16161c;
		color: #f3f4f6;
		border-radius: 8px;
		padding: 0.35rem 0.65rem;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.auth-btn:hover {
		border-color: #ff4c00;
	}
	/* bulletproofing the center alignment so it actually floats in the middle */
	.login-prompt-backdrop {
		background: rgba(26, 26, 26, 0.55);
		align-items: center;
		justify-content: center;
		inset: 0;
		width: 100%;
		min-height: 100dvh;
		height: 100dvh;
		overscroll-behavior: none;
	}
	.login-prompt-backdrop.minimal-backdrop {
		background: rgba(8, 8, 12, 0.72);
	}
	.term-modal {
		height: fit-content;
		min-height: 0;
		max-height: 85vh;
		width: 100%;
		max-width: 28rem;
		flex: none;
		align-self: center;
		overflow-y: auto;
	}
	.sheet-handle {
		width: 2.5rem;
		height: 0.28rem;
		border-radius: 999px;
		background: #9ca3af;
		margin: 0.7rem auto 0.35rem;
	}

	@media (max-width: 1023px) {
		.login-prompt-backdrop:not(.auth-modal-backdrop) {
			align-items: flex-end;
			justify-content: stretch;
			padding: 0;
		}
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-modal {
			max-width: none;
			width: 100%;
			align-self: stretch;
			margin-top: auto;
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;
			max-height: min(88vh, 100%);
		}
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-modal.modal-desktop,
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-modal.modal-minimal {
			border-radius: 1.5rem 1.5rem 0 0;
		}
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-titlebar {
			display: none;
		}
	}
	.auth-modal-backdrop {
		position: fixed !important;
		inset: 0 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		width: 100vw;
		height: 100dvh;
		margin: 0;
		padding: 1rem;
		z-index: 200;
	}
	.auth-modal-backdrop .term-modal {
		margin: auto !important;
		align-self: center !important;
		position: relative !important;
		inset: auto !important;
		top: auto !important;
		left: auto !important;
		right: auto !important;
		bottom: auto !important;
		width: min(28rem, calc(100vw - 2rem));
		max-width: 28rem;
	}
	/* swapping to rounded corners and sans-serif if the user is on the modern theme */
	.term-modal.modal-desktop {
		min-height: 0;
		background: #ffffff;
		border: 2px solid #111111;
		border-radius: 0;
		color: #111111;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		box-shadow: 4px 4px 0 #111111;
	}
	.term-modal.modal-minimal {
		min-height: 0;
		background: #16161c;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		color: #f3f4f6;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.55);
	}
	.term-titlebar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		height: 28px;
		padding: 0 0.55rem;
		background: #1a1a1a;
		color: #f5f5f5;
		font-size: 0.72rem;
	}

	@media (max-width: 1023px) {
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-modal.modal-desktop,
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-modal.modal-minimal {
			border-radius: 1.5rem 1.5rem 0 0;
		}
		.login-prompt-backdrop:not(.auth-modal-backdrop) .term-titlebar {
			display: none;
		}
	}
	.term-titlebar .traffic {
		display: flex;
		align-items: center;
		gap: 0.28rem;
		flex-shrink: 0;
	}
	.term-titlebar .dot {
		width: 9px;
		height: 9px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.35);
		appearance: none;
		display: inline-block;
	}
	.term-titlebar button.dot {
		cursor: pointer;
	}
	.term-titlebar .dot.red {
		background: #ff5f57;
	}
	.term-titlebar .dot.yellow {
		background: #febc2e;
	}
	.term-titlebar .dot.green {
		background: #28c840;
	}
	.term-titlebar .titlebar-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}
	.term-titlebar .titlebar-tag {
		flex-shrink: 0;
		padding: 0.1rem 0.35rem;
		background: #ff4c00;
		color: #fff;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1.2;
	}
	.term-modal.modal-desktop .term-modal-body {
		padding: 1.1rem 1.15rem 1.2rem;
		background: #ffffff;
	}
	.term-modal.modal-minimal .term-modal-body {
		padding: 1.35rem 1.4rem 1.45rem;
		background: #16161c;
	}
	.term-modal.modal-desktop h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #111;
	}
	.term-modal.modal-minimal h2 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: #f3f4f6;
	}
	.term-modal.modal-desktop p {
		margin: 0 0 0.95rem;
		color: #666;
		font-size: 0.8rem;
		line-height: 1.45;
	}
	.term-modal.modal-minimal p {
		margin: 0 0 1.1rem;
		color: #9ca3af;
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.login-prompt-actions {
		display: grid;
		gap: 0.5rem;
	}
	.term-btn {
		appearance: none;
		cursor: pointer;
	}
	.term-modal.modal-desktop .term-btn {
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		padding: 0.45rem 0.7rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.term-modal.modal-minimal .term-btn {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.06);
		color: #f3f4f6;
		padding: 0.65rem 0.85rem;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		text-transform: none;
	}
	.term-modal.modal-desktop .term-btn:hover:not(:disabled) {
		border-color: #ff4c00;
		color: #ff4c00;
	}
	.term-modal.modal-minimal .term-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn:focus-visible {
		outline: 2px solid #8b7cf7;
		outline-offset: 2px;
	}
	.term-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.term-modal.modal-desktop .term-btn.primary {
		background: #111;
		color: #fff;
	}
	.term-modal.modal-desktop .term-btn.primary:hover:not(:disabled) {
		background: #ff4c00;
		border-color: #111;
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn.primary {
		background: #f3f4f6;
		border-color: transparent;
		color: #0e0e12;
	}
	.term-modal.modal-minimal .term-btn.primary:hover:not(:disabled) {
		background: #fff;
		border-color: transparent;
		color: #0e0e12;
	}
	.term-modal.modal-desktop .term-btn.discord {
		background: #5865f2;
		border-color: #111;
		color: #fff;
	}
	.term-modal.modal-desktop .term-btn.discord:hover:not(:disabled) {
		background: #4752c4;
		border-color: #111;
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn.discord {
		background: #5865f2;
		border-color: transparent;
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn.discord:hover:not(:disabled) {
		background: #4752c4;
		border-color: transparent;
		color: #fff;
	}
	.term-btn.already {
		opacity: 0.5;
	}
	.login-cred-form {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.1rem;
	}
	.term-modal.modal-desktop .login-cred-form input,
	.term-modal.modal-desktop .playlist-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem 0.6rem;
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.8rem;
		box-shadow: none;
	}
	.term-modal.modal-minimal .login-cred-form input,
	.term-modal.modal-minimal .playlist-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.06);
		color: #f3f4f6;
		font-family: inherit;
		font-size: 0.875rem;
		box-shadow: none;
	}
	.term-modal.modal-desktop .login-cred-form input:focus,
	.term-modal.modal-desktop .playlist-input:focus {
		outline: none;
		border-color: #111;
		box-shadow: 2px 2px 0 #ff4c00;
	}
	.term-modal.modal-minimal .login-cred-form input:focus,
	.term-modal.modal-minimal .playlist-input:focus {
		outline: none;
		border-color: rgba(139, 124, 247, 0.65);
		box-shadow: 0 0 0 3px rgba(139, 124, 247, 0.25);
	}
	.term-modal.modal-desktop .auth-link {
		color: #666;
		font-size: 0.72rem;
		text-decoration: none;
		text-align: center;
		padding: 0.25rem 0;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: none;
		border: 0;
		cursor: pointer;
		width: 100%;
	}
	.term-modal.modal-desktop .auth-link:hover {
		color: #ff4c00;
	}
	/* Desktop Dark — must come after light modal rules so overrides stick */
	.term-modal.modal-desktop.modal-desk-dark {
		background: #080a0e;
		border-color: #2a2f38;
		color: #e8eaed;
		box-shadow: 4px 4px 0 #2a2f38;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-titlebar {
		background: #050608;
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-modal-body {
		background: #080a0e;
	}
	.term-modal.modal-desktop.modal-desk-dark h2 {
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark p {
		color: #8b929e;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn {
		border-color: #2a2f38;
		background: #0c0f14;
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn:hover:not(:disabled) {
		border-color: #ff4c00;
		color: #ff4c00;
		background: #141820;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.primary {
		background: #e8eaed;
		border-color: #e8eaed;
		color: #080a0e;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.primary:hover:not(:disabled) {
		background: #ff4c00;
		border-color: #ff4c00;
		color: #fff;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.discord {
		background: #5865f2;
		border-color: #5865f2;
		color: #fff;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.discord:hover:not(:disabled) {
		background: #4752c4;
		border-color: #4752c4;
		color: #fff;
	}
	.term-modal.modal-desktop.modal-desk-dark .login-cred-form input,
	.term-modal.modal-desktop.modal-desk-dark .playlist-input {
		border-color: #2a2f38;
		background: #0c0f14;
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark .login-cred-form input::placeholder,
	.term-modal.modal-desktop.modal-desk-dark .playlist-input::placeholder {
		color: #8b929e;
	}
	.term-modal.modal-desktop.modal-desk-dark .login-cred-form input:focus,
	.term-modal.modal-desktop.modal-desk-dark .playlist-input:focus {
		border-color: #ff4c00;
		box-shadow: 2px 2px 0 #ff4c00;
	}
	.term-modal.modal-desktop.modal-desk-dark .auth-link {
		color: #8b929e;
	}
	.term-modal.modal-desktop.modal-desk-dark .auth-link:hover {
		color: #ff4c00;
	}
	.term-modal.modal-minimal .auth-link {
		color: #9ca3af;
		font-size: 0.85rem;
		text-decoration: none;
		text-align: center;
		padding: 0.25rem 0;
		font-family: inherit;
		background: none;
		border: 0;
		cursor: pointer;
		width: 100%;
	}
	.term-modal.modal-minimal .auth-link:hover {
		color: #8b7cf7;
	}
	.auth-modal-err {
		margin: 0;
		padding: 0.45rem 0.5rem;
		border: 1px solid #7f1d1d;
		background: #1a0a0a;
		color: #fca5a5;
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.playlist-create {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		margin: 0 0 0.85rem;
	}
	.playlist-input {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		padding: 0.4rem 0.55rem;
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		font: inherit;
		font-size: 0.75rem;
	}
	.minimal .playlist-input {
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.06);
		color: #f3f4f6;
		border-radius: 6px;
	}
	.playlist-group {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-bottom: 1.1rem;
		padding-bottom: 0.85rem;
		border-bottom: 2px solid #111;
	}
	.minimal .playlist-group {
		border-bottom-color: rgba(255, 255, 255, 0.12);
	}
	.playlist-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.playlist-title {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.playlist-count {
		font-size: 0.65rem;
		font-weight: 700;
		color: #666;
	}
	.minimal .playlist-count {
		color: #9ca3af;
	}
	.playlist-empty {
		margin: 0;
		font-size: 0.8rem;
	}
	.picker-create {
		margin-top: 0.35rem;
		flex-direction: column;
		align-items: stretch;
	}

	@media (prefers-reduced-motion: reduce) {
		.desktop .brand,
		.minimal .min-brand {
			animation: none;
		}
		.desktop .spinner,
		.minimal .spinner {
			animation: none;
		}
		.desktop .skel-cover,
		.desktop .skel-line,
		.minimal .skel-cover,
		.minimal .skel-line {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
