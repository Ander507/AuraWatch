<script lang="ts">
	import type { WatchProviderItem } from '$lib/watchProviderTypes';
	import { providerGroups, providerPriceLabel, qualityBadgeLabel } from '$lib/watchProvidersUI';

	let {
		providers = [],
		region = null,
		watchLink = null,
		label = 'Where to Watch',
		variant = 'desktop',
		compact = false
	}: {
		providers?: WatchProviderItem[];
		region?: string | null;
		watchLink?: string | null;
		label?: string;
		variant?: 'desktop' | 'minimal';
		compact?: boolean;
	} = $props();

	let groups = $derived(providerGroups(providers));
</script>

{#if groups.length}
	<div class={['watch-providers', variant, compact ? 'compact' : '']}>
		<div class="watch-heading">
			{#if watchLink}
				<a class="watch-label watch-label-link" href={watchLink} target="_blank" rel="external noopener noreferrer">
					{label}
				</a>
			{:else}
				<span class="watch-label">{label}</span>
			{/if}
			{#if region}
				<span class="watch-region">{region}</span>
			{/if}
		</div>
		<div class="provider-groups">
			{#each groups as group (group.label)}
				<div class="provider-group">
					{#if group.label}
						<span class="provider-category">{group.label}</span>
					{/if}
					<div class="provider-row">
						{#each group.items as p, pi (p.name + (p.type || '') + String(pi))}
							{@const price = providerPriceLabel(p)}
							{@const quality = qualityBadgeLabel(p.quality)}
							{#if p.url}
								<a
									class="provider-tile"
									href={p.url}
									target="_blank"
									rel="external noopener noreferrer"
									title={p.name}
									aria-label="{group.label ? `${group.label}: ` : ''}{p.name}"
								>
									<span class="provider-icon">
										{#if p.logo}
											<img src={p.logo} alt="" class="provider-logo" />
										{:else}
											<span class="provider-fallback">{p.name.slice(0, 2)}</span>
										{/if}
									</span>
									{#if price}
										<span class="provider-price">{price}</span>
									{/if}
									{#if quality}
										<span class="provider-quality" class:quality-hd={quality === 'HD' || quality === '4K'}>
											{quality}
										</span>
									{/if}
								</a>
							{:else}
								<span
									class="provider-tile"
									title={p.name}
									aria-label="{group.label ? `${group.label}: ` : ''}{p.name}"
								>
									<span class="provider-icon">
										{#if p.logo}
											<img src={p.logo} alt="" class="provider-logo" />
										{:else}
											<span class="provider-fallback">{p.name.slice(0, 2)}</span>
										{/if}
									</span>
									{#if price}
										<span class="provider-price">{price}</span>
									{/if}
									{#if quality}
										<span class="provider-quality" class:quality-hd={quality === 'HD' || quality === '4K'}>
											{quality}
										</span>
									{/if}
								</span>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.watch-providers {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.55rem;
		width: 100%;
	}

	.watch-heading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.provider-groups {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: 100%;
	}

	.provider-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.3rem;
	}

	.provider-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.provider-tile {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.18rem;
		width: 3.4rem;
		text-decoration: none;
		color: inherit;
	}

	.provider-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.125rem;
		height: 2.125rem;
		overflow: hidden;
		box-sizing: border-box;
	}

	.provider-logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.provider-fallback {
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.provider-price {
		font-size: 0.58rem;
		font-weight: 600;
		line-height: 1.1;
		text-align: center;
		white-space: nowrap;
	}

	.provider-quality {
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.05rem 0.22rem;
		border-radius: 2px;
		line-height: 1.2;
	}

	/* Desktop variant */
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

	.desktop .provider-category {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink);
	}

	.desktop .provider-icon {
		border: 2px solid var(--line);
		background: var(--window);
	}

	.desktop a.provider-tile:hover .provider-icon {
		border-color: var(--accent);
	}

	.desktop .provider-fallback {
		color: var(--ink);
	}

	.desktop .provider-price {
		color: var(--ink);
	}

	.desktop .provider-quality {
		background: rgba(0, 0, 0, 0.08);
		color: var(--ink);
	}

	.desktop .provider-quality.quality-hd {
		background: #c9a227;
		color: #1a1400;
	}

	/* Minimal variant */
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

	.minimal .provider-category {
		font-size: 0.68rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink);
	}

	.minimal .provider-icon {
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		background: var(--panel);
	}

	.minimal a.provider-tile:hover .provider-icon {
		border-color: var(--accent);
	}

	.minimal .provider-fallback {
		color: var(--ink);
	}

	.minimal .provider-price {
		color: var(--ink);
		opacity: 0.9;
	}

	.minimal .provider-quality {
		background: rgba(255, 255, 255, 0.12);
		color: var(--ink);
	}

	.minimal .provider-quality.quality-hd {
		background: rgba(201, 162, 39, 0.85);
		color: #1a1400;
	}

	.compact .provider-tile {
		width: 3rem;
	}

	.compact .provider-icon {
		width: 1.9rem;
		height: 1.9rem;
	}

	@media (max-width: 1023px) {
		.provider-icon {
			width: 2.75rem;
			height: 2.75rem;
		}

		.provider-row {
			gap: 0.5rem;
		}
	}
</style>
