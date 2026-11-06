/**
 * games-zen-garden.test.ts - the engine behind `zen-garden`.
 *
 * Pinned:
 *  - the distance field: the exact Euclidean distance transform equals a brute-force search over every
 *    stone cell, on random masks, empty and full grids, single cells and non-square grids,
 *  - ripples: every cell of a baked garden with one or two stones equals the ripple pattern evaluated at
 *    its brute-force distance to the nearest stone cell (flat sand outside the pattern, zero under a
 *    stone); the valleys fall at 3.5 + 4k cells from the stone and the pattern is continuous,
 *  - rakes: a stroke with 1, 3, 5 or 9 tines cuts exactly that many grooves, 4 cells apart, across the
 *    direction of travel (horizontal, vertical and diagonal), and the groove profile is continuous,
 *  - paths: resampling puts points on the path at equal arc-length steps and keeps both ends,
 *  - the smoothing brush levels its middle and leaves cells outside its radius alone,
 *  - replay: baking is deterministic, incremental application equals baking the whole list, and undo
 *    is exact; Clear always works and restores room; the limits hold,
 *  - stones and moss: placement rules, shapes from a seed stay inside their radius, moss spreads evenly,
 *  - the starting garden is valid, and the lighting (right wall of a groove is lit, left wall dark),
 *  - and the claims the page source makes.
 */
import { describe, it, expect } from 'vitest';
import {
  GRID_W, GRID_H, TOOLS, isTool, RAKES, isRakeId, rakeById, TINE_SPACING, SIZE_KEYS, isSizeKey, STONE_RADIUS, MOSS_RADIUS,
  SMOOTH_RADIUS, MAX_STONES, MAX_MOSS, MAX_ACTIONS, MAX_PATH_POINTS, MAX_PATH_POINTS_TOTAL, MAX_HISTORY, MIN_STEP,
  newGarden, canUndo, canRedo, addAction, undoAction, redoAction, hasRoom, liveActions, pathPointsUsed, itemsOf,
  clampCell, cleanPoint, tryAddPathPoint, resamplePath, grooveProfile, carveRake, smoothPath, distanceSquared,
  RIPPLE_GAP, RIPPLE_RINGS, RIPPLE_SPACING, RIPPLE_REACH, rippleHeight, stoneMask, bakeHeights, stoneProblem, mossProblem,
  stonePolygon, STONE_VERTICES, mossDots, mossCount, SHADES, shadeAt, ramp, starterActions, starterGarden, moveCursor,
  describeItems, shareText, RULES, mulberry32, parseColour, toCss, mixOklch, neutral,
  newPathCarver, advancePathCarver, previewPathCarver,
  type Action, type StoneAction,
} from '../src/components/apps-private/zen-garden/helpers';
import calculatorSource from '../src/components/apps-private/zen-garden/Calculator.astro?raw';

const rake = (t: number, p: number[]): Action => ({ k: 'rake', t, p });
const stone = (x: number, y: number, r: number, seed = 1): StoneAction => ({ k: 'stone', x, y, r, seed });
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

/** Brute-force distance from a cell to the nearest masked cell (centres), written independently of the engine. */
const maskCells = new WeakMap<Uint8Array, number[]>();
const bruteD = (mask: Uint8Array, w: number, h: number, x: number, y: number): number => {
  let cells = maskCells.get(mask);
  if (!cells) {
    cells = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (mask[j * w + i]) cells.push(i, j);
    maskCells.set(mask, cells);
  }
  let best = Infinity;
  for (let k = 0; k < cells.length; k += 2) best = Math.min(best, Math.hypot(cells[k] - x, cells[k + 1] - y));
  return best;
};

