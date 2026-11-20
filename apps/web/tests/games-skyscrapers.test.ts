/**
 * games-skyscrapers.test.ts - the engine behind `skyscrapers`.
 *
 * Pinned: how many orderings of the heights 1 to n show k towers (the unsigned Stirling numbers of
 * the first kind: 6, 11, 6, 1 for n = 4 and 24, 50, 35, 10, 1 for n = 5), from the engine's counter
 * and from an independent permutation walk; the number of Latin squares of orders 3 and 4 (12, 576)
 * from the solver and the independent counter; exact counts from one edge clue (24 times the number
 * of first rows that show k towers); the solver's solution count against that independent counter on
 * generated, thinned and deliberately broken puzzles; every generated puzzle has exactly one solution
 * (per the independent counter), a Latin-square answer that agrees with every clue, and clue counts
 * within the level targets; a Hard puzzle has no clue left to remove; hints are always right and
 * repeated hints solve a puzzle; the daily seed; storage is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, SIDES, MAX_BEST_SECONDS, GEN_NODES,
  mulberry32, hashString, shuffled, blankPuzzle, checkPuzzle, visibleCount, lineCells, lineClues, cluesOf, clueCount, givenCount,
  describeClues, targets, conflicts, clueState, isSolved, isLatin, solve, hasUniqueSolution, candidatesFor, latinSquare, makePuzzle,
  nextHint, wrongCells, bestKey, sanitiseBest, formatTime, plural, where, placeMessage, digitsOf, rowOf, colOf,
  dailySeed, dailyFor, localIsoDate,
  type Puzzle, type Level,
} from '../src/components/apps-private/skyscrapers/helpers';

// ── Independent oracle ───────────────────────────────────────────────────────

/** Towers seen along a list of heights, written separately from the engine. */
const seen = (xs: number[]): number => {
  let tallest = 0;
  let k = 0;
  for (const x of xs) if (x > tallest) { tallest = x; k += 1; }
  return k;
};

/** Every ordering of 1..n, built by swapping (not by the engine's table). */
const orderings = (n: number): number[][] => {
  const out: number[][] = [];
  const a = Array.from({ length: n }, (_, k) => k + 1);
  const rec = (k: number): void => {
    if (k === n) { out.push(a.slice()); return; }
    for (let j = k; j < n; j++) {
      [a[k], a[j]] = [a[j], a[k]];
      rec(k + 1);
      [a[k], a[j]] = [a[j], a[k]];
    }
  };
  rec(0);
  return out;
};
const ORD = new Map<number, number[][]>();
const ordering = (n: number): number[][] => { if (!ORD.has(n)) ORD.set(n, orderings(n)); return ORD.get(n)!; };

/**
 * Count solutions by choosing whole rows. Each row is an ordering of 1..n that agrees with the
 * givens and the left and right clues of that row; a row may not repeat a height already used in
 * its column. After each row, a column's top clue is checked on the rows so far (more towers seen
 * than the clue, or the tallest already seen with a different count, is dead). When all rows are
 * down, every column's top and bottom clue is checked in full.
 */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 20_000_000): number => {
  const n = p.n;
  const rows: number[][][] = [];
  for (let r = 0; r < n; r++) {
    rows.push(ordering(n).filter((row) => {
      for (let c = 0; c < n; c++) if (p.givens[r * n + c] && p.givens[r * n + c] !== row[c]) return false;
      if (p.left[r] && seen(row) !== p.left[r]) return false;
      if (p.right[r] && seen(row.slice().reverse()) !== p.right[r]) return false;
      return true;
    }));
  }
  let count = 0;
  let nodes = 0;
  const chosen: number[][] = [];
  const go = (r: number): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    if (r === n) {
      for (let c = 0; c < n; c++) {
        const col = chosen.map((row) => row[c]);
        if (p.top[c] && seen(col) !== p.top[c]) return;
        if (p.bottom[c] && seen(col.slice().reverse()) !== p.bottom[c]) return;
      }
      count++;
      return;
    }
    for (const row of rows[r]) {
      let ok = true;
      for (let c = 0; c < n && ok; c++) for (const prev of chosen) if (prev[c] === row[c]) { ok = false; break; }
      if (!ok) continue;
      chosen.push(row);
      for (let c = 0; c < n && ok; c++) {
        if (!p.top[c]) continue;
        const col = chosen.map((x) => x[c]);
        const s = seen(col);
        if (s > p.top[c] || (col.includes(n) && s !== p.top[c])) ok = false;
      }
      if (ok) go(r + 1);
      chosen.pop();
      if (count >= cap) return;
    }
  };
  go(0);
  return count;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, givens: p.givens.slice(), top: p.top.slice(), bottom: p.bottom.slice(), left: p.left.slice(), right: p.right.slice() });

