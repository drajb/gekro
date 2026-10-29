/**
 * games-light-grid.test.ts - the engine behind `light-grid`.
 *
 * Pinned: the press rule, that presses commute and cancel in pairs, that the
 * GF(2) solver clears every solvable board with the fewest presses (checked
 * against brute force), that unsolvable boards are rejected, the null-space
 * dimension for each size, and that every generated board is solvable. The
 * numbers quoted on the content page are asserted here.
 */
import { describe, it, expect } from 'vitest';
import {
  press, pressAll, flipsOf, emptyBoard, isSolved, litCount, solvable, solve, hintPress, nullity, nullSpaceBasis,
  log2SolvableBoards, generate, generateUniform, makeBoard, scramblePresses, mulberry32, shuffled, formatTime, pressMessage,
  SIZES, MAX_SIZE, DIFFICULTIES,
  type Board,
} from '../src/components/apps-private/light-grid/helpers';

const sizes = [...SIZES];
const idx = (n: number, r: number, c: number): number => r * n + c;
const litCells = (b: Board): number[] => b.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
const randomBoard = (n: number, rng: () => number): Board => Array.from({ length: n * n }, () => (rng() < 0.5 ? 1 : 0));
const boardFromMask = (mask: number, N: number): Board => Array.from({ length: N }, (_, i) => (mask >> i) & 1);

/**
 * Independent brute force, no GF(2) elimination: walk every press set of an n x n
 * board in Gray-code order (n * n <= 25), tracking the resulting board as an
 * integer, and record the fewest presses that reach each board. 255 = unreachable.
 */
const minPressTable = (n: number): Uint8Array => {
  const N = n * n;
  const col = Array.from({ length: N }, (_, j) => {
    let m = 0;
    for (const c of litCells(press(emptyBoard(n), n, j))) m |= 1 << c;
    return m;
  });
  const best = new Uint8Array(2 ** N).fill(255);
  best[0] = 0;
  let board = 0;
  let x = 0;
  let w = 0;
  for (let g = 1; g < 2 ** N; g++) {
    const b = 31 - Math.clz32(g & -g); // lowest set bit of g: the press that changes
    x ^= 1 << b;
    w += (x >> b) & 1 ? 1 : -1;
    board ^= col[b];
    if (w < best[board]) best[board] = w;
  }
  return best;
};
const maskOf = (b: Board): number => b.reduce((m, v, i) => m | (v << i), 0);

describe('press rule', () => {
  it('flips the cell and its orthogonal neighbours only', () => {
    expect(litCells(press(emptyBoard(3), 3, idx(3, 1, 1)))).toEqual([1, 3, 4, 5, 7]); // centre: 5 cells
    expect(litCells(press(emptyBoard(3), 3, idx(3, 0, 1)))).toEqual([0, 1, 2, 4]); // edge: 4 cells
    expect(litCells(press(emptyBoard(3), 3, idx(3, 0, 0)))).toEqual([0, 1, 3]); // corner: 3 cells
    expect(litCells(press(emptyBoard(5), 5, idx(5, 4, 4)))).toEqual([idx(5, 3, 4), idx(5, 4, 3), idx(5, 4, 4)]);
  });
  it('does not wrap around the edges', () => {
    expect(press(emptyBoard(4), 4, idx(4, 1, 3))[idx(4, 1, 0)]).toBe(0); // right edge does not reach left edge
    expect(press(emptyBoard(4), 4, idx(4, 0, 2))[idx(4, 3, 2)]).toBe(0); // top does not reach bottom
  });
  it('flips a lit cell dark as well as a dark cell lit', () => {
    const b = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(litCells(press(b, 3, 4))).toEqual([0, 2, 6, 8]);
  });
  it('never modifies its input', () => {
    const b = emptyBoard(3);
    const copy = b.slice();
    press(b, 3, 4);
    pressAll(b, 3, [0, 1, 2]);
    expect(b).toEqual(copy);
  });
  it('rejects a bad size or cell index', () => {
    expect(() => flipsOf(0, 0)).toThrow(RangeError);
    expect(() => flipsOf(MAX_SIZE + 1, 0)).toThrow(RangeError);
    expect(() => flipsOf(3, 9)).toThrow(RangeError);
    expect(() => flipsOf(3, -1)).toThrow(RangeError);
    expect(() => flipsOf(3, 1.5)).toThrow(RangeError);
    expect(() => solve([0, 0, 0], 3)).toThrow(RangeError); // wrong length
  });
  it('flip sets add up: 5 n^2 - 4 n flips in total across all cells', () => {
    for (const n of sizes) {
      let total = 0;
      for (let i = 0; i < n * n; i++) total += flipsOf(n, i).length;
      expect(total).toBe(5 * n * n - 4 * n);
    }
  });
  it('isSolved and litCount read the board', () => {
    expect(isSolved(emptyBoard(4))).toBe(true);
    expect(isSolved(press(emptyBoard(4), 4, 0))).toBe(false);
    expect(litCount(press(emptyBoard(4), 4, 5))).toBe(5);
  });
});

