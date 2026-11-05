/**
 * games-hygiene.test.ts - rules every browser game must keep, checked on the source.
 *
 * Standing guard for the licensing and design rules in .gekro/docs/games-build-guide.md:
 *  - no third-party assets (images, audio, video, fonts, url(), data: blobs, scripts, iframes)
 *  - no network calls, no off-device URLs, no cookies or other storage than gk:game:<slug>
 *  - no hard-coded colours (hex, rgb, hsl, named): colour comes from the locked tokens
 *  - no Math.random, no innerHTML-style sinks, no eval
 *  - the page wires the shell events, aborts on swap, honours reduced motion, has a live region
 *  - no other company's trademark appears in a game's code or its guide page
 *  - the guide page follows the house rules (no em-dash, standard audience sentence, headings)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WEB = resolve(__dirname, '..');
const PRIVATE = join(WEB, 'src/components/apps-private');
const CONTENT = join(WEB, 'src/content/apps');

/** Games are the slugs that apps-seo.ts marks as GameApplication. */
const gameSlugs = (): string[] => {
  const seo = readFileSync(join(WEB, 'src/lib/utils/apps-seo.ts'), 'utf8');
  const registered = [...seo.matchAll(/'([a-z0-9-]+)':\s*'GameApplication'/g)].map((m) => m[1]);
  // While a game is being built it is not registered yet: GAMES_EXTRA=slug-a,slug-b includes it.
  const extra = (process.env.GAMES_EXTRA ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...registered, ...extra])].sort();
};

const lf = (s: string): string => s.replace(/\r\n?/g, '\n');

const stripComments = (s: string): string =>
  lf(s)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/(\s)\/\/\s.*$/gm, '$1');

const sourceFiles = (slug: string): { name: string; text: string }[] => {
  const dir = join(PRIVATE, slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(astro|ts)$/.test(f) && statSync(join(dir, f)).isFile())
    .map((f) => ({ name: f, text: stripComments(readFileSync(join(dir, f), 'utf8')) }));
};

const SLUGS = gameSlugs();

