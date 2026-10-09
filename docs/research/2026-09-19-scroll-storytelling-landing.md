# Scroll-storytelling landing page: research note (2026-09-19)

## Summary (most decision-relevant)

1. GSAP is free for commercial sites, all plugins included (license dated 2025-04-30). Core + ScrollTrigger measured at ~46 KB gzipped (v3.15.0).
2. Native CSS scroll-driven animation cannot do "forward only" or "lock": the spec ties progress to scroll position, both directions. Firefox release still has it off by default. Some JS is unavoidable for this rule set.
3. GSAP staff's documented one-way pattern: a pinned trigger with `onUpdate` that only ever raises progress. Documented no-jump release: in `onLeave`, set scroll to the trigger start, then disable/kill.
4. Mercury (observed in their shipped code): a 250vh wrapper + CSS `position: sticky` (not JS pinning), a 6.4s H.264 video scrubbed via `currentTime`, keyframe every 3 frames, 2.4 / 3.2 / 4.8 MB (phone / tablet / desktop). On finish the wrapper collapses to 100vh and the next section calls `scrollIntoView({behavior:"instant"})`.
5. Mercury's headline is in the first screen from the start; it does not withhold it. NN/g: 57% of viewing time is above the fold; scrolljacking "avoid on mobile"; 6 of 8 test users missed that a full-screen hero could scroll.
6. "Once per visit, replay on refresh" maps onto Astro's documented behaviour: bundled scripts run once per full page load, so a plain in-memory flag survives client-side navigation and resets on refresh.
7. LCP stops being recorded at first scroll/tap, and opacity-0 elements do not count. A near-empty first screen means the business name (text) is the likely LCP element, which is cheap, if it is in the HTML and not faded in from opacity 0.
8. Calendly: `widget.js` is 4 KB gzipped, `widget.css` 0.9 KB (measured); the heavy part is the iframe, which only loads on open. Colour options need a paid plan (Standard, $10/seat/mo).
9. Safari only gained scroll anchoring (automatic jump prevention) in Safari 27, released 2026-09-14, so the no-jump hand-off must be done by hand for most iPhones.
10. Higgsfield terms (updated 2026-07-26): no ownership claim, no commercial restriction on any plan; outputs may not be unique; they may train on your content.

**Method note.** "verified" = I read it in the primary source (or measured the file / read the shipped code myself). Web pages were read through a fetch tool that summarises, so quoted wording may be lightly paraphrased; numbers and API names were cross-checked where possible. "unverified" = secondary source, inference, or not found.

---

## 1. Implementation approach for the scroll build

