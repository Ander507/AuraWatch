<script lang="ts">
	import { fade } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { signInWithDiscord } from '$lib/discordSignIn';
	import { registerWithEmail, signInWithEmail } from '$lib/emailAuth';
	import { usernameToAuthEmail } from '$lib/usernameAuth';
	import { ui } from '$lib/uiTheme.svelte';

	let {
		open = $bindable(false),
		title = 'Sign in to save',
		message = 'Cloud sync needs a login so you can share your vibe list.',
		discordCallback = '/',
		/** If set, written to sessionStorage as aurawatch_after_login before Discord OAuth */
		afterLoginKey = '' as string,
		onSuccess
	}: {
		open?: boolean;
		title?: string;
		message?: string;
		discordCallback?: string;
		afterLoginKey?: string;
		onSuccess?: () => void | Promise<void>;
	} = $props();

	let isRegistering = $state(false);
	let authError = $state('');
	let authBusy = $state(false);

	function close() {
		open = false;
		isRegistering = false;
		authError = '';
		authBusy = false;
	}

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return () => {
			node.remove();
		};
	}

	function loginWithDiscord() {
		try {
			if (afterLoginKey) {
				sessionStorage.setItem('aurawatch_after_login', afterLoginKey);
			}
		} catch {
			/* private mode */
		}
		void signInWithDiscord(discordCallback);
	}

	async function submitEmailAuth(e: SubmitEvent) {
		e.preventDefault();
		const formEl = e.currentTarget as HTMLFormElement;
		const fd = new FormData(formEl);
		const username = String(fd.get('username') || '');
		const email = usernameToAuthEmail(username);
		const password = String(fd.get('password') || '');
		const name = String(fd.get('name') || '');
		authBusy = true;
		authError = '';
		try {
			if (!email || !password) {
				authError = 'Username and password required';
				return;
			}
			const result = isRegistering
				? await registerWithEmail({ email, password, name })
				: await signInWithEmail(email, password);
			if (!result.ok) {
				authError = result.error;
				return;
			}
			close();
			await invalidateAll();
			await onSuccess?.();
		} catch {
			authError = 'Couldn’t do that — try again';
		} finally {
			authBusy = false;
		}
	}
</script>

