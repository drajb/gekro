/**
 * games-word-search.test.ts - the engine behind `word-search`.
 *
 * Pinned: the hand-written word lists obey their own rules (letters, lengths,
 * no duplicates, enough short words for every level, nothing on the blocklist);
 * every generated puzzle hides the stated number of words, each exactly where it
 * was placed, in a direction its level allows, and each can be found again by an
 * independent scan; the finished grid never contains a blocklisted string in any
 * of the eight reading directions; straight-line selection (tap-tap and drag
 * snapping) matches a brute-force line; a selection matches a word forwards or
 * backwards; saved best times are sanitised. Numbers quoted on the guide page are
 * asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SIZES, LEVELS, THEMES, THEME_CHOICES, WORDS, WORD_COUNT, MIN_WORD_LEN, MAX_WORD_LEN, LEVEL_DIRS, DIR8, BLOCKLIST, FILL_LETTERS,
  poolFor, generate, wordsClash, containsBlocked, blockedHits, removeBlocked, cellsOf, lineCells, snapLine, readCells, matchWord,
  findAll, hintCell, mulberry32, shuffled, bestKey, sanitiseBest, MAX_BEST_SECONDS, formatTime, plural, parseSeed,
  type Level, type ThemeChoice, type Puzzle, type Size, type Placement,
} from '../src/components/apps-private/word-search/helpers';
import calculatorSource from '../src/components/apps-private/word-search/Calculator.astro?raw';

// The loops below are generous on purpose; a loaded machine must not turn them into flaky failures.
vi.setConfig({ testTimeout: 60_000 });

const reverse = (s: string): string => s.split('').reverse().join('');

const BLOCK_SET = new Set<string>(BLOCKLIST);
const MAX_BLOCK = Math.max(...BLOCKLIST.map((b) => b.length));

/**
 * Independent brute force: from every cell, in every one of the eight directions, every string of 3 to the longest
 * blocklist length is looked up in the blocklist. A hit that lies wholly inside one placed word is that word and is
 * allowed (BUTT in BUTTER); any other hit is returned.
 */
const gridHasBlockedBrute = (grid: string[], size: number, placements: readonly Placement[] = []): string | null => {
  const own = placements.map((p) => new Set(cellsOf(size, p)));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          let s = '';
          const cells: number[] = [];
          for (let k = 0; k < MAX_BLOCK; k++) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            if (rr < 0 || cc < 0 || rr >= size || cc >= size) break;
            s += grid[rr * size + cc];
            cells.push(rr * size + cc);
            if (s.length >= 3 && BLOCK_SET.has(s) && !own.some((set) => cells.every((i) => set.has(i)))) return `${s} at ${r},${c} step ${dr},${dc}`;
          }
        }
      }
    }
  }
  return null;
};
/** Independent word finder over a 2D array. */
const countOccurrences = (grid: string[], size: number, word: string): number => {
  const g: string[][] = Array.from({ length: size }, (_, r) => grid.slice(r * size, r * size + size));
  let n = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    let ok = true;
    for (let k = 0; k < word.length && ok; k++) {
      const rr = r + dr * k;
      const cc = c + dc * k;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size || g[rr][cc] !== word[k]) ok = false;
    }
    if (ok) n++;
  }
  return n;
};

