<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { signOutEverywhere } from '$lib/discordSignIn';
	import { signInQuery } from '$lib/authRedirect';
	import RegionSelect from '$lib/components/RegionSelect.svelte';
	import PlatformSelect from '$lib/components/PlatformSelect.svelte';
	import { parseRoomFilters } from '$lib/groupVibe';
	import { CONTENT_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage } from '$lib/languages';
	import { detectRegionFromLocale, normalizeRegion } from '$lib/regions';
	import { SITE } from '$lib/seo';
	import { ui, setUiTheme, setDeskMode, hydrateUiTheme } from '$lib/uiTheme.svelte';
	import '$lib/styles/app-chrome.css';

	let {
		data
	}: {
		data: {
			tursoReady: boolean;
			session: any;
			myRooms?: Array<{
				id: string;
				slug: string;
				format: string;
				creatorName: string;
				createdAt: string;
			}>;
		};
	} = $props();

	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
	let session = $derived(data.session ?? page.data.session);
	let signedIn = $derived(Boolean(session?.user?.id));

	let roomsOverride = $state<
		| Array<{
				id: string;
				slug: string;
				format: string;
				creatorName: string;
				createdAt: string;
		  }>
		| null
	>(null);
	let myRooms = $derived(roomsOverride ?? data.myRooms ?? []);
	let deletingSlug = $state<string | null>(null);
	let deleteError = $state('');

	const homeHref = resolve('/');
	let signInQs = $derived(signInQuery(`${page.url.pathname}${page.url.search}`));

	const FORMAT_OPTIONS = [
		{ id: 'movie', label: 'Movies' },
		{ id: 'series', label: 'TV Series' },
		{ id: 'anime', label: 'Anime' },
		{ id: 'songs', label: 'Songs' },
		{ id: 'games', label: 'Games' },
		{ id: 'books', label: 'Books & Manga' },
		{ id: 'boardgames', label: 'Board Games' },
		{ id: 'roblox', label: 'Roblox' }
	] as const;

	const FORMAT_LABELS: Record<string, string> = Object.fromEntries(
		FORMAT_OPTIONS.map((o) => [o.id, o.label])
	);

	const DECADE_OPTIONS = [
		{ id: '', label: 'Any era' },
		{ id: '1980s', label: '1980s' },
		{ id: '1990s', label: '1990s' },
		{ id: '2000s', label: '2000s' },
		{ id: '2010s', label: '2010s' },
		{ id: '2020s', label: '2020s' }
	];

	const MATURITY_OPTIONS = [
		{ id: '', label: 'Any rating' },
		{ id: 'family', label: 'Family Friendly' },
		{ id: 'teen', label: 'Teen' },
		{ id: 'mature', label: 'Mature' }
	];

	const REGION_KEY = 'aurawatch_region';
	const LANG_KEY = 'aurawatch_language';

	function formatCreated(iso: string) {
		try {
			return new Date(iso).toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}

	async function deleteRoom(slug: string) {
		if (!signedIn || deletingSlug) return;
		const ok = confirm(`Delete room /${slug}? Guests will lose access immediately.`);
		if (!ok) return;
		deleteError = '';
		deletingSlug = slug;
		const prev = myRooms;
		roomsOverride = myRooms.filter((r) => r.slug !== slug);
		try {
			const res = await fetch(`/api/rooms/${slug}`, { method: 'DELETE' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				roomsOverride = prev;
				deleteError =
					typeof body?.message === 'string' ? body.message : 'Could not delete room.';
				return;
			}
		} catch {
			roomsOverride = prev;
			deleteError = 'Network error — could not delete room.';
		} finally {
			deletingSlug = null;
		}
	}

	let creatorName = $state('');
	let format = $state<(typeof FORMAT_OPTIONS)[number]['id']>('movie');
	let watchRegion = $state('US');
	let language = $state(DEFAULT_LANGUAGE);
	let decade = $state('');
	let maturity = $state('');
	let platforms = $state<string[]>([]);
	let antiVibe = $state('');
	let isGames = $derived(format === 'games');
	let submitting = $state(false);
	let errorMsg = $state('');
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
		if (session?.user?.name) creatorName = String(session.user.name);
		try {
			const savedRegion = localStorage.getItem(REGION_KEY);
			watchRegion = normalizeRegion(savedRegion || detectRegionFromLocale() || 'US');
			const savedLang = localStorage.getItem(LANG_KEY);
			if (savedLang) language = normalizeLanguage(savedLang);
		} catch {
			watchRegion = normalizeRegion(detectRegionFromLocale() || 'US');
		}
		const id = setInterval(() => {
			clockLabel = formatClock();
		}, 60_000);
		return () => clearInterval(id);
	});

	async function createRoom(e: Event) {
		e.preventDefault();
		errorMsg = '';
		if (!data.tursoReady) {
			errorMsg = 'Group rooms need the database configured. Try again later.';
			return;
		}
		if (!signedIn) {
			errorMsg = 'Sign in to create a room — guests can still join your share link without logging in.';
			return;
		}
		const name = creatorName.trim() || String(session?.user?.name || 'Host');
		submitting = true;
		try {
			const res = await fetch('/api/rooms/create', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					creatorName: name,
					format,
					filters: parseRoomFilters(
						{
							region: watchRegion,
							language,
							decade,
							maturity,
							platforms,
							antiVibe
						},
						format
					)
				})
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				errorMsg =
					res.status === 401
						? 'Sign in to create a room — guests join the link without an account.'
						: typeof body?.message === 'string'
							? body.message
							: 'Could not create room.';
				return;
			}
			const slug = String(body?.slug || '');
			if (!slug) {
				errorMsg = 'Room created but no link returned.';
				return;
			}
			await goto(resolve(`/room/${slug}` as `/room/${string}`));
		} catch {
			errorMsg = 'Network error — could not create room.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Group Vibe Room — {SITE.name}</title>
	<meta
		name="description"
		content="Start a Group Vibe Room — everyone drops their vibe, AuraWatch finds the sweet spot."
	/>
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
	<div class="view-tabs hidden lg:inline-flex" role="group" aria-label="App views">
		<span class="view-tab-btn room-nav-link active" aria-current="page">Group Room</span>
		<a class="view-tab-btn" href={homeHref}>Match</a>
		<a class="view-tab-btn" href={resolve('/lists')}>My lists</a>
	</div>
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

{#snippet filterFields()}
	<div class="field">
		<span class="field-label" id="room-region-label">Watch region</span>
		<RegionSelect
			id="room-region"
			bind:value={watchRegion}
			variant={uiTheme === 'minimal' ? 'minimal' : 'desktop'}
		/>
	</div>
	<div class="field">
		<label class="field-label" for="room-language">Titles language</label>
		<select id="room-language" class="vibe-input lang-select" bind:value={language}>
			{#each CONTENT_LANGUAGES as lang (lang.code)}
				<option value={lang.code}>{lang.label}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label class="field-label" for="room-decade">Decade / era</label>
		<select id="room-decade" class="vibe-input lang-select" bind:value={decade}>
			{#each DECADE_OPTIONS as opt (opt.id || 'any')}
				<option value={opt.id}>{opt.label}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label class="field-label" for="room-maturity">Content rating</label>
		<select id="room-maturity" class="vibe-input lang-select" bind:value={maturity}>
			{#each MATURITY_OPTIONS as opt (opt.id || 'any')}
				<option value={opt.id}>{opt.label}</option>
			{/each}
		</select>
	</div>
	{#if isGames}
		<div class="field">
			<span class="field-label" id="room-platforms-label">Platforms</span>
			<PlatformSelect
				id="room-platforms"
				bind:values={platforms}
				variant={uiTheme === 'desktop' ? 'desktop' : 'dark'}
			/>
		</div>
	{/if}
	<div class="field">
		<label class="field-label" for="room-anti">
			Exclude / anti-vibe <span class="optional">(optional)</span>
		</label>
		<textarea
			id="room-anti"
			class="vibe-input"
			rows="2"
			maxlength="280"
			bind:value={antiVibe}
			placeholder="horror, jump scares…"
		></textarea>
	</div>
{/snippet}

{#snippet myRoomsPanel()}
	{#if signedIn && myRooms.length}
		<section class="my-rooms" aria-label="My active rooms">
			<p class="my-rooms-header">My active rooms</p>
			<p class="my-rooms-hint">Rooms self-destruct after 24 hours.</p>
			{#if deleteError}
				<p class="room-error" role="alert">{deleteError}</p>
			{/if}
			<ul class="my-rooms-list">
				{#each myRooms as room (room.id)}
					<li class="my-room-row">
						<div class="my-room-meta">
							<a
								class="my-room-slug"
								href={resolve(`/room/${room.slug}` as `/room/${string}`)}
							>
								/{room.slug}
							</a>
							<p class="my-room-detail">
								{FORMAT_LABELS[room.format] || room.format}
								· opened {formatCreated(room.createdAt)}
							</p>
						</div>
						<div class="my-room-actions">
							<a
								class="cta my-room-open"
								href={resolve(`/room/${room.slug}` as `/room/${string}`)}
							>
								Open
							</a>
							<button
								type="button"
								class="my-room-delete"
								disabled={deletingSlug === room.slug}
								onclick={() => void deleteRoom(room.slug)}
							>
								{deletingSlug === room.slug ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else if signedIn && data.tursoReady}
		<p class="my-rooms-empty">No active rooms yet — create one above. They expire after 24 hours.</p>
	{/if}
{/snippet}

<div class="share-app w-full max-w-full overflow-x-hidden">
	{#if uiTheme === 'minimal'}
		<main class="minimal w-full max-w-full overflow-x-hidden">
			<header class="min-top flex flex-wrap">
				<a class="min-brand" href={homeHref}>{SITE.name}</a>
				<div class="header-controls flex flex-wrap">
					{@render viewTabs()}
					{@render themeSwitcher()}
					{@render authControls()}
				</div>
			</header>

			<div class="room-landing">
				<p class="min-headline">Group Vibe Room</p>
				<p class="room-lede">
					Host signs in to open a room. Share the link — guests only need a nickname and their
					vibe. Rooms expire after 24 hours.
				</p>

				{#if !data.tursoReady}
					<p class="room-error" role="alert">
						Group rooms need the database configured. Try again later.
					</p>
				{:else if !signedIn}
					<p class="room-error" role="alert">
						Sign in to create a Group Vibe Room. Guests joining your link never need an account.
					</p>
					<p class="room-back">
						<a href={`${resolve('/signin')}${signInQs}`}>Sign in →</a>
					</p>
				{:else}
					<form class="room-form vibe-form" onsubmit={createRoom}>
						<div class="field">
							<label class="field-label" for="host-name">Host name</label>
							<input
								id="host-name"
								class="vibe-input"
								type="text"
								autocomplete="nickname"
								maxlength="48"
								bind:value={creatorName}
								placeholder="Your name"
								required
							/>
						</div>
						<div class="field">
							<label class="field-label" for="room-format">Format</label>
							<select id="room-format" class="vibe-input lang-select" bind:value={format}>
								{#each FORMAT_OPTIONS as opt (opt.id)}
									<option value={opt.id}>{opt.label}</option>
								{/each}
							</select>
						</div>
						{@render filterFields()}
						{#if errorMsg}
							<p class="room-error" role="alert">{errorMsg}</p>
						{/if}
						<div class="cta-row">
							<button class="cta" type="submit" disabled={submitting}>
								{submitting ? 'Creating…' : 'Create room'}
							</button>
						</div>
					</form>
					{@render myRoomsPanel()}
				{/if}

				<p class="room-back">
					<a href={resolve('/')}>← Back home</a>
				</p>
			</div>
		</main>
	{:else}
		<main
			class="desktop w-full max-w-full overflow-x-hidden"
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

			<div class="workspace flex w-full max-w-full justify-center">
				<section class="window form-window room-window w-full min-w-0" aria-label="Create room">
					<div class="titlebar">
						<div class="traffic" aria-hidden="true">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
						</div>
						<span class="titlebar-text">~/AuraWatch — Group Room</span>
						<span class="titlebar-tag">NEW</span>
					</div>
					<div class="window-body form-body">
						<p class="path-line">C:\AuraWatch\room\</p>
						<h1 class="brand room-brand">{SITE.name}</h1>
						<p class="subhead">group vibe room</p>
						<p class="lede">
							Host signs in to open a room. Share the link — guests only need a nickname and
							their vibe. Rooms expire after 24 hours.
						</p>

						{#if !data.tursoReady}
							<p class="room-error" role="alert">
								Group rooms need the database configured. Try again later.
							</p>
						{:else if !signedIn}
							<p class="room-error" role="alert">
								Sign in to create a Group Vibe Room. Guests joining your link never need an
								account.
							</p>
							<p class="room-back">
								<a href={`${resolve('/signin')}${signInQs}`}>Sign in →</a>
							</p>
						{:else}
							<form class="room-form vibe-form" onsubmit={createRoom}>
								<div class="field">
									<label class="field-label" for="host-name-desk">Host name</label>
									<input
										id="host-name-desk"
										class="vibe-input"
										type="text"
										autocomplete="nickname"
										maxlength="48"
										bind:value={creatorName}
										placeholder="Your name"
										required
									/>
								</div>
								<div class="field">
									<label class="field-label" for="room-format-desk">Format</label>
									<select
										id="room-format-desk"
										class="vibe-input lang-select"
										bind:value={format}
									>
										{#each FORMAT_OPTIONS as opt (opt.id)}
											<option value={opt.id}>{opt.label}</option>
										{/each}
									</select>
								</div>
								{@render filterFields()}
								{#if errorMsg}
									<p class="room-error" role="alert">{errorMsg}</p>
								{/if}
								<div class="cta-row">
									<button class="cta" type="submit" disabled={submitting}>
										{submitting ? 'Creating…' : 'Create room'}
									</button>
								</div>
							</form>
							{@render myRoomsPanel()}
						{/if}

						<p class="room-back">
							<a href={resolve('/')}>← Back home</a>
						</p>
					</div>
				</section>
			</div>

			<footer class="taskbar hidden lg:flex">
				<span class="start-btn">{SITE.name}</span>
				<span class="taskbar-tag">group vibe rooms</span>
			</footer>
		</main>
	{/if}
</div>

<style>
	.min-brand {
		text-decoration: none;
		color: inherit;
	}

	.room-landing {
		max-width: 32rem;
		margin: 0 auto;
		padding: 1.25rem 1.25rem 3rem;
	}

	.room-lede {
		margin: 0 0 1.35rem;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--muted, #9ca3af);
	}

	.room-window {
		max-width: 36rem;
	}

	.room-brand {
		font-size: clamp(1.85rem, 6vw, 2.6rem);
	}

	.room-form {
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
	}

	.room-error {
		margin: 0;
		padding: 0.65rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 600;
		line-height: 1.4;
		color: #111;
		background: #fff;
		border: 2px solid #111;
		border-left: 6px solid #ff4c00;
	}

	:global(html[data-ui='minimal']) .room-error {
		color: #f2f2f5;
		background: #111118;
		border-color: #333;
		border-left-color: #ff4c00;
	}

	:global(.desk-dark) .room-error {
		color: #e8eaed;
		background: #0c0f14;
		border-color: #2a2f38;
		border-left-color: #ff4c00;
	}

	.room-back {
		margin: 1.5rem 0 0;
		font-size: 0.78rem;
	}

	.room-back a {
		color: var(--accent, #ff4c00);
		text-decoration: none;
		font-weight: 600;
	}

	.room-back a:hover {
		text-decoration: underline;
	}

	.my-rooms {
		margin-top: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.my-rooms-header {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted, #9ca3af);
	}

	.my-rooms-hint,
	.my-rooms-empty {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.4;
		color: var(--muted, #9ca3af);
	}

	.my-rooms-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.my-room-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.7rem 0.8rem;
		border: 2px solid var(--line, #111);
		background: var(--panel, #fff);
	}

	:global(html[data-ui='minimal']) .my-room-row {
		border-color: #333;
		background: #111118;
	}

	:global(.desk-dark) .my-room-row {
		border-color: #2a2f38;
		background: #0c0f14;
	}

	.my-room-meta {
		min-width: 0;
		flex: 1;
	}

	.my-room-slug {
		display: block;
		font-family: ui-monospace, 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent, #ff4c00);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.my-room-slug:hover {
		text-decoration: underline;
	}

	.my-room-detail {
		margin: 0.2rem 0 0;
		font-size: 0.72rem;
		color: var(--muted, #9ca3af);
	}

	a.my-room-open {
		flex-shrink: 0;
		text-decoration: none;
		padding: 0.35rem 0.7rem;
		font-size: 0.75rem;
	}

	.my-room-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.my-room-delete {
		appearance: none;
		cursor: pointer;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.35rem 0.7rem;
		border: 2px solid var(--line, #111);
		background: transparent;
		color: var(--ink, #111);
	}

	.my-room-delete:hover:not(:disabled) {
		border-color: #ff4c00;
		color: #ff4c00;
	}

	.my-room-delete:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	:global(html[data-ui='minimal']) .my-room-delete {
		border-color: #444;
		color: #f2f2f5;
	}

	:global(.desk-dark) .my-room-delete {
		border-color: #2a2f38;
		color: #e8eaed;
	}

	@media (max-width: 1023px) {
		:global(.desktop) .titlebar,
		:global(.desktop) .taskbar,
		:global(.desktop) .menu-clock {
			display: none;
		}
	}
</style>
