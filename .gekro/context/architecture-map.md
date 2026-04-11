# Architecture Map

Every source file that matters, annotated. Node_modules, dist, .astro, .turbo, and .sanity build artifacts are excluded.

## Repo root

| Path | Purpose |
|---|---|
| `package.json` | Root workspace — `turbo build/dev/lint/typecheck` scripts. `packageManager: pnpm@9.0.0`. |
| `pnpm-workspace.yaml` | Workspaces = `apps/*` + `packages/*`. |
| `turbo.json` | Pipeline: `build` depends on `^build`, outputs `dist/**`, `.next/**`, `.astro/**`. `dev` is non-cached + persistent. |
| `.env.example` | Template for env vars (see CLAUDE.md §8). |
| `.env.local` | Gitignored. Populate from `.env.example`. |
| `.cursorrules` | Workspace rules for Cursor / Antigravity (superset of `.agents/rules/project-rules.md`). |
| `.gitignore` | Excludes `node_modules`, `.turbo`, `dist`, `.env*`, `.astro`, `.artifacts`, `linkedin-drafts/`, `walkthroughs/`. |
| `README.md` | Public-facing brand/tech summary. |
| `CLAUDE.md` | Canonical agent context (primary entry). |
| `GEMINI.md` | Pointer to `CLAUDE.md`. |

## `.agents/` — always-on agent rules + skills

| Path | Purpose |
|---|---|
| `rules/project-rules.md` | Workspace rules v1.0: code quality, naming, animations, perf, SEO, content, git, design, a11y. Frontmatter `trigger: always_on`. |
| `rules/decisions-issues.md` | Pre-flight research, issue logging, decision safeguards, override protocol. Frontmatter `trigger: always_on`. |
| `skills/blog-post-creation/SKILL.md` | Deep Dive post generation workflow (Rohit persona, 5-section structure, human-in-the-loop). |
| `skills/linkedin-post-generation/SKILL.md` | 8-line LinkedIn post + mandatory generated image, never auto-triggered after blog posts. |

## `.gekro/` — governance + docs + context

| Path | Purpose |
|---|---|
| `docs/deep-dive-standard.md` | Authoritative Deep Dive content rules (V2, Rohit persona, 5-section structure). |
| `docs/linkedin-standard.md` | Authoritative LinkedIn rules (8-line + image + prohibited phrases). |
| `logs/decision-log.md` | **Mutable, pre-flight read.** 13 decisions as of 2026-04-01. |
| `logs/issue-tracker.md` | **Mutable, pre-flight read.** 17 resolved issues + 1 open backlog (proof layer). |
| `context/*` | This knowledge base. |

## `.artifacts/` — historical / aspirational

> Gitignored. Locally persistent. Treat as archival.

| Path | Purpose |
|---|---|
| `gekro-blueprint.md` (36 KB) | Original v1.0 spec from March 2026. **Superseded in places** — e.g. forest-green palette is now neutral-dark-with-electric-blue; body font changed from Lora to Inter/Geist Sans. Useful for intent, not source of truth. |
| `decision-log.md` | Older small decision log (3 decisions from 2026-03-22). Superseded by `.gekro/logs/decision-log.md`. |
| `rules/` | Older rules snapshot. |

## `.github/workflows/ci.yml`

Single CI job: checkout → pnpm v9 → node 20 with pnpm cache → `pnpm install --frozen-lockfile` → `pnpm --filter web exec astro check` (typecheck) → `pnpm --filter web lint` (`continue-on-error: true`) → `pnpm --filter web build` (with Sanity env secrets). Runs on push to all branches + PRs to `main`/`dev`.

## `apps/web/` — the Astro site (main work)

### Config
- `astro.config.mjs` — site `https://gekro.com`. Conditionally loads Sanity integration only if `PUBLIC_SANITY_PROJECT_ID` is set. Sitemap integration. Tailwind v4 via Vite plugin. Image domains: `deepwiki.com`.
- `package.json` — scripts: `dev`, `build` (+ `pagefind --site dist` postbuild), `preview`, `lint`, `typecheck`, `test` (vitest run). Workspace deps: `@gekro/eslint-config`, `@gekro/tsconfig`.
- `tsconfig.json` — extends `@gekro/tsconfig/base.json`.
- `vitest.config.ts` — config for unit tests.
- `.env.local` — web-specific overrides (gitignored).

### `public/`
- `llms.txt` — AI crawler manifest (GEO).
- `robots.txt` — crawler rules.
- `favicon.svg`.
- `og/default.png` — OG image fallback.
- `images/blog/`, `images/lab/` — static image assets.