{#if open}
	<!-- centering the auth modal dead-center on the screen using flex items-center justify-center -->
	<div
		{@attach portalToBody}
		class="auth-modal-backdrop login-prompt-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		class:minimal-backdrop={ui.theme === 'minimal'}
		role="presentation"
		onclick={() => close()}
		onkeydown={(e) => {
			if (e.key === 'Escape') close();
		}}
		transition:fade={{ duration: 160 }}
	>
		<div
			class="term-modal mx-auto my-auto h-fit min-h-0 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
			class:modal-desktop={ui.theme === 'desktop'}
			class:modal-desk-dark={ui.theme === 'desktop' && ui.deskMode === 'dark'}
			class:modal-minimal={ui.theme === 'minimal'}
			role="dialog"
			aria-modal="true"
			aria-labelledby="login-prompt-title"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Escape') close();
			}}
		>
			{#if ui.theme === 'desktop'}
				<div class="term-titlebar">
					<div class="traffic" aria-hidden="true">
						<button
							type="button"
							class="dot red"
							aria-label="Close"
							onclick={() => close()}
						></button>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
					</div>
					<span class="titlebar-text">~/AuraWatch — {isRegistering ? 'Register' : 'Sign in'}</span>
					<span class="titlebar-tag">AUTH</span>
				</div>
			{/if}
			<div class="term-modal-body">
				<h2 id="login-prompt-title">{isRegistering ? 'Create account' : title}</h2>
				<p>{message}</p>
				<div class="login-prompt-actions">
					<button type="button" class="term-btn primary discord" onclick={loginWithDiscord}>
						Login with Discord
					</button>
					<form class="login-cred-form" onsubmit={submitEmailAuth}>
						{#if isRegistering}
							<input
								type="text"
								name="name"
								autocomplete="name"
								placeholder="What should we call you"
							/>
						{/if}
						<input
							type="text"
							name="username"
							required
							placeholder="Enter your username"
							autocomplete="username"
							spellcheck="false"
						/>
						<input
							type="password"
							name="password"
							required
							placeholder="Password"
							autocomplete={isRegistering ? 'new-password' : 'current-password'}
							minlength={isRegistering ? 8 : undefined}
						/>
						{#if authError}
							<p class="auth-modal-err" role="alert">{authError}</p>
						{/if}
						<button type="submit" class="term-btn primary" disabled={authBusy}>
							{authBusy ? 'Working…' : isRegistering ? 'CREATE ACCOUNT' : 'SIGN IN'}
						</button>
					</form>
					<button
						type="button"
						class="auth-link"
						onclick={() => {
							isRegistering = !isRegistering;
							authError = '';
						}}
					>
						{isRegistering ? 'Already registered? Sign in <-' : 'Need an account? Register ->'}
					</button>
					<button type="button" class="term-btn" onclick={() => close()}>Not now</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.login-prompt-backdrop {
		background: rgba(26, 26, 26, 0.55);
		align-items: center;
		justify-content: center;
		inset: 0;
		width: 100%;
		min-height: 100dvh;
		height: 100dvh;
		overscroll-behavior: none;
	}
	.login-prompt-backdrop.minimal-backdrop {
		background: rgba(8, 8, 12, 0.72);
	}
	.term-modal {
		height: fit-content;
		min-height: 0;
		max-height: 85vh;
		width: 100%;
		max-width: 28rem;
		flex: none;
		align-self: center;
		overflow-y: auto;
	}
	.auth-modal-backdrop {
		position: fixed !important;
		inset: 0 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		width: 100vw;
		height: 100dvh;
		margin: 0;
		padding: 1rem;
		z-index: 200;
	}
	.auth-modal-backdrop .term-modal {
		margin: auto !important;
		align-self: center !important;
		position: relative !important;
		inset: auto !important;
		top: auto !important;
		left: auto !important;
		right: auto !important;
		bottom: auto !important;
		width: min(28rem, calc(100vw - 2rem));
		max-width: 28rem;
	}
	.term-modal.modal-desktop {
		min-height: 0;
		background: #ffffff;
		border: 2px solid #111111;
		border-radius: 0;
		color: #111111;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		box-shadow: 4px 4px 0 #111111;
	}
	.term-modal.modal-minimal {
		min-height: 0;
		background: #16161c;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		color: #f3f4f6;
		font-family: 'IBM Plex Sans', system-ui, sans-serif;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.55);
	}
	.term-titlebar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		height: 28px;
		padding: 0 0.55rem;
		background: #1a1a1a;
		color: #f5f5f5;
		font-size: 0.72rem;
	}
	.term-titlebar .traffic {
		display: flex;
		align-items: center;
		gap: 0.28rem;
		flex-shrink: 0;
	}
	.term-titlebar .dot {
		width: 9px;
		height: 9px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.35);
		appearance: none;
		display: inline-block;
	}
	.term-titlebar button.dot {
		cursor: pointer;
	}
	.term-titlebar .dot.red {
		background: #ff5f57;
	}
	.term-titlebar .dot.yellow {
		background: #febc2e;
	}
	.term-titlebar .dot.green {
		background: #28c840;
	}
	.term-titlebar .titlebar-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}
	.term-titlebar .titlebar-tag {
		flex-shrink: 0;
		padding: 0.1rem 0.35rem;
		background: #ff4c00;
		color: #fff;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1.2;
	}
	.term-modal.modal-desktop .term-modal-body {
		padding: 1.1rem 1.15rem 1.2rem;
		background: #ffffff;
	}
	.term-modal.modal-minimal .term-modal-body {
		padding: 1.35rem 1.4rem 1.45rem;
		background: #16161c;
	}
	.term-modal.modal-desktop h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #111;
	}
	.term-modal.modal-minimal h2 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: #f3f4f6;
	}
	.term-modal.modal-desktop p {
		margin: 0 0 0.95rem;
		color: #666;
		font-size: 0.8rem;
		line-height: 1.45;
	}
	.term-modal.modal-minimal p {
		margin: 0 0 1.1rem;
		color: #9ca3af;
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.login-prompt-actions {
		display: grid;
		gap: 0.5rem;
	}
	.term-btn {
		appearance: none;
		cursor: pointer;
	}
	.term-modal.modal-desktop .term-btn {
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		padding: 0.45rem 0.7rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.term-modal.modal-minimal .term-btn {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.06);
		color: #f3f4f6;
		padding: 0.65rem 0.85rem;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		text-transform: none;
	}
	.term-modal.modal-desktop .term-btn:hover:not(:disabled) {
		border-color: #ff4c00;
		color: #ff4c00;
	}
	.term-modal.modal-minimal .term-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn:focus-visible {
		outline: 2px solid #8b7cf7;
		outline-offset: 2px;
	}
	.term-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.term-modal.modal-desktop .term-btn.primary {
		background: #111;
		color: #fff;
	}
	.term-modal.modal-desktop .term-btn.primary:hover:not(:disabled) {
		background: #ff4c00;
		border-color: #111;
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn.primary {
		background: #f3f4f6;
		border-color: transparent;
		color: #0e0e12;
	}
	.term-modal.modal-minimal .term-btn.primary:hover:not(:disabled) {
		background: #fff;
		border-color: transparent;
		color: #0e0e12;
	}
	.term-modal.modal-desktop .term-btn.discord {
		background: #5865f2;
		border-color: #111;
		color: #fff;
	}
	.term-modal.modal-desktop .term-btn.discord:hover:not(:disabled) {
		background: #4752c4;
		border-color: #111;
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn.discord {
		background: #5865f2;
		border-color: transparent;
		color: #fff;
	}
	.term-modal.modal-minimal .term-btn.discord:hover:not(:disabled) {
		background: #4752c4;
		border-color: transparent;
		color: #fff;
	}
	.login-cred-form {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.1rem;
	}
	.term-modal.modal-desktop .login-cred-form input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem 0.6rem;
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.8rem;
		box-shadow: none;
	}
	.term-modal.modal-minimal .login-cred-form input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.06);
		color: #f3f4f6;
		font-family: inherit;
		font-size: 0.875rem;
		box-shadow: none;
	}
	.term-modal.modal-desktop .login-cred-form input:focus {
		outline: none;
		border-color: #111;
		box-shadow: 2px 2px 0 #ff4c00;
	}
	.term-modal.modal-minimal .login-cred-form input:focus {
		outline: none;
		border-color: rgba(139, 124, 247, 0.65);
		box-shadow: 0 0 0 3px rgba(139, 124, 247, 0.25);
	}
	.term-modal.modal-desktop .auth-link {
		color: #666;
		font-size: 0.72rem;
		text-decoration: none;
		text-align: center;
		padding: 0.25rem 0;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: none;
		border: 0;
		cursor: pointer;
		width: 100%;
	}
	.term-modal.modal-desktop .auth-link:hover {
		color: #ff4c00;
	}
	/* Desktop Dark — must come after light modal rules so overrides stick */
	.term-modal.modal-desktop.modal-desk-dark {
		background: #080a0e;
		border-color: #2a2f38;
		color: #e8eaed;
		box-shadow: 4px 4px 0 #2a2f38;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-titlebar {
		background: #050608;
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-modal-body {
		background: #080a0e;
	}
	.term-modal.modal-desktop.modal-desk-dark h2 {
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark p {
		color: #8b929e;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn {
		border-color: #2a2f38;
		background: #0c0f14;
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn:hover:not(:disabled) {
		border-color: #ff4c00;
		color: #ff4c00;
		background: #141820;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.primary {
		background: #e8eaed;
		border-color: #e8eaed;
		color: #080a0e;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.primary:hover:not(:disabled) {
		background: #ff4c00;
		border-color: #ff4c00;
		color: #fff;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.discord {
		background: #5865f2;
		border-color: #5865f2;
		color: #fff;
	}
	.term-modal.modal-desktop.modal-desk-dark .term-btn.discord:hover:not(:disabled) {
		background: #4752c4;
		border-color: #4752c4;
		color: #fff;
	}
	.term-modal.modal-desktop.modal-desk-dark .login-cred-form input {
		border-color: #2a2f38;
		background: #0c0f14;
		color: #e8eaed;
	}
	.term-modal.modal-desktop.modal-desk-dark .login-cred-form input::placeholder {
		color: #8b929e;
	}
	.term-modal.modal-desktop.modal-desk-dark .login-cred-form input:focus {
		border-color: #ff4c00;
		box-shadow: 2px 2px 0 #ff4c00;
	}
	.term-modal.modal-desktop.modal-desk-dark .auth-link {
		color: #8b929e;
	}
	.term-modal.modal-desktop.modal-desk-dark .auth-link:hover {
		color: #ff4c00;
	}
	.term-modal.modal-minimal .auth-link {
		color: #9ca3af;
		font-size: 0.85rem;
		text-decoration: none;
		text-align: center;
		padding: 0.25rem 0;
		font-family: inherit;
		background: none;
		border: 0;
		cursor: pointer;
		width: 100%;
	}
	.term-modal.modal-minimal .auth-link:hover {
		color: #8b7cf7;
	}
	.auth-modal-err {
		margin: 0;
		padding: 0.45rem 0.5rem;
		border: 1px solid #7f1d1d;
		background: #1a0a0a;
		color: #fca5a5;
		font-size: 0.75rem;
		line-height: 1.35;
	}
</style>
