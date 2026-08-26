<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { preloadCode, preloadData } from '$app/navigation';
	import { signOutEverywhere } from '$lib/discordSignIn';
	import { signInQuery } from '$lib/authRedirect';
	import SavedListCard from '$lib/components/SavedListCard.svelte';
	import RecommendForm from '$lib/components/RecommendForm.svelte';
	import AppViewTabs from '$lib/components/AppViewTabs.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import { SITE } from '$lib/seo';
	import { ui, setUiTheme, setDeskMode, hydrateUiTheme } from '$lib/uiTheme.svelte';
	import '$lib/styles/app-chrome.css';

	let { data } = $props();

	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
	let session = $derived(page.data.session);

	const homeHref = resolve('/');
	let signInQs = $derived(signInQuery(`${page.url.pathname}${page.url.search}`));

	// prefer current origin so local shares don't point at undeployed prod
	let shareUrl = $derived(`${page.url.origin}/list/${data.list.slug}`);
	let copied = $state(false);
	let shareToast = $state('');
	let shareToastTimer: ReturnType<typeof setTimeout> | null = null;
	let clockLabel = $state('');
	// moving tabs to a bottom nav bar because making users reach to the top of their phone is terrible ux
	let mobilePane = $state<'vibe' | 'list'>('list');

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
		// warming the home route so Match isn't sitting around waiting on turso
		void preloadCode(homeHref);
		void preloadData(homeHref);
		return () => {
			clearInterval(id);
			if (shareToastTimer) clearTimeout(shareToastTimer);
		};
	});

	const LINK_COPIED_TOAST = '[SYSTEM]: Link copied to clipboard successfully.';

	// dropping a retro terminal toast notification so users actually know when their link was copied
	function showShareToast(msg: string) {
		shareToast = msg;
		if (shareToastTimer) clearTimeout(shareToastTimer);
		shareToastTimer = setTimeout(() => {
			shareToast = '';
			shareToastTimer = null;
		}, 3000);
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			showShareToast(LINK_COPIED_TOAST);
			setTimeout(() => (copied = false), 1600);
		} catch {
			try {
				const ta = document.createElement('textarea');
				ta.value = shareUrl;
				ta.setAttribute('readonly', '');
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
				copied = true;
				showShareToast(LINK_COPIED_TOAST);
				setTimeout(() => (copied = false), 1600);
			} catch {
				/* clipboard blocked — oh well */
			}
		}
	}
</script>

<svelte:head>
	<title>{data.list.title} — {SITE.name}</title>
	<meta
		name="description"
		content={`Shared vibe list${data.list.ownerName ? ` by ${data.list.ownerName}` : ''} on AuraWatch`}
	/>
	<link rel="canonical" href={shareUrl} />
	<meta property="og:title" content={`${data.list.title} — AuraWatch`} />
	<meta property="og:url" content={shareUrl} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#snippet themeSwitcher()}
	<!-- wiring up the theme toggle so visitors can switch between retro and minimal modes -->
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
	<AppViewTabs active="shared" />
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

