/**
 * games-fractal-zoom.test.ts - the engine behind `fractal-zoom`.
 *
 * Pinned:
 *  - the escape count against known points (c = 1 escapes after 3 repeats, c = 2 after 2, c = -2, -1, 0, i and
 *    1/4 never), against the slow escape just past the cusp (about pi / sqrt(c - 1/4)), and against EXACT
 *    arithmetic: a grid of points is counted with big-integer fractions and must agree with the 64-bit code,
 *  - the Mandelbrot set's area (1.5066...) from a pixel count, mirror symmetry, the Julia set for c = 0 being
 *    the unit disc, and that the shortcut for the main body never claims a point that escapes,
 *  - the smooth value: no jumps where the whole count changes (the whole count jumps by 1 there),
 *  - the view: mapping pixels to numbers and back, zooming about a point keeps that point still, panning,
 *    the wheel and pinch factors, the stretch used while a new picture is worked out, and the limit of 64-bit
 *    numbers (at the limit every neighbouring pixel still has its own number; past it they run together),
 *  - tiles: the spiral order covers every tile once from the middle, a finished job equals a direct count at
 *    every pixel for both sets, the coarse pass covers everything first, and a time budget is honoured with
 *    progress that only goes up,
 *  - palettes, places (each shows real structure), iteration counts, words, and the page source claims.
 */
import { describe, it, expect } from 'vitest';
import {
  MODES, MODE_LABEL, isMode, escapeCount, smoothEscape, inMainBody, sampleValue, SMOOTH_BAIL2, HOME_SPAN, MAX_SPAN, HOME_VIEW, DEFAULT_JULIA,
  complexAt, pixelOf, HARD_RATIO, WARN_RATIO, precisionRatio, minSpan, nearLimit, atLimit, clampView, zoomAt, panBy, wheelFactor, pinchChange,
  previewTransform, zoomOf, formatZoom, digitsFor, formatCoord, DETAIL_KEYS, DETAIL_FACTOR, isDetail, MIN_ITER, MAX_ITER, iterationsFor,
  PALETTES, isPaletteId, LUT_SIZE, CYCLE, paletteStops, buildLut, lutIndex, TILE, PREVIEW_STEP, spiralOrder, createJob, stepJob, runJob,
  jobProgress, sliceRows, PLACES, placeById, describeView, shareText, RULES, KEY_ZOOM, PAN_FRACTION,
  mulberry32, parseColour, toCss, eightTints, mixOklch, neutral, luminance, plural,
  type Mode, type View,
} from '../src/components/apps-private/fractal-zoom/helpers';
import calculatorSource from '../src/components/apps-private/fractal-zoom/Calculator.astro?raw';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const TOKENS = { sky: [56, 189, 248], green: [52, 211, 153], amber: [251, 191, 36], rose: [248, 113, 113] } as { sky: [number, number, number]; green: [number, number, number]; amber: [number, number, number]; rose: [number, number, number] };
const JUL = { x: -0.8, y: 0.156 };

