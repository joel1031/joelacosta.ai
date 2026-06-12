# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/` (also type-checks via `astro check` semantics)
- `npm run preview` — serve the built site

No test suite, linter, or formatter is configured. Node >= 22.12.

## Architecture

Personal static site built with Astro 6 (`@astrojs/mdx`, `@astrojs/sitemap`, `sharp`). Site URL and Google "Geist" font are set in `astro.config.mjs`. Global metadata in `src/consts.ts`.

### Three sections, one shell
The site is a minimal play/look/read interface with three content surfaces, all wrapped by `src/layouts/Layout.astro` (which renders `<BaseHead>`, `ClientRouter`, theme bootstrap, and optional `<Nav>`):

- **`/read`** — blog list (`src/pages/read.astro`), posts at `/read/[...slug]` rendered through `src/layouts/PostLayout.astro`.
- **`/look`** — photo gallery (`src/pages/look.astro`), CSS-columns masonry.
- **`/lab`** — projects grid (`src/pages/lab.astro`), posts at `/lab/[...slug]`.
- **`/`** — full-bleed slideshow hero (`src/pages/index.astro`), rendered with `nav={false}`.

### Content collections
`src/content.config.ts` defines `blog` (→ `src/content/blog/`) and `projects` (→ `src/content/projects/`) via the glob loader. Slugs come from `post.id`; both `[...slug].astro` pages call `getStaticPaths()` + `render()`. Frontmatter is zod-validated — `blog` uses `heroImage`, `projects` requires `thumbnail`, both via `image()`.

### Design system — `src/styles/global.css`
This is the heart of the site; read it before any visual change.
- **Theming:** `[data-theme]` (default dark) drives CSS custom props (`--bg`, `--fg`, `--muted`, `--faint`, `--line`). Toggle persists to `localStorage` and is applied before paint in `Layout.astro`'s inline script.
- **Motion vocabulary:** `--anim-dur`, `--anim-ease`, `--morph-dur` are reused everywhere (hover, lightbox, page transitions). Use these vars rather than ad-hoc timings.
- **`.parallax`:** reusable CSS-native parallax via scroll-driven animations (`view-timeline`). Set `--parallax-offset` and an `aspect-ratio` on the container. Post/hero images drift upward only.
- **`.word`:** lowercase, letter-spaced text treatment used across the UI.
- **View transitions:** `::view-transition` rules fade+zoom the page; the header stays fixed; `brand-name`/`brand-tabs` morph between the home hero and `Nav`.

### View-transition-safe client scripts (important pattern)
Astro's `ClientRouter` swaps the DOM on navigation, so all interactive behavior is **event-delegated on `document`** and **re-initialized on `astro:page-load` / `astro:after-swap`**. Follow this pattern for any new client behavior:
- Theme toggle — `src/components/Nav.astro`
- Lightbox (any element with `data-zoom-src`; `.prose`/`.hero` images auto-enhanced) — `src/components/Lightbox.astro`
- Hero slideshow — `src/pages/index.astro`
- Wrapping in-content `.prose` images in `.parallax` — `src/layouts/PostLayout.astro`

All of the above also respect `prefers-reduced-motion`.

### Images
Gallery images are pulled with `import.meta.glob` from `src/assets/gallery/*` and processed through `astro:assets` (`getImage`/`Image`). The home hero keeps an explicit `order` array in `index.astro` for the first slides.