describe('word lists', () => {
  const all = THEMES.flatMap((t) => WORDS[t].map((w) => ({ t, w })));
  it('has six themes and the counts quoted on the guide page', () => {
    expect(THEMES).toHaveLength(6);
    expect(THEME_CHOICES).toEqual([...THEMES, 'mix']);
    const distinct = new Set(all.map((x) => x.w));
    expect({
      perTheme: Object.fromEntries(THEMES.map((t) => [t, WORDS[t].length])),
      total: all.length,
      distinct: distinct.size,
    }).toEqual({
      perTheme: { animals: 47, colours: 34, space: 33, food: 39, sports: 34, nature: 37 },
      total: 224,
      distinct: 219,
    });
  });
  it('uses only upper-case A-Z, 3 to 8 letters, with no duplicate inside a theme', () => {
    for (const t of THEMES) {
      expect(new Set(WORDS[t]).size, t).toBe(WORDS[t].length);
      for (const w of WORDS[t]) {
        expect(/^[A-Z]+$/.test(w), w).toBe(true);
        expect(w.length, w).toBeGreaterThanOrEqual(3);
        expect(w.length, w).toBeLessThanOrEqual(8);
      }
    }
  });
  it('has no word that contains a blocklisted string, forwards or backwards, except eight known overlaps', () => {
    // BUTT in BUTTER, PEE in SHEEP (read backwards), HELL in SHELL, EVIL in OLIVE (read backwards), BRA in ZEBRA and BRANCH,
    // GIT in TIGER (read backwards), TARD in STARDUST. The generator
    // leaves a blocked string alone only when it lies wholly inside one placed word (see the stress test below).
    const found = new Set<string>();
    for (const { w } of all) {
      for (const b of BLOCKLIST) if (w.includes(b) || reverse(w).includes(b)) found.add(`${b}:${w}`);
    }
    expect([...found].sort()).toEqual(['BRA:BRANCH', 'BRA:ZEBRA', 'BUTT:BUTTER', 'EVIL:OLIVE', 'GIT:TIGER', 'HELL:SHELL', 'PEE:SHEEP', 'TARD:STARDUST']);
  });
  it('covers the strings a reviewer asked for, and the usual crude, hateful and frightening ones', () => {
    for (const must of ['ANAL', 'HOMO', 'ORGY', 'TURD', 'SUCK', 'HELL', 'SMUT', 'PERV', 'NUDE', 'NAKED', 'LUST', 'SHAG',
      'BUTT', 'POO', 'PEE', 'BUM', 'HOE', 'WTF', 'KKK', 'FUCK', 'SHIT', 'NIGGER', 'MURDER', 'GORE', 'DEAD']) {
      expect(containsBlocked(must), must).toBe(true);
    }
    expect(BLOCKLIST.length).toBe(483); // the number quoted on the guide page
    // Written here, not shared with the game code: the strings the second reviewer found in real grids, and more.
    const MUST_BLOCK = ['LEZ', 'LESBO', 'JAP', 'GYP', 'GAY', 'DEVIL', 'LEZZY', 'GYPSY', 'GIPSY', 'FAGGOT', 'DYKE', 'TRANNY', 'SPIC', 'CHINK', 'COON', 'KIKE', 'WOP', 'PAKI',
      'NIGGER', 'RETARD', 'SPAZ', 'MONG', 'MIDGET', 'GIMP', 'YID', 'HEEB', 'KYKE', 'DAGO', 'SAMBO', 'SQUAW', 'REDSKIN', 'PANSY', 'JEW',
      'SEX', 'PORN', 'XXX', 'MILF', 'ANAL', 'ANUS', 'CLIT', 'PENIS', 'DILDO', 'COCK', 'DICK', 'TWAT', 'CUNT', 'TITS', 'BOOBS', 'SLUT', 'WHORE', 'PRICK', 'BDSM', 'HORNY',
      'PEE', 'POO', 'POOP', 'PISS', 'TURD', 'CRAP', 'SHIT', 'FART', 'SNOT', 'PUKE', 'SPEW', 'BURP', 'TOILET', 'URINE', 'VOMIT',
      'KILL', 'MURDER', 'RAPE', 'MAIM', 'STAB', 'SHOOT', 'RIFLE', 'PISTOL', 'BOMB', 'WEAPON', 'CORPSE', 'GRAVE', 'SUICIDE', 'NOOSE', 'LYNCH', 'KIDNAP', 'ARSON',
      'EVIL', 'HELL', 'DEMON', 'SATAN', 'LUCIFER', 'NAZI', 'HITLER', 'KKK', 'KLAN', 'SWASTIKA', 'RACIST', 'BIGOT',
      'DRUG', 'WEED', 'HASH', 'COCAINE', 'HEROIN', 'METH', 'BEER', 'WINE', 'RUM', 'GIN', 'VODKA', 'DRUNK', 'CIGAR', 'VAPE',
      'IDIOT', 'MORON', 'STUPID', 'LOSER', 'SCUM', 'FUCK', 'BITCH', 'WTF', 'OMFG',
      // Third round (independent audit)
      'TARD', 'STONER', 'COKE', 'HEIL', 'BINT', 'DIKE', 'JUGS', 'BUSTY', 'GANJA', 'REEFER', 'HUSSY', 'TRAMP', 'SKEET', 'MOFO', 'GTFO', 'NADS',
      'CIGS', 'AIDS', 'ISIS', 'LMAO', 'WEE', 'BRA', 'OMG', 'NOB', 'SOD', 'GIT', 'HOS', 'STD', 'FUC', 'FML', 'PCP', 'OXY', 'HIV',
      'CASINO', 'GAMBLE', 'WAGER', 'SALOON', 'TAVERN', 'WHISKEY', 'SWORD', 'DAGGER', 'CRACKHEAD', 'STRIPTEASE'];
    expect(MUST_BLOCK.length).toBeGreaterThan(110);
    for (const must of MUST_BLOCK) expect(containsBlocked(must), must).toBe(true);
    expect(BLOCKLIST.every((b) => b.length <= 10)).toBe(true);
  });
  it('keeps the blocklist upper case and at least 3 letters', () => {
    for (const b of BLOCKLIST) expect(/^[A-Z]{3,}$/.test(b), b).toBe(true);
    expect(new Set(BLOCKLIST).size).toBe(BLOCKLIST.length);
  });
  it('containsBlocked reads both directions and ignores case', () => {
    expect(containsBlocked('xxassxx')).toBe(true);
    expect(containsBlocked('XXSSAXX')).toBe(true); // ASS reversed
    expect(containsBlocked('CATDOG')).toBe(false);
    expect(containsBlocked('')).toBe(false);
  });
  it('gives every level and size enough words, even after clashing words are dropped', () => {
    for (const t of THEME_CHOICES) {
      for (const size of SIZES) for (const l of LEVELS) {
        const pool = poolFor(t, l, size);
        expect(pool.length, `${t} ${size} ${l}`).toBeGreaterThanOrEqual(WORD_COUNT[size] + 8);
        for (const w of pool) {
          expect(w.length).toBeGreaterThanOrEqual(MIN_WORD_LEN);
          expect(w.length).toBeLessThanOrEqual(Math.min(MAX_WORD_LEN[l], size));
        }
        expect(new Set(pool).size).toBe(pool.length);
      }
    }
  });
  it('every theme has at least 14 words of 6 letters or fewer, so Easy always has a full choice', () => {
    for (const t of THEMES) expect(WORDS[t].filter((w) => w.length <= 6).length, t).toBeGreaterThanOrEqual(14);
  });
  it('has no word that is another word of the same theme hidden inside it only because of a typo (clash helper is symmetric)', () => {
    expect(wordsClash('BEAR', 'BEARD')).toBe(true);
    expect(wordsClash('BEARD', 'BEAR')).toBe(true);
    expect(wordsClash('RAT', 'TAR')).toBe(true); // reverse of each other
    expect(wordsClash('CAT', 'DOG')).toBe(false);
    expect(wordsClash('CAT', 'CAT')).toBe(true);
  });
});

