import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { handleCredentialsLogin, handleCredentialsRegister } from '$lib/server/credentialsAuth';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	if (session?.user) {
		throw redirect(303, '/');
	}
	const err = url.searchParams.get('error');
	return {
		error:
			err === 'CredentialsSignin'
				? 'Wrong username or password'
				: err
					? 'Sign-in failed — try again'
					: null
	};
};

export const actions: Actions = {
	login: handleCredentialsLogin,
	register: handleCredentialsRegister
};
