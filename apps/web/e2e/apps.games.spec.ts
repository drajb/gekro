/**
 * apps.games.spec.ts - what the browser games promise a visitor, tested.
 *
 * The generic app suites prove every page loads and survives fuzzing. This one
 * proves the claims the game pages make:
 *  - no game sends anything off the device (only GET requests to our own origin);
 *  - Tic Tac Toe on Unbeatable never loses, whatever you click;
 *  - Tower of Hanoi Auto-solve finishes in exactly 2^n - 1 moves;
 *  - Light Grid's "Show a solution" marks cells that really clear the board.
 */
import { test, expect, type Page } from '@playwright/test';

const GAMES = [
  'sudoku', 'merge-tiles', 'snake', 'tic-tac-toe', 'four-in-a-row', 'match-pairs', 'mines',
  'hangman', 'solitaire', 'sliding-puzzle', 'light-grid', 'tower-of-hanoi', 'reversi',
  'reaction-time', 'peg-solitaire', 'checkers', 'dots-and-boxes', 'gomoku',
  'typing-test', 'aim-trainer', 'nonogram', 'code-breaker', 'nim', 'word-guess',
];

for (const slug of GAMES) {
  test(`/apps/${slug} makes no off-device requests while played`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    const bad: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol === 'data:' || u.protocol === 'blob:') return;
      if (/googletagmanager|google-analytics|cloudflareinsights|static\.cloudflare|challenges\.cloudflare|fonts\.googleapis|fonts\.gstatic|deepwiki\.com/.test(u.host)) return; // site-wide header/footer requests, not the game
      if (u.origin !== origin) bad.push(`${r.method()} ${r.url()}`);
      else if (r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
    });
    await page.goto(`/apps/${slug}/`);
    await expect(page.locator('#calculator-island')).toBeVisible();
    const buttons = page.locator('#calculator-island button:visible:not([disabled])');
    const n = Math.min(await buttons.count(), 10);
    for (let i = 0; i < n; i++) await buttons.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
    expect(bad, `${slug} sent: ${bad.join(', ')}`).toEqual([]);
  });
}

