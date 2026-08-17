import { Auth, setEnvDefaults } from '@auth/core';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { buildAuthConfig } from '../../../../auth';

async function handleDiscordCallback(event: Parameters<RequestHandler>[0]) {
	const config = await buildAuthConfig(event);
	config.trustHost = true;
	config.basePath = '/auth';
	setEnvDefaults(env, config);
	const response = await Auth(event.request, config);

	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get('Location') ?? '';
		if (!/[?&]error=/i.test(location)) {
			const headers = new Headers(response.headers);
			headers.set('Location', '/');
			return new Response(null, { status: 302, headers });
		}
	}

	return response;
}

export const GET: RequestHandler = async (event) => {
	// matching the callback path to /auth/callback/discord so discord stops rejecting the redirect url
	return handleDiscordCallback(event);
};

export const POST: RequestHandler = async (event) => handleDiscordCallback(event);
