// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Joel Acosta';
export const SITE_DESCRIPTION = 'read · look · work · listen';

// The whole navigation. Shared by the header (Nav.astro) and the home hero
// (index.astro) — they morph into each other via the `brand-tabs` view
// transition, so they must list the same words in the same order.
export const TABS = [
	{ href: '/read', label: 'read' },
	{ href: '/look', label: 'look' },
	{ href: '/work', label: 'work' },
	{ href: '/listen', label: 'listen' },
];

// This month's playlist, swapped by hand each month. In Spotify: playlist →
// Share → Copy link, then keep the id between `/playlist/` and the `?`.
export const SPOTIFY_PLAYLIST_ID = '45FIQq84FQviKLPXTyM0EL';

// Formspree handles the contact form — the site is static and has no server of
// its own. The endpoint is public by design; it only accepts mail addressed here.
export const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mvzqanno';
export const CALENDLY_URL = 'https://calendly.com/joela1031/new-meeting';

// Also serve as `sameAs` in the Person schema — the link between this domain and
// the profiles search engines already trust.
export const SOCIALS = [
	{ href: 'https://github.com/joel1031', label: 'github' },
	{ href: 'https://www.linkedin.com/in/jacosta4/', label: 'linkedin' },
];
