/**
 * games-idle-orchard.test.ts - the engine behind `idle-orchard`.
 *
 * Pinned: every number the guide page quotes (growth 1.15, 999 owned, the 4 hour offline cap,
 * 5 percent a blossom, the square-root rule for blossoms, the six producers and twelve upgrades);
 * costs against hand-worked values and against a sum of single prices; maxAffordable against a
 * brute-force search; production per second against a hand-worked orchard with upgrades and
 * blossoms; picking by hand; offline catch-up (capped, never negative, clock skew safe); new
 * seasons; big-number, rate and time formatting at every edge (999999 becomes 1.00M, not
 * 1000K); that a greedy bot's orchard is repeatable and reaches the milestones the page
 * implies; thousands of random action sequences never produce NaN, a negative or an over-cap
 * number; and that anything in localStorage is checked field by field before the page sees it.
 */
import { describe, it, expect, vi } from 'vitest';

// Thousands of random cases per test; the machine may be busy, so allow plenty of time.
vi.setConfig({ testTimeout: 120_000 });
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GROWTH, MAX_OWNED, MAX_FRUIT, OFFLINE_CAP_SECONDS, BLOSSOM_BONUS, BLOSSOM_DIVISOR, MAX_BLOSSOMS, MAX_SEASONS, MAX_PICKS, PEAK_GAIN, MAX_MINUTE, UPGRADE_MASK,
  PRODUCERS, UPGRADES, plural, newState, hasUpgrade, upgradeCount, seasonMult, unitRate, rateOf, clickValue, costOf, buyCost, maxAffordable, buyProducer,
  upgradeUnlocked, buyUpgrade, upgradeEffect, upgradeNeed, pick, advance, awaySeconds, catchUp, blossomsPending, canNewSeason, newSeason,
  formatNumber, formatRate, formatDuration, welcomeBack, needMore, seasonText, shareLine, pickTone, buyTone, toSave, loadSave,
  type State,
} from '../src/components/apps-private/idle-orchard/helpers';

const EM_DASH = String.fromCharCode(0x2014);

/** A small deterministic generator for the fuzz tests (not part of the game). */
const lcg = (seed: number) => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };

const sane = (s: State): void => {
  for (const v of [s.fruit, s.total, s.picks, s.blossoms, s.seasons, s.up, ...s.own]) expect(Number.isFinite(v)).toBe(true);
  expect(s.fruit).toBeGreaterThanOrEqual(0);
  expect(s.fruit).toBeLessThanOrEqual(MAX_FRUIT);
  expect(s.total).toBeGreaterThanOrEqual(0);
  expect(s.total).toBeLessThanOrEqual(MAX_FRUIT);
  expect(s.own).toHaveLength(PRODUCERS.length);
  for (const n of s.own) { expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(MAX_OWNED); }
  expect(Number.isInteger(s.up)).toBe(true);
  expect(s.up & ~UPGRADE_MASK).toBe(0);
  expect(Number.isInteger(s.blossoms) && s.blossoms >= 0 && s.blossoms <= MAX_BLOSSOMS).toBe(true);
  expect(Number.isInteger(s.seasons) && s.seasons >= 1 && s.seasons <= MAX_SEASONS).toBe(true);
};

describe('constants quoted on the guide page', () => {
  it('match the spec', () => {
    expect(GROWTH).toBe(1.15);
    expect(MAX_OWNED).toBe(999);
    expect(MAX_FRUIT).toBe(1e18);
    expect(OFFLINE_CAP_SECONDS).toBe(14400);
    expect(BLOSSOM_BONUS).toBe(0.05);
    expect(BLOSSOM_DIVISOR).toBe(1e5);
    expect(MAX_BLOSSOMS).toBe(99999);
    expect(MAX_SEASONS).toBe(9999);
    expect(MAX_PICKS).toBe(1e9);
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
  });
  it('six producers with rising prices and rates, and twelve upgrades', () => {
    expect(PRODUCERS.map((p) => p.name)).toEqual(['Sapling', 'Apple tree', 'Pear grove', 'Picker crew', 'Fruit cart', 'Hill orchard']);
    expect(PRODUCERS.map((p) => p.cost)).toEqual([15, 100, 1100, 12000, 130000, 1400000]);
    expect(PRODUCERS.map((p) => p.rate)).toEqual([0.1, 1, 8, 47, 260, 1400]);
    for (let i = 1; i < PRODUCERS.length; i++) {
      expect(PRODUCERS[i].cost).toBeGreaterThan(PRODUCERS[i - 1].cost);
      expect(PRODUCERS[i].rate).toBeGreaterThan(PRODUCERS[i - 1].rate);
    }
    expect(UPGRADES).toHaveLength(12);
    expect(UPGRADE_MASK).toBe(4095);
    expect(new Set(PRODUCERS.map((p) => p.id)).size).toBe(6);
    expect(new Set(UPGRADES.map((u) => u.name)).size).toBe(12);
  });
  it('every upgrade points at something that exists and needs something that comes first', () => {
    UPGRADES.forEach((u, i) => {
      if (typeof u.target === 'number') expect(PRODUCERS[u.target]).toBeDefined();
      if (u.needUpgrade !== undefined) expect(u.needUpgrade).toBeLessThan(i);
      if (u.needProducer) expect(PRODUCERS[u.needProducer.index]).toBeDefined();
      expect(u.mult).toBeGreaterThan(1);
      expect(u.cost).toBeGreaterThan(0);
    });
  });
});

