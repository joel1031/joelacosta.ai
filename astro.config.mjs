// @ts-check

import keystatic from '@keystatic/astro';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// Keystatic (local CMS at /keystatic) only loads when KEYSTATIC=1 — `npm run dev`
// sets it; `astro build` never sees it, so the production build stays fully static.
const cms = process.env.KEYSTATIC ? [react(), keystatic()] : [];

// https://astro.build/config
export default defineConfig({
	site: 'https://joelacosta.ai',
	// /lab became /work. Static output emits meta-refresh stubs so old links survive.
	redirects: {
		'/lab': '/work',
		'/lab/[...slug]': '/work/[...slug]',
	},
	integrations: [mdx(), sitemap(), ...cms],
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-inter',
			fallbacks: ['sans-serif'],
			weights: [400, 500],
			styles: ['normal'],
		},
		// Headlines and the J.AI mark only.
		{
			provider: fontProviders.google(),
			name: 'Unbounded',
			cssVariable: '--font-unbounded',
			fallbacks: ['sans-serif'],
			weights: [700],
			styles: ['normal'],
		},
	],
});