### `src/components/`
Organised by domain. See [components.md](components.md) for a full catalogue.

### `src/content/`
- `config.ts` — Zod schemas for `blog` and `experiments` collections.
- `blog/` — 11 markdown posts + `_template.md`.
- `experiments/` — 3 markdown experiments + `_template.md`.

### `src/layouts/`
- `BaseLayout.astro` — wraps every page. View Transitions, GTM (deferred 3.5s hardcoded), Cloudflare beacon (hardcoded), `LabTerminal`, post-swap GSAP fade.
- `BlogLayout.astro` — post wrapper. Light-mode theme binds to `document.body` (not `<article>`) — key fix from 2026-03-31.
- `ExperimentLayout.astro` — experiment wrapper.

### `src/lib/`
- `sanity/client.ts` — `createClient` if `PUBLIC_SANITY_PROJECT_ID` else a stub with rejecting `fetch`. All callers wrap in try/catch.
- `sanity/queries.ts` — GROQ queries via `String.raw` tag: `ALL_POSTS_QUERY`, `RECENT_POSTS_QUERY`, `ALL_EXPERIMENTS_QUERY`, `TOPIC_CLUSTERS_QUERY`.
- `utils/posts.ts` — ⭐ `getAllPosts()` merges Sanity + local, `getTopicCounts()`, `calculateReadingTime()`, `TOPIC_MAP` consolidation. **Single source for all post fetching.**
- `utils/reading-time.ts` — pure util, tested in `reading-time.test.ts`.

### `src/pages/`
See [pages.md](pages.md) for full route → layout → data map.

### `src/styles/global.css`
Tailwind v4 `@theme` block with CSS variables: `--color-bg-base/surface/elevated`, `--color-text-primary/secondary/muted`, `--color-accent` (`#3fb1ff` electric blue), `--color-accent-warm` (amber), `--color-border[/-subtle]`, `--font-display/heading/body/mono`. `.theme-light` class overrides tokens for localized light reader mode (applied to `document.body` during View Transitions). Prose overrides for `.prose` children.

## `apps/studio/` — Sanity Studio

| Path | Purpose |
|---|---|
| `sanity.config.ts` | `projectId` fallback `tpon4xn2`, `dataset` fallback `production`, `structureTool()` plugin, imports `schemaTypes` from `./schemas`. |
| `sanity.cli.ts` | CLI config. |
| `schemas/index.ts` | Exports `[post, experiment, slideDeck, topic]`. |
| `schemas/post.ts` | Post doc: title, slug, tldr, body (portable text), topics (refs → topic), type enum (tutorial/lab-note/deep-dive/opinion/case-study), publishedAt, featuredImage, seoTitle, seoDescription, aiSummary, estimatedReadingTime, featured, linkedExperiment. |
| `schemas/experiment.ts` | Experiment doc: title, slug, summary, status enum, startDate, stack[], architectureDiagram, body, githubUrl, demoUrl, topics, outcomes, aiSummary. |
| `schemas/slideDeck.ts` | Slide deck schema. |
| `schemas/topic.ts` | Topic schema. |
| `package.json` | Deps: sanity, styled-components, react/react-dom. Workspace: `@gekro/eslint-config`, `@gekro/tsconfig`. |

## `packages/`

| Path | Status |
|---|---|
| `gekro-eslint-config/package.json` | `@gekro/eslint-config` v0.0.0. **Stub — no actual eslint config authored yet.** CI `continue-on-error: true` reflects this. |
| `tsconfig/base.json` | Shared strict TS config (target ESNext, module ESNext, strict: true). Consumed by both apps via `@gekro/tsconfig`. |
| `ui/package.json` | `@gekro/ui` v0.0.0, `main: ./index.ts`. **Empty placeholder — no components extracted here yet.** |

## Mental model

- **apps/web is the product.** Everything user-facing lives there.
- **apps/studio is optional content tooling.** The site will build without Sanity env vars, falling back to local Content Collections. When modifying content models, update BOTH `apps/web/src/content/config.ts` (Zod) AND `apps/studio/schemas/` (Sanity) to keep them in sync.
- **packages/ is mostly scaffolding.** `tsconfig` is real; `eslint-config` and `ui` are reserved placeholders. Don't assume they export anything yet.
- **.agents/, .gekro/, .artifacts/** overlap historically. The authoritative live context is `.agents/rules/` (always-on prompts) + `.gekro/logs/` (mutable state) + `.gekro/context/` (this KB). `.artifacts/` is archival only.
