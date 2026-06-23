/**
 * apps-integrity.test.ts — structural guarantees for the /apps platform.
 *
 * These are fast, node-context checks (no browser) that lock in the invariant
 * that broke silently before: an app's content/component/route mapping drifting
 * out of sync, which renders a "Calculator coming soon" stub instead of the app.
 *
 * Runs in CI on every push (cheap, deterministic). The browser-level "does it
 * actually work" smoke lives in e2e/apps.smoke.spec.ts (Playwright).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..'); // apps/web
const contentDir = join(webRoot, 'src/content/apps');
const compDir = join(webRoot, 'src/components/apps-private');
const slugRoute = join(webRoot, 'src/pages/apps', '[slug].astro');

const VALID_CATEGORIES = ['ai', 'infra', 'ev', 'trading', 'dev', 'finance', 'fun', 'health'];
const REQUIRED_FIELDS = ['title', 'category', 'job', 'description'];

function contentSlugs(): string[] {
  return readdirSync(contentDir)
    .filter((f) => f.endsWith('.md') && f !== '_template.md')
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

function mapKeys(): string[] {
  const src = readFileSync(slugRoute, 'utf8');
  // Scope to the CALCULATOR_MAP object literal so import lines / other quotes
  // can't be mistaken for keys.
  const start = src.indexOf('const CALCULATOR_MAP');
  const end = src.indexOf('export async function getStaticPaths');
  const block = src.slice(start, end);
  return [...block.matchAll(/^\s*'([a-z0-9-]+)'\s*:/gm)].map((m) => m[1]).sort();
}

function componentSlugs(): string[] {
  return readdirSync(compDir)
    .filter((name) => {
      const p = join(compDir, name);
      try {
        return statSync(p).isDirectory() && existsSync(join(p, 'Calculator.astro'));
      } catch {
        return false;
      }
    })
    .sort();
}

function frontmatter(slug: string): string {
  const raw = readFileSync(join(contentDir, `${slug}.md`), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

const content = contentSlugs();
const keys = mapKeys();
const comps = componentSlugs();

describe('apps integrity: content <-> CALCULATOR_MAP <-> components stay in sync', () => {
  it('discovers a healthy number of apps (>= 70)', () => {
    expect(content.length).toBeGreaterThanOrEqual(70);
  });

  it('every content app is wired in CALCULATOR_MAP (no silent "coming soon")', () => {
    const missing = content.filter((s) => !keys.includes(s));
    expect(missing, `content apps missing a CALCULATOR_MAP entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('every CALCULATOR_MAP key has a content file (no orphan map entries)', () => {
    const orphan = keys.filter((s) => !content.includes(s));
    expect(orphan, `CALCULATOR_MAP keys with no content file: ${orphan.join(', ')}`).toEqual([]);
  });

  it('every content app has a Calculator.astro component', () => {
    const missing = content.filter((s) => !comps.includes(s));
    expect(missing, `content apps with no Calculator.astro: ${missing.join(', ')}`).toEqual([]);
  });

  it('every component dir is referenced by content (no dead components)', () => {
    const unused = comps.filter((s) => !content.includes(s));
    expect(unused, `component dirs not referenced by any content: ${unused.join(', ')}`).toEqual([]);
  });
});

describe('apps frontmatter validity', () => {
  for (const slug of content) {
    it(`${slug}: has required frontmatter + a valid category`, () => {
      const fm = frontmatter(slug);
      expect(fm, `${slug}: no frontmatter block`).not.toBe('');
      for (const field of REQUIRED_FIELDS) {
        const present = new RegExp(`^${field}:\\s*\\S`, 'm').test(fm);
        expect(present, `${slug}: missing/empty "${field}"`).toBe(true);
      }
      const cat = fm.match(/^category:\s*["']?([a-z]+)["']?/m)?.[1];
      expect(VALID_CATEGORIES, `${slug}: invalid category "${cat}"`).toContain(cat);
    });
  }
});
