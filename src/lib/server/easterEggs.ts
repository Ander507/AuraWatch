// hush hush — Sur Ronster / Talaria easter eggs
import { songListenLinks, type ItunesTrack } from '$lib/server/itunesSearch';

const SURRONSTER_CHANNEL_ID = 'UC_1QUZJSTYqda_dVYlNV03w';
const ON_MY_OWN_TRACK_ID = 1482847214;

/** Songs mode: Surron / Talaria → only Kyle The Hooligan — On My Own */
export function isSurronSongSecret(text: string): boolean {
	return /\b(surron|talaria|surronster)\b/i.test(text || '');
}

/** Movies / TV: "surronster vibe" (or just surronster) → his newest YouTube uploads */
export function isSurronsterVibeSecret(text: string): boolean {
	return /\bsurronster\b/i.test(text || '');
}

function hiResArt(url: string | null | undefined) {
	if (!url) return null;
	return url.replace('100x100bb', '600x600bb').replace('100x100', '600x600');
}

export async function fetchOnMyOwnTrack(): Promise<ItunesTrack | null> {
	try {
		const res = await fetch(
			`https://itunes.apple.com/lookup?id=${ON_MY_OWN_TRACK_ID}&entity=song`
		);
		if (!res.ok) return null;
		const data = await res.json();
		const r = (data?.results || []).find((x: any) => x?.wrapperType === 'track' || x?.trackId);
		if (!r?.trackName || !r?.artistName || !r?.trackId) return null;
		return {
			id: Number(r.trackId),
			title: String(r.trackName),
			artist: String(r.artistName),
			album: r.collectionName ? String(r.collectionName) : null,
			cover: hiResArt(r.artworkUrl100),
			year: r.releaseDate ? String(r.releaseDate).slice(0, 4) : null,
			previewUrl: r.previewUrl || null,
			appleUrl: r.trackViewUrl || null,
			kindLabel: 'SONG'
		};
	} catch (e) {
		console.warn('on my own lookup died', e);
		return null;
	}
}

export function songSecretRecommendation(track: ItunesTrack) {
	const listen = songListenLinks({
		title: track.title,
		artist: track.artist,
		appleUrl: track.appleUrl
	});
	return {
		title: track.title,
		artist: track.artist,
		cover: track.cover || '',
		genres: track.album ? [track.album] : ['Sur Ronster Theme'],
		pitch: 'Sur Ronster / Talaria special — On My Own by Kyle The Hooligan.',
		mediaType: 'Song',
		seasonInfo: track.year || undefined,
		rating: undefined,
		releaseYear: track.year || undefined,
		searchQuery: `${track.artist} ${track.title}`,
		region: undefined,
		providers: listen.map((l) => ({ name: l.name, logo: null, url: l.url })),
		zflix_url: listen[0]?.url,
		listen_url: track.appleUrl || listen[0]?.url,
		preview_url: track.previewUrl || undefined,
		kind: 'song' as const
	};
}

export type SurronsterVid = {
	videoId: string;
	title: string;
	description: string;
	publishedAt: string | null;
	thumbnail: string;
	url: string;
};

function decodeXml(s: string) {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

function tag(block: string, name: string): string {
	const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
	return m ? decodeXml(m[1].trim()) : '';
}

function attr(block: string, name: string, attrName: string): string {
	const m = block.match(
		new RegExp(`<${name}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`, 'i')
	);
	return m ? decodeXml(m[1]) : '';
}

/** Latest Sur Ronster uploads via public Atom feed (no API key). */
export async function fetchSurronsterNewest(limit = 5): Promise<SurronsterVid[]> {
	try {
		const res = await fetch(
			`https://www.youtube.com/feeds/videos.xml?channel_id=${SURRONSTER_CHANNEL_ID}`,
			{ headers: { Accept: 'application/atom+xml,application/xml,text/xml,*/*' } }
		);
		if (!res.ok) return [];
		const xml = await res.text();
		const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
		const out: SurronsterVid[] = [];
		for (const entry of entries) {
			const videoId =
				tag(entry, 'yt:videoId') ||
				(tag(entry, 'id').match(/yt:video:(.+)/)?.[1] ?? '');
			const title = tag(entry, 'title') || 'Sur Ronster';
			if (!videoId) continue;
			const description =
				tag(entry, 'media:description') || tag(entry, 'summary') || '';
			const publishedAt = tag(entry, 'published') || null;
			const thumb =
				attr(entry, 'media:thumbnail', 'url') ||
				`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
			out.push({
				videoId,
				title,
				description: description.slice(0, 280),
				publishedAt,
				thumbnail: thumb.replace('http://', 'https://'),
				url: `https://www.youtube.com/watch?v=${videoId}`
			});
			if (out.length >= limit) break;
		}
		return out;
	} catch (e) {
		console.warn('surronster feed died', e);
		return [];
	}
}

export function surronsterVidRecommendations(vids: SurronsterVid[]) {
	return vids.map((v) => {
		const year = v.publishedAt ? v.publishedAt.slice(0, 4) : undefined;
		return {
			title: v.title,
			cover: v.thumbnail,
			coverFallbacks: [
				`https://i.ytimg.com/vi/${v.videoId}/maxresdefault.jpg`,
				`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
			],
			genres: ['Sur Ronster', 'YouTube'],
			pitch: v.description
				? v.description
				: 'Fresh off @surronster — newest upload.',
			mediaType: 'YouTube',
			seasonInfo: year,
			rating: undefined,
			releaseYear: year,
			region: undefined,
			providers: [
				{ name: 'YouTube', logo: null, url: v.url },
				{
					name: 'Channel',
					logo: null,
					url: 'https://www.youtube.com/@surronster'
				}
			],
			watch_link: v.url,
			trailer_youtube_key: v.videoId,
			likeTitle: 'Sur Ronster',
			likeTitles: ['Sur Ronster'],
			kind: 'media' as const
		};
	});
}