/** Plain statement of "every row and column holds each height once", for comparison with isLatin. */
const naiveLatin = (g: number[], n: number): boolean => {
  const want = Array.from({ length: n }, (_, k) => k + 1).join();
  for (let a = 0; a < n; a++) {
    const row = [...g.slice(a * n, a * n + n)].sort((x, y) => x - y).join();
    const col = Array.from({ length: n }, (_, b) => g[b * n + a]).sort((x, y) => x - y).join();
    if (row !== want || col !== want) return false;
  }
  return true;
};

/** Do all clues and givens of a puzzle agree with this grid? Reads rows and columns directly. */
const agrees = (p: Puzzle, g: number[]): boolean => {
  const n = p.n;
  for (let i = 0; i < n * n; i++) if (p.givens[i] && p.givens[i] !== g[i]) return false;
  for (let k = 0; k < n; k++) {
    const row = Array.from({ length: n }, (_, c) => g[k * n + c]);
    const col = Array.from({ length: n }, (_, r) => g[r * n + k]);
    if (p.left[k] && seen(row) !== p.left[k]) return false;
    if (p.right[k] && seen(row.slice().reverse()) !== p.right[k]) return false;
    if (p.top[k] && seen(col) !== p.top[k]) return false;
    if (p.bottom[k] && seen(col.slice().reverse()) !== p.bottom[k]) return false;
  }
  return true;
};

const EXPECTED_RANGES: Record<string, { givens: number[]; clues: number[] }> = {
  '4-easy': { givens: [5, 5], clues: [14, 14] }, '4-medium': { givens: [2, 2], clues: [11, 11] }, '4-hard': { givens: [0, 2], clues: [2, 5] },
  '5-easy': { givens: [8, 8], clues: [17, 17] }, '5-medium': { givens: [3, 3], clues: [13, 13] }, '5-hard': { givens: [0, 3], clues: [5, 9] },
  '6-easy': { givens: [11, 11], clues: [21, 21] }, '6-medium': { givens: [5, 5], clues: [16, 16] }, '6-hard': { givens: [1, 5], clues: [7, 14] },
};

// ── Towers seen ──────────────────────────────────────────────────────────────

describe('towers seen along a line', () => {
  it('counts a few lines by hand', () => {
    expect(visibleCount([1, 2, 3, 4])).toBe(4);
    expect(visibleCount([4, 3, 2, 1])).toBe(1);
    expect(visibleCount([2, 1, 4, 3])).toBe(2);
    expect(visibleCount([1, 3, 2, 4])).toBe(3);
    expect(visibleCount([])).toBe(0);
  });
  it('orderings of 1 to n showing k towers follow the unsigned Stirling numbers of the first kind', () => {
    const want: Record<number, number[]> = { 3: [2, 3, 1], 4: [6, 11, 6, 1], 5: [24, 50, 35, 10, 1], 6: [120, 274, 225, 85, 15, 1] };
    for (const n of [3, 4, 5, 6]) {
      const tally = new Array(n).fill(0);
      for (const o of ordering(n)) tally[seen(o) - 1]++;
      expect(tally, `independent n=${n}`).toEqual(want[n]);
      const mine = new Array(n).fill(0);
      for (const o of ordering(n)) mine[visibleCount(o) - 1]++;
      expect(mine, `engine n=${n}`).toEqual(want[n]);
    }
  });
  it('visibleCount agrees with the independent count on random lines, repeated heights included', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 500; t++) {
      const line = Array.from({ length: 1 + (t % 8) }, () => Math.floor(rng() * 7));
      expect(visibleCount(line)).toBe(seen(line));
    }
  });
  it('cluesOf reads a finished grid from all four edges', () => {
    const g = [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1];
    expect(naiveLatin(g, 4)).toBe(true);
    const c = cluesOf(g, 4);
    expect(c.left).toEqual([4, 2, 2, 1]);
    expect(c.right).toEqual([1, 2, 2, 4]);
    expect(c.top).toEqual([4, 2, 2, 1]);
    expect(c.bottom).toEqual([1, 2, 2, 4]);
    const rng = mulberry32(9);
    for (let t = 0; t < 40; t++) {
      const n = 3 + (t % 4);
      const sq = latinSquare(n, rng);
      const cl = cluesOf(sq, n);
      for (let k = 0; k < n; k++) {
        expect(cl.left[k]).toBe(seen(Array.from({ length: n }, (_, c2) => sq[k * n + c2])));
        expect(cl.bottom[k]).toBe(seen(Array.from({ length: n }, (_, r) => sq[(n - 1 - r) * n + k])));
      }
    }
  });
});

