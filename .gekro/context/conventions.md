# Conventions — Distilled Rule Set

Source of truth: `.cursorrules` and `.agents/rules/project-rules.md` (both always-on). This file is a compact reference to load when you need the rules without pulling the full files.

## Code quality

- **TypeScript strict mode always.** No `any` without an explicit comment explaining why.
- `.astro` files by default. `.tsx` island only when interactivity genuinely requires a framework.
- **Never use raw `<img>`.** Always Astro `<Image />` with explicit `width`/`height`.
- **No inline styles** except dynamic CSS variable references.
- **No hardcoded hex values** in components. Always reference a CSS variable from `src/styles/global.css` (`--color-*`, `--font-*`).

## Naming

- Components: `PascalCase.astro` (e.g. `PostCard.astro`)
- Pages: `kebab-case.astro` (e.g. `about.astro`)
- Utilities: `camelCase.ts` (e.g. `readingTime.ts`)
- Sanity schemas: `camelCase.ts` (e.g. `slideDeck.ts`)
- **No abbreviations.** Clarity over brevity.

## Folder placement

- Components → correct subfolder of `src/components/` (`blog/`, `ui/`, `hero/`, `layout/`, `seo/`, `experiments/`).
- Pages → `src/pages/`.
- Layouts → `src/layouts/`.
- Utilities → `src/lib/utils/`.
- **Never create files in the repo root.** Shared config → `packages/`.
- Sanity schema changes: update the schema file **and** `apps/web/src/content/config.ts` Zod schema to keep them in sync.

## Animations

- **Hero = Three.js only.** Never animate the hero with CSS.
- **GSAP is mandatory for scroll.** Use `ScrollTrigger`, not manual `IntersectionObserver`.
- **Wrap GSAP init in `if (typeof window !== 'undefined')`** to prevent SSR errors.
- **Bind init to `astro:after-swap`**, not just a one-shot inline script. View Transitions don't re-run inline scripts (`ReadingProgress` and Footer clock have both been bitten by this).
- **`prefers-reduced-motion` fallback mandatory** on every animation.
- **Durations:** Hero 1000–1500ms, page transitions 300ms, micro-interactions 150–200ms.
- **Motion One = UI micro-interactions only** (buttons, cards, inputs).

## Performance

- **Targets:** Lighthouse Performance ≥ 95, A11y = 100, Best Practices = 100, SEO = 100. (Literal 100/100 LCP is explicitly deprioritised in favour of the hero GSAP fade — decision 2026-04-01.)
- **Three.js and GSAP dynamically imported**, never in frontmatter / top-level imports.
- **Wrap expensive init in `requestIdleCallback`** (with a `setTimeout` fallback). Three.js and homepage GSAP both use this pattern.
- **Cap WebGL `pixel ratio` at 1.5** for mobile TBT.
- **Defer third-party scripts.** GTM is `setTimeout(..., 3500)`. Giscus, Beehiiv, YouTube all use `loading="lazy"` or equivalent.
- **Images:** WebP, explicit `width`/`height` to prevent CLS.
- **Fonts:** max 2 families, `font-display: swap`.

## SEO & AI discoverability (GEO)

- **Every page:** `SEOHead.astro` with populated title, description, ogImage.
- **Every post + experiment:** `JsonLD.astro` structured data.
- **Every post:** populated `aiSummary` field (2 sentences, plain text, no markdown — optimized for AI citation).
- **Every post:** `TLDR.astro` **before the first H2**.
- **Canonical URLs** set explicitly.
- **`/api/posts.json` must always stay live.**
- **Topic clusters:** `/topics/[topic]` landing pages for each core topic (AI Agents, Hardware, Infrastructure, Architecture, etc. — see `TOPIC_MAP` in `lib/utils/posts.ts`).

## Content voice — "Rohit" persona

First-person, confident, direct. **No corporate vocabulary.**

### Prohibited phrases (hard list)

- "In this article I will..."
- "In conclusion..."
- "It's worth noting that..."
- "I'm excited to share..."
- "Thrilled to share"
- "Game-changer"
- "Dive deep"
- "In today's fast-paced world"

### Mandatory structure for Deep Dive posts

1. **Hook (no heading)** — one punchy paragraph under the TLDR, mid-action opener.
2. **## The Architecture** — comparison tables, ASCII diagrams, technical reality.
3. **## The Build** — complete runnable code (**no `...` ellipsis**, no `your_module` placeholders).
4. **## The Tradeoffs** — post-mortem: what broke, what surprised me, what I'd do differently.
5. **## Where This Goes** — one forward-looking paragraph. **No sign-off.**

Reading time target: **6–8 minutes** (auto-computed at 200 wpm, don't hardcode).

### Content integrity

- **Cross-reference hardware claims** across articles (standard: 3× Pi 5 16GB + M.2 256GB).
- **Consistent provider naming** (OpenAI vs Together AI — don't mix).
- **Soften or evidence unsubstantiated claims** ("100% grid-independent", "15% vampire power" style language needs a source).
- **Complete code samples** — no `...`, no `your_module`.

## Git & deployment

- **Never commit directly to `main`.** Work on `dev` or a `feature/*` branch.
- **Conventional commits:** `feat:`, `fix:`, `content:`, `chore:`, `style:`, `refactor:`, `docs:`.
- **Don't commit after every change.** Batch into topic-sized commits. Verify on localhost first.
- **Don't run `pnpm lint` / `pnpm typecheck` for minor tweaks or content updates.** Reserve for major code changes or before a feature push. This is a stable site.
- **Environment variables:** `import.meta.env` only. Update `.env.example` when adding new vars. `.env.local` is gitignored.
- **Exceptions to env-only:** GTM `GTM-MBGML7FV` (decision 2026-03-30, override) and Cloudflare beacon token (decision 2026-03-30, override). Both hardcoded in `BaseLayout.astro`.

## Design system

- **Dark mode is the default.** Localized light reader mode only on `/blog/[slug]` and `/experiments/[slug]`, toggled via View Transitions clip-path animation, bound to `document.body` (not `<article>`).
- **Colour palette:** neutral dark (`#09090b`–`#18181b`) + electric blue accent `#3fb1ff` + amber warm accent `#f59e0b`. No new colours without updating `global.css` first.
- **Typography scale:** defined in `global.css` `@theme` block. No arbitrary font sizes.
- **Cards:** `bg-bg-surface` + `border border-border` + subtle shadow + hover state.
- **Spacing:** Tailwind's scale (4px base). No arbitrary pixel values without comment.

## Accessibility

- All interactive elements **keyboard-navigable**.
- All images have descriptive `alt`; decorative `alt=""`.
- WCAG **AA minimum** contrast (4.5:1 for text).
- Focus rings **always visible** — never `outline: none` without a custom focus style.
- **ARIA labels on icon-only buttons.**

## Logging during work

Per governance rules:
1. Append new decisions to `.gekro/logs/decision-log.md` with date/time + rationale + implications.
2. Append new bugs/issues to `.gekro/logs/issue-tracker.md` with RCA.
3. **Commit log updates in batched commits** when the task is complete, or when the user requests it — not after every individual change.
