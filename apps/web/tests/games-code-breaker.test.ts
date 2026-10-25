/**
 * games-code-breaker.test.ts - the engine behind `code-breaker`.
 *
 * Pinned: two-count scoring with duplicates, the number of possible codes in every
 * setup, exact filtering by feedback, the Knuth-style solver (every code of the
 * default game cracked in at most five guesses), and a time bound on a solver step
 * in the largest setup. The figures quoted on the content page are asserted here.
 */
import { describe, it, expect } from 'vitest';
import {
  score, allCodes, consistent, filterByFeedback, partitionCounts, forcedPositions, hintText, nextGuessMinimax, openingGuess,
  solverGuess, solveSecret, randomSecret, mulberry32, isValidCode, hasRepeat, symbolLabel, symbolName, codeWords, feedbackText,
  feedbackShort, bestKey, sanitiseResults, SYMBOLS, LENGTHS, SYMBOL_COUNTS, GUESS_LIMITS, DEFAULTS,
  type Code, type Guess, type Setup,
} from '../src/components/apps-private/code-breaker/helpers';

const DEFAULT_SETUP: Setup = { length: 4, symbols: 6, repeats: true };
const TOTAL_GUESSES = 5801;
const AVERAGE = 4.476;
const DISTRIBUTION = [1, 6, 62, 533, 694];
const WORST_NO_REPEAT = 5;

describe('scoring', () => {
  const cases: [string, Code, Code, number, number][] = [
    ['identical codes', [1, 1, 2, 2], [1, 1, 2, 2], 4, 0],
    ['same symbols, none in place', [1, 1, 2, 2], [2, 2, 1, 1], 0, 4],
    ['a guess of one symbol only gets credit for as many as the secret holds', [1, 1, 2, 3], [1, 1, 1, 1], 2, 0],
    ['one secret peg cannot match four guess pegs', [1, 2, 3, 4], [1, 1, 1, 1], 1, 0],
    ['a reversed code', [1, 2, 3, 4], [4, 3, 2, 1], 0, 4],
    ['three right, one symbol not in the secret', [1, 2, 3, 4], [1, 2, 3, 5], 3, 0],
    ['exact matches are taken before wrong-place matches', [1, 1, 2, 2], [2, 1, 1, 1], 1, 2],
    ['repeated guess symbol with a single secret copy', [3, 3, 4, 5], [3, 4, 3, 3], 1, 2],
    ['five pegs, rotated', [1, 2, 3, 4, 5], [5, 1, 2, 3, 4], 0, 5],
    ['five pegs, two of each in play', [1, 1, 1, 2, 2], [1, 2, 2, 2, 1], 2, 2],
    ['nothing in common', [1, 2, 3, 4], [5, 6, 5, 6], 0, 0],
    ['guess has more copies than the secret, all out of place', [1, 2, 3, 4], [2, 2, 2, 2], 1, 0],
    ['secret has more copies than the guess', [2, 2, 2, 1], [1, 3, 3, 3], 0, 1],
  ];
  for (const [name, secret, guess, place, symbol] of cases) {
    it(name, () => {
      expect(score(secret, guess)).toEqual({ place, symbol });
    });
  }

  it('is symmetric: swapping secret and guess gives the same two numbers', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 500; i++) {
      const a = randomSecret(rng, 5, 8, true);
      const b = randomSecret(rng, 5, 8, true);
      expect(score(a, b)).toEqual(score(b, a));
    }
  });

  it('adds up to the number of symbols the two codes share, counted with multiplicity', () => {
    const rng = mulberry32(6);
    for (let i = 0; i < 500; i++) {
      const a = randomSecret(rng, 4, 6, true);
      const b = randomSecret(rng, 4, 6, true);
      let shared = 0;
      for (let s = 1; s <= 6; s++) shared += Math.min(a.filter((x) => x === s).length, b.filter((x) => x === s).length);
      const f = score(a, b);
      expect(f.place + f.symbol).toBe(shared);
    }
  });

  it('does not leave state behind between calls', () => {
    const a = score([1, 1, 2, 2], [2, 1, 1, 1]);
    score([3, 3, 3, 3], [3, 4, 4, 4]);
    expect(score([1, 1, 2, 2], [2, 1, 1, 1])).toEqual(a);
  });
});