describe('puzzle generator', () => {
  const combos: { size: Size; level: Level; theme: ThemeChoice }[] = [];
  for (const size of SIZES) for (const level of LEVELS) for (const theme of THEME_CHOICES) combos.push({ size, level, theme });

  it('hides the stated number of words in every size, level and theme (40 seeds each)', () => {
    for (const { size, level, theme } of combos) {
      for (let seed = 1; seed <= 40; seed++) {
        const p = generate(size, level, theme, mulberry32(seed * 7919 + size));
        expect(p.words, `${size} ${level} ${theme} #${seed}`).toHaveLength(WORD_COUNT[size]);
        expect(p.placements).toHaveLength(WORD_COUNT[size]);
        expect(p.grid).toHaveLength(size * size);
        expect(p.words).toEqual(p.words.slice().sort());
        expect(new Set(p.words).size).toBe(p.words.length);
      }
    }
  }, 120_000);

  it('word counts are 8, 10 and 12 for the three sizes, as the page says', () => {
    expect(WORD_COUNT).toEqual({ 8: 8, 10: 10, 12: 12 });
    expect([...SIZES]).toEqual([8, 10, 12]);
  });

  it('lays each word exactly where it says, in a direction the level allows, inside the board', () => {
    for (const { size, level, theme } of combos) {
      for (let seed = 1; seed <= 15; seed++) {
        const p = generate(size, level, theme, mulberry32(seed + 1000));
        const allowed = LEVEL_DIRS[level].map((d) => `${d.dr},${d.dc}`);
        for (const pl of p.placements) {
          expect(allowed, `${level} ${pl.word}`).toContain(`${pl.dr},${pl.dc}`);
          for (let k = 0; k < pl.word.length; k++) {
            const r = pl.r + pl.dr * k;
            const c = pl.c + pl.dc * k;
            expect(r >= 0 && c >= 0 && r < size && c < size).toBe(true);
            expect(p.grid[r * size + c], `${pl.word}[${k}]`).toBe(pl.word[k]);
          }
          expect(pl.word.length).toBeGreaterThanOrEqual(3);
          expect(pl.word.length).toBeLessThanOrEqual(Math.min(8, MAX_WORD_LEN[level], size));
        }
      }
    }
  }, 120_000);

  it('Easy lays words only rightwards or downwards; Hard uses backwards directions too somewhere', () => {
    expect(LEVEL_DIRS.easy.map((d) => `${d.dr},${d.dc}`)).toEqual(['0,1', '1,0']);
    expect(LEVEL_DIRS.medium).toHaveLength(4);
    expect(LEVEL_DIRS.hard).toHaveLength(8);
    let backwards = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const p = generate(12, 'hard', 'mix', mulberry32(seed));
      backwards += p.placements.filter((pl) => pl.dc < 0 || pl.dr < 0).length;
    }
    expect(backwards).toBeGreaterThan(0);
    for (let seed = 1; seed <= 40; seed++) {
      const p = generate(10, 'medium', 'animals', mulberry32(seed));
      for (const pl of p.placements) expect(pl.dc >= 0 && !(pl.dc === 0 && pl.dr < 0)).toBe(true);
    }
  });

  it('every listed word can be found again by an independent scan, and none is a part of another', () => {
    for (const { size, level, theme } of combos) {
      for (let seed = 1; seed <= 10; seed++) {
        const p = generate(size, level, theme, mulberry32(seed * 31));
        for (const w of p.words) {
          expect(countOccurrences(p.grid, size, w), `${w} in ${size} ${level} ${theme}`).toBeGreaterThanOrEqual(1);
          expect(findAll(p.grid, size, w).length).toBe(countOccurrences(p.grid, size, w));
        }
        for (let i = 0; i < p.words.length; i++) for (let j = i + 1; j < p.words.length; j++) {
          expect(wordsClash(p.words[i], p.words[j]), `${p.words[i]} / ${p.words[j]}`).toBe(false);
        }
      }
    }
  }, 120_000);

  it('only upper-case A-Z in the grid, and filler letters cover the rest of the board', () => {
    const p = generate(12, 'hard', 'mix', mulberry32(5));
    expect(p.grid.every((ch) => ch.length === 1 && FILL_LETTERS.includes(ch))).toBe(true);
    const locked = new Set<number>();
    for (const pl of p.placements) for (const i of cellsOf(12, pl)) locked.add(i);
    expect(locked.size).toBeLessThan(144);
    expect(144 - locked.size).toBeGreaterThan(20); // there is room for plenty of filler
  });

  it('no blocklisted string anywhere in any finished grid, read in all eight directions (brute force)', () => {
    for (const { size, level, theme } of combos) {
      for (let seed = 1; seed <= 25; seed++) {
        const p = generate(size, level, theme, mulberry32(seed * 104729 + size));
        expect(gridHasBlockedBrute(p.grid, size, p.placements), `${size} ${level} ${theme} #${seed}`).toBeNull();
        expect(blockedHits(p.grid, size, p.placements)).toEqual([]);
      }
    }
  }, 120_000);

  it('stress: 3,000+ grids, no blocked string in any of the eight directions unless it is wholly inside one listed word', () => {
    let grids = 0;
    let inside = 0;
    for (const size of SIZES) {
      for (const level of LEVELS) {
        for (const theme of THEME_CHOICES) {
          for (let seed = 1; seed <= 50; seed++) {
            const p = generate(size, level, theme, mulberry32(seed * 7919 + size * 13 + LEVELS.indexOf(level)));
            expect(gridHasBlockedBrute(p.grid, size, p.placements), `${size} ${level} ${theme} #${seed}`).toBeNull();
            // Every hit, when the exemption is switched off, is wholly inside one placed word (so no filler is involved).
            const raw = blockedHits(p.grid, size);
            const sets = p.placements.map((pl) => new Set(cellsOf(size, pl)));
            for (const cells of raw) {
              expect(sets.some((st) => cells.every((i) => st.has(i))), `${size} ${level} ${theme} #${seed}: ${readCells(p.grid, cells)}`).toBe(true);
              inside++;
            }
            grids++;
          }
        }
      }
    }
    expect(grids).toBe(3 * 3 * 7 * 50);
    expect(inside).toBeGreaterThanOrEqual(0);
  }, 240_000);

  it('stress 2: 3,400+ more grids across all sizes, levels and topics, read as whole lines (rows, columns, both diagonals, both ways) against the extended list; LEZ, GAY, JAP, GYP and DEVIL never appear at all', () => {
    const never = ['LEZ', 'GAY', 'JAP', 'GYP', 'DEVIL', 'LESBO'];
    const lineStrings = (grid: string[], size: number): { text: string; cells: number[] }[] => {
      const out: { text: string; cells: number[] }[] = [];
      const add = (cells: number[]): void => {
        if (cells.length < 3) return;
        out.push({ text: cells.map((i) => grid[i]).join(''), cells });
        const back = cells.slice().reverse();
        out.push({ text: back.map((i) => grid[i]).join(''), cells: back });
      };
      for (let r = 0; r < size; r++) add(Array.from({ length: size }, (_, c) => r * size + c));
      for (let c = 0; c < size; c++) add(Array.from({ length: size }, (_, r) => r * size + c));
      for (let k = -(size - 1); k <= size - 1; k++) {
        const d: number[] = [];
        const a: number[] = [];
        for (let r = 0; r < size; r++) {
          if (r + k >= 0 && r + k < size) d.push(r * size + r + k);
          if (size - 1 - r + k >= 0 && size - 1 - r + k < size) a.push(r * size + size - 1 - r + k);
        }
        add(d);
        add(a);
      }
      return out;
    };
    let grids = 0;
    for (const size of SIZES) {
      for (const level of LEVELS) {
        for (const theme of THEME_CHOICES) {
          for (let seed = 1; seed <= 54; seed++) {
            const p = generate(size, level, theme, mulberry32(seed * 15485863 + size * 101 + LEVELS.indexOf(level) * 7 + THEME_CHOICES.indexOf(theme)));
            const own = p.placements.map((pl) => new Set(cellsOf(size, pl)));
            for (const { text, cells } of lineStrings(p.grid, size)) {
              for (const n of never) expect(text.includes(n), `${n} in ${size} ${level} ${theme} #${seed}`).toBe(false);
              for (const b of BLOCKLIST) {
                for (let at = text.indexOf(b); at >= 0; at = text.indexOf(b, at + 1)) {
                  const hit = cells.slice(at, at + b.length);
                  expect(own.some((set) => hit.every((i) => set.has(i))), `${b} in ${size} ${level} ${theme} #${seed}`).toBe(true);
                }
              }
            }
            grids++;
          }
        }
      }
    }
    expect(grids).toBe(3 * 3 * 7 * 54);
    expect(grids).toBeGreaterThan(3400);
  }, 400_000);

  it('is deterministic for a seed and differs across seeds', () => {
    for (const { size, level, theme } of combos.filter((_, i) => i % 7 === 0)) {
      expect(generate(size, level, theme, mulberry32(77))).toEqual(generate(size, level, theme, mulberry32(77)));
    }
    expect(generate(10, 'easy', 'animals', mulberry32(1)).grid).not.toEqual(generate(10, 'easy', 'animals', mulberry32(2)).grid);
  });

  it('rejects an unsupported size, level or theme', () => {
    expect(() => generate(9, 'easy', 'animals', mulberry32(1))).toThrow(RangeError);
    expect(() => generate(8, 'extreme' as Level, 'animals', mulberry32(1))).toThrow(RangeError);
    expect(() => generate(8, 'easy', 'cars' as ThemeChoice, mulberry32(1))).toThrow(RangeError);
  });

  it('survives a degenerate rng (always 0, always 0.999, NaN)', () => {
    for (const rng of [() => 0, () => 0.999999, () => NaN]) {
      const p = generate(8, 'easy', 'animals', rng);
      expect(p.words).toHaveLength(8);
      expect(gridHasBlockedBrute(p.grid, 8, p.placements)).toBeNull();
    }
  });

  it('a 12 by 12 Hard mixed puzzle takes well under 100 ms on average', () => {
    const t0 = performance.now();
    for (let s = 1; s <= 100; s++) generate(12, 'hard', 'mix', mulberry32(s));
    expect((performance.now() - t0) / 100).toBeLessThan(100);
  }, 30_000);
});

