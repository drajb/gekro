/**
 * games-letter-tracer.test.ts - the engine behind `letter-tracer`.
 *
 * Pinned: the 62 guide shapes (A to Z, a to z, 0 to 9) against an independent table of
 * stroke counts; that every stroke is one connected path (no two neighbouring points more
 * than 5 apart), numbered in order (top before bottom, then left before right, the dot of
 * i and j last), and inside the drawing box with the right height for its kind; the
 * tolerance function against a brute-force distance on exact, near and far points; that
 * tracing every shape exactly, and with wobble inside the tolerance, finishes it, while
 * touching only the start and the end, starting in the wrong place or going the wrong way
 * does not; stars (always at least one); the keyboard cursor; the plain-words hints; and
 * that what comes out of localStorage is sanitised before the page sees it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GLYPHS, GROUPS, MAX_GAP, BOX, TOL, START_TOL, DOT_TOL, AHEAD, END_SLACK, SAMPLE_STEP, KEY_STEP, KEY_STEP_BIG, MAX_STARS,
  THREE_STAR_OFF, TWO_STAR_OFF, DEFAULT_GLYPH,
  distance, clampPoint, makePath, pointAt, nearestInWindow, distanceToPath, withinTolerance, canPickUp, advance, isStrokeDone,
  glyphById, startTracer, starsFor, pressDown, dragTo, liftPen, pickUpPoint, strokeShare, letterShare, moveCursor,
  placeWords, directionWords, strokeHint, glyphHint, parseGlyphId, stepGlyph,
  cleanStars, sanitiseStored, toStorable, recordStars, tally, plural, resultSummary,
  type Pt, type Glyph, type Tracer,
} from '../src/components/apps-private/letter-tracer/helpers';

const EM_DASH = String.fromCharCode(0x2014);

/** Small seeded generator for the tests (the engine itself has no randomness). */
const rng32 = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── An independent table, written by hand, of how many strokes each shape has ──
const STROKE_COUNTS: Record<string, number> = {
  A: 3, B: 3, C: 1, D: 2, E: 4, F: 3, G: 1, H: 3, I: 1, J: 1, K: 3, L: 1, M: 3, N: 3, O: 1, P: 2, Q: 2, R: 3, S: 1, T: 2, U: 1, V: 1, W: 1, X: 2, Y: 3, Z: 1,
  a: 2, b: 2, c: 1, d: 2, e: 1, f: 2, g: 2, h: 2, i: 2, j: 2, k: 3, l: 1, m: 3, n: 2, o: 1, p: 2, q: 2, r: 2, s: 1, t: 2, u: 1, v: 1, w: 1, x: 2, y: 2, z: 1,
  0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1,
};
const ALL_IDS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'abcdefghijklmnopqrstuvwxyz', ...'0123456789'];

describe('constants quoted on the content page', () => {
  it('match the spec', () => {
    expect(BOX).toBe(100);
    expect(TOL).toBe(13);
    expect(START_TOL).toBe(16);
    expect(DOT_TOL).toBe(14);
    expect(AHEAD).toBe(30);
    expect(END_SLACK).toBe(5);
    expect(SAMPLE_STEP).toBe(2);
    expect(KEY_STEP).toBe(5);
    expect(KEY_STEP_BIG).toBe(15);
    expect(MAX_STARS).toBe(3);
    expect(MAX_GAP).toBe(5);
    expect(THREE_STAR_OFF).toBe(0.12);
    expect(TWO_STAR_OFF).toBe(0.35);
    expect(DEFAULT_GLYPH).toBe('A');
  });
});

describe('the 62 shapes', () => {
  it('are exactly A to Z, a to z and 0 to 9, each once, in that order', () => {
    expect(GLYPHS.map((g) => g.id)).toEqual(ALL_IDS);
    expect(new Set(GLYPHS.map((g) => g.id)).size).toBe(62);
    expect(GLYPHS).toHaveLength(62);
  });
  it('have the groups the page shows: 26 capitals, 26 small letters, 10 numbers', () => {
    expect(GROUPS.map((g) => [g.key, g.ids.length])).toEqual([['capital', 26], ['small', 26], ['number', 10]]);
    expect(GROUPS.flatMap((g) => g.ids)).toEqual(ALL_IDS);
    for (const g of GLYPHS) {
      const kind = /[A-Z]/.test(g.id) ? 'capital' : /[a-z]/.test(g.id) ? 'small' : 'number';
      expect(g.kind, g.id).toBe(kind);
      expect(g.name).toBe(`${kind} ${g.id}`);
    }
  });
  it('capital I and small l are the same single straight line (the page says so)', () => {
    expect(glyphById('I')!.strokes[0].pts).toEqual(glyphById('l')!.strokes[0].pts);
    expect(glyphById('I')!.strokes).toHaveLength(1);
  });
  it('have the stroke counts of the independent table', () => {
    for (const g of GLYPHS) expect(g.strokes.length, g.id).toBe(STROKE_COUNTS[g.id]);
  });
});

