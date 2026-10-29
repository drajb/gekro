/**
 * games-reaction-time.test.ts - the engine behind `reaction-time`.
 *
 * Pinned: the random wait stays in 1.5 to 5 seconds and is uniform, an early press
 * is thrown away and never counted, a run is exactly five counted tries, the
 * statistics and the plain-words band behave at their edges, and whatever comes
 * out of localStorage is sanitised before the page sees it. Every number the
 * content page quotes is asserted here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RUN_LENGTH, MIN_DELAY_MS, MAX_DELAY_MS, MIN_VALID_MS, MAX_VALID_MS, HISTORY_LIMIT, QUICK_BELOW, SLOW_ABOVE,
  mulberry32, randomDelay, pickTimestamp, initialState, reduce, toValidTime, stats, band, BAND_LABEL, BAND_NOTE,
  formatMs, runSummary, emptySaved, cleanTime, sanitiseStored, toStorable, recordAttempt, recordRun,
  type RunState, type Action,
} from '../src/components/apps-private/reaction-time/helpers';

const rng = mulberry32(2026);

/** Run one counted attempt from idle/result/early: press, GO appears at `goAt`, press `ms` later. */
const attempt = (s: RunState, ms: number, goAt = 10_000): RunState => {
  let x = reduce(s, { type: 'press', at: goAt - 3000 }, rng);
  x = reduce(x, { type: 'go', at: goAt }, rng);
  return reduce(x, { type: 'press', at: goAt + ms }, rng);
};

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect(RUN_LENGTH).toBe(5);
    expect(MIN_DELAY_MS).toBe(1500);
    expect(MAX_DELAY_MS).toBe(5000);
    expect(MIN_VALID_MS).toBe(50);
    expect(MAX_VALID_MS).toBe(5000);
    expect(HISTORY_LIMIT).toBe(20);
    expect(QUICK_BELOW).toBe(200);
    expect(SLOW_ABOVE).toBe(300);
    expect(BAND_LABEL).toEqual({ quick: 'Quick', typical: 'Typical range', slow: 'Slow side' });
    expect(BAND_NOTE).toMatch(/not a medical or scientific test/);
  });
});

describe('randomDelay', () => {
  it('maps the ends of the rng range onto the ends of the delay range', () => {
    expect(randomDelay(() => 0)).toBe(1500);
    expect(randomDelay(() => 0.5)).toBe(3250);
    expect(randomDelay(() => 0.999999999)).toBeLessThanOrEqual(5000);
    expect(randomDelay(() => 0.999999999)).toBeGreaterThan(4999.9);
  });
  it('stays within [1500, 5000] for 20000 seeded draws', () => {
    const r = mulberry32(7);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 20000; i++) {
      const d = randomDelay(r);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    expect(lo).toBeGreaterThanOrEqual(1500);
    expect(hi).toBeLessThanOrEqual(5000);
    expect(lo).toBeLessThan(1520); // the range is actually used, not just respected
    expect(hi).toBeGreaterThan(4980);
  });
  it('is uniform: ten equal buckets are each within 8% of the expected count, and the mean is near 3250', () => {
    const r = mulberry32(99);
    const n = 20000;
    const buckets = new Array(10).fill(0);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = randomDelay(r);
      sum += d;
      buckets[Math.min(9, Math.floor(((d - 1500) / 3500) * 10))] += 1;
    }
    for (const b of buckets) expect(Math.abs(b - n / 10)).toBeLessThan((n / 10) * 0.08);
    expect(Math.abs(sum / n - 3250)).toBeLessThan(40);
  });
  it('cannot escape the range even if the rng misbehaves', () => {
    for (const bad of [-5, 7, NaN, Infinity, -Infinity]) {
      const d = randomDelay(() => bad);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(1500);
      expect(d).toBeLessThanOrEqual(5000);
    }
  });
  it('is deterministic for a seed', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 50; i++) expect(randomDelay(a)).toBe(randomDelay(b));
  });
});