// ── Latin squares and exact counts ───────────────────────────────────────────

describe('exact counts', () => {
  it('there are 12 Latin squares of order 3 and 576 of order 4, counted by the solver and the oracle', () => {
    expect(solve(blankPuzzle(3), 1000).count).toBe(12);
    expect(solve(blankPuzzle(4), 100_000).count).toBe(576);
    expect(oracleCount(blankPuzzle(3), 1000)).toBe(12);
    expect(oracleCount(blankPuzzle(4), 100_000)).toBe(576);
  });
  it('every square list the solver gives is a Latin square, and they are all different', () => {
    const r = solve(blankPuzzle(4), 1000);
    expect(new Set(r.solutions.map((s) => s.join(''))).size).toBe(576);
    for (const s of r.solutions) { expect(isLatin(s, 4)).toBe(true); expect(naiveLatin(s, 4)).toBe(true); }
  });
  it('one clue on the first row of a 4x4 grid leaves 24 times the number of rows that show that many towers', () => {
    const rows = [6, 11, 6, 1];
    for (let k = 1; k <= 4; k++) {
      const p = blankPuzzle(4);
      p.left[0] = k;
      expect(solve(p, 10_000).count, `left ${k}`).toBe(24 * rows[k - 1]);
      expect(oracleCount(p, 10_000), `oracle left ${k}`).toBe(24 * rows[k - 1]);
      const q = blankPuzzle(4);
      q.right[2] = k;
      expect(solve(q, 10_000).count, `right ${k}`).toBe(24 * rows[k - 1]);
      const t = blankPuzzle(4);
      t.top[3] = k;
      expect(solve(t, 10_000).count, `top ${k}`).toBe(24 * rows[k - 1]);
      const b = blankPuzzle(4);
      b.bottom[1] = k;
      expect(solve(b, 10_000).count, `bottom ${k}`).toBe(24 * rows[k - 1]);
    }
  });
  it('a clue of 4 along a row forces 1 2 3 4, so only 24 grids remain, and clue 1 puts the 4 at the edge', () => {
    const p = blankPuzzle(4);
    p.left[1] = 4;
    const r = solve(p, 100);
    expect(r.count).toBe(24);
    for (const s of r.solutions) expect(s.slice(4, 8)).toEqual([1, 2, 3, 4]);
    const q = blankPuzzle(4);
    q.top[2] = 1;
    for (const s of solve(q, 1000).solutions) expect(s[2]).toBe(4);
  });
  it('clues that cannot both hold, or two givens that clash, leave no solution', () => {
    const a = blankPuzzle(4);
    a.left[0] = 4; a.right[0] = 4; // a row cannot be seen fully from both ends
    expect(solve(a, 10).count).toBe(0);
    expect(oracleCount(a, 10)).toBe(0);
    const b = blankPuzzle(4);
    b.givens[0] = 2; b.givens[1] = 2;
    expect(solve(b).count).toBe(0);
    expect(oracleCount(b, 10)).toBe(0);
  });
  it('a larger blank grid reports an exhausted budget instead of a false count', () => {
    const r = solve(blankPuzzle(6), 1_000_000, 5);
    expect(r.complete).toBe(false);
    expect(hasUniqueSolution(blankPuzzle(4), 3)).toBe(false);
  });
});

// ── Rules ────────────────────────────────────────────────────────────────────

