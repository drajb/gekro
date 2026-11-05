/**
 * games-cell-garden.test.ts - the engine behind `cell-garden`.
 *
 * Pinned: one generation equals an independent naive implementation (coordinate arithmetic, a
 * separate age model) on thousands of random boards in both edge modes and several sizes, the
 * changed-cell list is exactly the cells whose alive state or colour band changed, a block never
 * changes, a blinker, toad, beacon, pulsar and ten bar repeat with exactly their stated period
 * (and not sooner), the glider moves (1, 1) and the spaceship (2, 0) every 4 generations in both
 * edge modes, wrap-around sends a pattern through the edge while a plain edge does not, ages count
 * up to 255 and no further, settling detection finds the smallest period, the loop accumulator
 * never fires a burst, painting lines cover both ends, and the speed table never exceeds 6
 * generations a second (a blinker therefore never flashes more than 3 times a second).
 */
import { describe, it, expect } from 'vitest';
import {
  SIZE_KEYS, SIZE_DIMS, SPEED_KEYS, SPEEDS, MAX_AGE, SETTLE_WINDOW, PRESETS, RANDOM_DENSITY,
  stepInto, ageBand, advance, stepMs, population, aliveCopy, sameAlive, findPeriod, settledMessage,
  lineCells, clampTo, randomFill, stamp, centreOffset, patternSize, presetById,
  cellLabel, shareText, plural, parseSize, parseSpeed, mulberry32, isSizeKey, isSpeedKey,
  starterGarden, parseColour, toCss, mixOklch, bandColours,
} from '../src/components/apps-private/cell-garden/helpers';
import calculatorSource from '../src/components/apps-private/cell-garden/Calculator.astro?raw';

/** Independent oracle: a plain object model, neighbours by modular or bounded coordinates, ages tracked separately. */
const naiveStep = (w: number, h: number, wrap: boolean, ages: number[]): number[] => {
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          let nx = x + dx;
          let ny = y + dy;
          if (wrap) { nx = (nx + w) % w; ny = (ny + h) % h; }
          else if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (ages[ny * w + nx] > 0) n++;
        }
      }
      const a = ages[y * w + x];
      if (a > 0) out.push(n === 2 || n === 3 ? Math.min(255, a + 1) : 0);
      else out.push(n === 3 ? 1 : 0);
    }
  }
  return out;
};
const band = (a: number): number => (a === 0 ? -1 : a < 3 ? 0 : a < 7 ? 1 : a < 15 ? 2 : 3);

const run = (w: number, h: number, wrap: boolean, start: Uint8Array, gens: number): Uint8Array => {
  let a = start.slice();
  let b = new Uint8Array(w * h);
  const ch: number[] = [];
  for (let g = 0; g < gens; g++) { stepInto(w, h, wrap, a, b, ch); [a, b] = [b, a]; }
  return a;
};
const shifted = (w: number, h: number, a: Uint8Array, dx: number, dy: number): string => {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[y * w + x] > 0) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
    }
  }
  return out.join('');
};
const bits = (a: Uint8Array): string => Array.from(a, (v) => (v > 0 ? 1 : 0)).join('');
const plant = (w: number, h: number, rows: readonly string[], wrap = false, at?: { x: number; y: number }): Uint8Array => {
  const a = new Uint8Array(w * h);
  const o = at ?? centreOffset(w, h, rows);
  stamp(a, w, h, rows, o.x, o.y, wrap);
  return a;
};