describe('prices', () => {
  it('match hand-worked values', () => {
    expect([0, 1, 2, 3, 10].map((n) => costOf(0, n))).toEqual([15, 18, 20, 23, 61]);
    expect([0, 1, 2, 3, 4].map((n) => costOf(1, n))).toEqual([100, 115, 133, 153, 175]);
    expect(costOf(99, 0)).toBe(Infinity);
  });
  it('rise with every one you own, and stay finite up to the cap', () => {
    for (let i = 0; i < PRODUCERS.length; i++) {
      let prev = 0;
      for (let n = 0; n <= MAX_OWNED; n += 1) {
        const c = costOf(i, n);
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeGreaterThan(prev);
        prev = c;
      }
    }
  });
  it('buyCost is the sum of the single prices', () => {
    const s = newState();
    for (const have of [0, 3, 40]) {
      s.own[1] = have;
      for (const qty of [0, 1, 2, 10, 25]) {
        let sum = 0;
        for (let k = 0; k < qty; k++) sum += costOf(1, have + k);
        expect(buyCost(s, 1, qty)).toBe(sum);
      }
    }
    expect(buyCost(s, 1, NaN)).toBe(0);
    expect(buyCost(s, 1, -3)).toBe(0);
  });
  it('maxAffordable matches a brute-force search over many amounts of fruit', () => {
    const rnd = lcg(5);
    for (let n = 0; n < 400; n++) {
      const s = newState();
      const idx = Math.floor(rnd() * PRODUCERS.length);
      s.own[idx] = Math.floor(rnd() * 60);
      s.fruit = Math.floor(rnd() * 10 ** (1 + rnd() * 9));
      let best = 0;
      for (let q = 1; q <= 400; q++) { if (buyCost(s, idx, q) <= s.fruit) best = q; else break; }
      if (best < 400) expect(maxAffordable(s, idx)).toBe(best);
    }
    expect(maxAffordable(newState(), 99)).toBe(0);
  });
  it('buying never spends more than you have and always spends exactly the price', () => {
    const rnd = lcg(9);
    for (let n = 0; n < 500; n++) {
      const s = newState();
      s.fruit = Math.floor(rnd() * 1e7);
      const before = s.fruit;
      const idx = Math.floor(rnd() * PRODUCERS.length);
      const have = s.own[idx];
      const qty = Math.floor(rnd() * 30);
      // worked out one by one, from the single prices
      let wantBought = 0;
      let left = before;
      while (wantBought < qty && costOf(idx, have + wantBought) <= left) { left -= costOf(idx, have + wantBought); wantBought += 1; }
      const got = buyProducer(s, idx, qty);
      expect(got).toBe(wantBought);
      expect(s.fruit).toBe(left);
      expect(s.fruit).toBeGreaterThanOrEqual(0);
      expect(s.own[idx]).toBe(have + got);
    }
    const s = newState();
    s.fruit = 1e18;
    const can = maxAffordable(s, 0);
    expect(can).toBeGreaterThan(200);
    expect(buyProducer(s, 0, 1e9)).toBe(can);
    expect(s.own[0]).toBe(can);
    expect(s.fruit).toBeLessThan(costOf(0, can));
    expect(buyProducer(s, 0, 5)).toBe(0);
    s.own[0] = MAX_OWNED;
    s.fruit = 1e18;
    expect(maxAffordable(s, 0)).toBe(0);
    expect(buyProducer(s, 0, 5)).toBe(0);
    expect(buyProducer(s, 77, 5)).toBe(0);
    expect(buyProducer(s, 0, NaN)).toBe(0);
  });
});

