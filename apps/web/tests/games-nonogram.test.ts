/**
 * games-nonogram.test.ts - the engine behind `nonogram`.
 *
 * Pinned: clues are read off a picture correctly, the line solver agrees with a brute
 * force over every arrangement, a hand-built reference puzzle solves by lines alone, an
 * ambiguous puzzle is detected as stuck, every generated puzzle at every size is finished
 * by the line solver (which proves a single answer reachable by logic), generation is
 * deterministic and fast enough for a phone, hints are always correct, and a board is
 * judged complete by its clues.
 */
import { describe, it, expect } from 'vitest';
import {
  lineClue, blocksOf, cluesFromGrid, checkSatisfied, completion, clueTotal, filledCount, rowCells, colCells,
  solveLine, lineSolve, isLogicallySolvable, generate, staircase, dailySeed, hashString, mulberry32,
  hintFor, firstDeduction, formatTime, gridToString, parseGrid, avgClueCount, MIN_AVG_CLUES, SIZES,
} from '../src/components/apps-private/nonogram/helpers';

// A hand-built 5 x 5 reference picture (a heart). It is not taken from a published book.
const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'].join('\n');
const HEART_ROWS = [[1, 1], [5], [5], [3], [1]];
const HEART_COLS = [[2], [4], [4], [4], [2]];

const sameClue = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** Every filled/empty pattern of `len` cells whose runs equal `clue`. */
const allLines = (len: number, clue: number[]): number[][] => {
  const out: number[][] = [];
  for (let m = 0; m < 1 << len; m++) {
    const line = Array.from({ length: len }, (_, i) => (m >> i) & 1);
    if (sameClue(lineClue(line), clue)) out.push(line);
  }
  return out;
};

/** Every n x n picture matching the clues (brute force over row arrangements; small n only). */
const bruteSolutions = (rows: number[][], cols: number[][]): number[][] => {
  const n = rows.length;
  const opts = rows.map((c) => allLines(n, c));
  const found: number[][] = [];
  const pick: number[][] = [];
  const dfs = (r: number): void => {
    if (r === n) {
      const grid = pick.flat();
      if (cols.every((cl, c) => sameClue(lineClue(colCells(grid, n, c)), cl))) found.push(grid);
      return;
    }
    for (const line of opts[r]) { pick[r] = line; dfs(r + 1); }
  };
  dfs(0);
  return found;
};

describe('clues', () => {
  it('reads runs of filled cells', () => {
    expect(lineClue([0, 1, 1, 0, 1])).toEqual([2, 1]);
    expect(lineClue([1, 1, 1, 1, 1])).toEqual([5]);
    expect(lineClue([1, 0, 1, 0, 1])).toEqual([1, 1, 1]);
    expect(lineClue([0, 0, 1, 1, 1, 1])).toEqual([4]);
  });
  it('shows a blank line as 0', () => {
    expect(lineClue([0, 0, 0, 0])).toEqual([0]);
    expect(lineClue([])).toEqual([0]);
    expect(blocksOf([0])).toEqual([]);
    expect(blocksOf([2, 1])).toEqual([2, 1]);
  });
  it('counts only value 1 as filled, so marks (2) and blanks (0) are the same', () => {
    expect(lineClue([2, 1, 2, 1, 0])).toEqual([1, 1]);
  });
  it('computes row and column clues of the reference picture', () => {
    const cl = cluesFromGrid(parseGrid(HEART), 5);
    expect(cl.rows).toEqual(HEART_ROWS);
    expect(cl.cols).toEqual(HEART_COLS);
  });
  it('row and column clues always add up to the same total', () => {
    for (const n of SIZES) {
      const p = generate(31 + n, n);
      const sumRows = p.rowClues.flat().reduce((a, b) => a + b, 0);
      const sumCols = p.colClues.flat().reduce((a, b) => a + b, 0);
      expect(sumRows).toBe(sumCols);
      expect(clueTotal(p.rowClues)).toBe(filledCount(p.solution));
    }
  });
});

