<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { signOutEverywhere } from '$lib/discordSignIn';
	import { signInQuery } from '$lib/authRedirect';
	import SavedListCard from '$lib/components/SavedListCard.svelte';
	import AppViewTabs from '$lib/components/AppViewTabs.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import type { SavedWatchProvider } from '$lib/savedListCard';
	import { SITE } from '$lib/seo';
	import { ui, setUiTheme, setDeskMode, hydrateUiTheme } from '$lib/uiTheme.svelte';
	import '$lib/styles/app-chrome.css';

	type ListItem = {
		id: string;
		title: string;
		format: string;
		coverUrl?: string | null;
		description?: string | null;
		providers?: SavedWatchProvider[];
	};

	type Playlist = {
		id: string;
		name?: string;
		title: string;
		slug: string;
		items: ListItem[];
	};

	let { data }: { data: { lists?: Playlist[]; tursoReady?: boolean; session?: any } } = $props();

	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
	let session = $derived(data.session ?? page.data.session);
	let lists = $derived((data.lists ?? []) as Playlist[]);
	let totalItems = $derived(lists.reduce((n: number, pl: Playlist) => n + (pl.items?.length ?? 0), 0));
	let primaryList = $derived(lists[0] ?? null);
	let moreLists = $derived(lists.slice(1));

	const homeHref = resolve('/');
	let signInQs = $derived(signInQuery(`${page.url.pathname}${page.url.search}`));

	let removingId = $state<string | null>(null);
	let clockLabel = $state('');

	function formatClock(d = new Date()) {
		const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${weekday}, ${hh}:${mm}`;
	}

	onMount(() => {
		hydrateUiTheme();
		clockLabel = formatClock();
		const id = setInterval(() => {
			clockLabel = formatClock();
		}, 60_000);
		return () => clearInterval(id);
	});

	async function removeItem(itemId: string) {
		if (removingId) return;
		removingId = itemId;
		const fd = new FormData();
		fd.set('itemId', itemId);
		try {
			await fetch('?/removeItem', { method: 'POST', body: fd });
			await invalidateAll();
		} catch (e) {
			console.warn('lists remove flopped', e);
		} finally {
			removingId = null;
		}
	}
</script>

<svelte:head>
	<title>My Lists — {SITE.name}</title>
	<meta name="description" content="Your saved AuraWatch playlists — share picks and keep your vibe lists in one place." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#snippet themeSwitcher()}
	<div class="theme-switcher-stack">
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
		{#if uiTheme === 'desktop'}
			<div class="theme-segment desk-mode-segment" role="group" aria-label="Desktop light or dark">
				<button
					type="button"
					class="theme-seg-btn"
					class:active={deskMode === 'light'}
					aria-pressed={deskMode === 'light'}
					onclick={() => setDeskMode('light')}
				>
					Light
				</button>
				<button
					type="button"
					class="theme-seg-btn"
					class:active={deskMode === 'dark'}
					aria-pressed={deskMode === 'dark'}
					onclick={() => setDeskMode('dark')}
				>
					Dark
				</button>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet viewTabs()}
	<AppViewTabs active="lists" listCount={totalItems} />
{/snippet}

{#snippet authControls()}
	<div class="auth-controls">
		{#if session?.user}
			{#if session.user.image}
				<img class="auth-avatar" src={session.user.image} alt="" width="28" height="28" />
			{/if}
			<span class="auth-name">{session.user.name || 'You'}</span>
			<button type="button" class="auth-btn" onclick={() => signOutEverywhere()}>Sign out</button>
		{:else}
			<a class="auth-btn" href={`${resolve('/signin')}${signInQs}`}>Sign in</a>
		{/if}
	</div>
{/snippet}

{#snippet playlistPane(pl: Playlist)}
	<section class="playlist-group">
		<div class="playlist-head">
			<h2 class="playlist-title">{pl.title || pl.name}</h2>
			<div class="playlist-actions">
				<span class="playlist-count">{pl.items.length}</span>
				<a class="share-vibe-btn" href={resolve(`/list/${pl.slug}` as `/list/${string}`)}>Share</a>
			</div>
		</div>
		{#if pl.items.length}
			{#each pl.items as saved (saved.id)}
				<div class="h-fit">
					<SavedListCard
						variant={uiTheme}
						showRemove
						item={{
							id: saved.id,
							title: saved.title,
							cover: saved.coverUrl || '',
							format: saved.format,
							description: saved.description || undefined,
							providers: saved.providers
						}}
						onRemove={() => void removeItem(saved.id)}
					/>
				</div>
			{/each}
		{:else}
			<p class="empty-state">Nothing in this playlist yet.</p>
		{/if}
	</section>
{/snippet}

{#snippet listsEmpty(copy: string)}
	{#if !data.tursoReady}
		<p class="lists-error" role="alert">
			Saved lists need the database configured. Try again later.
		</p>
	{:else}
		<p class="empty-state">{copy}</p>
	{/if}
{/snippet}

<div class="share-app w-full max-w-full overflow-x-hidden">
	{#if uiTheme === 'minimal'}
		<main class="minimal w-full max-w-full overflow-x-hidden max-lg:pb-[80px]">
			<header class="min-top flex flex-wrap">
				<a class="min-brand" href={homeHref}>{SITE.name}</a>
				<div class="header-controls flex flex-wrap">
					{@render viewTabs()}
					{@render themeSwitcher()}
					{@render authControls()}
				</div>
			</header>

			<p class="min-headline">
				{totalItems
					? `${lists.length} playlist${lists.length === 1 ? '' : 's'} · ${totalItems} saved`
					: 'Your saved playlists live here — save picks from Match to fill them.'}
			</p>

			<div class="min-workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
				<section class="min-form w-full min-w-0 lg:w-1/2" aria-label="Primary list">
					{#if primaryList}
						{@render playlistPane(primaryList)}
					{:else}
						{@render listsEmpty('No playlists yet — save a pick from Match.')}
					{/if}
				</section>
				<section class="min-result w-full min-w-0 lg:w-1/2" aria-label="More lists">
					{#if moreLists.length}
						{#each moreLists as pl (pl.id)}
							{@render playlistPane(pl)}
						{/each}
					{:else}
						{@render listsEmpty('More playlists appear here')}
					{/if}
				</section>
			</div>
		</main>
	{:else}
		<main
			class="desktop w-full max-w-full overflow-x-hidden max-lg:pb-[80px]"
			class:desk-dark={deskMode === 'dark'}
		>
			<header class="menubar flex flex-wrap">
				<div class="menubar-left">
					<a class="menu-brand" href={homeHref}>{SITE.name}</a>
				</div>
				<div class="menubar-right flex flex-wrap">
					{@render viewTabs()}
					{@render themeSwitcher()}
					{@render authControls()}
					<time class="menu-clock" datetime={clockLabel || undefined}>{clockLabel || '—'}</time>
				</div>
			</header>

			<div class="workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
				<section class="window form-window w-full min-w-0 lg:w-1/2" aria-label="My lists">
					<div class="titlebar">
						<div class="traffic" aria-hidden="true">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
						</div>
						<span class="titlebar-text">~/AuraWatch — My Lists</span>
						<span class="titlebar-tag">LISTS</span>
					</div>
					<div class="window-body form-body">
						<p class="path-line">C:\AuraWatch\lists\</p>
						<h1 class="brand">My Lists</h1>
						<p class="subhead">saved playlists</p>
						<p class="lede">
							{totalItems
								? `${lists.length} playlist${lists.length === 1 ? '' : 's'} · ${totalItems} saved`
								: 'Your saved playlists live here — save picks from Match to fill them.'}
						</p>
						{#if primaryList}
							{@render playlistPane(primaryList)}
						{:else}
							{@render listsEmpty('No playlists yet — save a pick from Match.')}
						{/if}
					</div>
				</section>

				<section class="window result-window w-full min-w-0 lg:w-1/2" aria-label="More lists">
					<div class="titlebar">
						<div class="traffic" aria-hidden="true">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
						</div>
						<span class="titlebar-text">~/AuraWatch — Playlists</span>
						<span class="titlebar-tag">LIST</span>
					</div>
					<div class="window-body result-body">
						{#if moreLists.length}
							{#each moreLists as pl (pl.id)}
								{@render playlistPane(pl)}
							{/each}
						{:else}
							<p class="empty-state">More playlists appear here</p>
						{/if}
					</div>
				</section>
			</div>

			<footer class="taskbar hidden lg:flex">
				<span class="start-btn">{SITE.name}</span>
				<span class="taskbar-tag">my lists</span>
			</footer>
		</main>
	{/if}
	<AppBottomNav active="lists" />
</div>

<style>
	.min-brand {
		text-decoration: none;
		color: inherit;
	}

	.lists-error {
		margin: 0 0 1rem;
		padding: 0.65rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 600;
		line-height: 1.4;
		color: #111;
		background: #fff;
		border: 2px solid #111;
		border-left: 6px solid #ff4c00;
	}

	:global(html[data-ui='minimal']) .lists-error {
		color: #f2f2f5;
		background: #111118;
		border-color: #333;
		border-left-color: #ff4c00;
	}

	:global(.desk-dark) .lists-error {
		color: #e8eaed;
		background: #0c0f14;
		border-color: #2a2f38;
		border-left-color: #ff4c00;
	}

	.playlist-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
	}

	.playlist-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.playlist-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink, #111);
	}

	:global(html[data-ui='minimal']) .playlist-title {
		color: #f3f4f6;
	}

	:global(.desk-dark) .playlist-title {
		color: #e8eaed;
	}

	.playlist-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.playlist-count {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--muted, #9ca3af);
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 1023px) {
		:global(.desktop) .titlebar,
		:global(.desktop) .taskbar,
		:global(.desktop) .menu-clock {
			display: none;
		}
	}
</style>
