/** Initials + deterministic gradient for poster/cover fallbacks */

export function mediaInitials(title: string, artist?: string | null): string {
	const raw = String(title || '').trim() || String(artist || '').trim() || 'AW';
	const words = raw
		.replace(/\([^)]*\)/g, ' ')
		.split(/[\s\-–—:&/|]+/)
		.map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
		.filter(Boolean);
	if (words.length >= 2) {
		return (words[0][0] + words[1][0]).toUpperCase();
	}
	const one = words[0] || 'AW';
	return one.slice(0, 2).toUpperCase();
}

function hashHue(seed: string): number {
	let h = 0;
	const s = seed || 'aurawatch';
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h % 360;
}

/** Inline style for a sleek gradient block keyed off the title. */
export function coverFallbackStyle(seed: string): string {
	const hue = hashHue(seed);
	const a = `hsl(${hue} 42% 22%)`;
	const b = `hsl(${(hue + 38) % 360} 48% 14%)`;
	const c = `hsl(${(hue + 18) % 360} 55% 28%)`;
	return `background: linear-gradient(145deg, ${a} 0%, ${b} 48%, ${c} 100%);`;
}
