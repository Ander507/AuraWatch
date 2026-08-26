<script lang="ts">
	import { resolve } from '$app/paths';

	type NavId = 'room' | 'vibe' | 'match' | 'lists';

	let {
		active = null,
		showVibe = false,
		onVibe,
		onMatch,
		onLists,
		listsLabel = 'My Lists'
	}: {
		active?: NavId | null;
		showVibe?: boolean;
		onVibe?: () => void;
		onMatch?: () => void;
		onLists?: () => void;
		listsLabel?: string;
	} = $props();

	const navBtnClass =
		'app-nav-btn flex min-h-[3.15rem] flex-1 flex-col items-center justify-center gap-[0.2rem] px-1 py-[0.45rem] text-[0.68rem] font-semibold tracking-wide text-gray-400 no-underline';
</script>

<nav
	class="app-bottom-nav fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-gray-800 bg-black/90 pt-[0.35rem] pr-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pl-2 backdrop-blur-md lg:hidden"
	aria-label="App"
>
	{#if showVibe}
		<button
			type="button"
			class={navBtnClass}
			class:active={active === 'vibe'}
			aria-current={active === 'vibe' ? 'page' : undefined}
			onclick={() => onVibe?.()}
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M4 7h16M7 12h10M9 17h6"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
			Vibe
		</button>
	{/if}

	<a
		class={navBtnClass}
		class:active={active === 'room'}
		aria-current={active === 'room' ? 'page' : undefined}
		href={resolve('/room')}
	>
		<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="8" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8" />
			<circle cx="16" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8" />
			<path
				d="M4.5 17.2c.5-2.2 2.1-3.4 3.5-3.4s3 1.2 3.5 3.4M12.5 17.2c.5-2.2 2.1-3.4 3.5-3.4s3 1.2 3.5 3.4"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
		</svg>
		Room
	</a>

	{#if onMatch}
		<button
			type="button"
			class={navBtnClass}
			class:active={active === 'match'}
			aria-current={active === 'match' ? 'page' : undefined}
			onclick={onMatch}
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
				<path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
			</svg>
			Match
		</button>
	{:else}
		<a
			class={navBtnClass}
			class:active={active === 'match'}
			aria-current={active === 'match' ? 'page' : undefined}
			href={resolve('/')}
			data-sveltekit-preload-data="hover"
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
				<path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
			</svg>
			Match
		</a>
	{/if}

	{#if onLists}
		<button
			type="button"
			class={navBtnClass}
			class:active={active === 'lists'}
			aria-current={active === 'lists' ? 'page' : undefined}
			onclick={onLists}
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
			{listsLabel}
		</button>
	{:else}
		<a
			class={navBtnClass}
			class:active={active === 'lists'}
			aria-current={active === 'lists' ? 'page' : undefined}
			href={resolve('/lists')}
			data-sveltekit-preload-data="hover"
		>
			<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
			{listsLabel}
		</a>
	{/if}
</nav>

<style>
	.app-nav-icon {
		width: 1.35rem;
		height: 1.35rem;
	}
	.app-nav-btn.active {
		color: #fff;
	}
</style>
