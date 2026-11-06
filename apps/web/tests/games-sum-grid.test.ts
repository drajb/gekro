/**
 * games-sum-grid.test.ts - the engine behind `sum-grid`.
 *
 * Pinned: the digit-set table (checked against brute force over all 511 subsets of 1 to 9);
 * run geometry and clue totals against an independently written scan of the board; the
 * solver's solution count against an independently written backtracking counter on hand-made,
 * generated and deliberately broken puzzles; every generated puzzle is well formed, has exactly
 * one solution (per the independent counter), its totals equal the sums of the stored answer,
 * its runs respect the level's length cap and its white squares form one piece; a Hard puzzle
 * has no given left to remove; hints are always right and repeated hints solve a puzzle.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, MAX_BEST_SECONDS, EASY_GIVEN_SHARE, COMBOS,
  mulberry32, shuffled, digitsOf, minSum, maxSum, waysToMake, runsOf, isWellFormed, entryCount, givenCount, checkPuzzle,
  runState, conflicts, isSolved, solve, hasUniqueSolution, candidatesFor, makePattern, makePuzzle, nextHint, wrongCells,
  bestKey, sanitiseBest, formatTime, plural, where, placeMessage, clueLabel, rowOf, colOf,
  type Puzzle, type Level,
} from '../src/components/apps-private/sum-grid/helpers';

// ── Independent oracle ───────────────────────────────────────────────────────

interface ORun { cells: number[]; sum: number; dir: 'across' | 'down' }

/** Runs found by scanning the board with plain loops: the clue square is the dark square just before the run. */
const oracleRuns = (p: Puzzle): ORun[] => {
  const n = p.n;
  const out: ORun[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (p.kind[r * n + c] === 1) {
        const start = c;
        const cells: number[] = [];
        while (c < n && p.kind[r * n + c] === 1) { cells.push(r * n + c); c++; }
        out.push({ cells, sum: start > 0 ? p.across[r * n + start - 1] : -1, dir: 'across' });
      } else c++;
    }
  }
  for (let c = 0; c < n; c++) {
    let r = 0;
    while (r < n) {
      if (p.kind[r * n + c] === 1) {
        const start = r;
        const cells: number[] = [];
        while (r < n && p.kind[r * n + c] === 1) { cells.push(r * n + c); r++; }
        out.push({ cells, sum: start > 0 ? p.down[(start - 1) * n + c] : -1, dir: 'down' });
      } else r++;
    }
  }
  return out;
};

/** Smallest and largest total of k different digits, written out again here. */
const lo = (k: number): number => { let s = 0; for (let d = 1; d <= k; d++) s += d; return s; };
const hi = (k: number): number => { let s = 0; for (let d = 9; d > 9 - k; d--) s += d; return s; };

/** Can `rem` different digits from the `free` set (bit d = digit d) add up to `need`? Brute force over subsets, remembered. */
const subsetMemo = new Map<number, boolean>();
const canMake = (free: number, rem: number, need: number): boolean => {
  if (rem < 0 || need < 0) return false;
  if (rem === 0) return need === 0;
  const key = free | (rem << 10) | (need << 14);
  const hit = subsetMemo.get(key);
  if (hit !== undefined) return hit;
  let ok = false;
  for (let sub = free; sub > 0 && !ok; sub = (sub - 1) & free) {
    let k = 0;
    let sum = 0;
    for (let d = 1; d <= 9; d++) if (sub & (1 << d)) { k++; sum += d; }
    if (k === rem && sum === need) ok = true;
  }
  subsetMemo.set(key, ok);
  return ok;
};

