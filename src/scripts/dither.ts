/*
  The hero backdrop: photos redrawn as a grid of coloured dots (ordered Bayer dithering).

  One buffer per photo holds a tone value and a colour per cell. Each frame the dots are
  drawn at a radius set by the tone, bucketed by colour so the whole grid is a handful of
  fills. On top of that sit three motions: the photo drifts slowly forward, a slow wave
  passes through the dot sizes, and on a laptop the dots lean away from the pointer.
*/

type Buffer = { L: Float32Array; RGB: Uint8ClampedArray };
type DrawOpts = { zA?: number; zB?: number; breath?: number; time?: number; fade?: number };

const LEVELS = 6;
const SAT = 1.4;
const GAIN = 1.15;
/** Gap between dots, as a fraction of a cell. Shared with the services temple. */
export const SPACING = 0.12;
/** Number of dot sizes. Shared with the services temple. */
export const DOT_LEVELS = LEVELS;
const DRIFT = 0.000015; // zoom per millisecond — about +1.5% a second
const FADE_MS = 1600;
const HOLD_MS = 6000;

/** The 8×8 ordered dither threshold matrix, shared with the services temple. */
export const BAYER = (() => {
	let m = [
		[0, 2],
		[3, 1],
	];
	for (let k = 0; k < 2; k++) {
		const n = m.length;
		const r: number[][] = [];
		for (let y = 0; y < 2 * n; y++) {
			r[y] = [];
			for (let x = 0; x < 2 * n; x++) {
				const q = (y < n ? 0 : 2) + (x < n ? 0 : 1);
				r[y][x] = 4 * m[y % n][x % n] + [0, 2, 3, 1][q];
			}
		}
		m = r;
	}
	return m.map((row) => row.map((v) => (v + 0.5) / 64));
})();

