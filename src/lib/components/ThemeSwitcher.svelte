<script lang="ts">
	import { ui, setUiTheme, setDeskMode } from '$lib/uiTheme.svelte';

	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);

	function toggleDeskMode() {
		setDeskMode(deskMode === 'dark' ? 'light' : 'dark');
	}
</script>

<!-- keeping chrome on one row so light/dark doesn't wrap under minimal/desktop -->
<div class={['theme-switcher', uiTheme, deskMode]}>
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
	<button
		type="button"
		class="theme-icon-btn"
		aria-label={deskMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
		title={deskMode === 'dark' ? 'Light' : 'Dark'}
		onclick={toggleDeskMode}
	>
		{#if deskMode === 'dark'}
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<circle cx="12" cy="12" r="4" fill="currentColor" />
				<path
					d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<path
					d="M15.4 14.6A6.2 6.2 0 0 1 9.4 4.8 7 7 0 1 0 19.2 14.6a6.2 6.2 0 0 1-3.8 0Z"
					fill="currentColor"
				/>
			</svg>
		{/if}
	</button>
</div>

<style>
	.theme-switcher {
		display: inline-flex;
		align-items: stretch;
		gap: 0.35rem;
		flex-wrap: nowrap;
		flex-shrink: 0;
	}

	.theme-segment {
		display: inline-grid;
		grid-template-columns: auto auto;
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
		line-height: 1.2;
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

	.theme-icon-btn {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		flex-shrink: 0;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
		color: currentColor;
		cursor: pointer;
		padding: 0;
	}
	.theme-icon-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.theme-icon-btn:focus-visible {
		outline: 2px solid #8b7cf7;
		outline-offset: 1px;
	}

	.theme-switcher.minimal.light .theme-segment {
		border-color: rgba(17, 17, 17, 0.14);
		background: rgba(17, 17, 17, 0.04);
	}
	.theme-switcher.minimal.light .theme-seg-btn {
		color: #5c5c66;
	}
	.theme-switcher.minimal.light .theme-seg-btn:hover:not(.active) {
		color: #111111;
		background: rgba(17, 17, 17, 0.06);
	}
	.theme-switcher.minimal.light .theme-seg-btn.active {
		color: #f3f4f6;
		background: #111111;
	}
	.theme-switcher.minimal.light .theme-icon-btn {
		border-color: rgba(17, 17, 17, 0.14);
		background: rgba(17, 17, 17, 0.04);
		color: #111111;
	}
	.theme-switcher.minimal.light .theme-icon-btn:hover {
		background: rgba(17, 17, 17, 0.08);
	}

	.theme-switcher.desktop .theme-segment {
		border: 2px solid var(--line, #111111);
		border-radius: 0;
		background: var(--window, #ffffff);
	}
	.theme-switcher.desktop .theme-seg-btn {
		padding: 0.15rem 0.55rem;
		font-size: 0.72rem;
		color: var(--muted, #666666);
		min-height: 1.55rem;
	}
	.theme-switcher.desktop .theme-seg-btn:hover:not(.active) {
		color: var(--ink, #111111);
		background: var(--hover, #f5f5f5);
	}
	.theme-switcher.desktop .theme-seg-btn.active {
		color: var(--window, #ffffff);
		background: var(--invert, #111111);
		font-weight: 600;
	}
	.theme-switcher.desktop .theme-icon-btn {
		width: 1.7rem;
		min-height: 1.55rem;
		border: 2px solid var(--line, #111111);
		border-radius: 0;
		background: var(--window, #ffffff);
		color: var(--ink, #111111);
	}
	.theme-switcher.desktop .theme-icon-btn:hover {
		background: var(--hover, #f5f5f5);
	}
	.theme-switcher.desktop.dark .theme-icon-btn {
		color: var(--ink, #e8eaed);
	}
</style>
