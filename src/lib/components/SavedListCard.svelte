<script lang="ts">
	import { coverFallbackStyle, mediaInitials } from '$lib/mediaInitials';
	import type { SavedListCardItem } from '$lib/savedListCard';

	let {
		item,
		variant = 'desktop',
		showRemove = false,
		onRemove
	}: {
		item: SavedListCardItem;
		variant?: 'desktop' | 'minimal';
		showRemove?: boolean;
		onRemove?: () => void;
	} = $props();

	// pulling streaming providers into the saved cards so people actually know where to watch them
	let providers = $derived(item.providers?.filter((p) => p?.name)?.slice(0, 8) ?? []);
</script>

<!-- making sure shared view and sidebar list share the exact same markup and provider badges -->
<!-- ripping out flex-1 and justify-between so the cards stack neatly at the top instead of stretching everywhere -->
<article class={['aura-list-card', variant, 'h-fit flex-none']}>
	<div class="aura-list-cover">
		{#if item.cover}
			<img src={item.cover} alt="" class="cover" loading="lazy" decoding="async" />
		{:else}
			<div
				class="cover-fallback"
				style={coverFallbackStyle(item.title)}
				aria-hidden="true"
			>
				<span class="cover-fallback-initials">{mediaInitials(item.title)}</span>
			</div>
		{/if}
	</div>
	<div class="aura-list-meta">
		<h2 class="rec-title">{item.title}</h2>
		{#if item.format || item.year}
			<p class="meta-line">
				{#if item.format}<span>{item.format}</span>{/if}
				{#if item.format && item.year}<span class="dot">·</span>{/if}
				{#if item.year}<span>{item.year}</span>{/if}
			</p>
		{/if}

		{#if providers.length}
			<div class="provider-row" aria-label="Where to watch">
				{#each providers as p, i (p.name + String(i))}
					{#if p.url}
						<a
							class="provider-btn max-lg:h-11 max-lg:w-11 max-lg:rounded-lg"
							href={p.url}
							target="_blank"
							rel="external noopener noreferrer"
							title={p.name}
							aria-label={p.name}
						>
							{#if p.logo}
								<img src={p.logo} alt="" class="provider-logo" />
							{:else}
								<span class="provider-fallback">{p.name.slice(0, 2)}</span>
							{/if}
						</a>
					{:else}
						<span class="provider-btn max-lg:h-11 max-lg:w-11 max-lg:rounded-lg" title={p.name} aria-label={p.name}>
							{#if p.logo}
								<img src={p.logo} alt="" class="provider-logo" />
							{:else}
								<span class="provider-fallback">{p.name.slice(0, 2)}</span>
							{/if}
						</span>
					{/if}
				{/each}
			</div>
		{/if}

		{#if showRemove && onRemove}
			<button type="button" class="aura-list-remove max-lg:min-h-11 max-lg:px-4 max-lg:py-2.5" onclick={onRemove}>Remove</button>
		{/if}
	</div>
</article>

<style>
	.aura-list-card {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.75rem;
		align-items: start;
		width: 100%;
		height: fit-content;
		max-height: none;
		flex: none;
		overflow: visible;
		box-sizing: border-box;
	}

	.aura-list-card.desktop {
		padding: 0.65rem;
		border: 2px solid #111;
		background: #fff;
		color: #111;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	:global(.desk-dark) .aura-list-card.desktop {
		border-color: #2a2f38;
		background: #080a0e;
		color: #e8eaed;
	}

	.aura-list-card.minimal {
		padding: 0.35rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		background: transparent;
		color: #f3f4f6;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		grid-template-columns: 4.25rem 1fr;
		gap: 0.85rem;
	}

	.aura-list-cover {
		width: 4.5rem;
		aspect-ratio: 2 / 3;
		overflow: hidden;
	}

	.desktop .aura-list-cover {
		border: 2px solid #111;
		background: #eee;
	}

	:global(.desk-dark) .desktop .aura-list-cover {
		border-color: #2a2f38;
		background: #141820;
	}

	.minimal .aura-list-cover {
		width: 4.25rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
	}

	.aura-list-cover .cover,
	.aura-list-cover .cover-fallback {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.cover-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0.25rem;
		box-sizing: border-box;
	}

	.cover-fallback-initials {
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: -0.04em;
		line-height: 1;
		user-select: none;
	}

	.desktop .cover-fallback-initials {
		color: #111;
	}

	:global(.desk-dark) .desktop .cover-fallback-initials {
		color: #e8eaed;
	}

	.minimal .cover-fallback-initials {
		color: rgba(255, 255, 255, 0.92);
	}

	.aura-list-meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.rec-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: -0.02em;
	}

	.minimal .rec-title {
		font-size: 1.05rem;
	}

	.meta-line {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #666;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.minimal .meta-line {
		color: #9ca3af;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	.dot {
		opacity: 0.6;
	}

	.provider-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.1rem;
	}

	.provider-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		overflow: hidden;
		text-decoration: none;
		box-sizing: border-box;
	}

	.desktop .provider-btn {
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
	}

	:global(.desk-dark) .desktop .provider-btn {
		border-color: #2a2f38;
		background: #0c0f14;
	}

	.desktop a.provider-btn:hover {
		border-color: #ff4c00;
	}

	.minimal .provider-btn {
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
	}

	.minimal a.provider-btn:hover {
		border-color: #ff4c00;
	}

	.provider-logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.provider-fallback {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: inherit;
	}

	@media (max-width: 1023px) {
		/* bumping up the provider icon sizes so users don't fat-finger the wrong streaming service on their phone */
		.provider-btn {
			width: 2.75rem;
			height: 2.75rem;
			border-radius: 0.5rem;
		}
		.provider-row {
			gap: 0.5rem;
		}

		/* adding generous touch padding to all buttons so they meet mobile ergonomics standards */
		.aura-list-remove {
			min-height: 44px;
			padding: 0.625rem 1rem;
		}
	}

	.aura-list-remove {
		appearance: none;
		align-self: flex-start;
		margin-top: 0.25rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		background: transparent;
	}

	.desktop .aura-list-remove {
		border: 2px solid #111;
		color: #666;
	}

	:global(.desk-dark) .desktop .aura-list-remove {
		border-color: #2a2f38;
		color: #8b929e;
	}

	.desktop .aura-list-remove:hover {
		color: #ff4c00;
		border-color: #ff4c00;
	}

	.minimal .aura-list-remove {
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		color: #9ca3af;
		padding: 0.3rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
	}

	.minimal .aura-list-remove:hover {
		color: #f87171;
		border-color: rgba(248, 113, 113, 0.45);
	}
</style>
