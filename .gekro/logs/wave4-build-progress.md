# Wave 4 Build + Clock Fix — Live Progress Checkpoint

**Session goal (Rohit, 2026-07-05, full authority granted):**
1. Fix `global-clock`: simplify analog hands (too complicated), make aesthetic; make **4 LARGE featured clocks = Chicago, Mumbai, Santiago, London**; everything else stays as smaller blocks.
2. Build all 6 Wave 4 apps per `.gekro/docs/apps-blueprint-wave4.md`.
3. Test thoroughly (build + vitest 80/80 + Playwright e2e must stay green, grows +2 per app), formatting correct.
4. Push straight to prod (both repos). Batched commits.

**Durable checkpoint = git commits.** Each unit committed to BOTH repos (gekro-apps private @ G:/Git/gekro-apps, gekro public @ G:/Git/gekro). Local build/test uses the clone at `apps/web/src/components/apps-private/` — create/edit there, `cp` to G:/Git/gekro-apps, commit+push both.

## Dual-repo recipe per app
1. Write `apps-private/{slug}/Calculator.astro` (local, for build/test).
2. Write `apps/web/src/content/apps/{slug}.md` (public).
3. Add import + CALCULATOR_MAP entry in `apps/web/src/pages/apps/[slug].astro` (public).
4. Build (`pnpm --filter web build`), vitest (`pnpm --filter web test`), e2e (`pnpm --filter web test:e2e`).
5. `cp` Calculator.astro to `/g/Git/gekro-apps/{slug}/Calculator.astro`, commit+push gekro-apps.
6. Commit+push gekro public (content + [slug].astro + progress file).
7. Remove shipped item from parking-lot + memory backlog (locked rule).

## Platform contract (enforced by tests)
- idempotency guard `_xxInit`; re-init on `astro:after-swap`; 3 AppShell events (`app:copy/reset/export`) via ONE AbortController aborted on `astro:before-swap`.
- meaningful result on first paint (sensible defaults / prefilled sample); live recalc; mobile-first; design tokens only.
- CLAMP every numeric input (min+max); no unbounded O(n^2); ESCAPE every user string before innerHTML incl. title attrs; guard nullable blob/File returns; Number.isFinite where 0 is legal; one number = one convention.
- category `ai` for all 6; content frontmatter needs: title, slug, category, job, description, aiSummary?, personalUse, status, publishedAt, lastVerified?, companionPostSlug?, license, icon.

## STATUS

### Clock fix
- [x] global-clock: 4 large (Chicago, Mumbai, Santiago, London) + simple hands — DONE, shipped milestone A

### Wave 4 apps (build order: 1,3 → 2,6 → 4,5)
- [x] W4-1 `llm-json-repair` (zero-dep) — DONE + tested, shipped milestone A
- [x] W4-3 `llm-api-builder` (zero-dep; NO api-key input) — DONE + tested, shipped milestone A
- [ ] W4-2 `embedding-playground` (transformers.js CDN; add e2e allowlist)
- [ ] W4-6 `gguf-inspector` (File.slice + DataView; BigInt-safe)
- [ ] W4-4 `finetune-dataset-auditor` (stream-parse, 50MB cap)
- [ ] W4-5 `rate-limit-planner` (curated tier data, lastVerified)

### Final
- [ ] Update parking-lot + memory backlog (remove shipped)
- [ ] Final full e2e green, both repos pushed

_Update the STATUS checkboxes + commit this file as each unit completes._
