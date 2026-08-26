<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { ui } from '$lib/uiTheme.svelte';
	import { signInWithDiscord } from '$lib/discordSignIn';
	import { registerWithEmail, signInWithEmail } from '$lib/emailAuth';
	import { usernameToAuthEmail } from '$lib/usernameAuth';
	import { safeCallbackUrl } from '$lib/authRedirect';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';

	let { data, form } = $props();

	let afterLogin = $derived(safeCallbackUrl(page.url.searchParams.get('callbackUrl')));

	let modePick = $state<'login' | 'register' | null>(null);
	let mode = $derived(modePick ?? form?.mode ?? 'login');
	let pending = $state(false);
	let uiTheme = $derived(ui.theme);
	let deskMode = $derived(ui.deskMode);
	let clientError = $state('');

	let formError = $derived(clientError || form?.error || data.error || '');

	async function submitEmailAuth(e: SubmitEvent) {
		e.preventDefault();
		const formEl = e.currentTarget as HTMLFormElement;
		const fd = new FormData(formEl);
		const username = String(fd.get('username') || '');
		const email = usernameToAuthEmail(username);
		const password = String(fd.get('password') || '');
		const name = String(fd.get('name') || '');
		pending = true;
		clientError = '';
		try {
			if (!email || !password) {
				clientError = 'Username and password required';
				return;
			}
			const result =
				mode === 'register'
					? await registerWithEmail({ email, password, name, after: afterLogin })
					: await signInWithEmail(email, password, afterLogin);
			if (!result.ok) {
				clientError = result.error;
				return;
			}
			await invalidateAll();
			await goto(afterLogin);
		} catch {
			clientError = 'Couldn’t do that — try again';
		} finally {
			pending = false;
		}
	}
</script>

<!-- wrapping the sign-in and register pages in proper styling so they stop showing dead grey space -->
<div
	class="auth-shell"
	class:desktop={uiTheme === 'desktop'}
	class:desk-dark={uiTheme === 'desktop' && deskMode === 'dark'}
	class:minimal={uiTheme === 'minimal'}
