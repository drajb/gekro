/**
 * games-kaleidoscope.test.ts - the engine behind `kaleidoscope`.
 *
 * Pinned:
 *  - the copy transforms: copyMatrix and the polar symmetryPoints both match explicit rotation and
 *    reflection matrices built here, for 6, 8 and 12 folds with and without the mirror; the images of
 *    a point are closed under the group, keep their distance from the middle, and number n or 2n
 *    (fewer on the axis and at the middle),
 *  - smoothing: n pieces for n points, joined end to end, the quadratic midpoint formula, tangent
 *    continuity at joins, and the first n - 1 pieces never change when a point is added (so live
 *    drawing and a redraw give the same curve),
 *  - rainbow colouring along the stroke length and the grouping of pieces into runs,
 *  - the undo history (round trips, redo cleared by a new stroke, the cap),
 *  - the point filter and the size limits, the view mapping, the demo strokes, the sanitisers,
 *  - and the claims the page source makes (capped pixel ratio, pointer cancel, touch-action, theme).
 */
import { describe, it, expect } from 'vitest';
import {
  FOLDS, DEFAULT_FOLD, isFold, copyCount, copyMatrix, applyMatrix, symmetryPoints, viewOf, toUnit, fromUnit, clampUnit,
  RAINBOW, PALETTE_SIZE, isColour, COLOUR_NAMES, WIDTH_KEYS, WIDTHS, isWidthKey, MIN_STEP, MAX_POINTS_STROKE, MAX_POINTS_TOTAL,
  MAX_STROKES, HISTORY_LIMIT, shouldAdd, totalPoints, hasRoom, tryAddPoint, strokeSegments, settledCount, segmentAt,
  RAINBOW_LEN, segmentColours, colourRuns, newHistory, canUndo, canRedo, commit, undo, redo, moveCursor, CURSOR_STEP,
  demoStrokes, foldSummary, shareText, strokeLabel, RULES, mulberry32, parseColour, toCss, mixOklch, eightTints, TINT_NAMES,
  luminance, neutral, plural, advance,
  type Pt, type Stroke, type Fold,
} from '../src/components/apps-private/kaleidoscope/helpers';
import calculatorSource from '../src/components/apps-private/kaleidoscope/Calculator.astro?raw';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const mk = (pts: Pt[], over: Partial<Stroke> = {}): Stroke => ({ c: 0, w: 'medium', n: 8, mirror: false, pts, ...over });
const line = (n: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: i * 0.05, y: 0.1 * Math.sin(i / 3) }));

// An explicit 2 x 2 matrix reference, written out here and not taken from the engine.
const rot = (theta: number): number[][] => [[Math.cos(theta), -Math.sin(theta)], [Math.sin(theta), Math.cos(theta)]];
const mul = (m: number[][], v: number[]): number[] => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
const FLIP = [[1, 0], [0, -1]];