describe('production and picking', () => {
  it('an empty orchard makes nothing and a pick gives one fruit', () => {
    const s = newState();
    expect(rateOf(s)).toBe(0);
    expect(clickValue(s)).toBe(1);
    expect(seasonMult(s)).toBe(1);
    expect(pick(s)).toBe(1);
    expect(s.fruit).toBe(1);
    expect(s.total).toBe(1);
    expect(s.picks).toBe(1);
  });
  it('rate is worked out by hand: producers x upgrades x the sunny year x blossoms', () => {
    const s = newState();
    s.own[0] = 5;
    s.own[1] = 10;
    s.up = (1 << 3) | (1 << 5) | (1 << 11);
    s.blossoms = 4;
    // (5 * 0.1 * 2 + 10 * 1 * 2) * 1.5 * 1.2
    expect(seasonMult(s)).toBeCloseTo(1.2, 12);
    expect(unitRate(s, 0)).toBeCloseTo(0.1 * 2 * 1.5 * 1.2, 12);
    expect(unitRate(s, 1)).toBeCloseTo(1 * 2 * 1.5 * 1.2, 12);
    expect(rateOf(s)).toBeCloseTo((5 * 0.1 * 2 + 10 * 1 * 2) * 1.5 * 1.2, 10);
    expect(rateOf(s)).toBeCloseTo(37.8, 10);
    expect(unitRate(s, 99)).toBe(0);
  });
  it('picking by hand is boosted by the three basket upgrades and the blossoms', () => {
    const s = newState();
    s.up = 0b111;
    expect(clickValue(s)).toBe(2 * 2 * 3);
    s.blossoms = 10;
    expect(clickValue(s)).toBeCloseTo(12 * 1.5, 12);
    // the other upgrades do not change a pick
    const t = newState();
    t.up = UPGRADE_MASK & ~0b111;
    expect(clickValue(t)).toBe(1);
  });
  it('advance adds rate x seconds, to the fruit in hand and to the season total', () => {
    const s = newState();
    s.own[1] = 3;
    const gain = advance(s, 10);
    expect(gain).toBeCloseTo(30, 10);
    expect(s.fruit).toBeCloseTo(30, 10);
    expect(s.total).toBeCloseTo(30, 10);
    expect(advance(s, -5)).toBe(0);
    expect(advance(s, NaN)).toBe(0);
    expect(advance(s, Infinity)).toBe(0);
    expect(advance(newState(), 100)).toBe(0);
  });
  it('fruit stops at the cap', () => {
    const s = newState();
    s.own[5] = 999;
    s.fruit = MAX_FRUIT - 5;
    s.total = MAX_FRUIT - 5;
    advance(s, 3600);
    expect(s.fruit).toBe(MAX_FRUIT);
    expect(s.total).toBe(MAX_FRUIT);
    pick(s);
    expect(s.fruit).toBe(MAX_FRUIT);
  });
  it('every upgrade makes the orchard faster or the pick stronger, never slower', () => {
    UPGRADES.forEach((u, i) => {
      const s = newState();
      s.own = PRODUCERS.map(() => 40);
      const rate = rateOf(s);
      const click = clickValue(s);
      s.up = 1 << i;
      expect(rateOf(s)).toBeGreaterThanOrEqual(rate);
      expect(clickValue(s)).toBeGreaterThanOrEqual(click);
      if (u.target === 'click') expect(clickValue(s)).toBe(click * u.mult); else expect(rateOf(s)).toBeGreaterThan(rate);
    });
  });
});

