# Gekro Lab — Decision Log

This log tracks architectural and technical decisions. Before implementing counter-intuitive requests, the agent will cross-reference this log and request an **Override** if a conflict is found.

| Date/Time | Decision | Rationale | Implications | Override Count |
|---|---|---|---|---|
| 2026-03-24 00:10 | Use "Technical SVG Schematics" for Lab Gallery | Physical photos are hard to maintain and can feel dated. SVG schematics reinforce the "Engineering Lab" aesthetic. | Consistency in visual storytelling across About/Gallery pages. | 0 |
| 2026-03-24 00:40 | Migrate Experiments to Content Collections | Sanity-based fetching proved fragile for core site features. Local Markdown files provide better build-time stability and SEO. | Local-first architecture; removed Sanity dependency for experiments. | 0 |
| 2026-03-24 01:10 | "Authoritative Engineering Lab" Persona | Shift site tone from "Personal Blog" to "Live Engineering Log." | Impacted all copy, footer heartbeat, and technical depth in posts. | 0 |
| 2026-03-24 01:15 | Continuous Issue & Decision Logging | To prevent development cycles and regressions per user request. | Agent must read logs before every planning/execution phase. | 0 |
| 2026-03-24 02:00 | Gekro "Deep Dive" Content Standard | Establish a rigid structure for technical posts to ensure authority, depth, and persona consistency. | Rewriting 8 posts; impacts all future content structure and voice. | 0 |
| 2026-03-24 04:45 | Centralized Post-Fetching via `posts.ts` | Duplicated Sanity+local merge pattern across 4 pages was a maintenance hazard. Single `getAllPosts()` utility eliminates this. | All pages/API now source posts through one path. Must update `posts.ts` for any schema changes. | 0 |
| 2026-03-24 04:45 | Env-Var-Only Secrets | All API keys, analytics IDs, and service keys must come from env vars (`import.meta.env` / `process.env`). No hardcoded fallbacks in source. | Added `.env.example` as the single source of truth for required vars. | 1 |
| 2026-03-24 13:45 | Content Integrity Standard | All blog/experiment content must be cross-referenced for hardware consistency (Pi count, specs), provider naming consistency, and factual accuracy. Unsubstantiated claims must be softened or evidenced. Code examples must be complete (no `...` or `your_module`). | Applied to all 11 content files. Standardized on 3× Pi 5 16GB + M.2 256GB across all articles. | 0 |
| 2026-03-28 16:35 | Deep Dive Content Standard V2 | Adopt V2 structure (Hook, Architecture, Build, Tradeoffs, Where This Goes) and "Rohit" persona. Rigidly enforce first-person, no clichés, and 6-8 min reading time. | Mandatory adherence for all future technical posts. Updated SKILL.md and template. | 0 |
| 2026-03-30 06:43 | Hardcoded GTM Tag | User explicitly overrode Env-Var-Only Secrets for Google Tag Manager to resolve analytics issue directly in the view. | Hardcoded GTM ID in BaseLayout.astro. Removed `PUBLIC_GTM_ID` from `.env.local` and `.env.example`. | 0 |
