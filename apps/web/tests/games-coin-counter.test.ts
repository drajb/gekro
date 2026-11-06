/**
 * games-coin-counter.test.ts - the engine behind `coin-counter`.
 *
 * Pinned: all money is whole cents (never a fraction); formatting and parsing of
 * amounts round-trip and reject junk; the biggest-coin-first change algorithm uses
 * the fewest coins for every amount up to $5 and every coin set, checked against a
 * dynamic-programming count and an exhaustive search; every generated question is
 * well formed for its level (coins allowed, totals in range, four distinct
 * positive options that include the answer exactly once, change that is paid minus
 * price); a round is ten different questions, the same for the same seed; the tray
 * rules; saved bests are sanitised. The numbers on the guide page are asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  MODES, LEVELS, LEVEL_DENOMS, COUNT_COINS, MAX_TOTAL, MAKE_RANGE, ROUND_LENGTH, MAX_TRAY, MAX_TYPED_CENTS, COIN_INFO,
  formatCents, speakCents, parseMoney, totalOf, tally, describeCoins, runningTotals, fewestCoins, makeChange,
  addToTray, removeFromTray, judge, trayMessage, makeChoices, makeRound, answerOf, bestKey, sanitiseBest, plural, parseSeed,
  mulberry32, shuffled,
  type Mode, type Level, type Question,
} from '../src/components/apps-private/coin-counter/helpers';
import calculatorSource from '../src/components/apps-private/coin-counter/Calculator.astro?raw';

// The loops below are generous on purpose; a loaded machine must not turn them into flaky failures.
vi.setConfig({ testTimeout: 60_000 });

const ALL_DENOMS = [1, 5, 10, 25, 100];

/** Independent oracle: exhaustive recursion over coin counts, no table, for small amounts. */
const minCoinsExhaustive = (amount: number, denoms: readonly number[]): number => {
  const memo = new Map<string, number>();
  const go = (left: number, i: number): number => {
    if (left === 0) return 0;
    if (i === denoms.length) return Infinity;
    const key = `${left}|${i}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = Infinity;
    for (let k = 0; k * denoms[i] <= left; k++) best = Math.min(best, k + go(left - k * denoms[i], i + 1));
    memo.set(key, best);
    return best;
  };
  return go(amount, 0);
};

describe('money in whole cents', () => {
  it('formats below a dollar as cents and from a dollar as dollars, matching an independent formatter, for 0 to 2000', () => {
    for (let c = 0; c <= 2000; c++) {
      const want = c < 100 ? `${c}¢` : (() => { const s = String(c).padStart(3, '0'); return `$${s.slice(0, -2)}.${s.slice(-2)}`; })();
      expect(formatCents(c)).toBe(want);
    }
    expect(formatCents(5)).toBe('5¢');
    expect(formatCents(100)).toBe('$1.00');
    expect(formatCents(105)).toBe('$1.05');
    expect(formatCents(499)).toBe('$4.99');
  });
  it('treats bad input as zero cents', () => {
    for (const bad of [-1, 1.5, NaN, Infinity, MAX_TYPED_CENTS + 1, '5' as unknown as number, null as unknown as number]) {
      expect(formatCents(bad)).toBe('0¢');
      expect(speakCents(bad)).toBe('0 cents');
    }
  });
  it('speaks amounts with the right singular and plural', () => {
    expect(speakCents(0)).toBe('0 cents');
    expect(speakCents(1)).toBe('1 cent');
    expect(speakCents(35)).toBe('35 cents');
    expect(speakCents(100)).toBe('1 dollar');
    expect(speakCents(101)).toBe('1 dollar and 1 cent');
    expect(speakCents(235)).toBe('2 dollars and 35 cents');
    expect(speakCents(200)).toBe('2 dollars');
  });
  it('totalOf is exact integer addition', () => {
    expect(totalOf([25, 25, 10, 5, 1, 1, 1])).toBe(68);
    expect(totalOf([])).toBe(0);
    // The classic decimal trap: 0.1 + 0.2 is not 0.3 in floating point, but 10 + 20 is 30.
    expect(totalOf([10, 20])).toBe(30);
    expect(totalOf(Array(100).fill(1))).toBe(100);
  });
  it('coin values are the real US values and every denomination has a name', () => {
    expect(Object.keys(COIN_INFO).map(Number).sort((a, b) => a - b)).toEqual(ALL_DENOMS);
    expect(COIN_INFO[1].name).toBe('penny');
    expect(COIN_INFO[5].name).toBe('nickel');
    expect(COIN_INFO[10].name).toBe('dime');
    expect(COIN_INFO[25].name).toBe('quarter');
    expect(COIN_INFO[100].name).toBe('dollar');
    expect(COIN_INFO[100].kind).toBe('bill');
    for (const c of ALL_DENOMS) expect(COIN_INFO[c].cents).toBe(c);
  });
});

describe('typed amounts', () => {
  it('reads cents and dollars', () => {
    const table: [string, number][] = [
      ['35', 35], ['0', 0], ['7', 7], ['100', 100], ['35c', 35], ['35 c', 35], ['35 cents', 35], ['1 cent', 1], ['35¢', 35], ['  35  ', 35],
      ['$1', 100], ['$5', 500], ['$1.35', 135], ['1.35', 135], ['$1.5', 150], ['1.5', 150], ['$0.35', 35], ['.35', 35], ['$.50', 50], ['$1.05', 105], ['$12.99', 1299], ['0.05', 5],
      ['$ 1 . 35', 135],
    ];
    for (const [text, cents] of table) expect(parseMoney(text), text).toBe(cents);
  });
  it('rejects everything that is not an amount', () => {
    const bad = ['', ' ', 'abc', '$', '.', '$.', '1.234', '1..3', '-5', '+5', '1,50', '1e3', '0x10', '35cc', 'c35', '$1c', '12345', '123456', '$1.2.3',
      '٣٥', '35; drop', '<b>', '1'.repeat(40), '$-1', '5%', 'NaN', 'Infinity'];
    for (const t of bad) expect(parseMoney(t), JSON.stringify(t)).toBeNull();
    for (const t of [null, undefined, 35, NaN, {}, [], true]) expect(parseMoney(t as unknown)).toBeNull();
  });
  it('round-trips with formatCents for every amount from 1 to 5000', () => {
    for (let c = 1; c <= 5000; c++) expect(parseMoney(formatCents(c)), String(c)).toBe(c);
  });
  it('random strings never give a non-integer or an out-of-range amount', () => {
    const rng = mulberry32(5);
    const chars = '0123456789$.c ¢-+eE,';
    for (let t = 0; t < 20000; t++) {
      const len = 1 + Math.floor(rng() * 8);
      let s = '';
      for (let k = 0; k < len; k++) s += chars[Math.floor(rng() * chars.length)];
      const v = parseMoney(s);
      if (v !== null) {
        expect(Number.isInteger(v), s).toBe(true);
        expect(v >= 0 && v <= MAX_TYPED_CENTS, s).toBe(true);
      }
    }
  });
});

describe('fewest coins and the change algorithm', () => {
  it('matches an exhaustive search for every amount up to 80 and every coin set a level uses', () => {
    for (const l of LEVELS) {
      for (let a = 0; a <= 80; a++) {
        expect(fewestCoins(a, LEVEL_DENOMS[l]), `${l} ${a}`).toBe(minCoinsExhaustive(a, LEVEL_DENOMS[l]));
      }
    }
  });
  it('biggest-coin-first uses exactly the fewest coins for every amount from 0 to $5 and every coin set (dynamic programming oracle)', () => {
    for (const l of LEVELS) {
      for (let a = 0; a <= 500; a++) {
        const coins = makeChange(a, LEVEL_DENOMS[l]);
        expect(totalOf(coins), `${l} ${a} total`).toBe(a);
        expect(coins.length, `${l} ${a} count`).toBe(fewestCoins(a, LEVEL_DENOMS[l]));
        for (const c of coins) expect(LEVEL_DENOMS[l]).toContain(c);
      }
    }
    // Also with all five coins for amounts above $5.
    for (let a = 501; a <= 1500; a += 7) expect(makeChange(a, ALL_DENOMS).length).toBe(fewestCoins(a, ALL_DENOMS));
  });
  it('known examples', () => {
    expect(makeChange(41, ALL_DENOMS)).toEqual([25, 10, 5, 1]);
    expect(makeChange(99, ALL_DENOMS)).toEqual([25, 25, 25, 10, 10, 1, 1, 1, 1]);
    expect(makeChange(0, ALL_DENOMS)).toEqual([]);
    expect(makeChange(499, ALL_DENOMS)).toHaveLength(4 + 3 + 2 + 4);
    expect(fewestCoins(30, [25, 10, 5, 1])).toBe(2);
    expect(fewestCoins(7, [10, 5, 1])).toBe(3);
  });
  it('greedy is NOT always best for odd coin sets (so the page only claims it for these five)', () => {
    expect(makeChange(6, [4, 3, 1]).length).toBe(3); // 4+1+1
    expect(fewestCoins(6, [4, 3, 1])).toBe(2); // 3+3
  });
  it('is bounded: rejects negative, fractional and huge amounts', () => {
    for (const bad of [-1, 1.5, NaN, 5001, 1e9]) {
      expect(() => makeChange(bad, ALL_DENOMS)).toThrow(RangeError);
      expect(() => fewestCoins(bad, ALL_DENOMS)).toThrow(RangeError);
    }
  });
  it('describes coins in words, biggest first, with the right plural', () => {
    expect(describeCoins([10, 25, 25])).toBe('2 quarters and 1 dime');
    expect(describeCoins([1])).toBe('1 penny');
    expect(describeCoins([1, 1, 5, 100])).toBe('1 dollar, 1 nickel and 2 pennies');
    expect(describeCoins([])).toBe('no coins');
    expect(describeCoins([5, 5, 5])).toBe('3 nickels');
    expect(tally([25, 25, 10])).toEqual({ 25: 2, 10: 1 });
  });
  it('running totals count along a list', () => {
    expect(runningTotals([25, 10, 5, 1])).toEqual([25, 35, 40, 41]);
    expect(runningTotals([])).toEqual([]);
  });
});

describe('questions', () => {
  const seeds = Array.from({ length: 120 }, (_, i) => i + 1);

  it('a round is ten different questions, for every mode and level', () => {
    expect(ROUND_LENGTH).toBe(10);
    for (const m of MODES) for (const l of LEVELS) for (const s of seeds) {
      const round = makeRound(m, l, mulberry32(s * 977));
      expect(round, `${m} ${l} #${s}`).toHaveLength(10);
      const keys = new Set(round.map((q) => JSON.stringify(q)));
      expect(keys.size).toBe(10);
      for (const q of round) expect(q.kind).toBe(m);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    for (const m of MODES) for (const l of LEVELS) {
      expect(makeRound(m, l, mulberry32(42))).toEqual(makeRound(m, l, mulberry32(42)));
      expect(makeRound(m, l, mulberry32(1))).not.toEqual(makeRound(m, l, mulberry32(2)));
    }
  });

  it('count questions: coins allowed for the level, total is their exact sum within range', () => {
    for (const l of LEVELS) for (const s of seeds) {
      for (const q of makeRound('count', l, mulberry32(s * 31 + 7)) as Extract<Question, { kind: 'count' }>[]) {
        expect(q.coins.length).toBeGreaterThanOrEqual(COUNT_COINS[l].min);
        expect(q.coins.length).toBeLessThanOrEqual(COUNT_COINS[l].max);
        for (const c of q.coins) expect(LEVEL_DENOMS[l]).toContain(c);
        expect(Number.isInteger(q.total)).toBe(true);
        expect(q.total).toBe(q.coins.reduce((a, b) => a + b, 0));
        expect(q.total).toBeGreaterThanOrEqual(2);
        expect(q.total).toBeLessThanOrEqual(MAX_TOTAL[l]);
        expect(answerOf(q)).toBe(q.total);
        if (l !== 'big') expect(q.coins).toEqual(q.coins.slice().sort((a, b) => b - a)); // sorted, easier to count
      }
    }
  });

  it('count answer options: four different positive totals that include the answer exactly once (Little and Middle); typed for Big', () => {
    for (const l of ['little', 'middle'] as Level[]) for (const s of seeds) {
      for (const q of makeRound('count', l, mulberry32(s * 13)) as Extract<Question, { kind: 'count' }>[]) {
        const ch = q.choices!;
        expect(ch).toHaveLength(4);
        expect(new Set(ch).size).toBe(4);
        expect(ch.filter((v) => v === q.total)).toHaveLength(1);
        for (const v of ch) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(1); }
        expect(ch).toEqual(ch.slice().sort((a, b) => a - b));
      }
    }
    for (const s of seeds) for (const q of makeRound('count', 'big', mulberry32(s)) as Extract<Question, { kind: 'count' }>[]) expect(q.choices).toBeNull();
  });

  it('makeChoices works even for the smallest totals', () => {
    for (let total = 1; total <= 600; total++) {
      for (let s = 1; s <= 5; s++) {
        const ch = makeChoices(total, mulberry32(s + total));
        expect(ch).toHaveLength(4);
        expect(new Set(ch).size).toBe(4);
        expect(ch).toContain(total);
        expect(ch.every((v) => v >= 1)).toBe(true);
      }
    }
  });

  it('make questions: the target is in the level range and the stated fewest is the true fewest', () => {
    for (const l of LEVELS) for (const s of seeds) {
      for (const q of makeRound('make', l, mulberry32(s * 5)) as Extract<Question, { kind: 'make' }>[]) {
        expect(Number.isInteger(q.target)).toBe(true);
        expect(q.target).toBeGreaterThanOrEqual(MAKE_RANGE[l].min);
        expect(q.target).toBeLessThanOrEqual(MAKE_RANGE[l].max);
        expect(q.fewest).toBe(fewestCoins(q.target, LEVEL_DENOMS[l]));
        if (q.target <= 80) expect(q.fewest).toBe(minCoinsExhaustive(q.target, LEVEL_DENOMS[l]));
        expect(answerOf(q)).toBe(q.target);
      }
    }
  });

  it('change questions: change is paid minus price, positive, made from the level coins, pieces add up to what was paid', () => {
    for (const l of LEVELS) for (const s of seeds) {
      for (const q of makeRound('change', l, mulberry32(s * 3 + 1)) as Extract<Question, { kind: 'change' }>[]) {
        expect(Number.isInteger(q.price) && Number.isInteger(q.paid) && Number.isInteger(q.target)).toBe(true);
        expect(q.target).toBe(q.paid - q.price);
        expect(q.target).toBeGreaterThan(0);
        expect(q.price).toBeGreaterThan(0);
        expect(q.paidPieces.reduce((a, b) => a + b, 0)).toBe(q.paid);
        expect(q.fewest).toBe(fewestCoins(q.target, LEVEL_DENOMS[l]));
        if (l === 'little') { expect([5, 10]).toContain(q.paid); expect(q.paidPieces).toEqual([q.paid]); expect(q.price).toBeLessThan(q.paid); }
        if (l === 'middle') { expect(q.paid).toBe(100); expect(q.price % 5).toBe(0); expect(q.price).toBeGreaterThanOrEqual(5); expect(q.price).toBeLessThanOrEqual(95); }
        if (l === 'big') {
          expect(q.price % 100).not.toBe(0);
          expect(q.price).toBeGreaterThanOrEqual(31);
          expect(q.price).toBeLessThanOrEqual(499);
          expect(q.paid % 100).toBe(0);
          expect(q.paid).toBeGreaterThan(q.price);
          expect(q.paid).toBeLessThanOrEqual(500);
          expect(q.paidPieces.every((p) => p === 100)).toBe(true);
        }
      }
    }
  });

  it('all three levels reach the amounts the page quotes', () => {
    let maxBigCount = 0;
    let maxBigMake = 0;
    for (let s = 1; s <= 400; s++) {
      for (const q of makeRound('count', 'big', mulberry32(s)) as Extract<Question, { kind: 'count' }>[]) maxBigCount = Math.max(maxBigCount, q.total);
      for (const q of makeRound('make', 'big', mulberry32(s)) as Extract<Question, { kind: 'make' }>[]) maxBigMake = Math.max(maxBigMake, q.target);
    }
    expect(maxBigCount).toBeGreaterThan(300);
    expect(maxBigCount).toBeLessThanOrEqual(500);
    expect(maxBigMake).toBeGreaterThan(450);
    expect(MAX_TOTAL).toEqual({ little: 30, middle: 99, big: 500 });
    expect(MAKE_RANGE).toEqual({ little: { min: 2, max: 30 }, middle: { min: 6, max: 99 }, big: { min: 31, max: 499 } });
    expect(LEVEL_DENOMS).toEqual({ little: [10, 5, 1], middle: [25, 10, 5, 1], big: [100, 25, 10, 5, 1] });
  });

  it('rejects an unknown mode or level and clamps a silly length', () => {
    expect(() => makeRound('shop' as Mode, 'little', mulberry32(1))).toThrow(RangeError);
    expect(() => makeRound('count', 'huge' as Level, mulberry32(1))).toThrow(RangeError);
    expect(makeRound('count', 'little', mulberry32(1), 0)).toHaveLength(10);
    expect(makeRound('count', 'little', mulberry32(1), NaN)).toHaveLength(10);
    expect(makeRound('count', 'little', mulberry32(1), 999)).toHaveLength(10);
    expect(makeRound('make', 'big', mulberry32(1), 3)).toHaveLength(3);
  });

  it('survives a degenerate rng', () => {
    for (const rng of [() => 0, () => 0.999999, () => NaN]) {
      for (const m of MODES) for (const l of LEVELS) {
        const round = makeRound(m, l, rng);
        expect(round.length).toBeGreaterThanOrEqual(1);
        for (const q of round) expect(Number.isInteger(answerOf(q))).toBe(true);
      }
    }
  });
});

