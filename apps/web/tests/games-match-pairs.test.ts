/**
 * games-match-pairs.test.ts - the engine behind `match-pairs`.
 *
 * Pinned: the deck holds exactly two of each symbol, the shuffle is a uniform
 * permutation that is deterministic for a seed, the flip / resolve state machine
 * ignores every illegal flip, moves and wins are counted correctly, and stored
 * best results only ever hold clean positive numbers.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, SIZE_KEYS, DEFAULT_SIZE, SYMBOLS, MAX_PAIRS, MISMATCH_MS, sizeLabel, isSizeKey, symbolName, glyphOf,
  mulberry32, shuffled, makeDeck, createState, flip, resolve, isWon, cardState, cardLabel, moveFocus,
  formatTime, toSeconds, sanitizeBest, recordResult,
  type GameState,
} from '../src/components/apps-private/match-pairs/helpers';
import calculatorSource from '../src/components/apps-private/match-pairs/Calculator.astro?raw';

/** Build a state from a literal deck, e.g. deckOf('AABB'). */
const deckOf = (s: string): number[] => Array.from(s).map((ch) => ch.charCodeAt(0) - 65);
const stateOf = (s: string): GameState => createState(deckOf(s));
const counts = (deck: readonly number[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
};

describe('sizes', () => {
  it('match the published grids and pair counts', () => {
    expect(SIZE_KEYS).toEqual(['small', 'medium', 'large', 'huge']);
    expect(SIZES.small).toMatchObject({ cols: 4, rows: 3, pairs: 6 });
    expect(SIZES.medium).toMatchObject({ cols: 4, rows: 4, pairs: 8 });
    expect(SIZES.large).toMatchObject({ cols: 5, rows: 4, pairs: 10 });
    expect(SIZES.huge).toMatchObject({ cols: 6, rows: 6, pairs: 18 });
    expect(DEFAULT_SIZE).toBe('medium');
  });
  it('every grid is exactly full: cols x rows equals twice the pairs, and fits the symbol set', () => {
    for (const k of SIZE_KEYS) {
      const s = SIZES[k];
      expect(s.cols * s.rows).toBe(s.pairs * 2);
      expect(s.pairs).toBeLessThanOrEqual(MAX_PAIRS);
    }
  });
  it('labels read as "Name CxR (N pairs)" and validate keys', () => {
    expect(sizeLabel('small')).toBe('Small 4x3 (6 pairs)');
    expect(sizeLabel('huge')).toBe('Huge 6x6 (18 pairs)');
    expect(isSizeKey('large')).toBe(true);
    expect(isSizeKey('giant')).toBe(false);
    expect(isSizeKey(undefined)).toBe(false);
  });
  it('the mismatch delay is 900 ms', () => {
    expect(MISMATCH_MS).toBe(900);
  });
});

describe('symbols', () => {
  it('there are 18, with unique names and unique glyphs', () => {
    expect(SYMBOLS).toHaveLength(18);
    expect(MAX_PAIRS).toBe(18);
    expect(new Set(SYMBOLS.map((s) => s.name)).size).toBe(18);
    expect(new Set(SYMBOLS.map((s) => s.glyph)).size).toBe(18);
  });
  it('each glyph is one text-presentation symbol: a BMP code point plus U+FE0E', () => {
    for (const s of SYMBOLS) {
      const cps = Array.from(s.glyph).map((c) => c.codePointAt(0) as number);
      expect(cps, s.name).toHaveLength(2);
      expect(cps[1], s.name).toBe(0xfe0e);
      expect(cps[0], s.name).toBeGreaterThanOrEqual(0x2500); // geometric shapes, symbols and dingbats, never a supplementary-plane emoji
      expect(cps[0], s.name).toBeLessThan(0x2800);
    }
  });
  it('includes the shapes the page promises', () => {
    const names = SYMBOLS.map((s) => s.name);
    for (const n of ['star', 'heart', 'diamond', 'club', 'spade', 'circle', 'square', 'triangle', 'sun', 'umbrella', 'clover', 'note', 'flower', 'moon', 'flag', 'plane', 'anchor', 'snowflake']) {
      expect(names).toContain(n);
    }
  });
  it('lookups are safe for out-of-range ids', () => {
    expect(symbolName(0)).toBe('star');
    expect(symbolName(99)).toBe('card');
    expect(glyphOf(-1)).toBe('?');
  });
});

describe('shuffle', () => {
  it('is a permutation and does not mutate its input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = shuffled(src, mulberry32(3));
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('is deterministic for a seed and differs across seeds', () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffled(src, mulberry32(42))).toEqual(shuffled(src, mulberry32(42)));
    expect(shuffled(src, mulberry32(42))).not.toEqual(shuffled(src, mulberry32(43)));
  });
  it('handles empty and single-element input', () => {
    expect(shuffled([], mulberry32(1))).toEqual([]);
    expect(shuffled([7], mulberry32(1))).toEqual([7]);
  });
  it('never calls the rng for an empty or one-element array', () => {
    const boom = () => { throw new Error('rng must not be called'); };
    expect(shuffled([], boom)).toEqual([]);
    expect(shuffled([7], boom)).toEqual([7]);
  });
  it('calls the rng exactly n - 1 times for n elements and never reads out of range', () => {
    let calls = 0;
    shuffled([1, 2, 3, 4, 5], () => { calls++; return 0.5; });
    expect(calls).toBe(4);
    // An rng that returns the largest legal value must still give an in-range index.
    const top = () => 1 - Number.EPSILON;
    const out = shuffled([1, 2, 3, 4, 5], top);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    const zero = () => 0;
    expect(shuffled([1, 2, 3, 4, 5], zero).slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('statistical sanity: each element lands in each position about equally often', () => {
    const n = 8;
    const trials = 20000;
    const tally = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let seed = 1; seed <= trials; seed++) {
      const out = shuffled(Array.from({ length: n }, (_, i) => i), mulberry32(seed));
      out.forEach((el, pos) => { tally[el][pos]++; });
    }
    const expected = trials / n; // 2500, standard deviation about 47
    for (let el = 0; el < n; el++) {
      for (let pos = 0; pos < n; pos++) {
        expect(Math.abs(tally[el][pos] - expected), `element ${el} at position ${pos}`).toBeLessThan(300);
      }
    }
  });
  it('statistical sanity: every ordering of a tiny deck is reachable and about equally likely', () => {
    // Four cards, two pairs: after relabelling by first appearance there are 3 patterns, each 1/3 likely.
    const trials = 12000;
    const patterns = new Map<string, number>();
    for (let seed = 1; seed <= trials; seed++) {
      const deck = makeDeck(2, mulberry32(seed));
      const seen: number[] = [];
      const key = deck.map((id) => { let k = seen.indexOf(id); if (k < 0) { seen.push(id); k = seen.length - 1; } return k; }).join('');
      patterns.set(key, (patterns.get(key) ?? 0) + 1);
    }
    expect([...patterns.keys()].sort()).toEqual(['0011', '0101', '0110']);
    for (const c of patterns.values()) expect(Math.abs(c - trials / 3)).toBeLessThan(300); // sd about 51
  });
});

describe('makeDeck', () => {
  it('holds exactly two of each symbol, for every size', () => {
    for (const k of SIZE_KEYS) {
      const { pairs } = SIZES[k];
      const deck = makeDeck(pairs, mulberry32(7));
      expect(deck).toHaveLength(pairs * 2);
      const c = counts(deck);
      expect(c.size).toBe(pairs);
      for (const [id, n] of c) {
        expect(n, `symbol ${id}`).toBe(2);
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(MAX_PAIRS);
      }
    }
  });
  it('the huge deck uses all 18 symbols', () => {
    expect([...counts(makeDeck(18, mulberry32(1))).keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i));
  });
  it('is deterministic for a seed and different across seeds', () => {
    expect(makeDeck(8, mulberry32(2026))).toEqual(makeDeck(8, mulberry32(2026)));
    expect(makeDeck(8, mulberry32(2026))).not.toEqual(makeDeck(8, mulberry32(2027)));
  });
  it('different games pick different symbol subsets, not always the same few', () => {
    const subsets = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) subsets.add([...counts(makeDeck(6, mulberry32(seed))).keys()].sort((a, b) => a - b).join(','));
    expect(subsets.size).toBeGreaterThan(30);
  });
  it('rejects pair counts it cannot build', () => {
    for (const bad of [0, -1, 19, 2.5, NaN, Infinity]) {
      expect(() => makeDeck(bad, mulberry32(1)), String(bad)).toThrow(RangeError);
    }
  });
  it('statistical sanity: a given card position shows each symbol about equally often', () => {
    // Huge deck, 18 symbols each twice in 36 cards: position 0 holds any given symbol with probability 1/18.
    const trials = 9000;
    for (const pos of [0, 17, 35]) {
      const tally = new Array<number>(18).fill(0);
      for (let seed = 1; seed <= trials; seed++) tally[makeDeck(18, mulberry32(seed))[pos]]++;
      const expected = trials / 18; // 500, standard deviation about 22
      for (let id = 0; id < 18; id++) expect(Math.abs(tally[id] - expected), `position ${pos}, symbol ${id}`).toBeLessThan(130);
    }
  });
  it('statistical sanity: two pair-mates are not placed next to each other more often than chance', () => {
    // In a 16-card deck, the partner of card 0 is uniform over the other 15 positions.
    const trials = 15000;
    const tally = new Array<number>(16).fill(0);
    for (let seed = 1; seed <= trials; seed++) {
      const deck = makeDeck(8, mulberry32(seed));
      tally[deck.indexOf(deck[0], 1)]++;
    }
    expect(tally[0]).toBe(0);
    const expected = trials / 15; // 1000, standard deviation about 31
    for (let p = 1; p < 16; p++) expect(Math.abs(tally[p] - expected), `partner at ${p}`).toBeLessThan(200);
  });
});

describe('createState', () => {
  it('starts idle with nothing open, matched, or counted', () => {
    const s = stateOf('AABB');
    expect(s).toMatchObject({ phase: 'idle', open: [], moves: 0, flips: 0, pairsFound: 0, totalPairs: 2 });
    expect(s.matched).toEqual([false, false, false, false]);
    expect(isWon(s)).toBe(false);
  });
  it('rejects empty or odd decks', () => {
    expect(() => createState([])).toThrow(RangeError);
    expect(() => createState([0, 1, 0])).toThrow(RangeError);
  });
  it('copies the deck it is given and is frozen', () => {
    const src = [0, 1, 0, 1];
    const s = createState(src);
    src[0] = 5;
    expect(s.deck[0]).toBe(0);
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.deck)).toBe(true);
    expect(Object.isFrozen(s.matched)).toBe(true);
  });
});

