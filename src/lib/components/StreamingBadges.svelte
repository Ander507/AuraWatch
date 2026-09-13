<script lang="ts">
	export type StreamBadge = {
		name: string;
		logo?: string | null;
		url?: string | null;
		type?: string | null;
	};

	let {
		providers = [],
		label = 'Stream on',
		max = 8
	}: {
		providers?: StreamBadge[];
		label?: string;
		max?: number;
	} = $props();

	// extracting regional flatrate providers from tmdb to show instant streaming platforms
	let flatrate = $derived(
		providers
			.filter((p) => p?.name && (!p.type || p.type === 'flatrate' || p.type === 'ads' || p.type === 'free'))
			.slice(0, max)
	);
</script>

{#if flatrate.length}
	<div class="streaming-badges" aria-label={label}>
		<span class="streaming-badges-label">{label}</span>
		<div class="provider-row streaming-badges-row">
			{#each flatrate as p (p.name + (p.url || ''))}
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
					<span
						class="provider-btn max-lg:h-11 max-lg:w-11 max-lg:rounded-lg"
						title={p.name}
						aria-label={p.name}
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
{/if}

<style>
	.streaming-badges {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.35rem;
	}

	.streaming-badges-label {
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.65;
		font-family: inherit;
	}

	.streaming-badges-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
</style>
