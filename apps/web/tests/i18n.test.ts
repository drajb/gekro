/**
 * i18n.test.ts - integrity tests for the multilingual blog layer
 *
 * Fast, deterministic, no browser (runs in CI with the other unit tests):
 *  - the language registry is internally consistent
 *  - every language has every UI string, with the same placeholders and no
 *    em-dashes
 *  - the script that astro.config.mjs and verify-i18n.mjs use to read the
 *    registry still parses all of it
 *  - the real translations on disk pass scripts/verify-i18n.mjs
 *  - no English post slug collides with a language code
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { LANGUAGES, getLanguage, isLanguageCode, fontHref } from '../src/lib/languages';
import { STRINGS, t, arrows, type UIKey } from '../src/lib/i18n';

const WEB = resolve(__dirname, '..');
const ROOT = resolve(WEB, '../..');

describe('language registry', () => {
  it('lists the eight approved languages', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['ar', 'bn', 'es', 'hi', 'mr', 'ta', 'te', 'zh']);
  });

  it('has unique codes and bcp47 tags', () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
    expect(new Set(LANGUAGES.map((l) => l.bcp47)).size).toBe(LANGUAGES.length);
  });

  it('marks only Arabic as right-to-left', () => {
    expect(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar']);
  });

  it('forces Latin digits in every date locale', () => {
    for (const l of LANGUAGES) expect(l.dateLocale).toContain('-u-nu-latn');
  });

  it('looks languages up by code', () => {
    expect(getLanguage('hi')?.endonym).toBe('हिन्दी');
    expect(getLanguage('en')).toBeUndefined();
    expect(isLanguageCode('zh')).toBe(true);
    expect(isLanguageCode('fr')).toBe(false);
  });

  it('builds a Google Fonts URL only for non-Latin scripts', () => {
    expect(fontHref(getLanguage('es'))).toBeNull();
    expect(fontHref(getLanguage('ar'))).toContain('Noto+Sans+Arabic');
    expect(fontHref(undefined)).toBeNull();
  });

  it('is fully parsed by the regexes the build scripts use', () => {
    const src = readFileSync(join(WEB, 'src/lib/languages.ts'), 'utf8');
    const full = [...src.matchAll(/\{ code: '([a-z]{2})'[^}]*?bcp47: '([A-Za-z-]+)'[^}]*?dir: '(ltr|rtl)'[^}]*?titleMax: (\d+) \}/g)];
    const og = [...src.matchAll(/\{ code: '([a-z]{2})'[^}]*?ogLocale: '([A-Za-z_]+)'/g)];
    expect(full).toHaveLength(LANGUAGES.length);
    expect(og).toHaveLength(LANGUAGES.length);
  });
});

describe('UI strings', () => {
  const keys = Object.keys(STRINGS.en) as UIKey[];

  it('exist for English and every registered language', () => {
    expect(Object.keys(STRINGS).sort()).toEqual(['en', ...LANGUAGES.map((l) => l.code)].sort());
  });

  it('define every key in every language and nothing extra', () => {
    for (const [code, table] of Object.entries(STRINGS)) {
      expect(Object.keys(table).sort(), code).toEqual([...keys].sort());
      for (const k of keys) expect(table[k].trim().length, `${code}.${k}`).toBeGreaterThan(0);
    }
  });

  it('keep the same placeholders as English', () => {
    const ph = (s: string) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',');
    for (const [code, table] of Object.entries(STRINGS)) {
      for (const k of keys) expect(ph(table[k]), `${code}.${k}`).toBe(ph(STRINGS.en[k]));
    }
  });

  it('contain no em-dash (U+2014)', () => {
    for (const [code, table] of Object.entries(STRINGS)) {
      for (const k of keys) expect(table[k], `${code}.${k}`).not.toContain('—');
    }
  });

  it('substitutes placeholders and falls back to English', () => {
    expect(t('es', 'minRead', { n: 8 })).toBe('8 min de lectura');
    expect(t(undefined, 'minRead', { n: 8 })).toBe('8 min read');
    expect(t('xx', 'tldr')).toBe('TL;DR');
  });

  it('flips arrows for right-to-left text', () => {
    expect(arrows('ltr')).toEqual({ back: '←', forward: '→' });
    expect(arrows('rtl')).toEqual({ back: '→', forward: '←' });
  });
});

describe('content', () => {
  it('has no English slug equal to a language code', () => {
    const slugs = readdirSync(join(WEB, 'src/content/blog'))
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .map((f) => f.replace(/\.md$/, ''));
    for (const s of slugs) expect(isLanguageCode(s), s).toBe(false);
  });

  it('keeps every translation passing scripts/verify-i18n.mjs', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/verify-i18n.mjs')], { encoding: 'utf8' });
    expect(r.stderr + r.stdout).toContain('[verify-i18n]');
    expect(r.status, r.stderr + r.stdout).toBe(0);
  });
});
