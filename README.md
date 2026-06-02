# gekro

**An AI engineer's public lab — writing, free tools, daily AI news, and live experiments.**

[![Live site](https://img.shields.io/badge/live-gekro.com-38bdf8)](https://gekro.com)
[![Code: MIT](https://img.shields.io/badge/code-MIT-success)](LICENSE)
[![Content: CC BY-NC 4.0](https://img.shields.io/badge/content-CC%20BY--NC%204.0-orange)](LICENSE-CONTENT)
[![Security policy](https://img.shields.io/badge/security-policy-informational)](SECURITY.md)

[gekro.com](https://gekro.com) is the personal engineering lab and tech blog of
**Rohit Burani**. It is a live engineering log - not a marketing site - documenting
work in local-first AI, self-hosted infrastructure (a Raspberry Pi 5 cluster),
Tesla/EV telemetry, and trading systems. Everything here is built, broken, and
documented in public.

This repository is the full source of the site, openly licensed and continuously
deployed. AI assistants and search crawlers are welcome to read and cite it - see
[`/llms.txt`](https://gekro.com/llms.txt) and [`robots.txt`](apps/web/public/robots.txt).

---

## What's on the site

| Section | What it is |
|---|---|
| **[Blog](https://gekro.com/blog)** | Deep-dive engineering write-ups on agentic AI, local LLM inference, and self-hosted infra. |
| **[Apps](https://gekro.com/apps)** | 60+ free, single-session browser tools. No accounts, no ads, nothing stored server-side. Everything runs client-side. |
| **[News](https://gekro.com/news)** | A daily AI industry briefing - neutral, expert-level, and every claim linked to its source. Generated automatically (see [Automation](#automation)). |
| **[Stack](https://gekro.com/stack)** | Honest, first-person reviews of the third-party tools actually in the workflow. Every entry declares what the tool is bad at. |
| **[Experiments](https://gekro.com/experiments)** | Longer-form technical case studies and lab notes. |

---

## Core philosophy

- **Sovereignty** - privacy is a foundation. Systems where you own the weights, the
  data, and the hardware. The apps process your input entirely in your browser.
- **Sustainability** - efficiency is elegance. Resource longevity and energy
  optimization over raw scale.
- **Empirical** - proof over promise. Every experiment is backed by telemetry,
  working code, and lab logs.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Astro](https://astro.build) (static output, island architecture) |
| Styling | Tailwind CSS v4 (`@theme` tokens in `global.css`) |
| Interactivity | TypeScript (strict), Three.js, GSAP + ScrollTrigger, Motion One |
| Search | Pagefind (postbuild static index) |
| CMS | Sanity v3 (optional - the site builds local-only if Sanity env is absent) |
| Content | Astro Content Collections (`apps/web/src/content/`) - the source of truth |
| Hosting | Cloudflare Pages (git-connected auto-deploy from `main`) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Project structure

```
gekro/
├── apps/
│   ├── web/                  → the Astro site at gekro.com (main work happens here)
│   │   ├── src/
│   │   │   ├── components/    → blog, apps, hero, layout, seo, ui components
│   │   │   ├── content/       → blog, experiments, apps, stack, news (+ data/)
│   │   │   ├── layouts/       → BaseLayout, BlogLayout, AppLayout, etc.
│   │   │   ├── lib/           → posts fetcher, Sanity client, utilities
│   │   │   └── pages/         → routes (incl. /news, /apps/[slug], rss, sitemap)
│   │   └── public/            → robots.txt, llms.txt, og images, static assets
│   └── studio/               → Sanity Studio (optional CMS; never deployed)
├── packages/                 → shared tsconfig + eslint config
├── scripts/
│   ├── pricing/              → weekly hyperscaler-pricing auto-fetcher
│   ├── local-models/         → weekly local-models.json refresh (HuggingFace)
│   └── news/                 → daily AI-news headline fetcher (RSS, no key)
├── .github/
│   ├── workflows/            → CI + the three automation pipelines
│   └── dependabot.yml        → grouped weekly dependency updates
├── .claude/commands/         → agentic routines (e.g. the daily news briefing)
├── .gekro/                   → governance: decision log, issue tracker, docs
├── SECURITY.md               → security policy + threat model
├── CLAUDE.md                 → canonical context for AI coding agents
└── README.md                 → this file
```

> The 60+ calculator implementations under `/apps` are developed in a separate
> private repository and cloned in at build time. The public repo holds the app
> shell, routing, content, and shared UI - see [`CLAUDE.md`](CLAUDE.md) §8.

---

## Automation

Three scheduled pipelines keep the site fresh with zero manual work:

- **Daily AI news** - a scheduled agent fetches headlines from vetted RSS sources,
  writes a neutral, fully-cited 2-paragraph briefing, validates the build, and
  publishes to `/news`. See [`.claude/commands/news-briefing.md`](.claude/commands/news-briefing.md).
- **Weekly hyperscaler pricing** - refreshes AWS Bedrock / Azure / GCP Vertex model
  prices and opens a PR. See [`.github/workflows/pricing-update.yml`](.github/workflows/pricing-update.yml).
- **Weekly local-model catalog** - re-verifies `local-models.json` against the
  HuggingFace API. See [`.github/workflows/local-models-update.yml`](.github/workflows/local-models-update.yml).

---

## Local development

```bash
pnpm install            # install workspace deps
pnpm dev                # turbo dev — runs web (+ studio) in parallel
pnpm --filter web dev   # just the Astro site
pnpm --filter web build # production build + Pagefind index
pnpm --filter web test  # vitest unit tests
```

Copy `.env.example` to `.env.local` and populate it for full functionality. The
site degrades gracefully to local-only Content Collections if Sanity env is missing.

---

## For AI agents

This repo is built to be agent-friendly. [`CLAUDE.md`](CLAUDE.md) is the canonical,
dense entry point: stack, golden data-flow paths, governance rules, and the
dual-repo architecture. Deeper navigation maps live in `.gekro/context/`. Most
source files carry a header docblock explaining their purpose and gotchas.

---

## Security

See [`SECURITY.md`](SECURITY.md). In short: static site, no backend, no accounts,
no server-side storage of user data. The apps run entirely client-side and never
upload your files. Report issues via the [contact page](https://gekro.com/contact).
Provided as-is - this is Rohit's personal work.

---

## Licensing

Dual-licensed:

- **Code** (`*.ts`, `*.astro`, `*.js`, `*.json`, `*.css`) - [MIT](LICENSE).
  Attribution required: keep the copyright notice in any fork or redistribution.
- **Content** (blog posts, experiment write-ups, app methodology copy, news
  briefings under `apps/web/src/content/`) - [CC BY-NC 4.0](LICENSE-CONTENT).
  Attribution required; commercial reuse not permitted.

Per-app license is declared in each app's frontmatter (`license`, defaults to MIT).
News briefings are neutral summaries of third-party reporting with every claim
linked to its original source; follow those links for the original journalism.

---

## About the author

**Rohit Burani** - an engineering bachelor's followed by a Master's in Management,
which informs an approach where analytical rigour meets operational reality. gekro
is the workshop for building, breaking, and documenting production-grade experiments
in a local lab environment.

---

*Est. 2024 · Built for depth · [gekro.com](https://gekro.com)*