describe('pickTimestamp', () => {
  it('uses the event timestamp when it is plausible', () => {
    expect(pickTimestamp(1234.5, 2000)).toBe(1234.5);
    expect(pickTimestamp(2000.5, 2000)).toBe(2000.5); // within 1 ms of now
  });
  it('falls back to now for missing, bad, zero or future timestamps', () => {
    for (const bad of [undefined, null, 'x', NaN, Infinity, -4, 0, 1.7e12, {}]) expect(pickTimestamp(bad, 2000)).toBe(2000);
  });
});

describe('state machine: a normal attempt', () => {
  it('starts idle with no times', () => {
    const s = initialState();
    expect(s).toMatchObject({ phase: 'idle', times: [], last: null, discarded: 0, goAt: null, reason: null });
  });
  it('idle -> waiting (with a delay in range) -> go -> result', () => {
    const s0 = initialState();
    const s1 = reduce(s0, { type: 'press', at: 100 }, mulberry32(1));
    expect(s1.phase).toBe('waiting');
    expect(s1.delay).toBeGreaterThanOrEqual(1500);
    expect(s1.delay).toBeLessThanOrEqual(5000);
    const s2 = reduce(s1, { type: 'go', at: 3000 }, rng);
    expect(s2.phase).toBe('go');
    expect(s2.goAt).toBe(3000);
    const s3 = reduce(s2, { type: 'press', at: 3243.4 }, rng);
    expect(s3.phase).toBe('result');
    expect(s3.last).toBe(243); // rounded to a whole millisecond
    expect(s3.times).toEqual([243]);
    expect(s3.goAt).toBeNull();
  });
  it('never mutates the state it was given', () => {
    const s0 = initialState();
    const frozen = JSON.stringify(s0);
    const s1 = reduce(s0, { type: 'press', at: 1 }, rng);
    expect(JSON.stringify(s0)).toBe(frozen);
    const s2 = reduce(s1, { type: 'go', at: 2000 }, rng);
    const before = JSON.stringify(s2);
    reduce(s2, { type: 'press', at: 2200 }, rng);
    expect(JSON.stringify(s2)).toBe(before);
  });
  it('is deterministic given the same rng seed and clock', () => {
    const run = () => {
      const r = mulberry32(42);
      let s = initialState();
      const log: RunState[] = [];
      for (let i = 0; i < 5; i++) {
        s = reduce(s, { type: 'press', at: i * 10000 }, r);
        s = reduce(s, { type: 'go', at: i * 10000 + s.delay }, rng);
        s = reduce(s, { type: 'press', at: i * 10000 + s.delay + 250 + i }, rng);
        log.push(s);
      }
      return JSON.stringify(log);
    };
    expect(run()).toBe(run());
  });
  it('a second press from a result starts the next attempt and keeps earlier times', () => {
    let s = attempt(initialState(), 250);
    expect(s.phase).toBe('result');
    s = reduce(s, { type: 'press', at: 20_000 }, rng);
    expect(s.phase).toBe('waiting');
    expect(s.times).toEqual([250]);
  });
});