describe('flip', () => {
  it('the first flip opens one card and moves to one-open without counting a move', () => {
    const s = flip(stateOf('ABAB'), 1);
    expect(s.phase).toBe('one-open');
    expect(s.open).toEqual([1]);
    expect(s.flips).toBe(1);
    expect(s.moves).toBe(0);
  });
  it('flipping the same card twice is ignored', () => {
    const one = flip(stateOf('ABAB'), 2);
    const again = flip(one, 2);
    expect(again).toBe(one);
    expect(again.flips).toBe(1);
    expect(again.moves).toBe(0);
  });
  it('flipping a matched card is ignored', () => {
    const matched = flip(flip(stateOf('AABB'), 0), 1);
    expect(matched.matched[0]).toBe(true);
    expect(flip(matched, 0)).toBe(matched);
    expect(flip(matched, 1)).toBe(matched);
  });
  it('flipping during resolving is ignored, including a card that is face down', () => {
    const resolving = flip(flip(stateOf('ABAB'), 0), 1);
    expect(resolving.phase).toBe('resolving');
    expect(flip(resolving, 2)).toBe(resolving);
    expect(flip(resolving, 3)).toBe(resolving);
    expect(flip(resolving, 0)).toBe(resolving);
  });
  it('out-of-range and non-integer indices are ignored', () => {
    const s = stateOf('AABB');
    for (const bad of [-1, 4, 99, 1.5, NaN, Infinity]) expect(flip(s, bad), String(bad)).toBe(s);
  });
  it('a match keeps both cards open, counts a move and a pair, and returns to idle', () => {
    const s = flip(flip(stateOf('ABAB'), 0), 2);
    expect(s.phase).toBe('idle');
    expect(s.matched).toEqual([true, false, true, false]);
    expect(s.open).toEqual([]);
    expect(s.moves).toBe(1);
    expect(s.flips).toBe(2);
    expect(s.pairsFound).toBe(1);
    expect(cardState(s, 0)).toBe('matched');
    expect(cardState(s, 2)).toBe('matched');
    expect(cardState(s, 1)).toBe('down');
  });
  it('a mismatch leaves both cards up, counts a move and no pair, and waits to resolve', () => {
    const s = flip(flip(stateOf('ABAB'), 0), 1);
    expect(s.phase).toBe('resolving');
    expect(s.open).toEqual([0, 1]);
    expect(s.matched.every((m) => !m)).toBe(true);
    expect(s.moves).toBe(1);
    expect(s.pairsFound).toBe(0);
    expect(cardState(s, 0)).toBe('up');
    expect(cardState(s, 1)).toBe('up');
  });
  it('never mutates the state it was given', () => {
    const before = stateOf('ABAB');
    const snap = JSON.stringify(before);
    flip(before, 0);
    flip(flip(before, 0), 1);
    expect(JSON.stringify(before)).toBe(snap);
  });
});

