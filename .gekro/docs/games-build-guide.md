# Games build guide (Wave 10 and later)

The recipe for adding a browser game to `/apps` (category `fun`). It records what the first 24 games and their two audit rounds taught. Read it fully before writing a line. The binding list of names and design rules for each game is [games-licensing-wave-10.md](games-licensing-wave-10.md).

## 0. Who this is for

- Built for Rohit's kids to play and learn, open to everyone, free, no ads. Many Wave 10 games are for young children. Say exactly that in each page's `personalUse` (see section 9). Never invent details: no ages, no names, no "my daughter loves it".
- No account, no upload, nothing leaves the tab. The only storage is a small best-score object in localStorage.

## 1. Licensing hard rules (non-negotiable)

1. Everything is written from scratch: code, art, sounds, word lists. No copied code, no downloaded art, no sample files, no web fonts beyond what the site already loads, no `@font-face`, no `<img>`/`<audio>`/`<video>` with a `src`, no `data:` blobs, no `url(` in CSS, no `fetch`, no external URL anywhere in a game.
2. Art is CSS shapes, inline SVG built in code, Unicode characters, or emoji drawn from the visitor's own system font. Sound is Web Audio oscillators only. No melody still in copyright; traditional tunes only if the licensing doc says so.
3. Use the title and slug from the licensing doc, never a claimed mark. Never mention a rights holder's product name in page copy ("like Connect 4"), not even descriptively. Describe the rules instead.
4. Do not copy a famous game's distinctive look (layout, colours, mascots, power-up icons, level design, wording). The licensing doc lists the specific things to avoid per game.
5. Never depict a recognisable character or brand. No real currency or coin portraits: draw generic coins with the denomination.
6. Word lists are either hand-written by you or the public-domain ENABLE list already in the repo; any list a child can see is filtered for kid-safety (section 8).

## 2. What you create

In `G:\Git\gekro-apps\<slug>\` (the private repo; it is also the source copied into the public checkout for testing):

- `helpers.ts`: pure engine. No DOM, no network, no storage, no `Math.random`. Randomness comes from an `rng: () => number` argument (seeded `mulberry32` for puzzles, `crypto.getRandomValues` only at the page layer to make the seed).
- `Calculator.astro`: the page. Frontmatter comment block, markup, `<style is:global>` scoped to your root id, `<script>` that imports `./helpers` and `../../apps/shared/url-state`.

In `G:\Git\gekro\`:

- `apps/web/tests/games-<slug>.test.ts`: vitest engine tests.
- `apps/web/src/content/apps/<slug>.md`: the guide page (section 9).

Do NOT edit any other file. The orchestrator registers each game (`pages/apps/[slug].astro` import and map entry, `app-icons.ts`, `apps-seo.ts` GameApplication entry, the e2e game lists, hub copy). Do not run `astro build` or Playwright; only the orchestrator builds (two builds at once corrupt each other). You may run vitest.

Copy for testing: `cp -r /g/Git/gekro-apps/<slug> /g/Git/gekro/apps/web/src/components/apps-private/` (the `apps-private` folder is gitignored and is just a working copy), then from `G:\Git\gekro\apps\web`: `pnpm exec vitest run tests/games-<slug>.test.ts`. Edit in `gekro-apps`, re-copy, re-run.

Also run the standing rule checks on your games before you report (they enforce section 1 and parts of sections 3 and 9 automatically). Unregistered games are included through an environment variable, and `-t` narrows to your slug:

```bash
cd /g/Git/gekro/apps/web && GAMES_EXTRA=slug-one,slug-two pnpm exec vitest run tests/games-hygiene.test.ts -t "slug-one|slug-two"
```

Fix every failure; do not edit `games-hygiene.test.ts` (tell the orchestrator if a rule seems wrong).

## 3. Calculator.astro conventions (all learned the hard way)

- One root id with a 2 to 3 letter prefix, e.g. `#fl-app`. Every other id and class uses the prefix. `container-type: inline-size` on the root, container queries for layout.
- Idempotent init: `if (!app || (app as any)._flInit) return; (app as any)._flInit = true;`, run once at load and again on `astro:after-swap`.
- ONE `AbortController` for every document/window listener, aborted on `astro:before-swap` (once), which also stops timers, animation frames and audio.
- Toolbar events from the shell, all three wired: `app:copy` copies a share line (game name, result, link), `app:export` only says "Nothing to download for a game. Use Copy to share your result.", `app:reset` restarts.
- Pause everything on `document.hidden` (timers, rAF loops, audio) and resume only if the player was mid-game. Honour `prefers-reduced-motion`: no entrance, shake, or looping motion.
- Never rely on inline `style=` for layout (the shell animation once wiped it). Set CSS variables with `el.style.setProperty` only for sizes, or use `data-*` attributes plus CSS. The shell clears only opacity/transform props now, but keep the habit.
- Text rendering: `textContent` only, from numbers and fixed strings. Never `innerHTML` with anything dynamic. No user text is ever rendered back as HTML.
- Keyboard: arrow keys move, Enter or Space acts, one roving tab stop for boards (`tabindex` 0 on one cell, -1 on the rest). Never `preventDefault` a key that has Ctrl, Meta or Alt held. Only claim keys while focus is inside the game or the game is actively running; a paused or finished game must not trap page-wide arrows or Space. Handle `e.repeat` for Space/P toggles.
- Screen readers: one `aria-live="polite"` status line that says what just happened ("Row 2, column 3 flipped. 4 left."), `aria-label` on every cell with its state, `role="grid"`/`row`/`gridcell` where a grid, `aria-describedby` to a help line. A board is `inert` when the game is over, and `inert` is removed ONLY in new game.
- Colour never carries meaning alone: each colour also has a shape, letter, number or pattern (a legend shows the key).
- Touch targets: 44 px or more for children's games and anything frequent, never below 28 px anywhere. `<details><summary>` "How it works" at the foot with `min-height: 2rem; padding-block: .375rem; box-sizing: border-box;` and the native marker.
- Every number is bounded: URL params parsed with `Number.isInteger` and range checks, `readState` defaults, stored scores validated (typeof number, integer, caps) and sanitised into a fresh object, never spread from parsed JSON.
- Storage key `gk:game:<slug>`, JSON object of small numbers, read and written in try/catch, page renders fine with storage blocked.
- Computer players: a hard time budget (design cap 1 s) with a node or depth limit; test the worst case.
- Start with a meaningful first paint (a ready board, defaults chosen), a visible "New game" and "Restart", and a clear win/finish message with a Copy button where there is a result.

