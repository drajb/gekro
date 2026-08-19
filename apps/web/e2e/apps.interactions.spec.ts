/**
 * apps.interactions.spec.ts — interaction + fuzz layer for every /apps/[slug].
 *
 * The smoke suite proves each app LOADS clean. This suite proves each app
 * SURVIVES BEING USED. For every app it:
 *
 *  1. Types a hostile string (markup + quotes + unicode + emoji) into every
 *     text input/textarea, and boundary values (0, -1, huge) into every
 *     numeric input — live-recalc apps recompute on each `input` event.
 *  2. Cycles every <select> through a couple of options.
 *  3. Clicks every button inside the calculator island (tabs, presets,
 *     generate, copy, reset, ...), skipping only file pickers and links.
 *  4. Fires the AppShell toolbar events (app:reset / app:copy / app:export)
 *     the way the shell does.
 *
 * After all of that it asserts: no unexpected console/page errors, the XSS
 * probe never executed (window.__xssProbe stays unset), the island still has
 * content (didn't wipe itself), and we're still on the same page.
 *
 * This is deliberately generic — it can't know each app's domain math (the
 * per-app logic reviews cover that) — but it mechanically catches the classic
 * "found it later" bugs: crashes on weird input, handlers that throw, buttons
 * that break state, self-XSS sinks.
 */
import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';
import { appSlugs, isAllowed, consoleText } from './helpers';

// Executes only if an app injects user input into innerHTML/attributes unescaped.
const XSS_PROBE = `"><img src=x onerror="window.__xssProbe=1">'-->]]>`;
const HOSTILE_TEXT = `Test & <b>bold</b> "quotes" 'single' \\back/ é ñ 中文 🎉 ${XSS_PROBE}`;
const NUMERIC_FUZZ = ['0', '-1', '999999999'];

async function fuzzApp(page: Page, slug: string): Promise<void> {
  const island = page.locator('#calculator-island');

  // Hard time budget. Apps that re-render their island on every input make
  // each locator action burn its full timeout; without a budget the whole
  // test times out instead of finishing with partial coverage.
  const deadline = Date.now() + 55_000;
  const timeLeft = () => Date.now() < deadline;
  const ACT = { timeout: 1_500 } as const;

  // -- 1. text inputs + textareas ------------------------------------------
  const textFields = island.locator(
    'input[type="text"], input[type="search"], input[type="url"], input:not([type]), textarea',
  );
  const nText = Math.min(await textFields.count(), 8);
  for (let i = 0; i < nText && timeLeft(); i++) {
    const f = textFields.nth(i);
    if (await f.isVisible().catch(() => false)) {
      await f.fill(HOSTILE_TEXT, ACT).catch(() => {});
      await page.waitForTimeout(80);
    }
  }

  // -- 2. numeric inputs -----------------------------------------------------
  const numFields = island.locator('input[type="number"]');
  const nNum = Math.min(await numFields.count(), 8);
  for (let i = 0; i < nNum && timeLeft(); i++) {
    const f = numFields.nth(i);
    if (await f.isVisible().catch(() => false)) {
      for (const v of NUMERIC_FUZZ) {
        await f.fill(v, ACT).catch(() => {});
        await page.waitForTimeout(40);
      }
    }
  }

  // -- 3. selects ------------------------------------------------------------
  const selects = island.locator('select');
  const nSel = Math.min(await selects.count(), 6);
  for (let i = 0; i < nSel && timeLeft(); i++) {
    const s = selects.nth(i);
    if (!(await s.isVisible().catch(() => false))) continue;
    const values = await s
      .locator('option')
      .evaluateAll((os) => (os as HTMLOptionElement[]).map((o) => o.value));
    for (const v of values.slice(0, 3)) {
      await s.selectOption(v, ACT).catch(() => {});
      await page.waitForTimeout(60);
    }
  }

  // -- 4. buttons (tabs, presets, actions) -----------------------------------
  // Snapshot count first; re-query each round since apps re-render.
  const buttonSel = '#calculator-island button:not([disabled])';
  const total = Math.min(await page.locator(buttonSel).count(), 12);
  for (let i = 0; i < total && timeLeft(); i++) {
    const b = page.locator(buttonSel).nth(i);
    const visible = await b.isVisible().catch(() => false);
    if (!visible) continue;
    await b.click({ timeout: 1_000, noWaitAfter: true, force: true }).catch(() => {});
    await page.waitForTimeout(50);
  }

  // -- 5. AppShell toolbar contract ------------------------------------------
  for (const evt of ['app:copy', 'app:export', 'app:reset']) {
    await page.evaluate((e) => document.dispatchEvent(new CustomEvent(e)), evt);
    await page.waitForTimeout(120);
  }
}

for (const slug of appSlugs()) {
  test(`/apps/${slug} survives interaction + fuzz input`, async ({ page }) => {
    // Interaction budget is inherently bigger than the load-only smoke's.
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
      if (m.type() === 'error') errors.push(consoleText(m));
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    // Auto-dismiss any dialog so a stray alert()/confirm() can't hang the run.
    page.on('dialog', (d) => void d.dismiss().catch(() => {}));

    await page.goto(`/apps/${slug}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#calculator-island')).toBeVisible();
    await page.waitForTimeout(400); // let the island hydrate + init

    await fuzzApp(page, slug);
    await page.waitForTimeout(400); // let debounced recalcs settle

    // XSS probe must never have executed.
    const xss = await page.evaluate(() => (window as unknown as { __xssProbe?: number }).__xssProbe);
    expect(xss, `${slug}: XSS probe EXECUTED — unescaped user input hit a live HTML sink`).toBeFalsy();

    // Island must still be alive (not blanked by a throwing handler).
    const childCount = await page.locator('#calculator-island *').count();
    expect(childCount, `${slug}: island emptied out after interaction`).toBeGreaterThan(3);

    // Interactions must not have navigated us away.
    expect(page.url(), `${slug}: interaction navigated away`).toContain(`/apps/${slug}`);

    const real = errors.filter((e) => !isAllowed(slug, e));
    expect(
      real,
      `${slug}: ${real.length} unexpected error(s) during interaction:\n - ${real.join('\n - ')}`,
    ).toEqual([]);
  });
}