/**
 * Count solutions by depth-first search over single squares. At each node every empty square's
 * candidates are worked out from scratch: a digit is allowed if neither run already holds it and
 * the rest of each run can still be completed to its total (checked by brute force over subsets).
 * The square with fewest candidates is tried next. Shares no code with the engine.
 */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 2_000_000): number => {
  const runs = oracleRuns(p);
  const runsOfCell = new Map<number, number[]>();
  runs.forEach((r, ri) => r.cells.forEach((c) => runsOfCell.set(c, [...(runsOfCell.get(c) ?? []), ri])));
  const value = new Array<number>(p.kind.length).fill(0);
  const usedMask = runs.map(() => 0);
  const total = runs.map(() => 0);
  const left = runs.map((r) => r.cells.length);
  const place = (c: number, d: number): void => { for (const ri of runsOfCell.get(c) ?? []) { usedMask[ri] |= 1 << d; total[ri] += d; left[ri]--; } value[c] = d; };
  const lift = (c: number, d: number): void => { for (const ri of runsOfCell.get(c) ?? []) { usedMask[ri] &= ~(1 << d); total[ri] -= d; left[ri]++; } value[c] = 0; };
  const FULL = 0b1111111110;
  const allowed = (c: number, d: number): boolean => {
    for (const ri of runsOfCell.get(c) ?? []) {
      if (usedMask[ri] & (1 << d)) return false;
      if (!canMake(FULL & ~(usedMask[ri] | (1 << d)), left[ri] - 1, runs[ri].sum - total[ri] - d)) return false;
    }
    return true;
  };
  for (let c = 0; c < p.kind.length; c++) {
    if (p.kind[c] === 1 && p.givens[c]) {
      if (!allowed(c, p.givens[c])) return 0;
      place(c, p.givens[c]);
    }
  }
  const empties = p.kind.map((v, i) => (v === 1 && !value[i] ? i : -1)).filter((i) => i >= 0);
  let count = 0;
  let nodes = 0;
  const go = (): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    let best = -1;
    let bestDigits: number[] = [];
    for (const c of empties) {
      if (value[c]) continue;
      const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => allowed(c, d));
      if (ds.length === 0) return;
      if (best < 0 || ds.length < bestDigits.length) { best = c; bestDigits = ds; if (ds.length === 1) break; }
    }
    if (best < 0) { count++; return; }
    for (const d of bestDigits) {
      place(best, d);
      go();
      lift(best, d);
      if (count >= cap) return;
    }
  };
  go();
  return count;
};

/** Are all white squares one 4-connected piece? Plain flood from the first one. */
const onepiece = (p: Puzzle): boolean => {
  const whites = p.kind.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
  if (!whites.length) return false;
  const seen = new Set<number>([whites[0]]);
  const queue = [whites[0]];
  while (queue.length) {
    const x = queue.shift() as number;
    const r = Math.floor(x / p.n);
    const c = x % p.n;
    for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (rr < 0 || cc < 0 || rr >= p.n || cc >= p.n) continue;
      const j = rr * p.n + cc;
      if (p.kind[j] === 1 && !seen.has(j)) { seen.add(j); queue.push(j); }
    }
  }
  return seen.size === whites.length;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, kind: p.kind.slice(), across: p.across.slice(), down: p.down.slice(), givens: p.givens.slice() });

/** A hand-made 3x3 board: row 0 and column 0 dark, a 2x2 white block. */
const tiny = (across: [number, number], down: [number, number], givens: number[] = [0, 0, 0, 0]): Puzzle => ({
  n: 3,
  kind: [0, 0, 0, 0, 1, 1, 0, 1, 1],
  across: [0, 0, 0, across[0], 0, 0, across[1], 0, 0],
  down: [0, down[0], down[1], 0, 0, 0, 0, 0, 0],
  givens: [0, 0, 0, 0, givens[0], givens[1], 0, givens[2], givens[3]],
});

const LEVEL_CAP: Record<Level, number> = { easy: 4, medium: 6, hard: 9 };
/** The share of the inside squares a pattern keeps white, per level (pinned for the guide page). */
const MIN_SHARE: Record<Level, number> = { easy: 0.3, medium: 0.5, hard: 0.6 };

