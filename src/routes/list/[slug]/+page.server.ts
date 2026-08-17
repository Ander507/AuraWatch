import { error, isHttpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isTursoConfigured } from '$lib/server/db';
import { getListBySlug, normalizeListSlug, savedItemProviders } from '$lib/server/lists';

export const load: PageServerLoad = async ({ params }) => {
	// logging the slug to see if it even reaches the backend
	console.log('[list/[slug]] params.slug =', params.slug);

	if (!isTursoConfigured()) {
		console.warn('[list/[slug]] turso missing — cannot resolve', params.slug);
		error(503, 'Cloud lists need Turso configured');
	}

	const slug = normalizeListSlug(params.slug || '');
	if (!slug) {
		console.warn('[list/[slug]] empty slug after normalize', { raw: params.slug });
		error(404, 'List not found');
	}

	try {
		// grabbing the list from turso, throwing a 404 if someone shares a dead link
		const pack = await getListBySlug(slug);
		if (!pack) {
			// throwing a clearer error if we can't find the list so we aren't flying blind
			console.warn('[list/[slug]] miss — no lists.slug match', {
				raw: params.slug,
				normalized: slug
			});
			error(404, `List not found for slug “${slug}”`);
		}

		console.log('[list/[slug]] hit', {
			slug: pack.list.slug,
			listId: pack.list.id,
			items: pack.items.length
		});

		return {
			list: {
				title: pack.list.title,
				slug: pack.list.slug,
				createdAt: pack.list.createdAt?.toISOString?.() ?? null,
				ownerName: pack.ownerName
			},
			items: pack.items.map((i) => ({
				id: i.id,
				format: i.format,
				title: i.title,
				coverUrl: i.coverUrl,
				description: i.description,
				providers: savedItemProviders(i)
			}))
		};
	} catch (e: unknown) {
		// don't swallow sveltekit's intentional 404/503
		if (isHttpError(e)) throw e;
		console.error('list slug load boom', { slug, err: e });
		error(500, 'Could not load list');
	}
};