describe('state machine: early presses are discarded and never counted', () => {
  it('pressing while waiting gives early, counts nothing, and counts the discard', () => {
    let s = reduce(initialState(), { type: 'press', at: 0 }, rng);
    s = reduce(s, { type: 'press', at: 400 }, rng);
    expect(s.phase).toBe('early');
    expect(s.reason).toBe('early');
    expect(s.times).toEqual([]);
    expect(s.last).toBeNull();
    expect(s.discarded).toBe(1);
  });
  it('restarts from that attempt: next press waits again, earlier counted times survive', () => {
    let s = attempt(initialState(), 230);
    s = attempt(s, 260);
    s = reduce(s, { type: 'press', at: 50_000 }, rng); // waiting
    s = reduce(s, { type: 'press', at: 50_100 }, rng); // too soon
    expect(s.phase).toBe('early');
    expect(s.times).toEqual([230, 260]);
    s = reduce(s, { type: 'press', at: 51_000 }, rng);
    expect(s.phase).toBe('waiting');
    expect(s.reason).toBeNull();
    expect(s.times).toEqual([230, 260]);
    expect(s.discarded).toBe(1);
  });
  it('a stale GO action after an early press is ignored', () => {
    let s = reduce(initialState(), { type: 'press', at: 0 }, rng);
    s = reduce(s, { type: 'press', at: 10 }, rng);
    const after = reduce(s, { type: 'go', at: 99 }, rng);
    expect(after).toBe(s);
    expect(after.phase).toBe('early');
  });
  it('an early press never produces a time even when it is the fifth attempt', () => {
    let s = initialState();
    for (let i = 0; i < 4; i++) s = attempt(s, 250);
    s = reduce(s, { type: 'press', at: 1e5 }, rng);
    s = reduce(s, { type: 'press', at: 1e5 + 5 }, rng);
    expect(s.phase).toBe('early');
    expect(s.times).toHaveLength(4);
  });
  it('a time under 50 ms (anticipation) is treated as too soon and not counted', () => {
    let s = reduce(initialState(), { type: 'press', at: 0 }, rng);
    s = reduce(s, { type: 'go', at: 5000 }, rng);
    s = reduce(s, { type: 'press', at: 5030 }, rng);
    expect(s.phase).toBe('early');
    expect(s.reason).toBe('early');
    expect(s.times).toEqual([]);
  });
  it('a press stamped before GO appeared is too soon', () => {
    let s = reduce(initialState(), { type: 'press', at: 0 }, rng);
    s = reduce(s, { type: 'go', at: 5000 }, rng);
    s = reduce(s, { type: 'press', at: 4990 }, rng);
    expect(s.reason).toBe('early');
    expect(s.times).toEqual([]);
  });
  it('exactly 50 ms counts; 49.4 ms does not', () => {
    let s = attempt(initialState(), 50);
    expect(s.times).toEqual([50]);
    s = attempt(initialState(), 49.4);
    expect(s.times).toEqual([]);
  });
  it('a time over 5000 ms is not counted and is reported as slow', () => {
    const s = attempt(initialState(), 5001);
    expect(s.phase).toBe('early');
    expect(s.reason).toBe('slow');
    expect(s.times).toEqual([]);
    expect(attempt(initialState(), 5000).times).toEqual([5000]);
  });
  it('a non-finite press time is invalid and not counted', () => {
    let s = reduce(initialState(), { type: 'press', at: 0 }, rng);
    s = reduce(s, { type: 'go', at: 5000 }, rng);
    s = reduce(s, { type: 'press', at: NaN }, rng);
    expect(s.reason).toBe('invalid');
    expect(s.times).toEqual([]);
  });
  it('a GO with a bad timestamp is ignored', () => {
    const w = reduce(initialState(), { type: 'press', at: 0 }, rng);
    expect(reduce(w, { type: 'go', at: NaN }, rng)).toBe(w);
    expect(reduce(w, { type: 'go', at: Infinity }, rng)).toBe(w);
  });
});

