/**
 * games-colour-clash.test.ts - the engine behind `colour-clash`.
 *
 * Pinned: six colours, each with its own name and shape, and Easy/Medium/Hard use
 * the first 3, 4 and 6; in every trial of every round the word and the ink are
 * different colours, the ink is always among the answer buttons exactly once, and
 * the buttons are the level's colours with no repeats; inks are dealt evenly (no
 * colour used more than once more than another) and never twice in a row; words
 * are spread evenly over the other colours; the same seed gives the same round;
 * accuracy and average speed are computed from whole numbers; saved bests are
 * sanitised; the page has a CSS rule for every colour and shape the engine names.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  COLOURS, LEVELS, LEVEL_COLOURS, LEVEL_LABEL, ROUND_LENGTH, MAX_MS, NEXT_LEVEL, colourOf, coloursFor, makeRound, summarise, formatSeconds,
  isBetter, recordRound, sanitiseBest, toStorable, plural, parseSeed, mulberry32, shuffled,
  type Level, type ColourId, type Result,
} from '../src/components/apps-private/colour-clash/helpers';
import calculatorSource from '../src/components/apps-private/colour-clash/Calculator.astro?raw';

// The loops below are generous on purpose; a loaded machine must not turn them into flaky failures.
vi.setConfig({ testTimeout: 60_000 });

const seeds = Array.from({ length: 500 }, (_, i) => i + 1);

describe('the colours', () => {
  it('are six, each with a different name and a different shape', () => {
    expect(COLOURS).toHaveLength(6);
    expect(new Set(COLOURS.map((c) => c.id)).size).toBe(6);
    expect(new Set(COLOURS.map((c) => c.label)).size).toBe(6);
    expect(new Set(COLOURS.map((c) => c.shape)).size).toBe(6);
    expect(COLOURS.map((c) => c.label)).toEqual(['Blue', 'Yellow', 'Red', 'Green', 'Purple', 'Orange']);
    for (const c of COLOURS) expect(c.label.toLowerCase()).toBe(c.id);
  });
  it('levels use the first 3, 4 and 6 colours', () => {
    expect(LEVEL_COLOURS).toEqual({ easy: 3, medium: 4, hard: 6 });
    for (const l of LEVELS) expect(coloursFor(l).map((c) => c.id)).toEqual(COLOURS.slice(0, LEVEL_COLOURS[l]).map((c) => c.id));
    expect(colourOf('red').shape).toBe('square');
    expect(Object.keys(LEVEL_LABEL)).toEqual(['easy', 'medium', 'hard']);
  });
  it('the page has a colour rule and a shape rule for everything the engine names', () => {
    for (const c of COLOURS) {
      expect(calculatorSource, c.id).toContain(`[data-c="${c.id}"]`);
      expect(calculatorSource, c.shape).toContain(`[data-shape="${c.shape}"]`);
    }
  });
});

describe('rounds', () => {
  it('has ten trials by default', () => {
    expect(ROUND_LENGTH).toBe(10);
    for (const l of LEVELS) expect(makeRound(l, mulberry32(1)).trials).toHaveLength(10);
  });

  it('word and ink are never the same colour, and the ink is among the buttons exactly once (500 seeds per level)', () => {
    for (const l of LEVELS) for (const s of seeds) {
      const r = makeRound(l, mulberry32(s * 7919));
      const ids = coloursFor(l).map((c) => c.id).sort();
      expect(r.options.slice().sort(), `${l} #${s} options`).toEqual(ids);
      expect(new Set(r.options).size).toBe(r.options.length);
      for (const t of r.trials) {
        expect(t.word, `${l} #${s}`).not.toBe(t.ink);
        expect(r.options.filter((o) => o === t.ink)).toHaveLength(1);
        expect(r.options).toContain(t.word);
      }
    }
  });

  it('deals inks evenly (counts differ by at most one) and never the same ink or the same pair twice in a row', () => {
    for (const l of LEVELS) for (const s of seeds) {
      const r = makeRound(l, mulberry32(s * 31 + 5));
      const counts = new Map<ColourId, number>(r.options.map((o) => [o, 0]));
      for (const t of r.trials) counts.set(t.ink, (counts.get(t.ink) ?? 0) + 1);
      const vals = [...counts.values()];
      expect(Math.max(...vals) - Math.min(...vals), `${l} #${s}`).toBeLessThanOrEqual(1);
      for (let i = 1; i < r.trials.length; i++) {
        expect(r.trials[i].ink).not.toBe(r.trials[i - 1].ink);
        expect(`${r.trials[i].word}/${r.trials[i].ink}`).not.toBe(`${r.trials[i - 1].word}/${r.trials[i - 1].ink}`);
      }
    }
  });

  it('every colour is used as an ink in a Hard round of 10 at least once, since six colours need six trials', () => {
    for (const s of seeds) {
      const r = makeRound('hard', mulberry32(s));
      expect(new Set(r.trials.map((t) => t.ink)).size).toBe(6);
    }
  });

  it('words are spread evenly over the other colours, whatever the ink (Hard, 20000 trials)', () => {
    const counts: Record<string, Record<string, number>> = {};
    let total = 0;
    for (let s = 1; s <= 2000; s++) {
      for (const t of makeRound('hard', mulberry32(s)).trials) {
        counts[t.ink] ??= {};
        counts[t.ink][t.word] = (counts[t.ink][t.word] ?? 0) + 1;
        total++;
      }
    }
    expect(total).toBe(20000);
    for (const ink of Object.keys(counts)) {
      const row = counts[ink];
      const n = Object.values(row).reduce((a, b) => a + b, 0);
      expect(Object.keys(row)).toHaveLength(5);
      for (const w of Object.keys(row)) expect(row[w] / n, `${ink}/${w}`).toBeGreaterThan(0.17);
      for (const w of Object.keys(row)) expect(row[w] / n, `${ink}/${w}`).toBeLessThan(0.23);
    }
  });

  it('button order varies from round to round', () => {
    const orders = new Set<string>();
    for (const s of seeds) orders.add(makeRound('hard', mulberry32(s)).options.join());
    expect(orders.size).toBeGreaterThan(100);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    for (const l of LEVELS) {
      expect(makeRound(l, mulberry32(42))).toEqual(makeRound(l, mulberry32(42)));
      expect(makeRound(l, mulberry32(1))).not.toEqual(makeRound(l, mulberry32(2)));
    }
  });

  it('rejects an unknown level, clamps a silly length and survives a degenerate rng', () => {
    expect(() => makeRound('extreme' as Level, mulberry32(1))).toThrow(RangeError);
    expect(makeRound('easy', mulberry32(1), 0).trials).toHaveLength(10);
    expect(makeRound('easy', mulberry32(1), NaN).trials).toHaveLength(10);
    expect(makeRound('easy', mulberry32(1), 999).trials).toHaveLength(10);
    expect(makeRound('easy', mulberry32(1), 25).trials).toHaveLength(25);
    for (const rng of [() => 0, () => 0.999999, () => NaN]) {
      for (const l of LEVELS) {
        const r = makeRound(l, rng);
        expect(r.trials).toHaveLength(10);
        for (const t of r.trials) expect(t.word).not.toBe(t.ink);
      }
    }
  });

  it('seeded shuffle keeps every item exactly once', () => {
    const a = Array.from({ length: 12 }, (_, i) => i);
    expect(shuffled(a, mulberry32(9)).sort((x, y) => x - y)).toEqual(a);
  });
});

describe('summary', () => {
  const r = (firstTry: boolean, ms: number): Result => ({ firstTry, ms });
  it('counts right-first-time answers and rounds accuracy to a whole percent', () => {
    expect(summarise([r(true, 1000), r(true, 2000), r(false, 3000)])).toEqual({ total: 3, correct: 2, accuracy: 67, avgMs: 2000 });
    expect(summarise(Array.from({ length: 10 }, () => r(true, 900)))).toEqual({ total: 10, correct: 10, accuracy: 100, avgMs: 900 });
    expect(summarise(Array.from({ length: 10 }, () => r(false, 900)))).toEqual({ total: 10, correct: 0, accuracy: 0, avgMs: 900 });
  });
  it('has no average for no results', () => {
    expect(summarise([])).toEqual({ total: 0, correct: 0, accuracy: 0, avgMs: null });
  });
  it('averages whole milliseconds and caps a slow answer', () => {
    expect(summarise([r(true, 1001), r(true, 1002)]).avgMs).toBe(1002); // 1001.5 rounds up
    expect(summarise([r(true, 1e9), r(true, 0)]).avgMs).toBe(MAX_MS / 2);
    expect(summarise([r(true, NaN)]).avgMs).toBe(MAX_MS);
    expect(summarise([r(true, -50)]).avgMs).toBe(0);
  });
  it('formats seconds to one decimal with integer arithmetic', () => {
    expect(formatSeconds(1250)).toBe('1.3 seconds');
    expect(formatSeconds(1240)).toBe('1.2 seconds');
    expect(formatSeconds(0)).toBe('0.0 seconds');
    expect(formatSeconds(950)).toBe('1.0 seconds');
    expect(formatSeconds(59999)).toBe('60.0 seconds');
    expect(formatSeconds(null)).toBe('-');
    expect(formatSeconds(NaN)).toBe('-');
    expect(formatSeconds(1e12)).toBe('60.0 seconds');
  });
});

describe('saved bests', () => {
  it('more right first time is better; on a tie a lower average is better; anything beats nothing', () => {
    expect(isBetter({ correct: 8, avgMs: 2000 }, { correct: 7, avgMs: 900 })).toBe(true);
    expect(isBetter({ correct: 7, avgMs: 900 }, { correct: 8, avgMs: 2000 })).toBe(false);
    expect(isBetter({ correct: 8, avgMs: 1500 }, { correct: 8, avgMs: 2000 })).toBe(true);
    expect(isBetter({ correct: 8, avgMs: 2000 }, { correct: 8, avgMs: 2000 })).toBe(false);
    expect(isBetter({ correct: 1, avgMs: MAX_MS }, undefined)).toBe(true);
  });
  it('records a better round, ignores a worse one and a round with nothing right', () => {
    const s = (correct: number, avgMs: number) => ({ total: 10, correct, accuracy: correct * 10, avgMs });
    const best = recordRound({}, 'easy', s(6, 1500));
    expect(best).toEqual({ best: { easy: { correct: 6, avgMs: 1500 } }, improved: true });
    expect(recordRound(best.best, 'easy', s(5, 500)).improved).toBe(false);
    expect(recordRound(best.best, 'easy', s(6, 1600)).improved).toBe(false);
    expect(recordRound(best.best, 'easy', s(6, 1400)).improved).toBe(true);
    expect(recordRound(best.best, 'hard', s(2, 3000)).best.hard).toEqual({ correct: 2, avgMs: 3000 });
    expect(recordRound({}, 'easy', s(0, 1000)).improved).toBe(false);
    expect(recordRound({}, 'easy', { total: 0, correct: 0, accuracy: 0, avgMs: null }).improved).toBe(false);
  });
  it('round-trips through storage form', () => {
    const best = { easy: { correct: 9, avgMs: 1234 }, hard: { correct: 4, avgMs: 2500 } };
    expect(toStorable(best)).toEqual({ 'easy-a': 9, 'easy-t': 1234, 'hard-a': 4, 'hard-t': 2500 });
    expect(sanitiseBest(JSON.parse(JSON.stringify(toStorable(best))))).toEqual(best);
  });
  it('keeps only complete, whole, in-range pairs for known levels', () => {
    expect(sanitiseBest({ 'easy-a': 10, 'easy-t': 1 })).toEqual({ easy: { correct: 10, avgMs: 1 } });
    expect(sanitiseBest({ 'easy-a': 10 })).toEqual({}); // time missing
    expect(sanitiseBest({ 'easy-t': 900 })).toEqual({});
    expect(sanitiseBest({ 'easy-a': 11, 'easy-t': 900 })).toEqual({});
    expect(sanitiseBest({ 'easy-a': 0, 'easy-t': 900 })).toEqual({});
    expect(sanitiseBest({ 'easy-a': 5, 'easy-t': 0 })).toEqual({});
    expect(sanitiseBest({ 'easy-a': 5, 'easy-t': MAX_MS + 1 })).toEqual({});
    expect(sanitiseBest({ 'easy-a': 5.5, 'easy-t': 900 })).toEqual({});
    expect(sanitiseBest({ 'extreme-a': 5, 'extreme-t': 900, x: 1 })).toEqual({});
    expect(sanitiseBest({ 'easy-a': NaN, 'easy-t': Infinity })).toEqual({});
  });
  it('rejects strings, booleans, arrays, null, non-objects and prototype tricks', () => {
    expect(sanitiseBest({ 'easy-a': '5', 'easy-t': '900', 'medium-a': true, 'medium-t': [900] })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"easy-a": 5, "easy-t": 900}, "constructor": 3}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
  it('offers the next level only up the ladder', () => {
    expect(NEXT_LEVEL).toEqual({ easy: 'medium', medium: 'hard', hard: null });
  });
});

describe('small helpers', () => {
  it('pluralises', () => {
    expect(plural(1, 'word')).toBe('1 word');
    expect(plural(3, 'word')).toBe('3 words');
  });
  it('parseSeed accepts only whole numbers from 1 to 2^32 - 1', () => {
    expect(parseSeed('7')).toBe(7);
    for (const bad of ['0', '-1', '4294967296', '1.5', '', 'x', NaN, null, undefined, {}]) expect(parseSeed(bad)).toBeNull();
  });
});

describe('the page', () => {
  it('announces, pauses for a hidden tab and honours reduced motion', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/visibilitychange/);
    expect(calculatorSource).toMatch(/prefers-reduced-motion/);
    expect(calculatorSource).toMatch(/gk:game:colour-clash/);
  });
  it('the copy line names the level once, with no doubled brackets, and the buttons are at least 44 px tall', () => {
    expect(calculatorSource).toContain('Colour Clash (${LEVEL_WORD[level]}, ${round.options.length} colours) #');
    expect(calculatorSource).not.toContain('LEVEL_LABEL[level]');
    expect(calculatorSource).toMatch(/\.clc-actions button[^{]*\{[^}]*min-height: 2\.75rem/);
    expect(calculatorSource).toMatch(/#clc-level[^{]*\{[^}]*min-height: 2\.75rem/);
  });
});
