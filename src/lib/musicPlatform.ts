/** Preferred music apps for Listen / external-link dispatch. */

export type MusicPlatform = 'youtube_music' | 'spotify' | 'apple_music';

export const MUSIC_PLATFORMS: { id: MusicPlatform; label: string }[] = [
	{ id: 'youtube_music', label: 'YouTube Music' },
	{ id: 'spotify', label: 'Spotify' },
	{ id: 'apple_music', label: 'Apple Music' }
];

const KEY = 'aurawatch_music_platform_v1';
const DEFAULT: MusicPlatform = 'youtube_music';

export function isMusicPlatform(v: unknown): v is MusicPlatform {
	return v === 'youtube_music' || v === 'spotify' || v === 'apple_music';
}

export function loadMusicPlatform(): MusicPlatform {
	if (typeof localStorage === 'undefined') return DEFAULT;
	try {
		const raw = localStorage.getItem(KEY);
		return isMusicPlatform(raw) ? raw : DEFAULT;
	} catch {
		return DEFAULT;
	}
}

export function saveMusicPlatform(platform: MusicPlatform): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, platform);
	} catch {
		/* quota */
	}
}

// mapping dynamic stream queries across music platforms so users aren't locked to apple music
export function musicListenUrl(
	platform: MusicPlatform,
	opts: { title: string; artist?: string | null; appleUrl?: string | null }
): string {
	const artist = String(opts.artist || '').trim();
	const title = String(opts.title || '').trim();
	const q = encodeURIComponent(artist ? `${artist} ${title}` : title);

	if (platform === 'spotify') {
		return `https://open.spotify.com/search/${q}`;
	}
	if (platform === 'apple_music') {
		if (opts.appleUrl) return opts.appleUrl;
		return `https://music.apple.com/search?term=${q}`;
	}
	return `https://music.youtube.com/search?q=${q}`;
}

export function platformLabel(id: MusicPlatform): string {
	return MUSIC_PLATFORMS.find((p) => p.id === id)?.label || id;
}