describe('state machine: a run is exactly five counted tries', () => {
  it('stays in result for tries 1 to 4 and is done on the 5th', () => {
    let s = initialState();
    const phases: string[] = [];
    for (const ms of [210, 220, 230, 240, 250]) {
      s = attempt(s, ms);
      phases.push(s.phase);
    }
    expect(phases).toEqual(['result', 'result', 'result', 'result', 'done']);
    expect(s.times).toEqual([210, 220, 230, 240, 250]);
  });
  it('discarded attempts do not advance the run', () => {
    let s = initialState();
    for (let i = 0; i < 3; i++) {
      s = attempt(s, 240);
      s = reduce(s, { type: 'press', at: 1000 + i }, rng); // waiting
      s = reduce(s, { type: 'press', at: 1001 + i }, rng); // too soon
    }
    expect(s.times).toHaveLength(3);
    expect(s.discarded).toBe(3);
    expect(s.phase).toBe('early');
    for (let i = 0; i < 2; i++) s = attempt(s, 240);
    expect(s.phase).toBe('done');
    expect(s.times).toHaveLength(5);
  });
  it('once done, a press changes nothing and a sixth time can never be added', () => {
    let s = initialState();
    for (let i = 0; i < 5; i++) s = attempt(s, 250);
    const again = reduce(s, { type: 'press', at: 9e6 }, rng);
    expect(again).toBe(s);
    expect(again.times).toHaveLength(5);
    for (const t of ['go', 'stamp'] as const) expect(reduce(s, { type: t, at: 9e6 }, rng)).toBe(s);
  });
  it('reset gives a fresh run from any phase', () => {
    let s = attempt(initialState(), 240);
    s = reduce(s, { type: 'press', at: 1 }, rng);
    expect(reduce(s, { type: 'reset' }, rng)).toEqual(initialState());
    for (let i = 0; i < 5; i++) s = attempt(reduce(s, { type: 'reset' }, rng), 250);
    expect(reduce(s, { type: 'reset' }, rng)).toEqual(initialState());
  });
  it('survives a random sequence of actions without a bad state, a bad time or a sixth entry', () => {
    const r = mulberry32(31337);
    let s = initialState();
    let t = 1000;
    for (let i = 0; i < 5000; i++) {
      const k = Math.floor(r() * 5);
      t += Math.floor(r() * 700);
      const a: Action = k === 0 ? { type: 'press', at: t } : k === 1 ? { type: 'go', at: t } : k === 2 ? { type: 'stamp', at: t } : k === 3 ? { type: 'cancel' } : { type: r() < 0.1 ? 'reset' : 'press', at: t } as Action;
      s = reduce(s, a, r);
      expect(['idle', 'waiting', 'go', 'result', 'early', 'done']).toContain(s.phase);
      expect(s.times.length).toBeLessThanOrEqual(5);
      for (const x of s.times) expect(x >= 50 && x <= 5000 && Number.isInteger(x)).toBe(true);
      if (s.phase === 'done') expect(s.times).toHaveLength(5);
    }
  });
});

describe('state machine: stamp and cancel', () => {
  it('stamp moves the GO time to a later frame only, and only while in go', () => {
    let s = reduce(initialState(), { type: 'press', at: 0 }, rng);
    expect(reduce(s, { type: 'stamp', at: 50 }, rng)).toBe(s);
    s = reduce(s, { type: 'go', at: 1000 }, rng);
    expect(reduce(s, { type: 'stamp', at: 990 }, rng)).toBe(s);
    expect(reduce(s, { type: 'stamp', at: 1000 }, rng)).toBe(s);
    expect(reduce(s, { type: 'stamp', at: NaN }, rng)).toBe(s);
    const s2 = reduce(s, { type: 'stamp', at: 1016.7 }, rng);
    expect(s2.goAt).toBe(1016.7);
    expect(reduce(s2, { type: 'press', at: 1266.7 }, rng).last).toBe(250);
  });
  it('cancel in waiting or go goes back to ready, keeps counted times, and is a no-op elsewhere', () => {
    let s = attempt(initialState(), 240);
    const w = reduce(s, { type: 'press', at: 1 }, rng);
    const c = reduce(w, { type: 'cancel' }, rng);
    expect(c.phase).toBe('idle');
    expect(c.reason).toBe('hidden');
    expect(c.times).toEqual([240]);
    expect(c.goAt).toBeNull();
    const g = reduce(w, { type: 'go', at: 5 }, rng);
    expect(reduce(g, { type: 'cancel' }, rng).phase).toBe('idle');
    expect(reduce(s, { type: 'cancel' }, rng)).toBe(s); // result
    expect(reduce(initialState(), { type: 'cancel' }, rng).phase).toBe('idle');
    // after a cancel the next press starts waiting again
    expect(reduce(c, { type: 'press', at: 2 }, rng).phase).toBe('waiting');
    expect(reduce(c, { type: 'press', at: 2 }, rng).reason).toBeNull();
  });
});

