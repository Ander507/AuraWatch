/** Bounce a pick and steer the next pile — the anti-scroll loop. */

export type NotThisSteer = 'darker' | 'lighter' | 'shorter' | 'weirder' | 'opposite';

export const NOT_THIS_STEERS: { id: NotThisSteer; label: string }[] = [
	{ id: 'darker', label: 'Darker' },
	{ id: 'lighter', label: 'Lighter' },
	{ id: 'shorter', label: 'Shorter' },
	{ id: 'weirder', label: 'Weirder' },
	{ id: 'opposite', label: 'Opposite' }
];

const STEER_LINE: Record<NotThisSteer, string> = {
	darker: 'go darker, meaner, more dread — keep the same lane otherwise',
	lighter: 'go warmer, funnier, less heavy — still on-vibe',
	shorter: 'something I can finish tonight, tighter runtime',
	weirder: 'weirder, less obvious, not the usual prestige pick',
	opposite: 'the opposite energy of what you just showed me'
};

export function applyNotThis(opts: {
	title: string;
	genres?: string[];
	prompt: string;
	antiVibe: string;
	steer: NotThisSteer;
}): { prompt: string; antiVibe: string } {
	const title = opts.title.trim();
	const antiParts = [opts.antiVibe.trim(), title].filter(Boolean);
	const antiVibe = [...new Set(antiParts)].join(', ').slice(0, 280);

	const base = opts.prompt.replace(/\s*\[bounce:[^\]]*\]/gi, '').trim();
	const genreBit = (opts.genres || []).slice(0, 2).filter(Boolean).join('/');
	const bounced = genreBit ? `${title} (${genreBit})` : title;
	const bounce = `[bounce: not ${bounced}] ${STEER_LINE[opts.steer]}`;
	const prompt = base ? `${base}. ${bounce}` : bounce;

	return { prompt: prompt.slice(0, 480), antiVibe };
}
