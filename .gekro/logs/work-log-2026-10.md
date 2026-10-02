# Work log - October 2026 multi-session push

Running checklist so any session (Claude Code, Gemini CLI) can resume mid-stream.
Update the status column the moment a step finishes. Newest notes at the bottom.

## Standing requests from Rohit (2026-09 to 2026-10-02)

1. Review every app top to bottom (logic, appearance, usefulness), fix all bugs, make the site user friendly and SEO optimised.
2. App-name evaluation: simple popular names over mechanical ones. Renames need edits to `apps/web/src/content/apps/*.md`, which Content Protection blocks without a per-file instruction, so they stay a proposal.
3. NEW 2026-10-02: build an **ambigram maker** app (logged in apps-parking-lot.md as W7-1).
4. NEW 2026-10-02: mine https://github.com/shubhamsaboo/awesome-llm-apps for apps, content and site enhancements; implement what fits; report back.
5. Keep going until done; parallelise with agents; log as you go.

## Checklist

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Per-app review batches 1-29 + 31 (90 apps) | done | patched in gekro-apps + mirrored into apps-private/, uncommitted |
| 2 | Batch 30: graphing-calculator + html-viewer | done | token palette, opaque PNG export, range sync, keyboard divider |
| 3 | Ambigram maker app | done, verified 2026-10-02 | agent built engine (data.ts, helpers.ts, Calculator.astro) + md + map entry, then hit a rate limit; main session verified flip, art-click flip, two-word preset, sources view, sharp style, URL state, 375px layout (no overflow), no app console errors; vitest 164/164. Category `fun`. |
| 4 | awesome-llm-apps research | report DONE, saved to `.gekro/docs/awesome-llm-apps-review-2026-10.md` | No code is liftable (all need servers + keys). 12-app client-only shortlist, content ideas, 9 site enhancements, licensing notes. Next: report to Rohit, log any approved apps in parking lot first, then build. Enhancement 2 (category intros) already done. |
| 5 | Verification: astro check, vitest, e2e, build, Playwright audit | build DONE (clean, 7 hubs, pagefind, link guard OK); full e2e 371/372, the 1 failure (compose visualizer [object Object]) fixed in batch 34 and re-verified 4/4 against a rebuild | astro check 0 errors after fixing punctuation-fixer SAMPLE (literal newline in a string); vitest 150/150 + 13 new |
| 6 | Cross-cutting SEO/UX (related apps, FAQ JSON-LD, dateModified, apps index meta, a11y e2e guard) | in progress | done: lib/utils/apps-seo.ts, Related tools block, category hubs /apps/category/[cat]/, schema dateModified + applicationCategory, CTR titles, index hub links, AppShell kicker link. FAQ JSON-LD skipped (no question headings in app md; Google limits FAQ rich results). a11y guard DONE (e2e/apps.a11y.spec.ts: 92/92 after batch 32 fixes, last fix csv-to-json output label applied but not re-run). GiB pass DONE (batch 33). Hubs + Related tools visually verified. |
| 7 | Governance rows (decision-log, issue-tracker) + memory updates | done | 11 decisions + 9 issues appended; memory llm_pricing_canon.md; ambigram moved to shipped in both backlogs; CLAUDE.md counts refreshed; rename + lastVerified proposal in `.gekro/docs/app-rename-proposal-2026-10.md` |
| 8 | Commit + ship | PRs open, awaiting Rohit's merge | `.claude/settings.local.json` denies pushing to main (by design), so work went to `feature/apps-review-2026-10` in both repos: drajb/gekro-apps#1 and drajb/gekro#58. **Merge gekro-apps#1 FIRST**, then gekro#58 (CI + CF Pages clone gekro-apps main; #58's CF preview fails until #1 lands because `ambigram-maker` is missing there). Main's own CF deploy is healthy (PAT valid). |
| 9 | Final report incl. rename proposal | done 2026-10-02 | Open items for Rohit: merge order above; approve renames + lastVerified bumps (`.gekro/docs/app-rename-proposal-2026-10.md`); pick apps from the awesome-llm-apps shortlist. Local checkouts are on the feature branches. |

## Notes

- 2026-10-02: scratchpad patch scripts (patchlib.py, batch30.py, audit.cjs) were lost between sessions. patchlib.py recreated. Lesson: anything needed across sessions belongs in the repo or this log, not the scratchpad.

- 2026-10-02 (session end, usage limit): state at hand-off below.

## Hand-off state (2026-10-02)