describe('every stroke is one connected path inside the box', () => {
  it('has finite points inside the box (10 to 90 across, 10 to 92 down)', () => {
    for (const g of GLYPHS) for (const s of g.strokes) for (const [x, y] of s.pts) {
      expect(Number.isFinite(x) && Number.isFinite(y), g.id).toBe(true);
      expect(x, `${g.id} x`).toBeGreaterThanOrEqual(10);
      expect(x, `${g.id} x`).toBeLessThanOrEqual(90);
      expect(y, `${g.id} y`).toBeGreaterThanOrEqual(10);
      expect(y, `${g.id} y`).toBeLessThanOrEqual(92);
    }
  });
  it('has no gap of more than 5 between neighbouring points and no repeated point', () => {
    for (const g of GLYPHS) for (const [i, s] of g.strokes.entries()) {
      if (s.dot) continue;
      expect(s.pts.length, `${g.id} stroke ${i + 1}`).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < s.pts.length; k++) {
        const d = distance(s.pts[k - 1], s.pts[k]);
        expect(d, `${g.id} stroke ${i + 1} point ${k}`).toBeLessThanOrEqual(MAX_GAP + 1e-6);
        expect(d, `${g.id} stroke ${i + 1} point ${k}`).toBeGreaterThan(0.3);
      }
    }
  });
  it('has a long enough path for every line stroke (no stroke is accidentally tiny)', () => {
    for (const g of GLYPHS) for (const [i, s] of g.strokes.entries()) {
      if (s.dot) continue;
      expect(makePath(s).length, `${g.id} stroke ${i + 1}`).toBeGreaterThanOrEqual(26);
    }
  });
  it('only i and j have a dot, it is one point, and it is the last stroke', () => {
    for (const g of GLYPHS) {
      g.strokes.forEach((s, i) => {
        if (!s.dot) return;
        expect(['i', 'j']).toContain(g.id);
        expect(i).toBe(g.strokes.length - 1);
        expect(s.pts).toHaveLength(1);
      });
    }
    expect(GLYPHS.filter((g) => g.strokes.some((s) => s.dot)).map((g) => g.id)).toEqual(['i', 'j']);
  });
  it('does not mix up shapes: the closed ones close and the open ones stay open', () => {
    const closed: [string, number][] = [['O', 0], ['Q', 0], ['o', 0], ['a', 0], ['g', 0], ['q', 0], ['0', 0], ['8', 0], ['d', 1]];
    for (const [id, si] of closed) {
      const s = glyphById(id)!.strokes[si];
      expect(distance(s.pts[0], s.pts[s.pts.length - 1]), `${id} closes`).toBeLessThan(3);
    }
    for (const id of ['C', 'c', 'S', 'U', 'J', 'G', 'e', 's', 'u', 'n', '2', '3', '5', '7']) {
      const g = glyphById(id)!;
      const s = g.strokes[0];
      expect(distance(s.pts[0], s.pts[s.pts.length - 1]), `${id} stays open`).toBeGreaterThan(10);
    }
  });
});

describe('strokes are numbered in writing order: top before bottom, then left before right, dots last', () => {
  it('each stroke starts no higher than the one before, and no further left when level with it', () => {
    for (const g of GLYPHS) {
      const real = g.strokes.filter((s) => !s.dot);
      for (let i = 1; i < real.length; i++) {
        const a = real[i - 1].pts[0];
        const b = real[i].pts[0];
        const lower = b[1] > a[1] + 0.5;
        const level = Math.abs(b[1] - a[1]) <= 0.5;
        expect(lower || (level && b[0] >= a[0] - 0.5), `${g.id}: stroke ${i + 1} starts at ${b} after ${a}`).toBe(true);
      }
    }
  });
  it('the first stroke of every capital and number starts in the top half', () => {
    for (const g of GLYPHS.filter((x) => x.kind !== 'small')) {
      const first = g.strokes[0].pts[0];
      expect(first[1], g.id).toBeLessThanOrEqual(34);
    }
  });
});

describe('every shape has the height of its kind', () => {
  const extent = (g: Glyph) => {
    const ys = g.strokes.flatMap((s) => s.pts.map((p) => p[1]));
    const xs = g.strokes.flatMap((s) => s.pts.map((p) => p[0]));
    return { minY: Math.min(...ys), maxY: Math.max(...ys), minX: Math.min(...xs), maxX: Math.max(...xs) };
  };
  it('capitals and numbers run from the top line (16) to the baseline (72), except Q (tail), 9 (tail curls above the baseline)', () => {
    for (const g of GLYPHS.filter((x) => x.kind !== 'small')) {
      const e = extent(g);
      expect(e.minY, g.id).toBeGreaterThanOrEqual(15.5);
      expect(e.minY, g.id).toBeLessThanOrEqual(16.5);
      if (g.id === 'Q') expect(e.maxY).toBeCloseTo(80, 5);
      else if (g.id === '9') expect(e.maxY).toBeGreaterThan(66);
      else {
        expect(e.maxY, g.id).toBeLessThanOrEqual(72.5);
        expect(e.maxY, g.id).toBeGreaterThanOrEqual(71.5);
      }
    }
  });
  it('small letters with only a body (a c e m n o r s u v w x z) sit between the x-height (44) and the baseline (72)', () => {
    for (const id of 'acemnorsuvwxz') {
      const e = extent(glyphById(id)!);
      expect(e.minY, id).toBeGreaterThanOrEqual(43.5);
      expect(e.minY, id).toBeLessThanOrEqual(45);
      expect(e.maxY, id).toBeLessThanOrEqual(72.5);
      expect(e.maxY, id).toBeGreaterThanOrEqual(71.5);
    }
  });
  it('tall small letters (b d f h k l) reach the top line, t reaches 24, and all rest on the baseline', () => {
    for (const id of 'bdfhkl') {
      const e = extent(glyphById(id)!);
      expect(e.minY, id).toBeGreaterThanOrEqual(15.5);
      expect(e.minY, id).toBeLessThanOrEqual(16.5);
      expect(e.maxY, id).toBeLessThanOrEqual(72.5);
    }
    expect(extent(glyphById('t')!).minY).toBe(24);
    expect(extent(glyphById('t')!).maxY).toBeLessThanOrEqual(72.5);
  });
  it('g, j, p, q and y drop to the descender line (90); i and j have a dot at height 30', () => {
    for (const id of 'gjpqy') expect(extent(glyphById(id)!).maxY, id).toBeCloseTo(90, 5);
    expect(glyphById('i')!.strokes[1].pts[0]).toEqual([50, 30]);
    expect(glyphById('j')!.strokes[1].pts[0]).toEqual([54, 30]);
    expect(extent(glyphById('i')!).maxY).toBeLessThanOrEqual(72.5);
  });
});

