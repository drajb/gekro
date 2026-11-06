# Games review checklist

What an independent reviewer does to a browser game. It comes from two audit rounds on the first 24 games (60+ page-level defects, none in the engines) and the Wave 10 integration (prefix collisions, a missing `sr-only`, a `<use>` that painted nothing, template generics that only the real bundler rejects). Engines are tested by unit tests and are usually right. The bugs live in the page: DOM, focus, events, timers, layout, the shared shell and the build.

## Setup

- A production build is served at http://localhost:4457 (do NOT start, stop or restart servers, do NOT run builds). Games are at `/apps/<slug>/`.
- Playwright is installed in `G:\Git\gekro\apps\web`. Write your scripts there as `_rev_<yourname>_<n>.mjs` (so `import { chromium } from '@playwright/test'` resolves), run with `node`, and DELETE them when you finish. Use the Write tool to create script files: shell heredocs mangle backslashes and non-ASCII.
- Wait about 2.5 s after load before measuring: the shell staggers an entrance animation over the buttons.
- Sources: `G:\Git\gekro-apps\<slug>\Calculator.astro` and `helpers.ts`; tests `G:\Git\gekro\apps\web\tests\games-<slug>.test.ts`; guide page `G:\Git\gekro\apps\web\src\content\apps\<slug>.md`; spec `G:\Git\gekro\.gekro\docs\games-wave-10-specs.md`; rules `games-build-guide.md` and `games-licensing-wave-10.md` in the same folder.
- You find problems and report them. You do NOT edit any repository file.

## What to check, for every game

1. **Plays correctly end to end in Chromium.** Drive a whole game with real clicks and keys: start, play to a win and to a loss or finish where the game has one, restart, new game, change every select and toggle mid-game, use Hint, Undo, Copy and the toolbar buttons (Copy Result, Reset, Export, Share). Look for dead states: a button that stops working, a board that stays inert, a message that never changes.
2. **Console is clean.** No errors or warnings, including after client-side navigation to another game and back (click a link in the sidebar; do not reload).
3. **Keyboard.** Tab order, one roving tab stop on boards, arrows move, Enter and Space act. Ctrl, Meta and Alt combinations must not be swallowed (`event.defaultPrevented` false). A finished or paused game must not trap page-wide keys. Focus must never fall to `<body>` after a state change (focus moves to the next control when the focused one disappears or goes inert).
4. **Screen reader.** One polite live region says what just happened in plain words; every cell and button has an accessible name; plurals are right ("1 move"); disabled states use `aria-disabled` or are explained.
5. **Layout.** At 320, 375, 768 and 1280 px wide: no sideways page scroll, no clipped or overlapping text or controls, touch targets at least 28 px (44 px or more for the games aimed at small children), the board fills the available width sensibly. Take screenshots with `#calculator-island` element screenshots after 2.5 s and LOOK at them.
6. **Colour never carries meaning alone.** Every colour also has a shape, letter, number or pattern. Text contrast at least 4.5:1 (check with computed styles). Also look at the light theme: add class `theme-light` to `<body>` and recheck legibility.
7. **Reduced motion.** With `reducedMotion: 'reduce'` nothing loops, shakes or slides decoratively and the game still works.
8. **Hostile input.** URL parameters that are junk, huge, negative, NaN, `__proto__`, or have unexpected types (`?n=abc`, `?s=99999999999`, `?level=__proto__`); `localStorage` pre-filled with junk (`gk:game:<slug>` set to `null`, `[]`, `"x"`, `{"best":"NaN"}`, huge numbers, nested objects) and with storage blocked (override `Storage.prototype` to throw); double clicks, key repeat, clicking while a computer reply or animation is in flight, resizing mid-game, switching the tab hidden and visible.
9. **Timers and loops.** Pause when the tab is hidden, resume only if the player was mid-game, no leaks after navigating away (a loop that keeps running after you leave shows as console errors or CPU use).
10. **Copy text.** The shared result line is correct in every state: unfinished, aided (hint or solution used), zero score, win, loss.
11. **The guide page tells the truth.** Read the page and check every concrete claim (numbers, rules, controls, colours, shapes, keys, sizes) against the code, the tests and what the page really does. Anything the page says that is not true is a bug.
12. **Licensing and look.** No other company's name or mark anywhere (the hygiene test guards this, but read for descriptive mentions and alt text). The look must not echo the famous game it is derived from: follow the "What not to copy" rules for the game in `games-licensing-wave-10.md`.
13. **For the children's games.** Little reading, big forgiving targets, no failure screens, kind wording, no timers that end the game, sound off by default with a visible control, nothing scary, no flashing faster than 3 times a second.

## Known traps, look for their cousins

- **Shared global CSS.** Every game's `<style is:global>` ships on every app page, so two apps with the same root id prefix (or an unscoped selector, or a repeated `@keyframes` name) restyle each other. A test now forbids duplicate root prefixes and keyframes; look for UNSCOPED selectors and for rules that could match another game's elements.
- **Tailwind utilities that do not exist.** Tailwind does not scan the gitignored games folder, so a utility class used only there has no rule (this hid every `sr-only` label as visible text). Check any non-prefixed class a game uses against the built stylesheet.
- **`<use>` of a zero-size SVG painted nothing** and **TypeScript generics in an Astro template** broke the bundler: look for other things that pass jsdom and unit tests but fail in the real browser or build.
- **The shell entrance animation** staggers every `button`, `input`, `select` and a few containers; boards with hundreds of buttons, anything positioned by inline style, and anything that starts a loop before the island is visible can misbehave in the first 0.6 s.
- **Inert and focus.** A board made `inert` at game over must be made interactive again only by New game or Restart.
- **Double handling.** Pointer plus click, key repeat, touch followed by a synthetic mouse event.
- **Canvas.** Size by CSS box times `devicePixelRatio` (cap 2), redraw on resize and theme change, `touch-action: none` only on the drawing area.
- **Audio.** Created only after a user gesture, off by default, a visible sound control, suspended on a hidden tab, peak gain 0.15 at most.

## How to report

One finding per entry, most serious first:

- **Severity:** blocker (breaks the game, build or a promise on the page), major (visible defect most players will hit), minor (edge case or polish).
- **Game and location:** slug and `file:line`.
- **What happens:** the exact scenario to reproduce, in numbered steps.
- **Evidence:** what you ran and saw (command, measured number, console text).
- **Fix:** the smallest correct change.

Give a one-line verdict for every game you were assigned (clean, minor issues, needs fixes) even when you found nothing: say what you did check. Do not pad with style opinions. Do not report anything you did not reproduce or prove from the code. Keep the report under 1,800 words.
