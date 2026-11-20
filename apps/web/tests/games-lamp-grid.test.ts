/**
 * games-lamp-grid.test.ts - the engine behind `lamp-grid`.
 *
 * Pinned: exact counts that can be worked out by hand (an empty n by n grid has n! solutions, because lamps
 * then sit one per row and column; a single white run of k squares has k; a run split by a black square
 * multiplies); the light a lamp casts against a plain scan; the rules against a brute force that tries every
 * set of lamps on small boards; the solver's count against that brute force and against a second independently
 * written counter (square by square, with a check as soon as a square can no longer change) on random layouts
 * with numbers shown, removed and damaged; every generated puzzle has exactly one solution per the second
 * counter; a Hard puzzle has no number left to remove; the number counts quoted on the guide page; hints never
 * contradict the solution and repeated hints finish the puzzle; the daily seed; storage is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, WHITE, BLACK, EMPTY, LAMP, DOT, MAX_BEST_SECONDS, GEN_NODES, MAX_ATTEMPTS,
  mulberry32, hashString, shuffled, blankPuzzle, checkPuzzle, orth, isWhite, isNumbered, whiteCount, numberCount, blackCount,
  lightFrom, litSquares, clashingLamps, lampsBeside, numberState, isSolved, lampsOf, solve, hasUniqueSolution, makePuzzle,
  blackShare, keepShare, nextHint, wrongMarks, bestKey, sanitiseBest, formatTime, plural, where, markMessage, rowOf, colOf,
  dailySeed, dailyFor, localIsoDate,
  type Puzzle, type Level,
} from '../src/components/apps-private/lamp-grid/helpers';

// ── Independent oracles ──────────────────────────────────────────────────────

/** Squares a lamp at i lights, found by walking in four directions until a black square or the edge. */
const walk = (p: Puzzle, i: number): number[] => {
  const n = p.n;
  const out = [i];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let r = rowOf(n, i) + dr;
    let c = colOf(n, i) + dc;
    while (r >= 0 && r < n && c >= 0 && c < n && p.cells[r * n + c] === WHITE) { out.push(r * n + c); r += dr; c += dc; }
  }
  return out;
};

/** Every rule in plain terms, for a set of lamp squares. */
const bruteRules = (p: Puzzle, lamps: number[]): boolean => {
  const n = p.n;
  for (const l of lamps) if (p.cells[l] !== WHITE) return false;
  const lit = new Set<number>();
  for (const l of lamps) for (const s of walk(p, l)) lit.add(s);
  for (const l of lamps) for (const s of walk(p, l)) if (s !== l && lamps.includes(s)) return false;
  for (let i = 0; i < n * n; i++) {
    if (p.cells[i] === WHITE && !lit.has(i)) return false;
    if (p.cells[i] >= 0) {
      const beside = [i - n, i + n, i - 1, i + 1].filter((j) => j >= 0 && j < n * n && Math.abs(rowOf(n, j) - rowOf(n, i)) + Math.abs(colOf(n, j) - colOf(n, i)) === 1 && lamps.includes(j)).length;
      if (beside !== p.cells[i]) return false;
    }
  }
  return true;
};

/** Count solutions by trying every subset of the white squares. Only for boards with 20 white squares or fewer. */
const bruteCount = (p: Puzzle, cap: number): number => {
  const whites = p.cells.map((c, i) => (c === WHITE ? i : -1)).filter((i) => i >= 0);
  if (whites.length > 20) throw new Error('too many white squares for brute force');
  let count = 0;
  for (let m = 0; m < 1 << whites.length; m++) {
    const lamps: number[] = [];
    for (let b = 0; b < whites.length; b++) if ((m >> b) & 1) lamps.push(whites[b]);
    if (bruteRules(p, lamps)) { count++; if (count >= cap) break; }
  }
  return count;
};