describe('distance field', () => {
  it('matches a brute-force search on random masks of several shapes', () => {
    const rng = mulberry32(3);
    for (const [w, h] of [[30, 20], [17, 41], [1, 9], [9, 1], [25, 25]]) {
      for (let trial = 0; trial < 4; trial++) {
        const mask = new Uint8Array(w * h);
        const n = 1 + Math.floor(rng() * 8);
        for (let k = 0; k < n; k++) mask[Math.floor(rng() * w * h)] = 1;
        const d2 = distanceSquared(mask, w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const want = bruteD(mask, w, h, x, y);
          expect(near(Math.sqrt(d2[y * w + x]), want, 1e-9)).toBe(true);
        }
      }
    }
  });
  it('is zero on the mask, one next to a single cell, and huge when there is no mask', () => {
    const mask = new Uint8Array(5 * 5);
    mask[12] = 1;
    const d2 = distanceSquared(mask, 5, 5);
    expect(d2[12]).toBe(0);
    expect(d2[13]).toBe(1);
    expect(d2[6]).toBe(2);
    expect(d2[0]).toBe(8);
    const none = distanceSquared(new Uint8Array(16), 4, 4);
    expect(Math.min(...none)).toBeGreaterThan(1e8);
    const all = distanceSquared(new Uint8Array(16).fill(1), 4, 4);
    expect(Math.max(...all)).toBe(0);
  });
});