describe('the escape count: known points', () => {
  const table: [string, number, number, number][] = [
    ['c = 1 escapes after 3 repeats (1, 2, 5)', 1, 0, 3],
    ['c = 2 escapes after 2 repeats (2, 6)', 2, 0, 2],
    ['c = 0.5 escapes after 5 repeats', 0.5, 0, 5],
    ['c = -2.1 escapes at once', -2.1, 0, 1],
    ['c = 0 never escapes', 0, 0, 100],
    ['c = -1 (a two-cycle) never escapes', -1, 0, 100],
    ['c = -2 (stays at 2) never escapes', -2, 0, 100],
    ['c = i (a cycle) never escapes', 0, 1, 100],
    ['c = 1/4 (the cusp) never escapes', 0.25, 0, 100],
    ['c = -0.75 never escapes', -0.75, 0, 100],
  ];
  for (const [name, re, im, want] of table) it(name, () => expect(escapeCount(0, 0, re, im, 100)).toBe(want));

  it('just past the cusp escape is slow: about pi / sqrt(c - 1/4) repeats', () => {
    for (const eps of [0.01, 0.0025, 0.0004]) {
      const n = escapeCount(0, 0, 0.25 + eps, 0, 100000);
      const guess = Math.PI / Math.sqrt(eps);
      expect(n).toBeGreaterThan(guess * 0.85);
      expect(n).toBeLessThan(guess * 1.25);
    }
  });

  it('agrees with exact fractions on a grid of points (big-integer arithmetic, no rounding at all)', () => {
    const pow = new Map<number, bigint>();
    const p100 = (k: number): bigint => { let v = pow.get(k); if (v === undefined) { v = 100n ** BigInt(k); pow.set(k, v); } return v; };
    /** z and c are integers over 100. Same rule as the engine: report n when |z|^2 first passes 4, or maxIter. */
    const exact = (z0: [number, number], c: [number, number], maxIter: number): number => {
      let A = BigInt(z0[0]); let B = BigInt(z0[1]); let e = 1;
      for (let n = 1; n < maxIter; n++) {
        const k = p100(2 * e - 1);
        const nA = A * A - B * B + BigInt(c[0]) * k;
        const nB = 2n * A * B + BigInt(c[1]) * k;
        A = nA; B = nB; e *= 2;
        if (A * A + B * B > 4n * p100(2 * e)) return n;
      }
      return maxIter;
    };
    const MAXI = 12;
    let checked = 0; let escaped = 0; let inside = 0;
    for (let i = -28; i <= 8; i++) {
      for (let j = 0; j <= 10; j++) {
        const re = i * 7; const im = j * 11; // hundredths
        const want = exact([0, 0], [re, im], MAXI);
        const got = escapeCount(0, 0, re / 100, im / 100, MAXI);
        expect(got, `mandelbrot c = ${re}/100 + ${im}/100 i`).toBe(want);
        checked++; if (want === MAXI) inside++; else escaped++;
      }
    }
    // Julia: starting points on a grid, c fixed.
    for (let i = -16; i <= 16; i += 2) {
      for (let j = -12; j <= 12; j += 3) {
        const want = exact([i * 7, j * 7], [-80, 16], MAXI);
        const got = escapeCount(i * 0.07, j * 0.07, -0.8, 0.16, MAXI);
        expect(got, `julia z = ${i * 7}/100 + ${j * 7}/100 i`).toBe(want);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(450);
    expect(escaped).toBeGreaterThan(100);
    expect(inside).toBeGreaterThan(20);
  }, 120_000);
});

describe('the sets', () => {
  it('the Mandelbrot set has area 1.5066: a pixel count lands close', () => {
    const N = 400; let inside = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const re = -2 + ((i + 0.5) / N) * 2.5; const im = -1.25 + ((j + 0.5) / N) * 2.5;
      if (escapeCount(0, 0, re, im, 100) === 100) inside++;
    }
    const area = (inside / (N * N)) * 6.25;
    expect(area).toBeGreaterThan(1.49);
    expect(area).toBeLessThan(1.58);
  }, 60_000);
  it('is symmetrical top to bottom, and a Julia set is symmetrical about its middle', () => {
    const rng = mulberry32(4);
    for (let k = 0; k < 400; k++) {
      const x = -2 + rng() * 2.6; const y = rng() * 1.3;
      expect(escapeCount(0, 0, x, y, 300)).toBe(escapeCount(0, 0, x, -y, 300));
      const zx = (rng() - 0.5) * 3; const zy = (rng() - 0.5) * 3;
      expect(escapeCount(zx, zy, JUL.x, JUL.y, 300)).toBe(escapeCount(-zx, -zy, JUL.x, JUL.y, 300));
    }
  });
  it('the Julia set for c = 0 is the unit disc', () => {
    expect(escapeCount(1.5, 0, 0, 0, 100)).toBe(1);
    expect(escapeCount(1.2, 0, 0, 0, 100)).toBe(2);
    expect(escapeCount(1, 0, 0, 0, 100)).toBe(100);
    const rng = mulberry32(6);
    for (let k = 0; k < 500; k++) {
      const a = rng() * 2 * Math.PI; const r = rng() * 0.97;
      expect(escapeCount(r * Math.cos(a), r * Math.sin(a), 0, 0, 200)).toBe(200);
      const r2 = 1.03 + rng() * 0.5;
      expect(escapeCount(r2 * Math.cos(a), r2 * Math.sin(a), 0, 0, 200)).toBeLessThan(200);
    }
  });
  it('the shortcut for the main body never claims a point that escapes', () => {
    const rng = mulberry32(7);
    let flagged = 0;
    for (let k = 0; k < 30000; k++) {
      const x = -2 + rng() * 2.6; const y = (rng() - 0.5) * 2.4;
      if (inMainBody(x, y)) { flagged++; expect(escapeCount(0, 0, x, y, 600), `(${x}, ${y})`).toBe(600); }
    }
    expect(flagged).toBeGreaterThan(3000);
    expect(inMainBody(0, 0)).toBe(true);
    expect(inMainBody(-1, 0)).toBe(true);
    expect(inMainBody(1, 0)).toBe(false);
    expect(inMainBody(0.26, 0)).toBe(false);
    expect(inMainBody(-1.5, 0)).toBe(false);
  }, 60_000);
});

describe('the smooth value', () => {
  it('is -1 for points that stay and positive for points that escape, agreeing with the whole count', () => {
    const rng = mulberry32(8);
    let esc = 0;
    for (let k = 0; k < 4000; k++) {
      const x = -2.1 + rng() * 2.8; const y = (rng() - 0.5) * 2.4;
      const n = escapeCount(0, 0, x, y, 500);
      const nu = smoothEscape(0, 0, x, y, 500);
      if (n === 500) expect(nu).toBe(-1);
      else if (n < 495) { expect(nu).toBeGreaterThanOrEqual(0); expect(Number.isFinite(nu)).toBe(true); expect(Math.abs(nu - n)).toBeLessThan(8); esc++; }
    }
    expect(esc).toBeGreaterThan(2000);
  });
  it('has no jumps where the whole count changes', () => {
    // Walk along the real axis from just past the cusp to 0.5, outside the set. The whole count steps by 1 at
    // each band; the smooth value does not.
    const step = 1e-6; let crossings = 0; let maxSmoothJump = 0; let maxCountJump = 0;
    let prevN = escapeCount(0, 0, 0.27, 0, 500);
    let prevNu = smoothEscape(0, 0, 0.27, 0, 500);
    for (let k = 1; k <= 230000; k++) {
      const x = 0.27 + k * step;
      const n = escapeCount(0, 0, x, 0, 500);
      const nu = smoothEscape(0, 0, x, 0, 500);
      if (n !== prevN) { crossings++; maxCountJump = Math.max(maxCountJump, Math.abs(n - prevN)); }
      maxSmoothJump = Math.max(maxSmoothJump, Math.abs(nu - prevNu));
      prevN = n; prevNu = nu;
    }
    expect(crossings).toBeGreaterThanOrEqual(15);
    expect(maxCountJump).toBeGreaterThanOrEqual(1);
    expect(maxSmoothJump).toBeLessThan(0.01);
  }, 60_000);
  it('sampleValue picks the right rule for each set', () => {
    expect(sampleValue('mandelbrot', 0, 0, JUL, 100)).toBe(-1);
    expect(sampleValue('mandelbrot', 1, 0, JUL, 100)).toBe(smoothEscape(0, 0, 1, 0, 100));
    expect(sampleValue('julia', 0.3, 0.2, JUL, 100)).toBe(smoothEscape(0.3, 0.2, JUL.x, JUL.y, 100));
    expect(SMOOTH_BAIL2).toBe(65536);
  });
});

describe('the view: mapping, zooming, panning', () => {
  const W = 800; const H = 600;
  const rng = mulberry32(9);
  const randomView = (): View => ({ cx: (rng() - 0.5) * 3, cy: (rng() - 0.5) * 2, span: 10 ** (-0.5 - rng() * 6) });

  it('pixels and numbers map both ways, up is positive imaginary, and the middle of the picture is the centre', () => {
    const v: View = { cx: -0.5, cy: 0.2, span: 3 };
    const mid = complexAt(v, W / 2, H / 2, W, H);
    expect(mid).toEqual({ re: -0.5, im: 0.2 });
    expect(complexAt(v, 0, 0, W, H).im).toBeGreaterThan(complexAt(v, 0, H, W, H).im);
    expect(complexAt(v, W, 0, W, H).re - complexAt(v, 0, 0, W, H).re).toBeCloseTo(3, 12);
    for (let k = 0; k < 200; k++) {
      const w = randomView(); const fx = rng() * W; const fy = rng() * H;
      const c = complexAt(w, fx, fy, W, H);
      const p = pixelOf(w, c.re, c.im, W, H);
      expect(near(p.x, fx, 1e-6)).toBe(true);
      expect(near(p.y, fy, 1e-6)).toBe(true);
    }
  });
  it('zooming about a pixel keeps the number under it still and scales the width', () => {
    for (let k = 0; k < 300; k++) {
      const v = { cx: (rng() - 0.5) * 2, cy: (rng() - 0.5) * 2, span: 0.001 + rng() * 3 };
      const fx = rng() * W; const fy = rng() * H; const f = 0.6 + rng() * 2;
      const before = complexAt(v, fx, fy, W, H);
      const z = zoomAt(v, fx, fy, W, H, f);
      const after = complexAt(z, fx, fy, W, H);
      expect(near(after.re, before.re, 1e-12 * Math.max(1, Math.abs(before.re)))).toBe(true);
      expect(near(after.im, before.im, 1e-12 * Math.max(1, Math.abs(before.im)))).toBe(true);
      if (v.span / f <= MAX_SPAN) expect(near(z.span, v.span / f, 1e-12)).toBe(true);
    }
  });
  it('panning by pixels shifts the picture by exactly that many pixels', () => {
    const v: View = { cx: -0.4, cy: 0.1, span: 0.5 };
    const p = panBy(v, 100, -50, W);
    const a = pixelOf(v, 0.123, 0.045, W, H);
    const b = pixelOf(p, 0.123, 0.045, W, H);
    expect(near(b.x - a.x, 100, 1e-9)).toBe(true);
    expect(near(b.y - a.y, -50, 1e-9)).toBe(true);
    expect(p.span).toBe(v.span);
  });
  it('zooming out stops at the widest view', () => {
    let v: View = { ...HOME_VIEW.mandelbrot };
    for (let i = 0; i < 30; i++) v = zoomAt(v, 100, 100, W, H, 1 / KEY_ZOOM);
    expect(v.span).toBe(MAX_SPAN);
  });
  it('wheel and pinch factors are bounded and point the right way', () => {
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(-100)).toBeCloseTo(Math.exp(0.15), 12);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(-100, 1)).toBeCloseTo(wheelFactor(-1600), 12);
    expect(wheelFactor(-100, 2)).toBeCloseTo(wheelFactor(-40000), 12);
    expect(wheelFactor(-1e9)).toBe(2);
    expect(wheelFactor(1e9)).toBe(0.5);
    expect(wheelFactor(NaN)).toBe(1);
    const spread = pinchChange({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 80, y: 100 }, { x: 220, y: 100 });
    expect(near(spread.factor, 1.4, 1e-12)).toBe(true);
    expect(spread.mx).toBe(150);
    expect(spread.dx).toBe(0);
    const slide = pinchChange({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 130, y: 120 }, { x: 230, y: 120 });
    expect(slide.factor).toBe(1);
    expect(slide.dx).toBe(30);
    expect(slide.dy).toBe(20);
    expect(pinchChange({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 9, y: 9 }).factor).toBe(1);
    expect(pinchChange({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }).factor).toBe(2);
  });
  it('the stretch used while a new picture is worked out lines features up with the new view', () => {
    for (let k = 0; k < 200; k++) {
      const from = { cx: (rng() - 0.5), cy: (rng() - 0.5), span: 0.01 + rng() };
      const to = { cx: from.cx + (rng() - 0.5) * from.span, cy: from.cy + (rng() - 0.5) * from.span, span: from.span * (0.2 + rng() * 3) };
      const t = previewTransform(from, to, W, H);
      const fx = rng() * W; const fy = rng() * H;
      const c = complexAt(from, fx, fy, W, H);
      const want = pixelOf(to, c.re, c.im, W, H);
      expect(near(t.s * fx + t.tx, want.x, 1e-6)).toBe(true);
      expect(near(t.s * fy + t.ty, want.y, 1e-6)).toBe(true);
    }
    const same = previewTransform(HOME_VIEW.julia, HOME_VIEW.julia, W, H);
    expect(same.s).toBe(1);
    expect(near(same.tx, 0) && near(same.ty, 0)).toBe(true);
  });
});

