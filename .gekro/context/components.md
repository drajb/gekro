# Components Catalogue

Every component in `apps/web/src/components/`, grouped by domain. Path is implied — prepend `apps/web/src/components/`.

## `blog/` — post consumption

| File | Purpose |
|---|---|
| `PostCard.astro` | List card for a post (used on `/`, `/blog`, `/topics/[topic]`). Targets `.post-card` class — GSAP ScrollTrigger hooks into this selector on the homepage. **3D tilt added 2026-04-15:** `mousemove` computes ±8° rotateX/Y, includes translateY(-4px) in the same transform string. `hover:translate-y-[-4px]` Tailwind class was removed to avoid conflict — translateY is now JS-only. `will-change: transform` on `.post-card` for GPU compositing. |
| `PostHeader.astro` | Title + meta + hero image block at the top of a post. |
| `PostTOC.astro` | Auto-generated table of contents from H2/H3 in the post body. |
| `TLDR.astro` | Top-of-post summary block. **Mandatory before the first H2** on every Deep Dive (governance rule). Falls back to `description` if `tldr` frontmatter is missing. |
| `CodeBlock.astro` | Shiki-rendered code block wrapper with copy button. |
| `GifPlayer.astro` | Lazy-loaded GIF with play/pause. |
| `GiscusComments.astro` | GitHub Discussions comments embed. Deferred. |
| `PortableText.astro` | Sanity portable text renderer. |
| `ReadingProgress.astro` | Scroll progress bar. **GSAP ScrollTrigger logic must be wrapped in an `initProgress` function bound to `astro:after-swap`** — inline-once scripts break after View Transitions (incident 2026-03-31). |
| `RelatedPosts.astro` | "Related posts" listing at the end of a post (topic-based). |

## `experiments/`

| File | Purpose |
|---|---|
| `ExperimentCard.astro` | List card for an experiment. Targets `.experiment-card` class (GSAP stagger). Has an opening `---` frontmatter fence — don't strip it (historical bug). **Now has full JS block (added 2026-04-15):** Motion One `inView()` entrance animation, `mousemove` glow-layer + 3D tilt (±8°, `will-change: transform`), `mouseleave` reset. `_animated` and `_tiltInitialized` guards prevent double-init on View Transitions. **Missing a visual "proof" layer** (open backlog item — every new experiment should ship with at least one screenshot or `render_diffs` block). |

## `hero/` — homepage WebGL hero

| File | Purpose |
|---|---|
| `HeroCanvasNeural.astro` | Three.js neural-network particle field. Colours: `#09090b` base, `#3fb1ff` electric blue, `#f59e0b` amber accent. **Must be wrapped in `requestIdleCallback`** to protect FCP/TBT (incident 2026-04-01). WebGL pixel ratio capped at 1.5. Add/remove event listeners symmetrically (historical leak). **Cursor repulsion added 2026-04-15:** mouse NDC → world-space via `Vector3.unproject()`, inverse-square force (radius 8 units, strength 0.15). `isMouseActive` flag ensures desktop-only (touch never sets it). |
| `HeroText.astro` | Animated headline text. GSAP fade-in is intentionally preserved **even though Lighthouse penalises its Element Render Delay** — decision 2026-04-01 (override count 1, "premium wow factor over literal 100/100 LCP"). |

## `layout/`

| File | Purpose |
|---|---|
| `Header.astro` | Global sticky header. Uses `text-text-primary` (CSS-variable-backed) — **never hardcode `text-white`** (illegibility in light reader mode, incident 2026-03-31). |
| `Footer.astro` | Footer with real-time "System Sync" heartbeat clock. Must use `setInterval` inside an `astro:after-swap` listener, not a single inline script (stale-clock incident 2026-03-24). |

## `seo/`

| File | Purpose |
|---|---|
| `SEOHead.astro` | Required on every page. title, description, ogImage, canonical. |
| `JsonLD.astro` | Structured data injection. Required on every post + experiment. |

## `ui/`

| File | Purpose |
|---|---|
| `BrandLogo.astro` | Site wordmark — lowercase `gekro`. |
| `ContactForm.astro` | Contact form wrapping Cloudflare Turnstile CAPTCHA (`PUBLIC_TURNSTILE_SITE_KEY`). Errors shown via inline `<p id="form-error">` — **never `alert()`** (fixed 2026-04-15). |
| `CursorFollower.astro` | *(Added 2026-04-15)* Global custom cursor: 12px accent dot with 0.15 lerp, morphs to 40px ring when hovering links/buttons/cards. Only mounts on `(pointer: fine)` + `min-width: 768px`. Cleanup on `astro:before-swap`, re-init on `astro:after-swap`. Mounted in `BaseLayout` outside `#swup`. |
| `LabGallery.astro` | Tech gallery. **Conditionally renders — only displays when content exists** (visibility fix 2026-03-24). Uses SVG technical schematics, not photos (decision 2026-03-24 "Engineering Lab aesthetic"). |
| `NewsletterEmbed.astro` | Dark-styled native form POSTing to Beehiiv subscribe endpoint via `fetch(mode: 'no-cors')`. **Not an iframe** — Beehiiv's cross-origin iframe forced white background (decision 2026-04-15). `data-wired` guard prevents listener stacking. Requires `PUBLIC_BEEHIIV_PUBLICATION_ID`; shows dev-only hint when missing. |
| `SearchModal.astro` | *(Added 2026-04-15)* Cmd+K / Ctrl+K full-screen Pagefind overlay. `is:inline` IIFE uses `window.__gekroSearchModal` to persist state. Lazy-loads Pagefind on first open via fetch probe. Keydown listeners stored on `window.__gekroSearchKeydown` and replaced (not stacked) on each `initSearchModal()` call. Mounted in `BaseLayout` outside `#swup`. |
| `SearchWidget.astro` | Pagefind-powered search UI. Only works after `pnpm build` populates `dist/pagefind/`. |
| `Tag.astro` | Topic chip with count. Consumes `getTopicCounts()` output from `lib/utils/posts.ts`. |
| `ThemeToggle.astro` | Light/dark toggle — only active on reading pages (`/blog/[slug]`, `/experiments/[slug]`). Uses View Transitions API with clip-path reveal animation. Light theme binds to `document.body` (not `<article>`) to cover the sticky header. **Requires cleanup script on `astro:after-swap` to strip `.theme-light` from body when navigating back to non-reading pages.** One-time pulse hint on first session visit (sessionStorage-gated, reduced-motion respecting). |

## Root `components/`

| File | Purpose |
|---|---|
| `LabTerminal.astro` | Global retro terminal overlay, mounted in `BaseLayout`. Always present. |

## Shared rules for all components

- **All `.astro` files only.** Use a `.tsx` island only when interactivity genuinely requires a framework.
- **Images:** always `<Image />` from `astro:assets`, never raw `<img>`. Always set `width`/`height`.
- **Styles:** Tailwind utility classes; dynamic values via CSS variable references, never inline hex.
- **GSAP:** wrap in `if (typeof window !== 'undefined')` to prevent SSR errors. Always provide a `prefers-reduced-motion` fallback. Initialize via an `initX()` function bound to `astro:after-swap` so View Transitions don't break it.
- **Three.js:** dynamic import, wrap `init()` in `requestIdleCallback`, cap pixel ratio, clean up event listeners.
- **Accessibility:** interactive elements keyboard-navigable, alt text on images, ARIA labels on icon-only buttons, WCAG AA contrast minimum.