describe('resolve', () => {
  it('turns a mismatched pair back down and returns to idle', () => {
    const r = resolve(flip(flip(stateOf('ABAB'), 0), 1));
    expect(r.phase).toBe('idle');
    expect(r.open).toEqual([]);
    expect(r.moves).toBe(1);
    expect(cardState(r, 0)).toBe('down');
    expect(cardState(r, 1)).toBe('down');
  });
  it('allows flipping again afterwards, including the cards that just mismatched', () => {
    const r = resolve(flip(flip(stateOf('ABAB'), 0), 1));
    const next = flip(r, 0);
    expect(next).not.toBe(r);
    expect(next.open).toEqual([0]);
  });
  it('is a no-op in idle and one-open', () => {
    const idle = stateOf('AABB');
    expect(resolve(idle)).toBe(idle);
    const one = flip(idle, 0);
    expect(resolve(one)).toBe(one);
  });
  it('does not touch matched pairs', () => {
    const s = flip(flip(stateOf('AABBCC'), 0), 1); // match A
    const mis = flip(flip(s, 2), 4); // mismatch B/C
    const r = resolve(mis);
    expect(r.matched).toEqual([true, true, false, false, false, false]);
    expect(r.pairsFound).toBe(1);
  });
});

describe('moves and flips', () => {
  it('one move is two flips: moves is always floor(flips / 2)', () => {
    let s = stateOf('ABCABC');
    const order = [0, 1, 2, 3, 4, 5, 0, 3];
    for (const i of order) {
      s = flip(s, i);
      if (s.phase === 'resolving') s = resolve(s);
      expect(s.moves).toBe(Math.floor(s.flips / 2));
    }
  });
  it('ignored flips do not change the counters', () => {
    let s = flip(stateOf('ABAB'), 0);
    s = flip(s, 0);
    s = flip(s, 0);
    expect(s.flips).toBe(1);
    expect(s.moves).toBe(0);
  });
});

