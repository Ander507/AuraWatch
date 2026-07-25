// itunes search — free, no api key, bless apple
// used for song covers + "open in apple/spotify/yt" links

const ITUNES = 'https://itunes.apple.com/search';

export type ItunesTrack = {
	id: number;
	title: string;
	artist: string;
	album: string | null;
	cover: string | null;
	year: string | null;
	previewUrl: string | null;
	appleUrl: string | null;
	kindLabel: 'SONG';
};

export type ItunesArtist = {
	id: number;
	name: string;
	cover: string | null;
	genre: string | null;
	appleUrl: string | null;
	kindLabel: 'ARTIST';
};

// union bc the dropdown shows both lol
export type ItunesMusicHit =
	| (ItunesTrack & { hitKind: 'song' })
	| (ItunesArtist & { hitKind: 'artist'; title: string });

function hiResArt(url: string | null | undefined) {
	if (!url) return null;
	// itunes gives potato 100x100, stretch it
	return url.replace('100x100bb', '600x600bb').replace('100x100', '600x600');
}

function norm(s: string) {
	// yeet punctuation so "Juice WRLD" == "juice wrld"
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function itunesFetch(params: URLSearchParams): Promise<any[]> {
	try {
		const res = await fetch(`${ITUNES}?${params}`);
		if (!res.ok) return [];
		const data = await res.json();
		return data?.results || [];
	} catch (e) {
		console.warn('itunes died', e);
		return [];
	}
}

function mapTrack(r: any): ItunesTrack | null {
	if (!r?.trackName || !r?.artistName || !r?.trackId) return null;
	return {
		id: r.trackId,
		title: String(r.trackName),
		artist: String(r.artistName),
		album: r.collectionName ? String(r.collectionName) : null,
		cover: hiResArt(r.artworkUrl100),
		year: r.releaseDate ? String(r.releaseDate).slice(0, 4) : null,
		previewUrl: r.previewUrl || null,
		appleUrl: r.trackViewUrl || null,
		kindLabel: 'SONG'
	};
}

function mapArtist(r: any): ItunesArtist | null {
	if (!r?.artistName || !r?.artistId) return null;
	if (r.wrapperType && r.wrapperType !== 'artist') return null;
	const name = String(r.artistName);
	// type beat spam flooded juice wrld search once. never again.
	if (/type\s*beat|instrumental|karaoke/i.test(name)) return null;
	return {
		id: r.artistId,
		name,
		cover: hiResArt(r.artworkUrl100 || r.artworkUrl60),
		genre: r.primaryGenreName ? String(r.primaryGenreName) : null,
		appleUrl: r.artistLinkUrl || null,
		kindLabel: 'ARTIST'
	};
}

// magic numbers: higher = more "this is actually their song"
function howHardDoesThisMatch(track: ItunesTrack, qn: string): number {
	if (!qn) return 0;
	const artist = norm(track.artist);
	const title = norm(track.title);

	if (artist === qn) return 8;
	if (artist.startsWith(qn) || qn.startsWith(artist)) return 6;

	// "A & B" / feat. mess
	const bits = track.artist.split(/[,&/]| feat\.? | ft\.? | featuring /i);
	for (const b of bits) {
		const p = norm(b.trim());
		if (p === qn || p.startsWith(qn)) return 5;
	}

	if (artist.includes(qn)) return 3;
	// eminem song that just mentions juice in the title — nah
	if (title.includes(qn) && !artist.includes(qn)) return 0;
	return 1;
}

function rankSongs(raw: any[], q: string, limit: number): ItunesTrack[] {
	const qn = norm(q);
	const seenIds = new Set<number>();
	const seenTxt = new Set<string>();
	const scored: { t: ItunesTrack; score: number }[] = [];

	for (const row of raw) {
		const t = mapTrack(row);
		if (!t) continue;
		if (seenIds.has(t.id)) continue;
		seenIds.add(t.id);

		const k = norm(t.artist) + '|' + norm(t.title);
		if (seenTxt.has(k)) continue;
		seenTxt.add(k);

		const score = howHardDoesThisMatch(t, qn);
		if (score <= 0) continue;
		scored.push({ t, score });
	}

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return (b.t.year || '').localeCompare(a.t.year || '');
	});

	const out: ItunesTrack[] = [];
	for (const x of scored) {
		out.push(x.t);
		if (out.length >= limit) break;
	}
	return out;
}

export async function searchItunesSongs(query: string, opts?: { limit?: number }) {
	const q = String(query || '').trim();
	if (!q) return { results: [] as ItunesTrack[], total: 0 };

	let limit = opts?.limit ?? 8;
	if (limit < 1) limit = 1;
	if (limit > 25) limit = 25;

	// grab extra then prune — itunes ranking is mid
	const grab = Math.min(25, Math.max(limit * 3, 15));
	const params = new URLSearchParams({
		term: q,
		media: 'music',
		entity: 'song',
		limit: String(grab)
	});
	const raw = await itunesFetch(params);
	const results = rankSongs(raw, q, limit);
	return { results, total: results.length };
}