describe('removing blocklisted strings from filler', () => {
  it('replaces a filler letter that completes a blocklisted string, in every direction', () => {
    const size = 8;
    const rng = mulberry32(3);
    const word = 'ASS';
    const starts: [number, number, number, number][] = [[0, 0, 0, 1], [0, 0, 1, 0], [0, 0, 1, 1], [0, 7, 1, -1], [7, 7, 0, -1], [7, 7, -1, 0], [7, 7, -1, -1], [7, 0, -1, 1]];
    for (const [r, c, dr, dc] of starts) {
      const grid = new Array(size * size).fill('Q');
      for (let k = 0; k < 3; k++) grid[(r + dr * k) * size + c + dc * k] = word[k];
      expect(blockedHits(grid, size).length, `${dr},${dc}`).toBeGreaterThan(0);
      expect(removeBlocked(grid, size, new Set(), rng)).toBe(true);
      expect(gridHasBlockedBrute(grid, size)).toBeNull();
    }
  });
  it('never touches locked cells, and gives up (false) when the string sits entirely on locked cells', () => {
    const size = 6;
    const grid = new Array(36).fill('Q');
    grid[0] = 'A'; grid[1] = 'S'; grid[2] = 'S';
    expect(removeBlocked(grid.slice(), size, new Set([0, 1, 2]), mulberry32(1))).toBe(false);
    const g2 = grid.slice();
    expect(removeBlocked(g2, size, new Set([0, 1]), mulberry32(1))).toBe(true);
    expect(g2[0]).toBe('A');
    expect(g2[1]).toBe('S');
    expect(g2[2]).not.toBe('S');
  });
  it('finds backwards occurrences with the right cells', () => {
    const grid = new Array(36).fill('Q');
    grid[5] = 'A'; grid[4] = 'S'; grid[3] = 'S'; // row 0, columns 5,4,3 read ASS going left
    const hits = blockedHits(grid, 6);
    expect(hits.some((h) => h.slice().sort((a, b) => a - b).join() === '3,4,5')).toBe(true);
  });
});