describe('win detection', () => {
  it('is false until the last pair is found, true on the flip that finds it', () => {
    let s = stateOf('ABBA');
    s = flip(flip(s, 1), 2);
    expect(isWon(s)).toBe(false);
    s = flip(flip(s, 0), 3);
    expect(isWon(s)).toBe(true);
    expect(s.pairsFound).toBe(s.totalPairs);
    expect(s.moves).toBe(2);
    expect(s.matched.every(Boolean)).toBe(true);
  });
  it('a won game ignores every further flip', () => {
    const won = flip(flip(flip(flip(stateOf('AABB'), 0), 1), 2), 3);
    expect(isWon(won)).toBe(true);
    for (let i = 0; i < 4; i++) expect(flip(won, i)).toBe(won);
  });
  it('a perfect player (knows the deck) needs exactly one move per pair, the lower bound', () => {
    for (const k of SIZE_KEYS) {
      const { pairs } = SIZES[k];
      let s = createState(makeDeck(pairs, mulberry32(11)));
      for (let id = 0; id < MAX_PAIRS; id++) {
        const spots = s.deck.map((d, i) => (d === id ? i : -1)).filter((i) => i >= 0);
        if (spots.length) { s = flip(flip(s, spots[0]), spots[1]); }
      }
      expect(isWon(s), k).toBe(true);
      expect(s.moves, k).toBe(pairs);
    }
  });
});

