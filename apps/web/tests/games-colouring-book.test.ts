/**
 * games-colouring-book.test.ts - the engine behind `colouring-book`.
 *
 * Pinned: every scene is a partition of the sheet (the regions, stacked back to front, cover every
 * point of a 200 x 200 sample grid, visible areas add up to the whole sheet, and each visible part
 * is at least 80 square units so it can be tapped), polygons are simple and inside the sheet,
 * point-in-polygon against an independent winding-number oracle, the painting model (colour,
 * rub out, clear, undo, redo, history cap) against a naive snapshot-list model on thousands of
 * random operations, the 12-colour palette is unique (names, and the mixes written in the page's
 * CSS), keyboard movement reaches every region, saved-progress sanitising, kind wording, and the
 * numbers quoted on the guide page.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  SCENES, SCENE_IDS, BOX, MIN_VISIBLE_AREA, HISTORY_LIMIT, TAP_SLOP_PX, PALETTE, NO_COLOUR, ALL_DONE_MASK,
  mulberry32, isColour, pointInPolygon, polygonArea, isSimplePolygon, regionAt, visibleAreas, uncoveredPoints, visibleCentres, readingOrder,
  validateScene, sceneById, indexOfScene, parseSceneParam,
  newPaint, paintRegion, clearAll, canUndo, canRedo, undo, redo, filledCount, isComplete,
  sanitiseDone, isDone, withDone, doneCount, nextScene, surpriseScene, cursorTarget, stepColour,
  colourName, partsMessage, paintedMessage, alreadyMessage, rubbedMessage, blankMessage, completeMessage, nothingMessage, regionLabel, swatchLabel,
  exportFileName, shareText,
  type Scene, type Pt, type PaintState,
} from '../src/components/apps-private/colouring-book/helpers';

const sq = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

describe('the scenes', () => {
  it('quotes the tap slop and size limits the page states', () => {
    expect(TAP_SLOP_PX).toBe(10);
    expect(MIN_VISIBLE_AREA).toBe(80);
    expect(HISTORY_LIMIT).toBe(200);
    expect(BOX).toBe(100);
  });

  it('has 6 scenes with unique ids, names and emoji, 16 to 25 regions each', () => {
    expect(SCENES).toHaveLength(6);
    expect(new Set(SCENE_IDS).size).toBe(6);
    expect(new Set(SCENES.map((s) => s.name)).size).toBe(6);
    expect(new Set(SCENES.map((s) => s.emoji)).size).toBe(6);
    expect(SCENES.map((s) => s.regions.length)).toEqual([18, 19, 19, 25, 17, 16]);
    for (const s of SCENES) {
      expect(s.regions.length).toBeGreaterThanOrEqual(16);
      expect(s.regions.length).toBeLessThanOrEqual(25);
    }
  });

  it.each(SCENES.map((s) => [s.id, s] as const))('%s passes the scene check', (_id, s) => {
    expect(validateScene(s)).toEqual([]);
  });

  it.each(SCENES.map((s) => [s.id, s] as const))('%s: the regions partition the sheet (200 x 200 sample points, none uncovered, visible areas sum to 10000)', (_id, s) => {
    expect(uncoveredPoints(s, 0.5)).toBe(0);
    const areas = visibleAreas(s, 0.5);
    expect(areas.reduce((a, b) => a + b, 0)).toBeCloseTo(BOX * BOX, 6);
    // Independent count: every sample point is claimed by exactly one "topmost" region.
    const claimed = new Array(s.regions.length).fill(0);
    for (let y = 0.25; y < 100; y += 0.5) {
      for (let x = 0.25; x < 100; x += 0.5) {
        let top = -1;
        for (let i = 0; i < s.regions.length; i++) if (pointInPolygon(x, y, s.regions[i].pts)) top = i; // forward scan, last hit wins
        expect(top).toBeGreaterThanOrEqual(0);
        claimed[top] += 0.25;
      }
    }
    for (let i = 0; i < claimed.length; i++) expect(claimed[i]).toBeCloseTo(areas[i], 6);
  });

  it.each(SCENES.map((s) => [s.id, s] as const))('%s: every visible part is at least 80 square units and region names are unique and plain', (_id, s) => {
    const areas = visibleAreas(s);
    areas.forEach((a, i) => expect(a, `${s.regions[i].name}: ${a}`).toBeGreaterThanOrEqual(MIN_VISIBLE_AREA));
    const names = s.regions.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const r of s.regions) expect(r.name).toMatch(/^[A-Z][A-Za-z0-9 ]*$/);
  });

  it.each(SCENES.map((s) => [s.id, s] as const))('%s: polygons are simple, inside the sheet, first region is the whole sheet', (_id, s) => {
    expect(polygonArea(s.regions[0].pts)).toBeCloseTo(BOX * BOX, 9);
    for (const r of s.regions) {
      expect(isSimplePolygon(r.pts), r.name).toBe(true);
      for (const p of r.pts) {
        expect(p[0]).toBeGreaterThanOrEqual(0);
        expect(p[0]).toBeLessThanOrEqual(BOX);
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(p[1]).toBeLessThanOrEqual(BOX);
      }
    }
  });

  it('the scene checker really catches bad scenes', () => {
    const base: Scene = {
      id: 'bad', name: 'Bad', emoji: 'x',
      regions: [
        { name: 'Sky', pts: sq(0, 0, 100, 100) },
        ...Array.from({ length: 12 }, (_, i) => ({ name: `Box ${i + 1}`, pts: sq(5 + (i % 4) * 22, 5 + Math.floor(i / 4) * 22, 15, 15) })),
      ],
    };
    expect(validateScene(base)).toEqual([]);
    expect(validateScene({ ...base, regions: base.regions.slice(0, 5) }).join()).toMatch(/region count/);
    expect(validateScene({ ...base, regions: [{ name: 'Sky', pts: sq(0, 0, 90, 100) }, ...base.regions.slice(1)] }).join()).toMatch(/whole sheet|no region/);
    expect(validateScene({ ...base, regions: [...base.regions.slice(0, 2), { name: 'sky', pts: sq(50, 50, 20, 20) }, ...base.regions.slice(3)] }).join()).toMatch(/repeats the name/);
    expect(validateScene({ ...base, regions: [...base.regions, { name: 'Tiny', pts: sq(80, 80, 3, 3) }] }).join()).toMatch(/shows only/);
    expect(validateScene({ ...base, regions: [...base.regions, { name: 'Bow', pts: [[60, 60], [80, 80], [80, 60], [60, 80]] }] }).join()).toMatch(/crosses itself/);
    expect(validateScene({ ...base, regions: [...base.regions, { name: 'Off', pts: sq(90, 90, 20, 20) }] }).join()).toMatch(/outside the sheet/);
    expect(validateScene({ ...base, regions: [...base.regions, { name: 'Line', pts: [[1, 1], [2, 2]] }] }).join()).toMatch(/fewer than 3/);
    const hole: Scene = { ...base, regions: [{ name: 'Half', pts: sq(0, 0, 100, 100) }, ...base.regions.slice(1)] };
    expect(validateScene(hole)).toEqual([]);
    // A first region that is a full-sheet polygon but with a gap cannot exist (polygons have no holes), so uncovered points come from a short first region.
    expect(uncoveredPoints({ ...base, regions: [{ name: 'Sky', pts: sq(0, 0, 100, 50) }] })).toBeGreaterThan(0);
  });

  it('finds the region on top (a later region covers an earlier one) and -1 off the sheet or for junk', () => {
    const s = sceneById('house')!;
    const sky = s.regions.findIndex((r) => r.name === 'Sky');
    const roof = s.regions.findIndex((r) => r.name === 'Roof');
    const wall = s.regions.findIndex((r) => r.name === 'Wall');
    const door = s.regions.findIndex((r) => r.name === 'Door');
    expect(regionAt(s, 50, 30)).toBe(roof);
    expect(regionAt(s, 30, 70)).toBe(wall);
    expect(regionAt(s, 50, 70)).toBe(door);
    expect(regionAt(s, 3, 3)).toBe(sky);
    expect(regionAt(s, -5, 50)).toBe(-1);
    expect(regionAt(s, 105, 50)).toBe(-1);
    expect(regionAt(s, NaN, 50)).toBe(-1);
    expect(regionAt(s, 50, Infinity)).toBe(-1);
  });
});

describe('geometry against independent oracles', () => {
  // Winding number oracle: sum of angles subtended by each edge.
  const winding = (x: number, y: number, poly: readonly Pt[]): boolean => {
    let total = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const a1 = Math.atan2(a[1] - y, a[0] - x);
      const a2 = Math.atan2(b[1] - y, b[0] - x);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      total += d;
    }
    return Math.abs(total) > Math.PI;
  };

  it('point in polygon agrees with the winding-number oracle on random star-shaped polygons', () => {
    const rng = mulberry32(21);
    for (let t = 0; t < 120; t++) {
      const n = 5 + Math.floor(rng() * 9);
      const cx = 30 + rng() * 40;
      const cy = 30 + rng() * 40;
      // Star-shaped around (cx, cy): increasing angles, random radii. Always a simple polygon.
      const poly: Pt[] = Array.from({ length: n }, (_, i) => {
        const a = ((i + rng() * 0.6) / n) * Math.PI * 2;
        const r = 8 + rng() * 25;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
      });
      for (let k = 0; k < 60; k++) {
        const x = rng() * 100 + 0.0001;
        const y = rng() * 100 + 0.0001;
        expect(pointInPolygon(x, y, poly)).toBe(winding(x, y, poly));
      }
    }
  });

  it('on every scene, point in polygon agrees with the oracle on 3000 random points per region', () => {
    const rng = mulberry32(5);
    for (const s of SCENES) {
      for (const r of s.regions) {
        for (let k = 0; k < 60; k++) {
          const x = rng() * 100 + 0.00013;
          const y = rng() * 100 + 0.00017;
          expect(pointInPolygon(x, y, r.pts), `${s.id}/${r.name}`).toBe(winding(x, y, r.pts));
        }
      }
    }
  });

  it('polygon area is exact for rectangles and close to pi r squared for the 28-gon circles', () => {
    expect(polygonArea(sq(0, 0, 10, 4))).toBe(40);
    expect(polygonArea(sq(5, 5, 100, 100))).toBe(10000);
    expect(polygonArea([[0, 0], [10, 0], [0, 10]])).toBe(50);
    const sun = sceneById('house')!.regions.find((r) => r.name === 'Sun')!;
    expect(polygonArea(sun.pts)).toBeGreaterThan(Math.PI * 81 * 0.97);
    expect(polygonArea(sun.pts)).toBeLessThan(Math.PI * 81);
  });

  it('a bow tie is not simple, a square and an L shape are', () => {
    expect(isSimplePolygon([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(false);
    expect(isSimplePolygon(sq(0, 0, 5, 5))).toBe(true);
    expect(isSimplePolygon([[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]])).toBe(true);
    expect(isSimplePolygon([[0, 0], [1, 1]])).toBe(false);
  });
});

describe('keyboard order and cursor', () => {
  it('reading order is a permutation of the regions, in top-to-bottom bands', () => {
    for (const s of SCENES) {
      const order = readingOrder(s);
      expect([...order].sort((a, b) => a - b)).toEqual(s.regions.map((_, i) => i));
      const c = visibleCentres(s);
      for (let i = 1; i < order.length; i++) expect(Math.floor(c[order[i]][1] / 12)).toBeGreaterThanOrEqual(Math.floor(c[order[i - 1]][1] / 12));
    }
  });

  it('every region is reachable by the Right arrow from the first, and the cursor stops at the ends', () => {
    for (const s of SCENES) {
      const count = s.regions.length;
      const seen = new Set<number>([0]);
      let pos = 0;
      for (let g = 0; g < count + 2; g++) {
        const to = cursorTarget('ArrowRight', pos, count);
        if (to === null) break;
        seen.add(to);
        pos = to;
      }
      expect(seen.size).toBe(count);
      expect(cursorTarget('ArrowRight', count - 1, count)).toBeNull();
      expect(cursorTarget('ArrowLeft', 0, count)).toBeNull();
    }
  });

  it('maps the keys and ignores junk', () => {
    expect(cursorTarget('ArrowDown', 3, 10)).toBe(4);
    expect(cursorTarget('ArrowUp', 3, 10)).toBe(2);
    expect(cursorTarget('Home', 3, 10)).toBe(0);
    expect(cursorTarget('End', 3, 10)).toBe(9);
    expect(cursorTarget('Home', 0, 10)).toBeNull();
    expect(cursorTarget('End', 9, 10)).toBeNull();
    for (const k of ['a', 'Enter', ' ', 'Tab', '']) expect(cursorTarget(k, 3, 10)).toBeNull();
    expect(cursorTarget('ArrowRight', -1, 10)).toBeNull();
    expect(cursorTarget('ArrowRight', 10, 10)).toBeNull();
    expect(cursorTarget('ArrowRight', 1.5, 10)).toBeNull();
  });

  it('steps through the 12 colours with wrap-around', () => {
    expect(stepColour(0, 1)).toBe(1);
    expect(stepColour(11, 1)).toBe(0);
    expect(stepColour(0, -1)).toBe(11);
    expect(stepColour(5, -1)).toBe(4);
    expect(stepColour(-4, 1)).toBe(1); // junk falls back to the first colour
    expect(stepColour(99, 1)).toBe(1);
  });
});

describe('the palette', () => {
  it('has 12 colours with unique ids and unique plain names', () => {
    expect(PALETTE).toHaveLength(12);
    expect(PALETTE.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(new Set(PALETTE.map((c) => c.name)).size).toBe(12);
    for (const c of PALETTE) expect(c.name).toMatch(/^[A-Z][a-z ]+$/);
  });

  it('defines 12 different colour mixes in the page CSS, each built only from the site accent tokens and the theme ink', () => {
    const calc = readFileSync(join(resolve(__dirname, '..'), 'src/components/apps-private/colouring-book/Calculator.astro'), 'utf8');
    const defs = [...calc.matchAll(/--p(\d+):\s*([^;]+);/g)];
    expect(defs.map((m) => Number(m[1])).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const values = defs.map((m) => m[2].trim().replace(/\s+/g, ' '));
    expect(new Set(values).size).toBe(12);
    for (const v of values) {
      expect(v).toMatch(/^(var\(--g-[a-z]+\)|color-mix\(in oklch, [^;]+\))$/);
      expect(v).not.toMatch(/#|rgb|hsl|\bwhite\b|\bblack\b/i);
    }
  });

  it('knows which numbers are colours', () => {
    for (let i = 0; i < 12; i++) expect(isColour(i)).toBe(true);
    for (const v of [-1, 12, 1.5, NaN, Infinity, '3', null, undefined, [], {}]) expect(isColour(v)).toBe(false);
    expect(colourName(4)).toBe('Yellow');
    expect(colourName(-1)).toBe('no colour');
    expect(colourName(99)).toBe('no colour');
  });
});

describe('painting model', () => {
  it('starts blank, colours a region, rubs it out, and ignores junk', () => {
    let s = newPaint(5);
    expect(s.fills).toEqual([-1, -1, -1, -1, -1]);
    expect(filledCount(s)).toBe(0);
    expect(canUndo(s)).toBe(false);
    s = paintRegion(s, 2, 7);
    expect(s.fills).toEqual([-1, -1, 7, -1, -1]);
    expect(filledCount(s)).toBe(1);
    expect(paintRegion(s, 2, 7)).toBe(s); // same colour: nothing changes, no history entry
    const r = paintRegion(s, 2, NO_COLOUR);
    expect(r.fills[2]).toBe(-1);
    for (const bad of [[-1, 3], [5, 3], [1.5, 3], [NaN, 3], [1, 12], [1, -2], [1, 2.5], [1, NaN], [1, Infinity]] as const) expect(paintRegion(s, bad[0], bad[1])).toBe(s);
    expect(newPaint(-4).fills).toEqual([]);
    expect(newPaint(NaN).fills).toEqual([]);
    expect(newPaint(1e9).fills.length).toBe(1000);
  });

  it('never mutates the old state', () => {
    const a = newPaint(4);
    const b = paintRegion(a, 1, 3);
    const c = paintRegion(b, 2, 4);
    expect(a.fills).toEqual([-1, -1, -1, -1]);
    expect(b.fills).toEqual([-1, 3, -1, -1]);
    expect(c.fills).toEqual([-1, 3, 4, -1]);
    expect(Object.isFrozen(c.fills)).toBe(false);
    const u = undo(c);
    expect(c.fills).toEqual([-1, 3, 4, -1]);
    expect(u.fills).toEqual([-1, 3, -1, -1]);
  });

  it('undo and redo round-trip exactly, and a new colouring clears redo', () => {
    let s = newPaint(3);
    s = paintRegion(s, 0, 1);
    s = paintRegion(s, 1, 2);
    s = paintRegion(s, 0, 5);
    expect(s.fills).toEqual([5, 2, -1]);
    s = undo(s);
    expect(s.fills).toEqual([1, 2, -1]);
    expect(canRedo(s)).toBe(true);
    s = undo(s);
    s = undo(s);
    expect(s.fills).toEqual([-1, -1, -1]);
    expect(canUndo(s)).toBe(false);
    expect(undo(s)).toBe(s);
    s = redo(s);
    s = redo(s);
    s = redo(s);
    expect(s.fills).toEqual([5, 2, -1]);
    expect(canRedo(s)).toBe(false);
    expect(redo(s)).toBe(s);
    s = undo(s);
    s = paintRegion(s, 2, 9);
    expect(canRedo(s)).toBe(false);
  });

  it('clear is one undoable step, and does nothing to a blank sheet', () => {
    const blank = newPaint(4);
    expect(clearAll(blank)).toBe(blank);
    let s = paintRegion(paintRegion(blank, 0, 1), 3, 2);
    s = clearAll(s);
    expect(s.fills).toEqual([-1, -1, -1, -1]);
    s = undo(s);
    expect(s.fills).toEqual([1, -1, -1, 2]);
    s = redo(s);
    expect(s.fills).toEqual([-1, -1, -1, -1]);
  });

  it('tells when every region is coloured', () => {
    let s = newPaint(3);
    expect(isComplete(s)).toBe(false);
    s = paintRegion(paintRegion(paintRegion(s, 0, 0), 1, 1), 2, 2);
    expect(isComplete(s)).toBe(true);
    expect(isComplete(undo(s))).toBe(false);
    expect(isComplete(newPaint(0))).toBe(false);
  });

  it('matches a naive snapshot-list model over 4000 random operations (history capped at 200)', () => {
    const rng = mulberry32(2026);
    const n = 7;
    let s = newPaint(n);
    let hist: number[][] = [new Array(n).fill(-1)];
    let idx = 0;
    const cap = HISTORY_LIMIT + 1;
    for (let step = 0; step < 4000; step++) {
      const op = rng();
      if (op < 0.6) {
        const region = Math.floor(rng() * n);
        const colour = rng() < 0.15 ? -1 : Math.floor(rng() * 12);
        s = paintRegion(s, region, colour);
        if (hist[idx][region] !== colour) {
          const next = hist[idx].slice();
          next[region] = colour;
          hist = hist.slice(0, idx + 1);
          hist.push(next);
          if (hist.length > cap) hist = hist.slice(hist.length - cap);
          idx = hist.length - 1;
        }
      } else if (op < 0.78) {
        s = undo(s);
        if (idx > 0) idx--;
      } else if (op < 0.93) {
        s = redo(s);
        if (idx < hist.length - 1) idx++;
      } else {
        s = clearAll(s);
        if (hist[idx].some((c) => c !== -1)) {
          hist = hist.slice(0, idx + 1);
          hist.push(new Array(n).fill(-1));
          if (hist.length > cap) hist = hist.slice(hist.length - cap);
          idx = hist.length - 1;
        }
      }
      expect([...s.fills]).toEqual(hist[idx]);
      expect(canUndo(s)).toBe(idx > 0);
      expect(canRedo(s)).toBe(idx < hist.length - 1);
      expect(s.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    }
  }, 30_000);

  it('keeps at most 200 steps of history', () => {
    let s = newPaint(2);
    for (let i = 0; i < 500; i++) s = paintRegion(s, i % 2, Math.floor(i / 2) % 12); // every call really changes a colour
    expect(s.past.length).toBe(HISTORY_LIMIT);
    let steps = 0;
    while (canUndo(s)) { s = undo(s); steps++; }
    expect(steps).toBe(HISTORY_LIMIT);
  });

  it('end to end on every scene: a tap on any visible spot of a region colours exactly that region, and all of them gets the picture finished', () => {
    for (const scene of SCENES) {
      let s = newPaint(scene.regions.length);
      const spot = new Map<number, [number, number]>();
      for (let y = 0.5; y < 100; y += 1) for (let x = 0.5; x < 100; x += 1) { const i = regionAt(scene, x, y); if (i >= 0 && !spot.has(i)) spot.set(i, [x, y]); }
      expect(spot.size).toBe(scene.regions.length); // every region has a visible spot a tap can land on
      for (let i = 0; i < scene.regions.length; i++) {
        const [x, y] = spot.get(i)!;
        expect(regionAt(scene, x, y)).toBe(i);
        const next = paintRegion(s, regionAt(scene, x, y), i % 12);
        expect(filledCount(next)).toBe(filledCount(s) + 1);
        s = next;
      }
      expect(isComplete(s)).toBe(true);
    }
  });
});

describe('saved progress', () => {
  it('keeps a whole-number mask in range and nothing else', () => {
    expect(ALL_DONE_MASK).toBe(63);
    expect(sanitiseDone({ d: 5 })).toEqual({ d: 5 });
    expect(sanitiseDone({ d: 63 })).toEqual({ d: 63 });
    expect(sanitiseDone({ d: 64 })).toEqual({ d: 0 });
    for (const junk of [null, undefined, 3, 'x', [], [1], { d: -1 }, { d: 1.5 }, { d: NaN }, { d: Infinity }, { d: '5' }, { d: 1e12 }, { x: 4 }, JSON.parse('{"__proto__":{"d":3}}')]) {
      expect(sanitiseDone(junk)).toEqual({ d: 0 });
    }
    expect(Object.keys(sanitiseDone({ d: 3, extra: 'x' }))).toEqual(['d']);
  });

  it('sets, tests and counts finished pictures, and picks the next and a surprise one', () => {
    let m = 0;
    m = withDone(withDone(m, 0), 4);
    expect(isDone(m, 4)).toBe(true);
    expect(isDone(m, 1)).toBe(false);
    expect(isDone(m, 9)).toBe(false);
    expect(withDone(m, -1)).toBe(m);
    expect(withDone(m, 6)).toBe(m);
    expect(doneCount(m)).toBe(2);
    expect(nextScene(0, 0)).toBe(1);
    expect(nextScene(withDone(0, 1), 0)).toBe(2);
    expect(nextScene(ALL_DONE_MASK, 5)).toBe(0);
    expect(nextScene(ALL_DONE_MASK - 1, 3)).toBe(0);
    expect(nextScene(0, -1)).toBe(0);
    const rng = mulberry32(4);
    for (let i = 0; i < 200; i++) {
      const mask = Math.floor(rng() * 63);
      const not = Math.floor(rng() * 6);
      const pick = surpriseScene(mask, not, rng);
      expect(pick).not.toBe(not);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(6);
      if (SCENES.some((_, j) => j !== not && !isDone(mask, j))) expect(isDone(mask, pick)).toBe(false);
    }
  });

  it('reads the scene from the page address safely', () => {
    expect(parseSceneParam('robot')).toBe('robot');
    for (const junk of ['', 'ROBOT', '__proto__', 'constructor', 5, null, undefined, [], {}]) expect(parseSceneParam(junk)).toBeNull();
    expect(indexOfScene('fish')).toBe(1);
    expect(indexOfScene('x')).toBe(-1);
    expect(sceneById('nope')).toBeNull();
  });
});

describe('words for the child', () => {
  it('praises a colouring and says what is left', () => {
    expect(paintedMessage('Roof', 6, 4, 18)).toBe('Super! The roof is now red. 4 of 18 parts coloured.');
    expect(paintedMessage('Left window', 0, 1, 18)).toBe('Nice! The left window is now light blue. 1 of 18 parts coloured.');
    expect(partsMessage(0, 18)).toBe('0 of 18 parts coloured');
    expect(alreadyMessage('Roof', 6)).toBe('The roof is already red. Try another part, or another colour.');
    expect(rubbedMessage('Roof', 3, 18)).toBe('The roof is blank again. 3 of 18 parts coloured.');
    expect(blankMessage('Door')).toBe('The door is already blank.');
    expect(completeMessage('House', 18)).toBe('You coloured all 18 parts of the house!');
    expect(nothingMessage()).toMatch(/Tap one of the shapes/);
  });

  it('never scolds', () => {
    const all = [paintedMessage('Roof', 6, 4, 18), alreadyMessage('Roof', 6), rubbedMessage('Roof', 3, 18), blankMessage('Door'), completeMessage('House', 18), nothingMessage()];
    for (const m of all) expect(m).not.toMatch(/wrong|fail|bad|oops|incorrect|error/i);
  });

  it('labels a region and a swatch for a screen reader', () => {
    expect(regionLabel('Roof', -1)).toBe('Roof, not coloured yet');
    expect(regionLabel('Roof', 6)).toBe('Roof, Red');
    expect(swatchLabel(0)).toBe('Colour 1, Light blue');
    expect(swatchLabel(11)).toBe('Colour 12, Grey');
  });

  it('names the saved file safely and writes correct share text', () => {
    expect(exportFileName('house')).toBe('colouring-book-house.png');
    expect(exportFileName('../evil')).toBe('colouring-book-picture.png');
    expect(exportFileName('')).toBe('colouring-book-picture.png');
    expect(shareText('House', 0, 18, 'U')).toBe('Colouring Book - House: 0 of 18 parts coloured\nU');
    expect(shareText('House', 7, 18, 'U')).toBe('Colouring Book - House: 7 of 18 parts coloured\nU');
    expect(shareText('House', 18, 18, 'U')).toBe('Colouring Book - House: all 18 parts coloured\nU');
  });
});

describe('seeded randomness', () => {
  it('gives the same numbers for the same seed and stays in [0, 1)', () => {
    const a = mulberry32(9), b = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// A type-level use so the helper types stay exported.
const _typeCheck: PaintState = newPaint(1);
void _typeCheck;