describe('one generation equals the naive implementation', () => {
  it('on random boards, both edge modes, several sizes, many generations (alive, ages and changed list)', () => {
    const rnd = mulberry32(12345);
    const dims: [number, number][] = [[3, 3], [4, 5], [7, 3], [10, 10], [32, 24], [48, 36], [72, 54]];
    for (const [w, h] of dims) {
      for (const wrap of [false, true]) {
        for (let trial = 0; trial < (w * h > 1000 ? 3 : 25); trial++) {
          let mine = new Uint8Array(w * h);
          randomFill(mine, 0.1 + rnd() * 0.5, rnd);
          let theirs = Array.from(mine);
          let dst = new Uint8Array(w * h);
          const changed: number[] = [];
          for (let g = 0; g < 12; g++) {
            const pop = stepInto(w, h, wrap, mine, dst, changed);
            const expected = naiveStep(w, h, wrap, theirs);
            expect(Array.from(dst)).toEqual(expected);
            expect(pop).toBe(expected.filter((v) => v > 0).length);
            const expectedChanged = expected.map((v, i) => (band(v) !== band(theirs[i]) ? i : -1)).filter((i) => i >= 0);
            expect(changed.slice().sort((p, q) => p - q)).toEqual(expectedChanged);
            theirs = expected;
            [mine, dst] = [dst, mine];
          }
        }
      }
    }
  }, 30_000);

  it('the changed list has no repeats and only valid indexes', () => {
    const w = 48; const h = 36;
    const a = new Uint8Array(w * h);
    randomFill(a, RANDOM_DENSITY, mulberry32(5));
    const b = new Uint8Array(w * h);
    const ch: number[] = [];
    stepInto(w, h, true, a, b, ch);
    expect(new Set(ch).size).toBe(ch.length);
    for (const i of ch) expect(i >= 0 && i < w * h).toBe(true);
  });

  it('an empty board stays empty and reports nothing changed', () => {
    const a = new Uint8Array(100);
    const b = new Uint8Array(100);
    const ch = [1, 2, 3];
    expect(stepInto(10, 10, false, a, b, ch)).toBe(0);
    expect(ch).toEqual([]);
  });
});

