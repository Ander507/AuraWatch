<script lang="ts">
	import { fade } from 'svelte/transition';
	import { tick } from 'svelte';
	import { filterGamePlatforms } from '$lib/gamePlatforms';

	let {
		values = $bindable<string[]>([]),
		disabled = false,
		id = 'platforms',
		variant = 'dark',
		max = 6
	}: {
		values?: string[];
		disabled?: boolean;
		id?: string;
		variant?: 'dark' | 'desktop';
		max?: number;
	} = $props();

	let searchQuery = $state('');
	let showDropdown = $state(false);
	let highlight = $state(0);
	let rootEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);

	let atMax = $derived(values.length >= max);
	let filteredPlatforms = $derived(filterGamePlatforms(searchQuery, values));

	function removeAt(i: number) {
		values = values.filter((_, idx) => idx !== i);
	}

	function addPlatform(name: string) {
		const t = name.trim();
		if (!t || atMax) return;
		if (values.some((v) => v.toLowerCase() === t.toLowerCase())) {
			searchQuery = '';
			return;
		}
		values = [...values, t];
		searchQuery = '';
		highlight = 0;
		showDropdown = values.length < max;
		void tick().then(() => inputEl?.focus());
	}

	function closeDropdown() {
		showDropdown = false;
		highlight = 0;
	}

	function onWindowClick(e: MouseEvent) {
		if (!showDropdown) return;
		const t = e.target as Node | null;
		if (rootEl && t && !rootEl.contains(t)) closeDropdown();
	}

	function scrollHighlightIntoView() {
		const el = listEl?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	}

	async function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeDropdown();
			return;
		}

		if (!showDropdown && (e.key === 'ArrowDown' || e.key === 'Enter')) {
			showDropdown = true;
		}

		if (!showDropdown || filteredPlatforms.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = (highlight + 1) % filteredPlatforms.length;
			await tick();
			scrollHighlightIntoView();
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = (highlight - 1 + filteredPlatforms.length) % filteredPlatforms.length;
			await tick();
			scrollHighlightIntoView();
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			const hit = filteredPlatforms[highlight];
			if (hit) addPlatform(hit);
		}
	}
</script>

<svelte:window onclick={onWindowClick} />

<div
	class={['platform-select', variant === 'desktop' ? 'platform-desktop' : 'platform-dark']}
	bind:this={rootEl}
>
	<input
		{id}
		bind:this={inputEl}
		class="platform-input font-mono w-full px-3 py-2 text-sm border-2 border-neutral-800 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:border-orange-500 disabled:opacity-50"
		type="text"
		autocomplete="off"
		spellcheck="false"
		placeholder="PC, PlayStation 5, Switch..."
		bind:value={searchQuery}
		{disabled}
		onfocus={() => {
			if (!disabled && !atMax) showDropdown = true;
		}}
		oninput={() => {
			if (!disabled && !atMax) {
				showDropdown = true;
				highlight = 0;
			}
		}}
		onkeydown={onKeydown}
		aria-autocomplete="list"
		aria-expanded={showDropdown}
		aria-controls="{id}-list"
		role="combobox"
	/>

	{#if showDropdown && !disabled && !atMax && filteredPlatforms.length}
		<ul
			class="platform-dropdown absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto border-2 border-black bg-white shadow-[3px_3px_0_#000]"
			id="{id}-list"
			role="listbox"
			bind:this={listEl}
			transition:fade={{ duration: 80 }}
		>
			{#each filteredPlatforms as plat, i (plat)}
				<li role="option" aria-selected={highlight === i} data-idx={i}>
					<button
						type="button"
						class="platform-option w-full text-left px-3 py-2 text-sm font-mono text-black hover:bg-orange-50"
						class:active={highlight === i}
						onmouseenter={() => (highlight = i)}
						onclick={() => addPlatform(plat)}
					>
						{plat}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if values.length}
		<div class="platform-tags flex flex-wrap gap-1.5 mt-2">
			{#each values as plat, i (plat + String(i))}
				<button
					type="button"
					class="platform-tag inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold border border-black bg-neutral-100 text-black hover:bg-orange-50"
					onclick={() => removeAt(i)}
					{disabled}
					aria-label="Remove {plat}"
					transition:fade={{ duration: 100 }}
				>
					{plat}
					<span aria-hidden="true">×</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if atMax}
		<p class="platform-max mt-1 text-[10px] font-mono text-neutral-500">Max {max} platforms</p>
	{/if}
</div>

<style>
	.platform-select {
		position: relative;
		width: 100%;
	}

	/* Minimal theme — invert the light desktop dropdown look */
	.platform-dark .platform-input {
		border-color: rgba(255, 255, 255, 0.14);
		background: rgba(0, 0, 0, 0.35);
		color: #f3f4f6;
	}
	.platform-dark .platform-input::placeholder {
		color: rgba(243, 244, 246, 0.4);
	}
	.platform-dark .platform-input:focus {
		border-color: #f97316;
	}
	.platform-dark .platform-dropdown {
		border-color: rgba(255, 255, 255, 0.16);
		background: #16161c;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
	}
	.platform-select :global(.platform-option.active) {
		background: #fff7ed; /* orange-50 */
	}
	.platform-dark .platform-option {
		color: #f3f4f6;
	}
	.platform-dark .platform-option:hover,
	.platform-dark :global(.platform-option.active) {
		background: rgba(249, 115, 22, 0.14);
	}
	.platform-dark .platform-tag {
		border-color: rgba(255, 255, 255, 0.2);
		background: rgba(255, 255, 255, 0.08);
		color: #f3f4f6;
	}
	.platform-dark .platform-tag:hover {
		background: rgba(249, 115, 22, 0.18);
	}
	.platform-dark .platform-max {
		color: rgba(243, 244, 246, 0.4);
	}
</style>