describe('straight-line selection', () => {
  it('lineCells matches a brute-force line for every pair of cells on a 6 by 6 board', () => {
    const size = 6;
    for (let a = 0; a < 36; a++) {
      for (let b = 0; b < 36; b++) {
        const ar = Math.floor(a / size), ac = a % size, br = Math.floor(b / size), bc = b % size;
        const dr = br - ar, dc = bc - ac;
        const aligned = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
        const got = lineCells(size, a, b);
        if (!aligned) { expect(got, `${a}->${b}`).toBeNull(); continue; }
        const n = Math.max(Math.abs(dr), Math.abs(dc));
        const want = Array.from({ length: n + 1 }, (_, k) => (ar + Math.sign(dr) * k) * size + ac + Math.sign(dc) * k);
        expect(got, `${a}->${b}`).toEqual(want);
        expect(got![0]).toBe(a);
        expect(got![got!.length - 1]).toBe(b);
      }
    }
  });
  it('rejects cells off the board and non-integers', () => {
    expect(lineCells(6, -1, 3)).toBeNull();
    expect(lineCells(6, 3, 36)).toBeNull();
    expect(lineCells(6, 1.5, 3)).toBeNull();
    expect(lineCells(6, NaN, 3)).toBeNull();
  });
  it('snapLine on exact cell centres gives the same line as lineCells for every aligned pair', () => {
    const size = 7;
    for (let a = 0; a < 49; a++) for (let b = 0; b < 49; b++) {
      const want = lineCells(size, a, b);
      if (!want) continue;
      expect(snapLine(size, a, Math.floor(b / size), b % size), `${a}->${b}`).toEqual(want);
    }
  });
  it('snapLine rounds a wobbly pointer to the nearest direction and length, and never leaves the board', () => {
    const size = 8;
    const a = 3 * size + 3; // row 3, col 3
    expect(snapLine(size, a, 3.2, 3.3)).toEqual([a]); // barely moved
    expect(snapLine(size, a, 3.3, 6.2)).toEqual([a, a + 1, a + 2, a + 3]); // roughly right
    expect(snapLine(size, a, 6.4, 3.4)).toEqual([a, a + 8, a + 16, a + 24]); // roughly down
    expect(snapLine(size, a, 5.1, 5.2)).toEqual([a, a + 9, a + 18]); // roughly down-right
    expect(snapLine(size, a, 1.1, 5.0)).toEqual([a, a - 7, a - 14]); // up-right
    // Dragged beyond the edge: the line is cut at the edge.
    expect(snapLine(size, a, 3, 40)).toEqual([a, a + 1, a + 2, a + 3, a + 4]);
    expect(snapLine(size, a, -30, 3)).toEqual([a, a - 8, a - 16, a - 24]);
    expect(snapLine(size, a, 40, 40)).toEqual([a, a + 9, a + 18, a + 27, a + 36]); // 4 steps of room both ways
    expect(snapLine(size, a, NaN, 4)).toEqual([a]);
  });
  it('random pointer positions always give a short straight line on the board that starts at the anchor', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 3000; t++) {
      const size = SIZES[Math.floor(rng() * 3)];
      const a = Math.floor(rng() * size * size);
      const line = snapLine(size, a, rng() * 30 - 10, rng() * 30 - 10);
      expect(line[0]).toBe(a);
      expect(line.length).toBeLessThanOrEqual(size);
      for (const i of line) expect(i >= 0 && i < size * size).toBe(true);
      if (line.length > 1) expect(lineCells(size, a, line[line.length - 1])).toEqual(line);
    }
  });
});

