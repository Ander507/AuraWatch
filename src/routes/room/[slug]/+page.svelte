<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { signOutEverywhere } from '$lib/discordSignIn';
	import { signInQuery } from '$lib/authRedirect';
	import LikeTitleSelect from '$lib/components/LikeTitleSelect.svelte';
	import {
		ROOM_EXPIRED_MSG,
		roomFiltersSummary,
		type RoomFilters
	} from '$lib/groupVibe';
	import { coverFallbackStyle, mediaInitials } from '$lib/mediaInitials';
	import { SITE } from '$lib/seo';
	import { ui, setUiTheme, setDeskMode, hydrateUiTheme } from '$lib/uiTheme.svelte';
	import '$lib/styles/app-chrome.css';

	type Participant = {
		id: number;
		userName: string;
		vibeNotes: string;
		likedTitles: string[];
	};

	type RoomData = {
		id: string;
		slug: string;
		creatorName: string;
		creatorUserId?: string | null;
		format: string;
		createdAt: string | null;
	};

	type RecProvider = {
		name: string;
		logo: string | null;
		url?: string | null;
		type?: string;
	};

	type RecItem = {
		title: string;
		cover: string;
		pitch: string;
		rating?: number;
		criticScore?: number;
		mediaType?: string;
		kind?: string;
		genres?: string[];
		seasonInfo?: string;
		artist?: string;
		author?: string;
		providers?: RecProvider[];
		storeLinks?: Array<{ platform: string; url: string; store?: string }>;
		listen_url?: string;
		watch_link?: string;
		preview_url?: string;
		trailer_youtube_key?: string;
		platforms?: string[];
		priceLabel?: string;
	};

	let {
		data
	}: {
		data: {
			room: RoomData & { matchedAt?: string | null; filters?: RoomFilters };
			participants: Participant[];
			recommendations?: RecItem[] | Record<string, unknown>[];
			matchedAt?: string | null;
			filters?: RoomFilters;
		};
	} = $props();

	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
	let session = $derived(page.data.session);
	let room = $derived(data.room);
	let isHost = $derived(
		Boolean(session?.user?.id && room.creatorUserId && session.user.id === room.creatorUserId)
	);
	let deleting = $state(false);
	let deleteError = $state('');
	let participantsOverride = $state<Participant[] | null>(null);
	let overrideForSlug = $state('');
	let participants = $derived(
		overrideForSlug === data.room.slug && participantsOverride
			? participantsOverride
			: data.participants
	);

	const homeHref = resolve('/');
	let signInQs = $derived(signInQuery(`${page.url.pathname}${page.url.search}`));

	let shareUrl = $derived(`${page.url.origin}/room/${room.slug}`);
	let storageKey = $derived(`aurawatch_room_${room.slug}`);

	let joinName = $state('');
	let joinNotes = $state('');
	let joinLikes = $state<string[]>([]);
	let joining = $state(false);
	let joinError = $state('');
	let alreadyJoined = $state(false);

	let matching = $state(false);
	let matchError = $state('');
	/** client sync of saved room picks (poll / calculate); falls back to SSR data */
	let syncOverride = $state<{
		slug: string;
		results: RecItem[];
		matchedAt: string | null;
	} | null>(null);

	let results = $derived(
		syncOverride?.slug === data.room.slug
			? syncOverride.results
			: (Array.isArray(data.recommendations) ? data.recommendations : []).map((r) =>
					normalizeRec(r as Record<string, unknown>)
				)
	);
	let matchedAt = $derived(
		syncOverride?.slug === data.room.slug
			? syncOverride.matchedAt
			: (data.matchedAt ?? data.room?.matchedAt ?? null)
	);

	let refreshing = $state(false);
	let copied = $state(false);
	let shareToast = $state('');
	let shareToastTimer: ReturnType<typeof setTimeout> | null = null;
	let clockLabel = $state('');

	const FORMAT_LABELS: Record<string, string> = {
		movie: 'Movies',
		series: 'TV Series',
		anime: 'Anime',
		songs: 'Songs',
		games: 'Games',
		books: 'Books & Manga',
		boardgames: 'Board Games',
		roblox: 'Roblox'
	};

	let formatLabel = $derived(FORMAT_LABELS[room.format] || room.format);
	let roomFilters = $derived(data.filters ?? data.room?.filters);
	let filterLine = $derived(roomFiltersSummary(formatLabel, roomFilters));
	let expiredMsg = $state('');
	let roomGone = $derived(Boolean(expiredMsg));

	let likeTitleKind = $derived.by(() => {
		const f = room.format;
		if (f === 'games') return 'games' as const;
		if (f === 'roblox') return 'roblox' as const;
		if (f === 'boardgames') return 'boardgames' as const;
		if (f === 'books') return 'books' as const;
		if (f === 'songs') return 'music' as const;
		return 'media' as const;
	});

	function formatClock(d = new Date()) {
		const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${weekday}, ${hh}:${mm}`;
	}

	function rememberJoined(name: string) {
		try {
			localStorage.setItem(storageKey, name);
		} catch {
			/* shrug */
		}
	}

	function loadRememberedName() {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				joinName = saved;
				alreadyJoined = participants.some(
					(p) => p.userName.toLowerCase() === saved.toLowerCase()
				);
			}
		} catch {
			/* shrug */
		}
	}

	function asProviders(raw: unknown): RecProvider[] {
		if (!Array.isArray(raw)) return [];
		const out: RecProvider[] = [];
		for (const row of raw.slice(0, 8)) {
			if (!row || typeof row !== 'object') continue;
			const p = row as Record<string, unknown>;
			const name = String(p.name || '').trim();
			if (!name) continue;
			out.push({
				name,
				logo: p.logo ? String(p.logo) : null,
				url: p.url ? String(p.url) : null,
				type: p.type ? String(p.type) : undefined
			});
		}
		return out;
	}

	function asStoreLinks(raw: unknown): RecItem['storeLinks'] {
		if (!Array.isArray(raw)) return undefined;
		const out: NonNullable<RecItem['storeLinks']> = [];
		for (const row of raw.slice(0, 8)) {
			if (!row || typeof row !== 'object') continue;
			const l = row as Record<string, unknown>;
			const platform = String(l.platform || l.store || '').trim();
			const url = String(l.url || '').trim();
			if (!platform || !url) continue;
			out.push({
				platform,
				url,
				store: l.store ? String(l.store) : undefined
			});
		}
		return out.length ? out : undefined;
	}

	function normalizeRec(raw: Record<string, unknown> | null | undefined): RecItem {
		const ratingRaw = raw?.rating ?? raw?.vote_average;
		const criticRaw = raw?.criticScore;
		return {
			title: String(raw?.title || '???'),
			cover: String(raw?.cover || raw?.poster_path || raw?.image || ''),
			pitch: String(
				raw?.pitch || raw?.matchReason || raw?.overview || raw?.description || ''
			),
			rating: typeof ratingRaw === 'number' ? ratingRaw : undefined,
			criticScore: typeof criticRaw === 'number' ? criticRaw : undefined,
			mediaType: raw?.mediaType ? String(raw.mediaType) : undefined,
			kind: raw?.kind ? String(raw.kind) : undefined,
			genres: Array.isArray(raw?.genres)
				? raw.genres.map((g) => String(g)).filter(Boolean).slice(0, 8)
				: undefined,
			seasonInfo: raw?.seasonInfo ? String(raw.seasonInfo) : undefined,
			artist: raw?.artist ? String(raw.artist) : undefined,
			author: raw?.author ? String(raw.author) : undefined,
			providers: asProviders(raw?.providers),
			storeLinks: asStoreLinks(raw?.storeLinks),
			listen_url: raw?.listen_url ? String(raw.listen_url) : undefined,
			watch_link: raw?.watch_link || raw?.watchLink ? String(raw.watch_link || raw.watchLink) : undefined,
			preview_url: raw?.preview_url ? String(raw.preview_url) : undefined,
			trailer_youtube_key: raw?.trailer_youtube_key
				? String(raw.trailer_youtube_key)
				: undefined,
			platforms: Array.isArray(raw?.platforms)
				? raw.platforms.map((p) => String(p)).filter(Boolean)
				: undefined,
			priceLabel: raw?.priceLabel ? String(raw.priceLabel) : undefined
		};
	}

	function recKind(item: RecItem): string {
		const k = (item.kind || '').toLowerCase();
		const mt = (item.mediaType || '').toLowerCase();
		if (k === 'song' || mt === 'song') return 'song';
		if (k === 'game' || mt === 'game') return 'game';
		if (k === 'book' || mt === 'book' || mt === 'manga') return 'book';
		if (k === 'boardgame' || mt === 'board game') return 'board';
		if (k === 'roblox' || mt === 'roblox') return 'roblox';
		return 'media';
	}

	function primaryHref(item: RecItem): string | null {
		if (item.watch_link) return item.watch_link;
		if (item.listen_url) return item.listen_url;
		const store = item.storeLinks?.[0]?.url;
		if (store) return store;
		const tagged = item.providers?.find((p) => p.url)?.url;
		return tagged || null;
	}

	function ctaLabel(item: RecItem): string {
		const kind = recKind(item);
		if (kind === 'song') return 'Listen';
		if (kind === 'game' || kind === 'roblox') return 'Play';
		if (kind === 'book' || kind === 'board') return 'Buy / info';
		return 'Where to watch';
	}

	function applySyncedResults(
		list: unknown[],
		at: string | null | undefined,
		forSlug: string
	) {
		syncOverride = {
			slug: forSlug,
			results: list.map((r) => normalizeRec(r as Record<string, unknown>)),
			matchedAt: at ? String(at) : null
		};
	}

	onMount(() => {
		hydrateUiTheme();
		loadRememberedName();
		clockLabel = formatClock();
		const clockId = setInterval(() => {
			clockLabel = formatClock();
		}, 60_000);
		// soft poll so guests see the same saved group picks after the host calculates
		const pollId = setInterval(() => {
			if (expiredMsg) return;
			void refreshRoom(true);
		}, 8_000);
		return () => {
			clearInterval(clockId);
			clearInterval(pollId);
			if (shareToastTimer) clearTimeout(shareToastTimer);
		};
	});

	const LINK_COPIED_TOAST = '[SYSTEM]: Link copied to clipboard successfully.';

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
				/* clipboard blocked */
			}
		}
	}

	async function deleteThisRoom() {
		if (!isHost || deleting) return;
		const ok = confirm(`Delete room /${room.slug}? Guests will lose access immediately.`);
		if (!ok) return;
		deleting = true;
		deleteError = '';
		try {
			const res = await fetch(`/api/rooms/${room.slug}`, { method: 'DELETE' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				deleteError =
					typeof body?.message === 'string' ? body.message : 'Could not delete room.';
				return;
			}
			await goto(resolve('/room'));
		} catch {
			deleteError = 'Network error — could not delete room.';
		} finally {
			deleting = false;
		}
	}

	async function joinRoom(e: Event) {
		e.preventDefault();
		joinError = '';
		const userName = joinName.trim();
		if (!userName) {
			joinError = 'Name required.';
			return;
		}
		joining = true;
		let applied = false;
		try {
			const res = await fetch(`/api/rooms/${room.slug}/join`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userName,
					vibeNotes: joinNotes.trim(),
					likedTitles: [...joinLikes]
				})
			});
			let body: Record<string, unknown> = {};
			try {
				body = await res.json();
			} catch {
				body = {};
			}
			if (!res.ok) {
				joinError =
					typeof body?.message === 'string'
						? body.message
						: 'Could not join room.';
				return;
			}
			if (Array.isArray(body?.participants)) {
				participantsOverride = body.participants as Participant[];
				overrideForSlug = room.slug;
			}
			rememberJoined(userName);
			alreadyJoined = true;
			applied = true;
			joinError = '';
		} catch (err) {
			console.error('join room failed', err);
			// only show network error when the request never landed a successful update
			if (!applied) joinError = 'Network error — could not join.';
		} finally {
			joining = false;
		}
	}

	async function refreshRoom(silent = false) {
		if (!silent) refreshing = true;
		try {
			const res = await fetch(`/api/rooms/${room.slug}`);
			const body = await res.json().catch(() => ({}));
			if (res.status === 410) {
				expiredMsg =
					typeof body?.message === 'string' ? body.message : ROOM_EXPIRED_MSG;
				return;
			}
			if (!res.ok) return;
			if (Array.isArray(body?.participants)) {
				participantsOverride = body.participants;
				overrideForSlug = room.slug;
				if (joinName.trim()) {
					alreadyJoined = body.participants.some(
						(p: Participant) => p.userName.toLowerCase() === joinName.trim().toLowerCase()
					);
				}
			}
			const list = Array.isArray(body?.recommendations) ? body.recommendations : [];
			const at =
				typeof body?.matchedAt === 'string'
					? body.matchedAt
					: typeof body?.room?.matchedAt === 'string'
						? body.room.matchedAt
						: null;
			if (list.length || at) {
				const stamp = at || '';
				const same =
					syncOverride?.slug === room.slug &&
					syncOverride.matchedAt === stamp &&
					syncOverride.results.length === list.length &&
					syncOverride.results.every((r, i) => r.title === String(list[i]?.title || ''));
				if (!same) applySyncedResults(list, at, room.slug);
			}
		} catch {
			/* ignore */
		} finally {
			if (!silent) refreshing = false;
		}
	}

	async function refreshParticipants() {
		await refreshRoom(false);
	}

	async function calculateMatch() {
		matchError = '';
		if (!isHost || participants.length < 1 || roomGone) return;
		matching = true;
		try {
			// querying all participants in the room and combining their vibes and likes into a single master prompt for the AI engine
			const res = await fetch(`/api/rooms/${room.slug}/match`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' }
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				matchError =
					res.status === 403
						? 'Only the host can calculate the group match.'
						: res.status === 401
							? 'Sign in as the host to calculate.'
							: res.status === 429
								? 'Too many matches — wait a few minutes.'
								: typeof body?.message === 'string'
									? body.message
									: typeof body?.error === 'string'
										? body.error
										: 'Match failed — try again.';
				return;
			}
			// ensuring the group match considers every user's input equally
			if (Array.isArray(body?.participants)) {
				participantsOverride = body.participants;
				overrideForSlug = room.slug;
			}
			const list = Array.isArray(body?.recommendations)
				? body.recommendations
				: body?.recommendation
					? [body.recommendation]
					: [];
			applySyncedResults(list, body?.matchedAt ?? null, room.slug);
			if (!results.length) matchError = 'No matches returned.';
		} catch {
			matchError = 'Network error — could not calculate match.';
		} finally {
			matching = false;
		}
	}
</script>

<svelte:head>
	<title>Room {room.slug} — {SITE.name}</title>
	<meta
		name="description"
		content={`Group vibe room hosted by ${room.creatorName} · ${formatLabel}`}
	/>
	<link rel="canonical" href={shareUrl} />
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
		<a
			class="view-tab-btn room-nav-link active"
			href={resolve('/room')}
			aria-current="page">Group Room</a
		>
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

{#snippet shareBar()}
	<div class="share-bar">
		<code class="share-url">{shareUrl}</code>
		<button type="button" class="share-vibe-btn" onclick={copyLink}>
			{copied ? 'Copied' : 'Copy link'}
		</button>
		{#if isHost}
			<button
				type="button"
				class="share-vibe-btn room-delete-btn"
				disabled={deleting}
				onclick={() => void deleteThisRoom()}
			>
				{deleting ? 'Deleting…' : 'Delete room'}
			</button>
		{/if}
	</div>
	{#if deleteError}
		<p class="room-error" role="alert">{deleteError}</p>
	{/if}
{/snippet}

{#snippet participantsPanel()}
	<div class="panel-block">
		<div class="rec-list-toolbar">
			<p class="rec-list-header">{participants.length} participant{participants.length === 1 ? '' : 's'}</p>
			<button
				type="button"
				class="share-vibe-btn"
				onclick={refreshParticipants}
				disabled={refreshing}
			>
				{refreshing ? 'Refreshing…' : 'Refresh'}
			</button>
		</div>

		{#if participants.length}
			<ul class="participant-list">
				{#each participants as p (p.id)}
					<li class="participant-card">
						<p class="participant-name">{p.userName}</p>
						{#if p.vibeNotes}
							<p class="participant-notes">{p.vibeNotes}</p>
						{/if}
						{#if p.likedTitles?.length}
							<p class="participant-likes">
								likes: {p.likedTitles.join(', ')}
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">No one has joined yet — be the first.</p>
		{/if}
	</div>
{/snippet}

{#snippet joinPanel()}
	<div class="panel-block">
		<p class="rec-list-header">Join this room</p>
		<p class="joined-note">No account needed — just a nickname and your vibe.</p>
		{#if alreadyJoined}
			<p class="joined-note">You’re in as {joinName.trim() || 'yourself'}. Update vibes below anytime.</p>
		{/if}
		<form class="room-form vibe-form" onsubmit={joinRoom}>
			<div class="field">
				<label class="field-label" for="join-name">Your name</label>
				<input
					id="join-name"
					class="vibe-input"
					type="text"
					autocomplete="nickname"
					maxlength="48"
					bind:value={joinName}
					placeholder="Name"
					required
				/>
			</div>
			<div class="field">
				<label class="field-label" for="join-notes">
					Vibe notes <span class="optional">(optional)</span>
				</label>
				<textarea
					id="join-notes"
					class="vibe-input"
					rows="3"
					maxlength="500"
					bind:value={joinNotes}
					placeholder="cozy sci-fi, nothing too scary…"
				></textarea>
			</div>
			<div class="field">
				<label class="field-label" for="join-likes">
					Liked titles <span class="optional">(optional)</span>
				</label>
				<LikeTitleSelect
					id="join-likes"
					bind:values={joinLikes}
					variant={uiTheme === 'desktop' ? 'desktop' : 'dark'}
					kind={likeTitleKind}
				/>
			</div>
			{#if joinError}
				<p class="room-error" role="alert">{joinError}</p>
			{/if}
			<div class="cta-row">
				<button class="cta" type="submit" disabled={joining || roomGone}>
					{joining ? 'Joining…' : alreadyJoined ? 'Update vibe' : 'Join room'}
				</button>
			</div>
		</form>
	</div>
{/snippet}

{#snippet matchPanel()}
	<div class="panel-block">
		<p class="rec-list-header">Group match</p>
		{#if roomGone}
			<p class="joined-note">This room is closed. Open a new one from the rooms page.</p>
		{:else if isHost}
			<p class="joined-note">
				You’re the host — calculate when everyone’s in. Picks save to the room so guests
				see the same list.
			</p>
			<div class="cta-row">
				<button
					class="cta"
					type="button"
					onclick={calculateMatch}
					disabled={matching || participants.length < 1}
				>
					{matching ? 'Matching…' : 'Calculate Group Match'}
				</button>
			</div>
		{:else}
			<p class="joined-note">
				Waiting for {room.creatorName} to calculate. This list updates automatically.
			</p>
		{/if}
		{#if matchError}
			<p class="room-error" role="alert">{matchError}</p>
		{/if}
		{#if matchedAt && results.length}
			<p class="joined-note">
				Synced
				{new Date(matchedAt).toLocaleString(undefined, {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})}
			</p>
		{/if}
		{#if results.length}
			<ul class="result-list">
				{#each results as item, i (item.title + i)}
					{@const href = primaryHref(item)}
					{@const providers = item.providers?.filter((p) => p?.name)?.slice(0, 8) ?? []}
					<li class="result-card">
						{#if item.cover}
							<img class="result-cover" src={item.cover} alt="" loading="lazy" decoding="async" />
						{:else}
							<div
								class="result-cover result-cover-fallback"
								style={coverFallbackStyle(item.title)}
								aria-hidden="true"
							>
								<span class="cover-fallback-initials">{mediaInitials(item.title)}</span>
							</div>
						{/if}
						<div class="result-body">
							<p class="result-title">{item.title}</p>
							{#if item.artist || item.author}
								<p class="result-sub">{item.artist || item.author}</p>
							{/if}
							<p class="result-meta">
								{#if item.mediaType}<span>{item.mediaType}</span>{/if}
								{#if item.seasonInfo}
									{#if item.mediaType}<span class="dot">·</span>{/if}
									<span>{item.seasonInfo}</span>
								{/if}
								{#if item.rating != null}
									<span class="dot">·</span>
									<span class="result-rating">★ {item.rating.toFixed(1)}</span>
								{/if}
								{#if item.priceLabel}
									<span class="dot">·</span>
									<span>{item.priceLabel}</span>
								{/if}
							</p>
							{#if item.pitch}
								<p class="result-pitch">{item.pitch}</p>
							{/if}
							{#if providers.length}
								<div class="provider-row" aria-label="Where to watch">
									{#each providers as p, pi (p.name + String(pi))}
										{#if p.url}
											<a
												class="provider-btn"
												href={p.url}
												target="_blank"
												rel="external noopener noreferrer"
												title={p.name}
												aria-label={p.name}
											>
												{#if p.logo}
													<img src={p.logo} alt="" class="provider-logo" />
												{:else}
													<span class="provider-fallback">{p.name.slice(0, 2)}</span>
												{/if}
											</a>
										{:else}
											<span class="provider-btn" title={p.name} aria-label={p.name}>
												{#if p.logo}
													<img src={p.logo} alt="" class="provider-logo" />
												{:else}
													<span class="provider-fallback">{p.name.slice(0, 2)}</span>
												{/if}
											</span>
										{/if}
									{/each}
								</div>
							{/if}
							{#if item.storeLinks?.length}
								<div class="store-row">
									{#each item.storeLinks.slice(0, 4) as link (link.url)}
										<a
											class="result-cta"
											href={link.url}
											target="_blank"
											rel="external noopener noreferrer"
										>
											{link.store || link.platform}
										</a>
									{/each}
								</div>
							{:else if href}
								<a
									class="result-cta"
									href={href}
									target="_blank"
									rel="external noopener noreferrer"
								>
									{ctaLabel(item)}
								</a>
							{/if}
							{#if item.trailer_youtube_key}
								<a
									class="result-cta result-cta-ghost"
									href={`https://www.youtube.com/watch?v=${item.trailer_youtube_key}`}
									target="_blank"
									rel="external noopener noreferrer"
								>
									Trailer
								</a>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else if !roomGone && !matching}
			<p class="empty-state">
				{#if participants.length < 1}
					Need at least one person in the room before matching.
				{:else if isHost}
					Everyone’s in. Calculate when you’re ready.
				{:else}
					No picks yet — hang tight for the host.
				{/if}
			</p>
		{/if}
	</div>
{/snippet}

{#snippet roomHero()}
	<div class="share-hero">
		<h2 class="list-title">Group room</h2>
		<p class="owner">
			hosted by {room.creatorName} · {filterLine}
		</p>
		{@render shareBar()}
	</div>
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

			<div class="room-page">
				{#if roomGone}
					<p class="room-error" role="alert">{expiredMsg}</p>
				{/if}
				{@render roomHero()}
				{@render participantsPanel()}
				{#if !roomGone}
					{@render joinPanel()}
				{/if}
				{@render matchPanel()}
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

			<div class="workspace flex w-full max-w-full flex-col gap-4 lg:flex-row">
				<section class="window form-window w-full min-w-0 lg:w-1/2" aria-label="Join room">
					<div class="titlebar">
						<div class="traffic" aria-hidden="true">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
						</div>
						<span class="titlebar-text">~/room/{room.slug}</span>
						<span class="titlebar-tag">LIVE</span>
					</div>
					<div class="window-body form-body">
						<p class="path-line">C:\AuraWatch\room\{room.slug}\</p>
						{#if roomGone}
							<p class="room-error" role="alert">{expiredMsg}</p>
						{/if}
						{@render roomHero()}
						{#if !roomGone}
							{@render joinPanel()}
						{/if}
					</div>
				</section>

				<section class="window result-window w-full min-w-0 lg:w-1/2" aria-label="Participants">
					<div class="titlebar">
						<div class="traffic" aria-hidden="true">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
						</div>
						<span class="titlebar-text">Participants & Match</span>
						<span class="titlebar-tag">ROOM</span>
					</div>
					<div class="window-body result-body">
						{@render participantsPanel()}
						{@render matchPanel()}
					</div>
				</section>
			</div>

			<footer class="taskbar hidden lg:flex">
				<span class="start-btn">{SITE.name}</span>
				<span class="taskbar-tag">group vibe · {formatLabel}</span>
			</footer>
		</main>
	{/if}

	{#if shareToast}
		<div class="share-toast" role="status" aria-live="polite" transition:fade={{ duration: 160 }}>
			{shareToast}
		</div>
	{/if}
</div>

<style>
	.min-brand {
		text-decoration: none;
		color: inherit;
	}

	.room-page {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.share-hero {
		margin-bottom: 0.25rem;
	}

	.list-title {
		margin: 0 0 0.25rem;
		font-size: clamp(1.15rem, 3vw, 1.45rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.2;
		color: var(--ink, #111);
	}

	.owner {
		margin: 0 0 0.85rem;
		font-size: 0.78rem;
		color: var(--muted, #666);
	}

	.share-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.share-url {
		flex: 1 1 12rem;
		min-width: 0;
		padding: 0.4rem 0.55rem;
		font-size: 0.68rem;
		font-family: inherit;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		border: 2px solid var(--line, #111);
		background: var(--soft, #f7f7f7);
		color: var(--ink, #111);
	}

	.panel-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.panel-block:last-child {
		margin-bottom: 0;
	}

	.room-form {
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
	}

	.joined-note {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted, #666);
	}

	.participant-list,
	.result-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.participant-card {
		padding: 0.85rem 0;
		border-bottom: 2px solid var(--line, #111);
	}

	.participant-card:last-child {
		border-bottom: none;
	}

	.participant-name {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--ink, #111);
	}

	.participant-notes {
		margin: 0 0 0.3rem;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--ink, #111);
	}

	.participant-likes {
		margin: 0;
		font-size: 0.7rem;
		color: var(--muted, #666);
	}

	.result-card {
		display: flex;
		gap: 0.85rem;
		padding: 0.9rem 0;
		border-bottom: 2px solid var(--line, #111);
	}

	.result-card:last-child {
		border-bottom: none;
	}

	.result-cover {
		width: 4.5rem;
		height: 6.5rem;
		object-fit: cover;
		flex-shrink: 0;
		border: 2px solid var(--line, #111);
		background: var(--soft, #f7f7f7);
	}

	.result-cover-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0.25rem;
		box-sizing: border-box;
	}

	.cover-fallback-initials {
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: -0.04em;
		line-height: 1;
		user-select: none;
		color: #fff;
	}

	.result-body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-start;
	}

	.result-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--ink, #111);
	}

	.result-sub {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted, #666);
	}

	.result-meta {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted, #666);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.result-rating {
		margin: 0;
		font-weight: 600;
		color: var(--accent, #ff4c00);
		text-transform: none;
		letter-spacing: 0;
	}

	.result-pitch {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--muted, #666);
	}

	.provider-row,
	.store-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.15rem;
	}

	.provider-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		overflow: hidden;
		text-decoration: none;
		box-sizing: border-box;
		border: 2px solid var(--line, #111);
		background: var(--soft, #fff);
		color: inherit;
	}

	.provider-logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.provider-fallback {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.result-cta {
		display: inline-flex;
		align-items: center;
		margin-top: 0.2rem;
		padding: 0.28rem 0.55rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink, #111);
		border: 2px solid var(--line, #111);
		background: transparent;
	}

	.result-cta:hover {
		color: var(--accent, #ff4c00);
		border-color: var(--accent, #ff4c00);
	}

	.result-cta-ghost {
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}

	.empty-state {
		margin: 0;
		font-size: 0.78rem;
		color: var(--muted, #666);
	}

	.dot {
		opacity: 0.6;
	}

	@media (max-width: 1023px) {
		.provider-btn {
			width: 2.75rem;
			height: 2.75rem;
		}
		.result-cta {
			min-height: 44px;
			padding: 0.625rem 1rem;
		}
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
		margin: 0.5rem 0 0;
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
			bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		}

		:global(.desktop) .titlebar,
		:global(.desktop) .taskbar,
		:global(.desktop) .menu-clock {
			display: none;
		}
	}

	:global(html[data-ui='minimal']) .share-toast {
		color: #f2f2f5;
		background: #111118;
		border-color: #111;
		border-left-color: #ff4c00;
		box-shadow: 4px 4px 0 #000;
	}
</style>