/**
 * Second counter: decide white squares in reading order, lamp or not. A lamp may not see an earlier lamp. A white
 * square must be lit by the time every square that could light it has been decided (the last of those is the
 * furthest along its own row run or column run). A numbered square is checked once its neighbours are decided,
 * and dropped early if it already has too many.
 */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 30_000_000): number => {
  const n = p.n;
  const lamp = new Array<boolean>(n * n).fill(false);
  const runCells = (i: number): number[] => walk(p, i);
  const lastSource = new Map<number, number>();
  for (let i = 0; i < n * n; i++) if (p.cells[i] === WHITE) lastSource.set(i, Math.max(...runCells(i)));
  const lastNeighbour = new Map<number, number>();
  for (let i = 0; i < n * n; i++) {
    if (p.cells[i] < 0) continue;
    const nb = [i - n, i + n, i - 1, i + 1].filter((j) => j >= 0 && j < n * n && Math.abs(rowOf(n, j) - rowOf(n, i)) + Math.abs(colOf(n, j) - colOf(n, i)) === 1 && p.cells[j] === WHITE);
    lastNeighbour.set(i, nb.length ? Math.max(...nb) : -1);
  }
  const dueAt = (k: number): number[] => [...lastSource].filter(([, v]) => v === k).map(([i]) => i);
  const numsDueAt = (k: number): number[] => [...lastNeighbour].filter(([, v]) => v === k).map(([i]) => i);
  const dueTable: number[][] = Array.from({ length: n * n }, (_, k) => dueAt(k));
  const numTable: number[][] = Array.from({ length: n * n }, (_, k) => numsDueAt(k));
  const beside = (i: number): number => [i - n, i + n, i - 1, i + 1].filter((j) => j >= 0 && j < n * n && Math.abs(rowOf(n, j) - rowOf(n, i)) + Math.abs(colOf(n, j) - colOf(n, i)) === 1 && lamp[j]).length;
  let count = 0;
  let nodes = 0;
  const check = (k: number): boolean => {
    for (const i of dueTable[k]) if (!runCells(i).some((j) => lamp[j])) return false;
    for (const i of numTable[k]) if (beside(i) !== p.cells[i]) return false;
    return true;
  };
  // Black squares with no white neighbour and numbers of 0 are checked at the start.
  for (let i = 0; i < n * n; i++) if (p.cells[i] > 0 && lastNeighbour.get(i) === -1) return 0;
  const go = (k: number): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    if (k === n * n) { count++; return; }
    if (p.cells[k] !== WHITE) {
      if (check(k)) go(k + 1);
      return;
    }
    // no lamp here
    if (check(k)) go(k + 1);
    if (count >= cap) return;
    // a lamp here, if no earlier lamp shines on it
    if (!runCells(k).some((j) => j < k && lamp[j])) {
      lamp[k] = true;
      let over = false;
      for (const i of [k - n, k + n, k - 1, k + 1]) {
        if (i < 0 || i >= n * n || Math.abs(rowOf(n, i) - rowOf(n, k)) + Math.abs(colOf(n, i) - colOf(n, k)) !== 1) continue;
        if (p.cells[i] >= 0 && beside(i) > p.cells[i]) over = true;
      }
      if (!over && check(k)) go(k + 1);
      lamp[k] = false;
    }
  };
  go(0);
  return count;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, cells: p.cells.slice() });

/** A random puzzle built here and not by the engine: random black squares, random lamps lighting everything, numbers read off. */
const randomPuzzle = (n: number, rng: () => number, blackPct: number): Puzzle => {
  const cells = new Array<number>(n * n).fill(WHITE);
  for (let i = 0; i < n * n; i++) if (rng() * 100 < blackPct) cells[i] = BLACK;
  const base: Puzzle = { n, cells };
  const lamps: number[] = [];
  const lit = new Set<number>();
  for (const i of shuffled(Array.from({ length: n * n }, (_, k) => k), rng)) {
    if (cells[i] !== WHITE || lit.has(i)) continue;
    const spots = walk(base, i).filter((j) => !lit.has(j));
    const at = spots[Math.floor(rng() * spots.length)];
    lamps.push(at);
    for (const s of walk(base, at)) lit.add(s);
  }
  for (let i = 0; i < n * n; i++) {
    if (cells[i] !== BLACK) continue;
    const nb = [i - n, i + n, i - 1, i + 1].filter((j) => j >= 0 && j < n * n && Math.abs(rowOf(n, j) - rowOf(n, i)) + Math.abs(colOf(n, j) - colOf(n, i)) === 1 && cells[j] === WHITE);
    if (nb.length && rng() < 0.8) cells[i] = nb.filter((j) => lamps.includes(j)).length;
  }
  return base;
};

const fromRows = (rows: string[]): Puzzle => {
  const n = rows.length;
  return { n, cells: rows.join('').split('').map((ch) => (ch === '.' ? WHITE : ch === '#' ? BLACK : Number(ch))) };
};