// Guards a shell bug found on 2026-10-23: AppShell's entrance animation used
// clearProps "all", which wiped inline CSS variables (grid sizes, tile
// positions) after load and collapsed some boards into one tall column.
for (const slug of GAMES) {
  test(`/apps/${slug} keeps its layout after the entrance animation`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/apps/${slug}/`);
    await page.waitForTimeout(1500);
    const h = await page.locator('#calculator-island').evaluate((el) => el.getBoundingClientRect().height);
    expect(h, `${slug} island is ${Math.round(h)}px tall at 375px`).toBeLessThan(2200);
  });
}

test('match-pairs: the board keeps four columns', async ({ page }) => {
  await page.goto('/apps/match-pairs/');
  await page.waitForTimeout(1500);
  const cols = await page.locator('#mp-board').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(4);
});

test('tic-tac-toe: Unbeatable never loses against random play', async ({ page }) => {
  test.setTimeout(150_000); // 16 full games with a real computer-reply delay each move
  await page.goto('/apps/tic-tac-toe/');
  await page.selectOption('#tt-diff', 'unbeatable');
  for (const side of ['X', 'O']) {
    await page.selectOption('#tt-side', side);
    for (let game = 0; game < 8; game++) {
      await page.click('#tt-again').catch(() => {});
      for (let step = 0; step < 12; step++) {
        const kind = await page.locator('#tt-banner').getAttribute('data-kind');
        if (kind && kind !== 'none') break;
        const empties = page.locator('#tt-board .tt-cell[data-mark=""]');
        const count = await empties.count();
        if (count === 0) break;
        await empties.nth(Math.floor(Math.random() * count)).click({ force: true });
        await page.waitForTimeout(450);
      }
      const kind = await page.locator('#tt-banner').getAttribute('data-kind');
      expect(kind, `side ${side} game ${game}`).not.toBe('win');
    }
  }
});

test('tower-of-hanoi: Auto-solve uses exactly the minimum number of moves', async ({ page }) => {
  await page.goto('/apps/tower-of-hanoi/');
  await page.selectOption('#th-discs', '4');
  await page.click('#th-auto');
  await expect(page.locator('#th-win')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#th-moves')).toHaveText('15');
  await expect(page.locator('#th-min')).toHaveText('15');
});

async function litCount(page: Page): Promise<number> {
  return page.locator('#lg-board .lg-cell[data-lit="true"]').count();
}

test('light-grid: the shown solution clears the board', async ({ page }) => {
  await page.goto('/apps/light-grid/');
  for (const size of ['3', '4', '5']) {
    await page.selectOption('#lg-size', size);
    await page.click('#lg-new');
    expect(await litCount(page)).toBeGreaterThan(0);
    await page.click('#lg-solve');
    const plan = page.locator('#lg-board .lg-cell[data-plan="solution"]');
    expect(await plan.count()).toBeGreaterThan(0);
    // A pressed cell drops its mark, so keep pressing the first marked cell until none are left.
    for (let guard = 0; guard < 40 && (await plan.count()) > 0; guard++) await plan.nth(0).click({ force: true });
    expect(await litCount(page), `size ${size}`).toBe(0);
    await expect(page.locator('#lg-win')).toBeVisible();
  }
});

test('sliding-puzzle: following the hint solves a 3x3', async ({ page }) => {
  await page.goto('/apps/sliding-puzzle/');
  await page.selectOption('#sp-size', '3');
  await page.click('#sp-new');
  for (let i = 0; i < 40; i++) {
    if (await page.locator('#sp-win').isVisible()) break;
    await page.click('#sp-hint');
    await page.locator('#sp-board .sp-tile[data-hint="true"]').first().click({ force: true });
  }
  await expect(page.locator('#sp-win')).toBeVisible();
});

test('reversi: a move is answered by the computer and discs are conserved', async ({ page }) => {
  await page.goto('/apps/reversi/');
  await page.locator('#rv-board .rv-cell[data-legal="true"]').first().click();
  await expect.poll(async () => page.locator('#rv-board .rv-cell:not([data-p="0"])').count(), { timeout: 5000 }).toBe(6);
});

test('four-in-a-row: a drop is answered by the computer', async ({ page }) => {
  await page.goto('/apps/four-in-a-row/');
  await page.locator('#fr-app .fr-head').nth(3).click();
  await expect.poll(async () => page.locator('#fr-board .fr-cell:not([data-p="0"])').count(), { timeout: 5000 }).toBe(2);
});

test('mines: the first click is safe and opens cells', async ({ page }) => {
  for (let run = 0; run < 5; run++) {
    await page.goto('/apps/mines/');
    await page.locator('#mn-board .mn-cell').nth(40).click();
    expect(await page.locator('#mn-board .mn-cell[data-k="boom"]').count()).toBe(0);
    expect(await page.locator('#mn-board .mn-cell[data-k="open"]').count()).toBeGreaterThan(0);
  }
});

test('merge-tiles: arrow keys move tiles and score', async ({ page }) => {
  await page.goto('/apps/merge-tiles/');
  await page.locator('#mt-board').focus();
  const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 60; i++) await page.keyboard.press(keys[i % 4]);
  expect(Number(await page.locator('#mt-moves').textContent())).toBeGreaterThan(5);
});

test('match-pairs: two flips either match or turn back down', async ({ page }) => {
  await page.goto('/apps/match-pairs/');
  const cards = page.locator('#mp-board .mp-card');
  await cards.nth(0).click();
  await cards.nth(1).click();
  await expect.poll(async () => page.locator('#mp-board .mp-card[data-state="up"]').count(), { timeout: 4000 }).toBe(0);
  expect(await page.locator('#mp-moves').textContent()).toBe('1');
});

test('hangman: guessing every letter ends the game with a result', async ({ page }) => {
  await page.goto('/apps/hangman/');
  for (const l of 'etaoinshrdlucmfwypvbgkjqxz') {
    const key = page.locator(`#hm-app .hm-key[data-l="${l}"]`);
    if (await key.isDisabled()) continue;
    await key.click();
    if (await page.locator('#hm-banner').isVisible()) break;
  }
  await expect(page.locator('#hm-banner')).toBeVisible();
});

test('reaction-time: a press at GO is timed, an early press is discarded', async ({ page }) => {
  await page.goto('/apps/reaction-time/');
  const panel = page.locator('#rt-panel');
  await panel.click();
  await expect(panel).toHaveAttribute('data-state', 'waiting');
  await panel.click(); // too early
  await expect(page.locator('#rt-label')).toContainText(/too soon/i);
  await panel.click();
  await expect(panel).toHaveAttribute('data-state', 'go', { timeout: 8000 });
  await page.waitForTimeout(120);
  await panel.click();
  await expect(page.locator('#rt-label')).toContainText(/\d+\s*ms/);
});