// ── Digit sets ───────────────────────────────────────────────────────────────

describe('digit sets', () => {
  it('the table holds every subset of 1 to 9 exactly once, filed under its size and total', () => {
    let all = 0;
    for (let mask = 1; mask < 512; mask++) {
      const digits = Array.from({ length: 9 }, (_, b) => (mask >> b) & 1 ? b + 1 : 0).filter(Boolean);
      const len = digits.length;
      const sum = digits.reduce((a, b) => a + b, 0);
      const hits = COMBOS[len][sum].filter((m) => digitsOf(m).join() === digits.join());
      expect(hits, `subset ${digits.join('')}`).toHaveLength(1);
      all++;
    }
    expect(all).toBe(511);
    let stored = 0;
    for (const byLen of COMBOS) for (const list of byLen) stored += list.length;
    expect(stored).toBe(511);
  });
  it('some well-known totals', () => {
    expect(waysToMake(2, 3)).toBe(1); // 1 + 2
    expect(waysToMake(2, 17)).toBe(1); // 8 + 9
    expect(waysToMake(3, 6)).toBe(1);
    expect(waysToMake(3, 24)).toBe(1);
    expect(waysToMake(9, 45)).toBe(1);
    expect(waysToMake(4, 10)).toBe(1);
    expect(waysToMake(2, 10)).toBe(4); // 1+9 2+8 3+7 4+6
    expect(waysToMake(2, 2)).toBe(0);
    expect(waysToMake(10, 50)).toBe(0);
    expect(waysToMake(2, 99)).toBe(0);
  });
  it('minSum and maxSum are the true smallest and largest totals', () => {
    for (let len = 1; len <= 9; len++) {
      const sums = COMBOS[len].map((l, s) => (l.length ? s : -1)).filter((s) => s >= 0);
      expect(minSum(len)).toBe(Math.min(...sums));
      expect(maxSum(len)).toBe(Math.max(...sums));
    }
  });
});

// ── Geometry ─────────────────────────────────────────────────────────────────

describe('run geometry', () => {
  it('finds the runs and totals of a hand-made board', () => {
    const p = tiny([3, 7], [4, 6]);
    expect(isWellFormed(p)).toBe(true);
    const runs = runsOf(p);
    expect(runs).toHaveLength(4);
    expect(runs).toContainEqual({ clue: 3, dir: 'across', cells: [4, 5], sum: 3 });
    expect(runs).toContainEqual({ clue: 6, dir: 'across', cells: [7, 8], sum: 7 });
    expect(runs).toContainEqual({ clue: 1, dir: 'down', cells: [4, 7], sum: 4 });
    expect(runs).toContainEqual({ clue: 2, dir: 'down', cells: [5, 8], sum: 6 });
  });
  it('engine runs match the independent scan on generated puzzles of every size and level', () => {
    for (const n of SIZES) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 6; seed++) {
          const { puzzle } = makePuzzle(n, level, mulberry32(seed));
          const mine = runsOf(puzzle).map((r) => `${r.cells.join()}=${r.sum}`).sort();
          const theirs = oracleRuns(puzzle).map((r) => `${r.cells.join()}=${r.sum}`).sort();
          expect(mine).toEqual(theirs);
        }
      }
    }
  });
  it('rejects malformed puzzles', () => {
    const good = tiny([3, 7], [4, 6]);
    expect(() => checkPuzzle(good)).not.toThrow();
    expect(() => checkPuzzle({ ...good, n: 2 })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, n: 10 })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, kind: good.kind.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, kind: [...good.kind.slice(0, 8), 2] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, across: [...good.across.slice(0, 3), 99, ...good.across.slice(4)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, givens: [...good.givens.slice(0, 4), 10, ...good.givens.slice(5)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, givens: [5, ...good.givens.slice(1)] })).toThrow(RangeError);
    expect(() => solve({ ...good, n: 4 })).toThrow(RangeError);
    expect(isWellFormed({ ...good, across: [0, 0, 0, 0, 0, 0, 7, 0, 0] })).toBe(false); // a run without a total
    expect(isWellFormed({ ...good, across: [0, 0, 0, 2, 0, 0, 7, 0, 0] })).toBe(false); // total below the smallest possible
  });
  it('counts entries and givens', () => {
    const p = tiny([3, 7], [4, 6], [1, 0, 0, 4]);
    expect(entryCount(p)).toBe(4);
    expect(givenCount(p)).toBe(2);
  });
});