// ── Path maths against an independent brute force ───────────────────────────

/** Distance to a polyline by sampling every segment densely: slow and obviously right. */
const bruteDistance = (pts: readonly Pt[], q: Pt): number => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    for (let k = 0; k <= 400; k++) {
      const u = k / 400;
      const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u;
      const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u;
      best = Math.min(best, Math.hypot(q[0] - x, q[1] - y));
    }
  }
  return best;
};

describe('makePath and pointAt', () => {
  it('measures a straight line and finds points along it', () => {
    const p = makePath({ pts: [[10, 10], [10, 40], [40, 40]] });
    expect(p.length).toBe(60);
    expect(p.cum).toEqual([0, 30, 60]);
    expect(pointAt(p, 0)).toEqual([10, 10]);
    expect(pointAt(p, 15)).toEqual([10, 25]);
    expect(pointAt(p, 30)).toEqual([10, 40]);
    expect(pointAt(p, 45)).toEqual([25, 40]);
    expect(pointAt(p, 60)).toEqual([40, 40]);
    expect(pointAt(p, -5)).toEqual([10, 10]);
    expect(pointAt(p, 9999)).toEqual([40, 40]);
    expect(pointAt(p, NaN)).toEqual([10, 10]);
  });
  it('the point at the end of every glyph stroke is its last point and the start is its first', () => {
    for (const g of GLYPHS) for (const s of g.strokes) {
      const p = makePath(s);
      expect(pointAt(p, 0)).toEqual(s.pts[0]);
      const end = pointAt(p, p.length);
      expect(distance(end, s.pts[s.pts.length - 1])).toBeLessThan(1e-9);
    }
  });
  it('a dot is a path of length zero', () => {
    const p = makePath(glyphById('i')!.strokes[1]);
    expect(p.dot).toBe(true);
    expect(p.length).toBe(0);
    expect(pointAt(p, 5)).toEqual([50, 30]);
  });
});

describe('distanceToPath and withinTolerance, against brute force', () => {
  it('agree on 3000 random points for several shapes', () => {
    const r = rng32(7);
    for (const id of ['A', 'S', 'g', '8', 'B', 'e']) {
      for (const stroke of glyphById(id)!.strokes) {
        const path = makePath(stroke);
        if (path.dot) continue;
        for (let k = 0; k < 500; k++) {
          const q: Pt = [r() * 100, r() * 100];
          const want = bruteDistance(stroke.pts, q);
          expect(Math.abs(distanceToPath(path, q) - want), `${id}`).toBeLessThan(0.05);
          if (Math.abs(want - TOL) > 0.1) expect(withinTolerance(path, q), `${id} ${q}`).toBe(want <= TOL);
        }
      }
    }
  }, 30_000);
  it('exact points (on the line) are within the tolerance, in every stroke of every shape', () => {
    for (const g of GLYPHS) for (const s of g.strokes) {
      const path = makePath(s);
      if (path.dot) { expect(withinTolerance(path, s.pts[0])).toBe(true); continue; }
      for (let t = 0; t <= path.length; t += 1.5) expect(withinTolerance(path, pointAt(path, t)), `${g.id} at ${t}`).toBe(true);
    }
  });
  it('near points (up to 0.9 of the tolerance off a straight line) are within it, and far points are not', () => {
    const line = makePath(glyphById('I')!.strokes[0]); // x = 50, y 16 to 72
    for (const dx of [0, 3, 6, 9, 11.7, -3, -11.7]) expect(withinTolerance(line, [50 + dx, 40])).toBe(true);
    for (const dx of [13.1, 14, 20, 40, -13.1, -30]) expect(withinTolerance(line, [50 + dx, 40])).toBe(false);
    // Past the ends the distance is measured to the end point.
    expect(withinTolerance(line, [50, 72 + 12.9])).toBe(true);
    expect(withinTolerance(line, [50, 72 + 13.1])).toBe(false);
    expect(withinTolerance(line, [50, 16 - 12.9])).toBe(true);
    expect(withinTolerance(line, [50, 16 - 13.1])).toBe(false);
    expect(withinTolerance(line, [0, 0])).toBe(false);
    expect(withinTolerance(line, [100, 100])).toBe(false);
  });
  it('a different tolerance is respected', () => {
    const line = makePath(glyphById('I')!.strokes[0]);
    expect(withinTolerance(line, [58, 40], 8)).toBe(true);
    expect(withinTolerance(line, [58.1, 40], 8)).toBe(false);
    expect(withinTolerance(line, [70, 40], 25)).toBe(true);
  });
  it('a dot is hit within its own distance', () => {
    const dotPath = makePath(glyphById('i')!.strokes[1]);
    expect(withinTolerance(dotPath, [50, 30])).toBe(true);
    expect(withinTolerance(dotPath, [50, 42.9])).toBe(true);
    expect(withinTolerance(dotPath, [50, 43.1])).toBe(false);
    expect(canPickUp(dotPath, 0, [50, 30 + DOT_TOL - 0.1])).toBe(true);
    expect(canPickUp(dotPath, 0, [50, 30 + DOT_TOL + 0.1])).toBe(false);
  });
  it('nearestInWindow only looks inside the window and prefers the further point on a tie', () => {
    // A closed square: the start corner is also the end.
    const sq = makePath({ pts: [[20, 20], [60, 20], [60, 60], [20, 60], [20, 20]] });
    expect(sq.length).toBe(160);
    const startWindow = nearestInWindow(sq, [20, 20], 0, 30)!;
    expect(startWindow.t).toBe(0);
    expect(startWindow.d).toBe(0);
    const endWindow = nearestInWindow(sq, [20, 20], 130, 160)!;
    expect(endWindow.t).toBeCloseTo(160, 9);
    expect(nearestInWindow(sq, [20, 20], 80, 90)!.d).toBeGreaterThan(40);
    expect(nearestInWindow(sq, [20, 20], 50, 40)).toBeNull();
    expect(nearestInWindow(makePath({ pts: [[1, 1]] }), [1, 1], 0, 10)).toBeNull();
  });
});

