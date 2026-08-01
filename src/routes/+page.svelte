<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { getZflixUrl } from '$lib/watchLinks';
	import { detectRegionFromLocale, normalizeRegion } from '$lib/regions';
	import { desktopCardEntrance } from '$lib/animations/desktop';
	import RegionSelect from '$lib/components/RegionSelect.svelte';
	import LikeTitleSelect from '$lib/components/LikeTitleSelect.svelte';
	import DesktopLoading from '$lib/components/DesktopLoading.svelte';

	const REGION_KEY = 'aurawatch_region';
	const UI_KEY = 'aurawatch_ui';

	type UiTheme = 'desktop' | 'minimal';

	const FORMAT_OPTIONS = [
		{ id: 'movie' as const, label: 'Movies' },
		{ id: 'series' as const, label: 'TV Series' },
		{ id: 'anime' as const, label: 'Anime' },
		{ id: 'songs' as const, label: 'Songs' }
	];

	const DECADE_OPTIONS = [
		{ id: '' as const, label: 'Any' },
		{ id: '1980s' as const, label: '1980s' },
		{ id: '1990s' as const, label: '1990s' },
		{ id: '2000s' as const, label: '2000s' },
		{ id: '2010s' as const, label: '2010s' },
		{ id: '2020s' as const, label: '2020s' }
	];

	type FormatId = (typeof FORMAT_OPTIONS)[number]['id'];

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

	const GENRES_BY_FORMAT: Record<FormatId, string[]> = {
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
		]
	};

	let uiTheme = $state<UiTheme>('desktop');
	let selectedTypes = $state<FormatId[]>([]);
	let selectedGenres = $state<string[]>([]);
	let vibePrompt = $state('');
	let likeTitles = $state<string[]>([]);
	const NOTES_WEIGHT_DEFAULT = 70;
	let notesWeight = $state(NOTES_WEIGHT_DEFAULT);
	let watchRegion = $state('US');
	let selectedDecade = $state('');
	let isLoading = $state(false);
	let errMsg = $state('');
	let clockLabel = $state('');
	let playingPreview = $state<string | null>(null); // unique key per card

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
		rating?: number;
		providers?: Provider[];
		region?: string;
		watchLink?: string | null;
		likeTitle?: string;
		likeTitles?: string[];
		coverFallbacks?: string[];
		coverBroken?: boolean;
		artist?: string;
		kind?: 'song' | 'media';
		listen_url?: string;
		preview_url?: string;
		trailer_youtube_key?: string;
	};

	// song mode — different search kind + square covers etc
	let isSongs = $derived(selectedTypes.length === 1 && selectedTypes[0] === 'songs');

	let results = $state<Rec[]>([]);

	let visibleGenres = $derived.by(() => {
		if (isSongs) return GENRES_BY_FORMAT.songs;
		if (!selectedTypes.length) return ALL_MEDIA_GENRES;
		const set = new Set<string>();
		for (const t of selectedTypes) {
			for (const g of GENRES_BY_FORMAT[t]) set.add(g);
		}
		return [...set];
	});

	let canSubmit = $derived(
		Boolean(vibePrompt.trim()) ||
			likeTitles.length > 0 ||
			selectedGenres.length > 0 ||
			selectedTypes.length > 0
	);

	let notesWeightLabel = $derived(
		notesWeight <= 35 ? 'Similar-to leads' : notesWeight <= 55 ? 'Balanced' : 'Notes lead'
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
		if (item.mediaType) parts.push(item.mediaType);
		if (item.seasonInfo) parts.push(item.seasonInfo);
		if (item.rating != null) parts.push(`★ ${formatRating(item.rating)}`);
		return parts.join(' · ');
	}

	function likeLabel(item: Rec): string {
		if (item.likeTitles?.length) return `like ${item.likeTitles.join(' · ')}`;
		if (item.likeTitle) return `like ${item.likeTitle}`;
		// fallback badge text when gemini forgot the refs lol
		return item.kind === 'song' || item.mediaType === 'Song' ? 'song picks' : "tonight's pick";
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

	// api sometimes sends kind, sometimes mediaType="Song" — either works
	function isSongRec(item: Rec): boolean {
		return item.kind === 'song' || item.mediaType === 'Song';
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
			const fallbacks = r.coverFallbacks?.length ? [...r.coverFallbacks] : [];
			if (fallbacks.length > 0) {
				const next = fallbacks.shift()!;
				return { ...r, cover: next, coverFallbacks: fallbacks, coverBroken: false };
			}
			return { ...r, coverBroken: true };
		});
	}

	function normalizeRec(raw: Record<string, any> | null | undefined): Rec {
		// song vs media — backend field names are a bit all over the place
		const kind = raw?.kind === 'song' || raw?.mediaType === 'Song' ? 'song' : 'media';
		return {
			title: raw?.title || '???',
			cover: raw?.cover || '',
			pitch: raw?.pitch || raw?.matchReason || '',
			genres: raw?.genres || raw?.actualGenres || [],
			mediaType: raw?.mediaType,
			seasonInfo:
				raw?.seasonInfo || (raw?.releaseYear ? String(raw.releaseYear) : undefined),
			rating: raw?.rating,
			providers: raw?.providers || [],
			region: raw?.region,
			watchLink: raw?.watch_link || raw?.watchLink || null,
			likeTitle: raw?.likeTitle || (likeTitles.length ? likeTitles.join(', ') : undefined),
			likeTitles: raw?.likeTitles || (likeTitles.length ? likeTitles : undefined),
			coverFallbacks: Array.isArray(raw?.coverFallbacks)
				? raw.coverFallbacks.filter(Boolean)
				: [],
			coverBroken: false,
			artist: raw?.artist,
			kind,
			// listen_url preferred; zflix_url was an older name, keep both just in case
			listen_url: raw?.listen_url || raw?.zflix_url,
			preview_url: raw?.preview_url || raw?.previewUrl || undefined,
			trailer_youtube_key: raw?.trailer_youtube_key || raw?.trailerYoutubeKey || undefined
		};
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

	function applyThemeToDocument(theme: UiTheme) {
		document.documentElement.dataset.ui = theme;
		document.body.style.background = theme === 'minimal' ? '#0E0E12' : '#7b8a9d';
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', theme === 'minimal' ? '#0E0E12' : '#7B8A9D');
	}

	function setUiTheme(theme: UiTheme) {
		uiTheme = theme;
		try {
			localStorage.setItem(UI_KEY, theme);
		} catch {
			/* shrug */
		}
		applyThemeToDocument(theme);
	}

	onMount(() => {
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
			const savedUi = localStorage.getItem(UI_KEY);
			if (savedUi === 'minimal' || savedUi === 'desktop') {
				uiTheme = savedUi;
			}
		} catch {
			/* shrug */
		}
		applyThemeToDocument(uiTheme);

		clockLabel = formatClock();
		const id = setInterval(() => {
			clockLabel = formatClock();
		}, 60_000);
		return () => clearInterval(id);
	});

	$effect(() => {
		const theme = uiTheme;
		if (typeof document === 'undefined') return;
		document.documentElement.dataset.ui = theme;
		document.body.style.background = theme === 'minimal' ? '#0E0E12' : '#7b8a9d';
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', theme === 'minimal' ? '#0E0E12' : '#7B8A9D');
	});

	function persistRegion() {
		try {
			localStorage.setItem(REGION_KEY, normalizeRegion(watchRegion));
		} catch {
			/* shrug */
		}
	}

	function toggleFormat(id: FormatId) {
		const wasSongs = selectedTypes.length === 1 && selectedTypes[0] === 'songs';
		let next: FormatId[];
		if (id === 'songs') next = ['songs'];
		else if (wasSongs) next = [id];
		else if (selectedTypes.includes(id)) next = selectedTypes.filter((t) => t !== id);
		else next = [...selectedTypes, id];

		selectedTypes = next;
		const nowSongs = next.length === 1 && next[0] === 'songs';
		const allowed = nowSongs
			? GENRES_BY_FORMAT.songs
			: next.length
				? [...new Set(next.flatMap((t) => GENRES_BY_FORMAT[t]))]
				: ALL_MEDIA_GENRES;
		selectedGenres = selectedGenres.filter((g) => allowed.includes(g));
		if (wasSongs !== nowSongs) likeTitles = [];
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

		isLoading = true;
		results = [];
		playingPreview = null;

		try {
			const res = await fetch('/api/recommend', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					types: selectedTypes,
					genres: selectedGenres,
					prompt: vibePrompt,
					likeTitles: likeTitles.length ? likeTitles : undefined,
					notesWeight,
					region: watchRegion,
					decade: selectedDecade || undefined
				})
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
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
		} catch (err: any) {
			console.log('oops', err);
			errMsg = err?.message || 'something went sideways';
		} finally {
			isLoading = false;
		}
	}

	function onKeyDown(ev: KeyboardEvent) {
		// ctrl/cmd+enter — muscle memory from chat apps
		if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
			findMyVibe();
		}
	}

	function formatRating(n: number) {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}
