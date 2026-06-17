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
	integrations: [mdx(), sitemap(), ...cms],
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Geist',
			cssVariable: '--font-geist',
			fallbacks: ['sans-serif'],
			weights: [400, 500],
			styles: ['normal'],
		},
	],
});