describe('all codes', () => {
  it('counts every setup', () => {
    expect(allCodes(4, 6, true)).toHaveLength(1296);
    expect(allCodes(4, 8, true)).toHaveLength(4096);
    expect(allCodes(5, 6, true)).toHaveLength(7776);
    expect(allCodes(5, 8, true)).toHaveLength(32768);
  });
  it('counts the no-repeat setups: 6P4 = 360, 8P4 = 1680, 6P5 = 720, 8P5 = 6720', () => {
    expect(allCodes(4, 6, false)).toHaveLength(360);
    expect(allCodes(4, 8, false)).toHaveLength(1680);
    expect(allCodes(5, 6, false)).toHaveLength(720);
    expect(allCodes(5, 8, false)).toHaveLength(6720);
  });
  it('lists them in lexicographic order with no duplicates', () => {
    const codes = allCodes(4, 6, true);
    expect(codes[0]).toEqual([1, 1, 1, 1]);
    expect(codes[1]).toEqual([1, 1, 1, 2]);
    expect(codes[codes.length - 1]).toEqual([6, 6, 6, 6]);
    const keys = codes.map((c) => c.join(''));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(keys.slice().sort());
  });
  it('no-repeat lists contain only codes with distinct symbols', () => {
    expect(allCodes(5, 6, false).every((c) => !hasRepeat(c))).toBe(true);
    expect(allCodes(4, 6, false)[0]).toEqual([1, 2, 3, 4]);
  });
  it('is empty for impossible requests', () => {
    expect(allCodes(0, 6, true)).toHaveLength(0);
    expect(allCodes(7, 6, false)).toHaveLength(0);
  });
});

describe('validity', () => {
  it('rejects wrong length, out-of-range symbols and, with repeats off, repeated symbols', () => {
    expect(isValidCode([1, 2, 3], DEFAULT_SETUP)).toBe(false);
    expect(isValidCode([1, 2, 3, 7], DEFAULT_SETUP)).toBe(false);
    expect(isValidCode([1, 2, 3, 0], DEFAULT_SETUP)).toBe(false);
    expect(isValidCode([1, 2, 2, 3], DEFAULT_SETUP)).toBe(true);
    expect(isValidCode([1, 2, 2, 3], { ...DEFAULT_SETUP, repeats: false })).toBe(false);
    expect(isValidCode([1, 2, 4, 3], { ...DEFAULT_SETUP, repeats: false })).toBe(true);
  });
});

describe('consistent filtering', () => {
  const all = allCodes(4, 6, true);
  it('keeps exactly the codes that would have scored the same, checked one by one', () => {
    const guess = [1, 2, 3, 3];
    const fb = score([4, 2, 3, 1], guess);
    const kept = filterByFeedback(all, guess, fb.place, fb.symbol);
    const expected = all.filter((c) => {
      const f = score(c, guess);
      return f.place === fb.place && f.symbol === fb.symbol;
    });
    expect(kept).toEqual(expected);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(all.length);
  });
  it('never drops the real secret, whatever the history', () => {
    const rng = mulberry32(21);
    for (let i = 0; i < 40; i++) {
      const secret = randomSecret(rng, 4, 6, true);
      const history: Guess[] = [];
      for (let k = 0; k < 4; k++) {
        const guess = randomSecret(rng, 4, 6, true);
        const f = score(secret, guess);
        history.push({ guess, ...f });
      }
      const left = consistent(all, history);
      expect(left.some((c) => c.join('') === secret.join(''))).toBe(true);
      for (const c of left) for (const h of history) expect(score(c, h.guess)).toEqual({ place: h.place, symbol: h.symbol });
    }
  });
  it('with an empty history returns everything; with a contradictory one returns nothing', () => {
    expect(consistent(all, [])).toHaveLength(1296);
    const contradiction: Guess[] = [
      { guess: [1, 1, 1, 1], place: 4, symbol: 0 },
      { guess: [2, 2, 2, 2], place: 4, symbol: 0 },
    ];
    expect(consistent(all, contradiction)).toHaveLength(0);
  });
  it('a guess of 1122 splits the 1296 codes with a largest class of 256', () => {
    const parts = partitionCounts(all, [1, 1, 2, 2]);
    const sizes = Object.values(parts);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(1296);
    expect(Math.max(...sizes)).toBe(256);
    expect(parts['0,0']).toBe(256); // codes using neither 1 nor 2: 4 symbols in 4 places = 4^4
    expect(parts['4,0']).toBe(1);
    expect(Object.keys(parts)).toHaveLength(13);
  });
});