describe('ripples round stones', () => {
  it('the pattern has valleys at 3.5 + 4k, ridges between, is flat outside, and is continuous', () => {
    expect(RIPPLE_GAP).toBe(3);
    expect(RIPPLE_RINGS).toBe(4);
    expect(RIPPLE_SPACING).toBe(TINE_SPACING);
    for (let k = 0; k < 4; k++) expect(near(rippleHeight(3.5 + 4 * k)!, -0.9, 1e-9)).toBe(true);
    expect(near(rippleHeight(3.5 + 16)!, -0.45, 1e-9)).toBe(true); // the outer ring fades
    for (let k = 0; k < 3; k++) expect(near(rippleHeight(5.5 + 4 * k)!, 0.25, 1e-9)).toBe(true);
    expect(rippleHeight(0)).toBeNull();
    expect(rippleHeight(1.4)).toBeNull();
    expect(rippleHeight(RIPPLE_REACH + 0.01)).toBeNull();
    expect(rippleHeight(100)).toBeNull();
    // Local minima are exactly the valleys.
    const minima: number[] = [];
    for (let d = 2; d < 24; d += 0.01) {
      const a = rippleHeight(d - 0.01) ?? 0; const b = rippleHeight(d) ?? 0; const c = rippleHeight(d + 0.01) ?? 0;
      if (b < a && b < c && b < -0.4) minima.push(Math.round(d * 10) / 10);
    }
    expect(minima.slice(0, 4)).toEqual([3.5, 7.5, 11.5, 15.5]);
    // No jumps: the largest step between samples 0.01 apart is small.
    let prev = 0;
    for (let d = 0; d < 26; d += 0.01) {
      const v = rippleHeight(d) ?? 0;
      expect(Math.abs(v - prev)).toBeLessThan(0.05);
      prev = v;
    }
  });

  it('a baked garden with one stone equals the pattern at the brute-force distance for every cell', () => {
    const s = stone(120, 90, 10, 4);
    const h = bakeHeights([s]);
    const mask = stoneMask([s], GRID_W, GRID_H);
    let checked = 0;
    for (let y = 40; y < 140; y++) {
      for (let x = 70; x < 170; x++) {
        const i = y * GRID_W + x;
        if (mask[i]) { expect(h[i]).toBe(0); continue; }
        const want = rippleHeight(bruteD(mask, GRID_W, GRID_H, x, y)) ?? 0;
        expect(near(h[i], want, 1e-6)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(9000);
    // Far from the stone nothing changed.
    expect(h[5 * GRID_W + 5]).toBe(0);
    expect(h[190 * GRID_W + 290]).toBe(0);
  }, 30_000);

  it('two close stones share rings: every cell equals the pattern at the distance to the nearest of them', () => {
    const a = stone(100, 100, 9, 1);
    const b = stone(138, 96, 13, 2);
    const h = bakeHeights([a, b]);
    const mask = stoneMask([a, b], GRID_W, GRID_H);
    for (let y = 55; y < 145; y += 1) {
      for (let x = 60; x < 190; x += 1) {
        const i = y * GRID_W + x;
        if (mask[i]) { expect(h[i]).toBe(0); continue; }
        const want = rippleHeight(bruteD(mask, GRID_W, GRID_H, x, y)) ?? 0;
        expect(near(h[i], want, 1e-6)).toBe(true);
      }
    }
  }, 60_000);

  it('the rings follow the outline: the first valley is the same distance from the stone in every direction', () => {
    const s = stone(150, 100, 12, 9);
    const h = bakeHeights([s]);
    const found: number[] = [];
    for (let a = 0; a < 360; a += 15) {
      const rad = (a * Math.PI) / 180;
      let best = -1; let bestV = 1;
      for (let d = 12; d < 12 + 8; d += 0.25) {
        const x = Math.floor(150 + d * Math.cos(rad)); const y = Math.floor(100 + d * Math.sin(rad));
        const v = h[y * GRID_W + x];
        if (v < bestV) { bestV = v; best = d; }
      }
      expect(bestV).toBeLessThan(-0.6);
      found.push(best);
    }
    // The valley is 3.5 cells from the nearest stone cell, which is about the stone's radius from its middle.
    expect(Math.max(...found) - Math.min(...found)).toBeLessThan(1.8);
    const mean = found.reduce((t, v) => t + v, 0) / found.length;
    expect(mean).toBeGreaterThan(12 + 2.3);
    expect(mean).toBeLessThan(12 + 4.2);
  });
});

describe('grooves and rakes', () => {
  it('the groove profile is a valley with a low ridge each side and is continuous', () => {
    expect(grooveProfile(0)).toBe(-0.9);
    expect(grooveProfile(0.9)).toBe(-0.9);
    expect(grooveProfile(2.3)).toBe(0);
    expect(grooveProfile(5)).toBe(0);
    let maxV = -1;
    let prev = grooveProfile(0);
    for (let d = 0; d < 3; d += 0.005) {
      const v = grooveProfile(d);
      expect(Math.abs(v - prev)).toBeLessThan(0.03);
      prev = v;
      maxV = Math.max(maxV, v);
    }
    expect(near(maxV, 0.35, 0.01)).toBe(true);
  });

  const valleysAcross = (h: Float32Array, at: (k: number) => number, len: number): number[] => {
    // Cells in a cross-section that are a deep groove, grouped into runs.
    const runs: number[] = [];
    let inRun = false; let start = 0;
    for (let k = 0; k < len; k++) {
      const deep = h[at(k)] < -0.5;
      if (deep && !inRun) { inRun = true; start = k; }
      if ((!deep || k === len - 1) && inRun) { runs.push((start + (deep ? k : k - 1)) / 2); inRun = false; }
    }
    return runs;
  };

  for (const r of RAKES) {
    it(`${r.label}: ${r.tines} tine${r.tines === 1 ? '' : 's'} cut that many grooves, ${TINE_SPACING} apart, across a horizontal stroke`, () => {
      const h = new Float32Array(GRID_W * GRID_H);
      carveRake(h, GRID_W, GRID_H, r.tines, TINE_SPACING, [40, 100, 260, 100]);
      const col = 150;
      const grooves = valleysAcross(h, (k) => k * GRID_W + col, GRID_H);
      expect(grooves.length).toBe(r.tines);
      for (let i = 1; i < grooves.length; i++) expect(Math.abs(grooves[i] - grooves[i - 1] - TINE_SPACING)).toBeLessThanOrEqual(1);
      const mid = grooves.reduce((s, v) => s + v, 0) / grooves.length;
      expect(Math.abs(mid - 99.5)).toBeLessThanOrEqual(1);
    });
  }

  it('grooves run across the direction of travel for vertical and diagonal strokes too', () => {
    const v = new Float32Array(GRID_W * GRID_H);
    carveRake(v, GRID_W, GRID_H, 3, TINE_SPACING, [150, 30, 150, 170]);
    const row = 100;
    const across = valleysAcross(v, (k) => row * GRID_W + k, GRID_W);
    expect(across.length).toBe(3);
    const d = new Float32Array(GRID_W * GRID_H);
    carveRake(d, GRID_W, GRID_H, 3, TINE_SPACING, [60, 30, 240, 170]); // a 45-degree-ish diagonal
    // Grooves are 4 cells apart measured across the stroke, so on a vertical cross-section they are 4 / cos(angle) apart.
    const ang = Math.atan2(140, 180);
    const along = valleysAcross(d, (k) => k * GRID_W + 150, GRID_H);
    expect(along.length).toBe(3);
    expect(Math.abs(along[1] - along[0] - TINE_SPACING / Math.cos(ang))).toBeLessThan(1.2);
  });

  it('a single tap makes a short mark and never throws; heights stay finite and bounded', () => {
    const h = new Float32Array(GRID_W * GRID_H);
    carveRake(h, GRID_W, GRID_H, 9, TINE_SPACING, [150, 100]);
    carveRake(h, GRID_W, GRID_H, 5, TINE_SPACING, []);
    carveRake(h, GRID_W, GRID_H, 5, TINE_SPACING, [0, 0, 300, 200, 0, 200]);
    for (const v of h) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(-0.9 - 1e-6); expect(v).toBeLessThanOrEqual(0.35 + 1e-6); }
    expect(Math.min(...h.slice(0, 50 * GRID_W))).toBeLessThan(-0.5);
  });

  it('carving a growing stroke incrementally equals a full carve at every step, for random strokes of both brushes', () => {
    const base = bakeHeights(starterActions());
    for (let seed = 1; seed <= 9; seed++) {
      const rng = mulberry32(seed * 7919);
      const brush = seed % 3 === 0
        ? ({ kind: 'smooth', r: SMOOTH_RADIUS } as const)
        : ({ kind: 'rake', tines: RAKES[seed % RAKES.length].tines, spacing: TINE_SPACING } as const);
      const carver = newPathCarver(base, brush);
      const p: number[] = [];
      let x = rng() * GRID_W; let y = rng() * GRID_H;
      const out = new Float32Array(GRID_W * GRID_H);
      for (let step = 0; step < 70; step++) {
        // Wander, sometimes doubling straight back, sometimes jumping, so directions turn and reverse.
        const roll = rng();
        if (roll < 0.1 && p.length >= 4) { x = p[p.length - 4]; y = p[p.length - 3]; }
        else if (roll < 0.15) { x = rng() * GRID_W; y = rng() * GRID_H; }
        else { x += (rng() - 0.5) * 14; y += (rng() - 0.5) * 14; }
        tryAddPathPoint(p, x, y, 0);
        if (step % 5 === 0 || step > 66) {
          const full = new Float32Array(base);
          if (brush.kind === 'rake') carveRake(full, GRID_W, GRID_H, brush.tines, brush.spacing, p);
          else smoothPath(full, GRID_W, GRID_H, brush.r, p);
          previewPathCarver(carver, out, GRID_W, GRID_H, p);
          let diff = -1;
          for (let k = 0; k < full.length; k++) if (out[k] !== full[k]) { diff = k; break; }
          expect(diff).toBe(-1);
        }
      }
      // Most of a long stroke is settled and carved once, not again on every move.
      advancePathCarver(carver, GRID_W, GRID_H, p);
      expect(carver.done).toBeGreaterThan(0);
    }
  });

  it('the smoothing brush levels its middle and leaves what is outside its radius alone', () => {
    const h = new Float32Array(GRID_W * GRID_H);
    carveRake(h, GRID_W, GRID_H, 9, TINE_SPACING, [20, 100, 280, 100]);
    const before = new Float32Array(h);
    smoothPath(h, GRID_W, GRID_H, SMOOTH_RADIUS, [150, 100]);
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const d = Math.hypot(x + 0.5 - 150, y + 0.5 - 100);
      const i = y * GRID_W + x;
      if (d <= SMOOTH_RADIUS * 0.55) expect(Math.abs(h[i])).toBe(0);
      else if (d > SMOOTH_RADIUS) expect(h[i]).toBe(before[i]);
      else expect(Math.abs(h[i])).toBeLessThanOrEqual(Math.abs(before[i]) + 1e-9);
    }
  });
});

describe('paths', () => {
  const onPath = (path: number[], x: number, y: number): boolean => {
    for (let i = 2; i < path.length; i += 2) {
      const ax = path[i - 2]; const ay = path[i - 1]; const bx = path[i]; const by = path[i + 1];
      const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2));
      if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) < 1e-9) return true;
    }
    return false;
  };
  it('equal steps along a straight line, both ends kept', () => {
    const out = resamplePath([0, 0, 10, 0], 2);
    expect(out).toEqual([0, 0, 2, 0, 4, 0, 6, 0, 8, 0, 10, 0]);
    const odd = resamplePath([0, 0, 9, 0], 2);
    expect(odd.slice(-2)).toEqual([9, 0]);
    expect(odd.length / 2).toBe(6);
  });
  it('points on a bent path lie on it and count steps by arc length', () => {
    const path = [0, 0, 6, 0, 6, 8, 20, 8];
    const out = resamplePath(path, 1.5);
    for (let i = 0; i < out.length; i += 2) expect(onPath(path, out[i], out[i + 1])).toBe(true);
    const length = 6 + 8 + 14;
    expect(out.length / 2).toBe(Math.floor(length / 1.5) + 1 + (length % 1.5 === 0 ? 0 : 1));
    expect(out.slice(0, 2)).toEqual([0, 0]);
    expect(out.slice(-2)).toEqual([20, 8]);
  });
  it('handles junk: empty, one point (a tap), zero length, zero step', () => {
    expect(resamplePath([], 1)).toEqual([]);
    expect(resamplePath([5, 5], 1)).toEqual([5, 5]);
    expect(resamplePath([1, 1, 1, 1], 1)).toEqual([1, 1]);
    expect(resamplePath([0, 0, 5, 5], 0)).toEqual([]);
    expect(resamplePath([0, 0, 5, 5], NaN)).toEqual([]);
  });
  it('clean points stay inside the grid and path points are thinned and capped', () => {
    expect(cleanPoint(-5, 999)).toEqual([0, GRID_H]);
    expect(cleanPoint(NaN, Infinity)).toEqual([0, 0]);
    expect(cleanPoint(10.04, 20.06)).toEqual([10, 20.1]);
    expect(clampCell(5, 3)).toBe(3);
    const p: number[] = [];
    expect(tryAddPathPoint(p, 10, 10, 0)).toBe(true);
    expect(tryAddPathPoint(p, 10 + MIN_STEP / 2, 10, 0)).toBe(false);
    expect(tryAddPathPoint(p, 10 + MIN_STEP * 1.1, 10, 0)).toBe(true);
    const full: number[] = [];
    for (let i = 0; i < MAX_PATH_POINTS; i++) full.push(i % 300, Math.floor(i / 300) * 3);
    expect(tryAddPathPoint(full, 1, 190, 0)).toBe(false);
    expect(tryAddPathPoint([], 5, 5, MAX_PATH_POINTS_TOTAL)).toBe(false);
  });
});