describe('rules', () => {
  it('rejects malformed puzzles', () => {
    expect(() => blankPuzzle(2)).toThrow(RangeError);
    expect(() => blankPuzzle(7)).toThrow(RangeError);
    const good = blankPuzzle(4);
    expect(() => checkPuzzle(good)).not.toThrow();
    expect(() => checkPuzzle({ ...good, givens: good.givens.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, top: [0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, left: [5, 0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, right: [-1, 0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, bottom: [1.5, 0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, givens: [5, ...good.givens.slice(1)] })).toThrow(RangeError);
    expect(() => solve({ ...good, n: 9 })).toThrow(RangeError);
  });
  it('lines are read in the order the page expects', () => {
    expect(lineCells(3, 1)).toEqual([3, 4, 5]);
    expect(lineCells(3, 4)).toEqual([1, 4, 7]);
    const p = blankPuzzle(3);
    p.left[1] = 2; p.right[1] = 1; p.top[0] = 3; p.bottom[0] = 2;
    expect(lineClues(p, 1)).toEqual([2, 1]);
    expect(lineClues(p, 3)).toEqual([3, 2]);
    expect(clueCount(p)).toBe(4);
    expect(givenCount(p)).toBe(0);
  });
  it('describes the edge clues beside a square in plain words', () => {
    const p = blankPuzzle(4);
    p.left[0] = 2; p.top[0] = 3; p.right[3] = 1; p.bottom[3] = 4;
    expect(describeClues(p, 0)).toBe('2 visible from the left, 3 visible from the top');
    expect(describeClues(p, 15)).toBe('1 visible from the right, 4 visible from the bottom');
    expect(describeClues(p, 5)).toBe('');
  });
  it('conflicts flag repeated heights, and nothing else', () => {
    const p = blankPuzzle(4);
    const g = new Array(16).fill(0);
    g[0] = 2; g[2] = 2; // repeat in row 0
    g[5] = 3; g[13] = 3; // repeat in column 1
    g[7] = 1;
    expect([...conflicts(p, g)].sort((a, b) => a - b)).toEqual([0, 2, 5, 13]);
    expect(conflicts(p, new Array(16).fill(0)).size).toBe(0);
  });
  it('clueState waits for the line to settle, then says ok or bad', () => {
    const p = blankPuzzle(4);
    p.left[0] = 2; p.right[0] = 3; p.top[1] = 1;
    const g = new Array(16).fill(0);
    expect(clueState(p, g, 'left', 0)).toBe('');
    expect(clueState(p, g, 'left', 1)).toBe('');
    g[0] = 1; g[1] = 2; g[2] = 3; // already three towers seen from the left, clue says 2
    expect(clueState(p, g, 'left', 0)).toBe('bad');
    g[0] = 2; g[1] = 4; g[2] = 1; g[3] = 3; // 2 4 1 3: left sees 2, right sees 2
    expect(clueState(p, g, 'left', 0)).toBe('ok');
    expect(clueState(p, g, 'right', 0)).toBe('bad');
    g[1] = 0; g[5] = 1; // top clue 1 at column 1 with a 1 at the top square? not yet: top is g[1]
    expect(clueState(p, g, 'top', 1)).toBe('');
    g[1] = 4;
    expect(clueState(p, g, 'top', 1)).toBe(''); // the 4 stands first and hides the 1: not wrong, just not finished
    g[1] = 1; g[5] = 4;
    expect(clueState(p, g, 'top', 1)).toBe('bad'); // 1 then 4 shows two
  });
  it('isSolved agrees with an independent check on generated, damaged and random grids', () => {
    const rng = mulberry32(55);
    for (let t = 0; t < 300; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(200 + (t % 30)));
      const g = solution.slice();
      const mode = t % 4;
      if (mode === 1) g[Math.floor(rng() * g.length)] = 1 + Math.floor(rng() * n);
      if (mode === 2) { const a = Math.floor(rng() * g.length); const b = Math.floor(rng() * g.length); [g[a], g[b]] = [g[b], g[a]]; }
      if (mode === 3) g[Math.floor(rng() * g.length)] = 0;
      const want = naiveLatin(g, n) && agrees(puzzle, g);
      expect(isSolved(puzzle, g), `t=${t}`).toBe(want);
    }
  });
  it('isLatin agrees with the plain statement of the rule on random and damaged grids', () => {
    const rng = mulberry32(12);
    for (let t = 0; t < 400; t++) {
      const n = 3 + (t % 4);
      const g = latinSquare(n, rng);
      if (t % 2) g[Math.floor(rng() * g.length)] = 1 + Math.floor(rng() * n);
      if (t % 5 === 0) g[0] = n + 1;
      if (t % 7 === 0) g[1] = 0;
      expect(isLatin(g, n)).toBe(naiveLatin(g, n) && g.every((x) => Number.isInteger(x)));
    }
    expect(isLatin([1, 2, 3], 2)).toBe(false);
  });
});

// ── Solver against the independent counter ───────────────────────────────────

describe('solver', () => {
  it('agrees with the independent counter on thinned and broken puzzles of every size', () => {
    const rng = mulberry32(2718);
    let none = 0;
    let one = 0;
    let many = 0;
    for (let t = 0; t < 150; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[Math.floor(t / 3) % 3], mulberry32(700 + t));
      const p = clone(puzzle);
      const mode = t % 5;
      if (mode === 1) p.left = p.left.map((s) => (rng() < 0.5 ? 0 : s));
      if (mode === 2) p.givens = p.givens.map(() => 0);
      if (mode === 3) { p.givens = p.givens.map((g) => (rng() < 0.5 ? 0 : g)); p.top = p.top.map((s) => (rng() < 0.4 ? 0 : s)); }
      if (mode === 4) { // change one clue: usually leaves no solution, sometimes a different one
        const side = SIDES[Math.floor(rng() * 4)];
        const k = Math.floor(rng() * n);
        p[side][k] = 1 + Math.floor(rng() * n);
      }
      expect(solution.length).toBe(n * n);
      const cap = 5;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      const oracle = oracleCount(p, cap);
      if (engine.count !== oracle) throw new Error(`t=${t} n=${n} mode ${mode}: engine ${engine.count}, oracle ${oracle}`);
      for (const s of engine.solutions) { expect(isLatin(s, n)).toBe(true); expect(agrees(p, s)).toBe(true); }
      if (oracle === 0) none++; else if (oracle === 1) one++; else many++;
    }
    expect(none).toBeGreaterThan(5);
    expect(one).toBeGreaterThan(20);
    expect(many).toBeGreaterThan(20);
  }, 300_000);
  it('never modifies the puzzle it is given', () => {
    const { puzzle, solution } = makePuzzle(6, 'hard', mulberry32(9));
    const copy = JSON.stringify(puzzle);
    solve(puzzle, 3);
    hasUniqueSolution(puzzle);
    candidatesFor(puzzle, solution);
    nextHint(puzzle, puzzle.givens, solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
  it('candidate heights keep the true height, and come back null if the entries contradict the clues', () => {
    const rng = mulberry32(31);
    for (let t = 0; t < 60; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(900 + t));
      const grid = solution.map((v) => (rng() < 0.3 ? v : 0));
      const cand = candidatesFor(puzzle, grid);
      expect(cand).not.toBeNull();
      if (cand) solution.forEach((v, i) => expect((cand[i] >> v) & 1).toBe(1));
    }
    const p = blankPuzzle(4);
    const entries = new Array(16).fill(0);
    entries[0] = 2; entries[1] = 2;
    expect(candidatesFor(p, entries)).toBeNull();
    expect(digitsOf(0b10110)).toEqual([1, 2, 4]);
  });
});

// ── Generation ───────────────────────────────────────────────────────────────

describe('puzzle generation', () => {
  it('every 4x4 and 5x5 puzzle is well formed, has the stored Latin square as its only solution (independent counter), and clues that agree with it', () => {
    for (const n of [4, 5]) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 8; seed++) {
          const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
          const tag = `${n} ${level} #${seed}`;
          expect(() => checkPuzzle(puzzle), tag).not.toThrow();
          expect(isLatin(solution, n), tag).toBe(true);
          expect(agrees(puzzle, solution), tag).toBe(true);
          expect(isSolved(puzzle, solution), tag).toBe(true);
          expect(oracleCount(puzzle, 2), tag).toBe(1);
          expect(solve(puzzle, 2).solutions[0], tag).toEqual(solution);
        }
      }
    }
  }, 300_000);
  it('6x6 puzzles for seeds 1 to 4 of each level have exactly one solution, found by the solver and checked by the independent counter', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 4; seed++) {
        const { puzzle, solution } = makePuzzle(6, level, mulberry32(seed));
        const tag = `6 ${level} #${seed}`;
        const r = solve(puzzle, 2);
        expect(r.complete, tag).toBe(true);
        expect(r.count, tag).toBe(1);
        expect(r.solutions[0], tag).toEqual(solution);
        expect(agrees(puzzle, solution), tag).toBe(true);
        expect(oracleCount(puzzle, 2), tag).toBe(1);
      }
    }
  }, 600_000);
  it('Easy and Medium puzzles reach their clue targets on every seed tried, and the targets are pinned', () => {
    expect(SIZES.map((n) => targets(n, 'easy'))).toEqual([{ givens: 5, clues: 14 }, { givens: 8, clues: 17 }, { givens: 11, clues: 21 }]);
    expect(SIZES.map((n) => targets(n, 'medium'))).toEqual([{ givens: 2, clues: 11 }, { givens: 3, clues: 13 }, { givens: 5, clues: 16 }]);
    expect(SIZES.map((n) => targets(n, 'hard'))).toEqual(SIZES.map(() => ({ givens: 0, clues: 0 })));
    expect(GEN_NODES).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (const level of ['easy', 'medium'] as Level[]) {
        const t = targets(n, level);
        for (let seed = 1; seed <= 8; seed++) {
          const { puzzle } = makePuzzle(n, level, mulberry32(seed));
          expect(givenCount(puzzle), `${n} ${level} #${seed}`).toBeLessThanOrEqual(t.givens);
          expect(clueCount(puzzle), `${n} ${level} #${seed}`).toBeLessThanOrEqual(t.clues);
        }
      }
    }
  });
  it('a Hard puzzle is minimal: taking away any one given or edge clue gives more than one solution (independent counter)', () => {
    for (const n of [4, 5]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { puzzle } = makePuzzle(n, 'hard', mulberry32(seed));
        puzzle.givens.forEach((g, i) => {
          if (!g) return;
          const q = clone(puzzle);
          q.givens[i] = 0;
          expect(oracleCount(q, 2), `${n} #${seed} given ${i}`).toBeGreaterThan(1);
        });
        for (const side of SIDES) puzzle[side].forEach((s, k) => {
          if (!s) return;
          const q = clone(puzzle);
          q[side][k] = 0;
          expect(oracleCount(q, 2), `${n} #${seed} ${side} ${k}`).toBeGreaterThan(1);
        });
      }
    }
  }, 300_000);
  it('harder levels keep fewer clues in total', () => {
    const total = (n: number, level: Level) => {
      let t = 0;
      for (let seed = 1; seed <= 10; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; t += givenCount(p) + clueCount(p); }
      return t / 10;
    };
    for (const n of SIZES) {
      expect(total(n, 'easy')).toBeGreaterThan(total(n, 'medium'));
      expect(total(n, 'medium')).toBeGreaterThan(total(n, 'hard'));
    }
  }, 120_000);
  it('clue counts over seeds 1 to 20, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const g: number[] = [];
      const s: number[] = [];
      for (let seed = 1; seed <= 20; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; g.push(givenCount(p)); s.push(clueCount(p)); }
      return { givens: [Math.min(...g), Math.max(...g)], clues: [Math.min(...s), Math.max(...s)] };
    };
    const got = Object.fromEntries(SIZES.flatMap((n) => LEVELS.map((l) => [`${n}-${l}`, range(n, l)])));
    expect(got).toEqual(EXPECTED_RANGES);
  }, 300_000);
  it('is deterministic per seed and differs across seeds', () => {
    for (const n of SIZES) {
      expect(makePuzzle(n, 'medium', mulberry32(21))).toEqual(makePuzzle(n, 'medium', mulberry32(21)));
      expect(makePuzzle(n, 'medium', mulberry32(21)).solution).not.toEqual(makePuzzle(n, 'medium', mulberry32(22)).solution);
    }
  });
  it('a 6x6 Hard puzzle is made in a reasonable time (generous bound)', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= 6; seed++) makePuzzle(6, 'hard', mulberry32(seed));
    expect(performance.now() - t0).toBeLessThan(90_000);
  }, 120_000);
  it('rejects bad sizes', () => {
    expect(() => makePuzzle(2, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(7, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => latinSquare(0, mulberry32(1))).toThrow(RangeError);
  });
});