describe('checkSatisfied', () => {
  it('matches a line to its clue, ignoring marks', () => {
    expect(checkSatisfied([1, 1, 0, 1, 0], [2, 1])).toBe(true);
    expect(checkSatisfied([1, 1, 2, 1, 2], [2, 1])).toBe(true);
    expect(checkSatisfied([1, 1, 1, 0, 0], [2, 1])).toBe(false);
    expect(checkSatisfied([1, 0, 1, 1, 0], [2, 1])).toBe(false);
  });
  it('treats an empty line as satisfying [0] and nothing else', () => {
    expect(checkSatisfied([0, 0, 0], [0])).toBe(true);
    expect(checkSatisfied([2, 0, 2], [0])).toBe(true);
    expect(checkSatisfied([0, 1, 0], [0])).toBe(false);
    expect(checkSatisfied([0, 0, 0], [1])).toBe(false);
  });
  it('treats a full line as satisfying [n] only', () => {
    expect(checkSatisfied([1, 1, 1, 1], [4])).toBe(true);
    expect(checkSatisfied([1, 1, 1, 1], [2, 2])).toBe(false);
    expect(checkSatisfied([1, 1, 1, 0], [4])).toBe(false);
  });
});

describe('solveLine', () => {
  it('fills a clue that takes the whole line', () => {
    expect(solveLine([5], [-1, -1, -1, -1, -1])).toEqual([1, 1, 1, 1, 1]);
    expect(solveLine([1, 1, 1], [-1, -1, -1, -1, -1])).toEqual([1, 0, 1, 0, 1]);
    expect(solveLine([2, 2], [-1, -1, -1, -1, -1])).toEqual([1, 1, 0, 1, 1]);
  });
  it('empties a line whose clue is 0', () => {
    expect(solveLine([0], [-1, -1, -1, -1])).toEqual([0, 0, 0, 0]);
  });
  it('finds the overlap of a long block', () => {
    expect(solveLine([4], [-1, -1, -1, -1, -1])).toEqual([-1, 1, 1, 1, -1]);
    expect(solveLine([3], [-1, -1, -1, -1, -1])).toEqual([-1, -1, 1, -1, -1]);
    expect(solveLine([2], [-1, -1, -1, -1, -1])).toEqual([-1, -1, -1, -1, -1]);
  });
  it('respects cells that are already known', () => {
    expect(solveLine([2], [1, -1, -1, -1])).toEqual([1, 1, 0, 0]);
    expect(solveLine([2], [-1, -1, -1, 1])).toEqual([0, 0, 1, 1]);
    expect(solveLine([1, 1], [0, 0, -1, -1, -1])).toEqual([0, 0, 1, 0, 1]);
  });
  it('returns null when no arrangement fits', () => {
    expect(solveLine([6], [-1, -1, -1, -1, -1])).toBeNull();
    expect(solveLine([1], [1, -1, 1])).toBeNull();
    expect(solveLine([2], [0, -1, 0, -1])).toBeNull();
    expect(solveLine([0], [-1, 1, -1])).toBeNull();
  });
  it('agrees exactly with a brute force over every arrangement', () => {
    const rng = mulberry32(2026);
    for (let t = 0; t < 700; t++) {
      const len = 1 + Math.floor(rng() * 9);
      const truth = Array.from({ length: len }, () => (rng() < 0.55 ? 1 : 0));
      const clue = lineClue(truth);
      const reveal = 0.1 + rng() * 0.5;
      const line = truth.map((v) => (rng() < reveal ? v : -1));
      // Now and then corrupt a known cell so the contradiction path is exercised too.
      if (t % 7 === 0) line[Math.floor(rng() * len)] = rng() < 0.5 ? 0 : 1;
      const fits = allLines(len, clue).filter((cand) => line.every((k, i) => k === -1 || k === cand[i]));
      const want = fits.length === 0
        ? null
        : Array.from({ length: len }, (_, i) => {
            const vals = new Set(fits.map((f) => f[i]));
            return vals.size === 2 ? -1 : [...vals][0];
          });
      expect(solveLine(clue, line), `${clue.join(',')} on ${line.join(',')}`).toEqual(want);
    }
  });
});