describe('advance: progress only grows, only near the line, only a little way ahead', () => {
  const line = makePath({ pts: [[10, 50], [90, 50]] });
  it('moves forward to a point on the line', () => {
    expect(advance(line, 0, [25, 50])).toEqual({ s: 15, onPath: true });
    expect(advance(line, 10, [30, 52]).s).toBeCloseTo(20, 6);
  });
  it('never goes back', () => {
    expect(advance(line, 40, [20, 50]).s).toBe(40);
    expect(advance(line, 40, [40, 50]).s).toBe(40);
  });
  it('does not jump more than AHEAD at once', () => {
    expect(advance(line, 0, [80, 50]).s).toBe(0);
    expect(advance(line, 0, [10 + AHEAD, 50]).s).toBeCloseTo(AHEAD, 6);
    // Just past the edge of the window it is held at the edge; well past it, nothing moves.
    expect(advance(line, 0, [10 + AHEAD + 5, 50]).s).toBeCloseTo(AHEAD, 6);
    expect(advance(line, 0, [10 + AHEAD + TOL + 1, 50]).s).toBe(0);
  });
  it('does not move for a point that is off the line, and says so', () => {
    expect(advance(line, 0, [25, 50 + TOL + 1])).toEqual({ s: 0, onPath: false });
    expect(advance(line, 0, [25, 50 + TOL - 1]).s).toBe(15);
  });
  it('survives junk', () => {
    expect(advance(line, NaN, [25, 50]).s).toBe(15);
    expect(advance(line, -50, [25, 50]).s).toBe(15);
    expect(advance(line, 9999, [25, 50]).s).toBe(80);
  });
  it('isStrokeDone is true within END_SLACK of the end, never for a dot', () => {
    expect(isStrokeDone(line, 80 - END_SLACK)).toBe(true);
    expect(isStrokeDone(line, 80 - END_SLACK - 0.1)).toBe(false);
    expect(isStrokeDone(makePath(glyphById('i')!.strokes[1]), 0)).toBe(false);
  });
});

// ── Whole tracing sessions ───────────────────────────────────────────────────

const traceStroke = (t: Tracer, wobble: (p: Pt, k: number) => Pt, stepLen = 3): Tracer => {
  const path = t.paths[t.stroke];
  let cur = pressDown(t, wobble(pointAt(path, 0), 0));
  if (!cur.penDown) return cur;
  let k = 1;
  for (let d = stepLen; d < path.length + stepLen; d += stepLen) {
    cur = dragTo(cur, wobble(pointAt(path, Math.min(d, path.length)), k++));
    if (cur.stroke !== t.stroke) return cur; // that stroke is done
  }
  return cur;
};

const traceGlyph = (g: Glyph, wobble: (p: Pt, k: number) => Pt): Tracer => {
  let t = startTracer(g);
  let guard = 0;
  while (!t.finished && guard++ < 20) {
    const path = t.paths[t.stroke];
    if (path.dot) t = pressDown(t, wobble(path.pts[0], 0));
    else t = traceStroke(t, wobble);
  }
  return t;
};