/** Other companies' names and marks. Never appear in a game's code or its guide page. */
const MARKS = [
  'Tetris', 'Wordle', 'Minesweeper', 'Connect 4', 'Connect Four', 'Othello', 'Mastermind', 'Picross', 'Simon Says',
  'Breakout', 'Arkanoid', 'Pong', 'Flappy', 'Frogger', 'Crossy', 'Angry Birds', 'Pac-Man', 'Pacman', 'Boggle', 'Scrabble',
  'Sokoban', 'Rush Hour', 'Candy Crush', 'Whac', 'Lunar Lander', 'Game of Life', 'Monopoly', 'Uno', 'Hasbro', 'Mattel',
  'Nintendo', 'Disney', 'Pokemon', 'Pokémon', 'Mario', 'Zelda', 'Minecraft', 'Lego', 'Bluey', 'Peppa', 'Paw Patrol',
  'Chutes and Ladders', 'Battleship', 'Yahtzee', 'Jenga', 'Twister', 'Bejeweled', 'Puzzle Bobble', 'Bust-a-Move',
  'Pipe Mania', 'Pipe Dream', 'Maze Runner', 'Nikoli', 'Slitherlink', 'Hashi', 'Kakuro', 'Futoshiki', 'KenKen', 'Flood-It',
  'Handwriting Without Tears', "D'Nealian", 'Zaner-Bloser', 'Google', 'Microsoft', 'Facebook', 'YouTube',
  'Takuzu', 'Binairo', 'Powder Toy', 'Pass the Pigs', 'Ravensburger', 'ThinkFun', 'FIDE', 'Cracker Barrel', 'Pente',
  'Rubik', 'Candy Land', 'Cluedo', 'Kalah', 'Lights Out',
];
// Case-sensitive on purpose: word lists hold lower-case words such as "apple" and "bluey", marks are capitalised or upper case.
const markRe = (m: string) => {
  const esc = m.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z])(${esc}|${esc.toUpperCase()})([^A-Za-z]|$)`);
};

describe('games hygiene: discovery', () => {
  it('finds the game list and every game has its folder, guide page and tests', () => {
    expect(SLUGS.length).toBeGreaterThanOrEqual(24);
    for (const slug of SLUGS) {
      expect(existsSync(join(PRIVATE, slug, 'Calculator.astro')), `${slug}: Calculator.astro`).toBe(true);
      expect(existsSync(join(PRIVATE, slug, 'helpers.ts')), `${slug}: helpers.ts`).toBe(true);
      expect(existsSync(join(CONTENT, `${slug}.md`)), `${slug}: content page`).toBe(true);
      expect(existsSync(join(WEB, 'tests', `games-${slug}.test.ts`)), `${slug}: engine test`).toBe(true);
    }
  });
});

describe.each(SLUGS)('games hygiene: %s source', (slug) => {
  const files = sourceFiles(slug);
  const all = files.map((f) => f.text).join('\n');
  const calc = files.find((f) => f.name === 'Calculator.astro')?.text ?? '';
  const scan = (re: RegExp) => files.filter((f) => re.test(f.text)).map((f) => f.name);

  it('uses no third-party assets and no off-device URLs', () => {
    expect(scan(/<(img|audio|video|iframe|embed|object|link)\b/i), 'tag').toEqual([]);
    expect(scan(/<script[^>]*\ssrc=/i), 'script src').toEqual([]);
    expect(scan(/@font-face|@import/i), 'font-face/import').toEqual([]);
    expect(scan(/\burl\(/i), 'css url()').toEqual([]);
    expect(scan(/\bdata:[a-z]+\/[a-z]/i), 'data: URI').toEqual([]);
    expect(scan(/https?:\/\//i), 'http URL').toEqual([]);
    expect(scan(/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|Worker)\s*\(/), 'network call').toEqual([]);
    expect(scan(/\bimport\s*\(/), 'dynamic import').toEqual([]);
  });

  it('imports only its own helpers and the shared url-state module', () => {
    const specs = [...all.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const bad = specs.filter((s) => s !== './helpers' && !/^\.\/[a-z0-9-]+$/.test(s) && s !== '../../apps/shared/url-state');
    expect(bad, `unexpected imports: ${bad.join(', ')}`).toEqual([]);
  });

  it('takes colour only from the locked tokens', () => {
    const hex = [...all.matchAll(/(?<![\w&-])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)].map((m) => m[0]);
    expect(hex, 'hex colour literals').toEqual([]);
    expect(scan(/\b(rgba?|hsla?|hwb|lab|lch)\(/i), 'rgb/hsl function').toEqual([]);
    // A var(--g-green) token reference is the point of the palette, not a colour literal.
    const noVars = all.replace(/var\(--[a-zA-Z0-9_-]+(?:\s*,[^)]*)?\)/g, 'var()');
    const named = [...noVars.matchAll(/(?:color|background|border|fill|stroke|outline|shadow)[a-z-]*\s*:\s*[^;{}]*\b(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|brown|cyan|magenta|gold|silver|navy|teal|lime)\b/gi)].map((m) => m[0]);
    expect(named, 'named colours').toEqual([]);
  });

  it('never uses Math.random, eval or an HTML-injection sink', () => {
    expect(scan(/\bMath\.random\b/), 'Math.random').toEqual([]);
    expect(scan(/\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|srcdoc)\b/), 'html sink').toEqual([]);
    expect(scan(/\beval\s*\(|new\s+Function\s*\(/), 'eval').toEqual([]);
    expect(scan(/\bset:html\b|\bis:raw\b/), 'astro raw html').toEqual([]);
  });

  it('has no static inline style attributes (data-driven style={...} expressions are fine)', () => {
    const markup = calc.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    expect(markup.match(/\sstyle\s*=\s*["']/g) ?? [], 'static style="" attributes in markup').toEqual([]);
  });

  it('stores only a small object under gk:game:<slug> (no cookies, session or indexed storage)', () => {
    expect(scan(/\b(document\.cookie|sessionStorage|indexedDB|caches\b|navigator\.serviceWorker)\b/), 'other storage').toEqual([]);
    if (/localStorage/.test(all)) {
      const keys = [...all.matchAll(/['"`](gk:[^'"`]+)['"`]/g)].map((m) => m[1]);
      expect(keys.length, 'a storage key literal').toBeGreaterThan(0);
      for (const k of keys) expect(k).toBe(`gk:game:${slug}`);
    }
  });

  it('wires the shell, cleans up on navigation, honours reduced motion and announces', () => {
    expect(calc).toMatch(/app:copy/);
    expect(calc).toMatch(/app:export/);
    expect(calc).toMatch(/app:reset/);
    expect(calc).toMatch(/AbortController/);
    expect(calc).toMatch(/astro:before-swap/);
    expect(calc).toMatch(/astro:after-swap/);
    // Anything that moves must say how it behaves under reduced motion.
    if (/\btransition\s*:|\banimation\s*:|@keyframes|requestAnimationFrame|\.animate\(/.test(all)) {
      expect(all).toMatch(/prefers-reduced-motion/);
    }
    expect(calc).toMatch(/aria-live/);
    expect(calc).toMatch(/<details/);
    expect(calc).toMatch(/_[a-z]{2,4}Init/);
  });

  it('contains no em-dash', () => {
    expect(files.map((f) => f.text.includes('—') ? f.name : '').filter(Boolean)).toEqual([]);
  });

  it('names no other company or trademark', () => {
    const hits = MARKS.filter((m) => markRe(m).test(all));
    expect(hits, `trademarks in code: ${hits.join(', ')}`).toEqual([]);
  });
});

