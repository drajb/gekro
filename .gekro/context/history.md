# History — Distilled Lessons & Decisions

Source of truth for *current* state: `.gekro/logs/decision-log.md` and `.gekro/logs/issue-tracker.md`. This file is a **distilled narrative** of what's been learned so future agents don't have to re-read the full tables.

## Timeline summary

- **2026-03-22** — Project scaffolded from `gekro-blueprint.md`. `@gekro/*` npm scope decided for internal packages.
- **2026-03-23** — `.gekro/` governance scaffolding added. Blueprint referenced from `.artifacts/`.
- **2026-03-24** — Largest single work day: codebase audit (25 fixes), migration of Experiments from Sanity to local Content Collections, centralization of post-fetching into `lib/utils/posts.ts`, lab gallery shift from photos to SVG schematics, "Authoritative Engineering Lab" persona adopted, continuous logging rule adopted, Deep Dive V1 content standard, content integrity audit (20 fixes across 8 posts + 3 experiments standardizing to 3× Pi 5 16GB + M.2 256GB).
- **2026-03-25** — Beehiiv newsletter wired up (missing env var bug).
- **2026-03-28** — Deep Dive standard V2 adopted (Hook / Architecture / Build / Tradeoffs / Where This Goes, "Rohit" persona, 6–8 min reading time).
- **2026-03-30** — Google Tag Manager hardcoded as **override** of env-only rule (analytics was silently broken due to missing env var). Cloudflare beacon token hardcoded same day, also as override.
- **2026-03-31** — Localized light reader mode shipped for blog + experiments via View Transitions API + scoped CSS variables, later escalated from `<article>` binding to `document.body` to fix sticky-header illegibility. `ReadingProgress` scroll-bar lost after View Transitions — refactored to `initProgress()` bound to `astro:after-swap`.
- **2026-04-01** — Mobile TBT was 34 seconds (Lighthouse). Three.js nested loops + GSAP bound-box queries were locking the CPU synchronously before FCP. Fixed by wrapping `initThree()` and `initHomeAnimations()` in `requestIdleCallback`, capping WebGL pixel ratio at 1.5, deferring GTM by 3.5s. **Decision 13 (override count 1): GSAP hero fade is kept despite Lighthouse Element Render Delay penalty** — the premium "wow factor" is prioritized over literal 100/100 LCP. Don't revert this without Override.
- **2026-04-04 → 2026-04-11** — Governance refinement, workspace rules polish, neural network hero animation iteration.

## Key architectural decisions still in force

| Decision | Implication |
|---|---|
| **Local-first Content Collections** (2026-03-24) | Blog + experiments ship as markdown in `src/content/`. Sanity is supplementary. Site builds without Sanity env. |
| **Centralized `getAllPosts()`** (2026-03-24) | One fetcher in `lib/utils/posts.ts` merges local + Sanity. Don't duplicate. |
| **Env-var-only secrets** (2026-03-24, override count 2) | All secrets from `import.meta.env` / `process.env`. `.env.example` is the single source of truth for required vars. **Exceptions:** GTM ID and Cloudflare beacon token. |
| **"Authoritative Engineering Lab" persona** (2026-03-24) | First-person post-mortem voice across all copy; footer System Sync heartbeat clock reinforces "live lab" identity. |
| **Deep Dive Content Standard V2** (2026-03-28) | Rigid 5-section structure, 6–8 min reading time, prohibited phrase list. |
| **Localized light reader mode** (2026-03-31) | Only on `/blog/[slug]` + `/experiments/[slug]`, binds to `document.body`, cleanup script required on `astro:after-swap` when leaving reading pages. |
| **Perf ↔ aesthetics trade-off** (2026-04-01) | Hero GSAP fade is kept. Three.js and GSAP init inside `requestIdleCallback`. WebGL pixel ratio cap = 1.5. |
| **SVG schematics over photos** for Lab Gallery (2026-03-24) | Don't swap to physical photos without approval. |

## Top incident categories — patterns to watch for

### 1. View Transitions break inline scripts

The single most recurring bug shape. `<script>` tags in Astro components only execute on initial page load — not after a View Transition navigation.

**Fix pattern:** refactor the logic into a named `init<Thing>()` function, call it once at load, then bind to `astro:after-swap`:
```js
document.addEventListener('astro:after-swap', initThing);
initThing();
```
Seen in: Footer clock (stale after navigation), `ReadingProgress` scroll bar (lost after navigation), light theme cleanup (persists after navigation away from reading pages).

### 2. GSAP targeting non-existent / wrong selectors

Components had hardcoded `opacity-0` *plus* GSAP entrance animations targeting selectors that weren't matching (`.post-card` vs actual class, etc). Result: invisible cards.

**Fix pattern:** don't use hardcoded `opacity-0`; let GSAP handle the entrance. Verify the selector actually matches by querySelectorAll in devtools first.

### 3. Hardcoded `text-white` in Header breaks light reader mode

Light reader mode binds to `document.body`. Anything inside the body that bypasses CSS variables (hardcoded `text-white`, hardcoded hex backgrounds) will look wrong.

**Fix pattern:** all colour references go through `text-text-primary` / `text-text-secondary` / etc. utility classes that resolve to CSS variables.

### 4. Sanity fetch fragility on a critical path

The experiment detail page was redirecting/failing when Sanity data was incomplete. Decision: **don't put Sanity on critical paths.** Local Content Collections are the primary source of truth; Sanity is supplementary.

### 5. Missing env vars causing silent fallbacks the user doesn't notice

Twice now: Beehiiv newsletter showed a fallback message because `PUBLIC_BEEHIIV_PUBLICATION_ID` was missing; GTM silently disabled because `PUBLIC_GTM_ID` was missing.

**Fix pattern:** add new env vars to `.env.example` with a comment explaining where to find them. For critical scripts, prefer hardcoding (with Override) over silent failure — that's what happened with GTM and Cloudflare beacon.

### 6. Synchronous heavy work blocking FCP on mobile

34-second TBT incident. Three.js nested loops + GSAP bound-box queries running synchronously in the main thread.

**Fix pattern:** `requestIdleCallback` wrapping for anything expensive, dynamic imports for heavy libraries, `setTimeout` deferring for third-party scripts.

## Open backlog

- **Proof layer on experiment detail pages** (2026-03-31). Every new experiment must include at least one screenshot or `render_diffs` block. Current 3 experiments are text-heavy and lack visual evidence.

## Stale claims in `.artifacts/gekro-blueprint.md`

The original blueprint (March 2026, 36 KB) predates several key decisions. Treat these sections as **stale**:

- **Colour palette** — blueprint shows forest green `#1a3a2a` + teal `#00d4aa` + cream `#f5f0e8`. Current is neutral dark `#09090b`–`#18181b` + electric blue `#3fb1ff` + amber `#f59e0b`.
- **Typography** — blueprint lists Lora as body font. Current is Inter / Geist Sans (UX testing favoured sans-serif for technical prose).
- **File structure** — blueprint mentions files that don't exist (e.g. `HeroCanvas.astro`, `hero.glsl` — both deleted; replaced by `HeroCanvasNeural.astro`).
- **Scripts directory** — blueprint shows `scripts/new-post.ts`, `sync-llms-txt.ts`, `submit-index.ts`. These don't exist in the repo; only `llms.txt` is static.
- **Sanity schema fields** — blueprint shows a `description` field on Post; the actual schema in `apps/studio/schemas/post.ts` does not have it (has `tldr` + `seoDescription` instead).

Useful for understanding **intent and direction**, not for citing as current fact.
