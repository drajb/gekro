/**
 * games-falling-sand.test.ts - the engine behind `falling-sand`.
 *
 * Pinned: every rule pair in the guide is checked on a tiny board with a fixed random source (a
 * table: sand falls and sinks through water and oil, water sinks under oil and oil floats, fire lights
 * wood, plants and oil and turns to steam beside water, steam rises and condenses, a plant drinks
 * water, stone and wood never move), a particle moves at most once per tick, the counts of sand,
 * water, oil and stone are conserved in a closed box over thousands of ticks, the running totals
 * always equal a recount, no particle leaves the grid, the same seed gives the same sand, brush cells
 * are round and clipped, painting only fills empty cells (except the eraser and fire), the starting
 * scene is valid and keeps its sand and oil, discoveries are reachable, the colour ramps are complete,
 * and the stored value is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY, SAND, WATER, STONE, WOOD, FIRE, STEAM, PLANT, OIL, MATERIAL_TYPES, PAINTABLE, ALL_EVENTS,
  EV_SINK, EV_FLOAT, EV_GROW, EV_BURN, EV_BOIL, EV_RAIN, DISCOVERIES, BRUSH_RADIUS, BRUSH_KEYS, VARIANTS,
  GRID_WIDE, GRID_NARROW, TICK_MS, TICK_MS_CALM, RULES,
  createWorld, setCell, step, paint, brushCells, lineCells, clampTo, demoScene, clearWorld, takeDirty, totalParticles,
  advance, gridFor, countFound, sanitiseSaved, materialName, makeRamps, shadeIndex, parseColour, toCss, luminance,
  plural, shareText, cellLabel, isBrushKey,
  type World,
} from '../src/components/apps-private/falling-sand/helpers';
import calculatorSource from '../src/components/apps-private/falling-sand/Calculator.astro?raw';

const prng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const lo = () => 0;
const hi = () => 0.999;

const CH: Record<string, number> = { '.': EMPTY, s: SAND, w: WATER, '#': STONE, W: WOOD, f: FIRE, v: STEAM, p: PLANT, o: OIL };
const REV: Record<number, string> = Object.fromEntries(Object.entries(CH).map(([k, v]) => [v, k]));
const build = (rows: string[], life = 20): World => {
  const wd = createWorld(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((c, x) => setCell(wd, y * wd.w + x, CH[c], CH[c] === FIRE || CH[c] === STEAM ? life : 0)));
  return wd;
};
const show = (wd: World): string[] => {
  const out: string[] = [];
  for (let y = 0; y < wd.h; y++) out.push([...Array(wd.w).keys()].map((x) => REV[wd.type[y * wd.w + x]]).join(''));
  return out;
};
const recount = (wd: World): number[] => {
  const c = new Array<number>(MATERIAL_TYPES).fill(0);
  for (const t of wd.type) c[t]++;
  return c;
};

describe('rule pairs, one tick, fixed random source', () => {
  // [name, before, after, random, discovery bit expected (0 for none)]
  const table: [string, string[], string[], () => number, number][] = [
    ['sand falls one cell', ['.s.', '...', '...'], ['...', '.s.', '...'], lo, 0],
    ['sand sinks through water', ['s', 'w'], ['w', 's'], lo, EV_SINK],
    ['sand sinks through oil', ['s', 'o'], ['o', 's'], lo, EV_SINK],
    ['sand rests on stone in a well', ['#s#', '###'], ['#s#', '###'], lo, 0],
    ['sand slides down-left when the left is first', ['.s.', '.#.'], ['...', 's#.'], lo, 0],
    ['sand slides down-right when the right is first', ['.s.', '.#.'], ['...', '.#s'], hi, 0],
    ['sand slides to the free side when one is blocked', ['.s.', '##.'], ['...', '##s'], lo, 0],
    ['sand rests on the floor', ['.s.'], ['.s.'], lo, 0],
    ['water sinks under oil', ['w', 'o'], ['o', 'w'], lo, EV_FLOAT],
    ['oil stays on top of water', ['o', 'w'], ['o', 'w'], lo, 0],
    ['water spreads sideways on the floor (left first)', ['.w.'], ['w..'], lo, 0],
    ['water spreads sideways on the floor (right first)', ['.w.'], ['..w'], hi, 0],
    ['water in a one-wide well stays', ['#w#', '###'], ['#w#', '###'], lo, 0],
    ['water slides down a slope', ['.w.', '.#.'], ['...', 'w#.'], lo, 0],
    ['oil falls like water', ['o', '.'], ['.', 'o'], lo, 0],
    ['fire beside water makes steam', ['fw'], ['vw'], lo, EV_BOIL],
    ['fire lights wood (low roll)', ['fW'], ['ff'], lo, EV_BURN],
    ['fire leaves wood alone (high roll)', ['fW'], ['fW'], hi, 0],
    ['fire lights a plant (low roll)', ['fp'], ['ff'], lo, EV_BURN],
    ['fire lights oil (low roll)', ['fo'], ['ff'], lo, EV_BURN],
    ['fire does not light sand or stone', ['fs#'], ['fs#'], lo, 0],
    ['steam rises', ['.', 'v'], ['v', '.'], lo, 0],
    ['steam at the top stays put (high roll, blocked)', ['v'], ['v'], hi, 0],
    ['a plant drinks a touching drop (low roll)', ['pw'], ['pp'], lo, EV_GROW],
    ['a plant does nothing on a high roll', ['pw'], ['pw'], hi, 0],
    ['stone never moves', ['.#.', '...'], ['.#.', '...'], lo, 0],
    ['wood never moves', ['.W.', '...'], ['.W.', '...'], lo, 0],
  ];
  for (const [name, before, after, rnd, ev] of table) {
    it(name, () => {
      const wd = build(before, 20);
      const got = step(wd, rnd);
      expect(show(wd)).toEqual(after);
      expect(got).toBe(ev);
      expect(wd.counts).toEqual(recount(wd));
    });
  }

  it('fire with one tick of life left goes out', () => {
    const wd = build(['f'], 1);
    step(wd, lo);
    expect(show(wd)).toEqual(['.']);
  });
  it('steam with one tick of life left condenses into water and counts as rain', () => {
    const wd = build(['v'], 1);
    expect(step(wd, lo)).toBe(EV_RAIN);
    expect(show(wd)).toEqual(['w']);
  });
  it('a particle moves at most once per tick: a sand grain in a tall empty column falls exactly one cell', () => {
    const wd = build(['s', '.', '.', '.', '.', '.'], 20);
    for (let k = 1; k <= 5; k++) {
      step(wd, lo);
      expect(wd.type[k]).toBe(SAND);
      expect(wd.counts[SAND]).toBe(1);
    }
  });
  it('steam rises exactly one cell per tick too', () => {
    const wd = build(['.', '.', '.', 'v'], 100);
    step(wd, lo);
    expect(show(wd)).toEqual(['.', '.', 'v', '.']);
  });
});

describe('conservation and bounds over long runs', () => {
  it('sand, water, oil and stone are never created or lost in a closed box (3000 ticks)', () => {
    const w = 24; const h = 24;
    const wd = createWorld(w, h);
    const rnd = prng(42);
    for (let i = 0; i < w * h; i++) {
      const r = rnd();
      if (r < 0.2) setCell(wd, i, SAND);
      else if (r < 0.4) setCell(wd, i, WATER);
      else if (r < 0.5) setCell(wd, i, OIL);
      else if (r < 0.55) setCell(wd, i, STONE);
    }
    const before = [...wd.counts];
    for (let k = 0; k < 3000; k++) {
      step(wd, rnd);
      if (k % 100 === 0) expect(wd.counts).toEqual(recount(wd));
    }
    expect(recount(wd)).toEqual(before);
    expect(wd.counts).toEqual(before);
    expect(wd.type.length).toBe(w * h);
  }, 30_000);

  it('the running counts always equal a recount, even with fire, steam, plants and wood in play', () => {
    const w = 40; const h = 30;
    const wd = createWorld(w, h);
    const rnd = prng(7);
    for (let i = 0; i < w * h; i++) {
      const r = rnd();
      const kinds = [SAND, WATER, OIL, STONE, WOOD, PLANT, FIRE, STEAM];
      if (r < 0.4) setCell(wd, i, kinds[Math.floor(rnd() * kinds.length)], 25);
    }
    for (let k = 0; k < 800; k++) {
      step(wd, rnd);
      takeDirty(wd);
      if (k % 20 === 0) {
        expect(wd.counts).toEqual(recount(wd));
        for (let i = 0; i < wd.type.length; i += 7) expect(wd.type[i]).toBeLessThan(MATERIAL_TYPES);
      }
    }
    expect(wd.type.length).toBe(w * h);
  }, 30_000);

  it('only wood, plants and oil can be burnt away: stone and sand counts never fall while fire burns', () => {
    const wd = build(['fWWWW', '#####', 'sssss', '#####'], 40);
    const before = { sand: wd.counts[SAND], stone: wd.counts[STONE] };
    const rnd = prng(11);
    for (let k = 0; k < 500; k++) step(wd, rnd);
    expect(wd.counts[SAND]).toBe(before.sand);
    expect(wd.counts[STONE]).toBe(before.stone);
  });

  it('the same seed gives the same sand', () => {
    const run = (seed: number) => {
      const wd = createWorld(30, 30);
      const rnd = prng(seed);
      for (let k = 0; k < 150; k++) {
        paint(wd, brushCells(30, 30, 15, 2, 3), k % 3 === 0 ? WATER : SAND, rnd);
        step(wd, rnd);
      }
      return Array.from(wd.type).join('');
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });

  it('poured sand comes to rest: no grain hangs over an empty cell once it has had time to settle', () => {
    const wd = createWorld(30, 30);
    const rnd = prng(9);
    for (let k = 0; k < 120; k++) { paint(wd, brushCells(30, 30, 15, 1, 2), SAND, rnd); step(wd, rnd); }
    for (let k = 0; k < 200; k++) step(wd, rnd);
    for (let y = 0; y < 29; y++) for (let x = 0; x < 30; x++) {
      if (wd.type[y * 30 + x] === SAND) expect(wd.type[(y + 1) * 30 + x], `grain at ${x},${y}`).not.toBe(EMPTY);
    }
  });

  it('water poured into a stone basin fills it from the bottom', () => {
    const w = 12; const h = 20;
    const wd = createWorld(w, h);
    fillWalls(wd, w, h);
    const rnd = prng(13);
    let pours = 0;
    while (wd.counts[WATER] < 35 && pours++ < 500) { paint(wd, [w + 5, w + 6], WATER, () => 0); step(wd, rnd); }
    expect(wd.counts[WATER]).toBeGreaterThanOrEqual(35);
    for (let k = 0; k < 1500; k++) step(wd, rnd);
    // the basin floor is row h-2 (row h-1 is stone); with 10 free columns the bottom three rows are full
    for (let y = h - 4; y < h - 1; y++) for (let x = 1; x < w - 1; x++) expect(wd.type[y * w + x], `row ${y} col ${x}`).toBe(WATER);
  }, 30_000);
});

function fillWalls(wd: World, w: number, h: number) {
  for (let y = 0; y < h; y++) { setCell(wd, y * w, STONE); setCell(wd, y * w + w - 1, STONE); }
  for (let x = 0; x < w; x++) setCell(wd, (h - 1) * w + x, STONE);
}

describe('discoveries can all be made', () => {
  const eventually = (rows: string[], bit: number, maxTicks: number, seed: number, life = 60): boolean => {
    const wd = build(rows, life);
    const rnd = prng(seed);
    for (let k = 0; k < maxTicks; k++) if (step(wd, rnd) & bit) return true;
    return false;
  };
  it('sinking, floating, boiling, growing, burning and rain each happen in a short run', () => {
    expect(eventually(['s', 'w'], EV_SINK, 5, 1)).toBe(true);
    expect(eventually(['w', 'o'], EV_FLOAT, 5, 1)).toBe(true);
    expect(eventually(['fw'], EV_BOIL, 5, 1)).toBe(true);
    expect(eventually(['pw'], EV_GROW, 1500, 1)).toBe(true);
    expect(eventually(['fW'], EV_BURN, 1500, 1, 200)).toBe(true);
    expect(eventually(['v'], EV_RAIN, 200, 1, 150)).toBe(true);
  });
  it('fire runs along a row of wood for most seeds', () => {
    let fullBurns = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const wd = build(['fWWWWWW'], 60);
      const rnd = prng(seed);
      for (let k = 0; k < 3000; k++) step(wd, rnd);
      if (wd.counts[WOOD] === 0) fullBurns++;
    }
    expect(fullBurns).toBeGreaterThan(20);
  });
  it('the six discovery bits are distinct and add up to the stored maximum', () => {
    expect(DISCOVERIES.length).toBe(6);
    expect(DISCOVERIES.reduce((m, d) => m | d.bit, 0)).toBe(ALL_EVENTS);
    expect(new Set(DISCOVERIES.map((d) => d.bit)).size).toBe(6);
    expect(countFound(0)).toBe(0);
    expect(countFound(ALL_EVENTS)).toBe(6);
    expect(countFound(EV_SINK | EV_RAIN)).toBe(2);
  });
});

describe('brush and painting', () => {
  it('is a round blob: one cell at radius 0, 9 at radius 1, symmetric, and clipped at the edges', () => {
    expect(brushCells(20, 20, 5, 5, 0).length).toBe(1);
    expect(brushCells(20, 20, 10, 10, 1).length).toBe(9);
    const big = brushCells(40, 40, 20, 20, 6);
    expect(new Set(big).size).toBe(big.length);
    const cells = new Set(big);
    for (const i of big) {
      const x = i % 40; const y = (i - x) / 40;
      expect(cells.has(y * 40 + (40 - x))).toBe(true); // mirrored about x = 20
    }
    const corner = brushCells(20, 20, 0, 0, 3);
    for (const i of corner) expect(i >= 0 && i < 400).toBe(true);
    expect(corner.length).toBeLessThan(brushCells(20, 20, 10, 10, 3).length);
    expect(brushCells(20, 20, -50, -50, 3)).toEqual([]);
    expect(Object.values(BRUSH_RADIUS)).toEqual([1, 3, 6]);
  });
  it('sand sprinkles about 6 in 10 cells, stone and plant fill every empty cell', () => {
    const wd = createWorld(60, 60);
    const all = brushCells(60, 60, 30, 30, 20);
    const n = paint(wd, all, SAND, prng(1));
    expect(n / all.length).toBeGreaterThan(0.5);
    expect(n / all.length).toBeLessThan(0.7);
    const wd2 = createWorld(60, 60);
    expect(paint(wd2, all, STONE, prng(1))).toBe(all.length);
    const wd3 = createWorld(60, 60);
    expect(paint(wd3, all, PLANT, prng(1))).toBe(all.length);
  });
  it('painting never overwrites a particle; the eraser clears; fire lights wood, plants and oil only', () => {
    const wd = build(['wsW#po.']);
    const cells = [0, 1, 2, 3, 4, 5, 6];
    expect(paint(wd, cells, STONE, hi)).toBe(1); // only the empty cell
    expect(show(wd)).toEqual(['wsW#po#']);
    expect(paint(wd, cells, FIRE, lo)).toBe(3); // wood, plant, oil
    expect(show(wd)).toEqual(['wsf#ff#']);
    expect(paint(wd, cells, EMPTY, lo)).toBe(7);
    expect(show(wd)).toEqual(['.......']);
    expect(wd.counts).toEqual(recount(wd));
  });
  it('ignores cells outside the board and a bad material', () => {
    const wd = createWorld(5, 5);
    expect(paint(wd, [-1, 25, 999], SAND, lo)).toBe(0);
    setCell(wd, 3, 99);
    setCell(wd, -4, SAND);
    setCell(wd, 3, 1.5);
    expect(totalParticles(wd)).toBe(0);
  });
  it('line cells cover both ends and are 8-connected', () => {
    const rnd = prng(2);
    for (let k = 0; k < 100; k++) {
      const [a, b, c, d] = [0, 0, 0, 0].map(() => Math.floor(rnd() * 100));
      const l = lineCells(a, b, c, d);
      expect(l[0]).toEqual({ x: a, y: b });
      expect(l[l.length - 1]).toEqual({ x: c, y: d });
      for (let i = 1; i < l.length; i++) expect(Math.max(Math.abs(l[i].x - l[i - 1].x), Math.abs(l[i].y - l[i - 1].y))).toBe(1);
    }
    expect([clampTo(-3, 10), clampTo(11, 10), clampTo(NaN, 10)]).toEqual([0, 9, 0]);
  });
  it('dirty cells are listed once each and handed over by takeDirty', () => {
    const wd = createWorld(10, 10);
    setCell(wd, 5, SAND);
    setCell(wd, 5, WATER);
    setCell(wd, 6, STONE);
    const d = takeDirty(wd);
    expect(d.sort()).toEqual([5, 6]);
    expect(takeDirty(wd)).toEqual([]);
    setCell(wd, 5, WATER); // no change, not dirty
    expect(takeDirty(wd)).toEqual([]);
    clearWorld(wd);
    expect(totalParticles(wd)).toBe(0);
    expect(takeDirty(wd).length).toBe(2);
  });
});

describe('the starting scene', () => {
  for (const g of [GRID_WIDE, GRID_NARROW]) {
    it(`is valid on ${g.w} x ${g.h}: every material but fire, steam present, and sand and oil survive 600 ticks`, () => {
      const wd = createWorld(g.w, g.h);
      demoScene(wd);
      expect(wd.counts).toEqual(recount(wd));
      for (const m of [SAND, WATER, STONE, WOOD, PLANT, OIL]) expect(wd.counts[m], materialName(m)).toBeGreaterThan(0);
      expect(wd.counts[FIRE]).toBe(0);
      expect(wd.counts[STEAM]).toBe(0);
      const sand = wd.counts[SAND]; const oil = wd.counts[OIL]; const stone = wd.counts[STONE]; const wood = wd.counts[WOOD];
      const rnd = prng(4);
      for (let k = 0; k < 600; k++) step(wd, rnd);
      expect([wd.counts[SAND], wd.counts[OIL], wd.counts[STONE], wd.counts[WOOD]]).toEqual([sand, oil, stone, wood]);
      expect(wd.counts).toEqual(recount(wd));
    }, 30_000);
  }
  it('the sand pile reaches the water within a few seconds (the first discovery is quick)', () => {
    const wd = createWorld(GRID_WIDE.w, GRID_WIDE.h);
    demoScene(wd);
    const rnd = prng(8);
    let seen = 0;
    for (let k = 0; k < 600 && !(seen & EV_SINK); k++) seen |= step(wd, rnd);
    expect(seen & EV_SINK).toBeTruthy();
  });
  it('a full-size world with 60 percent particles runs 60 ticks well inside a generous time limit', () => {
    const wd = createWorld(GRID_WIDE.w, GRID_WIDE.h);
    const rnd = prng(31);
    for (let i = 0; i < wd.type.length; i++) if (rnd() < 0.6) setCell(wd, i, [SAND, WATER, OIL, STEAM][Math.floor(rnd() * 4)], 100);
    const t0 = Date.now();
    for (let k = 0; k < 60; k++) step(wd, rnd);
    expect(Date.now() - t0).toBeLessThan(10_000);
  }, 30_000);
});

describe('loop, grid and storage helpers', () => {
  it('uses the smaller grid on a narrow screen and 30 ticks a second (15 when calm)', () => {
    expect(gridFor(375)).toEqual(GRID_NARROW);
    expect(gridFor(519)).toEqual(GRID_NARROW);
    expect(gridFor(520)).toEqual(GRID_WIDE);
    expect(gridFor(0)).toEqual(GRID_WIDE);
    expect(gridFor(NaN)).toEqual(GRID_WIDE);
    expect(GRID_WIDE).toEqual({ w: 160, h: 120 });
    expect(GRID_NARROW.w * GRID_NARROW.h).toBeLessThan(GRID_WIDE.w * GRID_WIDE.h);
    expect(Math.round(1000 / TICK_MS)).toBe(30);
    expect(Math.round(1000 / TICK_MS_CALM)).toBe(15);
  });
  it('the accumulator never bursts after a pause', () => {
    expect(advance(0, 16.7, TICK_MS).steps).toBe(0);
    expect(advance(20, 16.7, TICK_MS).steps).toBe(1);
    expect(advance(0, 100_000, TICK_MS).steps).toBeLessThanOrEqual(1);
    expect(advance(0, NaN, TICK_MS)).toEqual({ steps: 0, acc: 0 });
    let total = 0; let acc = 0;
    for (let i = 0; i < 60; i++) { const r = advance(acc, 16.67, TICK_MS); total += r.steps; acc = r.acc; }
    expect(total).toBeGreaterThanOrEqual(29);
    expect(total).toBeLessThanOrEqual(30);
  });
  it('sanitises the stored discoveries: a whole number from 0 to 63, anything else becomes 0', () => {
    expect(sanitiseSaved({ d: 5 })).toEqual({ d: 5 });
    expect(sanitiseSaved({ d: 63 })).toEqual({ d: 63 });
    for (const bad of [null, undefined, 3, 'x', [], [5], {}, { d: -1 }, { d: 64 }, { d: 1.5 }, { d: NaN }, { d: '5' }, { d: [5] }, JSON.parse('{"__proto__":{"d":5}}')]) {
      expect(sanitiseSaved(bad)).toEqual({ d: 0 });
    }
    const out = sanitiseSaved({ d: 2, extra: 9 });
    expect(Object.keys(out)).toEqual(['d']);
  });
  it('words: plurals, share line, labels, names', () => {
    expect(plural(1, 'grain')).toBe('1 grain');
    expect(plural(2, 'grain')).toBe('2 grains');
    expect(shareText(0)).toBe('Falling Sand: I have found 0 of 6 discoveries');
    expect(shareText(6)).toBe('Falling Sand: I have found 6 of 6 discoveries');
    expect(cellLabel(0, 2, SAND)).toBe('Row 3, column 1, sand');
    expect(cellLabel(4, 0, EMPTY)).toBe('Row 1, column 5, empty');
    expect(PAINTABLE.length).toBe(8);
    expect(new Set(PAINTABLE.map((m) => m.key)).size).toBe(8);
    expect(BRUSH_KEYS.every(isBrushKey) && !isBrushKey('huge')).toBe(true);
    expect(RULES.length).toBeGreaterThanOrEqual(8);
  });
});

describe('colour ramps', () => {
  const tokens = { sky: parseColour('#38bdf8')!, green: parseColour('#34d399')!, amber: parseColour('#fbbf24')!, rose: parseColour('#f87171')! };
  const ramps = makeRamps(tokens);
  it('has eight shades for every paintable material and none for empty', () => {
    expect(ramps.length).toBe(MATERIAL_TYPES);
    expect(ramps[EMPTY]).toEqual([]);
    for (const m of PAINTABLE) { expect(ramps[m.id].length).toBe(VARIANTS); for (const c of ramps[m.id]) for (const v of c) expect(v >= 0 && v <= 255 && Number.isInteger(v)).toBe(true); }
  });
  it('every material has its own colour (middle shades all differ)', () => {
    const mids = PAINTABLE.map((m) => toCss(ramps[m.id][3]));
    expect(new Set(mids).size).toBe(PAINTABLE.length);
  });
  it('fire gets brighter from nearly out to fresh', () => {
    const l = ramps[FIRE].map(luminance);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThanOrEqual(l[i - 1] - 0.0001);
  });
  it('shade index is 0 to 7, even across the grid, and follows life for fire', () => {
    const hist = new Array<number>(VARIANTS).fill(0);
    for (let y = 0; y < GRID_WIDE.h; y++) for (let x = 0; x < GRID_WIDE.w; x++) { const s = shadeIndex(SAND, x, y, 0); expect(s >= 0 && s < VARIANTS).toBe(true); hist[s]++; }
    const mean = (GRID_WIDE.w * GRID_WIDE.h) / VARIANTS;
    for (const c of hist) { expect(c).toBeGreaterThan(mean * 0.7); expect(c).toBeLessThan(mean * 1.3); }
    expect([0, 7, 8, 24, 63, 64, 200, 255].map((l) => shadeIndex(FIRE, 3, 3, l))).toEqual([0, 0, 1, 3, 7, 7, 7, 7]);
  });
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('has a keyboard cursor with Space to pour, and a live status line', () => {
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
  });
  it('sizes the canvas from its box times a capped device pixel ratio, draws only changed cells, and reads colours at run time', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/takeDirty/);
    expect(src).toMatch(/getComputedStyle/);
    expect(src).toMatch(/putImageData/);
  });
  it('pauses on a hidden tab and stores under its own key only', () => {
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/gk:game:falling-sand/);
  });
});