describe('lineSolve on a reference puzzle', () => {
  it('solves the hand-built heart from its clues alone', () => {
    const r = lineSolve(HEART_ROWS, HEART_COLS);
    expect(r.solved).toBe(true);
    expect(r.contradiction).toBe(false);
    expect(r.unknown).toBe(0);
    expect(gridToString(r.grid, 5)).toBe(HEART);
    expect(isLogicallySolvable(HEART_ROWS, HEART_COLS)).toBe(true);
  });
  it('has exactly one solution by brute force', () => {
    const sols = bruteSolutions(HEART_ROWS, HEART_COLS);
    expect(sols).toHaveLength(1);
    expect(gridToString(sols[0], 5)).toBe(HEART);
  });
  it('stays stuck on a puzzle with two answers instead of guessing', () => {
    const rows = [[1], [1]];
    const cols = [[1], [1]];
    expect(bruteSolutions(rows, cols)).toHaveLength(2);
    const r = lineSolve(rows, cols);
    expect(r.solved).toBe(false);
    expect(r.contradiction).toBe(false);
    expect(r.unknown).toBe(4);
    expect(r.grid).toEqual([-1, -1, -1, -1]);
    expect(isLogicallySolvable(rows, cols)).toBe(false);
  });
  it('detects clues that contradict each other', () => {
    const r = lineSolve([[2], [2]], [[1], [1]]);
    expect(r.contradiction).toBe(true);
    expect(r.solved).toBe(false);
  });
  it('can continue from a partial state', () => {
    const rows = [[1], [1]];
    const cols = [[1], [1]];
    const r = lineSolve(rows, cols, [1, -1, -1, -1]);
    expect(r.grid).toEqual([1, 0, 0, 1]);
    expect(r.solved).toBe(true);
  });
  it('handles all-filled and all-empty lines', () => {
    const r = lineSolve([[3], [0], [3]], [[1, 1], [1, 1], [1, 1]]);
    expect(r.solved).toBe(true);
    expect(gridToString(r.grid, 3)).toBe('###\n...\n###');
    const full = lineSolve([[2], [2]], [[2], [2]]);
    expect(full.grid).toEqual([1, 1, 1, 1]);
    const empty = lineSolve([[0], [0]], [[0], [0]]);
    expect(empty.grid).toEqual([0, 0, 0, 0]);
  });
});

describe('line solver is sound against brute force', () => {
  it('never draws a cell that differs from any real solution, and completes only unique puzzles', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 120; t++) {
      const n = 3 + (t % 3); // 3, 4, 5
      const pic = Array.from({ length: n * n }, () => (rng() < 0.55 ? 1 : 0));
      const cl = cluesFromGrid(pic, n);
      const sols = bruteSolutions(cl.rows, cl.cols);
      expect(sols.length).toBeGreaterThanOrEqual(1);
      const r = lineSolve(cl.rows, cl.cols);
      expect(r.contradiction).toBe(false);
      r.grid.forEach((v, i) => { if (v !== -1) for (const s of sols) expect(s[i]).toBe(v); });
      if (r.solved) expect(sols).toHaveLength(1);
    }
  });
});

describe('generator', () => {
  it('is deterministic for a seed and different across seeds', () => {
    for (const n of SIZES) {
      const a = generate(12345, n);
      const b = generate(12345, n);
      const c = generate(54321, n);
      expect(a.solution).toEqual(b.solution);
      expect(a.rowClues).toEqual(b.rowClues);
      expect(gridToString(a.solution, n)).not.toBe(gridToString(c.solution, n));
    }
  });
  for (const n of SIZES) {
    it(`${n} x ${n}: the line solver completes every puzzle and lands on the generating picture`, () => {
      for (let s = 1; s <= 40; s++) {
        const p = generate(s * 104729, n);
        expect(p.n).toBe(n);
        expect(p.solution).toHaveLength(n * n);
        const r = lineSolve(p.rowClues, p.colClues);
        expect(r.solved, `${n} seed ${s}`).toBe(true);
        expect(r.grid, `${n} seed ${s}`).toEqual(p.solution);
        expect(cluesFromGrid(p.solution, n)).toEqual({ rows: p.rowClues, cols: p.colClues });
        expect(p.solution.every((v) => v === 0 || v === 1)).toBe(true);
      }
    });
    it(`${n} x ${n}: pictures are about half to two thirds filled and not just a few big blocks`, () => {
      let total = 0;
      const seeds = 40;
      for (let s = 1; s <= seeds; s++) {
        const p = generate(s * 7727, n);
        const frac = filledCount(p.solution) / (n * n);
        total += frac;
        expect(frac).toBeGreaterThan(0.38);
        expect(frac).toBeLessThan(0.75);
        expect(avgClueCount({ rows: p.rowClues, cols: p.colClues })).toBeGreaterThanOrEqual(MIN_AVG_CLUES[n]);
      }
      const mean = total / seeds;
      expect(mean).toBeGreaterThan(0.5);
      expect(mean).toBeLessThan(0.66);
    });
  }
  it('5 x 5 puzzles have exactly one solution by exhaustive search, independent of the line solver', () => {
    for (let s = 1; s <= 60; s++) {
      const p = generate(s * 2999, 5);
      const sols = bruteSolutions(p.rowClues, p.colClues);
      expect(sols, `seed ${s}`).toHaveLength(1);
      expect(sols[0]).toEqual(p.solution);
    }
  });
  it('rarely needs more than a handful of tries, and never falls back to the staircase', () => {
    for (const n of SIZES) {
      for (let s = 1; s <= 30; s++) {
        const p = generate(s * 313, n);
        expect(p.attempts).toBeLessThan(200);
        expect(gridToString(p.solution, n)).not.toBe(gridToString(staircase(n), n));
      }
    }
  });
  it('15 x 15 generation is fast even in the worst of many seeds', () => {
    let worst = 0;
    const t0 = performance.now();
    for (let s = 1; s <= 30; s++) {
      const t = performance.now();
      generate(s * 48611 + 5, 15);
      worst = Math.max(worst, performance.now() - t);
    }
    const total = performance.now() - t0;
    expect(worst).toBeLessThan(1000);
    expect(total).toBeLessThan(4000);
  });
  it('the fallback staircase is itself logically solvable at every size', () => {
    for (let n = 1; n <= 20; n++) {
      const pic = staircase(n);
      const cl = cluesFromGrid(pic, n);
      const r = lineSolve(cl.rows, cl.cols);
      expect(r.solved, `n=${n}`).toBe(true);
      expect(r.grid).toEqual(pic);
    }
  });
});