// ── The daily puzzle ─────────────────────────────────────────────────────────

describe('daily puzzle', () => {
  it('the same date, size and level give the same seed, and any change gives another', () => {
    const base = dailySeed('2026-11-05', 5, 'medium');
    expect(dailySeed('2026-11-05', 5, 'medium')).toBe(base);
    expect(dailySeed('2026-11-06', 5, 'medium')).not.toBe(base);
    expect(dailySeed('2026-11-05', 4, 'medium')).not.toBe(base);
    expect(dailySeed('2026-11-05', 5, 'hard')).not.toBe(base);
    expect(base).toBe(hashString('skyscrapers|2026-11-05|5|medium'));
    expect(Number.isInteger(base) && base >= 0 && base < 2 ** 32).toBe(true);
  });
  it('reads the date from one clock reading in the local zone', () => {
    const d = new Date(2026, 10, 5, 23, 59, 59);
    expect(localIsoDate(d)).toBe('2026-11-05');
    expect(dailyFor(5, 'easy', d)).toEqual({ date: '2026-11-05', seed: dailySeed('2026-11-05', 5, 'easy') });
    expect(localIsoDate(new Date(2027, 0, 2))).toBe('2027-01-02');
  });
  it('the same day gives the same puzzle on every device', () => {
    const day = dailyFor(4, 'medium', new Date(2026, 10, 5));
    const a = makePuzzle(4, 'medium', mulberry32(day.seed));
    const b = makePuzzle(4, 'medium', mulberry32(day.seed));
    expect(a).toEqual(b);
  });
});