describe('presses commute and cancel in pairs', () => {
  it('pressing the same cell twice restores the board', () => {
    for (const n of sizes) {
      const rng = mulberry32(100 + n);
      const b = randomBoard(n, rng);
      for (let i = 0; i < n * n; i++) expect(press(press(b, n, i), n, i)).toEqual(b);
    }
  });
  it('any ordering of the same presses gives the same board', () => {
    for (const n of sizes) {
      const rng = mulberry32(7 * n);
      const start = randomBoard(n, rng);
      for (let trial = 0; trial < 20; trial++) {
        const cells = Array.from({ length: 12 }, () => Math.floor(rng() * n * n));
        const a = pressAll(start, n, cells);
        expect(pressAll(start, n, shuffled(cells, rng))).toEqual(a);
        expect(pressAll(start, n, cells.slice().reverse())).toEqual(a);
      }
    }
  });
  it('only the parity of each cell count matters', () => {
    const n = 5;
    const rng = mulberry32(55);
    const start = randomBoard(n, rng);
    const cells = Array.from({ length: 30 }, () => Math.floor(rng() * 25));
    const counts = new Map<number, number>();
    for (const c of cells) counts.set(c, (counts.get(c) ?? 0) + 1);
    const oddOnly = [...counts].filter(([, k]) => k % 2 === 1).map(([c]) => c);
    expect(pressAll(start, n, oddOnly)).toEqual(pressAll(start, n, cells));
  });
});

describe('null space', () => {
  it('has the dimension quoted on the content page for each size', () => {
    const dims = Object.fromEntries(sizes.map((n) => [n, nullity(n)]));
    expect(dims).toEqual({ 3: 0, 4: 4, 5: 2, 6: 0, 7: 0 });
  });
  it('5 x 5: dimension 2, so 2^23 of the 2^25 boards (a quarter) are solvable', () => {
    expect(nullity(5)).toBe(2);
    expect(log2SolvableBoards(5)).toBe(23);
    expect(2 ** log2SolvableBoards(5) / 2 ** 25).toBe(0.25);
  });
  it('every basis vector really changes nothing, and is not empty', () => {
    for (const n of sizes) {
      const basis = nullSpaceBasis(n);
      expect(basis).toHaveLength(nullity(n));
      for (const v of basis) {
        expect(v.length).toBeGreaterThan(0);
        expect(isSolved(pressAll(emptyBoard(n), n, v))).toBe(true);
      }
    }
  });
  it('the 5 x 5 null space has exactly 3 non-empty quiet patterns (2^2 - 1)', () => {
    // Brute force over all 2^25 press sets: count those that leave the board dark.
    const N = 25;
    const col = Array.from({ length: N }, (_, j) => maskOf(press(emptyBoard(5), 5, j)));
    let board = 0;
    let quiet = 0;
    for (let g = 1; g < 2 ** N; g++) {
      board ^= col[31 - Math.clz32(g & -g)];
      if (board === 0) quiet++;
    }
    expect(quiet).toBe(2 ** 2 - 1);
  });
  it('sizes 3, 6 and 7 have none, so every board of those sizes can be cleared', () => {
    for (const n of [3, 6, 7]) {
      const rng = mulberry32(900 + n);
      for (let t = 0; t < 25; t++) {
        const b = randomBoard(n, rng);
        expect(solvable(b, n)).toBe(true);
        expect(isSolved(pressAll(b, n, solve(b, n)!))).toBe(true);
      }
    }
  });
});