export function makeDither(
	canvas: HTMLCanvasElement,
	box: HTMLElement,
	sources: string[],
	opts: { lean?: boolean } = {},
) {
	const src = document.createElement('canvas');
	const sg = src.getContext('2d', { willReadFrequently: true })!;
	const g = canvas.getContext('2d')!;
	const grid = { cols: 120, rows: 68, cell: 1 };
	const lean = {
		on: Boolean(opts.lean) && matchMedia('(hover: hover) and (pointer: fine)').matches,
		px: -9999,
		py: -9999,
		tx: -9999,
		ty: -9999,
	};

	const images: HTMLImageElement[] = [];
	let buffers: (Buffer | null)[] = [];
	let intro = 0;
	let idleStart: number | null = null;
	let running = false;
	let raf = 0;
	let size = '';
	let prev = 0;
	let cur = 0;
	let fade = 1;
	let fadeStart = 0;
	let shownAt: number[] = [];
	let lastSwap = 0;

	function layout() {
		const r = box.getBoundingClientRect();
		const dpr = Math.min(2, devicePixelRatio || 1);
		grid.cols = r.width < 700 ? 52 : 120;
		canvas.width = Math.round(r.width * dpr);
		canvas.height = Math.round(r.height * dpr);
		grid.cell = canvas.width / grid.cols;
		grid.rows = Math.ceil(canvas.height / grid.cell);
		src.width = grid.cols;
		src.height = grid.rows;
		buffers = images.map((img) => (img.complete && img.naturalWidth ? measure(img) : null));
		size = `${Math.round(r.width)}x${Math.round(r.height)}`;
	}

	// Draw the photo into the small grid canvas, then read it back as tone + colour.
	// Tone is auto-levelled to the photo's own 2nd/98th percentiles so every photo
	// uses the whole dot range.
	function measure(img: HTMLImageElement): Buffer {
		const { cols, rows } = grid;
		sg.globalAlpha = 1;
		sg.fillStyle = '#000';
		sg.fillRect(0, 0, cols, rows);
		const s = Math.max(cols / img.naturalWidth, rows / img.naturalHeight);
		const w = img.naturalWidth * s;
		const h = img.naturalHeight * s;
		sg.drawImage(img, (cols - w) / 2, (rows - h) / 2, w, h);

		const d = sg.getImageData(0, 0, cols, rows).data;
		const n = cols * rows;
		const L = new Float32Array(n);
		const RGB = new Uint8ClampedArray(n * 3);
		for (let i = 0; i < n; i++) {
			const r = d[i * 4];
			const gg = d[i * 4 + 1];
			const b = d[i * 4 + 2];
			RGB[i * 3] = r;
			RGB[i * 3 + 1] = gg;
			RGB[i * 3 + 2] = b;
			L[i] = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
		}
		const sorted = Float32Array.from(L).sort();
		const lo = sorted[Math.floor(n * 0.02)];
		const hi = sorted[Math.floor(n * 0.98)] || 1;
		for (let i = 0; i < n; i++) {
			let v = (L[i] - lo) / Math.max(0.004, hi - lo);
			v = (v - 0.5) * 1.2 + 0.5 + 0.06;
			v = Math.min(1, Math.max(0, v));
			L[i] = v < 0.02 ? 0 : v;
		}
		return { L, RGB };
	}

	// Bilinear read, so the slow forward drift moves smoothly instead of stepping cell to cell.
	const sa = new Float32Array(4);
	const sb = new Float32Array(4);
	function sample(buf: Buffer, x: number, y: number, out: Float32Array) {
		const { cols, rows } = grid;
		x = Math.min(cols - 1, Math.max(0, x - 0.5));
		y = Math.min(rows - 1, Math.max(0, y - 0.5));
		const x0 = x | 0;
		const y0 = y | 0;
		const x1 = Math.min(cols - 1, x0 + 1);
		const y1 = Math.min(rows - 1, y0 + 1);
		const fx = x - x0;
		const fy = y - y0;
		const w00 = (1 - fx) * (1 - fy);
		const w10 = fx * (1 - fy);
		const w01 = (1 - fx) * fy;
		const w11 = fx * fy;
		const a = y0 * cols + x0;
		const b = y0 * cols + x1;
		const c = y1 * cols + x0;
		const e = y1 * cols + x1;
		out[0] = buf.L[a] * w00 + buf.L[b] * w10 + buf.L[c] * w01 + buf.L[e] * w11;
		for (let k = 0; k < 3; k++) {
			out[k + 1] =
				buf.RGB[a * 3 + k] * w00 + buf.RGB[b * 3 + k] * w10 + buf.RGB[c * 3 + k] * w01 + buf.RGB[e * 3 + k] * w11;
		}
		return out;
	}

	function dots(A: Buffer | null, B: Buffer | null, t: number, o: DrawOpts = {}) {
		// Cleared, not filled: an opaque canvas would hide the cursor light behind the page and
		// leave a visible edge where the hero ends.
		g.clearRect(0, 0, canvas.width, canvas.height);
		if (!A || !B) return;
		const { cols, rows, cell } = grid;
		const zA = o.zA || 1;
		const zB = o.zB || 1;
		const breath = o.breath || 0;
		const time = o.time || 0;
		const grow = o.fade === undefined ? 1 : o.fade;
		const R = cols * 0.6;
		const amp = cols * 0.06;
		const mx = lean.px / cell;
		const my = lean.py / cell;
		const hx = cols / 2;
		const hy = rows / 2;
		const buckets = new Map<number, Path2D>();
		const maxR = (cell * (1 - SPACING)) / 2;
		const u = 1 - t;

		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) {
				const cx = i + 0.5;
				const cy = j + 0.5;
				let sx = cx;
				let sy = cy;
				let glow = 0;
				if (lean.on && lean.px > -9000) {
					const dx = cx - mx;
					const dy = cy - my;
					const dist = Math.hypot(dx, dy);
					if (dist < R) {
						const k = 1 - dist / R;
						const fall = k * k * (3 - 2 * k);
						sx = cx - Math.sign(dx || 1) * fall * amp;
						sy = cy + fall * amp * 0.35;
						glow = fall * fall;
					}
				}
				const va = sample(A, hx + (sx - hx) / zA, hy + (sy - hy) / zA, sa);
				const vb = t > 0 ? sample(B, hx + (sx - hx) / zB, hy + (sy - hy) / zB, sb) : va;
				let v = va[0] * u + vb[0] * t;
				// The cursor light: dots near the pointer brighten, so the glow that follows the
				// pointer everywhere else on the site carries across the hero too.
				if (glow > 0) v = Math.min(1, v + glow * 0.28);
				const q = Math.min(LEVELS - 1, Math.floor(v * (LEVELS - 1) + BAYER[j & 7][i & 7]));
				if (q <= 0) continue;

				let r = va[1] * u + vb[1] * t;
				let gg = va[2] * u + vb[2] * t;
				let b = va[3] * u + vb[3] * t;
				const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
				r = (l + (r - l) * SAT) * GAIN;
				gg = (l + (gg - l) * SAT) * GAIN;
				b = (l + (b - l) * SAT) * GAIN;
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
					Math.sqrt(q / (LEVELS - 1)) *
					grow *
					(1 + breath * 0.14 * Math.sin(time * 0.0011 - i * 0.16 - j * 0.11));
				p.moveTo(cx * cell + rad, cy * cell);
				p.arc(cx * cell, cy * cell, rad, 0, Math.PI * 2);
			}
		}
		buckets.forEach((p, key) => {
			g.fillStyle = `rgb(${((key >> 8) & 15) * 17},${((key >> 4) & 15) * 17},${(key & 15) * 17})`;
			g.fill(p);
		});
	}

	function tick(now: number) {
		if (!running) return;
		if (idleStart === null) {
			// Opening: the photo sharpens out of a blur as its dots grow in.
			const show = Math.min(1, Math.max(0, intro / 0.3));
			const blur = 20 * (1 - Math.min(1, Math.max(0, (intro - 0.02) / 0.33)));
			canvas.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : '';
			if (show <= 0 || !buffers[0]) {
				g.clearRect(0, 0, canvas.width, canvas.height);
			} else {
				dots(buffers[0], buffers[0], 0, { fade: show, time: now });
			}
		} else {
			// Idle: crossfading carousel, slow forward drift, breathing dots, pointer lean.
			const usable = buffers.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
			if (usable.length > 1 && now - lastSwap > HOLD_MS) {
				prev = cur;
				const at = usable.indexOf(cur);
				cur = usable[(at + 1) % usable.length];
				shownAt[cur] = now;
				fade = 0;
				fadeStart = now;
				lastSwap = now;
			}
			if (fade < 1) fade = Math.min(1, (now - fadeStart) / FADE_MS);
			if (lean.tx < -9000) {
				if (lean.px > -9000) {
					lean.px += (lean.px > canvas.width / 2 ? 1 : -1) * canvas.width * 0.04;
					if (lean.px > canvas.width * 2.5 || lean.px < -canvas.width * 1.5) {
						lean.px = -9999;
						lean.py = -9999;
					}
				}
			} else {
				lean.px += (lean.tx - lean.px) * 0.12;
				lean.py += (lean.ty - lean.py) * 0.12;
			}
			dots(buffers[prev] || buffers[cur], buffers[cur], fade, {
				zA: 1 + (now - (shownAt[prev] ?? idleStart)) * DRIFT,
				zB: 1 + (now - (shownAt[cur] ?? idleStart)) * DRIFT,
				breath: Math.min(1, (now - idleStart) / 2000),
				time: now,
			});
		}
		raf = requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		raf = requestAnimationFrame(tick);
	}

	function load(index: number) {
		return new Promise<void>((resolve) => {
			const img = new Image();
			img.decoding = 'async';
			img.src = sources[index];
			images[index] = img;
			const done = () => {
				if (img.naturalWidth) buffers[index] = measure(img);
				resolve();
			};
			if (img.complete) done();
			else {
				img.onload = done;
				img.onerror = () => resolve();
			}
		});
	}

	const onMove = (e: PointerEvent) => {
		const r = box.getBoundingClientRect();
		const dpr = canvas.width / r.width;
		lean.tx = (e.clientX - r.left) * dpr;
		lean.ty = (e.clientY - r.top) * dpr;
		if (lean.px < -9000) {
			lean.px = lean.tx;
			lean.py = lean.ty;
		}
	};
	const onLeave = () => {
		lean.tx = -9999;
		lean.ty = -9999;
	};
	if (lean.on) {
		box.addEventListener('pointermove', onMove);
		box.addEventListener('pointerleave', onLeave);
	}

	const resize = new ResizeObserver(() => {
		const r = box.getBoundingClientRect();
		if (`${Math.round(r.width)}x${Math.round(r.height)}` === size) return;
		layout();
	});
	resize.observe(box);

	layout();
	// The first photo is all the opening needs; the rest arrive quietly behind it.
	const first = load(0).then(() => {
		shownAt = sources.map(() => performance.now());
		start();
	});
	first.then(() => {
		sources.slice(1).forEach((_, i) => load(i + 1));
	});

	return {
		/** Progress of the opening, 0–1, while the hero animates itself in. */
		setIntro(p: number) {
			intro = p;
			start();
		},
		/** Hand over to the idle hero: carousel, drift, breathing, lean. */
		idle() {
			canvas.style.filter = '';
			idleStart = performance.now();
			lastSwap = idleStart;
			shownAt = sources.map(() => idleStart!);
			start();
		},
		/** Reduced motion: the finished hero, no opening and no idle movement. */
		showFinished() {
			intro = 1;
			canvas.style.filter = '';
			first.then(() => dots(buffers[0], buffers[0], 0));
			running = false;
		},
		destroy() {
			running = false;
			cancelAnimationFrame(raf);
			resize.disconnect();
			if (lean.on) {
				box.removeEventListener('pointermove', onMove);
				box.removeEventListener('pointerleave', onLeave);
			}
		},
	};
}