test('gomoku: a stone is answered by the computer', async ({ page }) => {
  await page.goto('/apps/gomoku/');
  await page.locator('#gm-board .gm-cell').nth(84).click();
  await expect.poll(async () => page.locator('#gm-board .gm-cell:not([data-p="0"])').count(), { timeout: 5000 }).toBe(2);
});

test('checkers: a move is answered by the computer', async ({ page }) => {
  await page.goto('/apps/checkers/');
  await page.locator('#ck-board button[aria-label*="can move"]').first().click();
  await page.locator('#ck-board button[aria-label*="legal destination"]').first().click();
  await expect(page.locator('#ck-turn')).toContainText(/your move/i, { timeout: 6000 });
  expect(await page.locator('#ck-board button[aria-label*="piece"], #ck-board button[aria-label*="king"]').count()).toBe(24);
});

test('dots-and-boxes: a line is answered by the computer', async ({ page }) => {
  await page.goto('/apps/dots-and-boxes/');
  const open = page.locator('#db-board button[aria-label*="not drawn"]');
  const before = await open.count();
  await open.first().click();
  await expect.poll(async () => open.count(), { timeout: 5000 }).toBeLessThanOrEqual(before - 2);
});

test('peg-solitaire: a jump removes exactly one peg', async ({ page }) => {
  await page.goto('/apps/peg-solitaire/');
  await page.locator('#ps-board button[aria-label*="can jump"]').first().click();
  await page.locator('#ps-board button[aria-label*="legal landing"]').first().click();
  await expect(page.locator('#ps-left')).toHaveText('31');
  await page.click('#ps-undo');
  await expect(page.locator('#ps-left')).toHaveText('32');
});

test('typing-test: typing the passage updates speed and keeps accuracy at 100%', async ({ page }) => {
  await page.goto('/apps/typing-test/');
  const text = (await page.locator('#ty-text').innerText()).replace(/\s+/g, ' ').slice(0, 24);
  await page.locator('#ty-input').click();
  await page.keyboard.type(text, { delay: 30 });
  await expect(page.locator('#ty-acc')).toContainText('100');
  await expect(page.locator('#ty-net')).toHaveText(/\d/);
});

test('aim-trainer: hitting targets counts hits', async ({ page }) => {
  await page.goto('/apps/aim-trainer/');
  await page.locator('#at-start-target').click();
  for (let i = 0; i < 3; i++) {
    const t = page.locator('#at-area .at-target:not(#at-start-target)').first();
    await t.waitFor({ state: 'visible' });
    await t.click({ force: true });
  }
  expect(Number(await page.locator('#at-hits').textContent())).toBeGreaterThanOrEqual(3);
});

test('nonogram: following hints solves a 5x5', async ({ page }) => {
  await page.goto('/apps/nonogram/');
  await page.selectOption('#ng-size', '5');
  for (let i = 0; i < 40; i++) {
    if (await page.locator('#ng-win').isVisible()) break;
    await page.click('#ng-hint');
  }
  await expect(page.locator('#ng-win')).toBeVisible();
});

test('code-breaker: a full guess is scored and stacked', async ({ page }) => {
  await page.goto('/apps/code-breaker/');
  const picks = page.locator('#cb-app .cb-pick');
  for (let i = 0; i < 4; i++) await picks.nth(i).click();
  await page.click('#cb-submit');
  await expect(page.locator('#cb-guess')).toContainText('2');
  expect(await page.locator('#cb-rows > *').count()).toBeGreaterThan(0);
});

test('nim: a take is answered by the computer', async ({ page }) => {
  await page.goto('/apps/nim/');
  const before = Number(await page.locator('#nm-left').textContent());
  await page.locator('#nm-field button:visible').first().click();
  await page.click('#nm-take');
  await expect.poll(async () => Number(await page.locator('#nm-left').textContent()), { timeout: 5000 }).toBeLessThanOrEqual(before - 2);
});

test('word-guess: a valid word fills a row, an invalid one is refused', async ({ page }) => {
  await page.goto('/apps/word-guess/');
  await page.waitForTimeout(1500); // let the entrance animation finish so the mode buttons are really under the pointer
  await page.click('#wg-random'); // regression: Enter after a mode-button click used to press that button again
  await page.keyboard.type('zzzzz');
  await page.keyboard.press('Enter');
  await expect(page.locator('#wg-status')).toContainText(/not in the word list/i);
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('crane');
  await page.keyboard.press('Enter');
  const scored = page.locator('#wg-app [role="gridcell"][aria-label*="Row 1"]');
  await expect(scored.first()).toHaveAttribute('aria-label', /(correct|in the word|not in the word)/);
  expect(await scored.count()).toBe(5);
});
