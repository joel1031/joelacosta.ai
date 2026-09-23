/*
  Shared scroll reveals for the homepage sections below Services.

  - `[data-lines]` headings: each `[data-line]` child blurs in from big to small, tied to
    scroll position, a line at a time (the same motion as the About heading). Once in, it stays.
  - `[data-rise]` elements: fade and rise once, the first time they come into view. An
    optional value staggers them, in seconds: `data-rise="0.12"`.

  Hidden states are set here, not in CSS, so nothing stays invisible without JavaScript.
  Returns a teardown for `astro:before-swap`.
*/

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function reveal(root: ParentNode = document): () => void {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
	const tweens: gsap.core.Tween[] = [];

	root.querySelectorAll<HTMLElement>('[data-lines]').forEach((heading) => {
		const trigger = heading.closest('section') ?? heading;
		heading.querySelectorAll<HTMLElement>('[data-line]').forEach((line, i) => {
			tweens.push(
				gsap.fromTo(
					line,
					{ opacity: 0, scale: 1.45, filter: 'blur(14px)' },
					{
						opacity: 1,
						scale: 1,
						filter: 'blur(0px)',
						ease: 'none',
						scrollTrigger: {
							trigger,
							start: `top ${95 - i * 20}%`,
							end: `top ${55 - i * 20}%`,
							scrub: true,
							// Plays once; scrolling back up never replays it.
							once: true,
						},
					},
				),
			);
		});
	});

	root.querySelectorAll<HTMLElement>('[data-rise]').forEach((el) => {
		tweens.push(
			gsap.fromTo(
				el,
				{ opacity: 0, y: 16, filter: 'blur(6px)' },
				{
					opacity: 1,
					y: 0,
					filter: 'blur(0px)',
					duration: 0.7,
					delay: Number(el.dataset.rise) || 0,
					ease: 'power2.out',
					clearProps: 'filter,transform',
					scrollTrigger: { trigger: el, start: 'top 92%', once: true },
				},
			),
		);
	});

	return () =>
		tweens.forEach((t) => {
			t.scrollTrigger?.kill();
			t.kill();
		});
}