describe('solver: clears every solvable board', () => {
  for (const n of sizes) {
    it(`${n} x ${n}: solutions from the engine clear boards from every generator`, () => {
      const rng = mulberry32(31 * n);
      for (let t = 0; t < 40; t++) {
        const boards = [generate(n, n, rng), generate(n, 2 * n, rng), generateUniform(n, rng)];
        for (const b of boards) {
          const s = solve(b, n);
          expect(s, `${n} ${t}`).not.toBeNull();
          expect(isSolved(pressAll(b, n, s!))).toBe(true);
          expect(new Set(s).size).toBe(s!.length); // each cell at most once
          expect(s).toEqual(s!.slice().sort((a, c) => a - c));
        }
      }
    });
  }
  it('a cleared board needs no presses and has no hint', () => {
    for (const n of sizes) {
      expect(solve(emptyBoard(n), n)).toEqual([]);
      expect(hintPress(emptyBoard(n), n)).toBeNull();
    }
  });
  it('a single press is solved by that press when the null space is trivial', () => {
    for (const n of [3, 6, 7]) {
      const b = press(emptyBoard(n), n, idx(n, 1, 1));
      expect(solve(b, n)).toEqual([idx(n, 1, 1)]);
    }
  });
  it('a hint is always one of the cells of a minimum solution', () => {
    for (const n of sizes) {
      const rng = mulberry32(77 * n);
      for (let t = 0; t < 20; t++) {
        const b = generateUniform(n, rng);
        const s = solve(b, n)!;
        const h = hintPress(b, n)!;
        expect(s).toContain(h);
        // Following the hint leaves a board whose minimum is exactly one press smaller.
        expect(solve(press(b, n, h), n)!.length).toBe(s.length - 1);
      }
    }
  });
});

describe('solver: minimality against brute force', () => {
  it('3 x 3: every one of the 512 boards matches the brute-force minimum', () => {
    const table = minPressTable(3);
    for (let m = 0; m < 512; m++) {
      const s = solve(boardFromMask(m, 9), 3);
      expect(s === null ? 255 : s.length, `board ${m}`).toBe(table[m]);
    }
  });
  it('4 x 4: every one of the 65536 boards matches the brute-force minimum', () => {
    const table = minPressTable(4);
    let solvableCount = 0;
    for (let m = 0; m < 65536; m++) {
      const b = boardFromMask(m, 16);
      const s = solve(b, 4);
      if (table[m] !== 255) solvableCount++;
      if ((s === null ? 255 : s.length) !== table[m]) throw new Error(`4x4 board ${m}: engine ${s?.length}, brute force ${table[m]}`);
      if (solvable(b, 4) !== (table[m] !== 255)) throw new Error(`4x4 board ${m}: solvable() disagrees`);
    }
    expect(solvableCount).toBe(2 ** (16 - 4));
  });
  it('5 x 5: 2000 random boards match the brute-force minimum, solvable or not', () => {
    const table = minPressTable(5);
    const rng = mulberry32(2026);
    let solvableSeen = 0;
    for (let t = 0; t < 2000; t++) {
      // Half pure random (a quarter of those solvable), half generated (always solvable).
      const b = t % 2 ? randomBoard(5, rng) : generateUniform(5, rng);
      const m = maskOf(b);
      const s = solve(b, 5);
      if (table[m] !== 255) solvableSeen++;
      if ((s === null ? 255 : s.length) !== table[m]) throw new Error(`5x5 board ${m}: engine ${s?.length}, brute force ${table[m]}`);
      if (solvable(b, 5) !== (table[m] !== 255)) throw new Error(`5x5 board ${m}: solvable() disagrees`);
    }
    expect(solvableSeen).toBeGreaterThan(1000);
  });
});