describe('tracing a shape', () => {
  it('finishing each of the 62 shapes by tracing it exactly gives three stars and no off-line samples', () => {
    for (const g of GLYPHS) {
      const t = traceGlyph(g, (p) => p);
      expect(t.finished, g.id).toBe(true);
      expect(t.stroke, g.id).toBe(g.strokes.length);
      expect(t.off, g.id).toBe(0);
      expect(t.stars, g.id).toBe(3);
      expect(letterShare(t)).toBe(1);
      expect(pickUpPoint(t)).toBeNull();
    }
  });
  it('also finishes with a wobble up to 0.55 of the tolerance, from 12 different seeds, in every shape', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng32(seed * 101);
      const amp = TOL * 0.55;
      const wobble = (p: Pt): Pt => [p[0] + (r() * 2 - 1) * amp, p[1] + (r() * 2 - 1) * amp];
      for (const g of GLYPHS) {
        const t = traceGlyph(g, wobble);
        expect(t.finished, `${g.id} seed ${seed}`).toBe(true);
      }
    }
  }, 30_000);
  it('also finishes when the pointer moves in big jumps (a fast swipe is filled in)', () => {
    for (const g of GLYPHS) {
      let t = startTracer(g);
      let guard = 0;
      while (!t.finished && guard++ < 20) {
        const path = t.paths[t.stroke];
        if (path.dot) { t = pressDown(t, path.pts[0]); continue; }
        t = traceStroke(t, (p) => p, 11);
        t = liftPen(t);
      }
      expect(t.finished, g.id).toBe(true);
    }
  });
  it('shows progress as shares between 0 and 1 that never go down while tracing', () => {
    const g = glyphById('B')!;
    let t = startTracer(g);
    expect(letterShare(t)).toBe(0);
    expect(strokeShare(t)).toBe(0);
    let prev = 0;
    let guard = 0;
    while (!t.finished && guard++ < 10) {
      const path = t.paths[t.stroke];
      t = pressDown(t, path.pts[0]);
      for (let d = 2; d <= path.length + 2 && !t.finished; d += 2) {
        const before = t.stroke;
        t = dragTo(t, pointAt(path, Math.min(d, path.length)));
        if (t.stroke !== before) break;
        const share = letterShare(t);
        expect(share).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(share).toBeLessThanOrEqual(1);
        prev = share;
      }
    }
    expect(t.finished).toBe(true);
  });

  it('touching only the start and the end of a curved stroke does not finish it', () => {
    let checked = 0;
    for (const g of GLYPHS) {
      const t0 = startTracer(g);
      const path = t0.paths[0];
      if (path.dot) continue;
      const a = path.pts[0];
      const z = path.pts[path.pts.length - 1];
      // Only strokes whose straight chord is clearly off the stroke.
      let far = 0;
      for (let u = 0.1; u < 0.95; u += 0.05) far = Math.max(far, distanceToPath(path, [a[0] + (z[0] - a[0]) * u, a[1] + (z[1] - a[1]) * u]));
      if (far < TOL + 2) continue;
      checked++;
      let t = pressDown(t0, a);
      expect(t.penDown, g.id).toBe(true);
      t = dragTo(t, z);
      expect(t.stroke, `${g.id} skipped the middle`).toBe(0);
      expect(t.finished).toBe(false);
    }
    expect(checked).toBeGreaterThan(10);
  });
  it('jumping from the first part of a stroke to its end does not finish it', () => {
    for (const id of ['S', 'O', 'C', 'U', '8', '2']) {
      const g = glyphById(id)!;
      const t0 = startTracer(g);
      const path = t0.paths[0];
      let t = pressDown(t0, path.pts[0]);
      for (let d = 2; d <= path.length * 0.3; d += 2) t = dragTo(t, pointAt(path, d));
      const mid = t.s;
      expect(mid).toBeGreaterThan(path.length * 0.25);
      t = dragTo(t, pointAt(path, path.length)); // teleport (the chord is filled in with samples)
      expect(t.stroke, id).toBe(0);
      expect(t.s, id).toBeLessThan(path.length * 0.3 + AHEAD + 1);
    }
  });
  it('a press away from where the stroke starts does not pick it up', () => {
    for (const g of GLYPHS) {
      const t = startTracer(g);
      const path = t.paths[0];
      if (path.dot) continue;
      const mid = pointAt(path, path.length / 2);
      if (distance(mid, path.pts[0]) > START_TOL + 1) expect(pressDown(t, mid).penDown, `${g.id} middle`).toBe(false);
      const end = path.pts[path.pts.length - 1];
      if (distance(end, path.pts[0]) > START_TOL + 1) expect(pressDown(t, end).penDown, `${g.id} end`).toBe(false);
      expect(pressDown(t, path.pts[0]).penDown, `${g.id} start`).toBe(true);
    }
  });
  it('a press within START_TOL of the start picks the stroke up and just outside does not (checked on a straight stroke)', () => {
    const t = startTracer(glyphById('I')!); // starts at (50, 16)
    expect(pressDown(t, [50 + START_TOL - 0.01, 16]).penDown).toBe(true);
    expect(pressDown(t, [50 + START_TOL + 0.01, 16]).penDown).toBe(false);
    expect(pressDown(t, [50, 16 - START_TOL + 0.01]).penDown).toBe(true);
  });
  it('going round a closed shape the wrong way does not finish it', () => {
    for (const id of ['O', '0', 'o']) {
      const g = glyphById(id)!;
      const path = startTracer(g).paths[0];
      let t = pressDown(startTracer(g), path.pts[0]);
      // Half way round the wrong way.
      for (let d = path.length - 2; d >= path.length * 0.5 && !t.finished; d -= 2) t = dragTo(t, pointAt(path, d));
      expect(t.finished, id).toBe(false);
      expect(t.s, id).toBeLessThan(TOL + 1);
    }
  });
  it('moving without the pen down, or after the letter is finished, changes nothing', () => {
    const g = glyphById('L')!;
    const t0 = startTracer(g);
    expect(dragTo(t0, [30, 40])).toBe(t0);
    const done = traceGlyph(g, (p) => p);
    expect(pressDown(done, [30, 16])).toBe(done);
    expect(dragTo(done, [30, 40])).toBe(done);
    expect(liftPen(done)).toBe(done);
  });
  it('lifting the pen keeps the progress and the next press must be near where it got to', () => {
    const g = glyphById('H')!;
    let t = startTracer(g);
    const path = t.paths[0];
    t = pressDown(t, path.pts[0]);
    for (let d = 2; d <= 30; d += 2) t = dragTo(t, pointAt(path, d));
    expect(t.s).toBeGreaterThan(25);
    const keep = t.s;
    t = liftPen(t);
    expect(t.penDown).toBe(false);
    expect(t.s).toBe(keep);
    // Pressing back at the very start is too far away now.
    expect(pressDown(t, path.pts[0]).penDown).toBe(false);
    // Pressing where it got to carries on.
    const here = pointAt(path, keep);
    const again = pressDown(t, here);
    expect(again.penDown).toBe(true);
    // A straight stroke can be finished with one swipe along it: the swipe is filled in with samples.
    expect(dragTo(again, pointAt(path, path.length)).stroke).toBe(1);
    let t2 = again;
    for (let d = keep; d <= path.length + 2; d += 2) t2 = dragTo(t2, pointAt(path, Math.min(d, path.length)));
    expect(t2.stroke).toBe(1);
  });
  it('after a stroke is finished the pen lifts and the next stroke has to be picked up at its own start', () => {
    const g = glyphById('T')!;
    let t = startTracer(g);
    const first = t.paths[0];
    t = pressDown(t, first.pts[0]);
    for (let d = 2; d <= first.length + 2 && t.stroke === 0; d += 2) t = dragTo(t, pointAt(first, Math.min(d, first.length)));
    expect(t.stroke).toBe(1);
    expect(t.penDown).toBe(false);
    expect(t.finished).toBe(false);
    expect(pickUpPoint(t)).toEqual([50, 16]);
    expect(pressDown(t, [30, 70]).penDown).toBe(false);
    expect(pressDown(t, [50, 16]).penDown).toBe(true);
  });
  it('the dot of an i is finished by a press near it, and not by one far away', () => {
    const g = glyphById('i')!;
    let t = traceStroke(startTracer(g), (p) => p);
    expect(t.stroke).toBe(1);
    expect(t.finished).toBe(false);
    expect(pressDown(t, [50, 30 + DOT_TOL + 0.5])).toBe(t);
    t = pressDown(t, [52, 33]);
    expect(t.finished).toBe(true);
    expect(t.stars).toBe(3);
  });
  it('junk points are cleaned, never crash and never produce NaN', () => {
    const t0 = startTracer(glyphById('A')!);
    for (const bad of [[NaN, NaN], [Infinity, -Infinity], [-500, 900], [1e12, 1e12]] as Pt[]) {
      const t = pressDown(t0, bad);
      expect(Number.isNaN(t.s)).toBe(false);
      const u = dragTo(pressDown(t0, t0.paths[0].pts[0]), bad);
      expect(Number.isFinite(u.s)).toBe(true);
      expect(Number.isFinite(u.samples) && Number.isFinite(u.off)).toBe(true);
    }
    expect(clampPoint([NaN, 999])).toEqual([50, 100]);
    expect(clampPoint([-4, 12])).toEqual([0, 12]);
  });
  it('random scribbling for 20000 moves never throws and never moves progress backwards or past the end', () => {
    const r = rng32(99);
    for (const g of [glyphById('S')!, glyphById('B')!, glyphById('i')!, glyphById('8')!]) {
      let t = startTracer(g);
      let last = 0;
      let lastStroke = 0;
      for (let k = 0; k < 5000 && !t.finished; k++) {
        const roll = r();
        const path = t.paths[t.stroke];
        if (roll < 0.1) t = pressDown(t, path ? pickUpPoint(t) ?? [r() * 100, r() * 100] : [0, 0]);
        else if (roll < 0.14) t = liftPen(t);
        else t = dragTo(t, [r() * 100, r() * 100]);
        expect(t.stroke).toBeGreaterThanOrEqual(lastStroke);
        if (t.stroke === lastStroke) expect(t.s).toBeGreaterThanOrEqual(last - 1e-9);
        if (t.stroke !== lastStroke) last = 0; else last = t.s;
        lastStroke = t.stroke;
        if (!t.finished) expect(t.s).toBeLessThanOrEqual(t.paths[t.stroke].length + 1e-9);
      }
    }
  });
});

