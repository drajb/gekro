/**
 * apps.games-regressions.spec.ts - guards for defects found in the 2026-10-29 audit
 * of the browser games that only show up in a real browser:
 *  - the shared entrance animation must not hide large boards or ignore reduced motion;
 *  - client-side navigation must stay free of console warnings;
 *  - keyboard shortcuts with Ctrl/Alt must reach the browser;
 *  - a paused Snake must not trap arrow keys page-wide;
 *  - changing Tic Tac Toe's computer menus in two-player mode must not wipe the game;
 *  - touch-size floors for the disclosure toggle and the Gomoku board.
 */
import { test, expect } from '@playwright/test';

const GAMES = [
  'sudoku', 'merge-tiles', 'snake', 'tic-tac-toe', 'four-in-a-row', 'match-pairs', 'mines',
  'hangman', 'solitaire', 'sliding-puzzle', 'light-grid', 'tower-of-hanoi', 'reversi',
  'reaction-time', 'peg-solitaire', 'checkers', 'dots-and-boxes', 'gomoku',
  'typing-test', 'aim-trainer', 'nonogram', 'code-breaker', 'nim', 'word-guess',
];

const NOISE = /cloudflare|CORS|ERR_FAILED|preload|favicon/i;

test('a 225-point Gomoku board is fully visible shortly after load', async ({ page }) => {
  await page.goto('/apps/gomoku/?n=15');
  await expect(page.locator('#calculator-island')).toBeVisible();
  // The old stagger needed about 5 s for 225 buttons; it must now finish well inside 3 s.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => [...document.querySelectorAll('#calculator-island button:not([disabled]):not([aria-disabled="true"])')].filter((x) => +getComputedStyle(x).opacity < 0.99).length,
        ),
      { timeout: 3000, intervals: [100] },
    )
    .toBe(0);
});

test('reduced motion: the entrance animation is skipped', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/apps/gomoku/');
  await expect(page.locator('#calculator-island')).toBeVisible();
  await page.waitForTimeout(200);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('#calculator-island button:not([disabled]):not([aria-disabled="true"])')].filter((x) => +getComputedStyle(x).opacity < 0.99).length,
  );
  expect(hidden).toBeLessThanOrEqual(2);
  await ctx.close();
});

test('client-side navigation between games logs no warnings or errors', async ({ page }) => {
  const bad: string[] = [];
  page.on('console', (m) => {
    if (['warning', 'error'].includes(m.type()) && !NOISE.test(m.text())) bad.push(m.text());
  });
  page.on('pageerror', (e) => bad.push(String(e)));
  await page.goto('/apps/snake/');
  for (const slug of ['sudoku', 'nim', 'mines']) {
    await page.locator(`a[href="/apps/${slug}/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/apps/${slug}/`));
    await page.waitForTimeout(900);
  }
  expect(bad).toEqual([]);
});

for (const slug of ['sudoku', 'sliding-puzzle', 'light-grid']) {
  test(`${slug}: Ctrl and Alt combinations are left to the browser`, async ({ page }) => {
    await page.goto(`/apps/${slug}/`);
    await expect(page.locator('#calculator-island')).toBeVisible();
    await page.waitForTimeout(1200);
    const prevented = await page.evaluate(() => {
      const grid = document.querySelector('#calculator-island [role="grid"], #calculator-island [id$="-board"]') as HTMLElement | null;
      const target = (grid?.querySelector('[tabindex="0"]') as HTMLElement | null) ?? grid;
      if (!target) return ['no board'];
      target.focus();
      const out: string[] = [];
      const combos: KeyboardEventInit[] = [
        { key: 'h', ctrlKey: true },
        { key: 'u', ctrlKey: true },
        { key: 'z', metaKey: true },
        { key: 'ArrowLeft', altKey: true },
        { key: 'ArrowRight', altKey: true },
      ];
      for (const init of combos) {
        const ev = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
        (document.activeElement ?? target).dispatchEvent(ev);
        if (ev.defaultPrevented) out.push(JSON.stringify(init));
      }
      return out;
    });
    expect(prevented).toEqual([]);
  });
}

test('snake: a paused game does not trap the arrow keys page-wide', async ({ page }) => {
  await page.goto('/apps/snake/');
  await expect(page.locator('#sn-area')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.locator('#sn-start').click();
  await page.locator('#sn-area').focus();
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const arrowPrevented = await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(arrowPrevented).toBe(false);
});

test('tic-tac-toe: two-player mode keeps the game when the computer menus are touched', async ({ page }) => {
  await page.goto('/apps/tic-tac-toe/');
  await expect(page.locator('#tt-board')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.selectOption('#tt-opp', 'two');
  await page.locator('.tt-cell[data-i="0"]').click();
  await page.locator('.tt-cell[data-i="4"]').click();
  await expect(page.locator('#tt-diff')).toBeDisabled();
  await expect(page.locator('#tt-side')).toBeDisabled();
  const marks = await page.locator('.tt-cell[data-mark]:not([data-mark=""])').count();
  expect(marks).toBe(2);
});

test('every game\'s "how it works" toggle is at least 28 px tall', async ({ page }) => {
  const small: string[] = [];
  for (const slug of GAMES) {
    await page.goto(`/apps/${slug}/`);
    await expect(page.locator('#calculator-island')).toBeVisible();
    const hs = await page.evaluate(() =>
      [...document.querySelectorAll('#calculator-island details > summary')].map((s) => Math.round(s.getBoundingClientRect().height)),
    );
    if (hs.length === 0 || hs.some((h) => h < 28)) small.push(`${slug}: ${hs.join(',') || 'none'}`);
  }
  expect(small).toEqual([]);
});

test('gomoku: every point is at least 24 px wide at 320 px and the page does not scroll sideways', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/apps/gomoku/?n=15');
  await expect(page.locator('#calculator-island')).toBeVisible();
  await page.waitForTimeout(1400);
  const m = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#gm-app button')].filter((b) => {
      const w = b.getBoundingClientRect().width;
      return w > 10 && w < 60;
    });
    return {
      count: cells.length,
      min: Math.min(...cells.map((c) => c.getBoundingClientRect().width)),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  expect(m.count).toBeGreaterThanOrEqual(225);
  expect(m.min).toBeGreaterThanOrEqual(23.5);
  expect(m.overflow).toBe(false);
  await ctx.close();
});