describe('upgrades', () => {
  it('only the first basket is on offer at the start, and requirements open the others', () => {
    const s = newState();
    expect(UPGRADES.map((_, i) => upgradeUnlocked(s, i)).filter(Boolean)).toHaveLength(1);
    expect(upgradeUnlocked(s, 0)).toBe(true);
    expect(upgradeUnlocked(s, 1)).toBe(false);
    s.own[0] = 5;
    expect(upgradeUnlocked(s, 3)).toBe(true);
    expect(upgradeUnlocked(s, 4)).toBe(false);
    s.own[0] = 25;
    expect(upgradeUnlocked(s, 4)).toBe(true);
    s.own[1] = 39;
    expect(upgradeUnlocked(s, 11)).toBe(false);
    s.own[1] = 40;
    expect(upgradeUnlocked(s, 11)).toBe(true);
    expect(upgradeUnlocked(s, -1)).toBe(false);
    expect(upgradeUnlocked(s, 12)).toBe(false);
    expect(upgradeUnlocked(s, 1.5)).toBe(false);
  });
  it('buying costs the price once, needs the fruit and the requirement, and cannot be repeated', () => {
    const s = newState();
    s.fruit = 99;
    expect(buyUpgrade(s, 0)).toBe(false);
    s.fruit = 150;
    expect(buyUpgrade(s, 0)).toBe(true);
    expect(s.fruit).toBe(50);
    expect(hasUpgrade(s, 0)).toBe(true);
    expect(upgradeCount(s)).toBe(1);
    s.fruit = 1e6;
    expect(buyUpgrade(s, 0)).toBe(false);
    expect(buyUpgrade(s, 2)).toBe(false); // needs the gloves
    expect(buyUpgrade(s, 1)).toBe(true);
    expect(buyUpgrade(s, 2)).toBe(true);
    expect(s.fruit).toBe(1e6 - 1000 - 50000);
    expect(clickValue(s)).toBe(12);
    expect(hasUpgrade(s, 99)).toBe(false);
  });
  it('the words say what an upgrade does and needs', () => {
    expect(upgradeEffect(0)).toBe('Each pick gives twice the fruit');
    expect(upgradeEffect(2)).toBe('Each pick gives three times the fruit');
    expect(upgradeEffect(3)).toBe('Saplings make twice the fruit');
    expect(upgradeEffect(7)).toBe('Pear groves make twice the fruit');
    expect(upgradeEffect(11)).toBe('Everything makes 1.5 times the fruit');
    expect(upgradeEffect(99)).toBe('');
    expect(upgradeNeed(0)).toBe('');
    expect(upgradeNeed(1)).toBe('Needs Wide baskets');
    expect(upgradeNeed(3)).toBe('Needs 5 saplings');
    expect(upgradeNeed(11)).toBe('Needs 40 apple trees');
  });
});

describe('time away', () => {
  it('works for the first four hours only', () => {
    const s = newState();
    s.own[1] = 10;
    const c = catchUp(s, 3600);
    expect(c).toMatchObject({ seconds: 3600, capped: false });
    expect(c.gain).toBeCloseTo(36000, 6);
    const t = newState();
    t.own[1] = 10;
    const d = catchUp(t, 100 * 3600);
    expect(d).toMatchObject({ seconds: 14400, capped: true });
    expect(d.gain).toBeCloseTo(144000, 6);
    const u = newState();
    u.own[1] = 10;
    expect(catchUp(u, 14400).capped).toBe(false);
    expect(catchUp(u, 14401).capped).toBe(true);
  });
  it('a bad or negative time away counts as no time', () => {
    for (const bad of [-1, -1e9, NaN, undefined as unknown as number, 'x' as unknown as number]) {
      const s = newState();
      s.own[1] = 10;
      expect(catchUp(s, bad)).toEqual({ seconds: 0, capped: false, gain: 0 });
      expect(s.fruit).toBe(0);
    }
    const s = newState();
    s.own[1] = 1;
    expect(catchUp(s, Infinity).seconds).toBe(0); // not a real number
  });
  it('works out the time away from the saved minute and the clock, and a clock that went back is no time', () => {
    expect(awaySeconds(null, 1e12)).toBe(0);
    expect(awaySeconds(1000, 1000 * 60000 + 90_000)).toBe(90);
    expect(awaySeconds(1000, 1000 * 60000 - 90_000)).toBe(0);
    expect(awaySeconds(1000, NaN)).toBe(0);
  });
  it('says welcome back only when you were away for a while, and mentions the cap when it applied', () => {
    expect(welcomeBack({ seconds: 10, capped: false, gain: 99 })).toBe('');
    expect(welcomeBack({ seconds: 600, capped: false, gain: 0 })).toBe('');
    expect(welcomeBack({ seconds: 4380, capped: false, gain: 12400 })).toBe('Welcome back! You were away 1 h 13 min and the orchard grew 12.4K fruit.');
    expect(welcomeBack({ seconds: 14400, capped: true, gain: 5e6 })).toBe('Welcome back! You were away 4 h and the orchard grew 5.00M fruit. The orchard works for up to 4 hours while you are away.');
  });
});

