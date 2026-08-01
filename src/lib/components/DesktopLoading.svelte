<script lang="ts">
	import { startDesktopLoading } from '$lib/animations/desktop';

	let {
		hint = 'searching…',
		variant = 'desktop'
	}: {
		hint?: string;
		variant?: 'desktop' | 'minimal';
	} = $props();
</script>

<div
	class="desktop-loading"
	class:minimal={variant === 'minimal'}
	role="status"
	aria-live="polite"
	{@attach startDesktopLoading}
>
	<div class="load-window" aria-hidden="true">
		<div class="load-titlebar">
			<div class="load-traffic">
				<span class="load-dot-tl red"></span>
				<span class="load-dot-tl yellow"></span>
				<span class="load-dot-tl green"></span>
			</div>
			<span class="load-title">Match</span>
			<span class="load-tag">WAIT</span>
		</div>
		<div class="load-body">
			<div class="load-track">
				<div class="load-bar"></div>
			</div>
			<div class="load-dots">
				<span class="load-dot"></span>
				<span class="load-dot"></span>
				<span class="load-dot"></span>
			</div>
		</div>
	</div>
	<p class="load-hint">{hint}<span class="load-cursor">▌</span></p>
</div>

<style>
	.desktop-loading {
		--ink: #111111;
		--muted: #666666;
		--line: #111111;
		--panel: #ffffff;
		--track: #e8e8e8;
		--bar: #1a1a1a;
		--accent: #ff4c00;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.55rem;
		width: 100%;
		max-width: 16rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		color: var(--ink);
		box-sizing: border-box;
	}

	.load-window {
		display: flex;
		flex-direction: column;
		border: 2px solid var(--line);
		background: var(--panel);
		box-sizing: border-box;
	}

	.load-titlebar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		height: 1.55rem;
		padding: 0 0.45rem;
		background: var(--bar);
		color: #f5f5f5;
		box-sizing: border-box;
	}

	.load-traffic {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.load-dot-tl {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.35);
		box-sizing: border-box;
	}
	.load-dot-tl.red {
		background: #ff5f57;
	}
	.load-dot-tl.yellow {
		background: #febc2e;
	}
	.load-dot-tl.green {
		background: #28c840;
	}

	.load-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.68rem;
		font-weight: 500;
	}

	.load-tag {
		flex-shrink: 0;
		padding: 0.08rem 0.3rem;
		background: var(--accent);
		color: #fff;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1.2;
	}

	.load-body {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.75rem 0.7rem 0.8rem;
		background: var(--panel);
		box-sizing: border-box;
	}

	.load-track {
		position: relative;
		width: 100%;
		height: 0.55rem;
		overflow: hidden;
		background: var(--track);
		border: 1px solid color-mix(in srgb, var(--line) 18%, transparent);
		box-sizing: border-box;
	}

	.load-bar {
		position: absolute;
		top: 0;
		left: 0;
		width: 35%;
		height: 100%;
		background: var(--accent);
		will-change: transform;
	}

	.load-dots {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.load-dot {
		display: block;
		width: 0.4rem;
		height: 0.4rem;
		background: var(--ink);
		opacity: 0.35;
		box-sizing: border-box;
	}

	.load-dot:nth-child(2) {
		background: var(--accent);
		opacity: 0.55;
	}

	.load-hint {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: var(--muted);
		text-align: left;
		line-height: 1.35;
	}

	.load-cursor {
		display: inline-block;
		margin-left: 0.1em;
		color: var(--ink);
		font-weight: 400;
		line-height: 1;
	}

	/* Minimal — charcoal + violet accent */
	.desktop-loading.minimal {
		--ink: #f3f4f6;
		--muted: #9ca3af;
		--line: rgba(255, 255, 255, 0.12);
		--panel: transparent;
		--track: #252530;
		--bar: transparent;
		--accent: #8b7cf7;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		gap: 0.7rem;
	}

	.desktop-loading.minimal .load-window {
		border: none;
		background: transparent;
	}

	.desktop-loading.minimal .load-titlebar {
		display: none;
	}

	.desktop-loading.minimal .load-body {
		padding: 0;
		gap: 0.55rem;
		background: transparent;
	}

	.desktop-loading.minimal .load-track {
		height: 0.4rem;
		border: none;
		border-radius: 999px;
		background: var(--track);
	}

	.desktop-loading.minimal .load-bar {
		border-radius: 999px;
	}

	.desktop-loading.minimal .load-dot {
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 50%;
		background: var(--muted);
	}

	.desktop-loading.minimal .load-dot:nth-child(2) {
		background: var(--accent);
	}

	.desktop-loading.minimal .load-hint {
		font-weight: 500;
		letter-spacing: 0;
	}

	.desktop-loading.minimal .load-cursor {
		color: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.load-bar,
		.load-dot,
		.load-hint,
		.load-cursor {
			animation: none !important;
			transform: none !important;
		}

		.load-bar {
			width: 40%;
			transform: none;
		}

		.load-dot,
		.load-hint,
		.load-cursor {
			opacity: 1;
		}
	}
</style>