describe('stars: never fewer than one, three for staying on the line', () => {
  it('thresholds', () => {
    expect(starsFor(100, 0)).toBe(3);
    expect(starsFor(100, 12)).toBe(3);
    expect(starsFor(100, 13)).toBe(2);
    expect(starsFor(100, 35)).toBe(2);
    expect(starsFor(100, 36)).toBe(1);
    expect(starsFor(100, 100)).toBe(1);
    expect(starsFor(0, 0)).toBe(3);
  });
  it('is always a whole number from 1 to 3, even for junk', () => {
    for (const [a, b] of [[NaN, NaN], [-5, 3], [5, 99], [Infinity, 1], [10, -3], [1e9, 1e9]] as [number, number][]) {
      const s = starsFor(a, b);
      expect(Number.isInteger(s) && s >= 1 && s <= 3).toBe(true);
    }
  });
  it('a finished letter with plenty of off-line samples still earns a star', () => {
    // Press at the start, wander far off the line, come back, finish.
    const g = glyphById('I')!;
    let t = pressDown(startTracer(g), [50, 16]);
    for (let k = 0; k < 40; k++) t = dragTo(t, [k % 2 === 0 ? 95 : 5, 20]);
    expect(t.off).toBeGreaterThan(40);
    t = dragTo(t, [50, 18]);
    for (let d = 20; d <= 74; d += 2) t = dragTo(t, [50, d]);
    expect(t.finished).toBe(true);
    expect(t.stars).toBe(1);
  });
});