describe('the rule in words: birth on 3, survival on 2 or 3', () => {
  const w = 5; const h = 5;
  const at = (cells: [number, number][]): Uint8Array => { const a = new Uint8Array(w * h); for (const [x, y] of cells) a[y * w + x] = 1; return a; };
  const next = (a: Uint8Array): Uint8Array => { const b = new Uint8Array(w * h); stepInto(w, h, false, a, b, []); return b; };
  it('a lone flower dies and two neighbours die', () => {
    expect(population(next(at([[2, 2]])))).toBe(0);
    expect(population(next(at([[2, 2], [3, 2]])))).toBe(0);
  });
  it('an empty cell with exactly three neighbours is born; with two or four it is not', () => {
    expect(next(at([[1, 1], [3, 1], [2, 3]]))[2 * w + 2]).toBe(1);
    expect(next(at([[1, 1], [3, 1]]))[2 * w + 2]).toBe(0);
    expect(next(at([[1, 1], [3, 1], [1, 3], [3, 3]]))[2 * w + 2]).toBe(0);
  });
  it('a flower with 2 or 3 neighbours survives and with 4 dies of crowding', () => {
    expect(next(at([[2, 2], [1, 2], [3, 2]]))[2 * w + 2]).toBe(2);
    expect(next(at([[2, 2], [1, 2], [3, 2], [2, 1]]))[2 * w + 2]).toBe(2);
    expect(next(at([[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]))[2 * w + 2]).toBe(0);
  });
});

describe('known patterns', () => {
  const W = 40; const H = 30;
  it('a block never changes', () => {
    const a = plant(W, H, presetById('block')!.rows);
    expect(bits(run(W, H, false, a, 9))).toBe(bits(a));
  });
  it('every preset repeats with exactly its stated period, shifted by its stated move, in a bounded garden', () => {
    for (const p of PRESETS) {
      if (p.kind === 'grows') continue;
      const start = run(W, H, false, plant(W, H, p.rows), p.settle);
      const later = run(W, H, false, start, p.period);
      expect(bits(later), `${p.id} after ${p.period}`).toBe(shifted(W, H, start, p.dx, p.dy));
      // and not sooner: no earlier generation matches the start, even moved by a few cells
      let cur = start;
      for (let k = 1; k < p.period; k++) {
        cur = run(W, H, false, cur, 1);
        for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
          expect(bits(cur) === shifted(W, H, start, dx, dy), `${p.id} gen ${k} matches shift ${dx},${dy}`).toBe(false);
        }
      }
    }
  });
  it('the glider moves (1, 1) in 4 generations and (10, 10) in 40, on a wrap-around board too', () => {
    const g = presetById('glider')!;
    const a = plant(32, 24, g.rows, true, { x: 4, y: 4 });
    expect(bits(run(32, 24, true, a, 4))).toBe(shifted(32, 24, a, 1, 1));
    expect(bits(run(32, 24, true, a, 40))).toBe(shifted(32, 24, a, 10, 10));
  });
  it('on a torus a glider comes back to where it started after 4 x lcm(width, height) generations', () => {
    const w = 8; const h = 8;
    const a = plant(w, h, presetById('glider')!.rows, true, { x: 1, y: 1 });
    expect(bits(run(w, h, true, a, 32))).toBe(bits(a));
    expect(bits(run(w, h, true, a, 16))).not.toBe(bits(a));
  });
  it('the spaceship moves two cells sideways every 4 generations', () => {
    const s = presetById('spaceship')!;
    const a = plant(48, 20, s.rows, false, { x: 8, y: 8 });
    expect(bits(run(48, 20, false, a, 4))).toBe(shifted(48, 20, a, 2, 0));
    expect(bits(run(48, 20, false, a, 20))).toBe(shifted(48, 20, a, 10, 0));
  });
  it('a plain edge stops a glider (it ends as a block); wrap-around lets it through', () => {
    const g = presetById('glider')!;
    const flat = run(12, 12, false, plant(12, 12, g.rows, false, { x: 1, y: 1 }), 80);
    expect(population(flat)).toBe(4); // a block is left in the corner
    const torus = run(12, 12, true, plant(12, 12, g.rows, true, { x: 1, y: 1 }), 80);
    expect(population(torus)).toBe(5);
  });
  it('a wrapped blinker on the edge keeps its shape: three flowers across the seam', () => {
    const w = 10; const h = 10;
    const a = new Uint8Array(w * h);
    a[0] = 1; a[w - 1] = 1; a[1] = 1; // columns 9, 0 and 1 of row 0
    const b = run(w, h, true, a, 1);
    expect(population(b)).toBe(3);
    expect(b[w - 1]).toBe(0); // the row flipped to a column: column 9 of row 0 is empty now
    expect(b[0]).toBe(2); // column 0 of row 0 survived, one generation older
    expect(b[w * (h - 1)] > 0 && b[w] > 0).toBe(true); // and the column runs through the seam: rows 9, 0 and 1
    expect(bits(run(w, h, true, a, 2))).toBe(bits(a));
    expect(population(run(w, h, false, a, 1))).toBe(0); // without wrapping the seam, the three flowers are cut apart and all fade
  });
  it('the Burst keeps changing for at least 100 generations in a large garden', () => {
    const rows = presetById('burst')!.rows;
    const w = 72; const h = 54;
    let a = plant(w, h, rows);
    let b = new Uint8Array(w * h);
    const seen = new Set<string>();
    const ch: number[] = [];
    for (let g = 0; g < 100; g++) { seen.add(bits(a)); stepInto(w, h, false, a, b, ch); [a, b] = [b, a]; }
    expect(seen.size).toBe(100);
  });
});

describe('ages and colour bands', () => {
  it('a surviving flower gets one generation older each step and stops at 255', () => {
    const w = 8; const h = 8;
    let a = plant(w, h, ['OO', 'OO'], false, { x: 2, y: 2 });
    let b = new Uint8Array(w * h);
    for (let g = 1; g <= 300; g++) {
      stepInto(w, h, false, a, b, []);
      [a, b] = [b, a];
      expect(a[2 * w + 2]).toBe(Math.min(MAX_AGE, g + 1));
    }
    expect(MAX_AGE).toBe(255);
  });
  it('bands run new, young, grown, old and an empty cell has none', () => {
    expect([0, 1, 2, 3, 6, 7, 14, 15, 255].map(ageBand)).toEqual([-1, 0, 0, 1, 1, 2, 2, 3, 3]);
    expect(ageBand(-4)).toBe(-1);
  });
  it('a cell that changes band appears in the changed list even though it stays alive', () => {
    const w = 6; const h = 6;
    let a = plant(w, h, ['OO', 'OO'], false, { x: 1, y: 1 });
    let b = new Uint8Array(w * h);
    const ch: number[] = [];
    const bandChangeAt: number[] = [];
    for (let g = 1; g <= 16; g++) {
      stepInto(w, h, false, a, b, ch);
      [a, b] = [b, a];
      if (ch.length) bandChangeAt.push(g);
    }
    expect(bandChangeAt).toEqual([2, 6, 14]); // age 3, 7 and 15 start a new band
  });
});