const EXPECTED_RANGES: Record<string, { black: number[]; numbers: number[] }> = {
  '5-easy': { black: [6, 6], numbers: [6, 6] }, '5-medium': { black: [6, 6], numbers: [4, 5] }, '5-hard': { black: [6, 6], numbers: [3, 5] },
  '7-easy': { black: [11, 11], numbers: [11, 11] }, '7-medium': { black: [11, 11], numbers: [8, 9] }, '7-hard': { black: [11, 11], numbers: [5, 9] },
  '9-easy': { black: [16, 16], numbers: [16, 16] }, '9-medium': { black: [16, 16], numbers: [11, 13] }, '9-hard': { black: [16, 16], numbers: [7, 13] },
};

// ── Light and geometry ───────────────────────────────────────────────────────

describe('light', () => {
  const p = fromRows([
    '..#..',
    '.....',
    '#.1..',
    '.....',
    '..#..',
  ]);
  it('a lamp shines up, down, left and right until a black square or the edge', () => {
    // the lamp at (1,1) = 6: row 1 is all white, column 1 is white all the way down
    expect(lightFrom(p, 6)).toEqual([1, 5, 6, 7, 8, 9, 11, 16, 21]);
    // the lamp at (2,3) = 13: the numbered black square at 12 stops the light to the left
    expect(lightFrom(p, 13)).toEqual([3, 8, 13, 14, 18, 23]);
    expect(lightFrom(p, 2)).toEqual([]); // a black square lights nothing
    expect(lightFrom(p, 12)).toEqual([]);
  });
  it('lightFrom agrees with the plain walk on random boards', () => {
    const rng = mulberry32(21);
    for (let t = 0; t < 60; t++) {
      const n = 4 + (t % 6);
      const q = randomPuzzle(n, rng, 20);
      for (let i = 0; i < n * n; i++) expect(lightFrom(q, i), `t=${t} i=${i}`).toEqual(q.cells[i] === WHITE ? walk(q, i).sort((a, b) => a - b) : []);
    }
  });
  it('litSquares and clashingLamps read lamps from the marks', () => {
    const marks = new Array(25).fill(EMPTY);
    marks[6] = LAMP;
    const lit = litSquares(p, marks);
    expect(lit.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual(walk(p, 6).sort((a, b) => a - b));
    expect(clashingLamps(p, marks).size).toBe(0);
    marks[8] = LAMP; // same row, nothing between
    expect([...clashingLamps(p, marks)].sort((a, b) => a - b)).toEqual([6, 8]);
    marks[7] = DOT;
    expect(litSquares(p, marks)[7]).toBe(true); // a dot never lights anything, but the square is lit by the lamps
    const dots = new Array(25).fill(DOT);
    expect(litSquares(p, dots).some(Boolean)).toBe(false);
    marks[2] = LAMP; // a lamp on a black square is ignored
    expect(clashingLamps(p, marks).has(2)).toBe(false);
  });
  it('a black square blocks the light', () => {
    const q = fromRows(['.#..', '....', '....', '....']);
    expect(lightFrom(q, 0)).toEqual([0, 4, 8, 12]);
    expect(lightFrom(q, 2)).toEqual([2, 3, 6, 10, 14]);
  });
});

// ── Exact counts ─────────────────────────────────────────────────────────────

describe('exact counts', () => {
  it('an empty n by n grid has n! solutions: one lamp in every row and every column', () => {
    const fact = [1, 1, 2, 6, 24, 120, 720, 5040];
    for (const n of [4, 5, 6, 7]) {
      const r = solve(blankPuzzle(n), 100_000);
      expect(r.complete, `n=${n}`).toBe(true);
      expect(r.count, `n=${n}`).toBe(fact[n]);
      for (const s of r.solutions.slice(0, 50)) {
        const lamps = s.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        expect(new Set(lamps.map((l) => rowOf(n, l))).size).toBe(n);
        expect(new Set(lamps.map((l) => colOf(n, l))).size).toBe(n);
      }
    }
    expect(oracleCount(blankPuzzle(4), 1000)).toBe(24);
    expect(oracleCount(blankPuzzle(5), 1000)).toBe(120);
    expect(bruteCount(blankPuzzle(4), 1000)).toBe(24);
  });
  it('one white run of k squares has k solutions, and a run cut by a black square multiplies', () => {
    const one = fromRows(['....', '####', '####', '####']);
    expect(solve(one, 100).count).toBe(4);
    expect(oracleCount(one, 100)).toBe(4);
    expect(bruteCount(one, 100)).toBe(4);
    const cut = fromRows(['.#..', '####', '####', '####']);
    expect(solve(cut, 100).count).toBe(2);
    expect(bruteCount(cut, 100)).toBe(2);
    const two = fromRows(['...#', '#...', '####', '####']);
    // row 0 run of 3, row 1 run of 3, columns 1 and 2 join them: counted by all three
    expect(solve(two, 100).count).toBe(bruteCount(two, 100));
    expect(oracleCount(two, 100)).toBe(bruteCount(two, 100));
  });
  it('a number tells how many lamps touch the black square', () => {
    const q = fromRows(['.1..', '....', '....', '....']);
    const r = solve(q, 10_000);
    for (const s of r.solutions) {
      const lamps = s.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      expect([0, 2, 5].filter((j) => lamps.includes(j)).length).toBe(1);
    }
    expect(r.count).toBe(bruteCount(q, 10_000));
    expect(r.count).toBe(oracleCount(q, 10_000));
    const zero = fromRows(['.0..', '....', '....', '....']);
    for (const s of solve(zero, 10_000).solutions) expect([0, 2, 5].some((j) => s[j] === 1)).toBe(false);
  });
  it('impossible numbers leave no solution', () => {
    const q = fromRows(['.4..', '....', '....', '....']); // only three white squares touch it
    expect(solve(q, 10).count).toBe(0);
    expect(bruteCount(q, 10)).toBe(0);
    expect(oracleCount(q, 10)).toBe(0);
    const r = fromRows(['3...', '....', '....', '....']); // a corner has two neighbours
    expect(solve(r, 10).count).toBe(0);
    expect(oracleCount(r, 10)).toBe(0);
    expect(bruteCount(r, 10)).toBe(0);
  });
});

// ── Rules ────────────────────────────────────────────────────────────────────

describe('rules', () => {
  it('rejects malformed puzzles', () => {
    expect(() => blankPuzzle(3)).toThrow(RangeError);
    expect(() => blankPuzzle(11)).toThrow(RangeError);
    const good = blankPuzzle(5);
    expect(() => checkPuzzle(good)).not.toThrow();
    expect(() => checkPuzzle({ ...good, cells: good.cells.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, cells: [5, ...good.cells.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, cells: [-3, ...good.cells.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, cells: [1.5, ...good.cells.slice(1)] })).toThrow(RangeError);
    expect(() => solve({ ...good, n: 12 })).toThrow(RangeError);
  });
  it('counts squares', () => {
    const q = fromRows(['.#2.', '....', '1...', '#...']);
    expect(whiteCount(q)).toBe(12);
    expect(numberCount(q)).toBe(2);
    expect(blackCount(q)).toBe(4);
    expect(isWhite(q, 0)).toBe(true);
    expect(isNumbered(q, 2)).toBe(true);
    expect(isNumbered(q, 1)).toBe(false);
    expect(orth(4, 5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9]);
  });
  it('numberState says ok, over or nothing, and lampsBeside counts', () => {
    const q = fromRows(['.1..', '....', '....', '....']);
    const marks = new Array(16).fill(EMPTY);
    expect(numberState(q, marks, 1)).toBe('');
    marks[0] = LAMP;
    expect(numberState(q, marks, 1)).toBe('ok');
    marks[2] = LAMP;
    expect(numberState(q, marks, 1)).toBe('over');
    expect(lampsBeside(q, marks, 1)).toBe(2);
    expect(numberState(q, marks, 0)).toBe('');
  });
  it('isSolved agrees with the plain rules on generated, damaged and random boards', () => {
    const rng = mulberry32(55);
    for (let t = 0; t < 300; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(200 + (t % 30)));
      const marks = solution.slice();
      const mode = t % 5;
      if (mode === 1) { const i = Math.floor(rng() * marks.length); marks[i] = marks[i] === 1 ? 0 : 1; }
      if (mode === 2) { const ls = lampsOf(marks); const a = ls[Math.floor(rng() * ls.length)]; marks[a] = 0; marks[Math.min(n * n - 1, a + 1)] = 1; }
      if (mode === 3) for (let i = 0; i < marks.length; i++) if (marks[i] === 0 && rng() < 0.3) marks[i] = DOT;
      if (mode === 4) marks[Math.floor(rng() * marks.length)] = LAMP;
      expect(isSolved(puzzle, marks), `t=${t} mode ${mode}`).toBe(bruteRules(puzzle, lampsOf(marks)));
    }
  });
  it('a solved board has every white square lit, no clashes and every number ok', () => {
    for (const n of SIZES) {
      const { puzzle, solution } = makePuzzle(n, 'easy', mulberry32(40));
      expect(isSolved(puzzle, solution)).toBe(true);
      expect(clashingLamps(puzzle, solution).size).toBe(0);
      const lit = litSquares(puzzle, solution);
      puzzle.cells.forEach((c, i) => { if (c === WHITE) expect(lit[i]).toBe(true); if (c >= 0) expect(numberState(puzzle, solution, i)).toBe('ok'); });
    }
  });
});

// ── Solver against the independent counters ───────────────────────────────────

describe('solver', () => {
  it('agrees with the brute force and the square-by-square counter on random layouts up to 5x5, numbers shown, removed and damaged', () => {
    const rng = mulberry32(2718);
    let none = 0;
    let one = 0;
    let many = 0;
    let compared = 0;
    for (let t = 0; t < 200; t++) {
      const n = 4 + (t % 2);
      const p = randomPuzzle(n, rng, 18 + (t % 4) * 4);
      if (whiteCount(p) > 18) continue;
      const mode = t % 4;
      if (mode === 1) for (let i = 0; i < n * n; i++) if (p.cells[i] >= 0 && rng() < 0.5) p.cells[i] = BLACK;
      if (mode === 3) { const nums = p.cells.map((c, i) => (c >= 0 ? i : -1)).filter((i) => i >= 0); if (nums.length) { const i = nums[Math.floor(rng() * nums.length)]; p.cells[i] = (p.cells[i] + 1) % 5; } }
      const cap = 5;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      const brute = bruteCount(p, cap);
      const second = oracleCount(p, cap);
      if (engine.count !== brute || brute !== second) throw new Error(`t=${t} n=${n} mode ${mode}: engine ${engine.count}, brute ${brute}, second ${second}\n${p.cells.join(',')}`);
      for (const s of engine.solutions) expect(bruteRules(p, s.map((v, i) => (v ? i : -1)).filter((i) => i >= 0))).toBe(true);
      if (brute === 0) none++; else if (brute === 1) one++; else many++;
      compared++;
    }
    expect(compared).toBeGreaterThan(120);
    expect(none).toBeGreaterThan(5);
    expect(one).toBeGreaterThan(10);
    expect(many).toBeGreaterThan(10);
  }, 300_000);
  it('agrees with the square-by-square counter on random layouts of 6x6 to 8x8', () => {
    const rng = mulberry32(99);
    let compared = 0;
    for (let t = 0; t < 40; t++) {
      const n = 6 + (t % 3);
      const p = randomPuzzle(n, rng, 20);
      if (t % 3 === 1) for (let i = 0; i < n * n; i++) if (p.cells[i] >= 0 && rng() < 0.4) p.cells[i] = BLACK;
      const cap = 4;
      const engine = solve(p, cap, 2_000_000);
      expect(engine.complete).toBe(true);
      expect(engine.count, `t=${t} n=${n}`).toBe(oracleCount(p, cap));
      compared++;
    }
    expect(compared).toBe(40);
  }, 300_000);
  it('stops on a spent node budget and says so', () => {
    const { puzzle } = makePuzzle(9, 'hard', mulberry32(3));
    const r = solve(puzzle, 1_000_000, 0);
    expect(r.complete).toBe(false);
    expect(hasUniqueSolution(puzzle, 0)).toBe(false);
    expect(hasUniqueSolution(puzzle)).toBe(true);
  });
  it('never modifies the puzzle it is given', () => {
    const { puzzle, solution } = makePuzzle(7, 'hard', mulberry32(9));
    const copy = JSON.stringify(puzzle);
    solve(puzzle, 3);
    hasUniqueSolution(puzzle);
    nextHint(puzzle, new Array(49).fill(0), solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
});

// ── Generation ───────────────────────────────────────────────────────────────

describe('puzzle generation', () => {
  it('every 5x5 and 7x7 puzzle is well formed and has the stored lamps as its only solution per the independent counters', () => {
    for (const n of [5, 7]) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 10; seed++) {
          const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
          const tag = `${n} ${level} #${seed}`;
          expect(() => checkPuzzle(puzzle), tag).not.toThrow();
          expect(isSolved(puzzle, solution), tag).toBe(true);
          expect(bruteRules(puzzle, lampsOf(solution)), tag).toBe(true);
          expect(oracleCount(puzzle, 2), tag).toBe(1);
          expect(solve(puzzle, 2).solutions[0], tag).toEqual(solution);
          if (n === 5 && whiteCount(puzzle) <= 18) expect(bruteCount(puzzle, 2), tag).toBe(1);
        }
      }
    }
  }, 300_000);
  it('9x9 puzzles for seeds 1 to 8 of each level have exactly one solution per the square-by-square counter', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 8; seed++) {
        const { puzzle, solution } = makePuzzle(9, level, mulberry32(seed));
        const tag = `9 ${level} #${seed}`;
        const r = solve(puzzle, 2);
        expect(r.complete, tag).toBe(true);
        expect(r.count, tag).toBe(1);
        expect(r.solutions[0], tag).toEqual(solution);
        expect(oracleCount(puzzle, 2), tag).toBe(1);
      }
    }
  }, 600_000);
  it('Easy shows a number on every black square that touches a white one; the targets are pinned', () => {
    expect(SIZES.map((n) => blackShare(n))).toEqual([24, 22, 20]);
    expect(LEVELS.map((l) => keepShare(l))).toEqual([100, 65, 0]);
    expect(GEN_NODES).toBeGreaterThan(0);
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (let seed = 1; seed <= 12; seed++) {
        const p = makePuzzle(n, 'easy', mulberry32(seed)).puzzle;
        p.cells.forEach((c, i) => {
          if (c >= WHITE && c !== WHITE) {
            const touchesWhite = orth(n, i).some((j) => p.cells[j] === WHITE);
            expect(c >= 0, `${n} #${seed} square ${i}`).toBe(touchesWhite);
          }
        });
      }
    }
  });
  it('a Hard puzzle is minimal: taking away any one number gives more than one solution (independent counter)', () => {
    for (const n of [5, 7, 9]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { puzzle } = makePuzzle(n, 'hard', mulberry32(seed));
        puzzle.cells.forEach((c, i) => {
          if (c < 0) return;
          const q = clone(puzzle);
          q.cells[i] = BLACK;
          expect(oracleCount(q, 2), `${n} #${seed} number at ${i}`).toBeGreaterThan(1);
        });
      }
    }
  }, 300_000);
  it('harder levels keep fewer numbers on the same layout', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 8; seed++) {
        const easy = numberCount(makePuzzle(n, 'easy', mulberry32(seed)).puzzle);
        const medium = numberCount(makePuzzle(n, 'medium', mulberry32(seed)).puzzle);
        const hard = numberCount(makePuzzle(n, 'hard', mulberry32(seed)).puzzle);
        expect(medium, `${n} #${seed}`).toBeLessThanOrEqual(easy);
        expect(hard, `${n} #${seed}`).toBeLessThanOrEqual(medium);
      }
    }
  }, 120_000);
  it('black squares and numbers over seeds 1 to 20, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const b: number[] = [];
      const m: number[] = [];
      for (let seed = 1; seed <= 20; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; b.push(blackCount(p)); m.push(numberCount(p)); }
      return { black: [Math.min(...b), Math.max(...b)], numbers: [Math.min(...m), Math.max(...m)] };
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
  it('a 9x9 Hard puzzle is made in a reasonable time (generous bound)', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= 8; seed++) makePuzzle(9, 'hard', mulberry32(seed));
    expect(performance.now() - t0).toBeLessThan(90_000);
  }, 120_000);
  it('rejects bad sizes', () => {
    expect(() => makePuzzle(3, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(11, 'easy', mulberry32(1))).toThrow(RangeError);
  });
});


