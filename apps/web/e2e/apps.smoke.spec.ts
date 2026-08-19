/**
 * apps.smoke.spec.ts — runtime smoke test for every /apps/[slug].
 *
 * For each app it asserts the things a user would notice if the app were
 * broken: the page loads, the calculator island actually mounts (not the
 * "coming soon" stub), it renders content immediately (no blank state), the
 * page doesn't scroll sideways on phone/tablet/desktop widths, and nothing
 * throws or logs an error during load + a first interaction.
 *
 * Slugs are read from the content dir so the suite always covers 100% of apps
 * with zero maintenance when apps are added.
 */
import { test, expect, type ConsoleMessage } from '@playwright/test';
import { appSlugs, isAllowed, consoleText } from './helpers';

for (const slug of appSlugs()) {
  test(`/apps/${slug} mounts and runs clean`, async ({ page }) => {
    const errors: string[] = [];
    const onConsole = (m: ConsoleMessage) => {
      if (m.type() === 'error') errors.push(consoleText(m));
    };
    page.on('console', onConsole);
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    const resp = await page.goto(`/apps/${slug}/`, { waitUntil: 'domcontentloaded' });
    expect(resp, `${slug}: no response`).not.toBeNull();
    expect(resp!.status(), `${slug}: HTTP ${resp!.status()}`).toBeLessThan(400);

    // The island must mount, and must NOT be the "coming soon" fallback.
    const island = page.locator('#calculator-island');
    await expect(island, `${slug}: #calculator-island missing`).toBeVisible();
    await expect(
      page.getByText('Calculator coming soon'),
      `${slug}: shows "Calculator coming soon" stub`,
    ).toHaveCount(0);

    // Renders content immediately (no blank state per platform standard §5.1).
    const childCount = await island.locator(':scope *').count();
    expect(childCount, `${slug}: island rendered no content`).toBeGreaterThan(3);

    // Give islands a moment to hydrate and run their init() before checking errors.
    await page.waitForTimeout(600);

    // No horizontal overflow at phone / tablet / desktop widths.
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      expect(overflow, `${slug}: horizontal overflow at ${width}px`).toBe(false);
    }

    const real = errors.filter((e) => !isAllowed(slug, e));
    expect(real, `${slug}: ${real.length} unexpected error(s):\n - ${real.join('\n - ')}`).toEqual([]);
  });
}