describe('the list of actions', () => {
  it('undo and redo are exact round trips; a new action clears redo', () => {
    let g = newGarden();
    expect(canUndo(g)).toBe(false);
    expect(undoAction(g)).toBe(g);
    expect(redoAction(g)).toBe(g);
    g = addAction(g, rake(3, [10, 10, 100, 10]));
    g = addAction(g, stone(150, 100, 9));
    const h2 = bakeHeights(g.actions);
    const back = undoAction(g);
    expect(back.actions.length).toBe(1);
    expect(canRedo(back)).toBe(true);
    expect(bakeHeights(redoAction(back).actions)).toEqual(h2);
    const forked = addAction(back, rake(1, [5, 5, 50, 50]));
    expect(canRedo(forked)).toBe(false);
  });
  it('baking is deterministic and equals applying the actions one at a time', () => {
    const actions = starterActions();
    expect(bakeHeights(actions)).toEqual(bakeHeights(actions));
    // Incremental: carve strokes onto a running array exactly as the page does for a live stroke.
    const run = new Float32Array(GRID_W * GRID_H);
    for (const a of actions) if (a.k === 'rake') carveRake(run, GRID_W, GRID_H, a.t, TINE_SPACING, a.p);
    const rakesOnly = bakeHeights(actions.filter((a) => a.k === 'rake'));
    expect(rakesOnly).toEqual(run);
  });
  it('Clear flattens everything and removes stones and moss; later actions build on flat sand', () => {
    const g0 = starterGarden();
    const g1 = addAction(g0, { k: 'clear' });
    expect(Math.max(...bakeHeights(g1.actions).map(Math.abs))).toBe(0);
    expect(itemsOf(g1.actions)).toEqual({ stones: [], moss: [], strokes: 0 });
    const g2 = addAction(g1, rake(3, [10, 100, 200, 100]));
    expect(itemsOf(g2.actions).strokes).toBe(1);
    expect(bakeHeights(g2.actions)).toEqual(bakeHeights([rake(3, [10, 100, 200, 100])]));
    expect(bakeHeights(undoAction(undoAction(g2)).actions)).toEqual(bakeHeights(g0.actions));
  });
  it('is full after MAX_ACTIONS or too many path points, but Clear still works and makes room', () => {
    let g = newGarden();
    for (let i = 0; i < MAX_ACTIONS + 20; i++) g = addAction(g, rake(1, [1, 1, 5, 5]));
    expect(g.actions.length).toBe(MAX_ACTIONS);
    expect(hasRoom(g)).toBe(false);
    expect(addAction(g, rake(1, [1, 1])).actions.length).toBe(MAX_ACTIONS);
    const cleared = addAction(g, { k: 'clear' });
    expect(cleared.actions.length).toBe(MAX_ACTIONS + 1);
    expect(liveActions(cleared.actions)).toEqual([]);
    expect(hasRoom(cleared)).toBe(true);
    let p = newGarden();
    const long: number[] = [];
    for (let i = 0; i < 1000; i++) long.push(i % 300, 50);
    for (let i = 0; i < 40; i++) p = addAction(p, rake(1, long));
    expect(pathPointsUsed(p.actions)).toBeLessThanOrEqual(MAX_PATH_POINTS_TOTAL + 1000);
    expect(hasRoom(p)).toBe(false);
    expect(hasRoom(addAction(p, { k: 'clear' }))).toBe(true);
  });
  it('keeps at most MAX_HISTORY actions by dropping what is older than the last Clear', () => {
    let g = newGarden();
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 200; i++) g = addAction(g, rake(1, [1, 1, 3, 3]));
      g = addAction(g, { k: 'clear' });
    }
    expect(g.actions.length).toBeLessThanOrEqual(MAX_HISTORY + 1);
    expect(g.actions[g.actions.length - 1].k).toBe('clear');
  });
  it('describes the garden in plain words', () => {
    expect(describeItems([])).toBe('Smooth sand');
    expect(describeItems(starterActions())).toBe('2 rake lines, 3 stones, 2 patches of moss');
    expect(describeItems([stone(50, 50, 9), { k: 'moss', x: 80, y: 80, r: 8, seed: 1 }, rake(1, [1, 1])])).toBe('1 rake line, 1 stone, 1 patch of moss');
    expect(shareText([])).toMatch(/smooth sand/);
    expect(shareText(starterActions())).toBe('Zen Garden: 2 rake lines, 3 stones, 2 patches of moss');
  });
});

