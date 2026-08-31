<script lang="ts">
	import SavedListCard from '$lib/components/SavedListCard.svelte';
	import type { LocalTitle } from '$lib/localWatch';

	let {
		open = false,
		variant = 'desktop',
		deskDark = false,
		watchlist,
		ignoredList,
		onClose,
		onRemoveWatch,
		onRestore
	}: {
		open?: boolean;
		variant?: 'desktop' | 'minimal';
		deskDark?: boolean;
		watchlist: LocalTitle[];
		ignoredList: LocalTitle[];
		onClose: () => void;
		onRemoveWatch: (id: string) => void;
		onRestore: (id: string) => void;
	} = $props();

	let tab = $state<'watchlist' | 'ignored'>('watchlist');

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return () => {
			node.remove();
		};
	}
</script>

{#if open}
	<div
		{@attach portalToBody}
		class="lists-backdrop fixed inset-0 z-[70] flex justify-end bg-black/50 p-0 backdrop-blur-sm"
		class:minimal-backdrop={variant === 'minimal'}
		role="presentation"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		<div
			class="lists-drawer"
			class:modal-desktop={variant === 'desktop'}
			class:modal-desk-dark={variant === 'desktop' && deskDark}
			class:modal-minimal={variant === 'minimal'}
			role="dialog"
			aria-modal="true"
			aria-labelledby="lists-drawer-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Escape') onClose();
			}}
		>
			<header class="lists-drawer-head">
				<h2 id="lists-drawer-title" class="lists-drawer-title">My shelf</h2>
				<button type="button" class="lists-drawer-close" onclick={onClose}>Close</button>
			</header>

			<div class="lists-drawer-tabs" role="tablist" aria-label="Local lists">
				<button
					type="button"
					class="lists-drawer-tab"
					class:active={tab === 'watchlist'}
					role="tab"
					aria-selected={tab === 'watchlist'}
					onclick={() => (tab = 'watchlist')}
				>
					Watchlist ({watchlist.length})
				</button>
				<button
					type="button"
					class="lists-drawer-tab"
					class:active={tab === 'ignored'}
					role="tab"
					aria-selected={tab === 'ignored'}
					onclick={() => (tab = 'ignored')}
				>
					Hidden ({ignoredList.length})
				</button>
			</div>

			<div class="lists-drawer-body">
				{#if tab === 'watchlist'}
					{#if watchlist.length}
						{#each watchlist as saved (saved.id)}
							<div class="lists-drawer-item">
								<SavedListCard
									{variant}
									showRemove
									item={{
										id: saved.id,
										title: saved.title,
										cover: saved.cover,
										format: saved.mediaType,
										year: saved.year,
										description: saved.pitch
									}}
									onRemove={() => onRemoveWatch(saved.id)}
								/>
							</div>
						{/each}
					{:else}
						<p class="lists-drawer-empty">Bookmark a pick and it lands here — local, just for you.</p>
					{/if}
				{:else if ignoredList.length}
					<p class="lists-drawer-hint">
						Marked seen or bounced by mistake? Restore it to the match pile.
					</p>
					{#each ignoredList as saved (saved.id)}
						<div class="lists-drawer-item">
							<SavedListCard
								{variant}
								item={{
									id: saved.id,
									title: saved.title,
									cover: saved.cover,
									format: saved.mediaType,
									year: saved.year,
									description: saved.pitch
								}}
							/>
							<button type="button" class="lists-restore" onclick={() => onRestore(saved.id)}>
								Restore
							</button>
						</div>
					{/each}
				{:else}
					<p class="lists-drawer-empty">Nothing dismissed. Hit the checkmark on a card to hide it.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.lists-drawer {
		width: min(28rem, 100%);
		height: 100%;
		max-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--window);
		color: var(--ink);
		border-left: 2px solid var(--line);
		box-shadow: -8px 0 0 var(--line);
		overflow: hidden;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.modal-desktop {
		--window: #ffffff;
		--ink: #111111;
		--muted: #666666;
		--line: #111111;
		--accent: #ff4c00;
		--on-accent: #ffffff;
		--panel: #ffffff;
	}
	.modal-desk-dark {
		--window: #080a0e;
		--ink: #e8eaed;
		--muted: #8b929e;
		--line: #2a2f38;
		--accent: #ff4c00;
		--on-accent: #ffffff;
		--panel: #080a0e;
	}
	.modal-minimal {
		--window: #121218;
		--ink: #f4f4f5;
		--muted: #a1a1aa;
		--line: rgba(255, 255, 255, 0.12);
		--accent: #a78bfa;
		--on-accent: #fff;
		--panel: #16161c;
		border-left: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: none;
		font-family: inherit;
	}
	.lists-drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1rem 0.65rem;
		border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.12));
	}
	.lists-drawer-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.lists-drawer-close {
		appearance: none;
		border: 1.5px solid var(--line, rgba(255, 255, 255, 0.2));
		background: transparent;
		color: inherit;
		cursor: pointer;
		padding: 0.35rem 0.65rem;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.lists-drawer-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.12));
	}
	.lists-drawer-tab {
		flex: 1;
		appearance: none;
		border: none;
		background: transparent;
		color: var(--muted, #a1a1aa);
		cursor: pointer;
		padding: 0.7rem 0.5rem;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.lists-drawer-tab.active {
		color: var(--ink, #fafafa);
		box-shadow: inset 0 -2px 0 var(--accent, #ff4c00);
	}
	.lists-drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.85rem 1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.lists-drawer-empty,
	.lists-drawer-hint {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
		color: var(--muted, #a1a1aa);
	}
	.lists-drawer-item {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.lists-restore {
		appearance: none;
		align-self: flex-start;
		border: 1.5px solid var(--line, rgba(255, 255, 255, 0.2));
		background: var(--accent, #ff4c00);
		color: var(--on-accent, #fff);
		cursor: pointer;
		padding: 0.35rem 0.7rem;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.modal-minimal .lists-restore {
		border-radius: 8px;
		background: rgba(160, 140, 240, 0.28);
		color: inherit;
		border-color: rgba(160, 140, 240, 0.55);
	}
</style>