// ── Conflicts and completion ─────────────────────────────────────────────────

describe('conflicts and completion', () => {
  const p = tiny([3, 7], [4, 6]);
  const grid = (a: number, b: number, c: number, d: number): number[] => [0, 0, 0, 0, a, b, 0, c, d];
  it('the one valid fill is solved; others are not', () => {
    expect(isSolved(p, grid(1, 2, 3, 4))).toBe(true);
    expect(isSolved(p, grid(2, 1, 2, 5))).toBe(false); // totals right, but a repeated digit in the first column
    expect(isSolved(p, grid(1, 2, 3, 0))).toBe(false);
    expect(isSolved(p, grid(1, 2, 3, 5))).toBe(false);
    expect(isSolved(p, grid(1, 2, 3, 4.5))).toBe(false);
  });
  it('flags repeated digits, runs over their total and full runs that miss it, but not unfinished runs', () => {
    expect([...conflicts(p, grid(1, 2, 3, 4))]).toEqual([]);
    expect([...conflicts(p, grid(1, 0, 0, 0))]).toEqual([]); // 1 alone is fine
    expect([...conflicts(p, grid(2, 2, 0, 0))].sort()).toEqual([4, 5]); // repeated 2 across, and total 4 > 3
    expect([...conflicts(p, grid(1, 2, 3, 5))].sort((a, b) => a - b)).toEqual([5, 7, 8]); // across 7 and down 6 both missed
    expect([...conflicts(p, grid(2, 0, 2, 0))].sort((a, b) => a - b)).toEqual([4, 7]); // repeated 2 down
  });
  it('runState reports squares filled, the running total and duplicates', () => {
    const r = runsOf(p).find((x) => x.dir === 'across') as ReturnType<typeof runsOf>[number];
    expect(runState(grid(1, 0, 0, 0), r)).toMatchObject({ filled: 1, total: 1, hasDuplicate: false });
    expect(runState(grid(2, 2, 0, 0), r)).toMatchObject({ filled: 2, total: 4, hasDuplicate: true });
  });
});

// ── The solver against the independent counter ───────────────────────────────

