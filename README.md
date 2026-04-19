# GEKRO

**AI Engineering Lab & Tech Blog**

Gekro is a personal engineering lab and tech blog dedicated to the intersection of analytical rigour and operational reality. This repository serves as a live engineering log for experiments in local-first AI sovereignty, sustainable home-lab infrastructure, and high-performance web systems.

## Core Philosophy

- **Sovereignty**: Privacy is a foundation. I build systems where you own the weights, the data, and the hardware. 
- **Sustainability**: Efficiency is elegance. Prioritizing resource longevity and energy optimization.
- **Empirical**: Proof over promise. Every experiment is backed by telemetry, functional code, and lab logs.

## Tech Stack

- **Framework**: Astro 4
- **Styling**: Tailwind CSS v4
- **Interactivity**: TypeScript, Three.js, GSAP, Motion One
- **CMS**: Sanity (Studio located in `apps/studio`)
- **Infrastructure**: Raspberry Pi 5 Cluster, TeslaMate, OpenClaw
- **Monorepo**: Turborepo + pnpm workspaces

## Project Structure

- `apps/web`: The main site at gekro.com.
- `apps/studio`: Sanity Studio for content management.
- `packages/`: Shared TypeScript configurations and ESLint rules.
- `.gekro/`: Project governance, including decision logs and issue trackers.

## About the Author

I am **Rohit Burani**. My background — an engineering bachelors followed by a Masters in Management — informs my approach to building: where analytical rigour meets operational reality. While my professional life is spent navigating the complexities of large, regulated organizations, Gekro is my workshop for building, breaking, and documenting production-grade experiments in a local lab environment.

## Apps

`/apps` is a collection of free, single-session tools built for personal use and made public. Each app ships with sourced data, no login required, and nothing stored server-side. Source code for every app lives under `apps/web/src/components/apps/`.

If you fork or use an app, include the MIT copyright notice and link back to gekro.com.

## Licensing

This repository is dual-licensed:

- **Code** (`*.ts`, `*.astro`, `*.js`, `*.json`, `*.css`) — [MIT License](LICENSE). Attribution required: include the copyright notice in any fork or redistribution.
- **Content** (blog posts, experiment case studies, app methodology copy in `apps/web/src/content/`) — [CC BY-NC 4.0](LICENSE-CONTENT). Attribution required; commercial reuse not permitted.

Per-app license is declared in each app's frontmatter (`license` field) and defaults to MIT. Any non-MIT app license has its full text in `LICENSES/`.

---

*EST. 2024 // Built for Depth*
