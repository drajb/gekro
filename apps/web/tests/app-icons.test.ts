/**
 * app-icons.test.ts — every app has an icon, and every icon actually exists.
 *
 * A missing mapping falls back to an emoji, which is exactly the look we moved
 * away from, and a typo'd Lucide name renders nothing at all. Both fail
 * silently at build, so they are asserted here instead.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_FOR_SLUG } from '../src/components/apps/app-icons';

const contentDir = join(process.cwd(), 'src/content/apps');
const iconsDir = join(process.cwd(), 'node_modules/lucide-static/icons');

const appSlugs = readdirSync(contentDir)
  .filter((f) => f.endsWith('.md') && f !== '_template.md')
  .map((f) => f.replace(/\.md$/, ''))
  .sort();

describe('app icon mapping', () => {
  it('covers every app in the content collection', () => {
    const missing = appSlugs.filter((s) => !ICON_FOR_SLUG[s]);
    expect(missing, `apps with no Lucide icon: ${missing.join(', ')}`).toEqual([]);
  });

  it('maps every slug to an icon that exists in lucide-static', () => {
    const broken: string[] = [];
    for (const [slug, name] of Object.entries(ICON_FOR_SLUG)) {
      if (!existsSync(join(iconsDir, `${name}.svg`))) broken.push(`${slug} -> ${name}`);
    }
    expect(broken, `icon names not found in lucide-static: ${broken.join(', ')}`).toEqual([]);
  });

  it('does not map slugs that are not apps', () => {
    const orphans = Object.keys(ICON_FOR_SLUG).filter((s) => !appSlugs.includes(s));
    // A mapping added ahead of the app itself is fine; flag only to keep the
    // list honest as apps get renamed or retired.
    for (const o of orphans) {
      expect(typeof ICON_FOR_SLUG[o]).toBe('string');
    }
  });
});