describe('daily seed', () => {
  it('is stable for a date and size and differs otherwise', () => {
    expect(dailySeed('2026-10-23', 10)).toBe(dailySeed('2026-10-23', 10));
    expect(dailySeed('2026-10-23', 10)).not.toBe(dailySeed('2026-10-24', 10));
    expect(dailySeed('2026-10-23', 10)).not.toBe(dailySeed('2026-10-23', 15));
  });
  it('hashes to an unsigned 32-bit integer', () => {
    const h = hashString('nonogram');
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
    const d = dailySeed('2026-10-23', 5);
    expect(Number.isInteger(d) && d >= 0 && d < 2 ** 32).toBe(true);
  });
  it('the same daily seed builds the same puzzle', () => {
    const s = dailySeed('2026-10-23', 10);
    expect(generate(s, 10).solution).toEqual(generate(s, 10).solution);
  });
});

describe('hints', () => {
  it('first deduction on the reference puzzle comes from a real line and is correct', () => {
    const solution = parseGrid(HEART);
    const d = firstDeduction(HEART_ROWS, HEART_COLS, new Array(25).fill(-1))!;
    expect(d).not.toBeNull();
    expect(d.value).toBe(solution[d.cell]);
    expect(['row', 'col']).toContain(d.axis);
  });
  it('from an empty board, every hint is right and names its line; following them solves the puzzle', () => {
    for (const n of [5, 10, 15] as const) {
      for (const seed of [11, 12, 13]) {
        const p = generate(seed, n);
        const state: number[] = new Array(n * n).fill(0);
        let steps = 0;
        for (; steps < n * n * 2; steps++) {
          const h = hintFor(p.rowClues, p.colClues, state, p.solution);
          if (!h) break;
          expect(h.value, `${n} seed ${seed} step ${steps}`).toBe(p.solution[h.cell]);
          expect(h.axis, 'a logic-solvable puzzle never needs the answer fallback').not.toBe('answer');
          expect(h.reason).toMatch(/^From (row|column) \d+, clue /);
          const line = h.axis === 'row' ? Math.floor(h.cell / n) : h.cell % n;
          expect(h.index).toBe(line);
          expect(state[h.cell] === (h.value === 1 ? 1 : 2)).toBe(false); // it always changes something
          state[h.cell] = h.value === 1 ? 1 : 2;
        }
        expect(steps).toBeLessThan(n * n * 2);
        expect(completion(state, n, { rows: p.rowClues, cols: p.colClues }).complete).toBe(true);
        expect(hintFor(p.rowClues, p.colClues, state, p.solution)).toBeNull();
      }
    }
  });
  it('ignores wrong cells on the board and corrects them', () => {
    const rng = mulberry32(5);
    for (const n of [5, 10] as const) {
      const p = generate(77, n);
      const state = p.solution.map(() => (rng() < 0.35 ? (rng() < 0.5 ? 1 : 2) : 0));
      for (let step = 0; step < n * n * 3; step++) {
        const h = hintFor(p.rowClues, p.colClues, state, p.solution);
        if (!h) break;
        expect(h.value).toBe(p.solution[h.cell]);
        state[h.cell] = h.value === 1 ? 1 : 2;
      }
      expect(completion(state, n, { rows: p.rowClues, cols: p.colClues }).complete).toBe(true);
      expect(hintFor(p.rowClues, p.colClues, state, p.solution)).toBeNull();
    }
  });
  it('prefers a cell to fill over a cell to mark when a line forces both', () => {
    // Row 1 clue [5] in a width-5 line forces every cell filled; nothing forces an empty cell first.
    const solution = parseGrid(HEART);
    const h = hintFor(HEART_ROWS, HEART_COLS, new Array(25).fill(0), solution)!;
    expect(h.value).toBe(1);
  });
  it('is null once the board matches, even if some empty cells carry marks', () => {
    const solution = parseGrid(HEART);
    const state = solution.map((v) => (v === 1 ? 1 : 2));
    expect(hintFor(HEART_ROWS, HEART_COLS, state, solution)).toBeNull();
  });
});