// ── Hints ────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('on a board with no mistakes, name a right height for an empty square and always say something', () => {
    const rng = mulberry32(4242);
    const whys: Record<string, number> = {};
    for (let t = 0; t < 150; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[Math.floor(t / 3) % 3], mulberry32(1500 + t));
      const grid = puzzle.givens.map((g, i) => g || (rng() < rng() * 0.9 ? solution[i] : 0));
      if (grid.every((v) => v)) continue;
      const h = nextHint(puzzle, grid, solution);
      if (!h || h.kind !== 'move') throw new Error('expected a move hint');
      expect(grid[h.cell]).toBe(0);
      expect(h.value).toBe(solution[h.cell]);
      expect(h.text.length).toBeGreaterThan(15);
      expect(h.text).toMatch(/\.$/);
      expect(h.text.charAt(0)).toBe(h.text.charAt(0).toUpperCase());
      whys[h.why] = (whys[h.why] ?? 0) + 1;
    }
    expect((whys.last ?? 0) + (whys['only-height'] ?? 0) + (whys.one ?? 0) + (whys.full ?? 0)).toBeGreaterThan(90);
  }, 120_000);
  it('the last-gap reason is only given when that really is the last gap', () => {
    const { puzzle, solution } = makePuzzle(5, 'medium', mulberry32(3));
    const grid = solution.slice();
    const target = 7;
    grid[target] = 0;
    const h = nextHint(puzzle, grid, solution);
    expect(h).toMatchObject({ kind: 'move', cell: target, value: solution[target], why: 'last' });
    expect(h?.kind === 'move' && h.text).toBe(
      `${h?.kind === 'move' && h.text.startsWith('Row') ? `Row ${rowOf(5, target) + 1}` : `Column ${colOf(5, target) + 1}`} has every height except ${solution[target]}, so row ${rowOf(5, target) + 1}, column ${colOf(5, target) + 1} must be ${solution[target]}.`);
  });
  it('a clue of 1 and a clue of n are explained as such', () => {
    // 3x3 with left[0] = 1: the first square of row 0 must be 3.
    const p = blankPuzzle(3);
    const solution = [3, 1, 2, 1, 2, 3, 2, 3, 1];
    Object.assign(p, cluesOf(solution, 3));
    expect(p.left).toEqual([1, 3, 2]);
    expect(isSolved(p, solution)).toBe(true);
    const h = nextHint(p, new Array(9).fill(0), solution);
    expect(h?.kind).toBe('move');
    if (h?.kind === 'move') {
      expect(h.value).toBe(solution[h.cell]);
      expect(['one', 'full']).toContain(h.why);
      expect(h.text).toMatch(/clue of (1|3)/);
    }
  });
  it('flag wrong heights first and name them all', () => {
    const { puzzle, solution } = makePuzzle(6, 'medium', mulberry32(5));
    const grid = puzzle.givens.slice();
    const empties = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    grid[empties[0]] = solution[empties[0]] === 6 ? 5 : solution[empties[0]] + 1;
    grid[empties[1]] = solution[empties[1]];
    expect(nextHint(puzzle, grid, solution)).toEqual({ kind: 'mistake', cells: [empties[0]], text: '1 height is wrong. Fix it first, then ask for a hint.' });
    grid[empties[2]] = solution[empties[2]] === 6 ? 5 : solution[empties[2]] + 1;
    const h2 = nextHint(puzzle, grid, solution);
    expect(h2?.kind === 'mistake' && h2.text).toBe('2 heights are wrong. Fix them first, then ask for a hint.');
    expect(wrongCells(grid, solution)).toEqual([empties[0], empties[2]].sort((a, b) => a - b));
  });
  it('are null once every square is filled', () => {
    const { puzzle, solution } = makePuzzle(4, 'easy', mulberry32(2));
    expect(nextHint(puzzle, solution, solution)).toBeNull();
  });
  it('following the hints from a fresh puzzle fills in the whole answer, one square per hint', () => {
    for (const [n, level, seed] of [[4, 'easy', 1], [5, 'medium', 2], [6, 'hard', 3], [6, 'easy', 4], [5, 'hard', 5]] as const) {
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
      const grid = puzzle.givens.slice();
      let used = 0;
      for (let h = nextHint(puzzle, grid, solution); h && used < 100; h = nextHint(puzzle, grid, solution)) {
        if (h.kind !== 'move') throw new Error('unexpected mistake');
        grid[h.cell] = h.value;
        used++;
      }
      expect(used).toBe(n * n - givenCount(puzzle));
      expect(isSolved(puzzle, grid)).toBe(true);
      expect(grid).toEqual(solution);
    }
  }, 60_000);
});