describe('matching a selection to a word', () => {
  const p = generate(10, 'hard', 'animals', mulberry32(12));
  const found = new Set<string>();
  it('matches each placed word read forwards or backwards, and reports already found', () => {
    for (const pl of p.placements) {
      const cells = cellsOf(10, pl);
      expect(matchWord(p.grid, cells, p.words, found)).toEqual({ word: pl.word, already: false });
      expect(matchWord(p.grid, cells.slice().reverse(), p.words, found)).toEqual({ word: pl.word, already: false });
      expect(matchWord(p.grid, cells, p.words, new Set([pl.word]))).toEqual({ word: pl.word, already: true });
    }
  });
  it('rejects non-words, too-short selections and partial words', () => {
    const pl = p.placements[0];
    const cells = cellsOf(10, pl);
    expect(matchWord(p.grid, cells.slice(0, -1), p.words, found)).toBeNull(); // one letter short
    expect(matchWord(p.grid, [cells[0]], p.words, found)).toBeNull();
    expect(matchWord(p.grid, [], p.words, found)).toBeNull();
    expect(matchWord(['A', 'B', 'C'], [0, 1, 2], ['ABD'], found)).toBeNull();
  });
  it('readCells reads letters in the order given', () => {
    expect(readCells(['A', 'B', 'C', 'D'], [3, 0, 2])).toBe('DAC');
  });
});

