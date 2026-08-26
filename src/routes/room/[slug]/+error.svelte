<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import AppViewTabs from '$lib/components/AppViewTabs.svelte';
	import { ROOM_EXPIRED_MSG } from '$lib/groupVibe';
	import { SITE } from '$lib/seo';
	import { hydrateUiTheme, ui } from '$lib/uiTheme.svelte';
	import { onMount } from 'svelte';
	import '$lib/styles/app-chrome.css';

	let { error }: { error: { message?: string } } = $props();

	onMount(() => hydrateUiTheme());

	let status = $derived(page.status);
	let expired = $derived(status === 410);
	let message = $derived(
		error?.message || (expired ? ROOM_EXPIRED_MSG : 'This room could not be opened.')
	);
	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
</script>

<svelte:head>
	<title>{expired ? 'Room expired' : 'Room not found'} — {SITE.name}</title>
</svelte:head>

<div class="share-app w-full max-w-full overflow-x-hidden">
	{#if uiTheme === 'minimal'}
		<main class="minimal w-full max-w-full overflow-x-hidden max-lg:pb-[80px]">
			<header class="min-top flex flex-wrap">
				<a class="min-brand" href={resolve('/')}>{SITE.name}</a>
				<div class="header-controls flex flex-wrap">
					<AppViewTabs active="room" />
				</div>
			</header>
			<div class="room-error-page">
				<p class="eyebrow">{expired ? 'Expired' : `Error ${status}`}</p>
				<h1 class="title">{expired ? 'This room self-destructed' : 'Room not found'}</h1>
				<p class="body">{message}</p>
				<p class="actions">
					<a href={resolve('/room')}>Open a new room</a>
					<a href={resolve('/')}>Back home</a>
				</p>
			</div>
		</main>
	{:else}
		<main
			class="desktop w-full max-w-full overflow-x-hidden max-lg:pb-[80px]"
			class:desk-dark={deskMode === 'dark'}
		>
			<header class="menubar flex flex-wrap">
				<div class="menubar-left">
					<a class="menu-brand" href={resolve('/')}>{SITE.name}</a>
				</div>
				<div class="menubar-right flex flex-wrap">
					<AppViewTabs active="room" />
				</div>
			</header>
			<div class="room-error-page">
				<p class="eyebrow">{expired ? 'Expired' : `Error ${status}`}</p>
				<h1 class="title">{expired ? 'This room self-destructed' : 'Room not found'}</h1>
				<p class="body">{message}</p>
				<p class="actions">
					<a href={resolve('/room')}>Open a new room</a>
					<a href={resolve('/')}>Back home</a>
				</p>
			</div>
		</main>
	{/if}
	<AppBottomNav active="room" />
</div>

<style>
	.min-brand {
		text-decoration: none;
		color: inherit;
	}

	.room-error-page {
		max-width: 28rem;
		margin: 0 auto;
		padding: 3rem 1.25rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted, #666);
	}

	.title {
		margin: 0 0 0.65rem;
		font-size: 1.45rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: var(--ink, #111);
	}

	.body {
		margin: 0 0 1.25rem;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--muted, #666);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.actions a {
		color: var(--accent, #ff4c00);
		text-decoration: none;
	}

	.actions a:hover {
		text-decoration: underline;
	}

	:global(html[data-ui='minimal']) .title {
		color: #f2f2f5;
	}

	:global(html[data-ui='minimal']) .body,
	:global(html[data-ui='minimal']) .eyebrow {
		color: #9ca3af;
	}
</style>