// ── Fuzz ─────────────────────────────────────────────────────────────────────

describe('fuzz', () => {
  it('conflicts, clueState and isSolved never throw on random grids and never call a random grid solved', () => {
    const rng = mulberry32(8642);
    for (let t = 0; t < 600; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(3000 + (t % 40)));
      const grid = Array.from({ length: n * n }, () => (rng() < 0.7 ? 1 + Math.floor(rng() * n) : 0));
      expect(() => conflicts(puzzle, grid)).not.toThrow();
      for (const side of SIDES) for (let k = 0; k < n; k++) expect(() => clueState(puzzle, grid, side, k)).not.toThrow();
      expect(isSolved(puzzle, grid)).toBe(grid.every((v, i) => v === solution[i]));
    }
  }, 120_000);
  it('a solved grid has no conflicts, every clue reads ok, and no strict part of it conflicts or reads bad', () => {
    for (const n of SIZES) {
      const { puzzle, solution } = makePuzzle(n, 'medium', mulberry32(77));
      expect(conflicts(puzzle, solution).size).toBe(0);
      for (const side of SIDES) puzzle[side].forEach((c, k) => expect(clueState(puzzle, solution, side, k)).toBe(c ? 'ok' : ''));
      const rng = mulberry32(5);
      for (let t = 0; t < 40; t++) {
        const part = solution.map((v) => (rng() < 0.5 ? v : 0));
        expect(conflicts(puzzle, part).size).toBe(0);
        for (const side of SIDES) for (let k = 0; k < n; k++) expect(clueState(puzzle, part, side, k)).not.toBe('bad');
      }
    }
  });
});