// artists on top (when u type a name), then songs under
export async function searchItunesMusic(query: string, opts?: { limit?: number }) {
	const q = String(query || '').trim();
	if (!q) return { results: [] as ItunesMusicHit[], total: 0 };

	let limit = opts?.limit ?? 8;
	if (limit < 1) limit = 1;
	if (limit > 25) limit = 25;

	const artistSlots = Math.min(3, Math.max(1, Math.floor(limit / 3)));
	const songSlots = Math.max(limit - artistSlots, 4);
	const qn = norm(q);

	// fire both, hope one of them works
	const [artistRaw, songRaw] = await Promise.all([
		itunesFetch(
			new URLSearchParams({
				term: q,
				media: 'music',
				entity: 'musicArtist',
				limit: '8'
			})
		),
		itunesFetch(
			new URLSearchParams({
				term: q,
				media: 'music',
				entity: 'song',
				limit: String(Math.min(25, songSlots * 3))
			})
		)
	]);

	const songs = rankSongs(songRaw, q, songSlots);

	// artists often have no art — steal from a song cover
	const artSteal = new Map<string, string>();
	for (const s of songs) {
		if (!s.cover) continue;
		const key = norm(s.artist);
		if (!artSteal.has(key)) artSteal.set(key, s.cover);
		for (const part of s.artist.split(/[,&/]| feat\.? | ft\.? | featuring /i)) {
			const pk = norm(part.trim());
			if (pk && !artSteal.has(pk)) artSteal.set(pk, s.cover);
		}
	}

	const seenNames = new Set<string>();
	const scoredArtists: { a: ItunesMusicHit; score: number }[] = [];

	for (const row of artistRaw) {
		const base = mapArtist(row);
		if (!base) continue;
		const key = norm(base.name);
		if (seenNames.has(key)) continue;
		seenNames.add(key);

		let score = 0;
		if (key === qn) score = 3;
		else if (key.startsWith(qn) || qn.startsWith(key)) score = 2;
		else if (key.includes(qn)) score = 1;
		if (!score) continue;

		scoredArtists.push({
			score,
			a: {
				...base,
				cover: base.cover || artSteal.get(key) || null,
				hitKind: 'artist',
				title: base.name
			}
		});
	}

	scoredArtists.sort((x, y) => y.score - x.score);

	// exact hit? drop the "BABY juice wrld" noise
	let kept = scoredArtists;
	if (scoredArtists.some((x) => x.score >= 3)) {
		kept = scoredArtists.filter((x) => x.score >= 2).slice(0, 2);
	} else {
		kept = scoredArtists.slice(0, artistSlots);
	}

	const artistHits = kept.map((x) => x.a);
	const songHits: ItunesMusicHit[] = songs.map((t) => ({ ...t, hitKind: 'song' as const }));

	const merged = [...artistHits, ...songHits].slice(0, limit);
	return { results: merged, total: artistHits.length + songs.length };
}

// fuzzy pick one track for gemini's "Artist - Title" string
export async function lookupItunesTrack(searchQuery: string): Promise<ItunesTrack | null> {
	const { results } = await searchItunesSongs(searchQuery, { limit: 5 });
	if (!results.length) return null;

	const want = norm(searchQuery);
	let best = results[0];
	let bestScore = -1;

	for (const t of results) {
		const full = norm(t.artist + ' ' + t.title);
		const titleOnly = norm(t.title);
		let score = 0;
		if (full === want || titleOnly === want) score += 12;
		else if (full.includes(want) || want.includes(full)) score += 6;
		else if (titleOnly.includes(want) || want.includes(titleOnly)) score += 4;
		if (t.cover) score += 1; // vibes based tiebreak idk
		if (score > bestScore) {
			bestScore = score;
			best = t;
		}
	}
	return best;
}

export function songListenLinks(opts: {
	title: string;
	artist: string;
	appleUrl?: string | null;
}) {
	const q = encodeURIComponent(opts.artist + ' ' + opts.title);
	const links: { name: string; url: string; logo: string | null }[] = [];

	if (opts.appleUrl) {
		links.push({ name: 'Apple Music', url: opts.appleUrl, logo: null });
	} else {
		links.push({
			name: 'Apple Music',
			url: 'https://music.apple.com/search?term=' + q,
			logo: null
		});
	}
	links.push({ name: 'Spotify', url: 'https://open.spotify.com/search/' + q, logo: null });
	links.push({
		name: 'YouTube',
		url: 'https://www.youtube.com/results?search_query=' + q,
		logo: null
	});
	return links;
}
