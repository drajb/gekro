/**
 * apps.games-monkey.spec.ts - random-input stress test for every browser game.
 *
 * The generic interactions suite clicks about a dozen buttons. Games have long
 * state machines (turns, undo, timers, computer replies), so this one throws a
 * few hundred random clicks, key presses and select changes at each page and
 * fails on any uncaught error, console error, or NaN/undefined/null text.
 * The random stream is seeded per game so a failure can be reproduced.
 */
import { test, expect, type Page } from '@playwright/test';
import { isAllowed, consoleText } from './helpers';

const GAMES = [
  'sudoku', 'merge-tiles', 'snake', 'tic-tac-toe', 'four-in-a-row', 'match-pairs', 'mines',
  'hangman', 'solitaire', 'sliding-puzzle', 'light-grid', 'tower-of-hanoi', 'reversi',
  'reaction-time', 'peg-solitaire', 'checkers', 'dots-and-boxes', 'gomoku',
  'typing-test', 'aim-trainer', 'nonogram', 'code-breaker', 'nim', 'word-guess',
];

const KEYS = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Backspace', 'Delete',
  'a', 'e', 'f', 'h', 'n', 'u', 'x', 'm', 'c', '1', '2', '3', '4', '5', '9', '0',
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAD_TEXT = /\b(NaN|undefined|Infinity)\b|\bnull\b(?!\s*[-:])/;

async function step(page: Page, r: () => number) {
  const roll = r();
  if (roll < 0.55) {
    const buttons = page.locator('#calculator-island button:visible:not([disabled])');
    const n = await buttons.count();
    if (n) await buttons.nth(Math.floor(r() * n)).click({ timeout: 800, button: r() < 0.1 ? 'right' : 'left' }).catch(() => {});
  } else if (roll < 0.9) {
    await page.keyboard.press(KEYS[Math.floor(r() * KEYS.length)]).catch(() => {});
  } else {
    const selects = page.locator('#calculator-island select:visible');
    const n = await selects.count();
    if (n) {
      const sel = selects.nth(Math.floor(r() * n));
      const opts = await sel.locator('option').count();
      if (opts) await sel.selectOption({ index: Math.floor(r() * opts) }).catch(() => {});
    }
  }
}

for (const [i, slug] of GAMES.entries()) {
  test(`/apps/${slug} survives 250 random inputs`, async ({ page }) => {
    test.setTimeout(120_000);
    const r = rng(1000 + i);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(consoleText(m)); });
    await page.goto(`/apps/${slug}/`);
    await expect(page.locator('#calculator-island')).toBeVisible();
    for (let n = 0; n < 250; n++) {
      await step(page, r);
      if (n % 50 === 49) {
        if (!(await page.locator('#calculator-island').count())) {
          const body = (await page.locator('body').innerText()).slice(0, 300).split('\n').join(' ');
          console.log(`ISLAND GONE ${slug} after ${n + 1} inputs url=${page.url()} title=${await page.title()} body=${body}`);
        }
        const text = await page.locator('#calculator-island').innerText();
        expect(BAD_TEXT.test(text), `${slug}: bad text after ${n + 1} inputs: ${text.match(BAD_TEXT)?.[0]}`).toBe(false);
      }
    }
    await page.waitForTimeout(1500); // let any computer reply or timer fire
    const real = errors.filter((e) => !isAllowed(slug, e));
    expect(real, `${slug}: ${real.join(' | ')}`).toEqual([]);
  });
}