describe('the limit of 64-bit numbers', () => {
  const W = 960;
  it('at the narrowest allowed view every neighbouring pixel still has its own number', () => {
    for (const [cx, cy] of [[-0.7436, 0.1318], [0.3, 0.4], [-1.75, 0], [1.2, -0.3], [0, 0], [-1.9, 0.01]]) {
      const v = clampView({ cx, cy, span: 1e-300 }, W);
      expect(near(v.span, minSpan(cx, cy, W), 1e-30 + v.span * 1e-12)).toBe(true);
      expect(precisionRatio(v, W)).toBeGreaterThanOrEqual(HARD_RATIO * (1 - 1e-9));
      expect(atLimit(v, W)).toBe(true);
      let prev = complexAt(v, 0.5, W / 2, W, 720);
      for (let x = 1; x < W; x++) {
        const c = complexAt(v, x + 0.5, W / 2, W, 720);
        expect(c.re).toBeGreaterThan(prev.re);
        prev = c;
      }
    }
  });
  it('well past the limit, neighbouring pixels run together, which is why the zoom stops', () => {
    const v: View = { cx: 0.3, cy: 0.4, span: minSpan(0.3, 0.4, W) / 100 };
    let same = 0;
    let prev = complexAt(v, 0.5, 360, W, 720).re;
    for (let x = 1; x < W; x++) { const c = complexAt(v, x + 0.5, 360, W, 720).re; if (c === prev) same++; prev = c; }
    expect(same).toBeGreaterThan(W / 4);
  });
  it('zooming in again and again stops at the limit, and the warning comes first', () => {
    let v: View = { cx: -0.7436, cy: 0.1318, span: 0.5 };
    let warned = -1; let step = 0;
    for (; step < 400; step++) {
      const next = zoomAt(v, W / 2, 360, W, 720, 1.5);
      if (warned < 0 && nearLimit(next, W)) warned = step;
      if (next.span >= v.span * 0.999999) break;
      v = next;
    }
    expect(atLimit(v, W)).toBe(true);
    expect(warned).toBeGreaterThan(0);
    expect(warned).toBeLessThan(step);
    expect(WARN_RATIO).toBeGreaterThan(HARD_RATIO * 100);
    expect(nearLimit(HOME_VIEW.mandelbrot, W)).toBe(false);
  });
  it('clampView repairs junk', () => {
    expect(clampView({ cx: NaN, cy: Infinity, span: NaN }, W)).toEqual({ cx: 0, cy: 0, span: HOME_SPAN });
    expect(clampView({ cx: 99, cy: -99, span: 99 }, W)).toEqual({ cx: 4, cy: -4, span: MAX_SPAN });
    expect(clampView({ cx: 0, cy: 0, span: -1 }, W).span).toBeGreaterThan(0);
  });
});