describe('5 x 5 exhaustive facts (all 2^25 press sets)', () => {
  const table = minPressTable(5);
  let reachable = 0;
  let worst = 0;
  const histogram = new Array<number>(26).fill(0);
  for (let m = 0; m < table.length; m++) {
    if (table[m] === 255) continue;
    reachable++;
    histogram[table[m]]++;
    if (table[m] > worst) worst = table[m];
  }
  it('exactly 2^23 boards can be cleared', () => {
    expect(reachable).toBe(2 ** 23);
  });
  it('the hardest solvable board needs the pinned number of presses, and the engine agrees', () => {
    expect(worst).toBe(15);
    expect(histogram[15]).toBe(7350); // boards needing exactly the maximum
    expect(histogram[0]).toBe(1); // only the cleared board needs none
    expect(histogram[1]).toBe(25); // one press from clear: one board per cell
    const m = table.indexOf(worst);
    expect(solve(boardFromMask(m, 25), 5)!.length).toBe(worst);
  });
});

describe('unsolvable boards are rejected', () => {
  it('a single lit cell inside a quiet pattern cannot be cleared (4 x 4 and 5 x 5)', () => {
    for (const n of [4, 5]) {
      for (const v of nullSpaceBasis(n)) {
        const b = emptyBoard(n);
        b[v[0]] = 1;
        expect(solvable(b, n)).toBe(false);
        expect(solve(b, n)).toBeNull();
        expect(hintPress(b, n)).toBeNull();
      }
    }
  });
  it('some 5 x 5 boards with one lit cell are solvable and some are not', () => {
    const results = Array.from({ length: 25 }, (_, i) => {
      const b = emptyBoard(5);
      b[i] = 1;
      return solvable(b, 5);
    });
    expect(results.some((x) => x)).toBe(true);
    expect(results.some((x) => !x)).toBe(true);
  });
  it('about three random 5 x 5 boards in four are unsolvable', () => {
    const rng = mulberry32(5150);
    let ok = 0;
    const T = 4000;
    for (let t = 0; t < T; t++) if (solvable(randomBoard(5, rng), 5)) ok++;
    expect(ok / T).toBeGreaterThan(0.2);
    expect(ok / T).toBeLessThan(0.3);
  });
  it('a solvable board stays solvable and an unsolvable one stays unsolvable after any press', () => {
    const rng = mulberry32(8);
    for (let t = 0; t < 50; t++) {
      const b = randomBoard(5, rng);
      const s = solvable(b, 5);
      expect(solvable(press(b, 5, Math.floor(rng() * 25)), 5)).toBe(s);
    }
  });
});