>
	<section class="auth-card">
		{#if uiTheme === 'desktop'}
			<div class="titlebar">
				<div class="traffic" aria-hidden="true">
					<span class="dot red"></span>
					<span class="dot yellow"></span>
					<span class="dot green"></span>
				</div>
				<span class="titlebar-text">~/AuraWatch — {mode === 'login' ? 'Sign in' : 'Register'}</span>
				<span class="titlebar-tag">AUTH</span>
			</div>
		{/if}
		<main class="signin">
			<a class="back" href={resolve('/')}>← AuraWatch</a>
			<h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
			<p>Save vibe picks to the cloud and share your list with friends.</p>

			<button type="button" class="btn discord" onclick={() => void signInWithDiscord(afterLogin)}>
				Login with Discord
			</button>

			<div class="or" aria-hidden="true">or</div>

			{#if formError}
				<p class="err" role="alert">{formError}</p>
			{/if}

			<form class="cred-form" onsubmit={submitEmailAuth}>
				{#if mode === 'register'}
					<label>
						<span>Name</span>
						<input type="text" name="name" autocomplete="name" placeholder="what should we call you" />
					</label>
				{/if}
				<label>
					<span>Username</span>
					<input
						type="text"
						name="username"
						required
						autocomplete="username"
						placeholder="Enter your username"
						spellcheck="false"
					/>
				</label>
				<label>
					<span>Password</span>
					<input
						type="password"
						name="password"
						required
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
						placeholder={mode === 'login' ? '••••••••' : 'at least 8 chars'}
						minlength={mode === 'register' ? 8 : undefined}
					/>
				</label>
				<button type="submit" class="btn" disabled={pending}>
					{pending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
				</button>
			</form>

			<p class="switch">
				{#if mode === 'login'}
					No account?
					<button type="button" class="linkish" onclick={() => (modePick = 'register')}>Register</button>
				{:else}
					Already registered?
					<button type="button" class="linkish" onclick={() => (modePick = 'login')}>Sign in</button>
				{/if}
			</p>
		</main>
	</section>
</div>
<AppBottomNav />

<style>
	.auth-shell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 100%;
		padding: 1.5rem 1rem 5.5rem;
		box-sizing: border-box;
	}
	.auth-shell.desktop {
		background: #7b8a9d;
		color: #111;
	}
	.auth-shell.desktop.desk-dark {
		background: #0b0d11;
		color: #e8eaed;
	}
	.auth-shell.minimal {
		background: #0e0e12;
		color: #f3f4f6;
	}
	.auth-card {
		width: 100%;
		max-width: 28rem;
	}
	.auth-shell.desktop .auth-card {
		background: #fff;
		border: 2px solid #111;
		box-shadow: 4px 4px 0 #111;
	}
	.auth-shell.desktop.desk-dark .auth-card {
		background: #080a0e;
		border-color: #2a2f38;
		box-shadow: 4px 4px 0 #2a2f38;
		color: #e8eaed;
	}
	.auth-shell.minimal .auth-card {
		background: #16161c;
		border: 1px solid #2a2a32;
	}
	.titlebar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.45rem 0.7rem;
		border-bottom: 2px solid #111;
		background: #e8eaed;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72rem;
	}
	.auth-shell.desktop.desk-dark .titlebar {
		border-bottom-color: #2a2f38;
		background: #0e1015;
		color: #e8eaed;
	}
	.traffic {
		display: flex;
		gap: 0.3rem;
	}
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 999px;
		border: 1px solid #111;
	}
	.dot.red {
		background: #ff5f57;
	}
	.dot.yellow {
		background: #febc2e;
	}
	.dot.green {
		background: #28c840;
	}
	.titlebar-text {
		flex: 1;
		font-weight: 600;
	}
	.titlebar-tag {
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		font-weight: 700;
		color: #ff4c00;
	}
	.signin {
		max-width: none;
		margin: 0;
		padding: 1.5rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.back {
		color: inherit;
		opacity: 0.65;
		text-decoration: none;
		font-size: 0.85rem;
	}
	h1 {
		margin: 1rem 0 0.4rem;
		font-size: 1.6rem;
		letter-spacing: -0.02em;
	}
	p {
		color: inherit;
		opacity: 0.7;
		line-height: 1.5;
	}
	.or {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0;
		color: inherit;
		opacity: 0.55;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.or::before,
	.or::after {
		content: '';
		height: 1px;
		background: currentColor;
		opacity: 0.25;
	}
	.cred-form {
		display: grid;
		gap: 0.85rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.75;
	}
	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 0.85rem;
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		font: inherit;
		font-size: 0.95rem;
		text-transform: none;
		letter-spacing: 0;
	}
	.auth-shell.minimal input {
		border: 1px solid #333;
		background: #0a0a0e;
		color: #f3f4f6;
	}
	input:focus {
		outline: 2px solid #ff4c00;
		outline-offset: 0;
		border-color: #ff4c00;
	}
	.btn {
		width: 100%;
		padding: 0.8rem 1rem;
		border: 2px solid #111;
		border-radius: 0;
		background: #fff;
		color: #111;
		font: inherit;
		cursor: pointer;
		min-height: 44px;
	}
	.auth-shell.minimal .btn {
		border: 1px solid #333;
		background: #16161c;
		color: #f3f4f6;
	}
	.btn:hover:not(:disabled) {
		border-color: #ff4c00;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.btn.discord {
		background: #5865f2;
		border-color: #5865f2;
		color: #fff;
		margin-top: 1.25rem;
	}
	.err {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid #7f1d1d;
		background: #1a0a0a;
		color: #fca5a5;
		font-size: 0.85rem;
		opacity: 1;
	}
	.switch {
		margin-top: 1.25rem;
		font-size: 0.85rem;
	}
	.linkish {
		border: 0;
		background: none;
		color: #ff4c00;
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}
</style>
