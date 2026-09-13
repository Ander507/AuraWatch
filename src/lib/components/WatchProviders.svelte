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
	const paidLabels = new Set(['Rent', 'Buy']);

	function groupKind(label: string): 'stream' | 'rent' | 'buy' | 'other' {
		if (label === 'Stream') return 'stream';
		if (label === 'Rent') return 'rent';
		if (label === 'Buy') return 'buy';
		return 'other';
	}

	function groupHint(label: string): string {
		if (label === 'Stream') return 'Included';
		if (label === 'Rent') return 'Pay per title';
		if (label === 'Buy') return 'Own it';
		return '';
	}

	function tileTitle(p: WatchProviderItem, groupLabel: string): string {
		const price = providerPriceLabel(p);
		const quality = qualityBadgeLabel(p.quality);
		return [p.name, groupLabel, price, quality].filter(Boolean).join(' · ');
	}
</script>

{#snippet face(p: WatchProviderItem, groupLabel: string)}
	{@const price = paidLabels.has(groupLabel) ? providerPriceLabel(p) : null}
	{@const quality = qualityBadgeLabel(p.quality)}
	<span class="tile-icon">
		{#if p.logo}
			<img src={p.logo} alt="" class="tile-logo" />
		{:else}
			<span class="tile-fallback">{p.name.slice(0, 2)}</span>
		{/if}
	</span>
	{#if price || quality}
		<span class="tile-caption">
			{#if price}<span class="tile-price">{price}</span>{/if}
			{#if quality}<span class="tile-quality">{quality}</span>{/if}
		</span>
	{/if}
{/snippet}

{#if groups.length}
	<div class={['watch-providers', variant, compact && 'compact']}>
		<div class="watch-heading">
			{#if watchLink}
				<a
					class="watch-label watch-label-link"
					href={watchLink}
					target="_blank"
					rel="external noopener noreferrer"
				>
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
				<section class={['provider-group', `kind-${groupKind(group.label)}`]}>
					{#if group.label}
						<div class="provider-category">
							<span class="provider-kind">{group.label}</span>
							{#if groupHint(group.label)}
								<span class="provider-hint">{groupHint(group.label)}</span>
							{/if}
						</div>
					{/if}
					<div class="provider-row">
						{#each group.items as p, pi (p.name + (p.type || '') + String(pi))}
							{#if p.url}
								<a
									class="provider-tile"
									href={p.url}
									target="_blank"
									rel="external noopener noreferrer"
									title={tileTitle(p, group.label)}
									aria-label="{group.label ? `${group.label}: ` : ''}{p.name}"
								>
									{@render face(p, group.label)}
								</a>
							{:else}
								<span
									class="provider-tile"
									title={tileTitle(p, group.label)}
									aria-label="{group.label ? `${group.label}: ` : ''}{p.name}"
								>
									{@render face(p, group.label)}
								</span>
							{/if}
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>
{/if}

<style>
	.watch-providers {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
		width: 100%;
		min-width: 0;
	}

	.watch-heading {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.provider-groups {
		display: flex;
		flex-direction: column;
		gap: 0;
		width: 100%;
		min-width: 0;
	}

	.provider-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		width: 100%;
		min-width: 0;
		padding: 0;
	}

	.provider-group + .provider-group {
		margin-top: 0.7rem;
		padding-top: 0.7rem;
	}

	.provider-category {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.45rem;
		width: 100%;
	}

	.provider-kind {
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-size: 0.88rem;
	}

	.provider-hint {
		font-size: 0.62rem;
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
		opacity: 0.75;
	}

	.provider-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 0.55rem 0.6rem;
		width: 100%;
		min-width: 0;
	}

	.provider-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		width: 2.35rem;
		flex: 0 0 auto;
		text-decoration: none;
		color: inherit;
	}

	.tile-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.35rem;
		height: 2.35rem;
		overflow: hidden;
		box-sizing: border-box;
	}

	.tile-logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tile-fallback {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.tile-caption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.02rem;
		width: 2.75rem;
		line-height: 1.15;
		text-align: center;
	}

	.tile-price {
		font-size: 0.58rem;
		font-weight: 650;
	}

	.tile-quality {
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.desktop .watch-label,
	.desktop .watch-region {
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
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
		font-size: 0.7rem;
		color: var(--ink);
	}

	.desktop .provider-kind {
		font-size: 0.88rem;
		font-weight: 900;
	}

	.desktop .kind-stream .provider-kind {
		color: var(--accent);
	}

	.desktop .kind-rent .provider-kind {
		color: #9a7a12;
	}

	.desktop .provider-group + .provider-group {
		border-top: 1.5px solid var(--line);
	}

	.desktop .tile-icon {
		border: 2px solid var(--line);
		background: var(--window);
	}

	.desktop a.provider-tile:hover .tile-icon {
		border-color: var(--accent);
	}

	.desktop .tile-fallback,
	.desktop .tile-price,
	.desktop .tile-quality {
		color: var(--ink);
	}

	.minimal .watch-label,
	.minimal .watch-region {
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
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
		font-size: 0.72rem;
		color: var(--ink);
	}

	.minimal .provider-kind {
		font-size: 0.9rem;
		font-weight: 900;
	}

	.minimal .kind-stream .provider-kind {
		color: var(--accent);
	}

	.minimal .kind-rent .provider-kind {
		color: #d4af37;
	}

	.minimal .provider-group + .provider-group {
		border-top: 1px solid rgba(255, 255, 255, 0.16);
	}

	.minimal .tile-icon {
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		background: var(--panel);
	}

	.minimal a.provider-tile:hover .tile-icon {
		border-color: var(--accent);
	}

	.minimal .tile-fallback,
	.minimal .tile-price,
	.minimal .tile-quality {
		color: var(--ink);
	}

	.compact .tile-icon,
	.compact .provider-tile {
		width: 2.15rem;
		height: auto;
	}

	.compact .tile-icon {
		height: 2.15rem;
	}

	.compact .tile-caption {
		width: 2.5rem;
	}

	.compact .provider-row {
		gap: 0.45rem 0.5rem;
	}
</style>