describe('keyboard cursor', () => {
  it('moves one step per arrow and a big step with Shift', () => {
    expect(moveCursor([50, 50], 'ArrowRight')).toEqual([55, 50]);
    expect(moveCursor([50, 50], 'ArrowLeft')).toEqual([45, 50]);
    expect(moveCursor([50, 50], 'ArrowUp')).toEqual([50, 45]);
    expect(moveCursor([50, 50], 'ArrowDown')).toEqual([50, 55]);
    expect(moveCursor([50, 50], 'ArrowRight', true)).toEqual([65, 50]);
    expect(moveCursor([50, 50], 'ArrowUp', true)).toEqual([50, 35]);
  });
  it('stays inside the box and ignores other keys', () => {
    expect(moveCursor([2, 98], 'ArrowLeft')).toEqual([0, 98]);
    expect(moveCursor([2, 98], 'ArrowDown', true)).toEqual([2, 100]);
    expect(moveCursor([99, 1], 'ArrowRight', true)).toEqual([100, 1]);
    expect(moveCursor([30, 40], 'a')).toEqual([30, 40]);
    expect(moveCursor([NaN, 40], 'ArrowUp')).toEqual([50, 35]);
  });
  it('a person can trace every shape using only arrow steps (the cursor path stays within the tolerance)', () => {
    // Walk the cursor toward each next path point with 5-unit arrow steps (and 15 with Shift).
    for (const g of GLYPHS) {
      let t = startTracer(g);
      let cur: Pt = [50, 50];
      let guard = 0;
      while (!t.finished && guard++ < 60) {
        const path = t.paths[t.stroke];
        if (path.dot) {
          cur = path.pts[0];
          t = pressDown(t, cur);
          continue;
        }
        cur = path.pts[0];
        t = pressDown(t, cur);
        let steps = 0;
        const idx = t.stroke;
        while (t.stroke === idx && t.penDown && steps++ < 600) {
          // aim at the point 6 units further along the guide line than the current progress
          const target = pointAt(path, Math.min(path.length, t.s + 6));
          const dx = target[0] - cur[0];
          const dy = target[1] - cur[1];
          const key = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'ArrowRight' : 'ArrowLeft') : (dy >= 0 ? 'ArrowDown' : 'ArrowUp');
          cur = moveCursor(cur, key);
          t = dragTo(t, cur);
        }
      }
      expect(t.finished, g.id).toBe(true);
    }
  }, 30_000);
});

describe('plain words', () => {
  it('placeWords names nine places', () => {
    expect(placeWords([20, 20])).toBe('the top left');
    expect(placeWords([50, 20])).toBe('the top middle');
    expect(placeWords([80, 20])).toBe('the top right');
    expect(placeWords([20, 50])).toBe('the middle left');
    expect(placeWords([50, 50])).toBe('the middle');
    expect(placeWords([80, 50])).toBe('the middle right');
    expect(placeWords([20, 80])).toBe('the bottom left');
    expect(placeWords([50, 80])).toBe('the bottom middle');
    expect(placeWords([80, 80])).toBe('the bottom right');
    expect(placeWords([NaN, NaN])).toBe('the middle');
  });
  it('directionWords has eight directions', () => {
    expect(directionWords(1, 0)).toBe('right');
    expect(directionWords(1, 1)).toBe('down and right');
    expect(directionWords(0, 1)).toBe('down');
    expect(directionWords(-1, 1)).toBe('down and left');
    expect(directionWords(-1, 0)).toBe('left');
    expect(directionWords(-1, -1)).toBe('up and left');
    expect(directionWords(0, -1)).toBe('up');
    expect(directionWords(1, -1)).toBe('up and right');
    expect(directionWords(0, 0)).toBe('on');
    expect(directionWords(NaN, NaN)).toBe('on');
  });
  it('every stroke of every shape has a numbered sentence with no junk in it', () => {
    for (const g of GLYPHS) {
      g.strokes.forEach((_, i) => {
        const h = strokeHint(g, i);
        expect(h.startsWith(`Stroke ${i + 1} of ${g.strokes.length}: `), g.id).toBe(true);
        expect(h).not.toMatch(/NaN|undefined|null|Infinity/);
        expect(h.includes(EM_DASH)).toBe(false);
        expect(h.endsWith('.')).toBe(true);
      });
      expect(glyphHint(g).match(/Stroke \d+ of/g)).toHaveLength(g.strokes.length);
    }
    expect(strokeHint(glyphById('A')!, 0)).toBe('Stroke 1 of 3: start at the top middle, go down and left, and finish at the bottom left.');
    expect(strokeHint(glyphById('O')!, 0)).toContain('all the way round');
    expect(strokeHint(glyphById('i')!, 1)).toBe('Stroke 2 of 2: tap the dot at the top middle.');
    expect(strokeHint(glyphById('A')!, 7)).toBe('');
  });
});

describe('picking a shape', () => {
  it('parseGlyphId accepts the 62 ids and falls back to A', () => {
    for (const id of ALL_IDS) expect(parseGlyphId(id)).toBe(id);
    for (const bad of ['', 'AB', '10', '__proto__', 'constructor', null, undefined, 5, {}, [], ' A']) expect(parseGlyphId(bad)).toBe('A');
  });
  it('stepGlyph moves through the whole list and wraps', () => {
    expect(stepGlyph('A', 1)).toBe('B');
    expect(stepGlyph('Z', 1)).toBe('a');
    expect(stepGlyph('z', 1)).toBe('0');
    expect(stepGlyph('9', 1)).toBe('A');
    expect(stepGlyph('A', -1)).toBe('9');
    expect(stepGlyph('0', -1)).toBe('z');
    expect(stepGlyph('nope', 1)).toBe('B');
    expect(stepGlyph('A', NaN)).toBe('B');
    let id = 'A';
    for (let k = 0; k < 62; k++) id = stepGlyph(id, 1);
    expect(id).toBe('A');
  });
  it('glyphById is safe with junk', () => {
    expect(glyphById('A')?.id).toBe('A');
    for (const bad of ['', 'AA', null, undefined, 3, {}, '__proto__', 'toString']) expect(glyphById(bad)).toBeNull();
  });
});