**Uncommitted work, both repos.** Nothing from this whole review is committed yet.
- `G:/Git/gekro-apps`: ~90 Calculator.astro files patched (batches 1-32) + `llm-cost-calculator/data.ts`. Every file is mirrored byte-for-byte into `G:/Git/gekro/apps/web/src/components/apps-private/<slug>/` (gitignored, local only).
- `G:/Git/gekro` modified: `styles/global.css`, `components/apps/shared/ExportButton.astro`, `content/data/reasoning-models.json`, `layouts/AppLayout.astro`, `components/apps/AppShell.astro`, `pages/apps/index.astro`. New: `lib/utils/apps-seo.ts`, `pages/apps/category/[category].astro`, `tests/apps-seo.test.ts`, `e2e/apps.a11y.spec.ts`, this log. Parking lot has the W7-1 ambigram entry. Pre-existing untracked files NOT ours (leave alone unless Rohit says): `.ai/`, `.claude/skills/`, `STARTER-PROMPT.md`, `VERIFY.md`, `content/stack/runpod.md`.

**Verified so far:** `astro check` 0 errors / 0 warnings; vitest 150/150 + apps-seo 13/13; a11y spec 91/92 then the last finding fixed. NOT yet run: `pnpm build` (+ pagefind + internal-link check), smoke / interactions / output-sanity e2e against the build, visual check of the new Related tools block and category hubs.

**Resume order:**
1. Read the two agent results if this session still has them; otherwise redo per rows 3 and 4.
2. GiB labelling pass (row 6 remainder).
3. `pnpm --filter web build`, then `pnpm --filter web exec playwright test` (all four specs, preview on :4457). Fix regressions.
4. Screenshot-check: one app page (Related tools + kicker link), `/apps/category/ai/`, `/apps/` (Browse by collection).
5. Governance rows: decision-log (category hubs + title template + related-apps ranking; FAQ JSON-LD skipped and why; GiB memory labels; token-driven canvas colours; a11y spec as a CI guard; price refresh 2026-09-11 with sources; model-benchmark roster policy; reasoning-models.json refresh) and issue-tracker (punctuation-fixer SAMPLE literal newline broke typecheck; em-dash sweep had broken the em-dash rule; json-schema-to-tool unconditional strict; llm-api-builder stale Claude API shapes; unix-timestamp export listener without abort signal; websocket-tester logged auth tokens; word-counter undefined colour token; nginx redirect ignored SSL; systemd oneshot + Restart=always; graphing-calculator off-palette colours + transparent PNG export; scratchpad loss between sessions).
6. Memory: update pricing/model canon (Sonnet 5 $2/$10, Fable 5.1 $10/$50, Opus 5 $5/$25, GPT-5.6 Sol/Terra/Luna, Gemini 3.7 Flash), remove ambigram from app_ideas_backlog.md + apps-parking-lot.md once shipped.
7. Commit gekro-apps first (push), then gekro (push), watch CI + Cloudflare Pages deploy.
8. Final report to Rohit: what changed, the awesome-llm-apps findings + what was implemented, and the app-rename proposal (renames need his per-file OK because of Content Protection).

**Patch helper** (scratchpad gets wiped; recreate as `patchlib.py`): `load(slug)` reads `G:/Git/gekro-apps/<slug>/Calculator.astro` with newline=''; `rep(s, old, new, slug, count=1)` normalises `
` to the file's newline and asserts the exact match count; `save(slug, s)` writes both gekro-apps and the apps-private mirror. Write patch scripts with the Write tool, not bash heredocs (quoting broke twice), and use `chr(92)` for literal backslashes.

## Ambigram spec (for a resumed build)
Rotational ambigram from typed text (Word A, optional Word B). Each slot glyph = union(strokes(A[i]), rotate180(strokes(B[n-1-i]))) on a segment-font grid; per-slot legibility score = stroke overlap; optimiser picks upper/lower/alternate forms per slot; small hand-tuned overrides. UI: case mode, stroke weight, spacing, sharp/rounded, token colour; Flip button (CSS 180 deg, reduced-motion instant); per-slot score table; SVG/PNG download, copy SVG; presets; first paint renders a sample. AppShell contract (init guard, after-swap, one AbortController, app:copy/reset/export), tokens only, labelled + clamped inputs, no em-dashes, 375px safe. Register in `pages/apps/[slug].astro`, add `content/apps/ambigram-maker.md` from `_template.md`.

- 2026-10-02: Rohit approved renames + lastVerified bumps and asked to push everything to main. Applied 32 titles + 13 dates (40 md files); vitest 164/164; build clean; titles, dateModified and sitemap lastmod verified in dist. Shipping via PR merges (gekro-apps#1 first, then gekro#58).