describe('the tray', () => {
  it('adds only allowed coins and stops at the limit', () => {
    let t: number[] = [];
    t = addToTray(t, 25, LEVEL_DENOMS.middle);
    expect(t).toEqual([25]);
    expect(addToTray(t, 100, LEVEL_DENOMS.middle)).toEqual([25]); // no dollar at Middle
    expect(addToTray(t, 3, LEVEL_DENOMS.big)).toEqual([25]);
    for (let i = 0; i < 50; i++) t = addToTray(t, 1, LEVEL_DENOMS.middle);
    expect(t).toHaveLength(MAX_TRAY);
    expect(MAX_TRAY).toBe(24);
  });
  it('never changes the tray it was given', () => {
    const t = [10, 5];
    addToTray(t, 1, LEVEL_DENOMS.little);
    removeFromTray(t, 0);
    expect(t).toEqual([10, 5]);
  });
  it('removes one coin by position and ignores a bad position', () => {
    expect(removeFromTray([10, 5, 1], 1)).toEqual([10, 1]);
    expect(removeFromTray([10, 5, 1], 0)).toEqual([5, 1]);
    for (const bad of [-1, 3, 1.5, NaN]) expect(removeFromTray([10, 5, 1], bad)).toEqual([10, 5, 1]);
  });
  it('judges exact, under and over, with specific friendly sentences', () => {
    expect(judge(35, 35)).toBe('exact');
    expect(judge(30, 35)).toBe('under');
    expect(judge(40, 35)).toBe('over');
    expect(trayMessage(35, 35)).toBe('That is exactly 35 cents.');
    expect(trayMessage(30, 35)).toBe('You have 30 cents. You need 5 cents more.');
    expect(trayMessage(101, 100)).toBe('You have 1 dollar and 1 cent. That is 1 cent too much. Take a coin off and try again.');
  });
  it('random add and remove never break the total or the limit', () => {
    const rng = mulberry32(21);
    let t: number[] = [];
    for (let step = 0; step < 5000; step++) {
      const r = rng();
      if (r < 0.6) t = addToTray(t, ALL_DENOMS[Math.floor(rng() * 5)], ALL_DENOMS);
      else if (r < 0.9) t = removeFromTray(t, Math.floor(rng() * (t.length + 2)) - 1);
      else t = [];
      expect(t.length).toBeLessThanOrEqual(MAX_TRAY);
      expect(Number.isInteger(totalOf(t))).toBe(true);
      expect(t.every((c) => ALL_DENOMS.includes(c))).toBe(true);
    }
  });
});