// ── Saved best times and text ────────────────────────────────────────────────

describe('saved best times', () => {
  it('keys are size and level', () => {
    expect(bestKey(6, 'hard')).toBe('6-hard');
  });
  it('keeps whole positive seconds for known sizes and levels and drops everything else', () => {
    expect(sanitiseBest({ '4-easy': 75, '6-medium': 240, '5-hard': 3600 })).toEqual({ '4-easy': 75, '6-medium': 240, '5-hard': 3600 });
    expect(sanitiseBest({ '4-easy': 75, '3-easy': 3, '7-easy': 3, '4-wild': 3, x: 1 })).toEqual({ '4-easy': 75 });
    expect(sanitiseBest({ '4-easy': 0, '5-easy': -3, '6-easy': 1.5, '4-hard': NaN, '5-hard': Infinity })).toEqual({});
  });
  it('rejects numeric strings, booleans, arrays, null and objects; caps the value', () => {
    expect(sanitiseBest({ '4-easy': '12', '5-easy': true, '6-easy': [12], '4-hard': null, '5-hard': { a: 1 } })).toEqual({});
    expect(sanitiseBest({ '4-easy': MAX_BEST_SECONDS })).toEqual({ '4-easy': MAX_BEST_SECONDS });
    expect(sanitiseBest({ '4-easy': MAX_BEST_SECONDS + 1, '5-easy': 1e300 })).toEqual({});
  });
  it('survives storage that is not an object and ignores prototype keys', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"4-easy": 5}, "constructor": 3, "4-easy": 4}'));
    expect(out).toEqual({ '4-easy': 4 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
});

describe('text and time', () => {
  it('formats time and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
  it('plural, where and placement messages', () => {
    expect(plural(1, 'height')).toBe('1 height');
    expect(plural(2, 'height')).toBe('2 heights');
    expect(where(5, 7)).toBe('row 2, column 3');
    expect(placeMessage(5, 7, 4)).toBe('Row 2, column 3: 4.');
    expect(placeMessage(5, 7, 0)).toBe('Row 2, column 3: cleared.');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
