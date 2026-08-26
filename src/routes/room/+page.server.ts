import type { PageServerLoad } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import { listMyActiveRooms } from '$lib/server/rooms';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id || '';
	const tursoReady = isTursoConfigured();

	// querying turso for rooms created by the logged-in user to display in a 'my rooms' dashboard section
	const myRooms =
		tursoReady && userId ? await listMyActiveRooms(userId) : [];

	return {
		tursoReady,
		session,
		myRooms
	};
};
