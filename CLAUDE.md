# Gekro — Agent Context (CLAUDE.md)

> Canonical entry point for AI coding agents working on this repo (Claude Code, Gemini CLI, etc.). Read this first; it's deliberately dense and links out to deeper references rather than repeating them.

## 1. What this repo is

**gekro.com** is Rohit Burani's personal AI engineering lab and tech blog. It's a **live engineering log** — not a marketing site — documenting experiments in local-first AI, self-hosted infra (Pi 5 cluster), Tesla/EV telemetry, and trading systems. Persona voice is "authoritative engineering lab," first-person, post-mortem honest.

- **Owner / sole contributor:** Rohit Burani (Engineering + Management background)
- **Production URL:** https://gekro.com
- **Hosting:** Cloudflare Pages (git-connected auto-deploy from `main`)
- **Repo root:** `g:/Git/gekro` (Windows, bash shell via WSL-style paths)

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Framework | Astro 4.x (island arch, mostly `.astro` files) |
| Styling | Tailwind CSS v4 (`@theme` block in `global.css`) |
| Interactivity | TypeScript strict, Three.js, GSAP + ScrollTrigger, Motion One |
| CMS | Sanity v3 (optional — site builds local-only if env missing) |
| Content | Astro Content Collections (`apps/web/src/content/`) — **primary source of truth** |
| Search | Pagefind (postbuild step) |
| Comments | Giscus |
| Newsletter | Beehiiv embed |
| Analytics | GTM (hardcoded) + Cloudflare Web Analytics (hardcoded) + GA (env) |
| Monorepo | Turborepo + pnpm workspaces (`pnpm@9.0.0`) |
| CI | GitHub Actions → typecheck → lint (non-blocking) → build |

## 3. Monorepo layout (source-of-truth paths)

```
gekro/
├── apps/
│   ├── web/              → Astro site (main work happens here)
│   │   ├── astro.config.mjs
│   │   ├── public/       → llms.txt, robots.txt, og/, images/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── blog/         → PostCard, PostHeader, PostTOC, TLDR, CodeBlock, GifPlayer, GiscusComments, PortableText, ReadingProgress, RelatedPosts
│   │       │   ├── experiments/  → ExperimentCard
│   │       │   ├── hero/         → HeroCanvasNeural (Three.js), HeroText (GSAP)
│   │       │   ├── layout/       → Header, Footer
│   │       │   ├── seo/          → SEOHead, JsonLD
│   │       │   ├── ui/           → BrandLogo, ContactForm, LabGallery, NewsletterEmbed, SearchWidget, Tag, ThemeToggle
│   │       │   └── LabTerminal.astro (global, mounted in BaseLayout)
│   │       ├── content/
│   │       │   ├── config.ts     → Zod schemas for blog + experiments collections
│   │       │   ├── blog/         → 11 markdown posts + _template.md
│   │       │   └── experiments/  → 3 markdown experiments + _template.md
│   │       ├── layouts/          → BaseLayout, BlogLayout, ExperimentLayout
│   │       ├── lib/
│   │       │   ├── sanity/       → client.ts (stub-on-missing), queries.ts (GROQ)
│   │       │   └── utils/        → posts.ts (⭐ central post fetcher), reading-time.ts (+ vitest)
│   │       ├── pages/
│   │       │   ├── index.astro                → homepage
│   │       │   ├── about.astro, contact.astro, now.astro, slides.astro
│   │       │   ├── blog/index.astro, blog/[slug].astro
│   │       │   ├── experiments/index.astro, experiments/[slug].astro
│   │       │   ├── topics/[topic].astro
│   │       │   ├── api/posts.json.ts          → public JSON API
│   │       │   └── rss.xml.ts
│   │       └── styles/global.css              → Tailwind v4 @theme tokens + prose overrides
│   └── studio/           → Sanity Studio (schemas/: post, experiment, slideDeck, topic)
├── packages/
│   ├── gekro-eslint-config/  (@gekro/eslint-config — stub, version 0.0.0)
│   ├── tsconfig/             (@gekro/tsconfig — base.json, strict: true)
│   └── ui/                   (@gekro/ui — placeholder, index.ts only)
├── .agents/
│   ├── rules/                → project-rules.md, decisions-issues.md (always-on prompts)
│   └── skills/               → blog-post-creation/SKILL.md, linkedin-post-generation/SKILL.md
├── .gekro/
│   ├── docs/                 → deep-dive-standard.md, linkedin-standard.md
│   ├── logs/                 → ⭐ decision-log.md, issue-tracker.md (MUST READ before work)
│   └── context/              → ⭐ deep knowledge base (see section 7)
├── .artifacts/               → gekro-blueprint.md (36 KB original spec), historical decision-log.md [gitignored]
├── .github/workflows/ci.yml  → typecheck, lint, build on push
├── .cursorrules, .env.example, turbo.json, pnpm-workspace.yaml
└── CLAUDE.md (this file), GEMINI.md (pointer)
```

## 4. Golden paths — how data flows

