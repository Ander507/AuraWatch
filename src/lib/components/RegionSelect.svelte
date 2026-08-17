<script lang="ts">
	import { fade } from 'svelte/transition';
	import { tick } from 'svelte';
	import { WATCH_REGIONS, getRegionLabel } from '$lib/regions';

	let {
		value = $bindable('US'),
		disabled = false,
		id,
		onchange,
		variant = 'desktop'
	}: {
		value?: string;
		disabled?: boolean;
		id?: string;
		onchange?: () => void;
		variant?: 'desktop' | 'minimal';
	} = $props();

	let open = $state(false);
	let query = $state('');
	let highlight = $state(0);
	let rootEl = $state<HTMLDivElement | null>(null);
	let searchEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);

	let selectedLabel = $derived(getRegionLabel(value));

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return WATCH_REGIONS;
		return WATCH_REGIONS.filter(
			(r) => r.code.toLowerCase().includes(q) || r.label.toLowerCase().includes(q)
		);
	});

	async function openPanel() {
		if (disabled) return;
		open = true;
		query = '';
		const idx = filtered.findIndex((r) => r.code === value);
		highlight = idx >= 0 ? idx : 0;
		await tick();
		searchEl?.focus();
		scrollHighlightIntoView();
	}

	function closePanel() {
		open = false;
		query = '';
		highlight = 0;
	}

	function toggle() {
		if (open) closePanel();
		else openPanel();
	}

	function selectRegion(code: string) {
		value = code;
		closePanel();
		onchange?.();
	}

	function scrollHighlightIntoView() {
		const el = listEl?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	}

	function onWindowClick(e: MouseEvent) {
		if (!open) return;
		const t = e.target as Node | null;
		if (rootEl && t && !rootEl.contains(t)) closePanel();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (!open) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			closePanel();
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (filtered.length === 0) return;
			highlight = (highlight + 1) % filtered.length;
			scrollHighlightIntoView();
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (filtered.length === 0) return;
			highlight = (highlight - 1 + filtered.length) % filtered.length;
			scrollHighlightIntoView();
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();
			const item = filtered[highlight];
			if (item) selectRegion(item.code);
		}
	}

	function onQueryInput() {
		highlight = 0;
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class={['region-select', variant]} bind:this={rootEl}>
	<button
		type="button"
		class="trigger"
		{id}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={toggle}
	>
		<span class="trigger-text">{value} — {selectedLabel}</span>
		<svg class="chevron" class:open viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
			<path fill="currentColor" d="M1 1l5 5 5-5" />
		</svg>
	</button>

	{#if open}
		<div class="panel" transition:fade={{ duration: 140 }} role="presentation">
			<input
				bind:this={searchEl}
				bind:value={query}
				oninput={onQueryInput}
				class="search"
				type="search"
				placeholder="Search region…"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				aria-label="Search regions"
			/>
			<ul class="list" bind:this={listEl} role="listbox" aria-label="Regions">
				{#each filtered as r, i (r.code)}
					<li role="option" aria-selected={r.code === value} data-idx={i}>
						<button
							type="button"
							class="option"
							class:active={r.code === value}
							class:highlight={i === highlight}
							onclick={() => selectRegion(r.code)}
							onmouseenter={() => (highlight = i)}
						>
							<span class="code">{r.code}</span>
							<span class="label">{r.label}</span>
						</button>
					</li>
				{:else}
					<li class="empty">No regions match</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.region-select {
		--ink: #111111;
		--muted: #666666;
		--line: #111111;
		--accent: #ff4c00;
		--window: #ffffff;
		position: relative;
		width: 100%;
		height: auto;
		overflow: visible;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	.trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		appearance: none;
		border-radius: 0;
		border: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		padding: 0.55rem 0.65rem;
		font: inherit;
		font-size: 0.85rem;
		outline: none;
		cursor: pointer;
		box-sizing: border-box;
		text-align: left;
	}
	.trigger:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.trigger:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.trigger:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.trigger-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		flex-shrink: 0;
		color: var(--muted);
		transition: transform 0.15s ease;
	}
	.chevron.open {
		transform: rotate(180deg);
	}

	.panel {
		position: absolute;
		z-index: 30;
		left: 0;
		right: 0;
		top: calc(100% + 0.25rem);
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		border-radius: 0;
		background: var(--window);
		border: 2px solid var(--line);
		box-shadow: none;
	}

	.search {
		width: 100%;
		box-sizing: border-box;
		appearance: none;
		border-radius: 0;
		border: none;
		border-bottom: 2px solid var(--line);
		background: var(--window);
		color: var(--ink);
		padding: 0.5rem 0.65rem;
		font: inherit;
		font-size: 0.85rem;
		outline: none;
	}
	.search::placeholder {
		color: var(--muted);
	}
	.search:focus {
		background: #fafafa;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 280px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--muted) transparent;
	}

	.option {
		width: 100%;
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		appearance: none;
		border: none;
		cursor: pointer;
		border-radius: 0;
		padding: 0.5rem 0.65rem;
		font: inherit;
		font-size: 0.85rem;
		color: var(--ink);
		background: transparent;
		text-align: left;
	}
	.option:hover,
	.option.highlight {
		background: #f0f0f0;
	}
	.option.active {
		color: var(--accent);
		font-weight: 700;
	}
	.option.active.highlight,
	.option.active:hover {
		background: rgba(255, 76, 0, 0.1);
	}

	.code {
		flex-shrink: 0;
		font-weight: 700;
		letter-spacing: 0.04em;
		min-width: 1.75rem;
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		padding: 0.75rem 0.65rem;
		font-size: 0.8rem;
		color: var(--muted);
		text-align: left;
	}

	/* Minimal variant — dark charcoal UI */
	.region-select.minimal {
		--ink: #f3f4f6;
		--muted: #9ca3af;
		--line: rgba(255, 255, 255, 0.1);
		--accent: #8b7cf7;
		--window: #16161c;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
	}

	.region-select.minimal .trigger {
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--window);
		padding: 0.65rem 0.85rem;
		font-size: 0.9rem;
	}
	.region-select.minimal .trigger:hover:not(:disabled) {
		border-color: rgba(139, 124, 247, 0.45);
	}
	.region-select.minimal .trigger:focus-visible {
		outline: none;
		border-color: rgba(160, 140, 240, 0.9);
		box-shadow: 0 0 0 1px rgba(140, 120, 220, 0.25);
	}

	.region-select.minimal .panel {
		border: 1px solid rgba(140, 120, 220, 0.35);
		border-radius: 10px;
		background: var(--window);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
	}

	.region-select.minimal .search {
		border-bottom: 1px solid var(--line);
		background: var(--window);
		font-size: 0.9rem;
	}
	.region-select.minimal .search:focus {
		background: #1a1a22;
	}

	.region-select.minimal .option {
		font-size: 0.9rem;
	}
	.region-select.minimal .option:hover,
	.region-select.minimal .option.highlight {
		background: rgba(140, 120, 220, 0.12);
	}
	.region-select.minimal .option.active {
		color: var(--accent);
		font-weight: 600;
	}
	.region-select.minimal .option.active.highlight,
	.region-select.minimal .option.active:hover {
		background: rgba(140, 120, 220, 0.18);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