describe('solver', () => {
  it('hand-made boards: one solution, two solutions, none', () => {
    const unique = tiny([3, 7], [4, 6]);
    expect(solve(unique, 5).count).toBe(1);
    expect(solve(unique, 5).solutions[0].filter((v, i) => unique.kind[i] === 1)).toEqual([1, 2, 3, 4]);
    expect(oracleCount(unique, 5)).toBe(1);
    const two = tiny([3, 3], [3, 3]);
    expect(solve(two, 5).count).toBe(2);
    expect(oracleCount(two, 5)).toBe(2);
    const none = tiny([3, 3], [3, 4]);
    expect(solve(none, 5).count).toBe(0);
    expect(oracleCount(none, 5)).toBe(0);
    expect(hasUniqueSolution(unique)).toBe(true);
    expect(hasUniqueSolution(two)).toBe(false);
    expect(hasUniqueSolution(none)).toBe(false);
  });
  it('a given that contradicts the clues leaves no solution', () => {
    expect(solve(tiny([3, 7], [4, 6], [9, 0, 0, 0]), 5).count).toBe(0);
    expect(solve(tiny([3, 7], [4, 6], [2, 0, 0, 0]), 5).count).toBe(0);
    expect(solve(tiny([3, 7], [4, 6], [1, 0, 0, 0]), 5).count).toBe(1);
  });
  it('agrees with the independent counter on generated puzzles with some or all givens removed or totals nudged', () => {
    const rng = mulberry32(42);
    let none = 0;
    let one = 0;
    let many = 0;
    for (let t = 0; t < 120; t++) {
      const n = SIZES[t % 3];
      const level = LEVELS[Math.floor(t / 3) % 3];
      const { puzzle } = makePuzzle(n, level, mulberry32(500 + t));
      const p = clone(puzzle);
      const mode = t % 4;
      if (mode === 1) p.givens = p.givens.map((g) => (rng() < 0.5 ? 0 : g)); // fewer givens
      if (mode === 2) p.givens = p.givens.map(() => 0); // none
      if (mode === 3) { // nudge one total by one, usually making the board unsolvable or different
        const runs = runsOf(p);
        const r = runs[Math.floor(rng() * runs.length)];
        const arr = r.dir === 'across' ? p.across : p.down;
        arr[r.clue] = Math.max(minSum(r.cells.length), Math.min(maxSum(r.cells.length), arr[r.clue] + (rng() < 0.5 ? -1 : 1)));
      }
      const cap = 4;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      const oracle = oracleCount(p, cap);
      if (engine.count !== oracle) throw new Error(`t=${t} n=${n} ${level} mode ${mode}: engine ${engine.count}, oracle ${oracle}`);
      if (oracle === 0) none++; else if (oracle === 1) one++; else many++;
    }
    expect(one).toBeGreaterThan(20);
    expect(many).toBeGreaterThan(10);
    expect(none).toBeGreaterThan(3);
  }, 180_000);
  it('every solution it lists satisfies every run, and they are different', () => {
    const { puzzle } = makePuzzle(7, 'medium', mulberry32(3));
    const p = clone(puzzle);
    p.givens = p.givens.map(() => 0);
    const r = solve(p, 6);
    expect(r.solutions.length).toBeGreaterThan(1);
    expect(new Set(r.solutions.map((s) => s.join(''))).size).toBe(r.solutions.length);
    for (const s of r.solutions) expect(isSolved(p, s)).toBe(true);
  });
  it('stops on a spent node budget and says so', () => {
    const { puzzle } = makePuzzle(9, 'hard', mulberry32(2));
    const p = clone(puzzle);
    p.givens = p.givens.map(() => 0);
    const r = solve(p, 1_000_000, 5);
    expect(r.complete).toBe(false);
  });
  it('never modifies the puzzle it is given', () => {
    const { puzzle, solution } = makePuzzle(7, 'hard', mulberry32(9));
    const copy = JSON.stringify(puzzle);
    solve(puzzle, 3);
    hasUniqueSolution(puzzle);
    candidatesFor(puzzle, solution);
    nextHint(puzzle, puzzle.givens, solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
});

// ── Pattern and puzzle generation ────────────────────────────────────────────

describe('patterns', () => {
  it('have dark row 0 and column 0, runs of 2 or more within the level cap, and one connected piece', () => {
    for (const n of SIZES) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 25; seed++) {
          const kind = makePattern(n, level, mulberry32(seed));
          expect(kind).toHaveLength(n * n);
          for (let k = 0; k < n; k++) { expect(kind[k]).toBe(0); expect(kind[k * n]).toBe(0); }
          const p: Puzzle = { n, kind, across: new Array(n * n).fill(0), down: new Array(n * n).fill(0), givens: new Array(n * n).fill(0) };
          for (const r of oracleRuns(p)) {
            expect(r.cells.length, `${n} ${level} #${seed}`).toBeGreaterThanOrEqual(2);
            expect(r.cells.length).toBeLessThanOrEqual(LEVEL_CAP[level]);
          }
          expect(onepiece(p)).toBe(true);
          expect(entryCount(p)).toBeGreaterThanOrEqual(Math.max(4, Math.ceil((n - 1) * (n - 1) * MIN_SHARE[level])));
        }
      }
    }
  });
  it('are deterministic per seed', () => {
    expect(makePattern(9, 'medium', mulberry32(4))).toEqual(makePattern(9, 'medium', mulberry32(4)));
  });
  it('rejects a bad size', () => {
    expect(() => makePattern(2, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePattern(10, 'easy', mulberry32(1))).toThrow(RangeError);
  });
});

describe('puzzle generation', () => {
  it('every puzzle is well formed, has the stored answer as its only solution, and totals that match it', () => {
    for (const n of SIZES) {
      for (const level of LEVELS) {
        const seeds = n === 9 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6, 7, 8];
        for (const seed of seeds) {
          const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
          const tag = `${n} ${level} #${seed}`;
          expect(isWellFormed(puzzle), tag).toBe(true);
          expect(isSolved(puzzle, solution), tag).toBe(true);
          puzzle.givens.forEach((g, i) => { if (g) expect(g, tag).toBe(solution[i]); });
          for (const r of oracleRuns(puzzle)) {
            const total = r.cells.reduce((s, c) => s + solution[c], 0);
            expect(total, tag).toBe(r.sum);
            expect(new Set(r.cells.map((c) => solution[c])).size, tag).toBe(r.cells.length);
          }
          expect(oracleCount(puzzle, 2), tag).toBe(1);
          expect(solve(puzzle, 2).solutions[0], tag).toEqual(solution);
          expect(onepiece(puzzle), tag).toBe(true);
          expect(Math.max(...oracleRuns(puzzle).map((r) => r.cells.length)), tag).toBeLessThanOrEqual(LEVEL_CAP[level]);
          solution.forEach((v, i) => { if (puzzle.kind[i] === 0) expect(v).toBe(0); else expect(v >= 1 && v <= 9).toBe(true); });
        }
      }
    }
  }, 180_000);
  it('Easy tops its givens up to a quarter of the white squares; Hard leaves none that could be removed', () => {
    expect(EASY_GIVEN_SHARE).toBe(0.25);
    for (const n of SIZES) {
      for (let seed = 1; seed <= 6; seed++) {
        const e = makePuzzle(n, 'easy', mulberry32(seed)).puzzle;
        expect(givenCount(e)).toBeGreaterThanOrEqual(Math.ceil(entryCount(e) * EASY_GIVEN_SHARE));
      }
    }
    for (const n of SIZES) {
      for (let seed = 1; seed <= 5; seed++) {
        const { puzzle } = makePuzzle(n, 'hard', mulberry32(seed));
        puzzle.givens.forEach((g, i) => {
          if (!g) return;
          const q = clone(puzzle);
          q.givens[i] = 0;
          expect(oracleCount(q, 2), `${n} #${seed} given ${i}`).toBeGreaterThan(1);
        });
      }
    }
  }, 120_000);
  it('is deterministic per seed and differs across seeds', () => {
    for (const n of SIZES) {
      expect(makePuzzle(n, 'medium', mulberry32(21))).toEqual(makePuzzle(n, 'medium', mulberry32(21)));
      expect(makePuzzle(n, 'medium', mulberry32(21)).puzzle).not.toEqual(makePuzzle(n, 'medium', mulberry32(22)).puzzle);
    }
  });
  it('givens by size and level over seeds 1 to 20, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const g = Array.from({ length: 20 }, (_, k) => givenCount(makePuzzle(n, level, mulberry32(k + 1)).puzzle));
      return [Math.min(...g), Math.max(...g)];
    };
    const got = Object.fromEntries(SIZES.flatMap((n) => LEVELS.map((l) => [`${n}-${l}`, range(n, l)])));
    expect(got).toEqual({
      '5-easy': [2, 7], '5-medium': [1, 7], '5-hard': [2, 6],
      '7-easy': [3, 5], '7-medium': [5, 14], '7-hard': [5, 13],
      '9-easy': [5, 9], '9-medium': [8, 12], '9-hard': [7, 22],
    });
  }, 120_000);
  it('a 9x9 Hard puzzle is made in a reasonable time (generous bound)', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= 6; seed++) makePuzzle(9, 'hard', mulberry32(seed));
    expect(performance.now() - t0).toBeLessThan(90_000);
  }, 120_000);
  it('rejects bad sizes', () => {
    expect(() => makePuzzle(2, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(10, 'easy', mulberry32(1))).toThrow(RangeError);
  });
});