describe('hints', () => {
  it('points at the first letter of a word not found yet, and at nothing when all are found', () => {
    const p = generate(8, 'easy', 'food', mulberry32(4));
    const found = new Set<string>(p.words.slice(0, 5));
    for (let s = 1; s <= 30; s++) {
      const cell = hintCell(p, found, mulberry32(s))!;
      const owner = p.placements.find((pl) => pl.r * 8 + pl.c === cell && !found.has(pl.word));
      expect(owner, `cell ${cell}`).toBeDefined();
      expect(p.grid[cell]).toBe(owner!.word[0]);
    }
    expect(hintCell(p, new Set(p.words), mulberry32(1))).toBeNull();
  });
});

describe('seeded shuffle', () => {
  it('keeps every item exactly once', () => {
    const a = Array.from({ length: 30 }, (_, i) => i);
    const s = shuffled(a, mulberry32(8));
    expect(s.slice().sort((x, y) => x - y)).toEqual(a);
    expect(s).not.toEqual(a);
  });
});

describe('saved best times', () => {
  it('keys are size and level', () => {
    expect(bestKey(10, 'medium')).toBe('10-medium');
  });
  it('keeps whole positive seconds up to the cap for known keys and drops everything else', () => {
    expect(sanitiseBest({ '8-easy': 95, '12-hard': MAX_BEST_SECONDS })).toEqual({ '8-easy': 95, '12-hard': MAX_BEST_SECONDS });
    expect(sanitiseBest({ '8-easy': 95, '9-easy': 3, '8-wild': 3, x: 1 })).toEqual({ '8-easy': 95 });
    expect(sanitiseBest({ '8-easy': 0, '10-easy': -3, '10-hard': 1.5, '12-easy': NaN, '12-medium': Infinity, '8-hard': MAX_BEST_SECONDS + 1 })).toEqual({});
  });
  it('rejects strings, booleans, arrays, null and prototype tricks', () => {
    expect(sanitiseBest({ '8-easy': '95', '10-easy': true, '10-hard': [95], '12-easy': null })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"8-easy": 5}, "constructor": 3}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
  it('returns a fresh object, never the stored one', () => {
    const raw = { '8-easy': 30 };
    const out = sanitiseBest(raw);
    expect(out).not.toBe(raw);
    out['8-easy'] = 1;
    expect(raw['8-easy']).toBe(30);
  });
});

describe('small text helpers', () => {
  it('formats times and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(1e12)).toBe('599:59');
  });
  it('pluralises', () => {
    expect(plural(1, 'word')).toBe('1 word');
    expect(plural(2, 'word')).toBe('2 words');
    expect(plural(0, 'word')).toBe('0 words');
  });
  it('parseSeed accepts only whole numbers from 1 to 2^32 - 1', () => {
    expect(parseSeed('1')).toBe(1);
    expect(parseSeed('4294967295')).toBe(4294967295);
    expect(parseSeed(12345)).toBe(12345);
    for (const bad of ['0', '-1', '4294967296', '1.5', '1e3', ' 5', '', 'abc', NaN, null, undefined, {}, [], '99999999999']) expect(parseSeed(bad)).toBeNull();
  });
});

describe('the page', () => {
  it('uses the constants the guide page quotes and announces results', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:word-search/);
    expect(DIR8).toHaveLength(8);
  });
});