## 4. Colour (this is a Wave 10 requirement)

Games should look lively. The site palette is locked, so colour is built only from the four accent tokens, mixed in OKLCH (mixing in sRGB goes muddy). Put exactly this block at the top of the game's `<style is:global>`, replacing `#xx-app`:

```css
#xx-app {
  --g-sky: var(--color-accent);
  --g-teal: color-mix(in oklch, var(--color-accent) 50%, var(--color-accent-success));
  --g-green: var(--color-accent-success);
  --g-lime: color-mix(in oklch, var(--color-accent-success) 50%, var(--color-accent-warm));
  --g-amber: var(--color-accent-warm);
  --g-orange: color-mix(in oklch, var(--color-accent-warm) 50%, var(--color-accent-danger));
  --g-rose: var(--color-accent-danger);
  --g-violet: color-mix(in oklch, var(--color-accent) 50%, var(--color-accent-danger));
}
```

Rules:
- Never a hex or rgb literal, never a named colour (guarded by a test). Tints: `color-mix(in srgb, var(--g-sky) 22%, var(--color-bg-elevated))`. Text on a saturated fill uses `var(--color-bg-base)` (dark); all text must keep 4.5:1.
- The hygiene test rejects literal colour words (`green`, `teal`, `orange` and so on) inside a `background`, `border`, `fill`, `stroke`, `outline` or shadow value. `var(--g-green)` token references are fine (the test strips `var(...)` before checking); per-game alias variables are allowed but not required.
- Ink on a saturated fill: the accents stay bright in the light theme but `--color-bg-base` turns near-white there. Define a per-game ink variable that is `var(--color-bg-base)` by default and `var(--color-text-primary)` under `.theme-light`, and use it for text on coloured fills.
- A game with several colours uses at most six at a time: sky, green, amber, rose, violet, orange are the clearest; use teal and lime only when you need seven or eight, and always pair them with a distinct shape or letter.
- Give each game a colour personality (board squares, pieces, win flash, header chips), not just the accent. Use gradients, soft shadows, rounded shapes and a small celebratory animation on a win (CSS only, off under reduced motion, never more than 3 flashes a second).
- Dark background stays; do not invent surfaces. Use `.app-card`, `.app-btn-primary`, `.app-btn-secondary`, `.app-btn-tab`, `.app-input` as the rest of the site does.

## 5. Children's games (extra rules)

- Big, forgiving, friendly: targets 56 px or more, no fail screens, no timers that punish (a timer may exist but a game never ends because time ran out unless it is clearly an arcade game), "Try again" wording, praise that is specific ("You found all 6 triangles"), not "Wrong".
- Little reading: short words, large type, icons and numbers do the work. Read-aloud is out of scope (no speech synthesis).
- Sound is OFF by default with an obvious mute/sound button (kids and shared rooms); quiet volume (peak gain at most 0.15), short sounds.
- No external links inside a game, nothing to buy, nothing that asks for a name or text to be sent anywhere, no free-text input that is displayed back unless it is a game word typed on the keyboard.
- No flashing faster than 3 times a second; no sudden loud sounds; nothing scary.
- Difficulty levels in plain words (Easy, Medium, Hard, or Little, Middle, Big), progressive and automatic where it helps ("you got 5 in a row, try bigger numbers" as an offer, not a forced jump).
- Never scold, never compare to other players, no leaderboards.