describe('completion by clues', () => {
  const heart = parseGrid(HEART);
  const clues = { rows: HEART_ROWS, cols: HEART_COLS };
  it('is complete when the filled cells match every clue, whatever else is marked', () => {
    expect(completion(heart, 5, clues).complete).toBe(true);
    const marked = heart.map((v) => (v === 1 ? 1 : 2));
    expect(completion(marked, 5, clues).complete).toBe(true);
    expect(completion(heart, 5, clues).matched).toBe(10);
  });
  it('is not complete with a missing or an extra filled cell', () => {
    const missing = heart.slice();
    missing[6] = 0;
    const cm = completion(missing, 5, clues);
    expect(cm.complete).toBe(false);
    expect(cm.rowsOk[1]).toBe(false);
    expect(cm.colsOk[1]).toBe(false);
    expect(cm.matched).toBe(8);
    const extra = heart.slice();
    extra[0] = 1;
    expect(completion(extra, 5, clues).complete).toBe(false);
  });
  it('reports which rows and columns are matched, for dimming their clues', () => {
    const state = new Array(25).fill(0);
    for (let c = 0; c < 5; c++) state[1 * 5 + c] = 1; // row 2 clue [5]
    const comp = completion(state, 5, clues);
    expect(comp.rowsOk[1]).toBe(true);
    expect(comp.rowsOk[0]).toBe(false);
    expect(comp.rowsOk[2]).toBe(false);
  });
  it('is judged by the clues, so any picture that satisfies them counts', () => {
    const c2 = { rows: [[1], [1]], cols: [[1], [1]] };
    expect(completion([1, 0, 0, 1], 2, c2).complete).toBe(true);
    expect(completion([0, 1, 1, 0], 2, c2).complete).toBe(true);
    expect(completion([1, 1, 0, 0], 2, c2).complete).toBe(false);
  });
  it('an empty board is complete only for an all-empty puzzle', () => {
    expect(completion(new Array(4).fill(0), 2, { rows: [[0], [0]], cols: [[0], [0]] }).complete).toBe(true);
    expect(completion(new Array(25).fill(0), 5, clues).complete).toBe(false);
  });
  it('generated puzzles are complete exactly at their solution', () => {
    for (const n of SIZES) {
      const p = generate(900 + n, n);
      const cl = { rows: p.rowClues, cols: p.colClues };
      expect(completion(p.solution, n, cl).complete).toBe(true);
      const off = p.solution.slice();
      off[0] = off[0] ? 0 : 1;
      expect(completion(off, n, cl).complete).toBe(false);
      expect(completion(new Array(n * n).fill(0), n, cl).complete).toBe(false);
    }
  });
});

describe('line helpers and formatting', () => {
  it('reads rows and columns out of a flat grid', () => {
    const g = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(rowCells(g, 3, 1)).toEqual([4, 5, 6]);
    expect(colCells(g, 3, 2)).toEqual([3, 6, 9]);
  });
  it('round-trips a picture through text', () => {
    expect(gridToString(parseGrid(HEART), 5)).toBe(HEART);
  });
  it('formats minutes and seconds and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});