describe('stones and moss', () => {
  it('a stone needs room: not over the edge, not touching another, and at most MAX_STONES', () => {
    expect(stoneProblem([], 150, 100, 9)).toBeNull();
    expect(stoneProblem([], 5, 100, 9)).toMatch(/edge/);
    expect(stoneProblem([], 150, 195, 9)).toMatch(/edge/);
    expect(stoneProblem([], NaN, 100, 9)).toMatch(/edge/);
    const a = stone(100, 100, 9);
    expect(stoneProblem([a], 100 + 9 + 9 + 1, 100, 9)).toMatch(/touch/);
    expect(stoneProblem([a], 100 + 9 + 9 + 2, 100, 9)).toBeNull();
    const many: Action[] = Array.from({ length: MAX_STONES }, (_, i) => stone(20 + (i % 6) * 50, 30 + Math.floor(i / 6) * 100, 8, i));
    expect(stoneProblem(many, 150, 100, 6)).toMatch(/most/);
    expect(stoneProblem([...many, { k: 'clear' }], 150, 100, 6)).toBeNull();
    for (const k of SIZE_KEYS) expect(STONE_RADIUS[k]).toBeLessThan(MOSS_RADIUS[k] + 5);
  });
  it('moss may overlap stones but not hang off the garden, and has a limit', () => {
    expect(mossProblem([stone(100, 100, 9)], 100, 100, 12)).toBeNull();
    expect(mossProblem([], 1, 100, 12)).toMatch(/edge/);
    const patches: Action[] = Array.from({ length: MAX_MOSS }, (_, i) => ({ k: 'moss', x: 30 + i * 15, y: 100, r: 8, seed: i }));
    expect(mossProblem(patches, 150, 50, 8)).toMatch(/most/);
  });
  it('stone shapes come from the seed and stay inside their radius', () => {
    for (const r of [6, 9, 13]) for (let seed = 0; seed < 200; seed++) {
      const poly = stonePolygon(seed, r);
      expect(poly.length).toBe(STONE_VERTICES);
      for (const p of poly) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(r + 1e-9);
    }
    expect(stonePolygon(7, 9)).toEqual(stonePolygon(7, 9));
    expect(stonePolygon(7, 9)).not.toEqual(stonePolygon(8, 9));
  });
  it('moss dots are deterministic, count 2.2 per unit of radius, and spread evenly over the disc', () => {
    expect(mossCount(10)).toBe(22);
    expect(mossDots(12, 3)).toEqual(mossDots(12, 3));
    let sum = 0; let n = 0;
    for (let seed = 0; seed < 300; seed++) {
      const dots = mossDots(17, seed);
      expect(dots.length).toBe(mossCount(17));
      for (const d of dots) {
        expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(17 + 1e-9);
        expect([0, 1, 2]).toContain(d.tone);
        expect(d.size).toBeGreaterThanOrEqual(0.8);
        expect(d.size).toBeLessThanOrEqual(2.4);
        sum += Math.hypot(d.dx, d.dy); n++;
      }
    }
    // For a uniform disc the mean distance from the middle is 2/3 of the radius.
    expect(Math.abs(sum / n / 17 - 2 / 3)).toBeLessThan(0.03);
  });
});

