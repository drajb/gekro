/**
 * apps-seo.test.ts - guards for the /apps SEO helpers (lib/utils/apps-seo.ts).
 *
 * Locks in: titles that fit Google's display width, category copy within
 * snippet limits and free of em-dashes, and a deterministic related-apps
 * ranking that never links a page to itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATEGORY_META, TITLE_MAX, appPageTitle, relatedApps, type RelatableApp } from '../src/lib/utils/apps-seo';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'src/content/apps');

const field = (raw: string, name: string): string => {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = fm?.[1].split(/\r?\n/).find(l => l.startsWith(`${name}:`)) ?? '';
  return line.slice(name.length + 1).replace(/#.*$/, '').trim().replace(/^['"]|['"]$/g, '');
};

const apps: RelatableApp[] = readdirSync(contentDir)
  .filter(f => f.endsWith('.md') && !f.startsWith('_'))
  .map(f => {
    const raw = readFileSync(join(contentDir, f), 'utf8');
    return {
      id: f.replace(/\.md$/, ''),
      data: {
        title: field(raw, 'title'),
        job: field(raw, 'job'),
        category: field(raw, 'category'),
        companionPostSlug: field(raw, 'companionPostSlug') || undefined,
      },
    };
  });

describe('appPageTitle', () => {
  it('adds the free/online modifier when it fits', () => {
    expect(appPageTitle('JSON Formatter')).toBe('JSON Formatter - Free Online Tool | gekro');
  });
  it('falls back to the bare name when nothing else fits', () => {
    const long = 'Hyperscaler AI Pricing - Bedrock vs Foundry vs Vertex';
    expect(appPageTitle(long)).toBe(`${long} | gekro`);
  });
  it('keeps every real app title within the display limit where possible', () => {
    for (const a of apps) {
      const t = appPageTitle(a.data.title);
      const bare = `${a.data.title} | gekro`;
      expect(t.length <= TITLE_MAX || t === bare, `${a.id}: ${t}`).toBe(true);
    }
  });
});

describe('CATEGORY_META copy', () => {
  for (const [cat, m] of Object.entries(CATEGORY_META)) {
    it(`${cat}: title <= 60, description <= 160, no em-dash`, () => {
      expect(m.title.length, m.title).toBeLessThanOrEqual(60);
      expect(m.description.length, m.description).toBeLessThanOrEqual(160);
      for (const s of [m.title, m.description, m.intro, m.heading]) expect(s).not.toMatch(/—/);
    });
  }
});

describe('relatedApps', () => {
  it('returns 4 distinct apps, never the page itself, deterministically', () => {
    for (const a of apps) {
      const r1 = relatedApps(a, apps, 4).map(x => x.id);
      const r2 = relatedApps(a, apps, 4).map(x => x.id);
      expect(r1).toEqual(r2);
      expect(r1).not.toContain(a.id);
      expect(new Set(r1).size).toBe(r1.length);
      expect(r1.length).toBe(Math.min(4, apps.length - 1));
    }
  });
  it('prefers same-category siblings when the category has enough apps', () => {
    const llm = apps.find(a => a.id === 'llm-cost-calculator');
    if (!llm) return;
    const r = relatedApps(llm, apps, 4);
    expect(r.every(x => x.data.category === 'ai')).toBe(true);
  });
});