### GSAP licence and size
- Licence is the "Standard no-charge licence", effective 2025-04-30, last modified 2025-05-30. Commercial use is allowed at no charge, including formerly paid plugins (SplitText, MorphSVG, ScrollSmoother). **verified** ([licensing](https://gsap.com/licensing/), [standard licence](https://gsap.com/community/standard-license/))
- The one prohibited use: putting GSAP inside a no-code visual animation builder that competes with Webflow. Does not apply to an agency site. **verified** ([standard licence](https://gsap.com/community/standard-license/))
- npm `gsap@3.15.0` declares licence "Standard 'no charge' license". **verified** ([npm registry](https://registry.npmjs.org/gsap/latest))
- Size, measured from the CDN files with `gzip -9`: `gsap.min.js` 72.9 KB raw / 28.3 KB gzip; `ScrollTrigger.min.js` 44.6 KB raw / 18.0 KB gzip. Total about 46 KB gzip. **verified** (measured: [gsap.min.js](https://cdn.jsdelivr.net/npm/gsap@latest/dist/gsap.min.js), [ScrollTrigger.min.js](https://cdn.jsdelivr.net/npm/gsap@latest/dist/ScrollTrigger.min.js)). Brotli size not measured.

### How ScrollTrigger works
- **Pinning** (holding an element still while the page scrolls): the element is wrapped in a div; while active it is set to `position: fixed`. If the scroller is not the page body, it uses transforms instead. **verified** ([ScrollTrigger docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/))
- **pinSpacing**: by default padding is added below so later content "catches up perfectly" when the pin ends. This padding is the extra scroll distance that must be released at the end. **verified** (same)
- **scrub**: links animation progress to the scrollbar; a number adds catch-up smoothing in seconds. **verified** (same)
- **once: true**: the trigger kills itself the first time the end is reached. **verified** (same)
- **kill(revert, allowAnimation)**: unpins and restores DOM changes; `revert` defaults true; `allowAnimation` defaults false (animation is killed too unless true). **verified** ([kill()](https://gsap.com/docs/v3/Plugins/ScrollTrigger/kill()/))
- **anticipatePin**: applies the pin slightly early to hide the fast-scroll pin delay. **verified** ([docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/))
- Docs tip: animate children of the pinned element, not the pinned element itself; create triggers in page order or set `refreshPriority`. **verified** ([common mistakes](https://gsap.com/resources/st-mistakes/), [official gsap-skills](https://github.com/greensock/gsap-skills/blob/main/skills/gsap-scrolltrigger/SKILL.md))

### Mobile address bar
- `ScrollTrigger.config({ ignoreMobileResize: true })`: vertical resizes (about 25% of viewport height) on touch-only devices do not trigger a refresh. Added in 3.10.0. **verified** ([config()](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/)). Whether it is on by default in 3.15: **unverified**.
- `ScrollTrigger.normalizeScroll(true)`: moves scrolling onto the JavaScript thread so pinned content stays in sync, stops the address bar showing/hiding on most mobile devices, and works around iOS Safari misreporting scroll position. Docs call it experimental; mobile scrollbars may not auto-hide; it steps aside on multi-touch or zoom. **verified** ([normalizeScroll()](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.normalizeScroll()/))
- Auto-refresh happens on `visibilitychange, DOMContentLoaded, load, resize`. **verified** ([config()](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/))

### One-way playback and no-jump release (GSAP staff answers)
- One-way: GreenSock (forum Administrator) recommends a paused tween plus a pinned `ScrollTrigger.create` whose `onUpdate` only advances: **verified** ([forum 35206](https://gsap.com/community/forums/topic/35206-prevent-reverse-of-scrolltrigger-scrubtrue/))

  ```js
  onUpdate: self => {
    if (self.direction === 1 && self.progress > tween.progress()) tween.progress(self.progress);
  }
  ```
- Same idea from OSUblake: use a standalone trigger and control progress yourself rather than `scrub`. **verified** ([forum 29797](https://gsap.com/community/forums/topic/29797-how-to-prevent-scrolltrigger-from-scrubbing-animation-backwards/))
- Release without a jump: akapowl (forum Moderator) gives this, which moves the scroll position back by the pin distance at the moment the spacer disappears: **verified** ([forum 35042](https://gsap.com/community/forums/topic/35042-how-to-avoid-scroll-jump-when-killing-a-pinned-scrolltrigger/))

  ```js
  onLeave: self => { self.scroll(self.start); self.disable(); self.animation.progress(1); }
  ```
- Whether that reset is visually seamless on iOS Safari during momentum (flick) scrolling: **unverified**. Needs a real-device test.

### Native CSS scroll-driven animations
- Chrome/Edge 115 (2023-07-18). Safari and iOS Safari 26.0 (2025-09-15). Firefox: BCD lists "preview" only. **verified** ([MDN browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/css/properties/animation-timeline.json), [caniuse](https://caniuse.com/mdn-css_properties_animation-timeline), [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/))
- Firefox: on by default in Nightly only; off by default in Beta and Release (pref `layout.css.scroll-driven-animations.enabled`). Current Firefox release is 156 (2026-09-15). **verified** ([Firefox experimental features](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features))
- caniuse global support figure: 87.22%. **verified** ([caniuse](https://caniuse.com/mdn-css_properties_animation-timeline))
- They run off the main thread when animating compositor-friendly properties such as `transform`. **verified** ([Chrome docs](https://developer.chrome.com/docs/css-ui/scroll-driven-animations))
- Progress is defined as scroll offset divided by scrollable range. The spec has no way to make progress one-way or to latch at the end. It separates "scroll-driven" (position) from "scroll-triggered" (time). **verified** ([CSSWG scroll-animations-1, Editor's Draft 2026-05-14](https://drafts.csswg.org/scroll-animations-1/))
- So CSS alone cannot meet forward-only, lock, or once-per-visit. It could still draw individual stages while JS owns the rules. **unverified** (inference from the spec)

### Hand-written JS (scroll + rAF driving CSS variables)
- Browsers scroll on a separate thread, then fire scroll events on the main thread, so JS-positioned elements lag and jitter. Mozilla recommends `position: sticky` for pinning over JS positioning. **verified** ([Firefox scroll-linked effects](https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html))
- The `scroll` event cannot be cancelled, so `passive` is irrelevant for it. It matters for `wheel`/`touchstart`/`touchmove`; those default to passive on window/document/body in browsers other than Safari. **verified** ([MDN addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener))
- Mercury ships exactly this shape (sticky + scroll progress to values, no GSAP). See section 2. **verified** (observed)

### Viewport units and the iOS address bar
- `100vh` on mobile equals the large viewport (toolbars hidden), so it overflows on first load. `svh` = toolbars shown, `lvh` = hidden, `dvh` = follows live. **verified** ([web.dev viewport units](https://web.dev/blog/viewport-units))
- `dvh` values "do not update at 60fps"; browsers throttle them while the toolbar moves. **verified** (same)
- Support: Chrome 108+, Firefox 101+, Safari 15.4+. **verified** (same)
- A pinned full-screen stage sized in `svh` or `lvh` does not resize as the bar collapses; one sized in `dvh` does. **unverified** (inference)

### Releasing the scroll distance: scroll anchoring
- Scroll anchoring (browser auto-corrects scroll position when content above the viewport changes height; CSS `overflow-anchor`) shipped in Chrome 56, Firefox 66, Safari 27 (2026-09-14). **verified** ([BCD overflow-anchor](https://github.com/mdn/browser-compat-data/blob/main/css/properties/overflow-anchor.json), [BCD Safari releases](https://github.com/mdn/browser-compat-data/blob/main/browsers/safari.json))
- iPhones below iOS 27 get no automatic correction when the spacer collapses. **unverified** (inference). Both Mercury and the GSAP moderator correct scroll position by hand.

### Astro ClientRouter interaction
- Bundled module scripts (Astro's default) run once only, and are ignored on later navigations. **verified** ([Astro view transitions](https://docs.astro.build/en/guides/view-transitions/))
- Inline scripts may re-run; `data-astro-rerun` forces a re-run every navigation. **verified** (same)
- `astro:page-load` fires on the initial load and after every navigation, forward or back. `astro:before-swap` fires just before the DOM is replaced. `astro:after-swap` fires after history and scroll position are set. **verified** (same)
- ClientRouter disables all view-transition animation under `prefers-reduced-motion`. **verified** (same)
- Consequence: a module-level variable survives client-side navigation and resets on refresh, which matches "once per visit, refresh replays". `sessionStorage` would survive a refresh and so would not replay. **unverified** (inference from the docs; not tested in this repo)
- Pinned wrappers, spacers, listeners and any body-level elements are not cleaned up for you on a swap; GSAP guidance is to kill triggers when leaving a page. **verified** for the GSAP guidance ([gsap-skills](https://github.com/greensock/gsap-skills/blob/main/skills/gsap-scrolltrigger/SKILL.md)); how it combines with `astro:before-swap` is **unverified**.
- This repo's existing `brand-name` morph between hero and header while a hero is pinned with `position: fixed`: **unverified**, no source found.

### Recommendation inputs
- All three rules (forward-only, lock, once per visit) need JS state whichever route is taken.
- GSAP: free, ~46 KB gzip, first third-party client JS on the site; staff-documented patterns for both hard parts; pins with `position: fixed`.
- Hand-written: no dependency; Mercury is a production example; the no-jump release and iOS quirks are yours to solve and test.
- CSS sticky keeps the pin on the browser's scroll thread; JS pinning is where GSAP needed `normalizeScroll` for iOS.
- Firefox release users get no native scroll-driven animation (the site's current `.parallax` already has this gap).

---

## 2. How Mercury builds its opening

All **verified** by reading mercury.com's HTML and shipped JS on 2026-09-19, unless marked. The JS is minified, so behaviour descriptions are my reading of it.

### Observed
- The hero is a real `<video muted playsinline preload="auto">` with no `autoplay` and three sources by screen width: `/videos/hero/hero-scrub-lg.mp4` (min-width 64rem), `-md.mp4` (40rem), `-sm.mp4`. ([mercury.com](https://mercury.com/))
- File facts (ffprobe): all H.264 High, 30 fps, 6.4 s, 192 frames, **64 keyframes (one every 3 frames)**. sm 1080x720, 2.40 MB. md 1440x720, 3.21 MB. lg 1920x720, 4.79 MB. ([sm](https://mercury.com/videos/hero/hero-scrub-sm.mp4), [md](https://mercury.com/videos/hero/hero-scrub-md.mp4), [lg](https://mercury.com/videos/hero/hero-scrub-lg.mp4))
- A `hero_start_frame_*` still sits under the video as a normal `<img fetchPriority="high" loading="eager">` with a blurred placeholder and a separate portrait-phone crop. It is what paints first. WebP served: 38 KB at 828w, 60 KB at 1920w.
- `hero_end_frame_{sm,md,lg,xl}.jpg` are used by the next section (the "laptop screen" the video lands on): 24 KB (sm), 70 KB (lg).
- Layout: wrapper is `250vh` tall while idle and `100vh` afterwards; the inner stage is `h-screen` + `motion-safe:sticky top-0`. So pinning is CSS sticky, not JS.
- Scrubbing: scroll progress goes through a spring (stiffness 200, damping 30, mass 0.5), then `video.currentTime = progress * duration`, at most once per animation frame, skipped if the change is under 1/30 s.
- Scrubbing waits until the video reports enough data or at least 2 s buffered.
- iOS unlock: on the first `touchstart` it calls `play()`, then `pause()`, then `currentTime = 0`. If that throws, the opening is marked "skipped".
- Phases: `idle`, `hero-complete`, `transitioning`, `complete`, `skipped`. Completion fires when `scrollY >= 1.5 x innerHeight`. Loading the page already scrolled past that skips straight to the finished state.
- Hand-off: on completion the hero fades (150 ms opacity), the wrapper collapses to 100vh, and the next section calls `scrollIntoView({behavior: "instant", block: "start"})` so the viewport does not jump.
- Reduced motion: video is `motion-reduce:hidden`, sticky is `motion-safe` only, wrapper forced to one screen, phase set to skipped.
- Not forward-only: reaching `scrollY === 0` again calls a reset.
- The `<h1>` "Radically different banking", sub-copy and sign-up form are in the server HTML inside the first screen at `opacity: 1`. The headline is visible before any scrolling.
- No `<canvas>` in the HTML. No GSAP, ScrollTrigger, Lenis, Locomotive or three.js strings in the 40 JS chunks.

### Inferred
- The scroll/spring/transform hooks look like Motion (formerly Framer Motion) `useScroll`, `useSpring`, `useTransform`, `LazyMotion`. No literal library name appears in the bundle. **unverified**
- The keyframe-every-3-frames encode is deliberate, to make seeking cheap. **unverified** (intent). The encode itself is verified.

### General techniques
- **Video `currentTime` scrubbing.** Setting `currentTime` is the precise seek; `fastSeek()` trades precision for speed but is not Baseline: Chrome does not implement it. **verified** ([MDN fastSeek](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/fastSeek), [BCD](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLMediaElement.json))
- Seeking cost depends on keyframe spacing, because the decoder must rebuild from the nearest keyframe. **unverified** as a documented rule (no browser-vendor statement found). Mercury's encode is consistent with it.
- iOS: muted or audio-less video may play without a gesture; `playsinline` is required to stay inline on iPhone; autoplay video pauses when off-screen. **verified** ([WebKit video policies](https://webkit.org/blog/6784/new-video-policies-for-ios/))
- Chrome on Android/iOS does not buffer ahead with `preload` the way desktop does ("25 seconds on desktop but none on iOS or Android"). **verified** ([web.dev video](https://web.dev/articles/video-and-source-tags))
- iOS Low Power Mode blocking muted autoplay/scrub: **unverified** (the WebKit post does not mention it).
- **Image sequence on canvas** (Apple-style: preload N stills, `drawImage` the one matching scroll progress). The only description found is secondary: CSS-Tricks (2020) reports 148 JPG frames for AirPods Pro, and 55.8 MB / 1,609 requests for that whole Apple page, with a single fallback image on slow connections. **unverified** ([CSS-Tricks](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/))
- Apple today: static HTML of airpods-pro, macbook-pro and iphone-17-pro shows `<video>` tags (15, 13, 0) and zero `<canvas>`. Canvases may be created by JS; not checked. **unverified** for current Apple technique.

### Recommendation inputs
- Mercury's opening is a pre-rendered film. The planned "page builds itself" story is live DOM (sketch, then real UI, then moving parts), so Mercury's video cost (2.4 to 4.8 MB, iOS unlock, seek latency) only applies if stages are pre-rendered as video.
- Mercury's structure transfers either way: tall wrapper + sticky stage, progress to values, finish threshold, collapse + instant scroll correction, skip if loaded mid-page, reduced-motion skip.
- Mercury differs from the chosen rules in two places: headline visible from the start; replays at scroll top.
- Mercury ships a separate portrait-phone crop and a smaller phone file, not one asset for all screens.

---

## 3. Scroll storytelling and conversion

### Scrolljacking (NN/g, Sara Paul, 2023-08-06)
- Defined as a pattern that "changes the speed and, sometimes, the direction of scrolling". Users felt loss of control and disorientation; some thought the site was broken; worse on mobile. **verified** ([NN/g Scrolljacking 101](https://www.nngroup.com/articles/scrolljacking-101/))
- Better tolerated when it reveals useful context, keeps a sensible scroll rate, sits below the fold, has minimal text, and navigation stays visible as an escape. NN/g says avoid it on mobile; task-focused users have little patience. **verified** (same)
- The planned build pins the stage and ignores upward scroll. That fits NN/g's definition in part; the opening is above the fold and on mobile, both on NN/g's less-tolerated list. No study of "forward-only" specifically was found. **unverified**

### Headline/CTA visibility
- 57% of viewing time is above the fold; 74% in the first two screenfuls (down from 80% above the fold in 2010). Advice: keep top priority content and the main call to action high. **verified** ([NN/g Scrolling and Attention, 2018](https://www.nngroup.com/articles/scrolling-and-attention/))
- "What is visible on the page without requiring any action is what encourages us to scroll"; average 84% difference in how users treat content above vs below the fold. **verified** ([NN/g Fold Manifesto, 2015](https://www.nngroup.com/articles/page-fold-manifesto/))
- Baymard has nothing direct on scroll-built heroes. Nearest: most users leave or scroll on before a carousel rotates, the first slide gets "vastly more exposure", and moving promos get dismissed as ads. **verified** but tangential ([Baymard](https://baymard.com/blog/homepage-carousel))
- **Honest read on withholding the headline:** the evidence runs against it. The first screen decides whether people continue, and a business name alone does not say what is offered or why to scroll. No primary study measures "name only, headline after scroll", so the size of the effect is **unverified**.
- Mitigations the sources support: nav "book a call" visible throughout (NN/g: visible navigation as escape); a clear scroll cue; a short scroll distance (Mercury finishes at 1.5 screens); skip when the visitor arrives mid-page or prefers reduced motion; headline present in the HTML from the start for search engines and screen readers even if visually late. The last point is an **unverified** inference.

### Scroll cues
- "Illusion of completeness": in NN/g testing, 6 of 8 users did not realise a full-screen hero video page could scroll. Advice: let content peek above the fold, add explicit cues, avoid barriers that look like an ending, test on several screen sizes. **verified** ([NN/g, 2016](https://www.nngroup.com/articles/illusion-of-completeness/))
- A name-only first screen is a full-screen hero with nothing peeking: the case NN/g flagged.

### Reduced motion (WCAG)
- SC 2.3.3 Animation from Interactions (Level AAA): motion triggered by interaction can be disabled unless essential. Parallax is named as non-essential; ordinary scrolling movement is exempt. `prefers-reduced-motion` is a sufficient technique. **verified** ([W3C Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html))
- SC 2.2.2 Pause, Stop, Hide (Level A): anything that starts automatically, lasts over 5 seconds and runs alongside other content needs a way to pause, stop or hide it. "Starts automatically" includes motion started by scrolling. **verified** ([W3C Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html))
- Applies to: the "running on their own" pieces if they keep looping in the locked hero, and to a looping dithered backdrop. Both exceed 5 s alongside content, so Level A asks for a pause control, not only a reduced-motion fallback. **unverified** (my application of the criterion).
- `prefers-reduced-motion` is Baseline widely available since January 2020. **verified** ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion))

### Core Web Vitals
- LCP (time until the largest visible content paints): good is 2.5 s or less at the 75th percentile. Candidates: images, video poster/first frame, CSS background images, text blocks. **verified** ([web.dev LCP](https://web.dev/articles/lcp))
- Not counted: opacity-0 elements, elements covering the full viewport (treated as background), low-information placeholder images. **verified** (same)
- The browser stops reporting LCP once the user scrolls, taps or presses a key. Anything revealed by scrolling cannot become the LCP. **verified** (same)
- So on a name-only first screen the name's text block is the likely LCP element. Risks: web-font block period (text is not "rendered" until the font shows) and starting the name at opacity 0. **verified** for the rules; "likely LCP" is **unverified** until measured.
- LCP content should be in the HTML, not added by JS; never lazy-load it; `fetchpriority="high"` for an LCP image. **verified** ([web.dev optimize LCP](https://web.dev/articles/optimize-lcp))
- CLS (unexpected movement): good is 0.1 or less. Only elements visible in the viewport count. Scrolling does not count as "recent input", so shifts during scroll are counted. `transform` animations cause no shift. **verified** ([web.dev CLS](https://web.dev/articles/cls))
- So collapsing the pin spacer counts toward CLS if visible content moves, and does not if scroll position is corrected in the same frame. **unverified** (inference)
- INP (response to taps/clicks/keys): good is 200 ms or less. Scrolling is not measured, but main-thread animation work delays the next frame after a tap, e.g. tapping "book a call" mid-build. **verified** ([web.dev INP](https://web.dev/articles/inp))

### Recommendation inputs
- Evidence against a headline-less first screen is consistent across NN/g sources; no source quantifies this exact pattern.
- The inspiration site keeps headline and sign-up visible from the start.
- A scroll cue is evidence-backed, not decoration, for a full-screen name-only opening.
- WCAG Level A (pause control) may apply to anything that loops over 5 s in the final hero.
- LCP is decided by the load-in screen only; keep the name as real text in the HTML and avoid opacity-0 starts.
- Animate with `transform`/`opacity` for CLS and smoothness.

---

## 4. Calendly popup widget

### Required files and the call
- Calendly's own embed code loads: **verified** ([How to customize your embed](https://calendly.com/help/how-to-customize-your-embed))

  ```html
  <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
  <script src="https://assets.calendly.com/assets/external/widget.js" type="text/javascript" async></script>
  ```
- Opening the popup from your own button: `Calendly.initPopupWidget({url: myLink});` **verified** ([developer.calendly.com](https://developer.calendly.com/how-to-display-the-scheduling-page-for-users-of-your-app))
- The shipped script exports `initPopupWidget`, `showPopupWidget`, `closePopupWidget`, `initInlineWidget`, `initBadgeWidget`, `destroyBadgeWidget`. The popup path also reads `prefill` and `utm` options. **verified** (read [widget.js](https://assets.calendly.com/assets/external/widget.js))
- `text`, `color`, `textColor`, `branding` are options for the floating badge button, not for the popup. **verified** ([developer.calendly.com](https://developer.calendly.com/how-to-display-the-scheduling-page-for-users-of-your-app))

### Appearance options (added to the Calendly link as URL parameters)
- `hide_event_type_details=1` (event type links); `hide_landing_page_details=1` (landing/team pages); `hide_gdpr_banner=1` (hides the cookie banner; Calendly says you then handle GDPR/CCPA yourself). **verified** ([customize your embed](https://calendly.com/help/how-to-customize-your-embed))
- `background_color`, `text_color`, `primary_color` (buttons and links), `button_text` (popup only): "If you're on a paid plan". **verified** (same)
- Colour values are hex without the `#`. **unverified** (search snippet of a Calendly help page; not opened)
- Pricing page lists "Customize colors when you add Calendly to your website" and "Remove Calendly branding" under Standard ($10/seat/mo) and Teams ($16/seat/mo), not Free. **verified** ([pricing](https://calendly.com/pricing)). The fetched table showed a dash for Enterprise too, probably a parsing artefact: **unverified**. Monthly vs annual billing for the $10 figure: **unverified**.
- Fonts and layout inside the popup cannot be styled from outside (it is an iframe on calendly.com). **unverified**: the community question has no staff answer ([thread](https://community.calendly.com/api-webhook-help-61/customize-calendly-layout-colors-and-fonts-on-website-2433)).
- A true dark theme depends on those colour parameters, so on the paid plan. **unverified** (inference)

### Performance and lazy loading
- Measured: `widget.js` 11.9 KB raw / 4.0 KB gzip; `widget.css` 2.5 KB raw / 0.9 KB gzip; both `cache-control: public, max-age=300` (5-minute cache). **verified** (measured)
- The script does nothing heavy on load. Opening builds a `.calendly-overlay` on `document.body` with an iframe to calendly.com; the real cost arrives then. **verified** (read widget.js). Iframe weight not measured: **unverified**.
- `initPopupWidget` waits for DOM ready and then runs at once if the page is already loaded, so injecting the script on first click and calling it on script load is compatible with the code. **verified** from code; Calendly does not document lazy loading: **unverified** as supported practice.
- Booking events arrive via `window.postMessage`: `calendly.profile_page_viewed`, `calendly.event_type_viewed`, `calendly.date_and_time_selected`, `calendly.event_scheduled`. **verified** ([Advanced embed for developers](https://calendly.com/help/advanced-calendly-embed-for-developers))

### SPA-style navigation (Astro ClientRouter)
- Calendly documents nothing about single-page apps. **unverified**
- From the code: `window.Calendly` is set once and stays, since ClientRouter never reloads the page. Opening the popup sets `body { overflow: hidden }` and adds iOS touch locks, undone only by its own `close()`. **verified** (read widget.js)
- If a navigation swaps the body while the popup is open, the overlay is removed but the scroll lock may remain unless `Calendly.closePopupWidget()` runs first. **unverified** (inference; needs a test)
- A scripted stylesheet/script tag in `<head>` across swaps: Astro docs say bundled scripts run once; how ClientRouter treats an injected third-party tag: **unverified**.
- Popup scroll-lock while the home hero is pinned: **unverified**, test needed.

### Recommendation inputs
- About 5 KB gzip total; would be the site's first third-party JS and a new third-party origin.
- Dark styling needs the Standard plan; Free shows default colours and Calendly branding.
- Popup colours and cookie banner are per-link URL parameters, set once in a shared link constant.
- Click-to-load is compatible with the script; the first open is slower by one small download.

---

## 5. Dithered video/canvas backdrop

Dithering = showing an image with very few colours by arranging dots so the eye blends them.

### How it is done
- 2D canvas route: draw the video frame small with `drawImage`, read pixels with `getImageData`, change them in a loop, write back with `putImageData`. MDN's example halves the video size for speed. **verified** ([MDN manipulating video](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Manipulating_video_using_canvas))
- `getContext("2d", { willReadFrequently: true })` forces a software canvas and helps repeated `getImageData`. **verified** ([MDN getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext))
- Video from another origin without CORS taints the canvas and `getImageData` throws. Self-hosting avoids this. **verified** ([MDN getImageData](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData))
- WebGL route: pass the `<video>` to `texImage2D` each frame and dither in a shader (a small GPU program). MDN's example waits for `playing` and `timeupdate`, and sets `muted`, `loop`, `playsInline`. **verified** ([MDN animating textures](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_textures_in_WebGL))
- Ordered (Bayer) dithering compares each pixel to a small repeating threshold grid. Each pixel is independent, so it suits a shader and the pattern stays still between frames. Floyd-Steinberg pushes each pixel's error onto its neighbours, so it is sequential (CPU only) and the dots crawl from frame to frame. **unverified** (secondary: [ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering), [Floyd-Steinberg](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering))
- What the tutorial itself does (algorithm, canvas vs WebGL, pointer effect): **unverified**. YouTube page content could not be read; only secondary write-ups exist ([video](https://www.youtube.com/watch?v=KDkR0cJRiJk), [MindStudio summary](https://www.mindstudio.ai/blog/ai-dithering-effect-website-tutorial)).

### Cost and frame rate
- `requestVideoFrameCallback` fires once per new video frame (a 25 fps video gives 25 Hz, not 60 Hz). Chrome 83, Safari 15.4, Firefox 132; Baseline since October 2024. **verified** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), [BCD](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLVideoElement.json))
- A clip encoded at about 11 fps therefore throttles processing by itself. **unverified** (inference)
- Arithmetic, not a benchmark: a coarse 320x180 grid is 57,600 pixels; at 11 fps about 634,000 pixel operations per second, small for a phone CPU. Real phone cost (video decode, canvas upscale, battery, heat): **unverified**, no primary benchmark found.
- CSS `image-rendering: pixelated` to scale a small canvas up crisply: not checked, **unverified**.
- A backdrop that works the main thread while the scroll build runs competes with it for frames, and adds to INP (section 3). **unverified** (inference)

### Clip format and iOS rules
- Silent looping video needs `autoplay loop muted playsinline`. **verified** ([web.dev](https://web.dev/articles/replace-gifs-with-videos), [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay))
- iOS: muted/audio-less autoplay is allowed, `playsinline` is required on iPhone, playback pauses off-screen. **verified** ([WebKit](https://webkit.org/blog/6784/new-video-policies-for-ios/))
- `play()` returns a promise that rejects with `NotAllowedError` when blocked; that is the hook for a still-image fallback. **verified** ([MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay))
- Codecs: H.264 MP4 plays everywhere (Mercury ships only that). web.dev suggests WebM first, MP4 second. AV1: Chrome 70+, Firefox 67+, Safari 17+ partial (hardware decoder needed). HEVC: Safari 11+/13+ full, Chrome 107+ partial, Firefox 137+ partial. **verified** ([web.dev](https://web.dev/articles/replace-gifs-with-videos), [caniuse AV1](https://caniuse.com/av1), [caniuse HEVC](https://caniuse.com/hevc))
- Size of a 4 s clip: no primary figure. Reference points: Mercury's 6.4 s 1080x720 H.264 at 3 Mbps is 2.4 MB (keyframe-heavy, so larger than a normal encode); web.dev's GIF example became 551 KB MP4 / 341 KB WebM. A small low-frame-rate source clip landing in the low hundreds of KB is **unverified** until encoded.
- Dithering before encoding (baking it into the file) removes the JS cost but also the pointer interaction; how well codecs compress dot patterns: **unverified**.

### Pointer interaction and reduced motion
- Touch devices have no hover. No primary guidance found for a touch fallback for a pointer-reactive backdrop. **unverified**
- WCAG 2.2.2 (Level A): a looping backdrop over 5 s beside content needs pause/stop/hide. 2.3.3 (AAA): pointer-triggered motion should be disableable. **verified** (W3C links in section 3)
- Mercury's pattern under reduced motion: hide the video, show a still. **verified** (observed)

### Higgsfield output licensing
- Terms of Use, last updated 2026-07-26: "Company does not claim ownership of any of your Inputs or Outputs, nor does it restrict your commercial use of Outputs." **verified** ([Terms](https://higgsfield.ai/terms-of-use-agreement))
- Rights in exported outputs survive cancellation, and "you may transfer or sublicense your rights in Outputs to your clients or other third parties." **verified** (same)
- Commercial rights are not tied to a plan; no separate commercial licence; no attribution required. **verified** ([Higgsfield help centre](https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially))
- Caveats: outputs "may not be unique across users"; no warranty of originality or legality; you are responsible for third-party IP and likeness; third-party model providers' usage policies also apply; your content, inputs and outputs may be used for training unless on Enterprise (deleting content stops it going forward). **verified** (both links)
- Whether AI output can be copyrighted at all is a legal question the terms do not answer. **unverified**

### Recommendation inputs
- Ordered/Bayer suits moving images and GPUs; Floyd-Steinberg is CPU-only and crawls.
- Coarse grid + low frame rate makes the pixel work small on paper; phone battery/heat is unmeasured.
- It would run at the same time as the scroll build on the same first screen.
- Needs a pause control for WCAG Level A if it loops beside content, plus a still under reduced motion and when autoplay is refused.
- Higgsfield places no commercial restriction on any plan; uniqueness is not guaranteed; content may be used for training.

---

## Could not verify (consolidated)
- Whether `ignoreMobileResize` is on by default in GSAP 3.15.
- Whether GSAP's `onLeave` scroll reset is seamless on iOS Safari mid-flick.
- That Mercury uses Motion/Framer Motion (inferred from code shape only).
- A vendor-documented rule linking keyframe spacing to seek smoothness; iOS Low Power Mode effects on video.
- Apple's current scroll technique; image-sequence weights (CSS-Tricks 2020 is secondary).
- Any study of "headline withheld until after a scroll build", or of forward-only scroll.
- My application of WCAG 2.2.2 to the looping hero pieces.
- Calendly: hex-without-# format, Enterprise row, billing period of $10, lazy-loading as supported practice, SPA behaviour, iframe weight, styling limits inside the iframe.
- ClientRouter + pinned hero + `brand-name` morph; ClientRouter handling of injected third-party tags.
- The tutorial's actual implementation (video not readable).
- Real phone CPU/GPU/battery cost of live dithering; 4 s clip size; touch fallback guidance.
- Copyrightability of AI output.
