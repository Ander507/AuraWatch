<script lang="ts">
	import { resolve } from '$app/paths';

	type Active = 'room' | 'match' | 'lists' | 'shared';

	let {
		active,
		listCount,
		matchActive,
		listsActive,
		onMatch
	}: {
		active: Active;
		listCount?: number;
		matchActive?: boolean;
		listsActive?: boolean;
		onMatch?: () => void;
	} = $props();

	let listsLabel = $derived(
		listCount != null ? `My lists (${listCount})` : 'My lists'
	);
	let matchIsCurrent = $derived(onMatch ? Boolean(matchActive) : active === 'match');
</script>

<div class="view-tabs hidden lg:inline-flex" role="group" aria-label="App views">
	<a
		class="view-tab-btn room-nav-link"
		class:active={active === 'room'}
		aria-current={active === 'room' ? 'page' : undefined}
		href={resolve('/room')}>Group Room</a
	>

	{#if onMatch}
		<button
			type="button"
			class="view-tab-btn"
			class:active={matchIsCurrent}
			aria-pressed={matchIsCurrent}
			onclick={onMatch}
		>
			Match
		</button>
	{:else if active === 'match'}
		<span class="view-tab-btn active" aria-current="page">Match</span>
	{:else}
		<a class="view-tab-btn" href={resolve('/')} data-sveltekit-preload-data="hover">Match</a>
	{/if}

	{#if active === 'lists'}
		<span class="view-tab-btn active" aria-current="page">{listsLabel}</span>
	{:else}
		<a
			class="view-tab-btn"
			class:active={listsActive}
			href={resolve('/lists')}
			data-sveltekit-preload-data="hover">{listsLabel}</a
		>
	{/if}
	{#if active === 'shared'}
		<span class="view-tab-btn active" aria-current="page">Shared List</span>
	{/if}
</div>