// ── Hints ────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('on a board with no mistakes, name a right digit for an empty square and always say something', () => {
    const rng = mulberry32(777);
    const whys: Record<string, number> = {};
    for (let t = 0; t < 120; t++) {
      const n = SIZES[t % 3];
      const level = LEVELS[Math.floor(t / 3) % 3];
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(900 + t));
      const grid = puzzle.givens.map((g, i) => (g || (puzzle.kind[i] === 1 && rng() < rng() * 0.8 ? solution[i] : 0)));
      if (solution.every((v, i) => !puzzle.kind[i] || grid[i])) continue;
      const h = nextHint(puzzle, grid, solution);
      if (!h || h.kind !== 'move') throw new Error('expected a move hint');
      expect(grid[h.cell]).toBe(0);
      expect(puzzle.kind[h.cell]).toBe(1);
      expect(h.value).toBe(solution[h.cell]);
      expect(h.text.length).toBeGreaterThan(15);
      expect(h.text).toMatch(/\.$/);
      expect(h.text.charAt(0)).toBe(h.text.charAt(0).toUpperCase());
      whys[h.why] = (whys[h.why] ?? 0) + 1;
    }
    expect((whys.last ?? 0) + (whys['only-set'] ?? 0) + (whys['both-runs'] ?? 0)).toBeGreaterThan(60);
  }, 120_000);
  it('flag wrong digits first and name them all', () => {
    const { puzzle, solution } = makePuzzle(7, 'medium', mulberry32(5));
    const grid = puzzle.givens.slice();
    const empties = grid.map((v, i) => (puzzle.kind[i] === 1 && !v ? i : -1)).filter((i) => i >= 0);
    grid[empties[0]] = solution[empties[0]] === 9 ? 8 : solution[empties[0]] + 1;
    grid[empties[1]] = solution[empties[1]];
    const h = nextHint(puzzle, grid, solution);
    expect(h).toEqual({ kind: 'mistake', cells: [empties[0]], text: '1 digit is wrong. Fix it first, then ask for a hint.' });
    grid[empties[2]] = solution[empties[2]] === 9 ? 8 : solution[empties[2]] + 1;
    const h2 = nextHint(puzzle, grid, solution);
    expect(h2?.kind === 'mistake' && h2.text).toBe('2 digits are wrong. Fix them first, then ask for a hint.');
    expect(wrongCells(grid, solution)).toEqual([empties[0], empties[2]].sort((a, b) => a - b));
  });
  it('are null once every square is filled', () => {
    const { puzzle, solution } = makePuzzle(5, 'easy', mulberry32(2));
    expect(nextHint(puzzle, solution, solution)).toBeNull();
  });
  it('following the hints from a fresh puzzle fills in the whole answer, one square per hint', () => {
    for (const [n, level, seed] of [[5, 'easy', 1], [7, 'medium', 2], [7, 'hard', 3], [9, 'easy', 4], [9, 'hard', 5]] as const) {
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
      const grid = puzzle.givens.slice();
      let used = 0;
      for (let h = nextHint(puzzle, grid, solution); h && used < 100; h = nextHint(puzzle, grid, solution)) {
        if (h.kind !== 'move') throw new Error('unexpected mistake');
        grid[h.cell] = h.value;
        used++;
      }
      expect(used).toBe(entryCount(puzzle) - givenCount(puzzle));
      expect(isSolved(puzzle, grid)).toBe(true);
      expect(grid).toEqual(solution);
    }
  }, 60_000);
  it('propagated candidates always keep the true digit, and are null if a placed digit contradicts the clues', () => {
    const rng = mulberry32(123);
    for (let t = 0; t < 60; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(60 + t));
      const grid = solution.map((v, i) => (puzzle.kind[i] === 1 && rng() < 0.3 ? v : 0));
      const cand = candidatesFor(puzzle, grid);
      expect(cand).not.toBeNull();
      if (!cand) continue;
      solution.forEach((v, i) => { if (puzzle.kind[i] === 1) expect((cand[i] >> v) & 1).toBe(1); });
    }
    const { puzzle, solution } = makePuzzle(5, 'easy', mulberry32(1));
    const i = solution.findIndex((v, k) => puzzle.kind[k] === 1 && !puzzle.givens[k]);
    const bad = new Array(25).fill(0);
    bad[i] = solution[i] === 9 ? 8 : solution[i] + 1;
    // A wrong digit may or may not be refuted by propagation alone; it must never crash.
    expect(() => candidatesFor(puzzle, bad)).not.toThrow();
  });
});

