/**
 * i18n.spec.ts - browser checks for translated blog pages
 *
 * Enumerates src/translations/<lang>/<slug>.md and, for each translation,
 * asserts what a reader or a crawler would notice if it were broken:
 *  - the page loads and declares the right <html lang> and dir
 *  - canonical points at itself, hreflang lists English + x-default
 *  - the "Read in" strip links to English and English links back
 *  - no sideways scrolling on phone, tablet and desktop widths
 *  - a machine-translation notice with a link to the original is present
 *  - no em-dash is visible to the reader
 * Skips cleanly when no translations exist.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TR = join(WEB, 'src/translations');

const registry = new Map<string, { bcp47: string; dir: string }>();
for (const m of readFileSync(join(WEB, 'src/lib/languages.ts'), 'utf8').matchAll(
  /\{ code: '([a-z]{2})'[^}]*?bcp47: '([A-Za-z-]+)'[^}]*?dir: '(ltr|rtl)'/g,
)) {
  registry.set(m[1], { bcp47: m[2], dir: m[3] });
}

const translations: { lang: string; slug: string }[] = [];
if (existsSync(TR)) {
  for (const lang of readdirSync(TR, { withFileTypes: true })) {
    if (!lang.isDirectory() || !registry.has(lang.name)) continue;
    for (const f of readdirSync(join(TR, lang.name))) {
      if (f.endsWith('.md') && !f.startsWith('_')) translations.push({ lang: lang.name, slug: f.replace(/\.md$/, '') });
    }
  }
}

test.skip(translations.length === 0, 'no translations yet');

for (const { lang, slug } of translations) {
  const reg = registry.get(lang)!;

  test(`/blog/${lang}/${slug}/ is a well-formed translated page`, async ({ page }) => {
    const resp = await page.goto(`/blog/${lang}/${slug}/`, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBe(200);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', reg.bcp47);
    await expect(html).toHaveAttribute('dir', reg.dir);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`https://gekro.com/blog/${lang}/${slug}/`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      `https://gekro.com/blog/${slug}/`,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      `https://gekro.com/blog/${slug}/`,
    );

    // Translation notice links back to the English original
    const original = page.locator(`article p a[hreflang="en"][href="/blog/${slug}/"]`).first();
    await expect(original).toBeVisible();

    // Switcher: current language is marked, English is a link
    const switcher = page.locator('nav.lang-switcher');
    await expect(switcher.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(switcher.locator(`a[href="/blog/${slug}/"]`)).toHaveCount(1);

    // Reader-visible text never contains an em-dash
    const text = await page.locator('article').innerText();
    expect(text).not.toContain('—');
  });

  test(`/blog/${lang}/${slug}/ does not scroll sideways`, async ({ page }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/blog/${lang}/${slug}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${lang} at ${width}px`).toBeLessThanOrEqual(1);
    }
  });

  test(`/blog/${slug}/ links to its ${lang} translation`, async ({ page }) => {
    await page.goto(`/blog/${slug}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator(`nav.lang-switcher a[hreflang="${reg.bcp47}"]`)).toHaveAttribute('href', `/blog/${lang}/${slug}/`);
    await expect(page.locator(`link[rel="alternate"][hreflang="${reg.bcp47}"]`)).toHaveAttribute(
      'href',
      `https://gekro.com/blog/${lang}/${slug}/`,
    );
  });
}

test('English pages without translations have no switcher and no hreflang', async ({ page }) => {
  const translated = new Set(translations.map((t) => t.slug));
  const blog = readdirSync(join(WEB, 'src/content/blog')).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const slug = blog.map((f) => f.replace(/\.md$/, '')).find((s) => !translated.has(s));
  test.skip(!slug, 'every post is translated');
  await page.goto(`/blog/${slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('nav.lang-switcher')).toHaveCount(0);
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
});

// Discovery: the English archive links every language archive, and every
// archive links English plus the other languages. Without these the editions
// are reachable only from a post or from search.
const archiveLangs = [...new Set(translations.map((t) => t.lang))];

test('English /blog/ links to every language archive', async ({ page }) => {
  test.skip(archiveLangs.length === 0, 'no translations');
  await page.goto('/blog/', { waitUntil: 'domcontentloaded' });
  for (const lang of archiveLangs) {
    await expect(page.locator(`main header a[href="/blog/${lang}/"]`)).toHaveCount(1);
  }
});

for (const lang of archiveLangs) {
  test(`/blog/${lang}/ archive links English and the other languages`, async ({ page }) => {
    await page.goto(`/blog/${lang}/`, { waitUntil: 'domcontentloaded' });
    const nav = page.locator('main header nav[aria-label]');
    await expect(nav.locator('a[href="/blog/"]')).toHaveCount(1);
    for (const other of archiveLangs.filter((l) => l !== lang)) {
      await expect(nav.locator(`a[href="/blog/${other}/"]`)).toHaveCount(1);
    }
    await expect(nav.locator('[aria-current="true"]')).toHaveCount(1);
  });
}