## 6. Engine tests (`tests/games-<slug>.test.ts`)

- Header comment listing what is pinned.
- Rules checked against an INDEPENDENT oracle where one exists (brute force, a second simple implementation, known perft counts for chess, solvability by exhaustive search for small puzzles). Never test the engine against itself.
- Invariants: every generated puzzle is solvable and (where promised) has a unique solution; moves are legal; undo is an exact round trip; the same seed gives the same game; the sanitisers reject junk (NaN, negatives, huge numbers, strings, `__proto__`, arrays).
- Fuzz: a few thousand random legal sequences never throw and never break an invariant.
- Performance bounds are GENEROUS (machine load makes tight wall-clock asserts flake): give slow tests an explicit timeout argument (`it(name, fn, 30_000)`).
- Everything the guide page claims must be provable by a test or by reading the code. Pin the numbers the page states.

## 7. Known traps from the two audit rounds

- Shared shell: the entrance animation staggers every button; boards with hundreds of buttons are now capped at 0.6 s total, but still never hide your board behind your own animation, and never start a loop before the shell finishes (wait for the island to be visible or start on first input).
- Disabled controls: if a mode makes a menu irrelevant (e.g. a two-player game), disable it, and do not wipe the game when the user touches it.
- Reset, share, undo and hint must all work in every state (finished, empty, mid-animation). Undo after a finished game stays blocked. Hints and solutions mark the score as aided.
- Double-handled input: pointer and click both firing, key repeat, a touch followed by a synthetic mouse event. Use one path (`pointerdown`/`click`) and guard `e.repeat`.
- Timers: store the handle, clear on swap, hidden tab, finish, restart. Use `performance.now()` deltas for rAF games, clamp dt to 50 ms.
- Resizing: boards use `aspect-ratio` and container queries, never a fixed pixel size; check 320 px width (no sideways scroll) and 1280 px.
- Canvas games: size the canvas to its CSS box times `devicePixelRatio` (capped at 2), redraw on resize, read colours with `getComputedStyle` at draw time (canvas cannot resolve CSS variables; mix with `color-mix` strings that canvas accepts or compute at runtime), and provide a non-visual status line.
- Copy text must be correct in every state (unfinished game, aided game, zero score).
- Plurals ("1 move", "2 moves"), singular/plural in aria labels too.

## 8. Word lists

- Hand-written lists are fine and licence-free. Make them kid-safe by construction.
- ENABLE (public domain) is already in `gekro-apps/word-guess/enable5.ts` for five-letter words only. A game that needs a bigger validity dictionary may load a trimmed ENABLE subset, but never DISPLAY a word the player did not type unless it is on a hand-curated common-word list, and reject or hide words on a profanity/slur blocklist you maintain in the game's own `helpers.ts`. A child must never be shown a rude word.

## 9. The guide page (`content/apps/<slug>.md`)

Frontmatter exactly like `light-grid.md`:

```yaml
---
title: "Short Title"
category: "fun"
job: "One sentence, what a visitor can do. Starts with a verb like 'Play'."
description: "Meta description under 160 characters, plain, no hype, ends 'No signup.'"
aiSummary: "A factual paragraph: rules, how the engine works, numbers the tests prove."
personalUse: "I built this for my kids to play and learn, and anyone is welcome to use it, with no ads. <one honest sentence about what is interesting or useful in the game, no invented detail>"
status: "active"
publishedAt: "2026-11-05"
lastVerified: "2026-11-05"
license: "MIT"
icon: "<one emoji>"
---
```

Body: `## How to play` (rules, controls including keyboard, how colour and shape stand for things, accessibility notes), `## How it works` (the real engine: algorithm, numbers a test checks), optionally a table of verified figures. 500 to 1100 words. Plain sentences, first person only where Rohit would say it and only about what the code does ("I wrote the solver so...") never about his family or his life.

Hard writing rules: no em-dash (use a hyphen), no AI vocabulary (delve, landscape, tapestry, seamless, robust, leverage), no hype, no claims about other sites or rights holders, no claim the tests do not prove, never say "files you can read" (the code is private), never name another game or its maker.

## 10. Report back

When finished, reply with: files created (paths), test command and its result (pass count), the claims you pinned, anything you could not finish or are unsure of, and every place a reviewer should look hardest. Do not claim a page works in a browser: you did not run one.