describe('hints', () => {
  it('forcedPositions finds the symbol every candidate shares', () => {
    expect(forcedPositions([[1, 2, 3], [1, 3, 3], [1, 4, 3]])).toEqual([1, 0, 3]);
    expect(forcedPositions([])).toEqual([]);
  });
  it('says which code remains when exactly one does', () => {
    const t = hintText([[3, 1, 4, 2]]);
    expect(t).toContain('Exactly one code');
    expect(t).toContain('3 triangle, 1 circle, 4 diamond, 2 square');
  });
  it('reports the count and a position that is certain', () => {
    const t = hintText([[1, 2, 3, 4], [1, 4, 3, 2]]);
    expect(t).toContain('2 codes still fit');
    expect(t).toContain('position 1 is symbol 1 (circle)');
  });
  it('reports the count alone when no position is certain', () => {
    const t = hintText([[1, 2, 3, 4], [2, 1, 4, 3]]);
    expect(t).toContain('2 codes still fit');
    expect(t).toContain('No single position is certain yet');
  });
  it('the hint count after a real guess matches a brute-force count', () => {
    const all = allCodes(4, 6, true);
    const secret = [2, 5, 5, 1];
    const guess = [1, 1, 2, 2];
    const f = score(secret, guess);
    const brute = all.filter((c) => {
      const s = score(c, guess);
      return s.place === f.place && s.symbol === f.symbol;
    }).length;
    expect(consistent(all, [{ guess, ...f }])).toHaveLength(brute);
  });
});

describe('opening guess and minimax choice', () => {
  it('opens with 1122 for four pegs and 11223 for five when repeats are on', () => {
    expect(openingGuess(DEFAULT_SETUP)).toEqual([1, 1, 2, 2]);
    expect(openingGuess({ length: 5, symbols: 8, repeats: true })).toEqual([1, 1, 2, 2, 3]);
  });
  it('opens with distinct symbols when repeats are off', () => {
    expect(openingGuess({ length: 4, symbols: 6, repeats: false })).toEqual([1, 2, 3, 4]);
    expect(isValidCode(openingGuess({ length: 5, symbols: 6, repeats: false }), { length: 5, symbols: 6, repeats: false })).toBe(true);
  });
  it('picks 1122 as its own first guess from the full set of 1296 (Knuth)', () => {
    const all = allCodes(4, 6, true);
    expect(nextGuessMinimax(all, all, { budget: Infinity })).toEqual([1, 1, 2, 2]);
  });
  it('is deterministic', () => {
    const all = allCodes(4, 6, true);
    const f = score([6, 3, 3, 1], [1, 1, 2, 2]);
    const cands = filterByFeedback(all, [1, 1, 2, 2], f.place, f.symbol);
    expect(nextGuessMinimax(cands, all)).toEqual(nextGuessMinimax(cands, all));
  });
  it('returns the only candidate when one is left, and a candidate when two are left', () => {
    const all = allCodes(4, 6, true);
    expect(nextGuessMinimax([[2, 4, 4, 6]], all)).toEqual([2, 4, 4, 6]);
    expect(nextGuessMinimax([[2, 4, 4, 6], [3, 3, 3, 3]], all)).toEqual([2, 4, 4, 6]);
  });
  it('never returns a guess with a worse worst case than the best one in the pool', () => {
    const all = allCodes(4, 6, true);
    const f = score([4, 4, 5, 6], [1, 1, 2, 2]);
    const cands = filterByFeedback(all, [1, 1, 2, 2], f.place, f.symbol);
    const pick = nextGuessMinimax(cands, all);
    const worst = (g: Code) => Math.max(...Object.values(partitionCounts(cands, g)));
    const best = Math.min(...all.map(worst));
    expect(worst(pick)).toBe(best);
  });
  it('prefers a guess that could be the answer when it ties for the best worst case', () => {
    const all = allCodes(4, 6, true);
    const f = score([4, 4, 5, 6], [1, 1, 2, 2]);
    const cands = filterByFeedback(all, [1, 1, 2, 2], f.place, f.symbol);
    const pick = nextGuessMinimax(cands, all);
    const worst = (g: Code) => Math.max(...Object.values(partitionCounts(cands, g)));
    const bestCandidate = Math.min(...cands.map(worst));
    if (bestCandidate === worst(pick)) expect(cands.some((c) => c.join('') === pick.join(''))).toBe(true);
  });
  it('solverGuess uses the opening on step 0 and minimax afterwards', () => {
    const all = allCodes(4, 6, true);
    expect(solverGuess(DEFAULT_SETUP, all, all, 0)).toEqual([1, 1, 2, 2]);
    expect(solverGuess(DEFAULT_SETUP, all, [[5, 5, 5, 5]], 1)).toEqual([5, 5, 5, 5]);
  });
});