describe('generator', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    for (const n of sizes) {
      expect(generate(n, 2 * n, mulberry32(42))).toEqual(generate(n, 2 * n, mulberry32(42)));
      expect(generateUniform(n, mulberry32(42))).toEqual(generateUniform(n, mulberry32(42)));
      expect(generateUniform(n, mulberry32(1))).not.toEqual(generateUniform(n, mulberry32(2)));
    }
  });
  it('makeBoard is deterministic for every size and difficulty', () => {
    for (const n of sizes) for (const d of DIFFICULTIES) {
      expect(makeBoard(n, d, mulberry32(9))).toEqual(makeBoard(n, d, mulberry32(9)));
    }
  });
  it('every generated board is solvable, not already cleared, and the right length', () => {
    for (const n of sizes) for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 25; seed++) {
        const b = makeBoard(n, d, mulberry32(seed));
        expect(b).toHaveLength(n * n);
        expect(b.every((v) => v === 0 || v === 1)).toBe(true);
        expect(isSolved(b)).toBe(false);
        expect(solvable(b, n)).toBe(true);
      }
    }
  });
  it('Easy and Normal need at most as many presses as they scrambled with', () => {
    for (const n of sizes) {
      expect(scramblePresses(n, 'easy')).toBe(n);
      expect(scramblePresses(n, 'normal')).toBe(2 * n);
      for (let seed = 1; seed <= 25; seed++) {
        expect(solve(makeBoard(n, 'easy', mulberry32(seed)), n)!.length).toBeLessThanOrEqual(n);
        expect(solve(makeBoard(n, 'normal', mulberry32(seed)), n)!.length).toBeLessThanOrEqual(2 * n);
      }
    }
  });
  it('clamps silly press counts instead of failing', () => {
    expect(generate(3, 0, mulberry32(1)).length).toBe(9);
    expect(generate(3, 999, mulberry32(1)).length).toBe(9);
    expect(generate(3, NaN, mulberry32(1)).length).toBe(9);
    expect(isSolved(generate(3, 999, mulberry32(1)))).toBe(false);
  });
  it('generate falls back to a single press when every attempt cancels to a cleared board', () => {
    // Where a null-space pattern exists (4 x 4 and 5 x 5), an rng that always shuffles that pattern to the front
    // makes every attempt press a set that changes nothing, so all 50 attempts come back cleared.
    const rngFor = (order: number[]): (() => number) => {
      const a = order.map((_, i) => i);
      const calls: number[] = [];
      for (let i = a.length - 1; i > 0; i--) {
        const j = a.indexOf(order[i]);
        calls.push((j + 0.5) / (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      let k = 0;
      return () => calls[k++ % calls.length];
    };
    for (const n of [4, 5]) {
      const quiet = nullSpaceBasis(n)[0];
      const rest = Array.from({ length: n * n }, (_, i) => i).filter((i) => !quiet.includes(i));
      const all = Array.from({ length: n * n }, (_, i) => i);
      const order = [...quiet, ...rest];
      // The premise: this rng really does put the quiet pattern first, and pressing it clears nothing.
      expect(shuffled(all, rngFor(order))).toEqual(order);
      expect(isSolved(pressAll(emptyBoard(n), n, quiet))).toBe(true);
      const b = generate(n, quiet.length, rngFor(order));
      expect(isSolved(b)).toBe(false);
      expect(b).toEqual(press(emptyBoard(n), n, 0));
      expect(solvable(b, n)).toBe(true);
    }
  });
  it('falls back to a non-cleared board even if the rng is degenerate', () => {
    expect(isSolved(generate(3, 3, () => 0))).toBe(false);
    expect(isSolved(generateUniform(3, () => 0.9))).toBe(false); // never presses anything by chance
    expect(solvable(generateUniform(3, () => 0.9), 3)).toBe(true);
  });
  it('uniform boards are spread across the solvable set: 4 x 4 hits many distinct boards', () => {
    const rng = mulberry32(123);
    const seen = new Set<number>();
    for (let t = 0; t < 2000; t++) seen.add(maskOf(generateUniform(4, rng)));
    // 4 x 4 has 2^12 = 4096 solvable boards; 2000 draws should land on well over 1000 distinct ones.
    expect(seen.size).toBeGreaterThan(1000);
  });
});

describe('press announcement', () => {
  it('names the cell pressed and how many lamps are lit, with the right singular', () => {
    expect(pressMessage(press(emptyBoard(3), 3, idx(3, 0, 0)), 3, idx(3, 0, 0))).toBe('Pressed row 1, column 1. 3 lamps are lit.');
    expect(pressMessage([0, 0, 0, 0, 1, 0, 0, 0, 0], 3, idx(3, 2, 1))).toBe('Pressed row 3, column 2. 1 lamp is lit.');
  });
});

describe('time formatting', () => {
  it('formats minutes and seconds and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