describe('saved best scores', () => {
  it('keys are mode and level', () => {
    expect(bestKey('make', 'middle')).toBe('make-middle');
  });
  it('keeps whole scores from 1 to 10 for known keys and drops everything else', () => {
    expect(sanitiseBest({ 'count-little': 10, 'make-big': 1, 'change-middle': 7 })).toEqual({ 'count-little': 10, 'make-big': 1, 'change-middle': 7 });
    expect(sanitiseBest({ 'count-little': 11, 'make-big': 0, 'change-middle': -1, 'count-big': 2.5, 'make-little': NaN, 'make-middle': Infinity })).toEqual({});
    expect(sanitiseBest({ 'count-little': 5, 'sell-little': 3, 'count-huge': 3, x: 1 })).toEqual({ 'count-little': 5 });
  });
  it('rejects strings, booleans, arrays, null, prototype tricks and non-objects', () => {
    expect(sanitiseBest({ 'count-little': '5', 'make-little': true, 'make-big': [5], 'count-big': null })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"count-little": 5}, "constructor": 3}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
  it('returns a fresh object', () => {
    const raw = { 'count-little': 4 };
    const out = sanitiseBest(raw);
    expect(out).not.toBe(raw);
  });
});

describe('small helpers', () => {
  it('pluralises', () => {
    expect(plural(1, 'coin')).toBe('1 coin');
    expect(plural(2, 'coin')).toBe('2 coins');
  });
  it('parseSeed accepts only whole numbers from 1 to 2^32 - 1', () => {
    expect(parseSeed('1')).toBe(1);
    expect(parseSeed('4294967295')).toBe(4294967295);
    for (const bad of ['0', '-1', '4294967296', '1.5', '1e3', '', 'abc', NaN, null, undefined, {}, '99999999999']) expect(parseSeed(bad)).toBeNull();
  });
  it('shuffle keeps every item once', () => {
    const a = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffled(a, mulberry32(3)).sort((x, y) => x - y)).toEqual(a);
  });
});

describe('the page', () => {
  it('draws coins from value and name only: no pictures, no portrait text, and the dollar is a plain rectangle', () => {
    expect(calculatorSource).not.toMatch(/portrait|eagle|<svg|<img/i);
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:coin-counter/);
    expect(COIN_INFO[100].label).toBe('$1');
  });
  it('keeps every sum in whole cents: no floating-point money in the page', () => {
    expect(calculatorSource).not.toMatch(/toFixed|parseFloat|\*\s*100\b|\/\s*100\b/);
  });
  it('coin names are at least 9 px, and the level menu and plain buttons are at least 44 px tall', () => {
    const sizes = [...calculatorSource.matchAll(/\.cnc-nm[^{]*\{[^}]*font-size:\s*(?:max\()?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThanOrEqual(4);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(9);
    expect(calculatorSource).toContain(':where(button:not(.cnc-coin):not(.cnc-choice):not(.cnc-tab), select) { box-sizing: border-box; min-height: 2.75rem; }');
  });
});