describe('full games', () => {
  /** Flips two random face-down cards per move with no memory; resolves mismatches. */
  const amnesiac = (deck: number[], rng: () => number): number => {
    let s = createState(deck);
    let guard = 0;
    while (!isWon(s) && guard++ < 100000) {
      const down = s.deck.map((_, i) => i).filter((i) => cardState(s, i) === 'down');
      const a = down[Math.floor(rng() * down.length)];
      s = flip(s, a);
      const rest = down.filter((i) => i !== a);
      s = flip(s, rest[Math.floor(rng() * rest.length)]);
      s = resolve(s);
    }
    expect(isWon(s)).toBe(true);
    return s.moves;
  };
  /** Remembers every card it has seen and uses that. */
  const rememberer = (deck: number[], rng: () => number): number => {
    let s = createState(deck);
    const seen = new Map<number, number>(); // index -> symbol id, for cards seen and not matched
    let guard = 0;
    while (!isWon(s) && guard++ < 100000) {
      const known = [...seen.entries()];
      const pair = known.find(([i, id]) => known.some(([j, jd]) => j !== i && jd === id));
      if (pair) {
        const mate = known.find(([j, jd]) => j !== pair[0] && jd === pair[1]) as [number, number];
        s = flip(flip(s, pair[0]), mate[0]);
        seen.delete(pair[0]); seen.delete(mate[0]);
        continue;
      }
      const unseen = s.deck.map((_, i) => i).filter((i) => cardState(s, i) === 'down' && !seen.has(i));
      const a = unseen[Math.floor(rng() * unseen.length)];
      s = flip(s, a);
      seen.set(a, s.deck[a]);
      const mate = [...seen.entries()].find(([j, jd]) => j !== a && jd === s.deck[a]);
      if (mate) {
        s = flip(s, mate[0]);
        seen.delete(a); seen.delete(mate[0]);
        continue;
      }
      const rest = unseen.filter((i) => i !== a);
      const b = rest[Math.floor(rng() * rest.length)];
      s = flip(s, b);
      seen.set(b, s.deck[b]);
      s = resolve(s);
      if (s.matched[b]) seen.delete(b);
    }
    expect(isWon(s)).toBe(true);
    return s.moves;
  };

  it('random play always terminates in a win with consistent counters', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed);
      const deck = makeDeck(8, rng);
      const moves = amnesiac(deck, rng);
      expect(moves).toBeGreaterThanOrEqual(8);
    }
  });
  it('a player who remembers cards needs fewer moves on average than one who does not', () => {
    const games = 200;
    let withMemory = 0;
    let without = 0;
    for (let seed = 1; seed <= games; seed++) {
      withMemory += rememberer(makeDeck(8, mulberry32(seed)), mulberry32(seed + 1000));
      without += amnesiac(makeDeck(8, mulberry32(seed)), mulberry32(seed + 1000));
    }
    expect(withMemory / games).toBeLessThan(without / games);
    expect(withMemory / games).toBeGreaterThanOrEqual(8); // never below one move per pair
  });
});

