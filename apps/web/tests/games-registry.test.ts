/**
 * games-registry.test.ts - the /games/ section is consistent.
 *
 * Pins: every registered game has a guide page in category `fun` and a calculator;
 * every genre used exists and has enough games for its hub; no game is also a tool;
 * the games hub copy stays within SEO limits; every game that used to live under
 * /apps/<slug>/ has a 301 to /games/<slug>/ in public/_redirects (page URL with and
 * without the slash, and the social image).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  GAME_GENRE, GAME_SLUGS, GENRES, GENRE_ORDER, MIN_GAMES_FOR_GENRE, gamePageTitle, genreUrl, isGame, itemUrl,
} from '../src/lib/utils/games';

const WEB = resolve(__dirname, '..');
const CONTENT = join(WEB, 'src/content/apps');
const redirects = readFileSync(join(WEB, 'public/_redirects'), 'utf8').replace(/\r\n/g, '\n');
const calcMap = readFileSync(join(WEB, 'src/components/apps/calculator-map.ts'), 'utf8');

const guideFm = (slug: string): string => {
  const raw = readFileSync(join(CONTENT, `${slug}.md`), 'utf8').replace(/\r\n/g, '\n');
  return raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
};

describe('games registry', () => {
  it('has no duplicate slugs and every slug is lower-case kebab', () => {
    expect(new Set(GAME_SLUGS).size).toBe(GAME_SLUGS.length);
    for (const s of GAME_SLUGS) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every genre is known, and every genre hub has enough games', () => {
    for (const s of GAME_SLUGS) expect(GENRES[GAME_GENRE[s]], s).toBeDefined();
    for (const g of GENRE_ORDER) {
      const n = GAME_SLUGS.filter((s) => GAME_GENRE[s] === g).length;
      expect(n, `${g} games`).toBeGreaterThanOrEqual(MIN_GAMES_FOR_GENRE);
    }
  });

  it('genre copy fits search snippets and has no em-dash', () => {
    for (const g of GENRE_ORDER) {
      const m = GENRES[g];
      expect(m.title.length, `${g} title`).toBeLessThanOrEqual(60);
      expect(m.description.length, `${g} description`).toBeLessThanOrEqual(160);
      expect(m.description.length, `${g} description`).toBeGreaterThan(80);
      expect(`${m.heading}${m.title}${m.description}${m.intro}`).not.toContain('—');
    }
  });

  it('every game has a guide page in category fun that is not archived, and a calculator entry', () => {
    for (const s of GAME_SLUGS) {
      expect(existsSync(join(CONTENT, `${s}.md`)), `${s} guide`).toBe(true);
      const fm = guideFm(s);
      expect(fm, `${s} category`).toMatch(/^category:\s*"?fun"?\s*$/m);
      expect(fm, `${s} status`).not.toMatch(/^status:\s*"?archived"?\s*$/m);
      expect(calcMap, `${s} calculator entry`).toMatch(new RegExp(`^\\s*'${s}'\\s*:`, 'm'));
    }
  });

  it('every fun guide that is not a game is one of the known tools (nothing falls between the two sections)', () => {
    const funTools = readdirSync(CONTENT)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .map((f) => f.replace(/\.md$/, ''))
      .filter((s) => /^category:\s*"?fun"?\s*$/m.test(guideFm(s)) && !isGame(s))
      .sort();
    expect(funTools).toEqual(['ambigram-maker', 'coin-flipper', 'dice-roller', 'global-clock']);
  });

  it('game page titles say free online game and stay within 60 characters', () => {
    expect(gamePageTitle('Sudoku')).toBe('Sudoku - Free Online Game | gekro');
    expect(gamePageTitle('A Very Long Game Title That Does Not Fit At All Here').length).toBeLessThanOrEqual(60);
    for (const s of GAME_SLUGS) {
      const title = guideFm(s).match(/^title:s*"?(.*?)"?s*$/m)?.[1] ?? s;
      expect(gamePageTitle(title).length, s).toBeLessThanOrEqual(60);
    }
  });

  it('URL helpers send games to /games/ and tools to /apps/', () => {
    expect(itemUrl('sudoku')).toBe('/games/sudoku/');
    expect(itemUrl('json-formatter')).toBe('/apps/json-formatter/');
    expect(genreUrl('board')).toBe('/games/category/board/');
    expect(isGame('__proto__')).toBe(false);
    expect(isGame('constructor')).toBe(false);
  });
});

describe('redirects from /apps/<game>/ to /games/<game>/', () => {
  const rules = [...redirects.matchAll(/^\/apps\/([a-z0-9-]+)\/\s+\/games\/([a-z0-9-]+)\/\s+301\s*$/gm)].map((m) => ({ from: m[1], to: m[2] }));

  it('the 79 games that lived under /apps/ each have a 301 for the slash URL, the no-slash URL and the OG image', () => {
    expect(rules.length).toBeGreaterThanOrEqual(79);
    for (const r of rules) {
      expect(r.from).toBe(r.to);
      expect(isGame(r.from), `${r.from} is a registered game`).toBe(true);
      expect(redirects, `${r.from} no-slash`).toContain(`/apps/${r.from}  /games/${r.from}/  301`);
      expect(redirects, `${r.from} og`).toContain(`/og/apps/${r.from}.png  /og/games/${r.from}.png  301`);
    }
  });

  it('never redirects a tool, and never sends a game anywhere but its own page', () => {
    for (const line of redirects.split('\n')) {
      const m = line.match(/^\/apps\/([a-z0-9-]+)\/?\s+(\S+)\s+301/);
      if (!m) continue;
      expect(isGame(m[1]), `${m[1]} is a game`).toBe(true);
      expect(m[2]).toBe(`/games/${m[1]}/`);
    }
  });
});
