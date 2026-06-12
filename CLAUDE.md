# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Overview

Personal static site for Joel Acosta — a minimal, Tetragrammaton-style interface: a
near-empty canvas, lowercase letter-spaced type (Geist), and three words as the whole
navigation. Built with **Astro 6** (`@astrojs/mdx`, `@astrojs/sitemap`, `sharp`).

The three surfaces are **read** (writing), **look** (photos), **lab** (projects), sitting
over a persistent header; the home page (`/`) is a full-screen hero. Default theme is dark,
with a light/dark toggle.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/` (type-checks via `astro check` semantics)
- `npm run preview` — serve the built site

No test suite, linter, or formatter is configured. Node >= 22.12.

## Config

- `astro.config.mjs` — site URL (`https://joelacosta.ai`) and the self-hosted Google **Geist**
  font (`--font-geist`, weights 400/500).
- `src/consts.ts` — `SITE_TITLE` ("Joel Acosta") and `SITE_DESCRIPTION`.

## Routes & pages

Every page is wrapped by `src/layouts/Layout.astro`, which renders `<BaseHead>`,
`<ClientRouter>`, the pre-paint theme script, and an optional `<Nav>` (`nav` prop, default true).

- **`/`** — `src/pages/index.astro`. Full-screen hero: a crossfading slideshow of the gallery
  images over a dark overlay, with the name + three words centered on top. Rendered with
  `nav={false}` (the hero *is* the nav). Text is forced light here regardless of theme.
- **`/read`** — `src/pages/read.astro`. Post list: title + date grouped on the left, a small
  hero thumbnail on the right. Posts render at `/read/[...slug]` via `PostLayout`.
- **`/look`** — `src/pages/look.astro`. CSS-columns masonry gallery (3/2/1 columns), each tile
  click-to-expand via the lightbox.
- **`/lab`** — `src/pages/lab.astro`. Project cards grid (3/2/1) with thumbnails. Detail pages
  at `/lab/[...slug]` via `PostLayout`.

There is no About page; the name in the header links to `/` (home).

## Content collections

`src/content.config.ts` defines two collections via the glob loader; slugs come from `post.id`,
and both `[...slug].astro` pages use `getStaticPaths()` + `render()`. Frontmatter is zod-validated.

- **`blog`** → `src/content/blog/` — `heroImage` is **optional** (`image()`).
- **`projects`** → `src/content/projects/` — `thumbnail` is **required** (`image()`).

The current posts/projects are placeholder/demo content using `src/assets/blog-placeholder-*.jpg`.

## Layouts & components

- `src/layouts/Layout.astro` — the shell (head, ClientRouter, theme bootstrap, slot).
- `src/layouts/PostLayout.astro` — built on `Layout`; used by both read posts and lab projects.
  Centered prose column, hero wrapped in `.parallax`, in-content images wrapped client-side
  and made zoomable, includes `<Lightbox>`.
- `src/components/Nav.astro` — persistent header: name (→ `/`) + the three word-links with an
  active state from `Astro.url.pathname`, plus the theme toggle dot.
- `src/components/Lightbox.astro` — reusable image expander (see below).
- `src/components/BaseHead.astro`, `FormattedDate.astro` — head metadata and date formatting.

## Design system — `src/styles/global.css`

This file is the heart of the site; read it before any visual change.

- **Theming:** `[data-theme]` (default dark) drives CSS custom props: `--bg`, `--fg`, `--muted`,
  `--faint`, `--line`, plus `--header-line` (per-theme header underline). The toggle persists to
  `localStorage`. Light mode uses deliberately darkened grays for legibility — don't lighten them
  back toward the original faint values.
- **Layout token:** `--content-width` (shared by read / look / lab containers).
- **Motion vocabulary:** use these vars, never ad-hoc timings.
  - `--anim-dur` (0.4s) + `--anim-ease` — hover and the lightbox (snappy).
  - `--morph-dur` (0.85s) — page navigation: the root fade+zoom and the brand morph (unhurried).
- **`.parallax`:** reusable CSS-native parallax via scroll-driven animations (`view-timeline`).
  A fixed-aspect, `overflow:hidden` box clips an over-scaled image that translates on scroll.
  Set `--parallax-offset` (travel %) and an `aspect-ratio` on the container. Gallery tiles use
  the symmetric `parallax-scroll`; **post hero + `.prose` images drift upward only** (`parallax-up`).
- **`.word`:** lowercase, letter-spaced text treatment used across the UI.

## View transitions

`ClientRouter` (in `Layout`) animates navigations. Rules live in `global.css`:

- Root content does a fade + subtle zoom (`page-in`/`page-out`) at `--morph-dur`.
- The header is pinned (`view-transition-name: site-header`, `animation: none`) so it **stays
  still** during navigation.
- The name and tabs carry `brand-name` / `brand-tabs` names on both the home hero and the
  header, so they **morph** (move + resize) between centered-hero and top-header — and inverse
  going home. Timed to `--morph-dur`.
- All view-transition motion is disabled under `prefers-reduced-motion`.

## Client-script pattern (important)

`ClientRouter` swaps the DOM on navigation and **resets `<html>` attributes**, and page scripts
do **not** re-run on swaps. So:

- **Theme** is applied pre-paint by the inline script in `Layout.astro` **and re-applied on
  `astro:after-swap`** (otherwise it reverts to default after a navigation).
- Interactive behavior is **event-delegated on `document`** and/or **re-initialized on
  `astro:page-load`**. Existing examples to follow:
  - Theme toggle — `Nav.astro` (delegated click).
  - Lightbox — `Lightbox.astro` (delegated; re-enhances images on `page-load`).
  - Hero slideshow — `index.astro` (re-inits on `page-load`; clears its interval first).
  - Wrapping `.prose` images in `.parallax` — `PostLayout.astro` (re-wraps on `page-load`).
- Everything above also respects `prefers-reduced-motion`.

## Lightbox

`Lightbox.astro` renders one overlay. Triggers: any element with `data-zoom-src="<url>"`.
It also auto-enhances `.prose img` and the post `.hero img` (sets `data-zoom-src` + pointer
cursor) on each `page-load`. Closes on backdrop / × / Escape. Has open + exit keyframes (uses
distinct in/out animation names so they reliably restart) with a `setTimeout` safety net so the
overlay can never get stuck. `/look` tiles pass a large `getImage` variant as `data-zoom-src`.

## Images & gallery

Gallery lives in `src/assets/gallery/` and is loaded with `import.meta.glob` (eager) in both
`look.astro` and `index.astro`, then processed via `astro:assets` (`getImage`/`Image`).

- The glob pattern **includes uppercase extensions** (`JPG`, `JPEG`, …) — phone photos are
  uppercase; lowercase-only globs silently drop them.
- The home hero plays the gallery in a **fixed order** defined by the `order` array in
  `index.astro` (match by filename without extension), not shuffled. New images fall to the end.

## Conventions

- Match the existing minimal aesthetic: lowercase `.word` treatment, the shared tokens, small
  diffs. Reach for `--content-width`, the motion vars, and `.parallax` rather than new one-offs.
- Tabs are commit/indent style throughout `.astro`/`.css`.
- After changes, run `npm run build` to confirm a clean build (no test suite to rely on).
