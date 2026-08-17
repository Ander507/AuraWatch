<script lang="ts">
	import { slide, fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import RegionSelect from '$lib/components/RegionSelect.svelte';
	import LikeTitleSelect from '$lib/components/LikeTitleSelect.svelte';
	import PlatformSelect from '$lib/components/PlatformSelect.svelte';
	import { detectRegionFromLocale, normalizeRegion } from '$lib/regions';
	import {
		CONTENT_LANGUAGES,
		DEFAULT_LANGUAGE,
		normalizeLanguage
	} from '$lib/languages';
	import { buildVibeSearchParams } from '$lib/vibeUrl';
	import { rollSurpriseMe } from '$lib/surpriseMe';
	import { BOARD_GAMES_COMING_SOON, BOARD_GAMES_SOON_COPY } from '$lib/boardGamesGate';
	import type { UiTheme } from '$lib/uiTheme.svelte';

	let { theme, startAdvanced = false }: { theme: UiTheme; startAdvanced?: boolean } = $props();

	const REGION_KEY = 'aurawatch_region';
	const LANG_KEY = 'aurawatch_language';
	const ZFLIX_KEY = 'aurawatch_zflix';
	const NOTES_WEIGHT_DEFAULT = 70;

	const FORMAT_OPTIONS = [
		{ id: 'movie' as const, label: 'Movies' },
		{ id: 'series' as const, label: 'TV Series' },
		{ id: 'anime' as const, label: 'Anime' },
		{ id: 'songs' as const, label: 'Songs' },
		{ id: 'games' as const, label: 'Games' },
		{ id: 'books' as const, label: 'Books & Manga' },
		{ id: 'boardgames' as const, label: 'Board Games' }
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
		{ id: '' as const, label: 'Any', mediaCerts: 'All' },
		{ id: 'family' as const, label: 'Family', mediaCerts: 'G · PG' },
		{ id: 'teen' as const, label: 'Teen', mediaCerts: '≤ PG-13' },
		{ id: 'mature' as const, label: 'Mature', mediaCerts: 'R · TV-MA' }
	];

	const PRICE_RANGE_OPTIONS = [
		{ id: '' as const, label: 'Any', hint: 'All prices' },
		{ id: 'free' as const, label: 'Free', hint: '$0' },
		{ id: 'under20' as const, label: '<$20', hint: 'Indie / Budget' },
		{ id: 'mid' as const, label: '$20–$45', hint: 'Mid-tier' },
		{ id: 'aaa' as const, label: '$50+', hint: 'AAA' }
	];

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
		]
	};

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
	let showAdvanced = $state(untrack(() => startAdvanced));
	let isLoading = $state(false);
	let errMsg = $state('');

	let isSongs = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'songs');
	let isGames = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'games');
	let isBooks = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'books');
	let isBoardGames = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'boardgames');
	let boardGamesSoon = $derived(isBoardGames && BOARD_GAMES_COMING_SOON);
	let isFullVibe = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'fullvibe');
	let isExclusiveLane = $derived(isSongs || isGames || isBooks || isBoardGames || isFullVibe);
	let isMediaLane = $derived(!isExclusiveLane);
	let showSeriesLength = $derived(selectedTypes.includes('series') && !isExclusiveLane);

	let visibleGenres = $derived.by(() => {
		if (isSongs) return GENRES_BY_FORMAT.songs;
		if (isGames) return GENRES_BY_FORMAT.games;
		if (isBooks) return GENRES_BY_FORMAT.books;
		if (isBoardGames) return GENRES_BY_FORMAT.boardgames;
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

	let activeAdvancedCount = $derived(
		(antiVibe.trim() ? 1 : 0) +
			(selectedDecade ? 1 : 0) +
			(notesWeight !== NOTES_WEIGHT_DEFAULT ? 1 : 0) +
			(zflixEnabled && isMediaLane ? 1 : 0) +
			(selectedMaturity && isMediaLane ? 1 : 0) +
			(selectedLanguage !== DEFAULT_LANGUAGE && isMediaLane ? 1 : 0)
	);

	onMount(() => {
		try {
			const saved = localStorage.getItem(REGION_KEY);
			if (saved) watchRegion = normalizeRegion(saved);
			else watchRegion = normalizeRegion(detectRegionFromLocale() || 'US');
		} catch {
			watchRegion = normalizeRegion(detectRegionFromLocale() || 'US');
		}
		try {
			const savedLang = localStorage.getItem(LANG_KEY);
			if (savedLang) selectedLanguage = normalizeLanguage(savedLang);
		} catch {
			/* shrug */
		}
		try {
			const savedZflix = localStorage.getItem(ZFLIX_KEY);
			if (savedZflix === '1' || savedZflix === 'true') zflixEnabled = true;
		} catch {
			/* shrug */
		}
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
		const exclusiveIds: FormatId[] = ['songs', 'games', 'books', 'boardgames'];
		const wasExclusive =
			exclusiveIds.includes(selectedTypes[0] as FormatId) && selectedTypes.length === 1;
		let next: FormatId[];
		if (exclusiveIds.includes(id)) next = [id];
		else if (wasExclusive) next = [id];
		else if (selectedTypes.includes(id)) next = selectedTypes.filter((t) => t !== id);
		else next = [...selectedTypes.filter((t) => t !== 'fullvibe'), id];

		selectedTypes = next;
		const nowExclusive = exclusiveIds.includes(next[0] as FormatId) && next.length === 1;
		const allowed =
			nowExclusive && next[0] !== 'fullvibe'
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

	function vibeQuery() {
		return buildVibeSearchParams({
			types: selectedTypes,
			genres: selectedGenres,
			vibe: vibePrompt,
			antiVibe,
			likes: likeTitles,
			decade: selectedDecade,
			maturity: selectedMaturity,
			priceRange: selectedPriceRange,
			seriesLength: selectedSeasonCount,
			platforms: selectedPlatforms,
			region: watchRegion,
			language: selectedLanguage,
			notesWeight
		}).toString();
	}

	async function goFindPicks() {
		const qs = vibeQuery();
		await goto(resolve(qs ? `/?${qs}` : '/'));
	}

	async function findMyVibe(e?: Event) {
		e?.preventDefault?.();
		errMsg = '';
		if (!canSubmit) {
			errMsg = 'pick a format, genres, a like-title, or add a note…';
			return;
		}
		if (boardGamesSoon) {
			errMsg = BOARD_GAMES_SOON_COPY.body;
			return;
		}
		isLoading = true;
		try {
			await goFindPicks();
		} catch {
			errMsg = 'could not open the matcher';
			isLoading = false;
		}
	}

	function onKeyDown(ev: KeyboardEvent) {
		if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
			void findMyVibe();
		}
	}

	async function surpriseMe() {
		if (boardGamesSoon) {
			errMsg = BOARD_GAMES_SOON_COPY.body;
			return;
		}
		const roll = rollSurpriseMe(selectedTypes);
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
</script>

<form class="vibe-form" onsubmit={findMyVibe}>
	<!-- adding bottom padding to the form so users can actually scroll down to the bottom inputs -->
	<div class="form-stack max-lg:pb-32">
	<div class="field">
		<span class="field-label" id="format-label">Format</span>
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
				variant={theme === 'desktop' ? 'desktop' : 'dark'}
				kind={isGames
					? 'games'
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
				variant={theme === 'desktop' ? 'desktop' : 'dark'}
			/>
			<p class="field-hint">Only suggest games natively on these platforms.</p>
		</div>
		<div class="field">
			<span class="field-label" id="price-range-label">Price range</span>
			<div class="segment price-segment" role="group" aria-labelledby="price-range-label">
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
				variant={theme === 'minimal' ? 'minimal' : 'desktop'}
			/>
			<p class="field-hint">Used for Where to Watch providers</p>
		</div>
	{/if}

	<div class="field">
		<label class="field-label" for="vibe">Notes <span class="optional">(optional)</span></label>
		<textarea
			id="vibe"
			class="vibe-input"
			bind:value={vibePrompt}
			onkeydown={onKeyDown}
			placeholder={isFullVibe
				? 'rainy sunday cozy, neon date night, slow morning…'
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
		<span class="advanced-toggle-chevron" aria-hidden="true">{showAdvanced ? '▲' : '▼'}</span>
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
					<div class="segment maturity-segment" role="group" aria-labelledby="maturity-label">
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
		<button class="cta" type="submit" disabled={isLoading || !canSubmit || boardGamesSoon}>
			{#if isLoading}
				<span class="spinner" aria-hidden="true"></span>
				{theme === 'minimal' ? 'Searching…' : 'searching…'}
			{:else if boardGamesSoon}
				{theme === 'minimal' ? 'Coming soon' : 'coming soon'}
			{:else if isSongs}
				{theme === 'minimal' ? 'Get song picks' : 'get song picks'}
			{:else if isGames}
				{theme === 'minimal' ? 'Get game picks' : 'get game picks'}
			{:else if isBoardGames}
				{theme === 'minimal' ? 'Get board game picks' : 'get board game picks'}
			{:else}
				{theme === 'minimal' ? 'Get picks' : 'get picks'}
			{/if}
		</button>
		<button
			type="button"
			class="cta cta-surprise"
			disabled={isLoading || boardGamesSoon}
			onclick={() => void surpriseMe()}
		>
			{theme === 'minimal' ? 'Surprise me' : 'surprise me'}
		</button>
	</div>
</form>

{#if errMsg}
	<p class="err" transition:fade={{ duration: 200 }}>{errMsg}</p>
{/if}