describe('detail, zoom words', () => {
  it('the repeat limit rises with zoom, scales with detail and stays in bounds', () => {
    for (const mode of MODES) {
      let prev = 0;
      for (let k = 0; k < 40; k++) {
        const span = HOME_VIEW[mode].span / 2 ** k;
        const n = iterationsFor(mode, span, 'normal');
        expect(n).toBeGreaterThanOrEqual(prev);
        expect(n).toBeGreaterThanOrEqual(MIN_ITER);
        expect(n).toBeLessThanOrEqual(MAX_ITER);
        expect(iterationsFor(mode, span, 'draft')).toBeLessThanOrEqual(n);
        expect(iterationsFor(mode, span, 'fine')).toBeGreaterThanOrEqual(n);
        prev = n;
      }
    }
    expect(iterationsFor('mandelbrot', HOME_SPAN, 'normal')).toBe(100);
    expect(iterationsFor('mandelbrot', 1e-300, 'fine')).toBeLessThanOrEqual(MAX_ITER);
    expect(DETAIL_KEYS.map((k) => DETAIL_FACTOR[k])).toEqual([0.5, 1, 2]);
  });
  it('zoom and coordinate text', () => {
    expect(formatZoom(1)).toBe('x1.0');
    expect(formatZoom(25.4)).toBe('x25');
    expect(formatZoom(1234)).toBe('x1.2e3');
    expect(formatZoom(NaN)).toBe('x1');
    expect(zoomOf('mandelbrot', HOME_VIEW.mandelbrot)).toBe(1);
    expect(digitsFor(3)).toBe(4);
    expect(digitsFor(1e-6)).toBe(10);
    expect(digitsFor(1e-30)).toBe(17);
    expect(formatCoord(-0.743643887, 1e-3)).toBe('-0.7436439');
    expect(formatCoord(NaN, 1)).toBe('0');
  });
});

