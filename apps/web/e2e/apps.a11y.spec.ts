/**
 * apps.a11y.spec.ts - accessibility + input-hygiene guard for every /apps/[slug].
 *
 * Added 2026-10-02 after the full app review found the same three classes of
 * defect over and over: form controls with no accessible name, icon-only
 * buttons with no label, and number inputs with no max (the platform rule is
 * "clamp numeric inputs, min AND max"). These are invisible in a screenshot, so
 * they regress silently unless something checks for them.
 *
 * Scope is the calculator island only (site chrome has its own coverage).
 * Hidden controls are skipped: a collapsed <details> or an inactive tab is not
 * a defect until it is shown.
 */
import { test, expect } from '@playwright/test';
import { appSlugs } from './helpers';

interface Finding { kind: string; desc: string }

for (const slug of appSlugs()) {
  test(`/apps/${slug} controls are labelled and clamped`, async ({ page }) => {
    await page.goto(`/apps/${slug}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#calculator-island')).toBeVisible();
    await page.waitForTimeout(500);

    const findings: Finding[] = await page.evaluate(() => {
      const root = document.getElementById('calculator-island');
      if (!root) return [{ kind: 'missing', desc: '#calculator-island' }];
      const out: { kind: string; desc: string }[] = [];
      const visible = (el: Element) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const describe = (el: Element) => {
        const h = el as HTMLElement;
        return `<${el.tagName.toLowerCase()}${h.id ? ' id=' + h.id : ''}${(el as HTMLInputElement).type ? ' type=' + (el as HTMLInputElement).type : ''}${h.className && typeof h.className === 'string' ? ' class="' + h.className.slice(0, 40) + '"' : ''}>`;
      };
      const textOf = (id: string) => document.getElementById(id)?.textContent?.trim() ?? '';
      const hasName = (el: Element): boolean => {
        const h = el as HTMLElement;
        if (h.getAttribute('aria-label')?.trim()) return true;
        const lb = h.getAttribute('aria-labelledby');
        if (lb && lb.split(/\s+/).some(id => textOf(id))) return true;
        if (h.id && document.querySelector(`label[for="${CSS.escape(h.id)}"]`)) return true;
        if (h.closest('label')) return true;
        if (h.getAttribute('title')?.trim()) return true;
        return false;
      };

      root.querySelectorAll('input, select, textarea').forEach(el => {
        const inp = el as HTMLInputElement;
        if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inp.type)) return;
        // File inputs are routinely visually hidden behind a styled drop zone.
        if (inp.type === 'file') return;
        if (!visible(el)) return;
        if (!hasName(el)) out.push({ kind: 'unlabelled-control', desc: describe(el) });
        if (inp.type === 'number' && (!inp.hasAttribute('min') || !inp.hasAttribute('max'))) {
          out.push({ kind: 'unclamped-number', desc: describe(el) });
        }
      });

      root.querySelectorAll('button, [role="button"]').forEach(el => {
        if (!visible(el)) return;
        const h = el as HTMLElement;
        const text = (h.innerText || h.textContent || '').trim();
        // A symbol-only label ("+", an arrow, an emoji) is not a usable name;
        // any letter or digit is (calculator keys "7", speed "2x").
        const meaningful = /[\p{L}\p{N}]/u.test(text);
        if (!meaningful && !hasName(el)) out.push({ kind: 'unnamed-button', desc: describe(el) + ` text="${text.slice(0, 8)}"` });
      });
      return out;
    });

    // Report every finding at once so one run surfaces the whole list.
    expect(findings, `${slug}:\n - ${findings.map(f => `${f.kind}: ${f.desc}`).join('\n - ')}`).toEqual([]);
  });
}
