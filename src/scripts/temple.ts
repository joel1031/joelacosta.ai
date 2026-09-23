/*
  The services Acropolis: three columns holding one roof, drawn in the same dots as the hero.

  The temple is drawn flat into a small canvas (marble lit from the left), then that canvas is
  read back and painted as dots. `build` runs 0–1 with scroll: steps, then the columns rising
  one after another, then the roof dropping on. Once built, the dots keep breathing.

  On a white page (`ink`) it prints as a halftone instead: the canvas is white paper, the
  marble a shade darker so it holds on white, and the darker the stone the bigger the dot,
  so the shadowed side still reads as shadow. The dots keep the marble's own warm colours.
*/

import { BAYER, DOT_LEVELS, SPACING } from './dither';

const SAT = 1.3;
const GAIN = 1.1;
/** Ink mode: how much of the marble's brightness is kept, so the stone holds on white. */
const INK_TONE = 0.66;
/** Ink mode: colour pushed a little, since the darkening above dulls it. */
const INK_SAT = 1.5;
/** Ink mode: wider gaps than the hero's dots, so the print stays open on white. */
const INK_SPACING = 0.4;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function makeTemple(canvas: HTMLCanvasElement, box: HTMLElement, opts: { still?: boolean; ink?: boolean } = {}) {
	const src = document.createElement('canvas');
	const sg = src.getContext('2d', { willReadFrequently: true })!;
	const g = canvas.getContext('2d')!;
	const grid = { cols: 96, rows: 54, cell: 1 };
	const still = Boolean(opts.still);
	const ink = Boolean(opts.ink);
	const paper = ink ? '#fff' : '#0a0a0a';
	// The marble tones, darkened for ink.
	const tone = (hex: string) =>
		ink
			? `rgb(${[1, 3, 5].map((k) => Math.round(parseInt(hex.slice(k, k + 2), 16) * INK_TONE)).join(',')})`
			: hex;

	let build = still ? 1 : 0;
	// The scroll position sets a target; the drawn value eases toward it, which keeps the
	// build smooth through the coarse steps of a wheel or trackpad.
	let target = build;
	let visible = false;
	let raf = 0;
	let alive = true;

	function layout() {
		const r = box.getBoundingClientRect();
		const dpr = Math.min(2, devicePixelRatio || 1);
		canvas.width = Math.round(r.width * dpr);
		canvas.height = Math.round(r.height * dpr);
		// Finer with width, within limits: about one column per 7px.
		grid.cols = Math.round(Math.min(96, Math.max(50, r.width / 7)));
		grid.cell = canvas.width / grid.cols;
		grid.rows = Math.floor(canvas.height / grid.cell);
		src.width = grid.cols;
		src.height = grid.rows;
	}

	// Marble, lit from the left.
	function stone(x0: number, x1: number, light: string, dark: string) {
		const grad = sg.createLinearGradient(x0, 0, x1, 0);
		grad.addColorStop(0, tone(light));
		grad.addColorStop(1, tone(dark));
		return grad;
	}

	function drawTemple(b: number) {
		const W = grid.cols;
		const H = grid.rows;
		const L = W * 0.04;
		const R = W * 0.96;
		sg.globalAlpha = 1;
		sg.fillStyle = paper;
		sg.fillRect(0, 0, W, H);
		const baseTop = H * 0.84;
		const colTop = H * 0.4;
		const cw = W * 0.11;

		// Steps
		const kb = seg(b, 0, 0.22);
		if (kb > 0) {
			sg.globalAlpha = kb;
			const lift = (1 - kb) * H * 0.06;
			[
				[0, 0.06],
				[0.02, 0.05],
				[0.04, 0.05],
			].forEach(([inset, h], i) => {
				const y = H - (i + 1) * H * 0.053 + lift;
				sg.fillStyle = stone(L, R, '#d9d1c1', '#857d6f');
				sg.fillRect(L + inset * W, y, R - L - 2 * inset * W, H * h);
			});
			sg.globalAlpha = 1;
		}

		// Columns grow up from the base, one after another
		[1 / 6, 1 / 2, 5 / 6].forEach((f, i) => {
			const k = seg(b, 0.18 + i * 0.12, 0.42 + i * 0.12);
			if (k <= 0) return;
			const cx = W * f;
			const top = baseTop - (baseTop - colTop) * k;
			sg.fillStyle = stone(cx - cw / 2, cx + cw / 2, '#e6dfd1', '#7a7266');
			sg.fillRect(cx - cw / 2, top, cw, baseTop - top);
			sg.fillStyle = 'rgba(0,0,0,.18)';
			for (let fl = 1; fl < 5; fl++) sg.fillRect(cx - cw / 2 + (cw * fl) / 5 - 0.35, top, 0.7, baseTop - top);
			if (k > 0.9) {
				sg.globalAlpha = seg(k, 0.9, 1);
				sg.fillStyle = stone(cx - cw * 0.75, cx + cw * 0.75, '#ece6d9', '#8a8275');
				sg.fillRect(cx - cw * 0.75, colTop - H * 0.035, cw * 1.5, H * 0.04);
				sg.globalAlpha = 1;
			}
		});

		// Roof: entablature and pediment drop into place
		const kr = seg(b, 0.72, 0.96);
		if (kr > 0) {
			const drop = (1 - kr) * -H * 0.25;
			sg.globalAlpha = kr;
			sg.fillStyle = stone(L, R, '#e3dccd', '#80786b');
			sg.fillRect(L, H * 0.28 + drop, R - L, H * 0.085);
			sg.fillStyle = 'rgba(0,0,0,.2)';
			sg.fillRect(L, H * 0.325 + drop, R - L, 0.8);
			sg.fillStyle = stone(L, R, '#efe9dc', '#8b8376');
			sg.beginPath();
			sg.moveTo(L - W * 0.01, H * 0.28 + drop);
			sg.lineTo(W / 2, H * 0.05 + drop);
			sg.lineTo(R + W * 0.01, H * 0.28 + drop);
			sg.closePath();
			sg.fill();
			sg.fillStyle = paper;
			sg.beginPath();
			sg.moveTo(L + W * 0.09, H * 0.255 + drop);
			sg.lineTo(W / 2, H * 0.1 + drop);
			sg.lineTo(R - W * 0.09, H * 0.255 + drop);
			sg.closePath();
			sg.fill();
			sg.globalAlpha = 1;
		}
	}

	function render(now: number) {
		drawTemple(build);
		const { cols, rows, cell } = grid;
		const d = sg.getImageData(0, 0, cols, rows).data;
		g.clearRect(0, 0, canvas.width, canvas.height);
		const buckets = new Map<number, Path2D>();
		const maxR = (cell * (1 - (ink ? INK_SPACING : SPACING))) / 2;
		const breath = still ? 0 : 1;

		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) {
				const o = (j * cols + i) * 4;
				let r = d[o];
				let gg = d[o + 1];
				let b = d[o + 2];
				const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
				// In ink the dot grows with how dark the stone is, not how bright, but never
				// shrinks to nothing on the lit face, or the stone's colour would be lost.
				const v = ink ? 255 - l * 0.5 : l;
				const q = Math.min(
					DOT_LEVELS - 1,
					Math.floor(Math.min(1, (v / 255) * 1.08) * (DOT_LEVELS - 1) + BAYER[j & 7][i & 7]),
				);
				if (q <= 0) continue;
				const sat = ink ? INK_SAT : SAT;
				const gain = ink ? 1 : GAIN;
				r = (l + (r - l) * sat) * gain;
				gg = (l + (gg - l) * sat) * gain;
				b = (l + (b - l) * sat) * gain;
				// Buckets by colour, so each shade is one fill call.
				const key =
					((Math.min(255, Math.max(0, r)) >> 4) << 8) |
					((Math.min(255, Math.max(0, gg)) >> 4) << 4) |
					(Math.min(255, Math.max(0, b)) >> 4);
				let p = buckets.get(key);
				if (!p) {
					p = new Path2D();
					buckets.set(key, p);
				}
				const rad =
					maxR *
					Math.sqrt(q / (DOT_LEVELS - 1)) *
					(1 + breath * 0.14 * Math.sin(now * 0.0011 - i * 0.16 - j * 0.11));
				const x = (i + 0.5) * cell;
				const y = (j + 0.5) * cell;
				p.moveTo(x + rad, y);
				p.arc(x, y, rad, 0, Math.PI * 2);
			}
		}
		buckets.forEach((p, key) => {
			g.fillStyle = `rgb(${((key >> 8) & 15) * 17},${((key >> 4) & 15) * 17},${(key & 15) * 17})`;
			g.fill(p);
		});
	}

	const loop = (now: number) => {
		if (!alive) return;
		build += (target - build) * 0.06;
		if (Math.abs(target - build) < 0.0005) build = target;
		if (visible) render(now);
		raf = requestAnimationFrame(loop);
	};

	const resize = new ResizeObserver(() => {
		layout();
		if (still) render(0);
	});
	resize.observe(box);
	const seen = new IntersectionObserver(([e]) => {
		visible = e.isIntersecting;
	});
	seen.observe(box);

	layout();
	if (still) render(0);
	else raf = requestAnimationFrame(loop);

	return {
		/** How far the temple has been built, 0–1. Driven by scroll position. */
		setBuild(v: number) {
			target = v;
			if (still) build = v;
		},
		destroy() {
			alive = false;
			cancelAnimationFrame(raf);
			resize.disconnect();
			seen.disconnect();
		},
	};
}