{#snippet sharedList()}
	<!-- nuking the 'find your own vibe' link since the search form is right there on the left now -->
	<div class="share-hero">
		<h2 class="list-title">{data.list.title}</h2>
		{#if data.list.ownerName}
			<p class="subhead owner">curated by {data.list.ownerName}</p>
		{/if}
	</div>

	{#if data.items.length}
		<div class="aura-list flex h-fit flex-col justify-start gap-4">
			<div class="rec-list-toolbar">
				<p class="rec-list-header">{data.items.length} saved</p>
				<button type="button" class="share-vibe-btn" onclick={copyLink}>
					{copied ? 'Copied' : 'Copy link'}
				</button>
			</div>
			{#each data.items as item (item.id)}
				<!-- slapping h-fit on the individual cards so they stop stretching to the bottom of the screen -->
				<div class="h-fit">
					<SavedListCard
						variant={uiTheme}
						item={{
							id: item.id,
							title: item.title,
							cover: item.coverUrl || '',
							format: item.format,
							description: item.description || undefined,
							providers: item.providers
						}}
					/>
				</div>
			{/each}
		</div>
	{:else}
		<p class="empty-state">This list is empty — nothing saved yet.		</p>
	{/if}
{/snippet}

{#snippet mobileBottomNav()}
	<AppBottomNav
		active={mobilePane === 'vibe' ? 'vibe' : 'lists'}
		showVibe
		onVibe={() => (mobilePane = 'vibe')}
		onLists={() => (mobilePane = 'list')}
		listsLabel="List"
	/>
{/snippet}

<!-- wrapping chrome styles so they cannot leak onto Match after you visit a list -->
<div class="share-app w-full max-w-full overflow-x-hidden">
{#if uiTheme === 'minimal'}
	<main class="minimal mobile-shell-{mobilePane} w-full max-w-full overflow-x-hidden max-lg:pb-[80px]">
		<!-- updating the top nav so the buttons don't crush each other on phones -->
		<header class="min-top flex flex-wrap">
			<a class="min-brand" href={resolve('/')}>{SITE.name}</a>
			<div class="header-controls flex flex-wrap">
				{@render viewTabs()}
				{@render themeSwitcher()}
				{@render authControls()}
			</div>
		</header>

		<p class="min-headline">
			Can’t find what to watch? Get one movie, show, anime, song, or game that fits your vibe.
		</p>

		<!-- making sure the main container actually uses flex-col on small screens so it stacks properly -->
		<div class="min-workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
			<!-- stripping out hardcoded pixel widths that were breaking the mobile view and causing the black void -->
			<section class="min-form w-full min-w-0 lg:w-1/2" aria-label="Recommend">
				<RecommendForm theme="minimal" />
			</section>
			<section class="min-result w-full min-w-0 lg:w-1/2" aria-label="Shared list">
				{@render sharedList()}
			</section>
		</div>
	</main>
{:else}
	<main
		class="desktop mobile-shell-{mobilePane} w-full max-w-full overflow-x-hidden max-lg:pb-[80px]"
		class:desk-dark={deskMode === 'dark'}
	>
		<!-- updating the top nav so the buttons don't crush each other on phones -->
		<header class="menubar flex flex-wrap">
			<div class="menubar-left">
				<a class="menu-brand" href={resolve('/')}>{SITE.name}</a>
			</div>
			<div class="menubar-right flex flex-wrap">
				{@render viewTabs()}
				{@render themeSwitcher()}
				{@render authControls()}
				<time class="menu-clock" datetime={clockLabel || undefined}>{clockLabel || '—'}</time>
			</div>
		</header>

		<!-- making sure the main container actually uses flex-col on small screens so it stacks properly -->
		<div class="workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
			<!-- stripping out hardcoded pixel widths that were breaking the mobile view and causing the black void -->
			<section class="window form-window w-full min-w-0 bg-white lg:w-1/2" aria-label="Recommend">
				<div class="titlebar">
					<div class="traffic" aria-hidden="true">
						<span class="dot red"></span>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">~/AuraWatch — Recommend</span>
					<span class="titlebar-tag">LIVE</span>
				</div>
				<div class="window-body form-body bg-white">
					<p class="path-line">C:\AuraWatch\</p>
					<h1 class="brand">AuraWatch</h1>
					<p class="subhead">can’t find what to watch?</p>
					<p class="lede">
						Pick a format and genres. We’ll hand you a movie, show, anime, song, or game that
						fits — so you stop scrolling and start watching or playing.
					</p>
					<RecommendForm theme="desktop" />
				</div>
			</section>

			<!-- ripping out flex-1 and justify-between so the cards stack neatly at the top instead of stretching everywhere -->
			<section class="window result-window w-full min-w-0 lg:w-1/2" aria-label="Shared list">
				<div class="titlebar">
					<div class="traffic" aria-hidden="true">
						<span class="dot red"></span>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">~/AuraWatch — Shared List</span>
					<span class="titlebar-tag">LIST</span>
				</div>
					<div class="window-body result-body">
						<p class="path-line">C:\AuraWatch\list\</p>
						{@render sharedList()}
					</div>
			</section>
		</div>

		<footer class="taskbar hidden lg:flex">
			<span class="start-btn">AuraWatch</span>
			<span class="taskbar-tag">can’t find what to watch?</span>
		</footer>
	</main>
{/if}
{@render mobileBottomNav()}

{#if shareToast}
	<!-- dropping a retro terminal toast notification so users actually know when their link was copied -->
	<div class="share-toast" role="status" aria-live="polite" transition:fade={{ duration: 160 }}>{shareToast}</div>
{/if}
</div>

<!-- same crawlable footer as Match — it was getting clipped when the list page locked overflow -->
<section class="seo-faq" aria-label="About AuraWatch">
	<h2>Can’t find what to watch tonight?</h2>
	<p>
		AuraWatch is a free vibe-based recommender for people stuck in Netflix decision fatigue. Tell
		it your format, genres, decade, and titles you already like — it returns one strong match with
		posters, trailers or song previews, and where-to-watch or listen links.
	</p>
	<h3>What should I watch if nothing sounds good?</h3>
	<p>
		Add a short note about the mood you want (cozy, western, high-energy), pick a few genres, and
		optionally a show or movie you already love. AuraWatch scores picks against that vibe instead
		of dumping endless rows.
	</p>
	<h3>Movie, TV, anime, song, and game picks</h3>
	<p>
		Use Movies, TV Series, Anime, Songs, or Games mode. Song mode includes listen links for Apple
		Music, Spotify, and YouTube when available. Games mode pulls covers, platforms, and store links
		from IGDB.
	</p>
</section>

<style>
	/* hiding the bar on shared lists so the desk looks clean, wheel/trackpad still move the page */
	:global(html) {
		scrollbar-width: none;
	}
	:global(html::-webkit-scrollbar) {
		display: none;
	}

	.min-brand {
		text-decoration: none;
		color: inherit;
	}

	.share-hero {
		margin-bottom: 1rem;
	}

	.list-title {
		margin: 0 0 0.25rem;
		font-size: clamp(1.45rem, 4vw, 2.1rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.15;
		color: var(--ink);
	}

	.owner {
		margin: 0;
	}

	.share-toast {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 80;
		padding: 0.65rem 0.95rem 0.65rem 0.85rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.35;
		color: #111;
		background: #fff;
		border: 2px solid #111;
		border-left: 6px solid #ff4c00;
		box-shadow: 4px 4px 0 #111;
		pointer-events: none;
		max-width: min(22rem, calc(100vw - 2rem));
	}

	@media (max-width: 1023px) {
		.share-toast {
			left: 50%;
			right: auto;
			transform: translateX(-50%);
			bottom: calc(80px + env(safe-area-inset-bottom, 0px) + 0.75rem);
		}
	}

	:global(html[data-ui='minimal']) .share-toast {
		color: #f2f2f5;
		background: #111118;
		border-color: #111;
		border-left-color: #ff4c00;
		box-shadow: 4px 4px 0 #000;
	}

	.form-window,
	.form-body {
		background-color: #fff;
	}

	.seo-faq {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 3.5rem;
		color: rgba(243, 244, 246, 0.55);
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.seo-faq h2,
	.seo-faq h3 {
		color: rgba(243, 244, 246, 0.78);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 1.25rem 0 0.4rem;
	}

	.seo-faq h2 {
		font-size: 1.15rem;
		margin-top: 0;
	}

	.seo-faq p {
		margin: 0 0 0.75rem;
	}
</style>
