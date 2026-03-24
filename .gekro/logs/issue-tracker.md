# Gekro Lab — Issue Tracker

This log tracks bugs, user complaints, and regressions. Every entry must include a **Root Cause Analysis (RCA)** to prevent recurrence.

| Date/Time | Issue | Root Cause Analysis | Fix |
|---|---|---|---|
| 2026-03-24 00:30 | Experiment Detail Pages Redirection | Sanity-based fetch was failing due to missing/incomplete data, and the hardcoded fallback lacked the `props` needed for `ExperimentLayout`, causing a route failure/redirect. | Migrated to local-first Content Collections. |
| 2026-03-24 00:46 | ExperimentCard Syntax Error | Manual refactor accidentally stripped the opening `---` frontmatter fence, causing an Astro compiler failure. | Restored frontmatter fences. |
| 2026-03-24 01:00 | Invisible Experiment Cards | GSAP animations on the index page were targeting `.post-card` but were not triggered correctly, and cards had hardcoded `opacity-0`. | Removed hardcoded `opacity-0` and refined GSAP triggers. |
| 2026-03-24 01:15 | Continuous Issue & Decision Logging | To prevent development cycles and regressions per user request. | Agent must read logs before every planning/execution phase. |
| 2026-03-24 01:30 | Live System Heartbeat | Every page should have a live "System Sync" clock to reinforce the "Live Lab" identity. | Implemented real-time clock in Footer.astro. |
| 2026-03-24 01:30 | Footer Clock Stale | The "Last System Sync" script only ran once on load and lacked a `setInterval` or Astro lifecycle handling. | Implementing `setInterval` and `astro:after-swap` listener. |
| 2026-03-24 01:45 | LabGallery Visibility | The LabGallery component was not rendering due to a missing conditional check for content availability, causing it to be hidden when no items were present. | Added a conditional render check to ensure LabGallery only displays when content is available. |
| 2026-03-24 02:15 | Fleet API Maintenance Overhead | Custom TS listener for Tesla Fleet API was becoming too complex to maintain (OAuth/signing). | Migrated to self-hosted TeslaMate instance on Raspberry Pi. |
| 2026-03-24 04:45 | Full Codebase Audit — 25 Fixes | Deep-dive audit revealed: HTML tag mismatch (ExperimentLayout), hardcoded secrets (GA/GTM/Turnstile/Sanity), duplicated post-fetching logic across 4 pages, missing prefers-reduced-motion on 4 components, event listener leak in HeroCanvasNeural, PostCard targeting non-existent CSS class, duplicate CSS variables, no font loading, missing .env.example, missing aria-labels, unused dead code files, reading time miscalculation, markdown syntax in .astro, and invalid robots.txt Sitemap entry. Issues #22 (PortableText) and #24 (_template.md) were false positives. | Created shared `posts.ts` utility, `.env.example`. Fixed all files. Deleted unused `HeroCanvas.astro` and `hero.glsl`. |