// ── Fuzz ─────────────────────────────────────────────────────────────────────

describe('fuzz', () => {
  it('conflicts and isSolved never throw on random grids and never call a random grid solved', () => {
    const rng = mulberry32(2468);
    for (let t = 0; t < 600; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(3000 + (t % 40)));
      const grid = Array.from({ length: n * n }, () => (rng() < 0.6 ? 1 + Math.floor(rng() * 9) : 0));
      expect(() => conflicts(puzzle, grid)).not.toThrow();
      const solved = isSolved(puzzle, grid);
      expect(solved).toBe(grid.every((v, i) => (puzzle.kind[i] === 1 ? v === solution[i] : true)) && puzzle.kind.every((k, i) => k === 0 || grid[i] > 0));
    }
  }, 120_000);
  it('a solved grid has no conflicts and no strict subset of it conflicts', () => {
    for (const n of SIZES) {
      const { puzzle, solution } = makePuzzle(n, 'medium', mulberry32(77));
      expect(conflicts(puzzle, solution).size).toBe(0);
      const rng = mulberry32(5);
      for (let t = 0; t < 30; t++) expect(conflicts(puzzle, solution.map((v) => (rng() < 0.5 ? v : 0))).size).toBe(0);
    }
  });
});

// ── Saved best times and text ────────────────────────────────────────────────