- **Blog post list anywhere** → `getAllPosts()` in [apps/web/src/lib/utils/posts.ts](apps/web/src/lib/utils/posts.ts). Merges local Content Collection + Sanity (silent fallback if Sanity unreachable), sorts newest-first, consolidates topics via `TOPIC_MAP`. **Do not duplicate this logic** — decision from 2026-03-24.
- **Topic chips** → `getTopicCounts()` in the same file.
- **Sanity access** → `client` in [apps/web/src/lib/sanity/client.ts](apps/web/src/lib/sanity/client.ts) returns a stub rejecting-fetch if `PUBLIC_SANITY_PROJECT_ID` is missing. All callers must wrap in try/catch.
- **Page → layout chain** → `BaseLayout.astro` wraps everything (View Transitions, GTM deferred 3.5s, Cloudflare beacon, `LabTerminal`, post-swap GSAP fade). `BlogLayout` and `ExperimentLayout` extend it.
- **Content schemas** → `apps/web/src/content/config.ts` (Zod, single source of truth for markdown frontmatter). Sanity schemas in `apps/studio/schemas/` are the headless mirror.
- **SEO** → `SEOHead.astro` is mandatory on every page; `JsonLD.astro` on every post/experiment; `aiSummary` field is optimised for AI citation (GEO).

## 5. Commands

From repo root (monorepo):
```bash
pnpm dev           # turbo dev — starts web + studio in parallel
pnpm build         # turbo build
pnpm lint          # turbo lint
pnpm typecheck     # turbo typecheck
```
Per-app:
```bash
pnpm --filter web dev         # Astro dev server, --host
pnpm --filter web build       # astro build + pagefind postbuild
pnpm --filter web test        # vitest run (only reading-time.test.ts exists)
pnpm --filter web exec astro check   # what CI runs for typecheck
pnpm --filter studio dev      # sanity dev
```

Rule from project-rules.md: **don't run lint/typecheck on minor tweaks or content updates** — only for major code changes or before a final feature push. This is a stable site.

## 6. Governance rules (non-negotiable — read before acting)

The project uses a formal **decision log + issue tracker** workflow. These files are always-on context:

1. **Pre-flight:** Before any non-trivial research, planning, or execution, read:
   - [.gekro/logs/decision-log.md](.gekro/logs/decision-log.md) — architectural constraints you'd otherwise violate
   - [.gekro/logs/issue-tracker.md](.gekro/logs/issue-tracker.md) — known pitfalls + their RCAs
2. **Logging:** For every bug found or decision made during work, append a row with RCA/rationale + timestamp. Keep logs updated in real-time. **Commit/push only in batched commits when the task is done** or when the user requests it.
3. **Override protocol:** If a user request contradicts an existing decision, STOP, cite the conflicting decision's date, reason through trade-offs, and wait for the user to say literally **"Override"** before proceeding.
4. **Proactive verification:** If a proposed change might break an existing decision or recreate a known issue, warn the user before implementing.

Current decision count: **13 decisions** (latest: 2026-04-01 perf overhaul vs aesthetics, override count 1).
Current issue count: **17 resolved + 1 backlog** (proof layer in experiment detail pages — every new experiment must have at least one screenshot or `render_diffs` block).

## 7. Knowledge base index

Depth lives in [.gekro/context/](.gekro/context/) — load one of these when the root-level summary above isn't enough:

- [.gekro/context/architecture-map.md](.gekro/context/architecture-map.md) — full file-level map with purpose annotations
- [.gekro/context/components.md](.gekro/context/components.md) — every component, what it does, where it's used
- [.gekro/context/pages.md](.gekro/context/pages.md) — every route + its data sources + layout chain
- [.gekro/context/conventions.md](.gekro/context/conventions.md) — distilled code/style/content rules from `.cursorrules` + `.agents/rules/`
- [.gekro/context/history.md](.gekro/context/history.md) — condensed timeline of major decisions + hard-won lessons

Original spec (aspirational — **not** authoritative any more, parts have been superseded): [.artifacts/gekro-blueprint.md](.artifacts/gekro-blueprint.md).

## 8. Environment

- `.env.local` is gitignored; populate from `.env.example`.
- Required for full functionality: `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `SANITY_STUDIO_PROJECT_ID`, `PUBLIC_BEEHIIV_PUBLICATION_ID`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_GA_MEASUREMENT_ID`.
- Site gracefully degrades to local-only Content Collections if Sanity env is missing.
- **Hardcoded exceptions** (overrides of the env-only rule): GTM ID `GTM-MBGML7FV` and Cloudflare beacon token, both in `BaseLayout.astro`. Do **not** "fix" these back to env vars without Override.

## 9. Working with Gemini CLI (dual-agent setup)

This repo is developed hand-in-hand with Gemini CLI. Both agents share:
- `CLAUDE.md` (this file) and `GEMINI.md` (thin pointer to the same content)
- `.agents/rules/` — always-on governance prompts
- `.gekro/logs/` — shared state for decisions and issues
- `.gekro/context/` — shared deep navigation maps

**Coordination rule of thumb:** treat the decision log as a mutex. Before a non-trivial change, skim it for conflicts with the other agent's recent work. Append to the issue tracker/decision log in real time so the other agent sees your work next session.

## 10. Skills (Claude-invocable workflows)

Defined in `.agents/skills/`:
- **blog-post-creation** — converts brain-dumps into Gekro Deep Dive posts per [.gekro/docs/deep-dive-standard.md](.gekro/docs/deep-dive-standard.md). Five-section structure (Hook, Architecture, Build, Tradeoffs, Where This Goes), Rohit persona, 6–8 min reading time, no clichés. **Must wait for user approval before committing.**
- **linkedin-post-generation** — converts a published Deep Dive into an 8-line LinkedIn post per [.gekro/docs/linkedin-standard.md](.gekro/docs/linkedin-standard.md). **Never auto-trigger after a blog post** — only when user explicitly asks to "share" or "write a LinkedIn post". Output goes to `linkedin-drafts/` (gitignored).

---

*Last updated: 2026-04-11. Update this file when the monorepo structure, stack, or governance flow meaningfully changes.*