describe('new seasons and blossoms', () => {
  it('blossoms are the square root of (fruit grown this season / 100,000), rounded down', () => {
    const s = newState();
    for (const [total, want] of [[0, 0], [99999, 0], [100000, 1], [399999, 1], [400000, 2], [1e6, 3], [1e8, 31], [1e10, 316], [1e12, 3162]] as const) {
      s.total = total;
      expect(blossomsPending(s), `${total}`).toBe(want);
      expect(canNewSeason(s)).toBe(want >= 1);
    }
  });
  it('a new season resets the orchard, keeps the blossoms, the pick count and counts the season', () => {
    const s = newState();
    s.fruit = 5e5;
    s.total = 1e6;
    s.picks = 77;
    s.own = [10, 9, 8, 7, 6, 5];
    s.up = 0b111;
    expect(newSeason(s)).toBe(true);
    expect(s).toMatchObject({ fruit: 0, total: 0, picks: 77, up: 0, blossoms: 3, seasons: 2 });
    expect(s.own).toEqual([0, 0, 0, 0, 0, 0]);
    expect(seasonMult(s)).toBeCloseTo(1.15, 12);
    expect(newSeason(s)).toBe(false); // nothing grown yet
    expect(s.blossoms).toBe(3);
    // blossoms add up across seasons and make the next season faster
    s.own[1] = 10;
    expect(rateOf(s)).toBeCloseTo(10 * 1.15, 10);
    s.total = 4e6;
    expect(newSeason(s)).toBe(true);
    expect(s.blossoms).toBe(3 + 6);
  });
  it('blossoms and seasons stop at their caps', () => {
    const s = newState();
    s.total = 1e18;
    s.blossoms = MAX_BLOSSOMS - 2;
    s.seasons = MAX_SEASONS;
    expect(blossomsPending(s)).toBe(2);
    expect(newSeason(s)).toBe(true);
    expect(s.blossoms).toBe(MAX_BLOSSOMS);
    expect(s.seasons).toBe(MAX_SEASONS);
    s.total = 1e18;
    expect(blossomsPending(s)).toBe(0);
    expect(newSeason(s)).toBe(false);
  });
  it('the words', () => {
    const s = newState();
    expect(seasonText(s)).toBe('Grow 100K fruit in a season to earn your first blossom.');
    s.total = 1e6;
    expect(seasonText(s)).toBe('A new season now gives 3 blossoms. Every blossom makes everything 5 percent faster, for good.');
    s.total = 1e5;
    expect(seasonText(s)).toMatch(/gives 1 blossom\./);
  });
});

describe('big numbers', () => {
  it('format at every edge', () => {
    const table: [number, string][] = [
      [0, '0'], [0.04, '0'], [0.5, '0.5'], [7, '7'], [7.9, '7'], [999, '999'], [999.9, '999'],
      [1000, '1.00K'], [1234, '1.23K'], [12345, '12.3K'], [123456, '123K'], [999499, '999K'], [999999, '1.00M'],
      [1e6, '1.00M'], [1.5e9, '1.50B'], [1e12, '1.00T'], [1e15, '1.00Qa'], [1e18, '1.00Qi'], [9.99e20, '999Qi'], [9.996e20, '1.00e21'], [999999999999, '1.00T'],
      [1e21, '1.00e21'], [1.234e25, '1.23e25'],
      [NaN, '0'], [-5, '0'], [Infinity, '0'], [-Infinity, '0'],
    ];
    for (const [n, want] of table) expect(formatNumber(n), String(n)).toBe(want);
    for (const bad of [undefined, null, 'x', {}, []] as unknown[]) expect(formatNumber(bad as number)).toBe('0');
  });
  it('never gives NaN, a negative, a thousand-something, or an em-dash, for thousands of numbers', () => {
    const rnd = lcg(3);
    for (let i = 0; i < 20000; i++) {
      const n = rnd() * 10 ** (rnd() * 25);
      const t = formatNumber(n);
      expect(t).not.toMatch(/NaN|undefined|Infinity|^-/);
      expect(t.includes(EM_DASH)).toBe(false);
      expect(t).not.toMatch(/^1000/);
      expect(t).not.toMatch(/^\d{4,}[KMBT]/);
    }
  });
  it('is ordered: a bigger number never reads as a smaller one within a suffix', () => {
    const val = (t: string): number => {
      const m = t.match(/^([\d.]+)(K|M|B|T|Qa|Qi|e(\d+))?$/);
      if (!m) throw new Error(t);
      const mult: Record<string, number> = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12, Qa: 1e15, Qi: 1e18 };
      return m[3] ? Number(m[1]) * 10 ** Number(m[3]) : Number(m[1]) * mult[m[2] ?? ''];
    };
    let prev = 0;
    for (let n = 1; n < 1e21; n = Math.ceil(n * 1.37)) {
      const v = val(formatNumber(n));
      expect(v).toBeGreaterThanOrEqual(prev * 0.995);
      prev = v;
    }
  });
  it('rates read well', () => {
    const table: [number, string][] = [[0, '0'], [-1, '0'], [0.1, '0.1'], [2.5, '2.5'], [47, '47'], [12.34, '12.3'], [99.96, '100'], [100, '100'], [1500, '1.50K'], [NaN, '0']];
    for (const [n, want] of table) expect(formatRate(n), String(n)).toBe(want);
  });
  it('times read well', () => {
    const table: [number, string][] = [[0, '0 seconds'], [1, '1 second'], [45, '45 seconds'], [60, '1 min'], [3599, '59 min'], [3600, '1 h'], [3900, '1 h 5 min'], [14400, '4 h'], [NaN, '0 seconds'], [-9, '0 seconds']];
    for (const [n, want] of table) expect(formatDuration(n), String(n)).toBe(want);
  });
});