describe('Knuth strategy on the default game (4 pegs, 6 symbols, repeats allowed)', () => {
  const all = allCodes(4, 6, true);
  const cache = new Map<string, Code>();
  const lengths = all.map((secret) => {
    const steps = solveSecret(secret, DEFAULT_SETUP, all, { cache });
    return { secret, steps };
  });

  it('cracks all 1296 codes', () => {
    expect(lengths).toHaveLength(1296);
    for (const { secret, steps } of lengths) {
      const last = steps[steps.length - 1];
      expect(last.guess).toEqual(secret);
      expect(last.place).toBe(4);
    }
  });
  it('needs at most 5 guesses for every code', () => {
    const worst = Math.max(...lengths.map((l) => l.steps.length));
    expect(worst).toBe(5);
  });
  it('has a pinned total and average number of guesses over all 1296 codes', () => {
    const total = lengths.reduce((a, l) => a + l.steps.length, 0);
    expect(total).toBe(TOTAL_GUESSES);
    expect(Math.round((total / 1296) * 1000) / 1000).toBe(AVERAGE);
  });
  it('has a pinned distribution of how many codes take 1 to 5 guesses', () => {
    const dist = [0, 0, 0, 0, 0, 0];
    for (const l of lengths) dist[l.steps.length] += 1;
    expect(dist.slice(1)).toEqual(DISTRIBUTION);
  });
  it('shrinks the set of possible codes after each guess and ends on exactly one', () => {
    for (const { steps } of lengths.slice(0, 200)) {
      for (let i = 1; i < steps.length; i++) expect(steps[i].left).toBeLessThanOrEqual(steps[i - 1].left);
      expect(steps[steps.length - 1].left).toBe(1);
    }
  });
  it('first guess is the same for every secret', () => {
    expect(new Set(lengths.map((l) => l.steps[0].guess.join(''))).size).toBe(1);
  });
});

describe('no-repeat games', () => {
  it('solves every one of the 360 codes of the 4-peg, 6-symbol game with valid guesses only', () => {
    const setup: Setup = { length: 4, symbols: 6, repeats: false };
    const pool = allCodes(4, 6, false);
    const cache = new Map<string, Code>();
    let worst = 0;
    for (const secret of pool) {
      const steps = solveSecret(secret, setup, pool, { cache });
      expect(steps[steps.length - 1].guess).toEqual(secret);
      for (const s of steps) expect(isValidCode(s.guess, setup)).toBe(true);
      worst = Math.max(worst, steps.length);
    }
    expect(worst).toBe(WORST_NO_REPEAT);
  });
  it('random secrets never repeat a symbol', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 300; i++) {
      expect(hasRepeat(randomSecret(rng, 5, 6, false))).toBe(false);
      expect(hasRepeat(randomSecret(rng, 4, 8, false))).toBe(false);
    }
  });
});

describe('random secrets', () => {
  it('are deterministic for a seed and differ across seeds', () => {
    const a = randomSecret(mulberry32(42), 5, 8, true);
    const b = randomSecret(mulberry32(42), 5, 8, true);
    expect(a).toEqual(b);
    const many = new Set(Array.from({ length: 30 }, (_, i) => randomSecret(mulberry32(i + 1), 5, 8, true).join('')));
    expect(many.size).toBeGreaterThan(20);
  });
  it('stay inside the symbol range and length, including at the rng extremes', () => {
    for (const x of [0, 0.999999999]) {
      for (const rep of [true, false]) {
        const c = randomSecret(() => x, 5, 8, rep);
        expect(c).toHaveLength(5);
        expect(isValidCode(c, { length: 5, symbols: 8, repeats: rep })).toBe(true);
      }
    }
  });
  it('use every symbol roughly evenly', () => {
    const rng = mulberry32(99);
    const counts = new Array(7).fill(0);
    for (let i = 0; i < 6000; i++) for (const s of randomSecret(rng, 4, 6, true)) counts[s] += 1;
    for (let s = 1; s <= 6; s++) {
      expect(counts[s]).toBeGreaterThan(3600);
      expect(counts[s]).toBeLessThan(4400);
    }
  });
});

