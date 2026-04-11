# Components Catalogue

Every component in `apps/web/src/components/`, grouped by domain. Path is implied — prepend `apps/web/src/components/`.

## `blog/` — post consumption

| File | Purpose |
|---|---|
| `PostCard.astro` | List card for a post (used on `/`, `/blog`, `/topics/[topic]`). Targets `.post-card` class — GSAP ScrollTrigger hooks into this selector on the homepage. |
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
| `ExperimentCard.astro` | List card for an experiment. Targets `.experiment-card` class (GSAP stagger). Has an opening `---` frontmatter fence — don't strip it (historical bug). **Missing a visual "proof" layer** (open backlog item — every new experiment should ship with at least one screenshot or `render_diffs` block). |

## `hero/` — homepage WebGL hero

| File | Purpose |
|---|---|
| `HeroCanvasNeural.astro` | Three.js neural-network particle field. Colours: `#09090b` base, `#3fb1ff` electric blue, `#f59e0b` amber accent. **Must be wrapped in `requestIdleCallback`** to protect FCP/TBT (incident 2026-04-01). WebGL pixel ratio capped at 1.5. Add/remove event listeners symmetrically (historical leak). |
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
| `ContactForm.astro` | Contact form wrapping Cloudflare Turnstile CAPTCHA (`PUBLIC_TURNSTILE_SITE_KEY`). |
| `LabGallery.astro` | Tech gallery. **Conditionally renders — only displays when content exists** (visibility fix 2026-03-24). Uses SVG technical schematics, not photos (decision 2026-03-24 "Engineering Lab aesthetic"). |
| `NewsletterEmbed.astro` | Beehiiv embed. Requires `PUBLIC_BEEHIIV_PUBLICATION_ID` — shows fallback message if missing (incident 2026-03-25). |
| `SearchWidget.astro` | Pagefind-powered search UI. Only works after `pnpm build` populates `dist/pagefind/`. |
| `Tag.astro` | Topic chip with count. Consumes `getTopicCounts()` output from `lib/utils/posts.ts`. |
| `ThemeToggle.astro` | Light/dark toggle — only active on reading pages (`/blog/[slug]`, `/experiments/[slug]`). Uses View Transitions API with clip-path reveal animation. Light theme binds to `document.body` (not `<article>`) to cover the sticky header. **Requires cleanup script on `astro:after-swap` to strip `.theme-light` from body when navigating back to non-reading pages.** |

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