describe('labels', () => {
  it('face-down, face-up and matched cards are named by position and state, without leaking the symbol while down', () => {
    const deck = [0, 1, 0, 1]; // star, heart, star, heart
    let s = createState(deck);
    expect(cardLabel(s, 2)).toBe('Card 3, face down');
    s = flip(s, 0);
    expect(cardLabel(s, 0)).toBe('Card 1, star, face up');
    expect(cardLabel(s, 1)).toBe('Card 2, face down');
    s = flip(s, 2);
    expect(cardLabel(s, 0)).toBe('Card 1, star, matched');
    expect(cardLabel(s, 2)).toBe('Card 3, star, matched');
    expect(cardLabel(s, 3)).not.toMatch(/heart/);
  });
});

describe('keyboard navigation', () => {
  // 4 columns, 12 cards (small)
  const cols = 4;
  const total = 12;
  it('arrows move one cell and stay inside the grid', () => {
    expect(moveFocus(5, 'ArrowRight', cols, total)).toBe(6);
    expect(moveFocus(5, 'ArrowLeft', cols, total)).toBe(4);
    expect(moveFocus(5, 'ArrowUp', cols, total)).toBe(1);
    expect(moveFocus(5, 'ArrowDown', cols, total)).toBe(9);
  });
  it('does not wrap across rows or fall off the edges', () => {
    expect(moveFocus(3, 'ArrowRight', cols, total)).toBe(3);
    expect(moveFocus(4, 'ArrowLeft', cols, total)).toBe(4);
    expect(moveFocus(2, 'ArrowUp', cols, total)).toBe(2);
    expect(moveFocus(10, 'ArrowDown', cols, total)).toBe(10);
    expect(moveFocus(11, 'ArrowRight', cols, total)).toBe(11);
  });
  it('Home and End jump to the first and last card; other keys do nothing', () => {
    expect(moveFocus(6, 'Home', cols, total)).toBe(0);
    expect(moveFocus(6, 'End', cols, total)).toBe(11);
    expect(moveFocus(6, 'a', cols, total)).toBe(6);
    expect(moveFocus(6, 'Enter', cols, total)).toBe(6);
  });
  it('recovers from a bad index', () => {
    expect(moveFocus(-3, 'ArrowRight', cols, total)).toBe(0);
    expect(moveFocus(99, 'ArrowLeft', cols, total)).toBe(0);
    expect(moveFocus(NaN, 'End', cols, total)).toBe(0);
  });
  it('every card is reachable from card 0 by arrows on every size', () => {
    for (const k of SIZE_KEYS) {
      const { cols: c, rows, pairs } = SIZES[k];
      const n = pairs * 2;
      const seen = new Set<number>([0]);
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let x = 0; x < c - 1; x++) { i = moveFocus(i, 'ArrowRight', c, n); seen.add(i); }
        i = moveFocus(i, 'ArrowDown', c, n); seen.add(i);
        for (let x = 0; x < c - 1; x++) { i = moveFocus(i, 'ArrowLeft', c, n); seen.add(i); }
        i = moveFocus(i, 'ArrowDown', c, n); seen.add(i);
      }
      expect(seen.size, k).toBe(n);
    }
  });
});

