// itunes search — free, no api key, bless apple
// used for song covers + "open in apple/spotify/yt" links

import { cachedJsonFetch } from '$lib/server/httpCache';

const ITUNES = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';

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

// "(feat. x)" / "[Slowed]" clutter breaks title matching
function titleCore(s: string) {
	return norm(
		s
			.replace(/\([^)]*\)/g, ' ')
			.replace(/\[[^\]]*\]/g, ' ')
			.replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, ' ')
	);
}

async function itunesFetch(params: URLSearchParams): Promise<any[]> {
	try {
		const { ok, data } = await cachedJsonFetch(
			`${ITUNES}?${params}`,
			undefined,
			{ ttlMs: 10 * 60 * 1000 }
		);
		if (!ok || !data) return [];
		return data?.results || [];
	} catch (e) {
		console.warn('itunes died', e);
		return [];
	}
}

async function itunesLookup(params: URLSearchParams): Promise<any[]> {
	try {
		const { ok, data } = await cachedJsonFetch(
			`${ITUNES_LOOKUP}?${params}`,
			undefined,
			{ ttlMs: 15 * 60 * 1000 }
		);
		if (!ok || !data) return [];
		return data?.results || [];
	} catch (e) {
		console.warn('itunes lookup died', e);
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

function artistBits(artist: string): string[] {
	const bits = artist.split(/[,&/]| feat\.? | ft\.? | featuring /i);
	const out: string[] = [];
	for (const b of bits) {
		const p = norm(b.trim());
		if (p) out.push(p);
	}
	const whole = norm(artist);
	if (whole && !out.includes(whole)) out.push(whole);
	return out;
}

function artistPrefixInQuery(artist: string, qn: string, titleCoreNorm = ''): string | null {
	// Prefer leftover after title ("…rebz"), so "want" inside the title doesn't fake-match an artist
	const hay =
		titleCoreNorm && qn.includes(titleCoreNorm) ? qn.replace(titleCoreNorm, '') || qn : qn;
	for (const p of artistBits(artist)) {
		// "rebz" → rebzyyx: need a real prefix, not a 1–2 letter coincidence
		for (let n = Math.min(p.length, hay.length); n >= 3; n--) {
			const frag = p.slice(0, n);
			if (hay.includes(frag) && p.startsWith(frag)) return frag;
		}
	}
	return null;
}

function titleMatchScore(titleRaw: string, qn: string): number {
	const title = norm(titleRaw);
	const core = titleCore(titleRaw) || title;
	if (!title && !core) return 0;

	if (title === qn || core === qn) return 10;
	if (title.startsWith(qn) || core.startsWith(qn)) return 9;
	if (qn.startsWith(title) && title.length >= 6) return 9;
	if (qn.startsWith(core) && core.length >= 6) return 9;
	if ((title.includes(qn) || core.includes(qn)) && qn.length >= 6) return 8;
	if (qn.includes(title) && title.length >= 6) return 7;
	if (qn.includes(core) && core.length >= 6) return 7;
	return 0;
}

// magic numbers: higher = more "this is actually their song"
function howHardDoesThisMatch(track: ItunesTrack, qn: string): number {
	if (!qn) return 0;
	const artist = norm(track.artist);
	const title = norm(track.title);
	const core = titleCore(track.title) || title;
	const full = artist + title;

	const tScore = titleMatchScore(track.title, qn);
	const artistFrag = artistPrefixInQuery(track.artist, qn, core);

	// "all i want is you rebz" → title core + artist prefix both in query
	if (artistFrag && core.length >= 6 && qn.includes(core)) {
		return 14;
	}
	if (artistFrag && tScore >= 7) return 13;

	// Song-title searches first (e.g. "All the Things She Said")
	if (tScore >= 7) return tScore;

	// "Artist - Song" / pasted full query
	if (full === qn) return 12;
	if (qn.includes(artist) && qn.includes(title) && title.length >= 3) return 11;
	if (qn.includes(artist) && qn.includes(core) && core.length >= 3) return 11;
	if (full.includes(qn) && qn.length >= 6) return 6;

	// Artist-name searches
	if (artist === qn) return 8;
	if (artist.startsWith(qn) || qn.startsWith(artist)) return 6;

	for (const p of artistBits(track.artist)) {
		if (p === qn || p.startsWith(qn)) return 5;
	}

	if (artist.includes(qn)) return 3;

	// Short artist-fragment query that only appears inside an unrelated title
	// (e.g. query "juice" matching "...juice..." by Eminem) — skip
	if (qn.length <= 10 && !artist.includes(qn)) return 0;

	return 1;
}

const TITLEISH_TOKENS = new Set([
	'a',
	'an',
	'and',
	'be',
	'for',
	'i',
	'in',
	'is',
	'it',
	'me',
	'my',
	'of',
	'on',
	'or',
	'the',
	'to',
	'u',
	'we',
	'ya',
	'you',
	'all',
	'want',
	'love',
	'song',
	'feat',
	'ft',
	'said',
	'she',
	'he',
	'they',
	'them',
	'thing',
	'things',
	'night',
	'day',
	'time',
	'life',
	'world',
	'heart',
	'baby',
	'girl',
	'boy',
	'man',
	'never',
	'always',
	'feel',
	'know',
	'make',
	'take',
	'come',
	'go',
	'get',
	'let',
	'dont',
	"don't",
	'yeah',
	'oh',
	'la',
	'da',
	'remix',
	'edit',
	'live',
	'version',
	'radio'
]);

function looksLikeArtistFrag(tok: string): boolean {
	const t = tok.toLowerCase().replace(/[^a-z0-9]+/g, '');
	if (t.length < 3) return false;
	if (TITLEISH_TOKENS.has(t)) return false;
	return true;
}

/** iTunes artist search is exact-ish — "rebz" won't return Rebzyyx. MusicBrainz prefix does. */
async function musicBrainzArtistNames(frag: string): Promise<string[]> {
	const fn = norm(frag);
	if (fn.length < 3 || fn.length > 14) return [];
	try {
		const url =
			'https://musicbrainz.org/ws/2/artist?query=' +
			encodeURIComponent(frag + '*') +
			'&fmt=json&limit=8';
		const res = await fetch(url, {
			headers: { 'User-Agent': 'AuraWatch/1.0 (https://github.com/HackTheClub/AuraWatch)' }
		});
		if (!res.ok) return [];
		const data = await res.json();
		const names: string[] = [];
		for (const a of data?.artists || []) {
			const name = String(a?.name || '').trim();
			if (!name) continue;
			const an = norm(name);
			if (an === fn || an.startsWith(fn)) names.push(name);
		}
		return names;
	} catch {
		return [];
	}
}

async function itunesArtistsMatching(frag: string): Promise<ItunesArtist[]> {
	const fn = norm(frag);
	if (!fn) return [];
	const raw = await itunesFetch(
		new URLSearchParams({
			term: frag,
			media: 'music',
			entity: 'musicArtist',
			limit: '8'
		})
	);
	const out: ItunesArtist[] = [];
	const seen = new Set<number>();
	for (const row of raw) {
		const a = mapArtist(row);
		if (!a || seen.has(a.id)) continue;
		const an = norm(a.name);
		if (!(an === fn || an.startsWith(fn))) continue;
		seen.add(a.id);
		out.push(a);
	}
	return out;
}

/** Resolve short artist tokens via iTunes + MusicBrainz, then match iTunes ids. */
async function resolveArtistsForFragment(frag: string): Promise<ItunesArtist[]> {
	const fn = norm(frag);
	const byId = new Map<number, ItunesArtist>();

	// Prefer prefix expansions (rebz → Rebzyyx) before scanning every "Rebz" clone
	const mbNames = await musicBrainzArtistNames(frag);
	const expanded = mbNames.filter((n) => norm(n).length > fn.length);
	for (const name of expanded.slice(0, 3)) {
		for (const a of await itunesArtistsMatching(name)) byId.set(a.id, a);
	}
	if (byId.size) return [...byId.values()].slice(0, 3);

	for (const a of await itunesArtistsMatching(frag)) byId.set(a.id, a);
	return [...byId.values()].slice(0, 3);
}

async function tracksFromArtistCatalog(
	artists: ItunesArtist[],
	titleQn: string,
	seenTrack: Set<number>
): Promise<ItunesTrack[]> {
	const out: ItunesTrack[] = [];
	for (const a of artists) {
		const an = norm(a.name);
		const catalog = await itunesLookup(
			new URLSearchParams({
				id: String(a.id),
				entity: 'song',
				limit: '200'
			})
		);
		for (const crow of catalog) {
			if (crow?.wrapperType && crow.wrapperType !== 'track') continue;
			const t = mapTrack(crow);
			if (!t || seenTrack.has(t.id)) continue;
			if (titleMatchScore(t.title, titleQn) < 7) continue;
			const bits = artistBits(t.artist);
			if (!bits.some((p) => p === an || p.startsWith(an) || an.startsWith(p))) continue;
			seenTrack.add(t.id);
			out.push(t);
		}
	}
	return out;
}

/** Deezer ranks niche collabs better for "title + artistfrag" — map hits back onto iTunes. */
async function deezerHintsForQuery(q: string): Promise<ItunesTrack[]> {
	try {
		const res = await fetch(
			'https://api.deezer.com/search?q=' + encodeURIComponent(q) + '&limit=6'
		);
		if (!res.ok) return [];
		const data = await res.json();
		const rows: { artist: string; title: string }[] = [];
		const seen = new Set<string>();
		for (const row of data?.data || []) {
			const artist = String(row?.artist?.name || '').trim();
			const title = String(row?.title || '').trim();
			if (!artist || !title) continue;
			const k = norm(artist) + '|' + norm(title);
			if (seen.has(k)) continue;
			seen.add(k);
			rows.push({ artist, title });
		}

		const out: ItunesTrack[] = [];
		const seenTrack = new Set<number>();
		// First Deezer hit is usually the one — don't fan out to 5 catalog scans
		for (const row of rows.slice(0, 2)) {
			const artists = await itunesArtistsMatching(row.artist);
			const titleQn = titleCore(row.title) || norm(row.title);
			const hits = await tracksFromArtistCatalog(artists.slice(0, 2), titleQn, seenTrack);
			out.push(...hits);
			if (out.length) break;
		}
		return out;
	} catch {
		return [];
	}
}

/** iTunes ignores niche artists when the title is a common song name — pull their catalog. */
async function catalogHitsForTitleArtistQuery(q: string): Promise<ItunesTrack[]> {
	const tokens = q.trim().split(/\s+/).filter(Boolean);
	if (tokens.length < 2) return [];

	type Split = { artistQ: string; titleQ: string };
	const splits: Split[] = [];
	const pushSplit = (artistTokens: string[], titleTokens: string[]) => {
		if (!artistTokens.length || !titleTokens.length) return;
		const artistQ = artistTokens.join(' ');
		const titleQ = titleTokens.join(' ');
		const aqn = norm(artistQ);
		if (aqn.length < 3 || norm(titleQ).length < 6) return;
		// skip title-ish leftovers ("you", "said") — those aren't artist frags
		if (artistTokens.length === 1 && !looksLikeArtistFrag(artistTokens[0])) return;
		splits.push({ artistQ, titleQ });
	};

	// Prefer trailing artist frag ("… rebz"); also leading ("rebzyyx …")
	pushSplit(tokens.slice(-1), tokens.slice(0, -1));
	pushSplit(tokens.slice(0, 1), tokens.slice(1));

	const seenSplit = new Set<string>();
	const uniqueSplits = splits.filter((s) => {
		const k = norm(s.artistQ) + '|' + norm(s.titleQ);
		if (seenSplit.has(k)) return false;
		seenSplit.add(k);
		return true;
	});

	// Title-only queries ("all the things she said") — don't pay for Deezer/MB
	if (!uniqueSplits.length) return [];

	const out: ItunesTrack[] = [];
	const seenTrack = new Set<number>();
	const artistCache = new Map<string, ItunesArtist[]>();
	const qn = norm(q);

	// Deezer first — fast + ranks niche "title + artistfrag" correctly
	const deezerHits = await deezerHintsForQuery(q);
	for (const t of deezerHits) {
		if (seenTrack.has(t.id)) continue;
		seenTrack.add(t.id);
		out.push(t);
	}
	if (out.some((t) => howHardDoesThisMatch(t, qn) >= 13)) return out;

	for (const { artistQ, titleQ } of uniqueSplits) {
		const titleQn = norm(titleQ);
		const cacheKey = norm(artistQ);
		let artists = artistCache.get(cacheKey);
		if (!artists) {
			artists = await resolveArtistsForFragment(artistQ);
			artistCache.set(cacheKey, artists);
		}
		out.push(...(await tracksFromArtistCatalog(artists, titleQn, seenTrack)));
	}

	return out;
}

function rankSongs(raw: any[], q: string, limit: number, extra: ItunesTrack[] = []): ItunesTrack[] {
	const qn = norm(q);
	const seenIds = new Set<number>();
	const seenTxt = new Set<string>();
	const scored: { t: ItunesTrack; score: number }[] = [];

	const consider = (t: ItunesTrack) => {
		if (seenIds.has(t.id)) return;
		seenIds.add(t.id);

		const k = norm(t.artist) + '|' + norm(t.title);
		if (seenTxt.has(k)) return;
		seenTxt.add(k);

		const score = howHardDoesThisMatch(t, qn);
		if (score <= 0) return;
		scored.push({ t, score });
	};

	for (const row of raw) {
		const t = mapTrack(row);
		if (t) consider(t);
	}
	for (const t of extra) consider(t);

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const aRemix = /\b(remix|mix|flip|edit|cover|karaoke|instrumental|orchestral|slowed|reverb)\b/i.test(
			a.t.title
		)
			? 1
			: 0;
		const bRemix = /\b(remix|mix|flip|edit|cover|karaoke|instrumental|orchestral|slowed|reverb)\b/i.test(
			b.t.title
		)
			? 1
			: 0;
		if (aRemix !== bRemix) return aRemix - bRemix;
		// older originals first on equal score (t.A.T.u. before 2020s covers)
		return (a.t.year || '9999').localeCompare(b.t.year || '9999');
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
	const [raw, catalog] = await Promise.all([itunesFetch(params), catalogHitsForTitleArtistQuery(q)]);
	const results = rankSongs(raw, q, limit, catalog);
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

	// fire both, hope one of them works — plus catalog for "title + artistfrag"
	const [artistRaw, songRaw, catalog] = await Promise.all([
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
		),
		catalogHitsForTitleArtistQuery(q)
	]);

	const songs = rankSongs(songRaw, q, songSlots, catalog);

	// artists often have no art — steal from a song cover
	const artSteal = new Map<string, string>();
	for (const s of songs) {
		if (!s.cover) continue;
		const key = norm(s.artist);
		if (!artSteal.has(key)) artSteal.set(key, s.cover);
		for (const pk of artistBits(s.artist)) {
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