// ── The daily puzzle ─────────────────────────────────────────────────────────

describe('daily puzzle', () => {
  it('the same date, size and level give the same seed, and any change gives another', () => {
    const base = dailySeed('2026-11-05', 7, 'medium');
    expect(dailySeed('2026-11-05', 7, 'medium')).toBe(base);
    expect(dailySeed('2026-11-06', 7, 'medium')).not.toBe(base);
    expect(dailySeed('2026-11-05', 5, 'medium')).not.toBe(base);
    expect(dailySeed('2026-11-05', 7, 'hard')).not.toBe(base);
    expect(base).toBe(hashString('lamp-grid|2026-11-05|7|medium'));
    expect(Number.isInteger(base) && base >= 0 && base < 2 ** 32).toBe(true);
  });
  it('reads the date from one clock reading in the local zone', () => {
    const d = new Date(2026, 10, 5, 23, 59, 59);
    expect(localIsoDate(d)).toBe('2026-11-05');
    expect(dailyFor(7, 'easy', d)).toEqual({ date: '2026-11-05', seed: dailySeed('2026-11-05', 7, 'easy') });
    expect(localIsoDate(new Date(2027, 0, 2))).toBe('2027-01-02');
  });
  it('the same day gives the same puzzle on every device', () => {
    const day = dailyFor(9, 'hard', new Date(2026, 10, 5));
    expect(makePuzzle(9, 'hard', mulberry32(day.seed))).toEqual(makePuzzle(9, 'hard', mulberry32(day.seed)));
  });
});