describe('toValidTime', () => {
  it('rounds and enforces the 50 to 5000 range', () => {
    expect(toValidTime(49.4)).toBeNull();
    expect(toValidTime(49.5)).toBe(50);
    expect(toValidTime(250.5)).toBe(251);
    expect(toValidTime(5000.4)).toBe(5000);
    expect(toValidTime(5000.6)).toBeNull();
    expect(toValidTime(NaN)).toBeNull();
    expect(toValidTime(Infinity)).toBeNull();
    expect(toValidTime(-100)).toBeNull();
  });
});

describe('stats', () => {
  it('odd count: median is the middle value', () => {
    expect(stats([300, 100, 200])).toEqual({ count: 3, mean: 200, median: 200, best: 100, worst: 300 });
  });
  it('even count: median is the mean of the two middle values', () => {
    expect(stats([100, 400, 200, 300])).toEqual({ count: 4, mean: 250, median: 250, best: 100, worst: 400 });
    expect(stats([200, 201]).median).toBe(200.5);
  });
  it('a full run of five', () => {
    const s = stats([230, 250, 210, 290, 270]);
    expect(s).toEqual({ count: 5, mean: 250, median: 250, best: 210, worst: 290 });
  });
  it('ties and a single value', () => {
    expect(stats([250, 250, 250, 250, 250])).toEqual({ count: 5, mean: 250, median: 250, best: 250, worst: 250 });
    expect(stats([180, 180, 300])).toMatchObject({ median: 180, best: 180, worst: 300 });
    expect(stats([321])).toEqual({ count: 1, mean: 321, median: 321, best: 321, worst: 321 });
  });
  it('empty input gives nulls and never NaN', () => {
    expect(stats([])).toEqual({ count: 0, mean: null, median: null, best: null, worst: null });
    expect(JSON.stringify(stats([]))).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('ignores non-finite entries and does not reorder or mutate its input', () => {
    const src = [300, NaN, 100, Infinity, 200, -Infinity];
    const copy = src.slice();
    const s = stats(src);
    expect(s).toMatchObject({ count: 3, mean: 200, best: 100, worst: 300 });
    expect(src).toEqual(copy.map((x) => x)); // NaN-safe comparison below
    expect(src.map(String)).toEqual(copy.map(String));
    expect(stats([NaN, NaN]).mean).toBeNull();
  });
  it('best is the lowest and worst the highest, whatever the order', () => {
    const r = mulberry32(8);
    for (let k = 0; k < 50; k++) {
      const xs = Array.from({ length: 5 }, () => 100 + Math.floor(r() * 400));
      const s = stats(xs);
      expect(s.best).toBe(Math.min(...xs));
      expect(s.worst).toBe(Math.max(...xs));
      expect(s.median as number).toBeGreaterThanOrEqual(s.best as number);
      expect(s.median as number).toBeLessThanOrEqual(s.worst as number);
    }
  });
});

describe('band', () => {
  it('has the right edges', () => {
    expect(band(199.9)).toBe('quick');
    expect(band(200)).toBe('typical');
    expect(band(300)).toBe('typical');
    expect(band(300.1)).toBe('slow');
  });
  it('covers the extremes and rejects non-numbers', () => {
    expect(band(50)).toBe('quick');
    expect(band(0)).toBe('quick');
    expect(band(5000)).toBe('slow');
    expect(band(NaN)).toBeNull();
    expect(band(Infinity)).toBeNull();
    expect(band(null)).toBeNull();
    expect(band(undefined)).toBeNull();
  });
  it('labels read as plain words', () => {
    expect(BAND_LABEL[band(150) as 'quick']).toBe('Quick');
    expect(BAND_LABEL[band(250) as 'typical']).toBe('Typical range');
    expect(BAND_LABEL[band(350) as 'slow']).toBe('Slow side');
  });
});

describe('formatMs and runSummary', () => {
  it('formats whole milliseconds and survives bad input', () => {
    expect(formatMs(243.4)).toBe('243 ms');
    expect(formatMs(243.5)).toBe('244 ms');
    expect(formatMs(0)).toBe('0 ms');
    for (const bad of [NaN, Infinity, -1, null, undefined]) expect(formatMs(bad)).toBe('-');
  });
  it('summarises a full run, a partial run and nothing', () => {
    expect(runSummary([230, 250, 210, 290, 270])).toBe('Reaction Time Test: average 250 ms over 5 tries (best 210 ms, median 250 ms, worst 290 ms)');
    expect(runSummary([300, 280])).toBe('Reaction Time Test: 2 of 5 tries so far, best 280 ms');
    expect(runSummary([])).toBe('Reaction Time Test: no counted tries yet');
    for (const t of [[], [100], [1, 2, 3, 4, 5]]) expect(runSummary(t)).not.toMatch(/NaN|undefined|null|Infinity/);
  });
});

describe('cleanTime', () => {
  it('accepts numbers only, clamps to [50, 5000] and rounds', () => {
    expect(cleanTime(250)).toBe(250);
    expect(cleanTime(250.6)).toBe(251);
    expect(cleanTime(10)).toBe(50);
    expect(cleanTime(-3)).toBe(50);
    expect(cleanTime(99999)).toBe(5000);
    for (const bad of ['250', NaN, Infinity, -Infinity, null, undefined, {}, [], true, [250], 10n]) expect(cleanTime(bad)).toBeNull();
  });
});

describe('sanitiseStored', () => {
  it('keeps a good payload', () => {
    expect(sanitiseStored({ best: 201, avg: 233, history: [250, 240, 230] })).toEqual({ best: 201, avg: 233, history: [250, 240, 230] });
  });
  it('accepts the JSON string straight from localStorage', () => {
    expect(sanitiseStored('{"best":201,"avg":233,"history":[250,240]}')).toEqual({ best: 201, avg: 233, history: [250, 240] });
  });
  it('returns an empty result for anything that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1,2,3]', '"x"', 'null', [], [1, 2], NaN, () => 1, Symbol('x')]) {
      expect(sanitiseStored(bad)).toEqual(emptySaved());
    }
  });
  it('drops strings, NaN, Infinity, objects and booleans from fields and history', () => {
    const s = sanitiseStored({ best: '200', avg: NaN, history: ['250', NaN, Infinity, -Infinity, null, undefined, {}, [], true, 260, 270] });
    expect(s.best).toBeNull();
    expect(s.avg).toBeNull();
    expect(s.history).toEqual([260, 270]);
  });
  it('clamps out-of-range numbers into [50, 5000]', () => {
    const s = sanitiseStored({ best: -20, avg: 1e9, history: [0, 3, 49, 5001, 123456] });
    expect(s.best).toBe(50);
    expect(s.avg).toBe(5000);
    expect(s.history).toEqual([50, 50, 50, 5000, 5000]);
  });
  it('caps the history at 20, keeping the newest', () => {
    const h = Array.from({ length: 35 }, (_, i) => 100 + i);
    const s = sanitiseStored({ history: h });
    expect(s.history).toHaveLength(20);
    expect(s.history[0]).toBe(115);
    expect(s.history[19]).toBe(134);
  });
  it('handles a huge array quickly and still returns at most 20 entries', () => {
    const t = performance.now();
    const huge = new Array(2_000_000).fill(250);
    const s = sanitiseStored({ history: huge });
    expect(s.history).toHaveLength(20);
    expect(performance.now() - t).toBeLessThan(500);
    const junk = new Array(2_000_000).fill('x');
    expect(sanitiseStored({ history: junk }).history).toEqual([]);
  });
  it('ignores a history that is not an array, and unknown or prototype keys', () => {
    expect(sanitiseStored({ history: 'abc' }).history).toEqual([]);
    expect(sanitiseStored({ history: { length: 5, 0: 250 } }).history).toEqual([]);
    expect(sanitiseStored('{"__proto__":{"best":100},"extra":5}')).toEqual(emptySaved());
    expect(({} as Record<string, unknown>).best).toBeUndefined();
  });
  it('rounds fractional values and is deterministic', () => {
    const raw = { best: 200.4, avg: 233.5, history: [250.2, 249.8] };
    const a = sanitiseStored(raw);
    expect(a).toEqual({ best: 200, avg: 234, history: [250, 250] });
    expect(sanitiseStored(raw)).toEqual(a);
  });
  it('never yields a non-integer, non-finite or out-of-range number', () => {
    const r = mulberry32(5);
    const pool: unknown[] = [NaN, Infinity, -1, 0, 49, 50, 5000, 5001, 'a', null, {}, 123.456, 1e300, -1e300];
    for (let k = 0; k < 200; k++) {
      const hist = Array.from({ length: Math.floor(r() * 60) }, () => pool[Math.floor(r() * pool.length)]);
      const s = sanitiseStored({ best: pool[Math.floor(r() * pool.length)], avg: pool[Math.floor(r() * pool.length)], history: hist });
      for (const x of [s.best, s.avg, ...s.history]) {
        if (x !== null) expect(Number.isInteger(x) && x >= 50 && x <= 5000).toBe(true);
      }
      expect(s.history.length).toBeLessThanOrEqual(20);
    }
  });
});

