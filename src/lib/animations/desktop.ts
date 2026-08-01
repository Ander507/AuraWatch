import { animate, createTimeline, stagger, type JSAnimation, type Timeline } from 'animejs';
import type { Attachment } from 'svelte/attachments';

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Polished loader while Gemini is working — progress sweep + soft dots. */
export function startDesktopLoading(root: HTMLElement): () => void {
	if (prefersReducedMotion()) return () => {};

	const bar = root.querySelector<HTMLElement>('.load-bar');
	const dots = root.querySelectorAll<HTMLElement>('.load-dot');
	const hint = root.querySelector<HTMLElement>('.load-hint');
	const cursor = root.querySelector<HTMLElement>('.load-cursor');

	const animations: Array<JSAnimation | Timeline> = [];

	if (bar) {
		animations.push(
			animate(bar, {
				translateX: ['-100%', '220%'],
				duration: 1400,
				ease: 'inOut(2)',
				loop: true
			})
		);
	}

	if (dots.length) {
		animations.push(
			animate(dots, {
				opacity: [0.25, 1],
				scale: [0.85, 1],
				duration: 420,
				delay: stagger(140),
				ease: 'inOut(2)',
				loop: true,
				alternate: true
			})
		);
	}

	if (cursor) {
		animations.push(
			animate(cursor, {
				opacity: [1, 0],
				duration: 520,
				ease: 'out(1)',
				loop: true,
				alternate: true
			})
		);
	}

	if (hint) {
		animations.push(
			animate(hint, {
				opacity: [0.55, 1],
				duration: 1100,
				ease: 'inOut(2)',
				loop: true,
				alternate: true
			})
		);
	}

	return () => {
		for (const a of animations) {
			a.pause();
			a.cancel();
		}
	};
}

/** Staggered entrance for recommendation cards (Desktop theme). */
export function animateRecCards(cards: HTMLElement[]): () => void {
	if (!cards.length || prefersReducedMotion()) {
		for (const card of cards) {
			card.style.opacity = '1';
			card.style.transform = '';
		}
		return () => {};
	}

	for (const card of cards) {
		card.style.opacity = '0';
		card.style.transform = 'translateY(18px) scale(0.97)';
	}

	const tl = createTimeline({ defaults: { ease: 'out(3)' } });
	tl.add(
		cards,
		{
			opacity: [0, 1],
			translateY: [18, 0],
			scale: [0.97, 1],
			duration: 480,
			delay: stagger(90)
		},
		0
	);

	return () => {
		tl.pause();
		tl.cancel();
	};
}

/** Attachment: animate a single rec-card when it mounts (Desktop only). */
export function desktopCardEntrance(index: number): Attachment {
	return (element) => {
		if (prefersReducedMotion()) return;

		const el = element as HTMLElement;
		el.style.opacity = '0';
		const anim = animate(el, {
			opacity: [0, 1],
			translateY: [18, 0],
			scale: [0.97, 1],
			duration: 460,
			delay: index * 90,
			ease: 'out(3)'
		});

		return () => {
			anim.pause();
			anim.cancel();
		};
	};
}
