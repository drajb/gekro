/**
 * games-aim-trainer.test.ts - the engine behind `aim-trainer`.
 *
 * Pinned: the setup options and every number the content page quotes, the target
 * size floors at phone width, that a new target is always fully inside the play
 * area and clear of the others and of the previous spot, the run statistics at
 * their edges (empty runs, odd and even counts, zero elapsed time), that only a
 * finished run can set a personal best, and that whatever comes out of
 * localStorage is sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DURATIONS, SIZES, SIZE_KEYS, MODES, MODE_KEYS, MARGIN_PX, MAX_BEST_HITS, DEFAULT_CONFIG, ALL_COMBOS,
  parseConfig, comboKey, isComboKey, configLabel, mulberry32, targetDiameter,
  fitRadius, spawnBounds, clampCentre, spawnPosition,
  emptyRun, recordHit, recordMiss, isCompleteRun,
  accuracyPct, hitsPerSecond, mean, median, summarise,
  formatMs, formatPercent, formatRate, formatSeconds, resultSummary,
  cleanHits, sanitiseStored, toStorable, recordBest,
  type Spot, type SizeKey, type Config,
} from '../src/components/apps-private/aim-trainer/helpers';

const EM_DASH = String.fromCharCode(0x2014);

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect([...DURATIONS]).toEqual([30, 60]);
    expect([...SIZE_KEYS]).toEqual(['large', 'medium', 'small']);
    expect(SIZES.large.min).toBe(44);
    expect(SIZES.medium.min).toBe(32);
    expect(SIZES.small.min).toBe(22);
    expect([...MODE_KEYS]).toEqual(['single', 'triple']);
    expect(MODES.single).toEqual({ label: 'One at a time', count: 1 });
    expect(MODES.triple).toEqual({ label: 'Three at a time', count: 3 });
    expect(SIZES.large).toMatchObject({ fraction: 0.13, max: 88 });
    expect(SIZES.medium).toMatchObject({ fraction: 0.09, max: 64 });
    expect(SIZES.small).toMatchObject({ fraction: 0.06, max: 44 });
    expect(MARGIN_PX).toBe(6);
    expect(MAX_BEST_HITS).toBe(1000);
    expect(DEFAULT_CONFIG).toEqual({ duration: 30, size: 'medium', mode: 'single' });
  });
  it('there are twelve setups and each has its own distinct key', () => {
    expect(ALL_COMBOS).toHaveLength(12);
    expect(new Set(ALL_COMBOS).size).toBe(12);
    expect(ALL_COMBOS).toContain('30-medium-single');
    expect(ALL_COMBOS).toContain('60-small-triple');
  });
});

describe('setup parsing and keys', () => {
  it('accepts select values, including a duration given as text', () => {
    expect(parseConfig({ duration: '60', size: 'small', mode: 'triple' })).toEqual({ duration: 60, size: 'small', mode: 'triple' });
    expect(parseConfig({ duration: 30, size: 'large', mode: 'single' })).toEqual({ duration: 30, size: 'large', mode: 'single' });
  });
  it('falls back to the defaults, part by part, for anything else', () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({ duration: '45', size: 'huge', mode: 'five' })).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({ duration: NaN, size: 7, mode: {} })).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({ duration: 60, size: 'nope', mode: 'triple' })).toEqual({ duration: 60, size: 'medium', mode: 'triple' });
    expect(parseConfig({ duration: 'x', size: '__proto__', mode: 'constructor' })).toEqual(DEFAULT_CONFIG);
  });
  it('every valid setup round-trips through its key', () => {
    for (const d of DURATIONS) for (const s of SIZE_KEYS) for (const m of MODE_KEYS) {
      const key = comboKey({ duration: d, size: s, mode: m });
      expect(isComboKey(key)).toBe(true);
      expect(key).toBe(`${d}-${s}-${m}`);
    }
  });
  it('a bad setup still gives a valid key', () => {
    expect(comboKey({ duration: 99, size: 'x', mode: 'y' } as unknown as Config)).toBe('30-medium-single');
  });
  it('isComboKey rejects anything not on the list', () => {
    for (const bad of ['', '30-medium', '45-large-single', '__proto__', 'constructor', null, undefined, 5, {}]) expect(isComboKey(bad)).toBe(false);
  });
  it('labels read as plain words', () => {
    expect(configLabel({ duration: 60, size: 'small', mode: 'triple' })).toBe('60 s, Small, Three at a time');
  });
});

describe('targetDiameter', () => {
  it('never goes under the tap-size floor at phone widths (Large 44, Medium 32, Small 22)', () => {
    for (let w = 200; w <= 420; w += 1) {
      expect(targetDiameter(w, 'large')).toBeGreaterThanOrEqual(44);
      expect(targetDiameter(w, 'medium')).toBeGreaterThanOrEqual(32);
      expect(targetDiameter(w, 'small')).toBeGreaterThanOrEqual(22);
    }
  });
  it('at the widths of a 375 px phone the floors are met exactly or exceeded', () => {
    for (const w of [288, 311, 343, 375]) {
      expect(targetDiameter(w, 'large')).toBeGreaterThanOrEqual(44);
      expect(targetDiameter(w, 'medium')).toBeGreaterThanOrEqual(32);
      expect(targetDiameter(w, 'small')).toBeGreaterThanOrEqual(22);
    }
    // Large at 343 px is 13% of the width, a little over its floor.
    expect(targetDiameter(343, 'large')).toBeCloseTo(343 * 0.13, 6);
    // Medium and Small are held at their floors there.
    expect(targetDiameter(343, 'medium')).toBe(32);
    expect(targetDiameter(343, 'small')).toBe(22);
  });
  it('grows with the width and then stops at the ceiling', () => {
    for (const k of SIZE_KEYS) {
      let prev = 0;
      for (let w = 100; w <= 2000; w += 25) {
        const d = targetDiameter(w, k);
        expect(d).toBeGreaterThanOrEqual(prev);
        expect(d).toBeLessThanOrEqual(SIZES[k].max);
        prev = d;
      }
      expect(targetDiameter(2000, k)).toBe(SIZES[k].max);
    }
    expect(targetDiameter(700, 'medium')).toBeGreaterThan(targetDiameter(343, 'medium'));
  });
  it('keeps the three sizes in order at every width', () => {
    for (let w = 0; w <= 2000; w += 37) {
      expect(targetDiameter(w, 'large')).toBeGreaterThan(targetDiameter(w, 'medium'));
      expect(targetDiameter(w, 'medium')).toBeGreaterThan(targetDiameter(w, 'small'));
    }
  });
  it('survives a bad width or size', () => {
    for (const bad of [NaN, Infinity, -Infinity, -50, 0, undefined as unknown as number, '300' as unknown as number]) {
      const d = targetDiameter(bad, 'large');
      expect(Number.isFinite(d) || d === SIZES.large.max).toBe(true);
      expect(d).toBeGreaterThanOrEqual(44);
    }
    expect(targetDiameter(343, 'bogus' as SizeKey)).toBe(targetDiameter(343, 'medium'));
  });
});

describe('bounds helpers', () => {
  it('fitRadius never exceeds half of the smaller side and is never negative', () => {
    expect(fitRadius({ width: 400, height: 300 }, 22)).toBe(22);
    expect(fitRadius({ width: 100, height: 20 }, 22)).toBe(10);
    expect(fitRadius({ width: 0, height: 300 }, 22)).toBe(0);
    expect(fitRadius({ width: -5, height: 300 }, 22)).toBe(0);
    expect(fitRadius({ width: NaN, height: NaN }, 22)).toBe(0);
    expect(fitRadius({ width: 400, height: 300 }, -9)).toBe(0);
    expect(fitRadius({ width: 400, height: 300 }, NaN)).toBe(0);
  });
  it('spawnBounds keeps the whole target plus the margin inside', () => {
    const b = spawnBounds({ width: 400, height: 300 }, 22, 6);
    expect(b).toEqual({ r: 22, minX: 28, maxX: 372, minY: 28, maxY: 272 });
  });
  it('the margin shrinks rather than inverting the bounds in a small area', () => {
    const b = spawnBounds({ width: 60, height: 60 }, 22, 6);
    expect(b.minX).toBeLessThanOrEqual(b.maxX);
    expect(b.minY).toBeLessThanOrEqual(b.maxY);
    const t = spawnBounds({ width: 40, height: 40 }, 22, 6);
    expect(t).toEqual({ r: 20, minX: 20, maxX: 20, minY: 20, maxY: 20 });
  });
  it('clampCentre pulls a point back inside and repairs non-numbers', () => {
    const b = spawnBounds({ width: 400, height: 300 }, 22, 6);
    expect(clampCentre({ x: -50, y: 9999 }, b)).toEqual({ x: 28, y: 272 });
    expect(clampCentre({ x: 100, y: 100 }, b)).toEqual({ x: 100, y: 100 });
    expect(clampCentre({ x: NaN, y: Infinity }, b)).toEqual({ x: 28, y: 28 });
  });
});

const AREAS = [
  { width: 343, height: 343 }, { width: 288, height: 288 }, { width: 375, height: 375 }, { width: 720, height: 450 },
  { width: 1100, height: 688 }, { width: 200, height: 120 }, { width: 120, height: 300 }, { width: 90, height: 90 },
  { width: 60, height: 40 }, { width: 30, height: 30 }, { width: 10, height: 10 }, { width: 3, height: 500 },
  { width: 1, height: 1 }, { width: 0, height: 0 }, { width: 500, height: 0 },
];

describe('spawnPosition: always inside the play area', () => {
  it('for 600 seeded draws in every size and every area, including tiny ones', () => {
    const rng = mulberry32(2026);
    for (const area of AREAS) {
      for (const k of SIZE_KEYS) {
        const radius = targetDiameter(area.width, k) / 2;
        for (let i = 0; i < 40; i++) {
          const p = spawnPosition(rng, area, radius, MARGIN_PX, []);
          const r = fitRadius(area, radius);
          expect(p.r).toBe(r);
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
          expect(p.x - r, `${area.width}x${area.height} ${k}`).toBeGreaterThanOrEqual(0);
          expect(p.y - r).toBeGreaterThanOrEqual(0);
          expect(p.x + r).toBeLessThanOrEqual(area.width + 1e-9);
          expect(p.y + r).toBeLessThanOrEqual(area.height + 1e-9);
        }
      }
    }
  });
  it('in a normal area the margin is kept on every side', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 2000; i++) {
      const p = spawnPosition(rng, { width: 343, height: 343 }, 22, MARGIN_PX, []);
      expect(p.x - 22).toBeGreaterThanOrEqual(MARGIN_PX - 1e-9);
      expect(p.y - 22).toBeGreaterThanOrEqual(MARGIN_PX - 1e-9);
      expect(p.x + 22).toBeLessThanOrEqual(343 - MARGIN_PX + 1e-9);
      expect(p.y + 22).toBeLessThanOrEqual(343 - MARGIN_PX + 1e-9);
    }
  });
  it('stays inside even with extreme or broken rng values', () => {
    for (const bad of [-5, 0, 0.999999, 1, 7, NaN, Infinity, -Infinity]) {
      const p = spawnPosition(() => bad, { width: 343, height: 343 }, 22, 6, []);
      expect(p.x).toBeGreaterThanOrEqual(28);
      expect(p.x).toBeLessThanOrEqual(315);
      expect(p.y).toBeGreaterThanOrEqual(28);
      expect(p.y).toBeLessThanOrEqual(315);
    }
  });
  it('actually uses the whole area and is roughly uniform', () => {
    const rng = mulberry32(99);
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity; let sx = 0; let sy = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const p = spawnPosition(rng, { width: 400, height: 300 }, 20, 6, []);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      sx += p.x; sy += p.y;
    }
    expect(minX).toBeLessThan(30);
    expect(maxX).toBeGreaterThan(370);
    expect(minY).toBeLessThan(30);
    expect(maxY).toBeGreaterThan(270);
    expect(Math.abs(sx / n - 200)).toBeLessThan(6);
    expect(Math.abs(sy / n - 150)).toBeLessThan(6);
  });
});

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);

describe('spawnPosition: never overlaps, never lands on the previous spot', () => {
  it('single mode: 3000 hits in a row on a phone-sized area are always 2 radii from the last spot', () => {
    for (const k of SIZE_KEYS) {
      const rng = mulberry32(31);
      const area = { width: 343, height: 343 };
      const r = targetDiameter(area.width, k) / 2;
      let prev: Spot = { x: 171, y: 171 };
      for (let i = 0; i < 1000; i++) {
        const p = spawnPosition(rng, area, r, MARGIN_PX, [prev]);
        expect(p.clear).toBe(true);
        expect(dist(p, prev), `${k} #${i}`).toBeGreaterThanOrEqual(2 * r - 1e-9);
        prev = p;
      }
    }
  });
  it('three at a time: the three on screen never overlap each other or the spot just vacated', () => {
    const rng = mulberry32(77);
    for (const area of [{ width: 343, height: 343 }, { width: 720, height: 450 }, { width: 288, height: 288 }]) {
      for (const k of SIZE_KEYS) {
        const r = targetDiameter(area.width, k) / 2;
        const onScreen: Spot[] = [];
        for (let i = 0; i < 3; i++) onScreen.push(spawnPosition(rng, area, r, MARGIN_PX, onScreen));
        for (let step = 0; step < 600; step++) {
          for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
            expect(dist(onScreen[a], onScreen[b]), `${area.width} ${k} step ${step}`).toBeGreaterThanOrEqual(2 * r - 1e-9);
          }
          const hit = Math.floor(rng() * 3);
          const gone = onScreen[hit];
          const others = onScreen.filter((_, i) => i !== hit);
          const fresh = spawnPosition(rng, area, r, MARGIN_PX, [...others, gone]);
          expect(fresh.clear).toBe(true);
          expect(dist(fresh, gone)).toBeGreaterThanOrEqual(2 * r - 1e-9);
          onScreen[hit] = fresh;
        }
      }
    }
  });
  it('keeps clear of a bigger spot using that spot\'s own radius (the Start target)', () => {
    const rng = mulberry32(8);
    const start: Spot = { x: 171, y: 171, r: 41 };
    for (let i = 0; i < 1500; i++) {
      const p = spawnPosition(rng, { width: 343, height: 343 }, 22, MARGIN_PX, [start]);
      expect(dist(p, start)).toBeGreaterThanOrEqual(22 + 41 - 1e-9);
    }
  });
  it('finds the one clear region when most of the area is blocked', () => {
    const rng = mulberry32(3);
    // 200x100 area, r = 20: block everything except the far right strip.
    const blockers: Spot[] = [{ x: 60, y: 50, r: 90 }];
    for (let i = 0; i < 100; i++) {
      const p = spawnPosition(rng, { width: 200, height: 100 }, 20, 6, blockers);
      expect(p.clear).toBe(true);
      expect(dist(p, blockers[0])).toBeGreaterThanOrEqual(20 + 90 - 1e-9);
      expect(p.x + 20).toBeLessThanOrEqual(200);
    }
  });
  it('when there is truly no room it says so, and still returns a spot inside the area', () => {
    const area = { width: 100, height: 100 };
    const p = spawnPosition(mulberry32(1), area, 22, 6, [{ x: 50, y: 50 }]);
    expect(p.clear).toBe(false);
    expect(p.x - p.r).toBeGreaterThanOrEqual(0);
    expect(p.x + p.r).toBeLessThanOrEqual(100);
    expect(p.y - p.r).toBeGreaterThanOrEqual(0);
    expect(p.y + p.r).toBeLessThanOrEqual(100);
    // and it is the roomiest spot it could find: a corner of the allowed region
    expect(dist(p, { x: 50, y: 50 })).toBeGreaterThan(30);
  });
  it('a tiny area with a spot to avoid never leaves the bounds', () => {
    const rng = mulberry32(12);
    for (const area of [{ width: 30, height: 30 }, { width: 10, height: 10 }, { width: 1, height: 1 }, { width: 0, height: 0 }]) {
      for (let i = 0; i < 50; i++) {
        const p = spawnPosition(rng, area, 22, 6, [{ x: area.width / 2, y: area.height / 2 }]);
        expect(p.x - p.r).toBeGreaterThanOrEqual(0);
        expect(p.y - p.r).toBeGreaterThanOrEqual(0);
        expect(p.x + p.r).toBeLessThanOrEqual(area.width + 1e-9);
        expect(p.y + p.r).toBeLessThanOrEqual(area.height + 1e-9);
      }
    }
  });
  it('ignores avoid entries that are not usable numbers', () => {
    const p = spawnPosition(mulberry32(2), { width: 343, height: 343 }, 22, 6, [{ x: NaN, y: 3 }, { x: 4, y: Infinity }, { x: 100, y: 100, r: NaN }]);
    expect(p.clear).toBe(true);
    expect(dist(p, { x: 100, y: 100 })).toBeGreaterThanOrEqual(44 - 1e-9);
  });
  it('does not mutate the list it was given', () => {
    const avoid: Spot[] = [{ x: 10, y: 10 }, { x: 200, y: 200 }];
    const before = JSON.stringify(avoid);
    spawnPosition(mulberry32(4), { width: 343, height: 343 }, 22, 6, avoid);
    expect(JSON.stringify(avoid)).toBe(before);
  });
});

describe('spawnPosition: determinism', () => {
  it('the same seed gives the same sequence and a different seed does not', () => {
    const seq = (seed: number) => {
      const r = mulberry32(seed);
      const out: string[] = [];
      let prev: Spot = { x: 100, y: 100 };
      for (let i = 0; i < 100; i++) {
        const p = spawnPosition(r, { width: 343, height: 343 }, 22, 6, [prev]);
        out.push(`${p.x.toFixed(6)},${p.y.toFixed(6)}`);
        prev = p;
      }
      return out.join('|');
    };
    expect(seq(5)).toBe(seq(5));
    expect(seq(5)).not.toBe(seq(6));
  });
});

describe('a run: hits and misses', () => {
  it('starts empty', () => {
    expect(emptyRun()).toEqual({ times: [], misses: 0 });
  });
  it('recordHit and recordMiss add one each and never mutate', () => {
    const r0 = emptyRun();
    const r1 = recordHit(r0, 410.5);
    const r2 = recordMiss(r1);
    const r3 = recordHit(r2, 380);
    expect(r0).toEqual({ times: [], misses: 0 });
    expect(r1).toEqual({ times: [410.5], misses: 0 });
    expect(r2).toEqual({ times: [410.5], misses: 1 });
    expect(r3).toEqual({ times: [410.5, 380], misses: 1 });
  });
  it('a hit time that is not a finite non-negative number is ignored', () => {
    const r = recordHit(emptyRun(), 300);
    for (const bad of [NaN, Infinity, -Infinity, -1, '5' as unknown as number, null as unknown as number, undefined as unknown as number]) {
      expect(recordHit(r, bad)).toBe(r);
    }
    expect(recordHit(r, 0).times).toEqual([300, 0]);
  });
  it('only a run that lasted its whole duration is complete', () => {
    expect(isCompleteRun(30000, 30)).toBe(true);
    expect(isCompleteRun(30012.4, 30)).toBe(true);
    expect(isCompleteRun(29999.9, 30)).toBe(false);
    expect(isCompleteRun(12000, 30)).toBe(false);
    expect(isCompleteRun(60000, 60)).toBe(true);
    expect(isCompleteRun(30000, 60)).toBe(false);
    expect(isCompleteRun(NaN, 30)).toBe(false);
    expect(isCompleteRun(Infinity, 30)).toBe(false);
    expect(isCompleteRun(30000, 45)).toBe(false);
  });
});

describe('accuracy', () => {
  it('is hits over hits plus misses, as a percent', () => {
    expect(accuracyPct(1, 1)).toBe(50);
    expect(accuracyPct(3, 1)).toBe(75);
    expect(accuracyPct(0, 5)).toBe(0);
    expect(accuracyPct(10, 0)).toBe(100);
    expect(accuracyPct(2, 1)).toBeCloseTo(66.6667, 3);
  });
  it('is 100 when nothing has been pressed, never NaN', () => {
    expect(accuracyPct(0, 0)).toBe(100);
  });
  it('treats bad counts as zero', () => {
    for (const bad of [NaN, -3, Infinity, undefined as unknown as number, null as unknown as number, '4' as unknown as number]) {
      expect(Number.isNaN(accuracyPct(bad, 0))).toBe(false);
      expect(Number.isNaN(accuracyPct(0, bad))).toBe(false);
    }
    expect(accuracyPct(NaN, NaN)).toBe(100);
    expect(accuracyPct(-4, 0)).toBe(100);
  });
  it('stays between 0 and 100 for 5000 random counts', () => {
    const r = mulberry32(6);
    for (let i = 0; i < 5000; i++) {
      const a = accuracyPct(Math.floor(r() * 500), Math.floor(r() * 500));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(100);
    }
  });
});

describe('hits per second', () => {
  it('is hits over seconds', () => {
    expect(hitsPerSecond(60, 30)).toBe(2);
    expect(hitsPerSecond(45, 60)).toBe(0.75);
    expect(hitsPerSecond(0, 30)).toBe(0);
  });
  it('is zero, not Infinity or NaN, when no time has passed', () => {
    expect(hitsPerSecond(10, 0)).toBe(0);
    expect(hitsPerSecond(0, 0)).toBe(0);
    for (const bad of [-5, NaN, Infinity, undefined as unknown as number]) expect(hitsPerSecond(10, bad)).toBe(0);
  });
  it('ignores a bad hit count', () => {
    expect(hitsPerSecond(NaN, 30)).toBe(0);
    expect(hitsPerSecond(-3, 30)).toBe(0);
  });
});

describe('mean and median', () => {
  it('odd count: the middle value', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([500])).toBe(500);
    expect(mean([300, 100, 200])).toBe(200);
  });
  it('even count: the average of the two middle values', () => {
    expect(median([100, 400, 200, 300])).toBe(250);
    expect(median([200, 201])).toBe(200.5);
    expect(mean([100, 400, 200, 300])).toBe(250);
  });
  it('ties', () => {
    expect(median([250, 250, 250, 250])).toBe(250);
    expect(median([180, 180, 300])).toBe(180);
  });
  it('empty input gives null, never NaN', () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(mean([NaN, Infinity])).toBeNull();
    expect(median([NaN, -Infinity])).toBeNull();
  });
  it('ignores non-finite and negative entries and does not reorder its input', () => {
    const src = [300, NaN, 100, Infinity, 200, -50];
    const copy = src.map(String);
    expect(median(src)).toBe(200);
    expect(mean(src)).toBe(200);
    expect(src.map(String)).toEqual(copy);
  });
  it('the median is always between the smallest and the largest value', () => {
    const r = mulberry32(8);
    for (let k = 0; k < 200; k++) {
      const xs = Array.from({ length: 1 + Math.floor(r() * 40) }, () => 100 + Math.floor(r() * 900));
      const m = median(xs) as number;
      expect(m).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(m).toBeLessThanOrEqual(Math.max(...xs));
    }
  });
});

describe('summarise', () => {
  it('a full result', () => {
    const s = summarise([400, 500, 600, 700, 800], 1, 30);
    expect(s).toEqual({ hits: 5, misses: 1, accuracy: (5 / 6) * 100, hitsPerSecond: 5 / 30, meanMs: 600, medianMs: 600 });
  });
  it('an empty run is safe: zeros, 100% accuracy, nulls', () => {
    const s = summarise([], 0, 30);
    expect(s).toEqual({ hits: 0, misses: 0, accuracy: 100, hitsPerSecond: 0, meanMs: null, medianMs: null });
    expect(JSON.stringify(s)).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('only misses', () => {
    const s = summarise([], 4, 30);
    expect(s).toMatchObject({ hits: 0, misses: 4, accuracy: 0, hitsPerSecond: 0, meanMs: null, medianMs: null });
  });
  it('zero elapsed time and bad inputs never produce NaN or Infinity', () => {
    for (const secs of [0, -1, NaN, Infinity]) {
      const s = summarise([300, 400], 2, secs);
      expect(s.hitsPerSecond).toBe(0);
      expect(JSON.stringify(s)).not.toMatch(/NaN|undefined|Infinity|null/);
    }
    const bad = summarise([NaN, Infinity, -4, 250] as number[], NaN, 30);
    expect(bad).toMatchObject({ hits: 1, misses: 0, accuracy: 100, meanMs: 250, medianMs: 250 });
    expect(summarise(null as unknown as number[], undefined as unknown as number, 30).hits).toBe(0);
  });
  it('one hit and the hits count agree with the number of valid times', () => {
    expect(summarise([321], 0, 60)).toMatchObject({ hits: 1, meanMs: 321, medianMs: 321 });
  });
});

describe('formatting', () => {
  it('formatMs rounds to whole milliseconds and survives bad input', () => {
    expect(formatMs(243.4)).toBe('243 ms');
    expect(formatMs(243.5)).toBe('244 ms');
    expect(formatMs(0)).toBe('0 ms');
    for (const bad of [NaN, Infinity, -1, null, undefined]) expect(formatMs(bad)).toBe('-');
  });
  it('formatPercent uses one decimal and never shows 100% unless every press was a hit', () => {
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(66.6667)).toBe('66.7%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(99.96)).toBe('99.9%');
    expect(formatPercent(99.99999)).toBe('99.9%');
    expect(formatPercent(accuracyPct(999, 1))).toBe('99.9%');
    expect(formatPercent(150)).toBe('100%');
    expect(formatPercent(-4)).toBe('0%');
    for (const bad of [NaN, Infinity, null, undefined]) expect(formatPercent(bad)).toBe('-');
  });
  it('formatRate has two decimals and falls back to 0.00', () => {
    expect(formatRate(1.5)).toBe('1.50');
    expect(formatRate(0)).toBe('0.00');
    expect(formatRate(2 / 3)).toBe('0.67');
    for (const bad of [NaN, Infinity, -1, null, undefined]) expect(formatRate(bad)).toBe('0.00');
  });
  it('formatSeconds shows tenths and never goes negative', () => {
    expect(formatSeconds(30000)).toBe('30.0 s');
    expect(formatSeconds(12345)).toBe('12.3 s');
    expect(formatSeconds(0)).toBe('0.0 s');
    expect(formatSeconds(-40)).toBe('0.0 s');
    expect(formatSeconds(NaN)).toBe('0.0 s');
    expect(formatSeconds(Infinity)).toBe('0.0 s');
  });
  it('resultSummary reads as a sentence, with and without hits', () => {
    const cfg: Config = { duration: 30, size: 'medium', mode: 'single' };
    expect(resultSummary(cfg, summarise([400, 500, 600], 1, 30))).toBe(
      'Aim Trainer (30 s, Medium, One at a time): 3 hits, 1 miss, 75% accuracy, 0.10 hits per second, average 500 ms per hit, median 500 ms',
    );
    expect(resultSummary(cfg, summarise([450], 2, 30))).toContain('1 hit, 2 misses');
    expect(resultSummary(cfg, summarise([], 0, 30))).toBe('Aim Trainer (30 s, Medium, One at a time): 0 hits, 0 misses, 100% accuracy, 0.00 hits per second');
  });
  it('no generated text contains an em-dash, NaN, undefined, null or Infinity', () => {
    const texts: string[] = [];
    for (const c of ALL_COMBOS) texts.push(c);
    for (const d of DURATIONS) for (const s of SIZE_KEYS) for (const m of MODE_KEYS) {
      const cfg = { duration: d, size: s, mode: m };
      texts.push(configLabel(cfg), resultSummary(cfg, summarise([], 0, d)), resultSummary(cfg, summarise([210, 330, 290], 3, d)));
    }
    texts.push(formatMs(NaN), formatPercent(NaN), formatRate(NaN), formatSeconds(NaN));
    for (const k of SIZE_KEYS) texts.push(SIZES[k].label);
    for (const k of MODE_KEYS) texts.push(MODES[k].label);
    for (const t of texts) {
      expect(t.includes(EM_DASH)).toBe(false);
      expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    }
  });
});

describe('cleanHits', () => {
  it('accepts whole numbers from 1 to the cap, floors fractions and caps the top', () => {
    expect(cleanHits(1)).toBe(1);
    expect(cleanHits(42)).toBe(42);
    expect(cleanHits(42.9)).toBe(42);
    expect(cleanHits(1000)).toBe(1000);
    expect(cleanHits(1001)).toBe(1000);
    expect(cleanHits(1e300)).toBe(1000);
  });
  it('rejects zero, negatives, fractions below one and anything that is not a finite number', () => {
    for (const bad of [0, 0.9, -1, -1e9, NaN, Infinity, -Infinity, '12', null, undefined, {}, [], [12], true, 10n]) expect(cleanHits(bad)).toBeNull();
  });
});

describe('sanitiseStored', () => {
  it('keeps a good payload', () => {
    expect(sanitiseStored({ '30-medium-single': 41, '60-large-triple': 88 })).toEqual({ '30-medium-single': 41, '60-large-triple': 88 });
  });
  it('accepts the JSON string straight from localStorage', () => {
    expect(sanitiseStored('{"30-small-single":19,"60-small-triple":50}')).toEqual({ '30-small-single': 19, '60-small-triple': 50 });
  });
  it('returns an empty result for anything that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1,2,3]', '"x"', 'null', [], [1, 2], NaN, () => 1, Symbol('x')]) {
      expect(sanitiseStored(bad)).toEqual({});
    }
  });
  it('drops keys that are not one of the twelve setups, including prototype keys', () => {
    const s = sanitiseStored('{"__proto__":{"30-medium-single":99},"constructor":5,"toString":3,"45-large-single":12,"30-huge-single":9,"extra":7,"30-medium-single":10}');
    expect(s).toEqual({ '30-medium-single': 10 });
    expect(({} as Record<string, unknown>)['30-medium-single']).toBeUndefined();
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
  });
  it('drops strings, NaN, Infinity, objects, arrays and booleans as values', () => {
    const s = sanitiseStored({
      '30-small-single': '20', '30-small-triple': NaN, '30-medium-single': Infinity, '30-medium-triple': {}, '30-large-single': [5],
      '30-large-triple': true, '60-small-single': null, '60-small-triple': undefined, '60-medium-single': 12,
    });
    expect(s).toEqual({ '60-medium-single': 12 });
  });
  it('floors fractions, clamps a huge value to the cap and drops zero or negative values', () => {
    const s = sanitiseStored({ '30-small-single': 12.9, '30-small-triple': 1e9, '30-medium-single': 0, '30-medium-triple': -5, '30-large-single': 0.5 });
    expect(s).toEqual({ '30-small-single': 12, '30-small-triple': 1000 });
  });
  it('handles a very large hostile object quickly and keeps only known keys', () => {
    const t = performance.now();
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200000; i++) huge[`k${i}`] = i;
    huge['30-medium-single'] = 7;
    expect(sanitiseStored(huge)).toEqual({ '30-medium-single': 7 });
    // Generous bound: this guards against quadratic behaviour, not machine speed.
    expect(performance.now() - t).toBeLessThan(4000);
  }, 15_000);
  it('is deterministic and never returns an unknown key, a non-integer, or a value outside 1..1000', () => {
    const r = mulberry32(5);
    const pool: unknown[] = [NaN, Infinity, -1, 0, 1, 1.5, 999, 1000, 1001, 'a', null, {}, 123.456, 1e300, -1e300];
    for (let k = 0; k < 300; k++) {
      const raw: Record<string, unknown> = {};
      for (const key of ALL_COMBOS) if (r() < 0.6) raw[key] = pool[Math.floor(r() * pool.length)];
      raw.junk = 5;
      const a = sanitiseStored(raw);
      expect(sanitiseStored(raw)).toEqual(a);
      for (const [key, v] of Object.entries(a)) {
        expect(ALL_COMBOS).toContain(key);
        expect(Number.isInteger(v) && v >= 1 && v <= 1000).toBe(true);
      }
    }
  });
});

describe('toStorable', () => {
  it('stores plain numbers only', () => {
    expect(toStorable({})).toEqual({});
    const out = toStorable({ '30-medium-single': 40, junk: 3 } as Record<string, number>);
    expect(out).toEqual({ '30-medium-single': 40 });
    expect(JSON.stringify(out)).not.toMatch(/null|NaN|undefined/);
  });
  it('round-trips through JSON and the sanitiser', () => {
    const b = { '30-medium-single': 40, '60-small-triple': 71 };
    expect(sanitiseStored(JSON.stringify(toStorable(b)))).toEqual(b);
  });
});

describe('recordBest', () => {
  const key = '30-medium-single';
  it('the first result is saved but is not announced as an improvement', () => {
    const r = recordBest({}, key, 40);
    expect(r).toEqual({ bests: { [key]: 40 }, saved: true, improved: false });
  });
  it('a higher result is saved and is an improvement; equal or lower changes nothing', () => {
    const base = { [key]: 40 };
    expect(recordBest(base, key, 41)).toEqual({ bests: { [key]: 41 }, saved: true, improved: true });
    const equal = recordBest(base, key, 40);
    expect(equal.saved).toBe(false);
    expect(equal.bests).toBe(base);
    const lower = recordBest(base, key, 12);
    expect(lower.saved).toBe(false);
    expect(lower.improved).toBe(false);
    expect(lower.bests).toBe(base);
  });
  it('keeps each setup separate', () => {
    let b = recordBest({}, '30-medium-single', 40).bests;
    b = recordBest(b, '60-medium-single', 70).bests;
    b = recordBest(b, '30-medium-triple', 55).bests;
    b = recordBest(b, '30-medium-single', 38).bests;
    expect(b).toEqual({ '30-medium-single': 40, '60-medium-single': 70, '30-medium-triple': 55 });
  });
  it('does not mutate the object it was given', () => {
    const base = { [key]: 40 };
    const frozen = JSON.stringify(base);
    recordBest(base, key, 50);
    expect(JSON.stringify(base)).toBe(frozen);
  });
  it('zero hits, bad numbers and unknown setups are never saved', () => {
    const base = { [key]: 40 };
    for (const bad of [0, -3, NaN, Infinity, '50' as unknown as number, null as unknown as number, 0.4]) {
      const r = recordBest(base, key, bad);
      expect(r.saved).toBe(false);
      expect(r.bests).toBe(base);
    }
    for (const badKey of ['', 'nope', '45-large-single', '__proto__', 'constructor']) {
      const r = recordBest(base, badKey, 50);
      expect(r.saved).toBe(false);
      expect(r.bests).toBe(base);
    }
  });
  it('a result above the cap is stored at the cap', () => {
    expect(recordBest({}, key, 5000).bests[key]).toBe(1000);
  });
});

describe('source hygiene', () => {
  it('neither the helpers nor the page call Math.random', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) {
      const text = readFileSync(resolve(process.cwd(), 'src/components/apps-private/aim-trainer', f), 'utf8');
      expect(text.includes('Math' + '.random'), f).toBe(false);
    }
  });
  it('the seeded generator the page falls back on stays in [0, 1) for clock-sized seeds', () => {
    for (const seed of [0, 1, Date.now() >>> 0, 4294967295, 2 ** 32 + 5]) {
      const r = mulberry32(seed);
      for (let i = 0; i < 200; i++) {
        const x = r();
        expect(x >= 0 && x < 1).toBe(true);
      }
    }
  });
});

describe('a whole run end to end', () => {
  it('plays a 30 s run with misses and saves what the page would save', () => {
    const rng = mulberry32(11);
    const cfg: Config = { duration: 30, size: 'medium', mode: 'single' };
    const area = { width: 343, height: 343 };
    const r = targetDiameter(area.width, cfg.size) / 2;
    let run = emptyRun();
    let prev: Spot = { x: 171, y: 171, r: 41 };
    // 36 hits, one every 800 ms, with a miss after every 9th hit.
    for (let i = 1; i <= 36; i++) {
      const p = spawnPosition(rng, area, r, MARGIN_PX, [prev]);
      expect(p.clear).toBe(true);
      run = recordHit(run, 800);
      if (i % 9 === 0) run = recordMiss(run);
      prev = p;
    }
    const s = summarise(run.times, run.misses, cfg.duration);
    expect(s).toMatchObject({ hits: 36, misses: 4, meanMs: 800, medianMs: 800 });
    expect(s.accuracy).toBeCloseTo(90, 9);
    expect(s.hitsPerSecond).toBeCloseTo(1.2, 9);
    expect(formatPercent(s.accuracy)).toBe('90%');
    expect(formatRate(s.hitsPerSecond)).toBe('1.20');

    // Finished: saved. Cancelled early: not saved (the page never calls recordBest for it).
    expect(isCompleteRun(30004, cfg.duration)).toBe(true);
    let bests = recordBest({}, comboKey(cfg), s.hits).bests;
    expect(bests).toEqual({ '30-medium-single': 36 });
    expect(isCompleteRun(11000, cfg.duration)).toBe(false);
    const worse = recordBest(bests, comboKey(cfg), 30);
    expect(worse.bests).toBe(bests);
    bests = recordBest(bests, comboKey(cfg), 44).bests;
    expect(sanitiseStored(JSON.stringify(toStorable(bests)))).toEqual({ '30-medium-single': 44 });
  });
});
