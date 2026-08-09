<script lang="ts">
	import { fade } from 'svelte/transition';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { coverFallbackStyle, mediaInitials } from '$lib/mediaInitials';

	export type LikeHit = {
		id: number;
		mediaType: 'movie' | 'tv' | 'song' | 'artist' | 'game';
		title: string;
		subtitle?: string | null;
		posterUrl: string | null;
		year: string | null;
		rating: number | null;
		kindLabel: 'MOVIE' | 'TV' | 'SONG' | 'ARTIST' | 'GAME';
	};

	let {
		values = $bindable<string[]>([]),
		disabled = false,
		id,
		variant = 'dark',
		max = 5,
		kind = 'media'
	}: {
		values?: string[];
		disabled?: boolean;
		id?: string;
		variant?: 'dark' | 'desktop';
		max?: number;
		kind?: 'media' | 'music' | 'games';
	} = $props();

	let open = $state(false);
	let query = $state('');
	let results = $state<LikeHit[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let highlight = $state(0);
	let rootEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let brokenPosters = $state(new SvelteSet<string>());
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let abort: AbortController | null = null;

	const SEARCH_CACHE_PREFIX = 'aurawatch_search_v1:';
	const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

	let atMax = $derived(values.length >= max);
	let selectedSet = $derived(new Set(values.map((v) => v.toLowerCase())));

	function formatRating(n: number) {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	function normTitle(t: string) {
		return t.trim().toLowerCase();
	}

	// music mode: artists stay as-is, tracks become "Artist — Title" so the chip isnt useless
	function chipTxt(hit: LikeHit): string {
		if (kind !== 'music') return hit.title;
		if (hit.mediaType === 'artist' || hit.kindLabel === 'ARTIST') return hit.title;
		// subtitle is usually the artist name from the search api
		return hit.subtitle ? `${hit.subtitle} — ${hit.title}` : hit.title;
	}

	function posterKey(hit: LikeHit) {
		return `${hit.mediaType}:${hit.id}`;
	}

	function markPosterBroken(hit: LikeHit) {
		brokenPosters.add(posterKey(hit));
	}

	function showPoster(hit: LikeHit) {
		return Boolean(hit.posterUrl) && !brokenPosters.has(posterKey(hit));
	}

	function readSearchCache(key: string): { results: LikeHit[]; total: number } | null {
		try {
			const raw = localStorage.getItem(SEARCH_CACHE_PREFIX + key);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed.expires !== 'number' || parsed.expires < Date.now()) {
				localStorage.removeItem(SEARCH_CACHE_PREFIX + key);
				return null;
			}
			return {
				results: Array.isArray(parsed.results) ? parsed.results : [],
				total: typeof parsed.total === 'number' ? parsed.total : 0
			};
		} catch {
			return null;
		}
	}

	function writeSearchCache(key: string, payload: { results: LikeHit[]; total: number }) {
		try {
			localStorage.setItem(
				SEARCH_CACHE_PREFIX + key,
				JSON.stringify({ ...payload, expires: Date.now() + SEARCH_CACHE_TTL_MS })
			);
		} catch {
			/* quota / private mode */
		}
	}

	async function runSearch(q: string) {
		abort?.abort();
		const trimmed = q.trim();
		if (trimmed.length < 1 || atMax) {
			results = [];
			total = 0;
			loading = false;
			return;
		}

		const cacheKey = `${kind}|${trimmed.toLowerCase()}`;
		const cached = readSearchCache(cacheKey);
		if (cached) {
			results = cached.results.filter((h) => {
				const label = chipTxt(h);
				return !selectedSet.has(normTitle(label)) && !selectedSet.has(normTitle(h.title));
			});
			total = cached.total;
			highlight = 0;
			open = true;
			loading = false;
			return;
		}

		loading = true;
		const ctrl = new AbortController();
		abort = ctrl;

		try {
			const res = await fetch(
				`/api/search?q=${encodeURIComponent(trimmed)}&limit=8&kind=${kind === 'music' ? 'music' : kind === 'games' ? 'games' : 'media'}`,
				{ signal: ctrl.signal }
			);
			const data = await res.json().catch(() => ({}));
			if (ctrl.signal.aborted) return;
			const raw: LikeHit[] = Array.isArray(data?.results) ? data.results : [];
			writeSearchCache(cacheKey, {
				results: raw,
				total: typeof data?.total === 'number' ? data.total : raw.length
			});
			// skip stuff already picked (check both chip label + bare title, whatever)
			results = raw.filter((h) => {
				const label = chipTxt(h);
				return !selectedSet.has(normTitle(label)) && !selectedSet.has(normTitle(h.title));
			});
			total = typeof data?.total === 'number' ? data.total : results.length;
			highlight = 0;
			open = true;
		} catch (e: any) {
			if (e?.name === 'AbortError') return;
			results = [];
			total = 0;
		} finally {
			if (!ctrl.signal.aborted) loading = false;
		}
	}

	function scheduleSearch(q: string) {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => runSearch(q), 220);
	}

	function onInput() {
		if (atMax) return;
		scheduleSearch(query);
		open = true;
	}

	function removeAt(index: number) {
		values = values.filter((_, i) => i !== index);
	}

	function addTitle(title: string) {
		const t = title.trim();
		if (!t || atMax) return;
		if (selectedSet.has(normTitle(t))) return;
		values = [...values, t];
		query = '';
		results = [];
		total = 0;
		open = false;
	}

	function selectHit(hit: LikeHit) {
		addTitle(chipTxt(hit));
		tick().then(() => inputEl?.focus());
	}

	function closePanel() {
		open = false;
	}

	function onWindowClick(e: MouseEvent) {
		if (!open) return;
		const t = e.target as Node | null;
		if (rootEl && t && !rootEl.contains(t)) closePanel();
	}

	function focusInput() {
		if (disabled || atMax) return;
		inputEl?.focus();
	}

	function scrollHighlightIntoView() {
		const el = listEl?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	}

	async function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Backspace' && !query && values.length) {
			e.preventDefault();
			removeAt(values.length - 1);
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			closePanel();
			return;
		}

		if (e.key === 'Enter' && query.trim() && (!open || results.length === 0)) {
			e.preventDefault();
			addTitle(query);
			return;
		}

		if (!open && (e.key === 'ArrowDown') && query.trim()) {
			open = true;
			await runSearch(query);
		}

		if (!open || results.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = (highlight + 1) % results.length;
			await tick();
			scrollHighlightIntoView();
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = (highlight - 1 + results.length) % results.length;
			await tick();
			scrollHighlightIntoView();
			return;
		}

		if (e.key === 'Enter') {
			const hit = results[highlight];
			if (hit) {
				e.preventDefault();
				selectHit(hit);
			}
		}
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class={['like-select', variant]} bind:this={rootEl}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="field-shell"
		class:disabled
		onclick={focusInput}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') focusInput();
		}}
	>
		{#each values as title, i (title + String(i))}
			<span class="chip" transition:fade={{ duration: 100 }}>
				<span class="chip-label">{title}</span>
				<button
					type="button"
					class="chip-x"
					onclick={(e) => {
						e.stopPropagation();
						removeAt(i);
					}}
					{disabled}
					aria-label="Remove {title}"
				>
					<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
						<path
							d="M2 2l8 8M10 2L2 10"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</span>
		{/each}

		{#if !atMax}
			<input
				bind:this={inputEl}
				{id}
				class="search-input"
				type="text"
				role="combobox"
				bind:value={query}
				oninput={onInput}
				onkeydown={onKeydown}
				onfocus={() => {
					if (query.trim()) {
						open = true;
						if (!results.length) scheduleSearch(query);
					}
				}}
				placeholder={values.length
					? 'Add another…'
					: kind === 'music'
						? 'Search a song or artist…'
						: kind === 'games'
							? 'Search a game…'
							: 'Search a title…'}
				{disabled}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={id ? `${id}-list` : undefined}
				aria-haspopup="listbox"
			/>
		{:else}
			<span class="max-hint">Max {max}</span>
		{/if}
	</div>

	{#if open && !atMax && (loading || results.length || query.trim())}
		<div class="panel" transition:fade={{ duration: 120 }} role="presentation">
			{#if loading && !results.length}
				<p class="panel-status">Searching…</p>
			{:else if results.length}
				<ul
					class="list"
					bind:this={listEl}
					role="listbox"
					id={id ? `${id}-list` : undefined}
					aria-label="Matching titles"
				>
					{#each results as hit, i (hit.mediaType + hit.id)}
						<li role="option" aria-selected={i === highlight} data-idx={i}>
							<button
								type="button"
								class="row"
								class:highlight={i === highlight}
								onclick={() => selectHit(hit)}
								onmouseenter={() => (highlight = i)}
							>
								{#if showPoster(hit)}
									<img
										class="poster"
										src={hit.posterUrl}
										alt=""
										loading="lazy"
										onerror={() => markPosterBroken(hit)}
									/>
								{:else}
									<span
										class="poster poster-fallback"
										style={coverFallbackStyle(
											hit.subtitle ? `${hit.subtitle} ${hit.title}` : hit.title
										)}
										aria-hidden="true"
									>
										<span class="poster-initials">
											{mediaInitials(hit.title, hit.subtitle)}
										</span>
									</span>
								{/if}
								<span class="meta">
									<span class="title">{hit.title}</span>
									<span class="sub">
										{#if hit.subtitle}
											<span>{hit.subtitle}</span>
											<span class="dot">·</span>
										{/if}
										<span class="kind">{hit.kindLabel}</span>
										{#if hit.year}
											<span class="dot">·</span>
											<span>{hit.year}</span>
										{/if}
										{#if hit.rating != null && hit.rating > 0}
											<span class="dot">·</span>
											<span class="rating">★ {formatRating(hit.rating)}</span>
										{/if}
									</span>
								</span>
								<svg class="chev" viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
									<path
										d="M1 1l5 5-5 5"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</li>
					{/each}
				</ul>
				{#if total > results.length}
					<p class="panel-foot">{total} matches — pick one above</p>
				{/if}
			{:else}
				<p class="panel-status">No titles found</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.like-select {
		position: relative;
		width: 100%;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
	}

	.field-shell {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		box-sizing: border-box;
		min-height: 2.75rem;
		padding: 0.45rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(140, 120, 220, 0.55);
		background: rgba(18, 18, 24, 0.92);
		cursor: text;
	}
	.field-shell:focus-within {
		border-color: rgba(160, 140, 240, 0.9);
		box-shadow: 0 0 0 1px rgba(140, 120, 220, 0.25);
	}
	.field-shell.disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		max-width: 100%;
		padding: 0.28rem 0.3rem 0.28rem 0.65rem;
		border-radius: 999px;
		border: 1px solid rgba(140, 120, 220, 0.45);
		background: rgba(139, 124, 247, 0.12);
		color: #f3f4f6;
	}
	.chip-label {
		font-size: 0.86rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 12rem;
	}
	.chip-x {
		flex-shrink: 0;
		appearance: none;
		border: none;
		background: transparent;
		color: rgba(243, 244, 246, 0.5);
		cursor: pointer;
		padding: 0.28rem;
		display: inline-flex;
		line-height: 0;
		border-radius: 999px;
	}
	.chip-x:hover:not(:disabled) {
		color: #f3f4f6;
		background: rgba(255, 255, 255, 0.08);
	}
	.chip-x:disabled {
		cursor: not-allowed;
	}

	.search-input {
		flex: 1;
		min-width: 7rem;
		appearance: none;
		border: none;
		background: transparent;
		color: #f3f4f6;
		padding: 0.35rem 0.35rem;
		font: inherit;
		font-size: 0.95rem;
		outline: none;
	}
	.search-input::placeholder {
		color: rgba(243, 244, 246, 0.35);
	}
	.search-input:disabled {
		cursor: not-allowed;
	}

	.max-hint {
		font-size: 0.75rem;
		color: rgba(243, 244, 246, 0.4);
		padding: 0.25rem 0.4rem;
	}

	.panel {
		position: absolute;
		z-index: 40;
		left: 0;
		right: 0;
		top: calc(100% + 0.45rem);
		border-radius: 12px;
		border: 1px solid rgba(140, 120, 220, 0.4);
		background: rgba(16, 16, 22, 0.96);
		overflow: hidden;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 340px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(140, 120, 220, 0.35) transparent;
	}

	.row {
		width: 100%;
		display: grid;
		grid-template-columns: 36px 1fr auto;
		align-items: center;
		gap: 0.75rem;
		appearance: none;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: transparent;
		color: #f3f4f6;
		padding: 0.65rem 0.85rem;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:last-child {
		border-bottom: none;
	}
	.row:hover,
	.row.highlight {
		background: rgba(140, 120, 220, 0.12);
	}

	.poster {
		width: 36px;
		height: 52px;
		object-fit: cover;
		border-radius: 4px;
		background: #2a2a35;
		flex-shrink: 0;
	}
	.poster-fallback {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}
	.poster-initials {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: rgba(255, 255, 255, 0.92);
		line-height: 1;
		user-select: none;
	}

	.meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.title {
		font-weight: 600;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sub {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		color: rgba(243, 244, 246, 0.45);
		letter-spacing: 0.02em;
	}
	.kind {
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.08em;
	}
	.dot {
		opacity: 0.5;
	}
	.rating {
		color: #e8c547;
	}
	.chev {
		color: rgba(243, 244, 246, 0.35);
		flex-shrink: 0;
	}

	.panel-status,
	.panel-foot {
		margin: 0;
		padding: 0.85rem 1rem;
		text-align: center;
		font-size: 0.78rem;
		color: rgba(243, 244, 246, 0.4);
	}
	.panel-foot {
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.like-select.desktop {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.like-select.desktop .field-shell {
		border-radius: 0;
		border: 2px solid #111;
		background: #fff;
		min-height: 2.4rem;
		box-shadow: none;
	}
	.like-select.desktop .field-shell:focus-within {
		border-color: #ff4c00;
		box-shadow: none;
	}
	.like-select.desktop .chip {
		border-radius: 0;
		border: 1px solid #111;
		background: #f5f5f5;
		color: #111;
	}
	.like-select.desktop .chip-x {
		color: #666;
		border-radius: 0;
	}
	.like-select.desktop .chip-x:hover:not(:disabled) {
		color: #111;
		background: rgba(0, 0, 0, 0.06);
	}
	.like-select.desktop .search-input {
		color: #111;
		font-size: 0.85rem;
	}
	.like-select.desktop .search-input::placeholder {
		color: #666;
		opacity: 0.75;
	}
	.like-select.desktop .max-hint {
		color: #666;
	}
	.like-select.desktop .panel {
		border-radius: 0;
		border: 2px solid #111;
		background: #fff;
		box-shadow: none;
	}
	.like-select.desktop .row {
		border-bottom: 1px solid #ddd;
		color: #111;
	}
	.like-select.desktop .row:hover,
	.like-select.desktop .row.highlight {
		background: rgba(255, 76, 0, 0.08);
	}
	.like-select.desktop .sub {
		color: #666;
	}
	.like-select.desktop .chev {
		color: #999;
	}
	.like-select.desktop .panel-status,
	.like-select.desktop .panel-foot {
		color: #666;
		border-color: #eee;
	}
	.like-select.desktop .poster {
		border-radius: 0;
		background: #eee;
	}
</style>