describe('the starting garden and the lighting', () => {
  it('has two rake lines, three stones and two patches of moss, all placed legally', () => {
    const acts = starterActions();
    const it2 = itemsOf(acts);
    expect(it2.strokes).toBe(2);
    expect(it2.stones.length).toBe(3);
    expect(it2.moss.length).toBe(2);
    const placed: Action[] = [];
    for (const a of acts) {
      if (a.k === 'stone') expect(stoneProblem(placed, a.x, a.y, a.r)).toBeNull();
      if (a.k === 'moss') expect(mossProblem(placed, a.x, a.y, a.r)).toBeNull();
      placed.push(a);
    }
    const h = bakeHeights(acts);
    for (const v of h) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(-0.91); expect(v).toBeLessThanOrEqual(0.36); }
    expect(hasRoom(starterGarden())).toBe(true);
  });
  it('light comes from the upper left: the right wall of a groove is lit and the left wall is dark', () => {
    const h = new Float32Array(GRID_W * GRID_H);
    carveRake(h, GRID_W, GRID_H, 1, TINE_SPACING, [150, 20, 150, 180]);
    const y = 100;
    const left = shadeAt(h, GRID_W, GRID_H, 148, y);
    const right = shadeAt(h, GRID_W, GRID_H, 151, y);
    expect(right).toBeGreaterThan(left);
    expect(shadeAt(h, GRID_W, GRID_H, 40, y)).toBe(Math.round(0.56 * (SHADES - 1)));
    for (let x = 0; x < GRID_W; x += 7) for (let yy = 0; yy < GRID_H; yy += 7) {
      const s = shadeAt(h, GRID_W, GRID_H, x, yy);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(SHADES);
      expect(Number.isInteger(s)).toBe(true);
    }
  });
  it('the shade ramp runs from the first colour to the second', () => {
    const r = ramp([0, 0, 0], [255, 255, 255], 5);
    expect(r.length).toBe(5);
    expect(r[0]).toEqual([0, 0, 0]);
    expect(r[4]).toEqual([255, 255, 255]);
    expect(ramp([1, 2, 3], [9, 9, 9], 1)).toEqual([[1, 2, 3]]);
  });
});

