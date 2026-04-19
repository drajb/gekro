# Sonnet Handover Prompt — `/apps` Platform Build

> Paste this prompt into a fresh Sonnet session in the gekro repo. It is self-contained and assumes Sonnet has no prior conversation context.

---

## Context

You are picking up work on **gekro.com** — Rohit Burani's AI engineering lab + tech blog. The repo is at `g:/Git/gekro` (Windows, bash shell). Your task is to build the **`/apps` platform** — a new section of the site for single-session, client-only mini-tools.

**Before doing anything else, read these files in order:**

1. `CLAUDE.md` — repo overview, governance rules, golden paths.
2. `.gekro/docs/apps-platform-standard.md` — **the canonical spec for this work**. This is your bible. Do not deviate without an Override.
3. `.gekro/logs/decision-log.md` — the three 2026-04-19 entries cover the apps section, scaling decisions, and licensing. All decisions are confirmed by the user.
4. `.gekro/logs/issue-tracker.md` — known pitfalls. Pay particular attention to the View Transitions listener pattern (2026-04-11 and 2026-04-15 entries).
5. `apps/web/src/content/config.ts` — existing collection schema (the pattern you're mirroring).
6. `apps/web/src/pages/experiments/index.astro` — closest analogue for the landing page.
7. `apps/web/src/pages/experiments/[slug].astro` and `apps/web/src/layouts/ExperimentLayout.astro` — closest analogues for the dynamic route + layout.
8. `apps/web/src/components/layout/Header.astro` — where you'll add the `/apps` nav link (note the AbortController scroll-listener pattern).
9. `apps/web/src/components/blog/PostCard.astro` and `apps/web/src/components/experiments/ExperimentCard.astro` — visual treatment to mirror in `AppCard.astro`.

## Your scope (3 phases, with hard gates)

### Phase 1 — Research (no code yet)
For App #1 (LLM Cost Calculator), source:
- **Current API pricing** (USD per 1M input tokens / 1M output tokens, plus cache pricing where available) for: Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5, GPT-5, GPT-5 mini, Gemini 2.5 Pro, Gemini 2.5 Flash. Source from each provider's official pricing page, dated.
- **Local hardware benchmarks** for these models on these accelerators:
  - **Models:** Llama 3.1 8B (Q4_K_M), Qwen 2.5 7B (Q4_K_M), Mistral 7B (Q4_K_M)
  - **Hardware:** Raspberry Pi AI HAT+ with Hailo-8L (13 TOPS), Raspberry Pi AI HAT+ with Hailo-8 (26 TOPS), RTX 5060 (8GB), RTX 5060 Ti (16GB)
  - For each combo: tokens/sec (decode), watts under load, cost of the hardware (USD)
  - Source from llama.cpp / ollama community benchmarks, official Raspberry Pi/Hailo docs, gpu-benchmarks.com / TechPowerUp / similar
  - If a combo has no published number, mark it `null` and add a comment — do NOT estimate from raw specs (decision log 2026-04-19 entry 1)
- **Electricity rate defaults**: US average residential ($0.16/kWh), with note that user can override

**Deliverable:** a draft `data.ts` file content (not committed yet) with full citations as code comments. **Stop and present this to the user for review before any commit.** This is a hard gate — do not proceed to Phase 3 without explicit approval of the data.

### Phase 2 — Platform scaffold (build everything except App #1's calculator logic)

Build per `.gekro/docs/apps-platform-standard.md` §3–§10:

- Add `apps` collection to `apps/web/src/content/config.ts`
- Create `apps/web/src/content/apps/_template.md`
- Create `apps/web/src/content/apps/llm-cost-calculator.md` (frontmatter + methodology body — leave a `TODO: numbers` placeholder for the calculator output)
- Create `apps/web/src/layouts/AppLayout.astro`
- Create `apps/web/src/pages/apps/index.astro` (with search + filter UI)
- Create `apps/web/src/pages/apps/[slug].astro`
- Create all components in `apps/web/src/components/apps/`:
  - `AppCard.astro`, `AppFilters.astro`, `AppShell.astro`, `AttributionFooter.astro`
  - `shared/NumberInput.astro`, `shared/Select.astro`, `shared/Tabs.astro`, `shared/ResultCard.astro`, `shared/CopyButton.astro`, `shared/ExportButton.astro`, `shared/ResetButton.astro`
  - `shared/csv.ts`, `shared/url-state.ts`
- Add `{ label: 'Apps', href: '/apps' }` to `navItems` in `apps/web/src/components/layout/Header.astro`
- Create root `LICENSE` (MIT, copyright "2026 Rohit Burani") and root `LICENSE-CONTENT` (CC BY-NC 4.0 standard text)
- Update root `README.md` per standard §10

Run `pnpm --filter web build` to confirm the scaffold builds clean. The landing page should render with one app card showing "Coming soon" status (because the calculator island isn't built yet).

### Phase 3 — App #1: LLM Cost Calculator

After Phase 1 data is approved, build:
- `apps/web/src/components/apps/llm-cost-calculator/Calculator.astro` — the island
- `apps/web/src/components/apps/llm-cost-calculator/data.ts` — using approved Phase 1 data

Three tabs (per decision log 2026-04-19 entry 1):
1. **API cost** — pick model(s), input tokens/day, output tokens/day, cache hit rate. Output: $/day, $/month, $/year, side-by-side bar comparison if multiple models picked.
2. **Local hardware TCO** — pick model, pick hardware option(s), tokens/day, electricity rate, hardware amortization period (default 3 years). Output: $/year electricity, hardware $/year amortized, total $/year, $/1M tokens effective rate, watts.
3. **Side-by-side** — pick one cloud option + one local option, see break-even months and crossover chart.

**UX requirements (from standard §5):** sensible defaults render results immediately, live recalc, mobile-first, URL-state sync, CSV export of the comparison rows, copy result to clipboard, share-link button, reset button — all wired through `AppShell` toolbar.

**Visual:** big headline number with `text-accent`, designed to be screenshot-worthy for LinkedIn (standard §12). Side-by-side mode should produce a clear "Save $X/month" or "Break-even at month X" punchline.

After Phase 3 builds clean, run the §12 quality bar checklist and report results to user.

## Governance — non-negotiable

- **Update logs in real time.** Every architectural decision → decision log row. Every bug → issue tracker row with RCA. Match the existing prose style.
- **Commit cadence:** batch by phase. One commit for Phase 2 scaffold (with all platform files + LICENSE files + README), one commit for Phase 3 app #1. Use the existing commit message style (look at `git log --oneline -20`). Co-author trailer per CLAUDE.md.
- **Do not commit Phase 3 until user approves Phase 1 data.** This is the user's review gate — surface the data clearly and wait.
- **Do not push.** Commit only. User pushes manually.
- **Content protection (CLAUDE.md §6a):** the new `apps/web/src/content/apps/` folder is fine to write. Do NOT touch any existing `blog/` or `experiments/` markdown. Do NOT touch `.content-backup/`.
- **No new npm dependencies.** If you find yourself wanting one, stop and request Override.
- **No edits outside the file list in the standard §3** unless adding a license-related file or updating Header.astro for the nav link. Anything else needs a decision log entry first.

## Communication style

- Match the existing decision log + issue tracker prose: dense, RCA-driven, prose paragraphs not bullets.
- Be terse with the user. Don't restate the standard back at them — they wrote it.
- When you hit a Phase 1 decision (e.g., "the Hailo-8 has no published Llama 3.1 8B benchmark — should I substitute a related model or leave null?"), surface it as a single clear question, not a wall of options.
- Final report after each phase: 3–5 lines, what was done, what's next, any open questions.

## Final reminder

This is a 20+ app platform. Everything you build in Phase 2 will be reused 19+ more times. Get the shared layer right. Keep it simple. Resist the urge to abstract beyond what `.gekro/docs/apps-platform-standard.md` specifies.

**Confirm you've read the standard + governance docs, then begin Phase 1.**