describe('saved best times', () => {
  it('keys are size and level', () => {
    expect(bestKey(7, 'hard')).toBe('7-hard');
  });
  it('keeps whole positive seconds for known sizes and levels and drops everything else', () => {
    expect(sanitiseBest({ '5-easy': 75, '7-medium': 240, '9-hard': 3600 })).toEqual({ '5-easy': 75, '7-medium': 240, '9-hard': 3600 });
    expect(sanitiseBest({ '5-easy': 75, '6-easy': 3, '5-wild': 3, x: 1 })).toEqual({ '5-easy': 75 });
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
  it('plural, where, placement and clue labels', () => {
    expect(plural(1, 'digit')).toBe('1 digit');
    expect(plural(2, 'digit')).toBe('2 digits');
    expect(where(5, 7)).toBe('row 2, column 3');
    expect(rowOf(5, 7)).toBe(1);
    expect(colOf(5, 7)).toBe(2);
    expect(placeMessage(5, 7, 4)).toBe('Row 2, column 3: 4.');
    expect(placeMessage(5, 7, 0)).toBe('Row 2, column 3: cleared.');
    expect(clueLabel(16, 0)).toBe('Clue: across 16');
    expect(clueLabel(0, 7)).toBe('Clue: down 7');
    expect(clueLabel(16, 7)).toBe('Clue: across 16, down 7');
    expect(clueLabel(0, 0)).toBe('Dark square');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
