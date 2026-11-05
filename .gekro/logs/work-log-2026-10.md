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
| 8 | Commit + ship | SHIPPED 2026-10-02 | gekro-apps#1 merged (17aa1b2), then gekro#58 merged (9a61f03). Main CI, E2E (apps smoke) and Cloudflare Pages all green; live checks: /apps/ambigram-maker/, /apps/category/ai/, renamed titles, Related tools all 200 on gekro.com. |
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

- 2026-10-02: SHIPPED. Everything from this push is live. Open for Rohit only: pick apps from the awesome-llm-apps shortlist; optional GB to GiB wording pass in guide bodies; optional `cross sync content backup` to refresh .content-backup/ with the 40 renamed/re-dated app md files.

## 2026-10-07 to 2026-10-15 - multilingual blog, app #94

**Shipped and live**
- Multilingual blog: 8 languages (`hi bn mr te ta zh es ar`) x 16 posts = 128 machine translations under `src/translations/`, routes `/blog/<lang>/<slug>/`, hreflang in `<head>` and the sitemap, per-script fonts and RTL, `verify-i18n` as a postbuild gate. Contract: `.gekro/docs/i18n-standard.md`. Commits 5e61afc, c330a53.
- One independent AI proofread per language fixed real errors (wrong-sense words, garbled clauses, invented "ask in <language>" claims, a gendered "kid"). Still `reviewed: false`: no native speaker has read them.
- Discovery: "Also in" strip on `/blog/`, "Read in" strip on each language archive, translated archives in `/llms.txt`. Sitemap lastmod no longer falls back to file mtime for BOM/CRLF posts.
- `passport-photo-maker` (app #94, category dev): free client-side passport photo editor, 11 official standards + custom, print sheet JPG/PDF. No upload, no retention, no limit. Private code `gekro-apps@f5eb8f4`, public `af4d235`. Standards verified from official pages 2026-10-15.
- Cleanup: unslop skill tracked, `.ai/` ignored, scaffold files removed (2971f35); `ambigram-maker` aria-pressed type errors fixed (`gekro-apps@b775137`).

**Withdrawn by Rohit, not built:** 6-7 new /apps categories + dropdown menu.

**Open for Rohit**
- A native-speaker read of the translations and of the UI strings in `lib/i18n.ts`.
- 48 translated titles are over the per-script length limit (cosmetic; search results truncate them).
- `blog-drafts/2026-10-06-translating-the-blog-locally.md` plan is out of date (translations were written in-session, not by the local service).
- English source typo: `sonic-phoenix` says "six iterations" for scripts 04A to 04I (nine). Protected article, so untouched.
- Passport standards re-check about every six months (`LAST_VERIFIED` in `apps-private/passport-photo-maker/data.ts`).

## 2026-10-22 to 2026-10-23 - browser games batch (Wave 9) - LOCAL ONLY, NOT COMMITTED

Rohit's order: build licence-free browser games under `/apps` (category `fun`) for more attention, "do not commit and push until I tell you". Nothing below is committed or pushed in either repo. Everything is working-tree changes in `G:\Git\gekro` plus new untracked folders in `G:\Git\gekro-apps`.

**Status: 24 games, all registered, built and verified.** First wave: sudoku, merge-tiles, snake, tic-tac-toe, four-in-a-row, match-pairs, mines, hangman, solitaire. Extras: sliding-puzzle, light-grid, tower-of-hanoi, reversi, reaction-time, peg-solitaire, checkers, dots-and-boxes, gomoku, typing-test, aim-trainer, nonogram, code-breaker, nim, word-guess (added 2026-10-25 after Rohit approved the ENABLE word-list download; accepted guesses are the 8,636 five-letter ENABLE words, answers a curated list of 1,295). The /apps count goes from 94 to 118.

**How each one is guarded:** every game has its own `tests/games-<slug>.test.ts` (engine tests; perft counts for Reversi and Checkers, exhaustive 3x3 state-space for Sliding Puzzle, solver-vs-brute-force for Light Grid, optimal-play proofs for Tower of Hanoi and Tic Tac Toe) plus the generic e2e suites (smoke, a11y, output-sanity, interactions) which pick up every slug automatically, plus `e2e/apps.games.spec.ts` (no off-device requests, layout guard, and real play-throughs: Unbeatable Tic Tac Toe never loses, Hanoi auto-solve is exactly 2^n-1 moves, Light Grid's shown solution clears the board, sliding puzzle solved by hints, and one move-and-reply check for each of the other games).

**Verification run (final pass 2026-10-23 01:25 CDT, 23 games):** vitest 1703/1703 (31 files), `astro check` 0 errors, production build clean (verify-i18n 0 errors), Playwright 159 checks on the game slugs (smoke, a11y, output-sanity, interactions, plus `e2e/apps.games.spec.ts`) and 23 random-input stress runs (`e2e/apps.games-monkey.spec.ts`, 250 clicks, keys and select changes each, no errors). Screenshots at 375 px and 1280 px reviewed for every game. Three independent read-only reviewers then fact-checked every content page against its code and tests; roughly 60 overstatements and unverifiable claims were corrected (examples: claims about what other sites do, "files you can read" for private code, "always"/"guaranteed" beyond what a test proves, a Knuth year and average the repo could not confirm).

**Real bug found by looking, not by the suites:** Match Pairs collapsed into one tall column after load. Root cause was a shared-shell issue (`AppShell.astro` `clearProps: "all"` wiping inline CSS variables), fixed in the shell and guarded by a new test. Logged in issue-tracker and decision-log 2026-10-23.

**Shell and site changes (also uncommitted):**
- `AppShell.astro`: entrance tween clears only what it sets.
- `lib/utils/apps-seo.ts`: `fun` hub title "Free Browser Games & Fun Tools, No Ads | gekro", description and intro rewritten; every game gets `GameApplication` in `SCHEMA_CATEGORY_OVERRIDE`.
- `tests/apps-seo.test.ts`: `GameApplication` allowed.
- `pages/apps/[slug].astro` and `components/apps/app-icons.ts`: imports, `CALCULATOR_MAP` entries, icons for each game.
- Content: one markdown file per game in `src/content/apps/` (all new, none edit existing articles).

**Names and licensing:** names are generic and original (Merge Tiles not 2048, Four in a Row not Connect 4, Match Pairs not Memory, Mines not Minesweeper, Light Grid not Lights Out, Reversi not Othello, Code Breaker not Mastermind, Nonogram not Picross). "Klondike" is used on the Solitaire page as the traditional name of the variant. The number 2048 appears on Merge Tiles as the tile you reach, not as a product name. All art is plain CSS. Rules and mechanics are not copyrightable; this is not legal advice and the earlier licensing report with sources is in the session transcript.

**Open for Rohit**
1. Say when to commit and push. It needs two commits/PRs: `gekro-apps` first (23 new folders), then `gekro` (content, tests, registration, shell fix). CI and Cloudflare clone the private repo at build time, so the private repo must be pushed first or the public build fails on missing imports.
2. The five-letter word game is still blocked on your OK to download the public-domain ENABLE word list.
3. Pick which extras to keep if you want fewer games; each is independent (delete its folder, content md, test, import, map entry, icon line, schema override).
4. `CLAUDE.md` still says 94 apps (and 94 Calculators); update to 117 in the same commit when you approve the ship.
5. Nobody has played these on a real phone or with a screen reader; automated suites and screenshots only.
6. Best scores use localStorage (plain numbers only, `gk:game:<slug>`); this is a decision logged 2026-10-22.
7. Timing-sensitive games (Reaction Time, Aim Trainer, Typing Test, Snake) are verified for logic and errors, not for how they feel on a real phone.
8. The e2e suites run against `astro preview`; the dev server shows a harmless dev-toolbar 504 and cannot be used for them.
9. Dropping any game later is cheap (see item 3); dropping the shell fix is not advised, it protects every app.

**2026-10-25 - Rohit said ship all.** Audience wording: the games are for his kids to play and learn, others welcome, ad-free; every game page and the Fun hub intro now say exactly that. Last full run before shipping: vitest 1823/1823, astro check 0 errors, build clean, Playwright 190/190 on the 24 game slugs including the random-input stress run. Bug caught by screenshot on the last game: in Word Guess, pressing Enter after clicking a mode button pressed that button again (restarting the word) instead of submitting the guess; fixed by releasing focus after a mouse press, regression test added.

**2026-10-29 - Post-ship audit and fixes.** Rohit asked for the most thorough check of everything. Branches: all three local feature branches and their remote copies were already merged; six open Dependabot PRs (#45, #46, #52, #55, #60, #61) are not part of this work. Checks on main: vitest 1823/1823, astro check 0 errors, build clean (internal links and i18n verifier pass), Playwright 968 passed / 1 skipped across every spec. Four independent reviewers then read all 24 games, their pages and tests (about 21,000 lines). No rules or search errors in any engine. Fixed (branch `fix/games-audit-2026-10` in both repos): Peg Solitaire French board (best possible is 2 pegs; parity test; hint now aims for it), Code Breaker replay scoring and solver step time (budget 450k, worst measured 74 ms), Mines roving tab stop and stored-time validation, Solitaire stock announcement and stale-drag drop, Sudoku/Sliding/Light Grid modifier keys, Sudoku hint clears notes (undoable), daily date fixed at load, Hanoi/Light Grid/Sliding move announcements, Reversi pass announcement, Reversi/Checkers board inert under the game-over overlay, focus after Play again in five games, Four in a Row undo now excluded from streak/best like its siblings, Reversi/Checkers side names Solid/Ring (they are drawn blue/amber), Word Guess Enter on a details summary, Typing Test sentence repeats and the over-500-WPM notice, no Math.random anywhere in the games, hangman/snake key scope, layout via data attributes instead of inline style (Mines, Match Pairs, Solitaire), stored-score validation across the games, many page-copy claims corrected. Shared shell: AppShell entrance stagger capped at 0.6 s total. Left alone on purpose: touch-target sizes on dense boards (Gomoku 15x15, Nonogram 15x15, Solitaire runs) need a real phone to judge; Word Guess multi-tab stats; Nonogram fast-drag gaps.

**2026-11-02 - Second audit round.** Four fresh reviewers re-read the round-one fix diffs plus Copy/Download output, share links, old stored data, View Transition re-init and AI worst-case timing; a fifth ran real Chromium probes over all 24 games (touch sizes at 320/375, overflow at five widths, light and dark contrast, reduced motion, 41 client navigations, 40-Tab keyboard runs, console, page weight). Result: no regressions from round one; fixed what they found (see issue-tracker 2026-11-02). Measured and clean: no sideways scroll at any width, no focus traps, zero net listener growth across navigation, no console errors, AI worst case 607 ms (Checkers Hard, design cap 1 s). Not fixed, by decision: no light theme on /apps (site-wide), touch sizes of 28-31 px on dense boards (Nonogram 10x10, Code Breaker pegs now 36 px, Dots and Boxes lines), shell sidebar DOM weight. Shared-shell changes: AppShell entrance skipped under reduced motion; BaseLayout fade skipped when a page has no <main>. Unit tests 2015, astro check 0 errors, new browser regression spec 10/10.

## 2026-11-05 - Wave 10: 55 new games, colour pass, licensing screen (branch feature/games-wave-10, not committed)

- Rohit: build every game from the list, add colour, add children-friendly games for his children, make sure there is no licensing trouble. Three research passes produced `.gekro/docs/games-licensing-wave-10.md`; six names changed before code (colour-tubes, maze-dash, island-bridges, sum-grid, critter-pop, pig-dice); block-stacker is HELD (needs Rohit's literal Override; decision 2026-10-22 excluded Tetris and research advises against it).
- Docs: `.gekro/docs/games-build-guide.md` (conventions, palette, children's rules, tests, page format), `games-wave-10-specs.md` (per-game specs), `games-licensing-wave-10.md`.
- Built by 15 parallel builders: puzzles (colour-flood, binary-puzzle, sum-grid, inequality-grid, colour-tubes, pipe-connect, traffic-jam, crate-pusher, loop-puzzle, island-bridges, maze-dash, word-search, letter-grid), learning (times-tables, clock-reader, coin-counter, colour-clash, morse-tutor), board and card (mancala, hex, nine-mens-morris, fox-and-geese, chess, go-fish, crazy-eights, card-war, dominoes, snakes-and-ladders, pig-dice), arcade (brick-smasher, pattern-echo, critter-pop, wing-hop, road-hopper, soft-landing, cannon-shot, bubble-pop), sandbox (falling-sand, cell-garden, pixel-art, drum-pad, piano, colour-mixer), early learning (counting-garden, shape-sorter, make-ten, spelling-builder, pattern-maker, odd-one-out, sort-it, dot-to-dot, colouring-book, picture-puzzle, balloon-maths, letter-tracer). 79 games in total.
- Open for Rohit: children's privacy (keep GTM and GA off game pages, decision 2026-03-30 area); name the number of children on the pages; optional rename of Four in a Row; block-stacker Override; merge gekro-apps#3 then gekro#63 first.
- Integration bugs found only in a real browser (guards added): root-id prefix collisions (22 renames, test `games-hygiene` now fails on a duplicate prefix or `@keyframes` name), Tailwind not scanning the gitignored games folder (`sr-only` and five `min-h-[...]` utilities added to global.css), `<use>` of a 0x0 svg painting nothing, TypeScript generics inside Astro template expressions breaking the bundler, auto grid tracks letting a wide child overflow a stage (fix: `grid-template-columns: minmax(0, 1fr)`).
- Review round 1 (15 independent browser reviewers, 79 games, dark and light themes at 320, 375, 768, 1280 px, no code edited by them): about 140 findings, none in the rules engines; all page-layer. Recurring classes: focus falling to body when a focused button hides its own panel (about 25 places), light theme text on saturated fills using `--color-bg-base` (needs a per-game ink variable), key repeat on Enter re-firing a Roll or Select, status text overwritten by "thinking", false claims on guide pages (Soft Landing slide-off, Road Hopper streams, Sudoku nine tints, Word Search clean filler), plural helper typos ("guesss", "presss", "pushs").
- Shared bugs fixed on the way: `apps/shared/url-state.ts` replaced `history.state` with null so Back showed the wrong page after client-side navigation in every app that writes URL state (now keeps the router's state); `.app-btn-tab` and secondary-button text under `.theme-light` was 1.9 to 2.3:1.
- Content-safety fixes: Word Search filler could spell crude words (blocklist 40 to 180 strings, tested over 3,150 grids in 8 directions); Letter Grid accepted and displayed crude or scary words (blocklist and child-facing list cleaned, 592 ordinary words added); Spelling Builder status line gave the answer away (now a hidden live region).
- Fix round 1 done by 13 fix agents plus the lead, then unit tests 88 files and 5,978 tests all pass, production rebuilt once (build7).