describe('grid layout hooks', () => {
  it('takes the column count from CSS keyed on data-cols, not from an inline style', () => {
    expect(calculatorSource).not.toMatch(/style=\{`--mp-cols/);
    expect(calculatorSource).not.toMatch(/setProperty\('--mp-cols'/);
    expect(calculatorSource).toMatch(/\.mp-wrap \{ --mp-cols: 4;/); // fallback
    const widths = new Set(SIZE_KEYS.map((k) => SIZES[k].cols));
    expect(widths.has(4)).toBe(true);
    for (const cols of widths) {
      if (cols === 4) continue;
      expect(calculatorSource, `${cols} columns`).toContain(`.mp-wrap[data-cols="${cols}"] { --mp-cols: ${cols}; }`);
    }
  });
});

describe('time', () => {
  it('formats minutes and seconds and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
  it('toSeconds rounds down like the live clock and is never zero', () => {
    expect(toSeconds(0)).toBe(1);
    expect(toSeconds(300)).toBe(1);
    expect(toSeconds(1499)).toBe(1);
    expect(toSeconds(1500)).toBe(1);
    expect(toSeconds(1999)).toBe(1);
    expect(toSeconds(2000)).toBe(2);
    expect(toSeconds(7600)).toBe(7);
    expect(toSeconds(61000)).toBe(61);
    expect(toSeconds(NaN)).toBe(1);
    expect(toSeconds(-10)).toBe(1);
  });
});

describe('best results', () => {
  it('a first win sets both records', () => {
    const r = recordResult({}, 'medium', 14, 52);
    expect(r.best).toEqual({ medium_m: 14, medium_t: 52 });
    expect(r.movesRecord).toBe(true);
    expect(r.timeRecord).toBe(true);
  });
  it('fewest moves and best time are tracked separately', () => {
    let b = recordResult({}, 'small', 10, 40).best;
    const r = recordResult(b, 'small', 8, 55); // fewer moves, slower
    expect(r.movesRecord).toBe(true);
    expect(r.timeRecord).toBe(false);
    expect(r.best).toEqual({ small_m: 8, small_t: 40 });
    b = r.best;
    const r2 = recordResult(b, 'small', 12, 30); // more moves, faster
    expect(r2.movesRecord).toBe(false);
    expect(r2.timeRecord).toBe(true);
    expect(r2.best).toEqual({ small_m: 8, small_t: 30 });
  });
  it('a tie or a worse result changes nothing', () => {
    const base = { large_m: 12, large_t: 60 };
    const r = recordResult(base, 'large', 12, 60);
    expect(r.movesRecord || r.timeRecord).toBe(false);
    expect(r.best).toEqual(base);
    expect(recordResult(base, 'large', 20, 90).best).toEqual(base);
  });
  it('is kept per size and does not mutate its input', () => {
    const base = { small_m: 7 };
    const snap = JSON.stringify(base);
    const r = recordResult(base, 'huge', 30, 200);
    expect(r.best).toEqual({ small_m: 7, huge_m: 30, huge_t: 200 });
    expect(JSON.stringify(base)).toBe(snap);
  });
  it('refuses to record nonsense', () => {
    for (const bad of [0, -3, 1.5, NaN, Infinity, 2_000_000]) {
      const r = recordResult({}, 'medium', bad, bad);
      expect(r.best, String(bad)).toEqual({});
      expect(r.movesRecord || r.timeRecord).toBe(false);
    }
  });
  it('sanitizeBest keeps clean positive integers for known sizes and drops everything else', () => {
    const dirty = {
      small_m: 9, small_t: 31, medium_m: '12', medium_t: -4, large_m: 1.5, large_t: NaN, huge_m: 22,
      giant_m: 5, __proto__: { huge_t: 5 }, extra: 'x',
    };
    expect(sanitizeBest(dirty)).toEqual({ small_m: 9, small_t: 31, huge_m: 22 });
  });
  it('sanitizeBest survives non-objects', () => {
    for (const bad of [null, undefined, 5, 'x', [], [1, 2]]) expect(sanitizeBest(bad)).toEqual({});
  });
  it('a sanitized, serialised and re-read record round-trips exactly', () => {
    const r = recordResult(recordResult({}, 'small', 9, 31).best, 'huge', 40, 300).best;
    expect(sanitizeBest(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
});