describe('toStorable', () => {
  it('stores plain numbers only and omits empty fields', () => {
    expect(toStorable(emptySaved())).toEqual({ history: [] });
    const out = toStorable({ best: 201, avg: null, history: [250, 240] });
    expect(out).toEqual({ best: 201, history: [250, 240] });
    expect(JSON.stringify(out)).not.toMatch(/null|NaN|undefined/);
  });
  it('round-trips through JSON and the sanitiser', () => {
    const s = { best: 188, avg: 231, history: [250, 240, 230] };
    expect(sanitiseStored(JSON.stringify(toStorable(s)))).toEqual(s);
  });
  it('never writes more than 20 history entries', () => {
    const history = Array.from({ length: 50 }, () => 250);
    expect(toStorable({ best: null, avg: null, history }).history).toHaveLength(20);
  });
});

describe('recordAttempt and recordRun', () => {
  it('the first result sets the best but is not announced as a new personal best', () => {
    const r = recordAttempt(emptySaved(), 260);
    expect(r.saved.best).toBe(260);
    expect(r.saved.history).toEqual([260]);
    expect(r.newBest).toBe(false);
  });
  it('a faster time is a new best; a slower or equal one is not', () => {
    const base = { best: 250, avg: null, history: [250] };
    const faster = recordAttempt(base, 240);
    expect(faster.newBest).toBe(true);
    expect(faster.saved.best).toBe(240);
    expect(faster.saved.history).toEqual([250, 240]);
    const equal = recordAttempt(base, 250);
    expect(equal.newBest).toBe(false);
    expect(equal.saved.best).toBe(250);
    const slower = recordAttempt(base, 400);
    expect(slower.newBest).toBe(false);
    expect(slower.saved.best).toBe(250);
    expect(slower.saved.history).toEqual([250, 400]);
  });
  it('does not mutate the saved object it was given', () => {
    const base = { best: 250, avg: 260, history: [250] };
    const frozen = JSON.stringify(base);
    recordAttempt(base, 200);
    recordRun(base, [200, 200, 200, 200, 200]);
    expect(JSON.stringify(base)).toBe(frozen);
  });
  it('a time that cannot count changes nothing', () => {
    const base = { best: 250, avg: null, history: [250] };
    for (const bad of [10, 49, 5001, NaN, Infinity, -5]) {
      const r = recordAttempt(base, bad);
      expect(r.saved).toBe(base);
      expect(r.newBest).toBe(false);
    }
  });
  it('the history never grows past 20 and drops the oldest', () => {
    let s = emptySaved();
    for (let i = 0; i < 45; i++) s = recordAttempt(s, 100 + i).saved;
    expect(s.history).toHaveLength(20);
    expect(s.history[0]).toBe(125);
    expect(s.history[19]).toBe(144);
    expect(s.best).toBe(100);
  });
  it('records the average only for a full run of five', () => {
    expect(recordRun(emptySaved(), [200, 220]).saved.avg).toBeNull();
    expect(recordRun(emptySaved(), [200, 200, 200, 200, 200, 200]).saved.avg).toBeNull();
    expect(recordRun(emptySaved(), []).saved.avg).toBeNull();
    const first = recordRun(emptySaved(), [230, 250, 210, 290, 270]);
    expect(first.saved.avg).toBe(250);
    expect(first.newBest).toBe(false);
  });
  it('a lower average is a new best, a higher one keeps the old best', () => {
    const base = { best: null, avg: 250, history: [] };
    const better = recordRun(base, [200, 210, 220, 230, 240]);
    expect(better.saved.avg).toBe(220);
    expect(better.newBest).toBe(true);
    const worse = recordRun(base, [300, 310, 320, 330, 340]);
    expect(worse.saved.avg).toBe(250);
    expect(worse.newBest).toBe(false);
  });
  it('the saved average is the same whole number the screen shows', () => {
    // mean 240.2 -> 240
    expect(recordRun(emptySaved(), [240, 240, 240, 240, 241]).saved.avg).toBe(240);
    // mean 240.6 -> 241
    expect(recordRun(emptySaved(), [240, 240, 241, 241, 241]).saved.avg).toBe(241);
  });
});

