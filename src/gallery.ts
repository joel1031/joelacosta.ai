import type { ImageMetadata } from 'astro';
import data from './content/gallery.json';

// gallery.json (edited via Keystatic at /keystatic) lists photos in display order;
// the glob resolves each listed filename to its optimizable ImageMetadata.
const images = import.meta.glob<{ default: ImageMetadata }>(
	'./assets/gallery/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
	{ eager: true },
);

// Key by the path under `gallery/` so nested folders can't collide on filename.
const rel = (path: string) => path.split('/gallery/').pop()!;
const byPath = new Map(Object.entries(images).map(([path, mod]) => [rel(path), mod.default]));

export const gallery: ImageMetadata[] = data.images
	.map((entry) => byPath.get(rel(entry.image)))
	.filter((m): m is ImageMetadata => Boolean(m));
