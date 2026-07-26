/**
 * apps.output-sanity.spec.ts — "did the math actually produce a number?" layer.
 *
 * The smoke suite proves each app LOADS. The interactions suite proves each app
 * SURVIVES BEING USED (no crash, no XSS, island intact). Neither looks at what
 * the app actually RENDERS — its own docstring says so: "it can't know each
 * app's domain math".
 *
 * That gap is where a whole class of real bugs lived. The 2026-07-05 audit found
 * NaN-edge renders in position-sizer, lora-memory-calculator, tesla-trip and
 * options-pnl purely by hand, because a calculator showing "NaN%" or "$undefined"
 * passes every structural assertion: nothing throws, nothing navigates, the
 * island is full of content. It just tells the user a garbage number.
 *
 * This suite drives every app to the numeric edges that produce those values
 * (empty, 0, negative, huge — 0 especially, since divide-by-zero is how NaN and
 * Infinity are born) and then reads the island back, failing if any poisoned
 * token reached the DOM.
 *
 * Deliberately numeric-only: it never types free text, so a literal "NaN" can
 * only appear because the app computed one, not because a fuzzer typed it.
 */
import { test, expect, type Page } from '@playwright/test';
import { appSlugs } from './helpers';

/** Tokens that should never be user-visible in a finished render. */
const POISON = ['NaN', 'Infinity', 'undefined', 'null%', '[object Object]', '$NaN', 'e+21'];

/**
 * Legitimate, intentional appearances — kept deliberately tiny. Anything not
 * listed here is treated as a real bug.
 */
const ALLOWED_TOKENS: Record<string, string[]> = {
  // Teaching tools that render JS semantics/types as their actual subject matter.
  'json-formatter': ['null%', 'undefined', 'NaN', 'Infinity'],
  'llm-json-repair': ['undefined', 'NaN', 'Infinity'], // repairs Python/JS literals; shows them in presets
  'jwt-decoder': ['undefined', 'null%'],
  'dummy-data-generator': ['undefined', 'null%'],
  'regex-playground': ['undefined', 'NaN'],
  'system-prompt-linter': ['undefined'],
  'device-info': ['undefined'], // reports absent browser APIs verbatim
  'sampling-playground': ['Infinity'], // temperature/top-k edges are the subject
  'html-viewer': ['undefined', 'NaN', 'Infinity', '[object Object]'], // renders arbitrary pasted HTML/JS
  'markdown-visualizer': ['undefined', 'NaN'],
};

/** Set every numeric input to `value`, letting live-recalc apps recompute. */
async function setAllNumerics(page: Page, value: string): Promise<number> {
  const fields = page.locator('#calculator-island input[type="number"]');
  const n = Math.min(await fields.count(), 12);
  for (let i = 0; i < n; i++) {
    const f = fields.nth(i);
    if (!(await f.isVisible().catch(() => false))) continue;
    await f.fill(value, { timeout: 1_500 }).catch(() => {});
    await page.waitForTimeout(40);
  }
  return n;
}

/** Poisoned tokens currently visible in the island. */
async function poisonIn(page: Page, slug: string): Promise<string[]> {
  const text = await page.locator('#calculator-island').innerText().catch(() => '');
  const allowed = ALLOWED_TOKENS[slug] ?? [];
  return POISON.filter((p) => !allowed.includes(p) && text.includes(p));
}

test.describe('apps output sanity', () => {
  for (const slug of appSlugs()) {
    test(`/apps/${slug} never renders NaN/Infinity/undefined`, async ({ page }) => {
      await page.goto(`/apps/${slug}/`, { waitUntil: 'domcontentloaded' });
      const island = page.locator('#calculator-island');
      await expect(island).toBeVisible();
      await page.waitForTimeout(350); // first paint / default compute

      const found: string[] = [];

      // As-shipped defaults must already be clean — every app is required to
      // show a meaningful result on first paint.
      found.push(...(await poisonIn(page, slug)).map((p) => `default render: ${p}`));

      // 0 is the highest-yield case: it is how divide-by-zero, and therefore
      // NaN and Infinity, actually get produced in these calculators.
      for (const v of ['0', '', '-1', '999999999']) {
        const n = await setAllNumerics(page, v);
        if (n === 0) break; // no numeric inputs — nothing to drive
        await page.waitForTimeout(250);
        found.push(...(await poisonIn(page, slug)).map((p) => `inputs="${v}": ${p}`));
      }

      expect(
        [...new Set(found)],
        `${slug}: poisoned value(s) reached the UI — a user sees this as the answer`,
      ).toEqual([]);
    });
  }
});