describe('a whole run end to end', () => {
  it('plays five tries with a discard in the middle and saves what the page would save', () => {
    const r = mulberry32(11);
    let s = initialState();
    let saved = emptySaved();
    const plan = [240, 'early', 260, 220, 'early', 300, 280] as const;
    for (const step of plan) {
      s = reduce(s, { type: 'press', at: 0 }, r);
      if (step === 'early') { s = reduce(s, { type: 'press', at: 1 }, rng); continue; }
      s = reduce(s, { type: 'go', at: 4000 }, rng);
      s = reduce(s, { type: 'press', at: 4000 + step }, rng);
      saved = recordAttempt(saved, s.last as number).saved;
    }
    expect(s.phase).toBe('done');
    expect(s.times).toEqual([240, 260, 220, 300, 280]);
    expect(s.discarded).toBe(2);
    saved = recordRun(saved, s.times).saved;
    expect(saved).toEqual({ best: 220, avg: 260, history: [240, 260, 220, 300, 280] });
    const st = stats(s.times);
    expect(st).toMatchObject({ mean: 260, median: 260, best: 220, worst: 300 });
    expect(band(Math.round(st.mean as number))).toBe('typical');
  });
});

describe('the random source is always supplied by the caller', () => {
  it('the wait comes from the rng that is passed in, at both ends of its range', () => {
    expect(reduce(initialState(), { type: 'press', at: 0 }, () => 0).delay).toBe(1500);
    expect(reduce(initialState(), { type: 'press', at: 0 }, () => 0.5).delay).toBe(3250);
    expect(reduce(initialState(), { type: 'press', at: 0 }, () => 1).delay).toBe(5000);
  });
  it('only a press that starts a wait draws from the rng', () => {
    let draws = 0;
    const counting = (): number => { draws += 1; return 0.25; };
    let s = reduce(initialState(), { type: 'press', at: 0 }, counting);
    expect(draws).toBe(1);
    s = reduce(s, { type: 'press', at: 10 }, counting); // too soon
    s = reduce(s, { type: 'cancel' }, counting);
    s = reduce(s, { type: 'reset' }, counting);
    expect(draws).toBe(1);
    expect(s.phase).toBe('idle');
  });
  it('the helpers and the page never call Math.random', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) {
      const text = readFileSync(resolve(process.cwd(), 'src/components/apps-private/reaction-time', f), 'utf8');
      expect(text.includes('Math' + '.random'), f).toBe(false);
    }
  });
});

describe('copy hygiene', () => {
  it('no generated text contains an em-dash', () => {
    const texts = [BAND_NOTE, ...Object.values(BAND_LABEL), runSummary([200, 210, 220, 230, 240]), runSummary([]), formatMs(NaN)];
    for (const t of texts) expect(t.includes(String.fromCharCode(0x2014))).toBe(false);
  });
});