describe('a greedy bot', () => {
  const play = (seconds: number, picksPerSecond: number): State => {
    const s = newState();
    for (let t = 0; t < seconds; t++) {
      for (let k = 0; k < picksPerSecond; k++) pick(s);
      advance(s, 1);
      let again = true;
      while (again) {
        again = false;
        let bestKind = '';
        let best = -1;
        let bestPay = Infinity;
        PRODUCERS.forEach((_, i) => { const c = costOf(i, s.own[i]); if (c <= s.fruit && s.own[i] < MAX_OWNED) { const pay = c / unitRate(s, i); if (pay < bestPay) { bestPay = pay; best = i; bestKind = 'p'; } } });
        UPGRADES.forEach((u, i) => { if (upgradeUnlocked(s, i) && u.cost <= s.fruit && 5 < bestPay) { bestPay = 5; best = i; bestKind = 'u'; } });
        if (best >= 0) { if (bestKind === 'p') buyProducer(s, best, 1); else buyUpgrade(s, best); again = true; }
      }
    }
    return s;
  };
  it('plays the same game every time', () => {
    expect(JSON.stringify(play(1800, 2))).toBe(JSON.stringify(play(1800, 2)));
  });
  it('gets going within minutes, earns its first blossoms inside two hours and stays sane', () => {
    const a = play(300, 2);
    expect(a.total).toBeGreaterThan(500);
    expect(a.own[1]).toBeGreaterThanOrEqual(1);
    const b = play(7200, 2);
    sane(b);
    expect(b.total).toBeGreaterThan(1e6);
    expect(blossomsPending(b)).toBeGreaterThanOrEqual(3);
    expect(b.own[3]).toBeGreaterThan(0);
  }, 60_000);
  it('an orchard that is never picked by hand and never bought for makes nothing', () => {
    const s = newState();
    advance(s, 1e6);
    expect(s.fruit).toBe(0);
  });
});

describe('random play never breaks a number', () => {
  it('thousands of random actions over many orchards keep every number finite, whole where it should be, and inside its cap', () => {
    const rnd = lcg(2026);
    for (let game = 0; game < 60; game++) {
      const s = newState();
      for (let step = 0; step < 250; step++) {
        const r = rnd();
        const rateBefore = rateOf(s);
        if (r < 0.3) pick(s);
        else if (r < 0.5) advance(s, rnd() * 4000);
        else if (r < 0.75) { const bought = buyProducer(s, Math.floor(rnd() * 7), Math.floor(rnd() * 40)); if (bought > 0) expect(rateOf(s)).toBeGreaterThan(rateBefore - 1e-9); }
        else if (r < 0.9) { if (buyUpgrade(s, Math.floor(rnd() * 13))) expect(rateOf(s)).toBeGreaterThanOrEqual(rateBefore); }
        else if (r < 0.93) { s.fruit = Math.min(MAX_FRUIT, s.fruit + rnd() * 1e9 * 10 ** Math.floor(rnd() * 9)); s.total = Math.max(s.total, s.fruit); }
        else if (r < 0.96) newSeason(s);
        else catchUp(s, rnd() * 1e6);
        sane(s);
        expect(Number.isFinite(rateOf(s)) && rateOf(s) >= 0).toBe(true);
        expect(Number.isFinite(clickValue(s)) && clickValue(s) >= 1).toBe(true);
      }
    }
  }, 60_000);
});

