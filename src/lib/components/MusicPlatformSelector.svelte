<script lang="ts">
	import {
		MUSIC_PLATFORMS,
		type MusicPlatform
	} from '$lib/musicPlatform';

	let {
		value = $bindable<MusicPlatform>('youtube_music'),
		disabled = false,
		id = 'music-platform',
		variant = 'desktop',
		onchange
	}: {
		value?: MusicPlatform;
		disabled?: boolean;
		id?: string;
		variant?: 'desktop' | 'minimal';
		onchange?: (platform: MusicPlatform) => void;
	} = $props();

	function select(platform: MusicPlatform) {
		if (disabled || value === platform) return;
		value = platform;
		onchange?.(platform);
	}
</script>

<div class={['music-platform-select', variant]} role="group" aria-labelledby="{id}-label">
	<span class="label" id="{id}-label">Listen on</span>
	<div class="pins">
		{#each MUSIC_PLATFORMS as plat (plat.id)}
			<button
				type="button"
				class="chip"
				class:active={value === plat.id}
				aria-pressed={value === plat.id}
				{disabled}
				onclick={() => select(plat.id)}
			>
				{plat.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.music-platform-select {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 100%;
	}

	.pins {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	/* Desktop variant */
	.desktop .label {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}

	.desktop .chip {
		appearance: none;
		border: 1.5px solid var(--line);
		background: var(--panel);
		color: var(--ink);
		cursor: pointer;
		padding: 0.22rem 0.45rem;
		font: inherit;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.desktop .chip.active {
		background: var(--accent);
		color: var(--on-accent);
		border-color: var(--accent);
	}

	.desktop .chip:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	/* Minimal variant */
	.minimal .label {
		font-size: 0.72rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	.minimal .chip {
		appearance: none;
		border: 1px solid rgba(160, 140, 240, 0.4);
		background: rgba(255, 255, 255, 0.04);
		color: var(--ink);
		cursor: pointer;
		border-radius: 999px;
		padding: 0.25rem 0.55rem;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.minimal .chip.active {
		background: rgba(160, 140, 240, 0.28);
		border-color: rgba(160, 140, 240, 0.85);
		color: #c4b5fd;
	}

	.minimal .chip:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
</style>