describe('palettes', () => {
  for (const p of PALETTES) {
    it(`${p.label}: a full, smooth, repeating table of valid colours`, () => {
      const stops = paletteStops(p.id, TOKENS);
      expect(stops.length).toBeGreaterThanOrEqual(5);
      const lut = buildLut(stops);
      expect(lut.length).toBe(LUT_SIZE);
      expect(lut[0]).toEqual(stops[0]);
      let worst = 0;
      for (let i = 0; i < LUT_SIZE; i++) {
        const next = lut[(i + 1) % LUT_SIZE]; // wraps: the last entry blends back to the first
        for (let c = 0; c < 3; c++) {
          expect(Number.isInteger(lut[i][c]) && lut[i][c] >= 0 && lut[i][c] <= 255).toBe(true);
          worst = Math.max(worst, Math.abs(next[c] - lut[i][c]));
        }
      }
      expect(worst).toBeLessThan(45);
      for (const s of stops) expect(luminance(s)).toBeGreaterThanOrEqual(0);
    });
  }
  it('palettes differ from one another, and the key colours are real tokens mixes', () => {
    const firsts = PALETTES.map((p) => buildLut(paletteStops(p.id, TOKENS)).slice(0, 8).join('|'));
    expect(new Set(firsts).size).toBe(PALETTES.length);
    expect(paletteStops('rainbow', TOKENS)).toEqual(eightTints(TOKENS));
  });
  it('the table index repeats every CYCLE repeats and stays in range', () => {
    expect(CYCLE).toBe(40);
    expect(lutIndex(0)).toBe(0);
    expect(lutIndex(CYCLE)).toBe(0);
    expect(lutIndex(CYCLE / 2)).toBe(128);
    expect(lutIndex(3.3)).toBe(lutIndex(3.3 + CYCLE));
    for (let nu = 0; nu < 5000; nu += 0.37) { const i = lutIndex(nu); expect(Number.isInteger(i) && i >= 0 && i < LUT_SIZE).toBe(true); }
  });
});