describe('sanitisers, cursor and colour kit', () => {
  it('rejects junk choices', () => {
    for (const v of ['pen', '', null, undefined, 3, {}, [], '__proto__']) { expect(isTool(v)).toBe(false); expect(isRakeId(v)).toBe(false); expect(isSizeKey(v)).toBe(false); }
    expect(TOOLS.every(isTool)).toBe(true);
    expect(RAKES.map((r) => r.tines)).toEqual([1, 3, 5, 9]);
    expect(rakeById('nonsense').id).toBe('medium');
    expect(moveCursor({ x: 1, y: 1 }, -50, -50)).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: 299, y: 199 }, 50, 50)).toEqual({ x: GRID_W, y: GRID_H });
  });
  it('the colour kit parses and mixes', () => {
    expect(parseColour('#fbbf24')).toEqual([251, 191, 36]);
    expect(parseColour('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColour('nope')).toBeNull();
    expect(toCss([251, 191, 36])).toBe('#fbbf24');
    expect(mixOklch([0, 0, 0], [255, 255, 255], 0.5)).not.toEqual([0, 0, 0]);
    expect(neutral(0.5).every((v) => v > 50 && v < 200)).toBe(true);
  });
  it('words carry no em-dash', () => {
    for (const t of RULES) expect(t.includes('—')).toBe(false);
    expect(RULES.join(' ')).toMatch(/300 by 200/);
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('sizes the canvas from its box times a capped pixel ratio and redraws on resize', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/ResizeObserver/);
    expect(src).toMatch(/getComputedStyle/);
  });
  it('handles pointer cancel and multi-touch, with touch-action none on the canvas stage only', () => {
    expect(src).toMatch(/pointercancel/);
    expect(src).toMatch(/isPrimary/);
    expect(src.match(/touch-action:\s*none/g)?.length).toBe(1);
  });
  it('has a keyboard path and a live status line, no sound, no storage, no download', () => {
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).not.toMatch(/AudioContext|localStorage|toBlob|createObjectURL/);
    expect(src).toMatch(/Nothing to download/);
    expect(src).toMatch(/there is no sound|no sound/i);
  });
});