// ── Hints ────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('flags wrong marks first and names them all', () => {
    const { puzzle, solution } = makePuzzle(5, 'easy', mulberry32(3));
    const ls = lampsOf(solution);
    const marks = new Array(25).fill(0);
    const nonLamp = solution.findIndex((v, i) => v === 0 && puzzle.cells[i] === WHITE);
    marks[nonLamp] = LAMP; // a lamp the answer does not have
    marks[ls[0]] = DOT; // a dot where the answer has a lamp
    expect(wrongMarks(marks, solution)).toEqual([nonLamp, ls[0]].sort((a, b) => a - b));
    const h = nextHint(puzzle, marks, solution);
    expect(h).toEqual({ kind: 'mistake', cells: [nonLamp, ls[0]].sort((a, b) => a - b), text: '2 marks are wrong. Fix them first, then ask for a hint.' });
    marks[ls[0]] = 0;
    expect(nextHint(puzzle, marks, solution)).toEqual({ kind: 'mistake', cells: [nonLamp], text: '1 mark is wrong. Fix it first, then ask for a hint.' });
  });
  it('a lone white run gets the "nothing else can light it" explanation', () => {
    const q = fromRows(['.###', '####', '####', '####']);
    const solution = new Array(16).fill(0);
    solution[0] = 1;
    expect(solve(q, 5).count).toBe(1);
    expect(nextHint(q, new Array(16).fill(0), solution)).toEqual({ kind: 'move', cell: 0, mark: LAMP, why: 'only-source', text: 'Nothing else can light row 1, column 1, so it needs a lamp of its own.' });
  });
  it('a hint never contradicts the solution, on boards with random correct marks', () => {
    const rng = mulberry32(4242);
    const whys: Record<string, number> = {};
    for (let t = 0; t < 240; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[Math.floor(t / 3) % 3], mulberry32(1500 + t));
      const marks = new Array(n * n).fill(0);
      const keep = rng() * 0.8;
      for (let i = 0; i < n * n; i++) {
        if (solution[i] === 1 && rng() < keep) marks[i] = LAMP;
        else if (solution[i] === 0 && puzzle.cells[i] === WHITE && rng() < keep * 0.4) marks[i] = DOT;
      }
      const h = nextHint(puzzle, marks, solution);
      if (!h) { expect(lampsOf(marks).length).toBe(lampsOf(solution).length); continue; }
      if (h.kind !== 'move') throw new Error('expected a move hint');
      expect(marks[h.cell]).not.toBe(h.mark);
      expect(puzzle.cells[h.cell]).toBe(WHITE);
      if (h.mark === LAMP) expect(solution[h.cell], `t=${t} ${h.why}`).toBe(1);
      else expect(solution[h.cell], `t=${t} ${h.why}`).toBe(0);
      expect(h.text.length).toBeGreaterThan(15);
      expect(h.text).toMatch(/\.$/);
      expect(h.text.charAt(0)).toBe(h.text.charAt(0).toUpperCase());
      whys[h.why] = (whys[h.why] ?? 0) + 1;
    }
    expect(Object.keys(whys).length).toBeGreaterThanOrEqual(3);
    const reasoned = Object.entries(whys).filter(([k]) => k !== 'reveal').reduce((a, [, v]) => a + v, 0);
    expect(reasoned).toBeGreaterThan(150);
  }, 180_000);
  it('following the hints from a fresh puzzle places every lamp and never a wrong mark', () => {
    for (const [n, level, seed] of [[5, 'easy', 1], [7, 'medium', 2], [9, 'hard', 3], [9, 'easy', 4], [7, 'hard', 5], [5, 'hard', 6]] as const) {
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
      const marks = new Array(n * n).fill(0);
      let used = 0;
      for (let h = nextHint(puzzle, marks, solution); h && used < 400; h = nextHint(puzzle, marks, solution)) {
        if (h.kind !== 'move') throw new Error('unexpected mistake');
        marks[h.cell] = h.mark;
        used++;
        expect(wrongMarks(marks, solution)).toEqual([]);
      }
      expect(isSolved(puzzle, marks), `${n} ${level} #${seed}`).toBe(true);
      expect(lampsOf(marks)).toEqual(lampsOf(solution));
    }
  }, 120_000);
  it('are null once every lamp is placed', () => {
    const { puzzle, solution } = makePuzzle(5, 'easy', mulberry32(2));
    expect(nextHint(puzzle, solution, solution)).toBeNull();
  });
});