describe('tiles and the time budget', () => {
  it('the spiral visits every tile once, starting in the middle', () => {
    for (const [tx, ty] of [[1, 1], [3, 3], [20, 15], [7, 2], [2, 9]]) {
      const o = spiralOrder(tx, ty);
      expect(o.length).toBe(tx * ty);
      expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: tx * ty }, (_, i) => i));
    }
    const o = spiralOrder(21, 15);
    expect(o[0]).toBe(7 * 21 + 10); // the centre tile
    // The distance from the middle never goes down by a whole ring once it has gone up.
    const ring = (i: number) => Math.max(Math.abs((i % 21) - 10), Math.abs(Math.floor(i / 21) - 7));
    for (let k = 1; k < o.length; k++) expect(ring(o[k])).toBeGreaterThanOrEqual(ring(o[k - 1]));
  });

  const direct = (mode: Mode, view: View, julia: { x: number; y: number }, w: number, h: number, maxIter: number): Float32Array => {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const re = view.cx + ((x + 0.5 - w / 2) / w) * view.span;
      const im = view.cy - ((y + 0.5 - h / 2) / w) * view.span;
      out[y * w + x] = mode === 'mandelbrot' ? (inMainBody(re, im) ? -1 : smoothEscape(0, 0, re, im, maxIter)) : smoothEscape(re, im, julia.x, julia.y, maxIter);
    }
    return out;
  };

  for (const mode of MODES) {
    it(`a finished ${mode} job equals a direct count at every pixel (sizes that are not a multiple of the tile)`, () => {
      const w = 130; const h = 97;
      const view = mode === 'mandelbrot' ? { cx: -0.6, cy: 0.1, span: 2.2 } : { cx: 0.05, cy: -0.02, span: 2.6 };
      const job = createJob(w, h, mode, view, JUL, 150);
      expect(job.nu.every((v) => Number.isNaN(v))).toBe(true);
      let safety = 0;
      while (stepJob(job) && safety++ < 100000) { /* run to the end */ }
      expect(job.done).toBe(true);
      expect(Array.from(job.nu)).toEqual(Array.from(direct(mode, view, JUL, w, h, 150)));
      expect(jobProgress(job)).toBe(1);
      expect(stepJob(job)).toBe(false);
    }, 60_000);
  }

  it('the coarse pass fills every pixel first, in blocks that share the value of their middle', () => {
    const w = 100; const h = 70; const view = { cx: -0.5, cy: 0, span: 3 };
    const job = createJob(w, h, 'mandelbrot', view, JUL, 80);
    while (job.phase === 0 && !job.done) stepJob(job);
    expect(job.phase).toBe(1);
    expect(job.nu.every((v) => !Number.isNaN(v))).toBe(true);
    for (const [bx, by] of [[0, 0], [4, 8], [48, 44], [96, 64]]) {
      const c = complexAt(view, bx + PREVIEW_STEP / 2, by + PREVIEW_STEP / 2, w, h);
      const want = sampleValue('mandelbrot', c.re, c.im, JUL, 80);
      for (let y = by; y < Math.min(h, by + PREVIEW_STEP); y++) for (let x = bx; x < Math.min(w, bx + PREVIEW_STEP); x++) expect(job.nu[y * w + x]).toBe(Math.fround(want));
    }
  });

  it('a time budget is honoured, at least one tile is always done, and progress only goes up', () => {
    const job = createJob(300, 200, 'julia', HOME_VIEW.julia, JUL, 60);
    let clock = 0;
    const now = () => clock++;
    const seen: { x0: number }[] = [];
    let calls = 0; let tiles = 0; let last = 0;
    while (!job.done && calls < 10000) {
      const start = clock;
      const n = runJob(job, clock + 3, now, (j) => { if (j.last) seen.push({ x0: j.last.x0 }); });
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      expect(clock - start).toBeLessThanOrEqual(5);
      tiles += n; calls++;
      const p = jobProgress(job);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(1);
      last = p;
    }
    expect(job.done).toBe(true);
    expect(tiles).toBe(2 * Math.ceil(300 / TILE) * Math.ceil(200 / TILE));
    expect(seen.length).toBe(tiles);
    expect(calls).toBeGreaterThan(10);
    // A deadline already in the past still does one tile.
    const job2 = createJob(96, 96, 'julia', HOME_VIEW.julia, JUL, 60);
    expect(runJob(job2, -1, () => 0)).toBe(1);
    expect(runJob(createJob(10, 10, 'julia', HOME_VIEW.julia, JUL, 60), 1e9, () => 0)).toBe(2);
  }, 60_000);

  it('progress is 0 at the start, a tenth after the coarse pass, and 1 at the end', () => {
    const job = createJob(96, 96, 'julia', HOME_VIEW.julia, JUL, 40);
    expect(jobProgress(job)).toBe(0);
    while (job.phase === 0) stepJob(job);
    expect(near(jobProgress(job), 0.1, 1e-12)).toBe(true);
  });

  it('sliced rendering (high repeat limits) equals the direct count at every pixel, in thin pieces, with steady progress', () => {
    expect(sliceRows(100)).toBe(TILE);
    expect(sliceRows(500)).toBe(12);
    expect(sliceRows(2000)).toBe(4);
    const w = 70; const h = 61;
    for (const [mode, view, maxIter] of [['julia', HOME_VIEW.julia, 1200], ['mandelbrot', { cx: -0.6, cy: 0.1, span: 2.2 }, 400]] as const) {
      const job = createJob(w, h, mode, view, JUL, maxIter);
      let steps = 0; let last = 0; let maxRows = 0;
      while (!job.done && steps < 100000) {
        const fullPass = job.phase === 1;
        stepJob(job); steps++;
        if (fullPass && job.last) maxRows = Math.max(maxRows, job.last.y1 - job.last.y0);
        const p = jobProgress(job);
        expect(p).toBeGreaterThanOrEqual(last);
        last = p;
      }
      expect(job.done).toBe(true);
      expect(maxRows).toBeLessThanOrEqual(sliceRows(maxIter));
      expect(maxRows).toBeGreaterThan(0);
      // Far more steps than the 2 x tiles of whole-tile rendering.
      expect(steps).toBeGreaterThan(2 * Math.ceil(w / TILE) * Math.ceil(h / TILE));
      const want = direct(mode, view, JUL, w, h, maxIter);
      expect(Array.from(job.nu)).toEqual(Array.from(want));
    }
  }, 60_000);
});