describe('cleanStars and sanitiseStored', () => {
  it('stars are whole numbers 1 to 3', () => {
    for (const ok of [1, 2, 3]) expect(cleanStars(ok)).toBe(ok);
    for (const bad of [0, 4, -1, 1.5, NaN, Infinity, '2', null, undefined, {}, [], [2], true, 3n]) expect(cleanStars(bad), String(bad)).toBeNull();
  });
  it('keeps a good payload, from an object or the JSON string', () => {
    expect(sanitiseStored({ A: 3, b: 2, 7: 1 })).toEqual({ A: 3, b: 2, 7: 1 });
    expect(sanitiseStored('{"A":3,"z":1,"0":2}')).toEqual({ A: 3, z: 1, 0: 2 });
  });
  it('returns an empty result for anything that is not a plain object', () => {
    for (const bad of [null, undefined, 42, true, '', 'not json', '[1,2,3]', '"x"', 'null', [], [1, 2], NaN, () => 1, Symbol('x')]) expect(sanitiseStored(bad)).toEqual({});
  });
  it('drops unknown keys including prototype keys, and bad values', () => {
    const s = sanitiseStored('{"__proto__":{"A":3},"constructor":2,"toString":3,"AA":3,"?":2,"A":2,"B":9,"C":0,"D":2.5,"E":"3","F":null,"G":[3]}');
    expect(s).toEqual({ A: 2 });
    expect(({} as Record<string, unknown>).A).toBeUndefined();
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
  });
  it('handles a very large hostile object quickly and keeps only the 62 known keys', () => {
    const t = performance.now();
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200000; i++) huge[`k${i}`] = 3;
    huge.A = 3;
    expect(sanitiseStored(huge)).toEqual({ A: 3 });
    expect(performance.now() - t).toBeLessThan(4000);
  }, 15_000);
  it('toStorable round-trips through JSON and the sanitiser', () => {
    const b = { A: 3, q: 1, 5: 2 };
    expect(sanitiseStored(JSON.stringify(toStorable(b)))).toEqual(b);
    expect(toStorable({ A: 3, junk: 2 } as Record<string, number>)).toEqual({ A: 3 });
  });
});

describe('recordStars and the tally', () => {
  it('keeps the higher number of stars and never lowers it', () => {
    let s = recordStars({}, 'A', 2);
    expect(s).toEqual({ stars: { A: 2 }, saved: true, improved: false });
    const up = recordStars(s.stars, 'A', 3);
    expect(up).toEqual({ stars: { A: 3 }, saved: true, improved: true });
    const same = recordStars(up.stars, 'A', 3);
    expect(same.saved).toBe(false);
    expect(same.stars).toBe(up.stars);
    const lower = recordStars(up.stars, 'A', 1);
    expect(lower.saved).toBe(false);
    expect(lower.stars).toBe(up.stars);
  });
  it('rejects bad stars and unknown shapes and does not change the object it was given', () => {
    const base = { A: 2 };
    const before = JSON.stringify(base);
    for (const bad of [0, 4, 1.5, NaN, '3' as unknown as number]) expect(recordStars(base, 'B', bad).saved).toBe(false);
    for (const badId of ['', 'AA', '__proto__', 'constructor']) expect(recordStars(base, badId, 3).saved).toBe(false);
    recordStars(base, 'B', 3);
    expect(JSON.stringify(base)).toBe(before);
  });
  it('counts shapes and stars, ignoring junk', () => {
    expect(tally({})).toEqual({ shapes: 0, stars: 0 });
    expect(tally({ A: 3, b: 2, '7': 1 })).toEqual({ shapes: 3, stars: 6 });
    expect(tally({ A: 3, zz: 3, b: 9 } as Record<string, number>)).toEqual({ shapes: 1, stars: 3 });
  });
  it('the copy line is right with nothing, one shape, one star, and many', () => {
    expect(resultSummary({})).toBe('Letter Tracer: no shapes traced yet');
    expect(resultSummary({ A: 1 })).toBe('Letter Tracer: I have traced 1 of 62 shapes and collected 1 star');
    expect(resultSummary({ A: 3, B: 2 })).toBe('Letter Tracer: I have traced 2 of 62 shapes and collected 5 stars');
    expect(plural(1, 'star')).toBe('1 star');
    expect(plural(0, 'star')).toBe('0 stars');
    for (const s of [resultSummary({}), resultSummary({ A: 3 })]) {
      expect(s.includes(EM_DASH)).toBe(false);
      expect(s).not.toMatch(/NaN|undefined|null|Infinity/);
    }
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/letter-tracer', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'glyphs.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('only the drawing area turns off touch scrolling, so the rest of the page still scrolls', () => {
    const text = read('Calculator.astro');
    const hits = [...text.matchAll(/([^{}]*)\{[^{}]*touch-action:\s*none[^{}]*\}/g)].map((m) => m[1].trim());
    expect(hits.length).toBeGreaterThan(0);
    for (const sel of hits) expect(sel, sel).toMatch(/\.ltr-pad/);
  });
  it('buttons are at least 56 px (3.5rem) tall and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.ltr-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.ltr-key \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/#ltr-app \.ltr-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('the pad is not a wall for keyboard users: no tabindex of -1 on the pad, and it has an accessible name', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/id="ltr-pad"[^>]*tabindex="0"/);
    expect(text).toMatch(/id="ltr-pad"[^>]*aria-label=/);
  });
});
