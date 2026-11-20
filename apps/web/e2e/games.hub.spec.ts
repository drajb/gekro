/**
 * games.hub.spec.ts - the /games/ section (added 2026-11-05):
 *  - the top navigation has separate Apps and Games items;
 *  - the hub lists every game once, filters by genre chip and by search, and says how many it shows;
 *  - genre hubs exist and link back; a game page links to its genre hub and the hub's breadcrumb is right;
 *  - the old /apps/ index lists tools only and links to the games hub;
 *  - a game is served only under /games/, not under /apps/.
 */
import { test, expect } from '@playwright/test';
import { GAMES } from './games-list';

test('the top navigation has separate Apps and Games items', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('header nav').first();
  await expect(nav.getByRole('link', { name: 'Apps', exact: true })).toHaveAttribute('href', '/apps/');
  await expect(nav.getByRole('link', { name: 'Games', exact: true })).toHaveAttribute('href', '/games/');
});

test('the hub lists every game, filters by genre and by search', async ({ page }) => {
  await page.goto('/games/');
  await expect(page.locator('h1')).toContainText('free games');
  // Every game has a card under its genre section (the Just added and Daily rows repeat some).
  const hrefs = await page.locator('#games-sections [data-game] a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')));
  const unique = new Set(hrefs);
  expect(unique.size).toBe(GAMES.length);
  for (const slug of GAMES) expect(unique.has(`/games/${slug}/`), slug).toBe(true);
  await expect(page.locator('#games-count')).toHaveText(`${GAMES.length} games`);

  await page.getByRole('button', { name: 'Word games' }).click();
  const visible = await page.locator('#games-sections [data-game]:not([hidden])').count();
  expect(visible).toBeGreaterThan(5);
  expect(visible).toBeLessThan(GAMES.length);
  await expect(page.getByRole('button', { name: 'Word games' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('#games-search').fill('sudoku');
  await expect(page.locator('#games-sections [data-game]:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#games-count')).toHaveText('1 game');
  await page.locator('#games-search').fill('zzzzqq');
  await expect(page.locator('#games-empty')).toBeVisible();
});

test('a genre hub lists its games and links to the other genres', async ({ page }) => {
  await page.goto('/games/category/board/');
  await expect(page.locator('h1')).toHaveText('Free online board games');
  expect(await page.locator('main ul[role="list"] a[href^="/games/"]').count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator('a[href="/games/category/cards/"]').first()).toBeVisible();
});

test('a game page sits in the games section: genre link, breadcrumbs, games-only sidebar', async ({ page }) => {
  await page.goto('/games/sudoku/');
  await expect(page.locator('h1')).toHaveText('Sudoku');
  await expect(page.locator('a[href="/games/category/puzzle/"]').first()).toBeVisible();
  const crumbs = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent || '{}'))
      .find((j) => j['@type'] === 'BreadcrumbList')?.itemListElement.map((i: any) => i.name),
  );
  expect(crumbs).toEqual(['Home', 'Games', 'Puzzles', 'Sudoku']);
  const links = await page.locator('#sidebar-nav a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')));
  expect(links.length).toBeGreaterThan(50);
  expect(links.every((h) => h!.startsWith('/games/'))).toBe(true);
});

test('the apps index lists tools only and points to the games hub', async ({ page }) => {
  await page.goto('/apps/');
  await expect(page.locator('a[href="/games/"]').first()).toBeVisible();
  const gameLinks = await page.locator('main a[href^="/apps/"]').evaluateAll((as, games) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')).filter((h) => games.some((g) => h === `/apps/${g}/`)), GAMES);
  expect(gameLinks).toEqual([]);
});

test('a game is served only under /games/', async ({ page }) => {
  const ok = await page.goto('/games/chess/');
  expect(ok?.status()).toBe(200);
  const gone = await page.goto('/apps/chess/');
  expect(gone?.status()).toBe(404);
});