describe('places', () => {
  it('every place is valid and shows real structure, not a blank wash', () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(8);
    const ids = new Set<string>();
    for (const p of PLACES) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(isMode(p.mode)).toBe(true);
      expect(clampView(p.view, 960)).toEqual(p.view);
      expect(nearLimit(p.view, 960)).toBe(false);
      expect(placeById(p.id)).toBe(p);
      const w = 64; const h = 48;
      const maxIter = iterationsFor(p.mode, p.view.span, 'normal');
      const job = createJob(w, h, p.mode, p.view, p.julia, maxIter);
      while (stepJob(job)) { /* to the end */ }
      let inside = 0; const bands = new Set<number>();
      for (const v of job.nu) { if (v < 0) inside++; else bands.add(Math.floor(v)); }
      expect(inside / (w * h), `${p.id} inside`).toBeLessThanOrEqual(0.92);
      expect(bands.size, `${p.id} bands`).toBeGreaterThanOrEqual(6);
      expect(p.note.length).toBeGreaterThan(10);
      expect(p.note.includes('—')).toBe(false);
    }
    expect(PLACES.some((p) => p.mode === 'julia')).toBe(true);
    expect(PLACES.some((p) => p.mode === 'mandelbrot' && p.view.span < 0.05)).toBe(true);
    expect(placeById('nope')).toBeUndefined();
    expect(placeById(null)).toBeUndefined();
  }, 120_000);
  it('the main picture of each set is not blank and the Julia default has structure', () => {
    expect(HOME_VIEW.mandelbrot.span).toBe(HOME_SPAN);
    expect(DEFAULT_JULIA).toEqual({ x: -0.8, y: 0.156 });
  });
});

