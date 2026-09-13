<script lang="ts">
	import {
		MUSIC_PLATFORMS,
		type MusicPlatform
	} from '$lib/musicPlatform';

	let {
		value = $bindable<MusicPlatform>('youtube_music'),
		disabled = false,
		id = 'music-platform',
		onchange
	}: {
		value?: MusicPlatform;
		disabled?: boolean;
		id?: string;
		onchange?: (platform: MusicPlatform) => void;
	} = $props();

	function select(platform: MusicPlatform) {
		if (disabled || value === platform) return;
		value = platform;
		onchange?.(platform);
	}
</script>

<div class="music-platform-select" role="group" aria-labelledby="{id}-label">
	<span class="field-label" id="{id}-label">Listen on</span>
	<div class="service-pins">
		{#each MUSIC_PLATFORMS as plat (plat.id)}
			<button
				type="button"
				class="era-chip service-pin"
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
</style>