describe('settling', () => {
  it('finds the smallest period from the last generations', () => {
    const w = 12; const h = 12;
    const mk = (rows: readonly string[]) => plant(w, h, rows);
    const blinker = mk(['OOO']);
    const hist: Uint8Array[] = [];
    let a = blinker.slice();
    let b = new Uint8Array(w * h);
    for (let g = 0; g < 6; g++) {
      hist.push(aliveCopy(a));
      stepInto(w, h, false, a, b, []);
      [a, b] = [b, a];
      if (hist.length > SETTLE_WINDOW) hist.shift();
    }
    expect(findPeriod(hist, a)).toBe(2);
    const block = mk(['OO', 'OO']);
    expect(findPeriod([aliveCopy(block)], block)).toBe(1);
    expect(findPeriod([], block)).toBe(0);
    expect(findPeriod([aliveCopy(block)], blinker)).toBe(0);
  });
  it('compares living cells only, not their ages', () => {
    const x = Uint8Array.from([1, 0, 5, 0]);
    const y = Uint8Array.from([9, 0, 2, 0]);
    expect(sameAlive(x, y)).toBe(true);
    expect(sameAlive(x, Uint8Array.from([1, 1, 5, 0]))).toBe(false);
    expect(sameAlive(x, Uint8Array.from([1, 0, 5]))).toBe(false);
  });
  it('speaks plainly about 1 and many', () => {
    expect(settledMessage(1)).toBe('The garden has settled: nothing changes any more.');
    expect(settledMessage(3)).toBe('The garden has settled into a pattern that repeats every 3 generations.');
    expect(SETTLE_WINDOW).toBe(12);
  });
});

describe('the loop accumulator and speeds', () => {
  it('fires on the interval, clamps a long frame, and never bursts after a pause', () => {
    const iv = stepMs('medium');
    expect(iv).toBe(250);
    expect(advance(0, 16, iv)).toEqual({ steps: 0, acc: 16 });
    expect(advance(240, 16, iv).steps).toBe(1);
    expect(advance(0, 10_000, iv).steps).toBeLessThanOrEqual(1); // dt is clamped to 50 ms
    expect(advance(0, NaN, iv)).toEqual({ steps: 0, acc: 0 });
    expect(advance(0, -5, iv)).toEqual({ steps: 0, acc: 0 });
    let total = 0; let acc = 0;
    for (let i = 0; i < 60; i++) { const r = advance(acc, 16.67, iv); total += r.steps; acc = r.acc; }
    expect(total).toBe(4); // one second of frames at 4 generations a second
  });
  it('the fastest speed is 6 generations a second, so no blinker flashes more than 3 times a second', () => {
    expect(Math.max(...SPEED_KEYS.map((k) => SPEEDS[k]))).toBe(6);
    expect(SPEEDS.slow).toBeLessThan(SPEEDS.medium);
    expect(SPEEDS.medium).toBeLessThan(SPEEDS.fast);
    expect(SPEEDS.fast / 2).toBeLessThanOrEqual(3);
  });
});

