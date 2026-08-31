/** How much night is left — movies mainly, TV episodes as a soft hint. */

export type RuntimeBudget = '' | '90' | '120' | 'epic';

export const RUNTIME_OPTIONS: { id: RuntimeBudget; label: string; hint: string }[] = [
	{ id: '', label: 'Any length', hint: 'No clock' },
	{ id: '90', label: '< 90 min', hint: 'One sitting' },
	{ id: '120', label: '~2 hours', hint: 'Feature' },
	{ id: 'epic', label: 'Go long', hint: '2h+' }
];

export function parseRuntimeBudget(raw: unknown): RuntimeBudget {
	const s = String(raw ?? '').trim().toLowerCase();
	if (s === '90' || s === 'short' || s === 'under90') return '90';
	if (s === '120' || s === '2h' || s === 'feature') return '120';
	if (s === 'epic' || s === 'long' || s === '180') return 'epic';
	return '';
}

export function runtimeAllowed(
	minutes: number | null | undefined,
	budget: RuntimeBudget
): boolean {
	if (!budget) return true;
	if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return true;
	if (budget === '90') return minutes <= 100;
	if (budget === '120') return minutes <= 140;
	return minutes >= 130;
}

export function runtimePromptBlock(budget: RuntimeBudget): string {
	if (budget === '90') {
		return `- Runtime (HARD): Prefer movies ≤ 95 minutes. TV: short-form or ~40 min episodes / limited series. No 3-hour epics.`;
	}
	if (budget === '120') {
		return `- Runtime: Feature-length is fine (~90–130 min). Skip bloated 160+ min films unless they are the only on-vibe pick.`;
	}
	if (budget === 'epic') {
		return `- Runtime: Lean long — theatrical epics, long episodes, or dense films. Skip quick 80-minute fluff.`;
	}
	return '';
}

export function runtimeStrictRule(budget: RuntimeBudget): string {
	if (budget === '90') {
		return `CRITICAL RULE: Runtime budget is SHORT. Do not recommend 2.5 hour films. Prefer tight movies and limited series.`;
	}
	if (budget === 'epic') {
		return `CRITICAL RULE: Runtime budget is LONG. Prefer substantial runtimes over snack-size titles.`;
	}
	return '';
}