describe('what is saved', () => {
  it('round-trips an orchard exactly (to the whole fruit) and stamps the minute', () => {
    const s = newState();
    s.fruit = 12345.9;
    s.total = 99999.2;
    s.picks = 321;
    s.own = [1, 2, 3, 4, 5, 6];
    s.up = 0b1010101;
    s.blossoms = 7;
    s.seasons = 3;
    const now = 1_700_000_000_000;
    const raw = JSON.stringify(toSave(s, now));
    const { state, savedMinute } = loadSave(raw);
    expect(state).toEqual({ ...s, fruit: 12345, total: 99999 });
    expect(savedMinute).toBe(Math.ceil(now / 60000));
    sane(state);
  });
  it('grants no free offline time when the page is reloaded straight away', () => {
    const s = newState();
    for (const now of [1_700_000_000_000, 1_700_000_000_000 + 1, 1_700_000_059_999, 1_700_000_060_000]) {
      const { savedMinute } = loadSave(JSON.stringify(toSave(s, now)));
      expect(awaySeconds(savedMinute, now)).toBe(0);
      expect(awaySeconds(savedMinute, now + 5_000)).toBeLessThanOrEqual(5);
    }
  });
  it('writes only whole numbers and a short list', () => {
    const save = toSave({ ...newState(), fruit: 0.5, own: [1.5, 2.5, 3, 4, 5, 6] } as State, 1.7e12);
    for (const v of [save.f, save.t, save.k, save.u, save.b, save.s, save.m, ...save.o]) expect(Number.isInteger(v)).toBe(true);
    expect(save.o).toHaveLength(6);
    expect(Object.keys(save).sort()).toEqual(['b', 'f', 'k', 'm', 'o', 's', 't', 'u']);
    expect(save.m).toBeLessThanOrEqual(MAX_MINUTE);
    const wild = toSave({ fruit: NaN, total: -4, picks: Infinity, own: [-1, 1e9, NaN], up: 1e12, blossoms: -1, seasons: 0 } as unknown as State, NaN);
    expect(wild).toEqual({ f: 0, t: 0, k: 0, o: [0, 999, 0, 0, 0, 0], u: 4095, b: 0, s: 1, m: 0 });
  });
  it('anything that is not an object gives the starting orchard', () => {
    for (const bad of ['', 'not json', '[]', '"x"', 'null', null, undefined, 5, true, [], [1, 2], '{"f":NaN}', '{']) {
      const { state, savedMinute } = loadSave(bad as unknown);
      expect(state).toEqual(newState());
      expect(savedMinute).toBeNull();
    }
  });
  it('checks every field on its own: a bad one falls back, the good ones are kept', () => {
    const { state } = loadSave({ f: -5, t: 10, k: 1.5, o: [1, 2, 3, 4, 5, 6], u: 'x', b: 2, s: 0 });
    expect(state).toMatchObject({ fruit: 0, total: 10, picks: 0, up: 0, blossoms: 2, seasons: 1 });
    expect(state.own).toEqual([1, 2, 3, 4, 5, 6]);
    expect(loadSave({ o: [1, 2, 3] }).state.own).toEqual([0, 0, 0, 0, 0, 0]);
    expect(loadSave({ o: [1, 2, 3, 4, 5, 1000] }).state.own).toEqual([1, 2, 3, 4, 5, 0]);
    expect(loadSave({ o: [1, 2, 3, 4, 5, '6'] }).state.own).toEqual([1, 2, 3, 4, 5, 0]);
    expect(loadSave({ o: 'abcdef' }).state.own).toEqual([0, 0, 0, 0, 0, 0]);
    expect(loadSave({ u: 4096 }).state.up).toBe(0);
    expect(loadSave({ u: 4095 }).state.up).toBe(4095);
    expect(loadSave({ f: 2e18 }).state.fruit).toBe(0);
    expect(loadSave({ f: 1e18 }).state.fruit).toBe(1e18);
    expect(loadSave({ f: 500, t: 100 }).state.total).toBe(500); // the season total is never below the fruit in hand
    expect(loadSave({ m: 0 }).savedMinute).toBeNull();
    expect(loadSave({ m: 1.5 }).savedMinute).toBeNull();
    expect(loadSave({ m: MAX_MINUTE + 1 }).savedMinute).toBeNull();
    expect(loadSave({ m: 29_000_000 }).savedMinute).toBe(29_000_000);
  });
  it('is not fooled by __proto__, constructor and extra keys, and returns fresh objects', () => {
    const evil = JSON.parse('{"__proto__":{"f":99},"constructor":{"f":1},"f":4,"o":[1,1,1,1,1,1],"extra":123}');
    const { state } = loadSave(evil);
    expect(state.fruit).toBe(4);
    expect(({} as Record<string, unknown>).f).toBeUndefined();
    const a = loadSave(null).state;
    const b = loadSave(null).state;
    expect(a).not.toBe(b);
    expect(a.own).not.toBe(b.own);
    a.own[0] = 5;
    expect(loadSave(null).state.own[0]).toBe(0);
  });
  it('survives thousands of random junk saves with a valid orchard every time', () => {
    const rnd = lcg(77);
    const junk = (depth = 0): unknown => {
      const r = rnd();
      if (r < 0.15) return Math.floor(rnd() * 100);
      if (r < 0.25) return -Math.floor(rnd() * 1e6);
      if (r < 0.35) return rnd() * 1e22;
      if (r < 0.45) return rnd();
      if (r < 0.55) return ['x', '', '5', 'NaN', '__proto__'][Math.floor(rnd() * 5)];
      if (r < 0.62) return null;
      if (r < 0.68) return true;
      if (r < 0.8 && depth < 3) return Array.from({ length: Math.floor(rnd() * 8) }, () => junk(depth + 1));
      if (depth < 3) { const o: Record<string, unknown> = {}; for (const k of ['f', 't', 'k', 'o', 'u', 'b', 's', 'm', 'zz', '__proto__']) if (rnd() < 0.6) o[k] = junk(depth + 1); return o; }
      return 0;
    };
    for (let i = 0; i < 6000; i++) {
      const v = junk();
      const { state, savedMinute } = loadSave(rnd() < 0.5 ? v : JSON.stringify(v));
      sane(state);
      expect(state.total).toBeGreaterThanOrEqual(state.fruit);
      if (savedMinute !== null) expect(Number.isInteger(savedMinute) && savedMinute >= 1 && savedMinute <= MAX_MINUTE).toBe(true);
    }
  });
});