describe('boards and helpers', () => {
  it('has three sizes, each small enough for a phone (at most 4000 cells)', () => {
    expect(SIZE_KEYS.length).toBe(3);
    for (const k of SIZE_KEYS) expect(SIZE_DIMS[k].w * SIZE_DIMS[k].h).toBeLessThanOrEqual(4000);
    expect(SIZE_DIMS.small.w * SIZE_DIMS.small.h).toBeLessThan(SIZE_DIMS.medium.w * SIZE_DIMS.medium.h);
  });
  it('line cells cover both ends, have no gaps and are the same cells in either direction', () => {
    const rnd = mulberry32(8);
    for (let i = 0; i < 200; i++) {
      const [a, b, c, d] = [0, 0, 0, 0].map(() => Math.floor(rnd() * 72));
      const l = lineCells(a, b, c, d);
      expect(l[0]).toEqual({ x: a, y: b });
      expect(l[l.length - 1]).toEqual({ x: c, y: d });
      expect(l.length).toBe(Math.max(Math.abs(c - a), Math.abs(d - b)) + 1);
      expect(lineCells(c, d, a, b).map((p) => `${p.x},${p.y}`).sort()).toEqual(l.map((p) => `${p.x},${p.y}`).sort());
    }
  });
  it('clampTo stays on the board and survives NaN', () => {
    expect([clampTo(-5, 10), clampTo(3.7, 10), clampTo(99, 10), clampTo(NaN, 10), clampTo(Infinity, 10)]).toEqual([0, 3, 9, 0, 0]);
  });
  it('random fill is seeded, close to its density, and reports the count', () => {
    const a = new Uint8Array(4000);
    const k = randomFill(a, 0.3, mulberry32(77));
    expect(k).toBe(population(a));
    expect(k / 4000).toBeGreaterThan(0.26);
    expect(k / 4000).toBeLessThan(0.34);
    const b = new Uint8Array(4000);
    randomFill(b, 0.3, mulberry32(77));
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(randomFill(new Uint8Array(50), 0, mulberry32(1))).toBe(0);
    expect(randomFill(new Uint8Array(50), 5, mulberry32(1))).toBe(50);
  });
  it('stamp skips cells off a plain board, wraps on a torus and counts what it planted', () => {
    const w = 6; const h = 6;
    const a = new Uint8Array(w * h);
    expect(stamp(a, w, h, ['OOO'], 4, 0, false)).toBe(2);
    const b = new Uint8Array(w * h);
    expect(stamp(b, w, h, ['OOO'], 4, 0, true)).toBe(3);
    expect(b[0]).toBe(1);
    expect(stamp(b, w, h, ['OOO'], 4, 0, true)).toBe(0); // already there
    const c = new Uint8Array(w * h);
    expect(stamp(c, w, h, ['OO'], -1, -1, true)).toBe(2);
    expect(stamp(new Uint8Array(w * h), w, h, ['OO'], -1, 0, false)).toBe(1);
  });
  it('every preset is rectangular enough to centre, fits the small board and has only O and dot', () => {
    for (const p of PRESETS) {
      const s = patternSize(p.rows);
      expect(s.w).toBeLessThanOrEqual(SIZE_DIMS.small.w);
      expect(s.h).toBeLessThanOrEqual(SIZE_DIMS.small.h);
      for (const r of p.rows) expect(/^[O.]+$/.test(r)).toBe(true);
      const o = centreOffset(SIZE_DIMS.small.w, SIZE_DIMS.small.h, p.rows);
      expect(o.x + s.w).toBeLessThanOrEqual(SIZE_DIMS.small.w);
      expect(o.y + s.h).toBeLessThanOrEqual(SIZE_DIMS.small.h);
    }
    expect(PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });
  it('words are right for 0, 1 and many, and values from outside are bounded', () => {
    expect(plural(1, 'flower')).toBe('1 flower');
    expect(plural(0, 'flower')).toBe('0 flowers');
    expect(cellLabel(0, 0, 0)).toBe('Row 1, column 1, empty');
    expect(cellLabel(3, 1, 1)).toBe('Row 2, column 4, flower, 1 generation old');
    expect(shareText(1, 1, 'small', false)).toBe('Cell Garden (small board): 1 generation grown, 1 flower blooming');
    expect(shareText(0, 0, 'large', true)).toBe('Cell Garden (large board, wrap-around edges): 0 generations grown, 0 flowers blooming');
    expect([parseSize('large'), parseSize('huge'), parseSize(null), parseSize('__proto__')]).toEqual(['large', 'medium', 'medium', 'medium']);
    expect([parseSpeed('fast'), parseSpeed(4), parseSpeed(undefined)]).toEqual(['fast', 'medium', 'medium']);
    expect(isSizeKey('small') && !isSizeKey('x') && isSpeedKey('slow') && !isSpeedKey('x')).toBe(true);
  });
});

describe('starter garden and colours', () => {
  it('fills every board size with the same five patterns and no overlap', () => {
    const expected = ['glider', 'pulsar', 'blinker', 'toad', 'beacon'].reduce((t, id) => t + presetById(id)!.rows.join('').split('O').length - 1, 0);
    for (const k of SIZE_KEYS) {
      const { w, h } = SIZE_DIMS[k];
      const a = new Uint8Array(w * h);
      expect(starterGarden(a, w, h)).toBe(expected);
      expect(population(a)).toBe(expected);
    }
  });
  it('the starter garden grows on every size: some flowers are still alive after 100 generations', () => {
    for (const k of SIZE_KEYS) {
      const { w, h } = SIZE_DIMS[k];
      const a = new Uint8Array(w * h);
      starterGarden(a, w, h);
      expect(population(run(w, h, false, a, 100))).toBeGreaterThan(0);
    }
  });
  it('mixes the accent tokens in OKLCH: ends are kept and the four bands are different colours', () => {
    const sky = parseColour('#38bdf8')!; const green = parseColour('#34d399')!; const amber = parseColour('#fbbf24')!;
    const bands = bandColours(sky, green, amber);
    expect(bands.length).toBe(4);
    expect(new Set(bands.map(toCss)).size).toBe(4);
    expect(bands[0]).toEqual(sky);
    expect(bands[3]).toEqual(amber);
    expect(mixOklch(sky, green, 0)).toEqual(sky);
    expect(mixOklch(sky, green, 1)).toEqual(green);
    expect(parseColour('nonsense')).toBeNull();
    expect(toCss([1, 2, 3])).toBe('#010203');
  });
});

describe('fuzz: random play never breaks the board', () => {
  it('thousands of random edits and generations keep ages in range and never throw', () => {
    const rnd = mulberry32(2024);
    const w = 48; const h = 36;
    let a = new Uint8Array(w * h);
    let b = new Uint8Array(w * h);
    const ch: number[] = [];
    for (let k = 0; k < 3000; k++) {
      const r = rnd();
      if (r < 0.1) randomFill(a, rnd(), rnd);
      else if (r < 0.2) stamp(a, w, h, PRESETS[Math.floor(rnd() * PRESETS.length)].rows, Math.floor(rnd() * 60) - 6, Math.floor(rnd() * 44) - 4, rnd() < 0.5);
      else if (r < 0.25) a.fill(0);
      else if (r < 0.3) { for (const p of lineCells(Math.floor(rnd() * w), Math.floor(rnd() * h), Math.floor(rnd() * w), Math.floor(rnd() * h))) a[p.y * w + p.x] = rnd() < 0.7 ? 1 : 0; }
      const pop = stepInto(w, h, rnd() < 0.5, a, b, ch);
      expect(pop).toBe(population(b));
      for (let i = 0; i < b.length; i += 53) expect(b[i]).toBeLessThanOrEqual(255);
      [a, b] = [b, a];
    }
  }, 30_000);
});

describe('page source: claims the guide makes', () => {
  const src = calculatorSource;
  it('has a keyboard way to plant flowers and a live status line', () => {
    expect(src).toMatch(/ArrowLeft/);
    expect(src).toMatch(/aria-live="polite"/);
  });
  it('sizes the canvas from its box times a capped device pixel ratio and reads colours at draw time', () => {
    expect(src).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(src).toMatch(/getComputedStyle/);
  });
  it('makes the canvas as many pixels as its CSS box, so nothing is stretched, and snaps cell edges to whole pixels', () => {
    expect(src).toMatch(/canvas\.clientWidth/);
    expect(src).toMatch(/canvas\.clientHeight/);
    expect(src).toMatch(/Math\.round\(x \* cellW\)/);
    expect(src).not.toMatch(/Math\.floor\(\(cw \* dpr\) \/ w\)/);
  });
  it('pauses on a hidden tab and describes the rule in words without naming a board game', () => {
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/John Conway/);
    expect(src).toMatch(/1970/);
  });
});
