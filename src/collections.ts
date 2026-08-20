import { getCollection } from 'astro:content';

// Entries with `draft: true` stay in the repo but never reach the built site:
// visible while running `npm run dev` so a draft can be previewed, dropped from
// `astro build` — which also keeps them out of the sitemap, since no page is emitted.
export const getVisible = <C extends 'blog' | 'projects'>(collection: C) =>
	getCollection(collection, ({ data }) => import.meta.env.DEV || !data.draft);

// True only while previewing locally — pages use it to mark drafts in listings.
export const showingDrafts = import.meta.env.DEV;