describe('symmetry: copies match explicit rotation and reflection matrices', () => {
  const rng = mulberry32(11);
  for (const n of FOLDS) {
    for (const mirror of [false, true]) {
      it(`${n}-fold, mirror ${mirror}: copyMatrix and symmetryPoints equal the reference`, () => {
        const cx = 300, cy = 250, scale = 200;
        for (let trial = 0; trial < 20; trial++) {
          const u = { x: rng() * 2 - 1, y: rng() * 2 - 1 };
          const px = { x: cx + scale * u.x, y: cy + scale * u.y };
          const images = symmetryPoints(px, cx, cy, n, mirror);
          expect(images.length).toBe(copyCount(n, mirror));
          for (let k = 0; k < images.length; k++) {
            const reflected = mirror && k >= n;
            const turn = reflected ? k - n : k;
            let v = [u.x, u.y];
            if (reflected) v = mul(FLIP, v);
            v = mul(rot((2 * Math.PI * turn) / n), v);
            const want = { x: cx + scale * v[0], y: cy + scale * v[1] };
            const viaMatrix = applyMatrix(copyMatrix(k, n, mirror, cx, cy, scale), u);
            expect(near(viaMatrix.x, want.x, 1e-9)).toBe(true);
            expect(near(viaMatrix.y, want.y, 1e-9)).toBe(true);
            expect(near(images[k].x, want.x, 1e-9)).toBe(true);
            expect(near(images[k].y, want.y, 1e-9)).toBe(true);
          }
        }
      });
    }
  }

  it('copy 0 is the identity and copy n (mirror) is the reflection across the horizontal axis through the middle', () => {
    const id = copyMatrix(0, 8, true, 10, 20, 5);
    expect(applyMatrix(id, { x: 0.3, y: -0.7 })).toEqual({ x: 10 + 1.5, y: 20 - 3.5 });
    const flip = applyMatrix(copyMatrix(8, 8, true, 10, 20, 5), { x: 0.3, y: -0.7 });
    expect(near(flip.x, 11.5)).toBe(true);
    expect(near(flip.y, 20 + 3.5)).toBe(true);
  });

  it('the images are closed under the group: the image set of any image is the same set', () => {
    const sig = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
    const rng2 = mulberry32(5);
    for (const n of FOLDS) for (const mirror of [false, true]) {
      const p = { x: 100 + rng2() * 200, y: 100 + rng2() * 200 };
      const base = sig(symmetryPoints(p, 200, 200, n, mirror));
      for (const q of symmetryPoints(p, 200, 200, n, mirror)) expect(sig(symmetryPoints(q, 200, 200, n, mirror))).toEqual(base);
    }
  });

  it('every image keeps its distance from the middle, and a turn by 2 pi / n maps the set to itself', () => {
    const p = { x: 330, y: 170 };
    for (const n of FOLDS) {
      const imgs = symmetryPoints(p, 200, 200, n, false);
      const r0 = Math.hypot(p.x - 200, p.y - 200);
      for (const q of imgs) expect(near(Math.hypot(q.x - 200, q.y - 200), r0, 1e-9)).toBe(true);
      const turned = imgs.map((q) => {
        const v = mul(rot((2 * Math.PI) / n), [q.x - 200, q.y - 200]);
        return `${(200 + v[0]).toFixed(6)},${(200 + v[1]).toFixed(6)}`;
      }).sort();
      expect(turned).toEqual(imgs.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`).sort());
    }
  });

  it('counts distinct images: n or 2n in general, fewer on the mirror axis, one at the middle', () => {
    const distinct = (pts: Pt[]) => new Set(pts.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`)).size;
    for (const n of FOLDS) {
      expect(distinct(symmetryPoints({ x: 330, y: 170 }, 200, 200, n, false))).toBe(n);
      expect(distinct(symmetryPoints({ x: 330, y: 170 }, 200, 200, n, true))).toBe(2 * n);
      expect(distinct(symmetryPoints({ x: 330, y: 200 }, 200, 200, n, true))).toBe(n); // on the axis
      expect(distinct(symmetryPoints({ x: 200, y: 200 }, 200, 200, n, true))).toBe(1); // at the middle
    }
  });

  it('with mirror on, the picture is symmetrical top to bottom', () => {
    const imgs = symmetryPoints({ x: 310, y: 120 }, 200, 200, 6, true);
    const keys = new Set(imgs.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`));
    for (const p of imgs) expect(keys.has(`${p.x.toFixed(5)},${(400 - p.y).toFixed(5)}`)).toBe(true);
  });
});

describe('view, clamp and the point filter', () => {
  it('maps pixels to unit coordinates and back, and the middle is 0,0', () => {
    const v = viewOf(640, 480);
    expect(v.cx).toBe(320);
    expect(v.cy).toBe(240);
    expect(v.scale).toBeCloseTo(240 * 0.98, 9);
    expect(toUnit(320, 240, v)).toEqual({ x: 0, y: 0 });
    for (const [x, y] of [[0, 0], [100, 50], [640, 480], [321.5, 7]]) {
      const back = fromUnit(toUnit(x, y, v), v);
      expect(near(back.x, x)).toBe(true);
      expect(near(back.y, y)).toBe(true);
    }
  });
  it('clampUnit keeps points inside the circle and repairs junk', () => {
    expect(clampUnit({ x: 0.3, y: 0.4 })).toEqual({ x: 0.3, y: 0.4 });
    const c = clampUnit({ x: 30, y: 40 }, 1.15);
    expect(near(Math.hypot(c.x, c.y), 1.15)).toBe(true);
    expect(c.x / c.y).toBeCloseTo(0.75, 9);
    expect(clampUnit({ x: NaN, y: 1 })).toEqual({ x: 0, y: 0 });
    expect(clampUnit({ x: Infinity, y: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('shouldAdd and tryAddPoint thin the points and respect both limits', () => {
    expect(shouldAdd(undefined, { x: 0, y: 0 })).toBe(true);
    expect(shouldAdd({ x: 0, y: 0 }, { x: MIN_STEP / 2, y: 0 })).toBe(false);
    expect(shouldAdd({ x: 0, y: 0 }, { x: MIN_STEP, y: 0 })).toBe(true);
    const pts: Pt[] = [];
    expect(tryAddPoint(pts, { x: 0, y: 0 }, [])).toBe(true);
    expect(tryAddPoint(pts, { x: 0.001, y: 0 }, [])).toBe(false);
    expect(tryAddPoint(pts, { x: 50, y: 50 }, [])).toBe(true);
    expect(Math.hypot(pts[1].x, pts[1].y)).toBeLessThanOrEqual(1.15 + 1e-9);
    const full: Pt[] = Array.from({ length: MAX_POINTS_STROKE }, (_, i) => ({ x: (i % 100) * 0.01, y: Math.floor(i / 100) * 0.01 }));
    expect(tryAddPoint(full, { x: 0.9, y: 0.9 }, [])).toBe(false);
    const big = [mk(Array.from({ length: MAX_POINTS_TOTAL }, () => ({ x: 0, y: 0 })))];
    expect(tryAddPoint([], { x: 0.1, y: 0.1 }, big)).toBe(false);
    expect(hasRoom(big)).toBe(false);
    expect(hasRoom([])).toBe(true);
    expect(hasRoom(Array.from({ length: MAX_STROKES }, () => mk([{ x: 0, y: 0 }])))).toBe(false);
    expect(totalPoints([mk(line(5)), mk(line(7))])).toBe(12);
  });
});

describe('smoothing', () => {
  it('gives n pieces for n points, starting and ending on the first and last point', () => {
    expect(strokeSegments([])).toEqual([]);
    expect(strokeSegments([{ x: 0.2, y: 0.3 }]).length).toBe(1);
    for (const n of [2, 3, 4, 10, 57]) {
      const pts = line(n);
      const segs = strokeSegments(pts);
      expect(segs.length).toBe(n);
      expect(segs[0].x0).toBe(pts[0].x);
      expect(segs[0].y0).toBe(pts[0].y);
      expect(segs[n - 1].x1).toBe(pts[n - 1].x);
      expect(segs[n - 1].y1).toBe(pts[n - 1].y);
    }
  });
  it('pieces join end to end and the curve is smooth at each join', () => {
    const pts: Pt[] = Array.from({ length: 40 }, (_, i) => ({ x: 0.8 * Math.cos(i / 6), y: 0.8 * Math.sin(i / 6) }));
    const segs = strokeSegments(pts);
    for (let i = 0; i + 1 < segs.length; i++) {
      expect(near(segs[i].x1, segs[i + 1].x0)).toBe(true);
      expect(near(segs[i].y1, segs[i + 1].y0)).toBe(true);
    }
    // The tangent into a join and out of it are parallel (cross product zero), so there are no corners.
    for (let i = 1; i + 1 < segs.length - 1; i++) {
      const a = segs[i]; const b = segs[i + 1];
      const t1 = { x: a.x1 - a.cx, y: a.y1 - a.cy };
      const t2 = { x: b.cx - b.x0, y: b.cy - b.y0 };
      const cross = t1.x * t2.y - t1.y * t2.x;
      expect(Math.abs(cross)).toBeLessThan(1e-9);
      expect(t1.x * t2.x + t1.y * t2.y).toBeGreaterThan(0);
    }
  });
  it('a quadratic piece follows the Bezier formula (t = 0.5 is a quarter, a half and a quarter) and a line is linear', () => {
    const segs = strokeSegments([{ x: 0, y: 0 }, { x: 0.4, y: 0.2 }, { x: 0.8, y: -0.2 }, { x: 0.9, y: 0.5 }]);
    const q = segs[1];
    expect(q.kind).toBe('quad');
    const m = segmentAt(q, 0.5);
    expect(near(m.x, 0.25 * q.x0 + 0.5 * q.cx + 0.25 * q.x1)).toBe(true);
    expect(near(m.y, 0.25 * q.y0 + 0.5 * q.cy + 0.25 * q.y1)).toBe(true);
    expect(segmentAt(q, 0)).toEqual({ x: q.x0, y: q.y0 });
    expect(segmentAt(q, 1)).toEqual({ x: q.x1, y: q.y1 });
    const l = segs[0];
    expect(l.kind).toBe('line');
    expect(segmentAt(l, 0.5)).toEqual({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2 });
  });
  it('points on a straight line give a straight curve', () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ x: -0.5 + i * 0.07, y: 0.2 + i * 0.07 * 0.5 }));
    for (const s of strokeSegments(pts)) {
      for (const t of [0, 0.3, 0.7, 1]) {
        const p = segmentAt(s, t);
        expect(near(p.y, 0.2 + (p.x + 0.5) * 0.5, 1e-9)).toBe(true);
      }
    }
  });
  it('the first n - 1 pieces never change when a point is added, so live drawing equals a redraw', () => {
    const pts = line(30);
    for (let k = 2; k < 29; k++) {
      const a = strokeSegments(pts.slice(0, k));
      const b = strokeSegments(pts.slice(0, k + 1));
      expect(a.length).toBe(k);
      expect(settledCount(k)).toBe(k - 1);
      expect(a.slice(0, settledCount(k))).toEqual(b.slice(0, settledCount(k)));
    }
    expect(settledCount(0)).toBe(0);
    expect(settledCount(1)).toBe(0);
  });
});

describe('rainbow and colour runs', () => {
  it('a fixed colour gives that colour for every piece', () => {
    expect(segmentColours(line(9), 3)).toEqual(Array(9).fill(3));
  });
  it('rainbow steps through all eight colours by length, starting at colour 0', () => {
    const pts: Pt[] = Array.from({ length: 400 }, (_, i) => ({ x: 0.8 * Math.cos(i * 0.02), y: 0.8 * Math.sin(i * 0.02) }));
    const cols = segmentColours(pts, RAINBOW);
    expect(cols.length).toBe(strokeSegments(pts).length);
    expect(cols[0]).toBe(0);
    for (let i = 1; i < cols.length; i++) {
      const d = (cols[i] - cols[i - 1] + PALETTE_SIZE) % PALETTE_SIZE;
      expect(d === 0 || d === 1).toBe(true); // never skips a colour
    }
    expect(new Set(cols).size).toBe(PALETTE_SIZE);
    // Independent check of the first change: cumulative length crosses RAINBOW_LEN.
    let cum = 0;
    let firstChange = -1;
    for (let i = 1; i < pts.length && firstChange < 0; i++) {
      cum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (cum >= RAINBOW_LEN) firstChange = i;
    }
    expect(cols.findIndex((c) => c === 1)).toBe(firstChange);
  });
  it('colourRuns covers every piece exactly once, in order, merging equal neighbours', () => {
    const runs = colourRuns([2, 2, 5, 5, 5, 1, 2, 2]);
    expect(runs).toEqual([{ c: 2, from: 0, to: 2 }, { c: 5, from: 2, to: 5 }, { c: 1, from: 5, to: 6 }, { c: 2, from: 6, to: 8 }]);
    expect(colourRuns([])).toEqual([]);
    const cols = segmentColours(line(200), RAINBOW);
    const r = colourRuns(cols);
    expect(r[0].from).toBe(0);
    expect(r[r.length - 1].to).toBe(cols.length);
    for (let i = 1; i < r.length; i++) expect(r[i].from).toBe(r[i - 1].to);
  });
});

describe('undo history', () => {
  const a = mk(line(4)); const b = mk(line(5)); const c = mk(line(6));
  it('undo and redo are exact round trips and a new stroke clears redo', () => {
    let h = newHistory();
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    h = commit(h, [a]);
    h = commit(h, [a, b]);
    h = commit(h, [a, b, c]);
    const full = h.present;
    const back = undo(undo(h));
    expect(back.present).toEqual([a]);
    expect(canRedo(back)).toBe(true);
    expect(redo(redo(back)).present).toBe(full);
    const forked = commit(back, [a, c]);
    expect(canRedo(forked)).toBe(false);
    expect(forked.present).toEqual([a, c]);
  });
  it('keeps at most HISTORY_LIMIT pictures to go back to', () => {
    let h = newHistory();
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) h = commit(h, [mk(line(2 + (i % 3)))]);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    let steps = 0;
    while (canUndo(h)) { h = undo(h); steps++; }
    expect(steps).toBe(HISTORY_LIMIT);
  });
  it('random operation sequences never break the invariants', () => {
    const rng = mulberry32(99);
    let h = newHistory();
    for (let i = 0; i < 3000; i++) {
      const r = rng();
      if (r < 0.5) h = commit(h, [...h.present.slice(0, 5), mk(line(2 + Math.floor(rng() * 6)))]);
      else if (r < 0.75) h = undo(h);
      else h = redo(h);
      expect(h.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
      expect(Array.isArray(h.present)).toBe(true);
    }
  });
});

describe('keyboard cursor, demo and sanitisers', () => {
  it('the cursor moves by the step and stays inside the circle', () => {
    expect(moveCursor({ x: 0, y: 0 }, CURSOR_STEP, 0)).toEqual({ x: CURSOR_STEP, y: 0 });
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 100; i++) p = moveCursor(p, CURSOR_STEP, CURSOR_STEP);
    expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1 + 1e-12);
  });
  it('the demo is deterministic, inside the circle, valid and smooth enough to draw', () => {
    const d = demoStrokes();
    expect(JSON.stringify(d)).toBe(JSON.stringify(demoStrokes()));
    expect(d.length).toBe(3);
    for (const s of d) {
      expect(isColour(s.c)).toBe(true);
      expect(isWidthKey(s.w)).toBe(true);
      expect(isFold(s.n)).toBe(true);
      expect(s.pts.length).toBeGreaterThan(50);
      for (const p of s.pts) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.95 + 1e-9);
      }
    }
    expect(totalPoints(d)).toBeLessThan(MAX_POINTS_TOTAL);
  });
  it('rejects junk settings', () => {
    for (const v of [7, '8', NaN, null, undefined, -6, 0, 12.5, [], {}, '__proto__']) expect(isFold(v)).toBe(false);
    for (const v of [9, -1, 1.5, '1', NaN, null, undefined, {}, []]) expect(isColour(v)).toBe(false);
    for (const v of [0, 4, 8]) expect(isColour(v)).toBe(true);
    for (const v of ['huge', '', null, 1, undefined, {}]) expect(isWidthKey(v)).toBe(false);
    expect(FOLDS).toEqual([6, 8, 12]);
    expect(isFold(DEFAULT_FOLD)).toBe(true);
    expect(COLOUR_NAMES.length).toBe(9);
    expect(COLOUR_NAMES[RAINBOW]).toBe('Rainbow');
    expect(WIDTH_KEYS.map((k) => WIDTHS[k])).toEqual([0.012, 0.026, 0.05]);
  });
});

describe('words and the colour kit', () => {
  it('summaries are plain and correct in every state', () => {
    expect(foldSummary(8, true)).toBe('8-fold with mirror: 16 copies of every stroke');
    expect(foldSummary(6, false)).toBe('6-fold: 6 copies of every stroke');
    expect(shareText(0, 8, false)).toMatch(/blank canvas/);
    expect(shareText(1, 12, true)).toBe('Kaleidoscope: 1 stroke, 12-fold with mirror, 24 copies of each');
    expect(shareText(5, 6, false)).toBe('Kaleidoscope: 5 strokes, 6-fold, 6 copies of each');
    expect(strokeLabel(0)).toBe('No strokes yet');
    expect(strokeLabel(1)).toBe('1 stroke');
    expect(strokeLabel(3)).toBe('3 strokes');
    for (const t of [...RULES, foldSummary(8, true), shareText(2, 8, true)]) expect(t.includes('—')).toBe(false);
  });
  it('the colour kit parses, mixes and gives eight distinct tints', () => {
    expect(parseColour('#38bdf8')).toEqual([56, 189, 248]);
    expect(parseColour('#fff')).toEqual([255, 255, 255]);
    expect(parseColour('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColour('not a colour')).toBeNull();
    expect(parseColour('#12345')).toBeNull();
    expect(toCss([0, 128, 255])).toBe('#0080ff');
    expect(toCss([NaN, 300, -4])).toBe('#00ff00');
        const tints = eightTints({ sky: [56, 189, 248], green: [52, 211, 153], amber: [251, 191, 36], rose: [248, 113, 113] });
    expect(tints.length).toBe(8);
    expect(new Set(tints.map((t) => t.join(','))).size).toBe(8);
    expect(TINT_NAMES.length).toBe(8);
    expect(mixOklch([10, 20, 30], [200, 100, 50], 0)).toEqual([10, 20, 30]);
    expect(mixOklch([10, 20, 30], [200, 100, 50], 1)).toEqual([200, 100, 50]);
    expect(luminance(neutral(0.9))).toBeGreaterThan(luminance(neutral(0.2)));
    expect(plural(1, 'stroke')).toBe('1 stroke');
    expect(plural(0, 'stroke')).toBe('0 strokes');
  });
  it('advance never fires a burst after a long pause', () => {
    expect(advance(0, 5000, 16).steps).toBeLessThanOrEqual(3);
    expect(advance(0, NaN, 16)).toEqual({ steps: 0, acc: 0 });
    expect(advance(0, -10, 16).steps).toBe(0);
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('sizes the canvas from its box times a capped pixel ratio, redraws on resize and reads colours at run time', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/ResizeObserver/);
    expect(src).toMatch(/getComputedStyle/);
  });
  it('handles pointer cancel and keeps touch-action none to the drawing canvas', () => {
    expect(src).toMatch(/pointercancel/);
    expect(src).toMatch(/isPrimary/);
    expect(src.match(/touch-action:\s*none/g)?.length).toBe(1);
  });
  it('has a live status line, a keyboard path and a reduced-motion path', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/visibilitychange/);
  });
  it('offers no download or storage', () => {
    expect(src).toMatch(/Nothing to download/);
    expect(src).not.toMatch(/localStorage|toBlob|createObjectURL|download=/);
  });
});

// Type use so the import list stays honest.
const _fold: Fold = DEFAULT_FOLD;
void _fold;