describe('largest setup (5 pegs, 8 symbols, 32768 codes)', () => {
  const setup: Setup = { length: 5, symbols: 8, repeats: true };
  const pool = allCodes(5, 8, true);

  it('a solver step after the opening guess stays well under half a second', () => {
    for (const secret of [[8, 8, 8, 8, 8], [3, 1, 4, 1, 5], [2, 7, 1, 8, 2]]) {
      const open = openingGuess(setup);
      const f = score(secret, open);
      const cands = filterByFeedback(pool, open, f.place, f.symbol);
      const t = performance.now();
      const pick = nextGuessMinimax(cands, pool);
      const ms = performance.now() - t;
      expect(ms, `${cands.length} candidates`).toBeLessThan(400);
      expect(isValidCode(pick, setup)).toBe(true);
    }
  });
  it('the solver cracks a code and every guess is valid', () => {
    const secret = [6, 2, 2, 7, 3];
    const t = performance.now();
    const steps = solveSecret(secret, setup, pool);
    expect(performance.now() - t).toBeLessThan(5000);
    expect(steps[steps.length - 1].guess).toEqual(secret);
    expect(steps.length).toBeLessThanOrEqual(10);
    for (const s of steps) expect(isValidCode(s.guess, setup)).toBe(true);
  });
  it('is deterministic even when it has to sample', () => {
    const open = openingGuess(setup);
    const f = score([3, 1, 4, 1, 5], open);
    const cands = filterByFeedback(pool, open, f.place, f.symbol);
    expect(nextGuessMinimax(cands, pool)).toEqual(nextGuessMinimax(cands, pool));
  });
  it('the hint count over all 32768 codes is fast and exact', () => {
    const open = openingGuess(setup);
    const f = score([3, 1, 4, 1, 5], open);
    const t = performance.now();
    const left = consistent(pool, [{ guess: open, ...f }]);
    expect(performance.now() - t).toBeLessThan(500);
    expect(left).toHaveLength(filterByFeedback(pool, open, f.place, f.symbol).length);
  });
});

describe('symbols and labels', () => {
  it('has eight symbols with distinct digits and shape names', () => {
    expect(SYMBOLS).toHaveLength(8);
    expect(new Set(SYMBOLS.map((s) => s.n)).size).toBe(8);
    expect(new Set(SYMBOLS.map((s) => s.name)).size).toBe(8);
  });
  it('labels a symbol with its number and shape', () => {
    expect(symbolLabel(3)).toBe('Symbol 3, triangle');
    expect(symbolName(1)).toBe('circle');
    expect(symbolName(99)).toBe('unknown');
    expect(codeWords([1, 2])).toBe('1 circle, 2 square');
  });
  it('describes a score in words and in short form', () => {
    expect(feedbackText(2, 1)).toBe('2 right place, 1 right symbol wrong place');
    expect(feedbackShort(2, 1)).toBe('2 / 1');
  });
  it('offers the documented setup choices and defaults', () => {
    expect([...LENGTHS]).toEqual([4, 5]);
    expect([...SYMBOL_COUNTS]).toEqual([6, 8]);
    expect([...GUESS_LIMITS]).toEqual([8, 10, 12]);
    expect(DEFAULTS).toEqual({ length: 4, symbols: 6, repeats: true, guesses: 10 });
  });
});

describe('saved results', () => {
  it('builds a key per setup', () => {
    expect(bestKey(4, 6, true)).toBe('4-6-r');
    expect(bestKey(5, 8, false)).toBe('5-8-n');
  });
  it('keeps sane numbers for known keys and drops everything else', () => {
    const out = sanitiseResults({ '4-6-r': 5, '5-8-n': '7', '4-8-r': 0, '5-6-r': 13, '4-6-n': 2.5, '9-9-r': 3, wins: 12, junk: 'x' });
    expect(out).toEqual({ '4-6-r': 5, '5-8-n': 7, wins: 12 });
  });
  it('survives bad input of any shape', () => {
    expect(sanitiseResults(null)).toEqual({});
    expect(sanitiseResults('text')).toEqual({});
    expect(sanitiseResults(42)).toEqual({});
    expect(sanitiseResults({ '4-6-r': null, '5-6-r': '', '4-8-r': 'abc', wins: -1 })).toEqual({});
    expect(sanitiseResults({ wins: 1e9 })).toEqual({});
  });
});