describe.each(SLUGS)('games hygiene: %s guide page', (slug) => {
  const raw = existsSync(join(CONTENT, `${slug}.md`)) ? lf(readFileSync(join(CONTENT, `${slug}.md`), 'utf8')) : '';
  const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const body = raw.replace(/^---\n[\s\S]*?\n---/, '');
  const field = (k: string) => fm.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1] ?? '';

  it('has the required frontmatter', () => {
    expect(field('category')).toBe('fun');
    expect(field('status')).toBe('active');
    for (const k of ['title', 'job', 'description', 'aiSummary', 'personalUse', 'publishedAt', 'lastVerified', 'license', 'icon']) {
      expect(field(k).length, k).toBeGreaterThan(0);
    }
    expect(field('description').length).toBeLessThanOrEqual(160);
    expect(field('publishedAt')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(field('lastVerified')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens personalUse with the standard audience sentence', () => {
    expect(field('personalUse')).toMatch(/^I built this for my kids to play and learn, and anyone is welcome to use it, with no ads\./);
  });

  it('has a How to play section, at least one more section, and a sensible length', () => {
    expect(body).toMatch(/^## How to play/m);
    expect((body.match(/^## /gm) ?? []).length).toBeGreaterThanOrEqual(2);
    const words = body.split(/\s+/).filter(Boolean).length;
    expect(words, `${words} words`).toBeGreaterThanOrEqual(350);
    expect(words, `${words} words`).toBeLessThanOrEqual(2000);
  });

  it('has no em-dash and no AI-vocabulary filler', () => {
    expect(raw.includes('—')).toBe(false);
    const bad = raw.match(/\b(delve|tapestry|seamless(ly)?|robust|leverag(e|es|ing)|testament|vibrant|landscape|crucial|pivotal)\b/gi) ?? [];
    expect(bad).toEqual([]);
  });

  it('names no other company or trademark', () => {
    const hits = MARKS.filter((m) => markRe(m).test(raw));
    expect(hits, `trademarks on the page: ${hits.join(', ')}`).toEqual([]);
  });

  it('does not point at private source or off-site links', () => {
    expect(raw).not.toMatch(/https?:\/\//i);
    expect(raw).not.toMatch(/files you can read|view the source|open source code/i);
  });
});

// Every app's <style is:global> is bundled into every /apps page, so two apps that share a root id
// prefix (or a keyframes name) restyle each other. This bit three games on 2026-11-05.
describe("apps hygiene: global styles cannot collide", () => {
  const appDirs = readdirSync(PRIVATE).filter((d) => existsSync(join(PRIVATE, d, "Calculator.astro")));
  const roots = new Map<string, string[]>();
  const frames = new Map<string, string[]>();
  for (const d of appDirs) {
    const src = lf(readFileSync(join(PRIVATE, d, "Calculator.astro"), "utf8"));
    const root = src.match(/id="([a-z0-9]+)-app"/)?.[1];
    if (root) roots.set(root, [...(roots.get(root) ?? []), d]);
    for (const m of src.matchAll(/@keyframess+([A-Za-z0-9_-]+)/g)) frames.set(m[1], [...new Set([...(frames.get(m[1]) ?? []), d])]);
  }
  it("gives every app a root id prefix no other app uses", () => {
    const dup = [...roots].filter(([, v]) => v.length > 1).map(([k, v]) => k + ": " + v.join(", "));
    expect(dup, "shared root prefixes: " + dup.join(" | ")).toEqual([]);
  });
  it("gives every @keyframes name to one app only", () => {
    const dup = [...frames].filter(([, v]) => v.length > 1).map(([k, v]) => k + ": " + v.join(", "));
    expect(dup, "shared keyframes: " + dup.join(" | ")).toEqual([]);
  });
});

describe("apps hygiene: file encoding", () => {
  // A stray byte in a CSS string once turned a tick mark into a replacement character; no unit test saw it.
  const dec = new TextDecoder("utf-8", { fatal: true });
  const files: string[] = [];
  for (const d of readdirSync(PRIVATE)) {
    const dir = join(PRIVATE, d);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (/\.(astro|ts)$/.test(f)) files.push(join(dir, f));
  }
  for (const f of readdirSync(CONTENT)) if (f.endsWith(".md")) files.push(join(CONTENT, f));
  it("keeps every game source and guide page valid UTF-8 with no replacement character", () => {
    const bad: string[] = [];
    for (const f of files) {
      try {
        if (dec.decode(readFileSync(f)).includes("�")) bad.push(f + " (replacement character)");
      } catch {
        bad.push(f + " (invalid UTF-8)");
      }
    }
    expect(bad).toEqual([]);
  });
});