// ── Fuzz ─────────────────────────────────────────────────────────────────────

describe('fuzz', () => {
  it('rule checks never throw on random boards and never call a random board solved', () => {
    const rng = mulberry32(8642);
    for (let t = 0; t < 600; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(3000 + (t % 40)));
      const marks = Array.from({ length: n * n }, () => Math.floor(rng() * 3));
      expect(() => clashingLamps(puzzle, marks)).not.toThrow();
      expect(() => litSquares(puzzle, marks)).not.toThrow();
      puzzle.cells.forEach((_, i) => expect(() => numberState(puzzle, marks, i)).not.toThrow());
      const same = marks.every((v, i) => (v === LAMP) === (solution[i] === 1));
      expect(isSolved(puzzle, marks)).toBe(same);
    }
  }, 120_000);
  it('dot marks never change whether a board is solved', () => {
    const { puzzle, solution } = makePuzzle(7, 'medium', mulberry32(10));
    const rng = mulberry32(3);
    for (let t = 0; t < 30; t++) {
      const marks = solution.map((v, i) => (v === 1 ? LAMP : puzzle.cells[i] === WHITE && rng() < 0.5 ? DOT : 0));
      expect(isSolved(puzzle, marks)).toBe(true);
    }
  });
});

// ── Saved best times and text ────────────────────────────────────────────────