</script>

<svelte:head>
	<title>AuraWatch — picks that fit</title>
	<meta
		name="description"
		content="Pick a format and genres. Get movie, TV, anime, or song recommendations."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#snippet formFields()}
	<form class="vibe-form" onsubmit={findMyVibe}>
		<div class="field">
			<span class="field-label" id="format-label">Format</span>
			<div class="segment" role="group" aria-labelledby="format-label">
				{#each FORMAT_OPTIONS as opt (opt.id)}
					<button
						type="button"
						class="segment-btn"
						class:active={selectedTypes.includes(opt.id)}
						aria-pressed={selectedTypes.includes(opt.id)}
						onclick={() => toggleFormat(opt.id)}
						disabled={isLoading}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="field-label" id="genre-label">Genres</span>
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

		<div class="field">
			<label class="field-label" for="like-title">
				{isSongs ? 'Like these' : 'Like these titles'}
				<span class="optional">(optional)</span>
			</label>
			<LikeTitleSelect
				id="like-title"
				bind:values={likeTitles}
				disabled={isLoading}
				variant={uiTheme === 'desktop' ? 'desktop' : 'dark'}
				kind={isSongs ? 'music' : 'media'}
			/>
			<p class="field-hint">
				{isSongs
					? 'Add songs or artists — find tracks in the same vibe'
					: 'Add one or more — find something in the same vein'}
			</p>
		</div>

		<div class="field">
			<label class="field-label" for="vibe"
				>Notes <span class="optional">(optional)</span></label
			>
			<textarea
				id="vibe"
				class="vibe-input"
				bind:value={vibePrompt}
				onkeydown={onKeyDown}
				placeholder={isSongs
					? 'late night drive, soft vocals, no pop…'
					: 'or type “like Charlotte, sad ending…” here'}
				rows="3"
				disabled={isLoading}
			></textarea>
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

		{#if !isSongs}
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

		<button class="cta" type="submit" disabled={isLoading || !canSubmit}>
			{#if isLoading}
				<span class="spinner" aria-hidden="true"></span>
				{uiTheme === 'minimal' ? 'Searching…' : 'searching…'}
			{:else if isSongs}
				{uiTheme === 'minimal' ? 'Get song picks' : 'get song picks'}
			{:else}
				{uiTheme === 'minimal' ? 'Get picks' : 'get picks'}
			{/if}
		</button>
	</form>

	{#if errMsg}
		<p class="err" transition:fade={{ duration: 200 }}>{errMsg}</p>
	{/if}
{/snippet}

{#snippet resultContent()}
	{#if isLoading}
		<div class="loading-block" transition:fade={{ duration: 250 }}>
			<DesktopLoading
				hint={uiTheme === 'minimal' ? 'Searching…' : 'searching…'}
				variant={uiTheme}
			/>
		</div>
	{:else if results.length}
		<div
			class="rec-list"
			in:fly={{ y: uiTheme === 'desktop' ? 0 : 10, duration: uiTheme === 'desktop' ? 0 : 320, easing: quintOut }}
			out:fade={{ duration: 140 }}
		>
			<p class="rec-list-header">{results.length} picks</p>
			{#each results as item, i (item.title + String(i))}
				{@const genres = itemGenres(item)}
				{@const meta = itemMetaLine(item)}
				{@const song = isSongRec(item)}
				<article
					class="rec-card"
					{@attach uiTheme === 'desktop' && desktopCardEntrance(i)}
				>
					<div class="rec-grid">
						<div class="cover-wrap" class:cover-square={song}>
							{#if showCoverImg(item)}
								<img
									src={item.cover}
									alt={song
										? `${item.artist || ''} — ${item.title} album art`.trim()
										: `${item.title} cover`}
									class="cover"
									class:cover-square={song}
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
									onerror={() => onCoverError(i)}
								/>
							{:else}
								<div class="cover-fallback" class:cover-square={song} aria-hidden="true">
									<span class="cover-fallback-mark">AW</span>
									<span class="cover-fallback-brand">AuraWatch</span>
									<span class="cover-fallback-title">{item.title}</span>
								</div>
							{/if}
						</div>

						<div class="rec-copy">
							<p class="rec-label">{likeLabel(item)}</p>
							<h2 class="rec-title">{item.title}</h2>
							{#if song && item.artist}
								<p class="rec-artist">{item.artist}</p>
							{/if}

							{#if meta && !song}
								<p class="meta-line">{meta}</p>
							{:else if song && item.seasonInfo}
								<p class="meta-line">{item.seasonInfo}</p>
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
							{:else if !song && item.trailer_youtube_key}
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
											class="preview-btn preview-close"
											onclick={() => toggleTrailer(item, i)}
										>
											Close video
										</button>
									</div>
								{:else}
									<button
										type="button"
										class="preview-btn"
										onclick={() => toggleTrailer(item, i)}
									>
										{item.mediaType === 'YouTube' ? 'Play video' : 'Play trailer'}
									</button>
								{/if}
							{/if}

							<div class="where-watch">
								<div class="watch-heading">
									{#if item.watchLink && !song}
										<a
											class="watch-label watch-label-link"
											href={item.watchLink}
											target="_blank"
											rel="external noopener noreferrer"
										>
											Where to Watch
										</a>
									{:else}
										<span class="watch-label">{song ? 'Listen' : 'Where to Watch'}</span>
									{/if}
									{#if item.region && !song}
										<span class="watch-region">{item.region}</span>
									{/if}
								</div>
								{#if item.providers?.length}
									{#if song}
										<div class="provider-row provider-row-text">
											{#each item.providers as p, pi (p.name + String(pi))}
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
									{:else}
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
																	class="provider-btn"
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
																	class="provider-btn"
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
								{/if}
								{#if song}
									<a
										class="zflix-cta"
										href={primaryListenUrl(item)}
										target="_blank"
										rel="external noopener noreferrer"
									>
										Open listen link
									</a>
								{:else if item.mediaType !== 'YouTube'}
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
						</div>
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<p class="empty-state" transition:fade={{ duration: 220 }}>
			{uiTheme === 'minimal' ? 'Nothing queued yet' : 'Your match appears here'}
		</p>
	{/if}
{/snippet}

{#snippet themeSwitcher()}
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
{/snippet}

{#if uiTheme === 'minimal'}
	<main class="minimal">
		<header class="min-top">
			<h1 class="min-brand">AuraWatch</h1>
			{@render themeSwitcher()}
		</header>

		<p class="min-headline">One title. That’s it.</p>

		<div class="min-workspace">
			<section class="min-form" aria-label="Recommend">
				{@render formFields()}
			</section>
			<section
				class="min-result"
				id="result-window"
				aria-live="polite"
				aria-label="Match result"
			>
				{@render resultContent()}
			</section>
		</div>
	</main>
{:else}
	<main class="desktop">
		<header class="menubar">
			<div class="menubar-left">
				<span class="menu-brand">AuraWatch</span>
			</div>
			<div class="menubar-right">
				{@render themeSwitcher()}
				<time class="menu-clock" datetime={clockLabel || undefined}>{clockLabel || '—'}</time>
			</div>
		</header>

		<div class="workspace">
			<section class="window form-window" aria-label="Recommend">
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
					<p class="subhead">one title. that's it.</p>
					<p class="lede">Choose a format and genres. We'll hand you a single match.</p>

					{@render formFields()}
				</div>
			</section>

			<section
				class="window result-window"
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
					<span class="titlebar-text">Match</span>
					<span class="titlebar-tag">PICK</span>
				</div>
				<div class="window-body result-body">
					{@render resultContent()}
				</div>
			</section>
		</div>

		<footer class="taskbar">
			<span class="start-btn">AuraWatch</span>
			<span class="taskbar-tag">one title. that's it.</span>
		</footer>
	</main>
{/if}

<style>
	:global(html),
	:global(body) {
		margin: 0;
		min-height: 100%;
		background: #0e0e12;
		color: #f3f4f6;
	}

	/* Shared theme segmented control */
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
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--desk);
		color: var(--ink);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	.desktop .theme-segment {
		border: 2px solid var(--line);
		border-radius: 0;
		background: var(--window);
	}
	.desktop .theme-seg-btn {
		padding: 0.15rem 0.55rem;
		font-size: 0.72rem;
		color: var(--muted);
	}
	.desktop .theme-seg-btn:hover:not(.active) {
		color: var(--ink);
		background: #f5f5f5;
	}
	.desktop .theme-seg-btn.active {
		color: #fff;
		background: #111;
		font-weight: 700;
	}
	.desktop .theme-seg-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.desktop .menubar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
		height: 28px;
		padding: 0 0.75rem;
		background: var(--menu);
		border-bottom: 2px solid var(--line);
		font-size: 0.78rem;
	}

	.desktop .menubar-left {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.desktop .menubar-right {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-shrink: 0;
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

	.desktop .workspace {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 1100px;
		margin: 0 auto;
		padding: 1rem 0.85rem 1.25rem;
		box-sizing: border-box;
	}

	@media (min-width: 960px) {
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
		flex: 1;
	}

	@media (min-width: 960px) {
		.desktop .form-window {
			flex: 1 1 48%;
			max-width: 520px;
		}
		.desktop .result-window {
			flex: 1 1 52%;
		}
	}

	.desktop .titlebar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-shrink: 0;
		height: 28px;
		padding: 0 0.55rem;
		background: var(--bar);
		color: #f5f5f5;
		font-size: 0.72rem;
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
		color: #fff;
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
		background: #f5f5f5;
	}
	.desktop .segment-btn.active {
		color: #fff;
		background: var(--accent);
		font-weight: 700;
	}
	.desktop .segment-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 560px) {
		.desktop .segment {
			grid-template-columns: repeat(2, 1fr);
		}
		.desktop .segment-btn:nth-child(2n) {
			border-right: none;
		}
		.desktop .segment-btn:nth-child(-n + 2) {
			border-bottom: 2px solid var(--line);
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
		color: #fff;
		background: var(--accent);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}
	.desktop .cta:hover:not(:disabled) {
		filter: brightness(1.05);
	}
	.desktop .cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
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

	.desktop .rec-list-header {
		margin: 0 0 0.35rem;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
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

	.desktop .loading-block {
		width: 100%;
		display: flex;
		justify-content: flex-start;
	}

	.desktop .rec-grid {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 1.1rem;
		align-items: start;
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
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		aspect-ratio: 2 / 3;
		padding: 0.65rem;
		box-sizing: border-box;
		background:
			repeating-linear-gradient(
				135deg,
				transparent,
				transparent 6px,
				rgba(255, 76, 0, 0.07) 6px,
				rgba(255, 76, 0, 0.07) 7px
			),
			linear-gradient(160deg, #fff8f4 0%, #f5ebe4 55%, #efe4dc 100%);
		text-align: center;
	}
	.desktop .cover-fallback-mark {
		font-weight: 700;
		font-size: 1.85rem;
		letter-spacing: -0.04em;
		color: var(--ink);
		line-height: 1;
	}
	.desktop .cover-fallback-brand {
		font-size: 0.55rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--accent);
		line-height: 1;
	}
	.desktop .cover-fallback-title {
		font-size: 0.6rem;
		line-height: 1.25;
		color: var(--muted);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
		margin-top: 0.15rem;
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
		margin: 0 0 0.35rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.desktop .genre-line {
		margin: 0 0 0.15rem;
		font-size: 0.75rem;
		line-height: 1.45;
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

	.desktop .taskbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
		height: 36px;
		padding: 0 0.65rem;
		background: var(--bar);
		border-top: 2px solid var(--line);
		color: #ddd;
		font-size: 0.75rem;
	}

	.desktop .start-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.28rem 0.7rem;
		background: var(--accent);
		color: #fff;
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
	}

	.minimal .min-workspace {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		width: 100%;
		max-width: 1040px;
		margin: 0 auto;
		flex: 1;
	}

	.minimal .min-result {
		overflow-y: auto;
		max-height: min(70vh, 42rem);
		scrollbar-width: thin;
		scrollbar-color: var(--muted) transparent;
	}

	@media (min-width: 900px) {
		.minimal .min-workspace {
			flex-direction: row;
			align-items: stretch;
			gap: 0;
		}

		.minimal .min-form {
			flex: 1 1 48%;
			padding-right: 2rem;
			border-right: 1px solid var(--line);
		}

		.minimal .min-result {
			flex: 1 1 52%;
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

	.minimal .rec-list-header {
		margin: 0 0 0.4rem;
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
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

	@media (max-width: 560px) {
		.minimal .segment {
			grid-template-columns: repeat(2, 1fr);
		}
		.minimal .segment-btn:nth-child(2n) {
			border-right: none;
		}
		.minimal .segment-btn:nth-child(-n + 2) {
			border-bottom: 1px solid var(--line);
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
		margin-top: 0.35rem;
		align-self: flex-start;
	}
	.minimal .cta:hover:not(:disabled) {
		background: #fff;
	}
	.minimal .cta:disabled {
		opacity: 0.35;
		cursor: not-allowed;
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

	.minimal .loading-block {
		width: 100%;
		display: flex;
		justify-content: flex-start;
	}

	.minimal .rec-grid {
		display: grid;
		grid-template-columns: 110px 1fr;
		gap: 1.25rem;
		align-items: start;
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
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		aspect-ratio: 2 / 3;
		padding: 0.65rem;
		box-sizing: border-box;
		background: linear-gradient(
			160deg,
			#1a1a22 0%,
			#14141a 45%,
			rgba(139, 124, 247, 0.18) 100%
		);
		text-align: center;
	}
	.minimal .cover-fallback-mark {
		font-weight: 700;
		font-size: 1.75rem;
		letter-spacing: -0.04em;
		color: var(--ink);
		line-height: 1;
	}
	.minimal .cover-fallback-brand {
		font-size: 0.58rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--accent);
		line-height: 1;
	}
	.minimal .cover-fallback-title {
		font-size: 0.65rem;
		line-height: 1.25;
		color: var(--muted);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
		margin-top: 0.15rem;
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
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.minimal .genre-line {
		margin: 0 0 0.15rem;
		font-size: 0.8rem;
		line-height: 1.45;
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

	@media (prefers-reduced-motion: reduce) {
		.desktop .brand,
		.minimal .min-brand {
			animation: none;
		}
		.desktop .spinner,
		.minimal .spinner {
			animation: none;
		}
	}
</style>