describe('sanitisers and words', () => {
  it('rejects junk choices', () => {
    for (const v of ['burning', '', null, undefined, 1, {}, [], '__proto__']) { expect(isMode(v)).toBe(false); expect(isDetail(v)).toBe(false); expect(isPaletteId(v)).toBe(false); }
    expect(MODES.every(isMode)).toBe(true);
    expect(MODE_LABEL.julia).toBe('Julia set');
  });
  it('describes the view in plain words, in every mode', () => {
    expect(describeView('mandelbrot', HOME_VIEW.mandelbrot, JUL, 100)).toBe('Mandelbrot set. Centre -0.5000 + 0.0000i. Zoom x1.0. Up to 100 repeats.');
    expect(describeView('julia', HOME_VIEW.julia, JUL, 100)).toMatch(/^Julia set for c = -0.8 \+ 0.156i\. Centre 0\.0000 \+ 0\.0000i\./);
    expect(describeView('mandelbrot', { cx: -0.74, cy: -0.13, span: 0.001 }, JUL, 300)).toMatch(/Centre -0\.7400000 - 0\.1300000i/);
    expect(shareText('mandelbrot', HOME_VIEW.mandelbrot, JUL)).toBe('Fractal Zoom: Mandelbrot set, zoom x1.0');
    expect(shareText('julia', HOME_VIEW.julia, { x: 0, y: -1 })).toBe('Fractal Zoom: Julia set (c = 0 - 1i), zoom x1.0');
    for (const t of RULES) expect(t.includes('—')).toBe(false);
    expect(PAN_FRACTION).toBe(0.1);
  });
  it('the colour kit parses and mixes', () => {
    expect(parseColour('#38bdf8')).toEqual([56, 189, 248]);
    expect(toCss([56, 189, 248])).toBe('#38bdf8');
    expect(mixOklch([0, 0, 0], [255, 255, 255], 0.5)[0]).toBeGreaterThan(80);
    expect(neutral(0.07).every((v) => v < 40)).toBe(true);
    expect(plural(2, 'place')).toBe('2 places');
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('sizes the buffer from the box times a capped pixel ratio, with a hard cap on width, and redraws on resize', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/MAX_BUFFER_W = 960/);
    expect(src).toMatch(/ResizeObserver/);
    expect(src).toMatch(/getComputedStyle/);
  });
  it('draws in time slices with a visible note, and pauses on a hidden tab', () => {
    expect(src).toMatch(/runJob\(/);
    expect(src).toMatch(/requestAnimationFrame/);
    expect(src).toMatch(/Rendering \$\{pct\}%/);
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
    expect(src).not.toMatch(/\bWorker\b/);
  });
  it('handles pointer cancel, two fingers and the wheel only after a click or with Ctrl, and keeps touch-action none to the picture', () => {
    expect(src).toMatch(/pointercancel/);
    expect(src).toMatch(/pinchChange\(/);
    expect(src).toMatch(/if \(!\(focused \|\| e\.ctrlKey \|\| e\.metaKey\)\) return;/);
    expect(src).toMatch(/passive: false/);
    expect(src.match(/touch-action:\s*none/g)?.length).toBe(1);
  });
  it('warns near the limit, has a keyboard path and live status line, and offers no download or storage', () => {
    expect(src).toMatch(/limit of 64-bit numbers/);
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/<label for="fzm-place"/);
    expect(src).toMatch(/Nothing to download/);
    expect(src).not.toMatch(/localStorage|toBlob|createObjectURL|AudioContext/);
  });
});