describe('words, tones and the copy line', () => {
  it('say the right thing', () => {
    expect(plural(1, 'blossom')).toBe('1 blossom');
    expect(plural(2, 'blossom')).toBe('2 blossoms');
    const s = newState();
    s.fruit = 10;
    expect(needMore(s, 25)).toBe('Not enough fruit yet. You need 15 more.');
    expect(needMore(s, 5)).toBe('Not enough fruit yet. You need 0 more.');
    s.fruit = 0.5;
    expect(needMore(s, 100)).toBe('Not enough fruit yet. You need 100 more.');
  });
  it('the copy line reads right at the start and later, and never shows NaN', () => {
    const s = newState();
    expect(shareLine(s)).toBe('Idle Orchard: season 1, 0 fruit grown this season, no blossoms yet');
    s.seasons = 2;
    s.total = 12_400_000;
    s.blossoms = 1;
    expect(shareLine(s)).toBe('Idle Orchard: season 2, 12.4M fruit grown this season, 1 blossom');
    s.total = NaN;
    expect(shareLine(s)).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(shareLine(s).includes(EM_DASH)).toBe(false);
  });
  it('tones are short and quiet', () => {
    for (let n = 0; n < 12; n++) {
      const t = pickTone(n);
      expect(t.gain).toBeLessThanOrEqual(0.15);
      expect(t.ms).toBeLessThanOrEqual(120);
      expect(t.freq).toBeGreaterThan(100);
    }
    expect(new Set([0, 1, 2, 3, 4].map((n) => pickTone(n).freq)).size).toBe(5);
    expect(pickTone(NaN).freq).toBe(pickTone(0).freq);
    for (const t of buyTone()) { expect(t.gain).toBeLessThanOrEqual(0.15); expect(t.ms).toBeLessThanOrEqual(200); }
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/idle-orchard', f), 'utf8');
  it('no Math.random anywhere in the game, and the engine does not read the clock', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
    expect(read('helpers.ts')).not.toMatch(/Date\.now|new Date|performance\.now/);
  });
  it('the main buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.iod-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.iod-pick \{[^}]*min-height: 6rem;/);
    expect(text).toMatch(/#iod-app \.iod-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('sound starts off, and erasing the save and starting a new season each need a second press', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/let soundOn = false;/);
    expect(text).toMatch(/Press Reset again/);
    expect(text).toMatch(/Press Start new season again/);
  });
});
