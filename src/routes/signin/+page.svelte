<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { signIn } from '@auth/sveltekit/client';

	let { data, form } = $props();

	let modePick = $state<'login' | 'register' | null>(null);
	let mode = $derived(modePick ?? form?.mode ?? 'login');
	let pending = $state(false);

	let formError = $derived(form?.error || data.error || '');
</script>

<main class="signin">
	<a class="back" href={resolve('/')}>← AuraWatch</a>
	<h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
	<p>Save vibe picks to the cloud and share your list with friends.</p>

	<button type="button" class="btn discord" onclick={() => signIn('discord', { callbackUrl: '/' })}>
		Login with Discord
	</button>

	<div class="or" aria-hidden="true">or</div>

	{#if formError}
		<p class="err" role="alert">{formError}</p>
	{/if}

	<form
		method="POST"
		action={mode === 'login' ? '?/login' : '?/register'}
		class="cred-form"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				pending = false;
				await update({ reset: false });
			};
		}}
	>
		{#if mode === 'register'}
			<label>
				<span>Name</span>
				<input type="text" name="name" autocomplete="name" placeholder="what should we call you" />
			</label>
		{/if}
		<label>
			<span>Email</span>
			<input
				type="email"
				name="email"
				required
				autocomplete="email"
				placeholder="you@example.com"
				value={form?.email ?? ''}
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

<style>
	.signin {
		max-width: 28rem;
		margin: 4rem auto;
		padding: 1.5rem;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.back {
		color: #9ca3af;
		text-decoration: none;
		font-size: 0.85rem;
	}
	h1 {
		margin: 1rem 0 0.4rem;
		font-size: 1.6rem;
		letter-spacing: -0.02em;
	}
	p {
		color: #9ca3af;
		line-height: 1.5;
	}
	.or {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0;
		color: #6b7280;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.or::before,
	.or::after {
		content: '';
		height: 1px;
		background: #2a2a32;
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
		color: #9ca3af;
	}
	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 0.85rem;
		border: 1px solid #333;
		border-radius: 0;
		background: #0a0a0e;
		color: #f3f4f6;
		font: inherit;
		font-size: 0.95rem;
		text-transform: none;
		letter-spacing: 0;
	}
	input:focus {
		outline: 2px solid #ff4c00;
		outline-offset: 0;
		border-color: #ff4c00;
	}
	.btn {
		width: 100%;
		padding: 0.8rem 1rem;
		border: 1px solid #333;
		border-radius: 0;
		background: #16161c;
		color: #f3f4f6;
		font: inherit;
		cursor: pointer;
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
		margin-top: 1.25rem;
	}
	.err {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid #7f1d1d;
		background: #1a0a0a;
		color: #fca5a5;
		font-size: 0.85rem;
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