describe('saved best times', () => {
  it('keys are size and level', () => {
    expect(bestKey(9, 'hard')).toBe('9-hard');
  });
  it('keeps whole positive seconds for known sizes and levels and drops everything else', () => {
    expect(sanitiseBest({ '5-easy': 75, '7-medium': 240, '9-hard': 3600 })).toEqual({ '5-easy': 75, '7-medium': 240, '9-hard': 3600 });
    expect(sanitiseBest({ '5-easy': 75, '4-easy': 3, '10-easy': 3, '5-wild': 3, x: 1 })).toEqual({ '5-easy': 75 });
    expect(sanitiseBest({ '5-easy': 0, '7-easy': -3, '9-easy': 1.5, '5-hard': NaN, '7-hard': Infinity })).toEqual({});
  });
  it('rejects numeric strings, booleans, arrays, null and objects; caps the value', () => {
    expect(sanitiseBest({ '5-easy': '12', '7-easy': true, '9-easy': [12], '5-hard': null, '7-hard': { a: 1 } })).toEqual({});
    expect(sanitiseBest({ '5-easy': MAX_BEST_SECONDS })).toEqual({ '5-easy': MAX_BEST_SECONDS });
    expect(sanitiseBest({ '5-easy': MAX_BEST_SECONDS + 1, '7-easy': 1e300 })).toEqual({});
  });
  it('survives storage that is not an object and ignores prototype keys', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"5-easy": 5}, "constructor": 3, "5-easy": 4}'));
    expect(out).toEqual({ '5-easy': 4 });
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
  it('plural, where and mark messages', () => {
    expect(plural(1, 'lamp')).toBe('1 lamp');
    expect(plural(2, 'lamp')).toBe('2 lamps');
    expect(where(5, 7)).toBe('row 2, column 3');
    expect(markMessage(5, 7, LAMP)).toBe('Row 2, column 3: lamp.');
    expect(markMessage(5, 7, DOT)).toBe('Row 2, column 3: no lamp here.');
    expect(markMessage(5, 7, 0)).toBe('Row 2, column 3: cleared.');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
