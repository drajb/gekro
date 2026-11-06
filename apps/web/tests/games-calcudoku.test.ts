/**
 * games-calcudoku.test.ts - the engine behind `calcudoku`.
 *
 * Pinned: the number of ways to fill the squares of a cage (hand-worked cases, including the L-shaped
 * cage where a digit may repeat across the corner); the number of Latin squares of orders 3 and 4
 * (12, 576) and exact counts for a single two-square cage (96, 192, 96, 96 and 288 on 4x4); the solver's
 * solution count against two independently written counters (a full enumeration of Latin squares for
 * orders 3 to 5, and a square-by-square search with pruning for all sizes) on generated and random
 * cage layouts; every generated puzzle has exactly one solution (per the independent counter) and every
 * cage is met by the stored answer; the cage statistics quoted on the guide page; hints are always
 * right and repeated hints solve a puzzle; the daily seed; storage is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, MAX_BEST_SECONDS, GEN_NODES, MAX_CAGE, SIZE_WEIGHTS,
  mulberry32, hashString, shuffled, checkPuzzle, cageOk, cageIndex, isConnected, cageLabel, cageWords, opSymbol, givensOf,
  cageCount, singleCount, largestCage, singleTarget, conflicts, cageState, isSolved, isLatin, cageTuples, solve, hasUniqueSolution,
  candidatesFor, latinSquare, makePuzzle, nextHint, wrongCells, bestKey, sanitiseBest, formatTime, plural, where, placeMessage,
  digitsOf, rowOf, colOf, dailySeed, dailyFor, localIsoDate,
  type Puzzle, type Cage, type Level, type Op,
} from '../src/components/apps-private/calcudoku/helpers';

// ── Independent oracles ──────────────────────────────────────────────────────

/** Does this list of digits meet the cage? Written separately from the engine. */
const meets = (op: Op, target: number, vals: number[]): boolean => {
  if (op === 'none') return vals.length === 1 && vals[0] === target;
  if (op === 'add') { let s = 0; for (const v of vals) s += v; return s === target; }
  if (op === 'mul') { let m = 1; for (const v of vals) m *= v; return m === target; }
  const [a, b] = vals;
  if (op === 'sub') return Math.abs(a - b) === target;
  return (a % b === 0 && a / b === target) || (b % a === 0 && b / a === target);
};

/** Every Latin square of order n, built row by row with a plain used-digit test. */
const allSquares = (n: number): number[][] => {
  const out: number[][] = [];
  const g = new Array<number>(n * n).fill(0);
  const go = (k: number): void => {
    if (k === n * n) { out.push(g.slice()); return; }
    const r = Math.floor(k / n);
    const c = k % n;
    for (let d = 1; d <= n; d++) {
      let clash = false;
      for (let j = 0; j < c; j++) if (g[r * n + j] === d) clash = true;
      for (let j = 0; j < r; j++) if (g[j * n + c] === d) clash = true;
      if (clash) continue;
      g[k] = d;
      go(k + 1);
    }
    g[k] = 0;
  };
  go(0);
  return out;
};
const SQUARES = new Map<number, number[][]>();
const squares = (n: number): number[][] => { if (!SQUARES.has(n)) SQUARES.set(n, allSquares(n)); return SQUARES.get(n)!; };

/** Count solutions by testing every Latin square of the order against every cage. Orders 3 to 5. */
const naiveCount = (p: Puzzle, cap: number): number => {
  let count = 0;
  for (const s of squares(p.n)) {
    if (p.cages.every((c) => meets(c.op, c.target, c.cells.map((i) => s[i])))) { count++; if (count >= cap) break; }
  }
  return count;
};

/**
 * Count solutions by filling squares in reading order. A digit may not repeat in its row or column. When the
 * last square of a cage is filled, the cage is tested; before that, an addition cage whose digits already
 * reach its target, or a multiplication cage whose product no longer divides its target, is dropped.
 */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 30_000_000): number => {
  const n = p.n;
  const owner = new Array<number>(n * n).fill(-1);
  p.cages.forEach((c, k) => c.cells.forEach((i) => { owner[i] = k; }));
  const lastOf = p.cages.map((c) => c.cells[c.cells.length - 1]);
  const rowUsed = new Array<number>(n).fill(0);
  const colUsed = new Array<number>(n).fill(0);
  const v = new Array<number>(n * n).fill(0);
  let count = 0;
  let nodes = 0;
  const go = (i: number): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    if (i === n * n) { count++; return; }
    const r = Math.floor(i / n);
    const c = i % n;
    const cage = p.cages[owner[i]];
    for (let d = 1; d <= n; d++) {
      if ((rowUsed[r] >> d) & 1 || (colUsed[c] >> d) & 1) continue;
      v[i] = d;
      const vals = cage.cells.filter((j) => j <= i).map((j) => v[j]);
      let ok = true;
      if (lastOf[owner[i]] === i) ok = meets(cage.op, cage.target, vals);
      else if (cage.op === 'add') ok = vals.reduce((a, b) => a + b, 0) < cage.target;
      else if (cage.op === 'mul') { const m = vals.reduce((a, b) => a * b, 1); ok = m <= cage.target && cage.target % m === 0; }
      if (ok) {
        rowUsed[r] |= 1 << d; colUsed[c] |= 1 << d;
        go(i + 1);
        rowUsed[r] &= ~(1 << d); colUsed[c] &= ~(1 << d);
      }
      v[i] = 0;
      if (count >= cap) return;
    }
  };
  go(0);
  return count;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, cages: p.cages.map((c) => ({ op: c.op, target: c.target, cells: c.cells.slice() })) });

const naiveLatin = (g: number[], n: number): boolean => {
  const want = Array.from({ length: n }, (_, k) => k + 1).join();
  for (let a = 0; a < n; a++) {
    const row = [...g.slice(a * n, a * n + n)].sort((x, y) => x - y).join();
    const col = Array.from({ length: n }, (_, b) => g[b * n + a]).sort((x, y) => x - y).join();
    if (row !== want || col !== want) return false;
  }
  return true;
};

/** Do all cages of a puzzle agree with this grid? */
const agrees = (p: Puzzle, g: number[]): boolean => p.cages.every((c) => meets(c.op, c.target, c.cells.map((i) => g[i])));

/** A random cage layout for a given answer, built here and not by the engine: random connected groups, random fitting operations. */
const randomLayout = (n: number, solution: number[], rng: () => number, maxSize = 4): Puzzle => {
  const owner = new Array<number>(n * n).fill(-1);
  const cages: Cage[] = [];
  const nb = (i: number): number[] => {
    const out: number[] = [];
    if (i >= n) out.push(i - n);
    if (i % n > 0) out.push(i - 1);
    if (i % n < n - 1) out.push(i + 1);
    if (i < n * n - n) out.push(i + n);
    return out;
  };
  for (const s of shuffled(Array.from({ length: n * n }, (_, i) => i), rng)) {
    if (owner[s] >= 0) continue;
    const want = 1 + Math.floor(rng() * maxSize);
    const cells = [s];
    owner[s] = cages.length;
    while (cells.length < want) {
      const fr = [...new Set(cells.flatMap(nb))].filter((j) => owner[j] < 0);
      if (!fr.length) break;
      const pick = fr[Math.floor(rng() * fr.length)];
      owner[pick] = cages.length;
      cells.push(pick);
    }
    cells.sort((a, b) => a - b);
    const vals = cells.map((i) => solution[i]);
    let cage: Cage;
    if (cells.length === 1) cage = { op: 'none', target: vals[0], cells };
    else if (cells.length === 2) {
      const [a, b] = vals;
      const choices: Cage[] = [
        { op: 'add', target: a + b, cells }, { op: 'mul', target: a * b, cells }, { op: 'sub', target: Math.abs(a - b), cells },
      ];
      if (Math.max(a, b) % Math.min(a, b) === 0 && a !== b) choices.push({ op: 'div', target: Math.max(a, b) / Math.min(a, b), cells });
      cage = choices.filter((c) => c.target >= 1)[Math.floor(rng() * choices.filter((c) => c.target >= 1).length)];
    } else cage = rng() < 0.5 ? { op: 'add', target: vals.reduce((x, y) => x + y, 0), cells } : { op: 'mul', target: vals.reduce((x, y) => x * y, 1), cells };
    cages.push(cage);
  }
  return { n, cages: cages.sort((x, y) => x.cells[0] - y.cells[0]) };
};

const EXPECTED_RANGES: Record<string, { singles: number[]; cages: number[]; largest: number }> = {
  '4-easy': { singles: [1, 9], cages: [8, 12], largest: 3 }, '4-medium': { singles: [1, 2], cages: [6, 8], largest: 4 }, '4-hard': { singles: [0, 3], cages: [5, 7], largest: 4 },
  '5-easy': { singles: [2, 14], cages: [11, 19], largest: 3 }, '5-medium': { singles: [1, 3], cages: [9, 12], largest: 4 }, '5-hard': { singles: [0, 3], cages: [8, 11], largest: 4 },
  '6-easy': { singles: [5, 14], cages: [18, 24], largest: 3 }, '6-medium': { singles: [2, 5], cages: [14, 18], largest: 4 }, '6-hard': { singles: [0, 3], cages: [11, 14], largest: 4 },
};

// ── The squares of a cage ────────────────────────────────────────────────────

describe('digits that fill a cage', () => {
  it('counts hand-worked cases', () => {
    // two squares in a row on a 4x4 grid: digits must differ
    expect(cageTuples(4, { op: 'add', target: 5, cells: [0, 1] })).toHaveLength(4); // 1+4, 4+1, 2+3, 3+2
    expect(cageTuples(4, { op: 'add', target: 4, cells: [0, 1] })).toHaveLength(2); // 1+3, 3+1 (2+2 repeats)
    // six-by-six pairs
    expect(cageTuples(6, { op: 'sub', target: 1, cells: [0, 6] })).toHaveLength(10);
    expect(cageTuples(6, { op: 'div', target: 2, cells: [0, 1] })).toHaveLength(6); // 1 2, 2 4, 3 6, both ways
    expect(cageTuples(6, { op: 'mul', target: 12, cells: [0, 1] })).toHaveLength(4); // 2 6 and 3 4, both ways
    expect(cageTuples(6, { op: 'div', target: 3, cells: [0, 1] })).toHaveLength(4); // 1 3, 2 6, both ways
    // a one-square cage
    expect(cageTuples(4, { op: 'none', target: 3, cells: [5] })).toEqual([[3]]);
    expect(cageTuples(4, { op: 'none', target: 9, cells: [5] })).toEqual([]);
    // an L of three squares: 0 and 1 share a row, 1 and 5 share a column, 0 and 5 may repeat a digit
    const l = cageTuples(4, { op: 'add', target: 6, cells: [0, 1, 5] });
    expect(l).toHaveLength(7);
    expect(l.some((t) => t[0] === 1 && t[1] === 4 && t[2] === 1)).toBe(true); // 1 + 4 + 1: the corner squares repeat the 1
    expect(l.every((t) => t[0] !== t[1] && t[1] !== t[2])).toBe(true);
    // a straight line of three squares: all different
    for (const t of cageTuples(4, { op: 'add', target: 7, cells: [0, 1, 2] })) expect(new Set(t).size).toBe(3);
  });
  it('agrees with a plain enumeration on random cages', () => {
    const rng = mulberry32(14);
    for (let t = 0; t < 120; t++) {
      const n = 3 + (t % 4);
      const sol = latinSquare(n, rng);
      const p = randomLayout(n, sol, rng, 4);
      for (const c of p.cages) {
        const mine = cageTuples(n, c);
        const want: number[][] = [];
        const size = c.cells.length;
        const total = n ** size;
        for (let code = 0; code < total; code++) {
          const vals: number[] = [];
          let x = code;
          for (let k = 0; k < size; k++) { vals.push((x % n) + 1); x = Math.floor(x / n); }
          let clash = false;
          for (let a = 0; a < size; a++) for (let b = a + 1; b < size; b++) {
            if (vals[a] === vals[b] && (rowOf(n, c.cells[a]) === rowOf(n, c.cells[b]) || colOf(n, c.cells[a]) === colOf(n, c.cells[b]))) clash = true;
          }
          if (!clash && meets(c.op, c.target, vals)) want.push(vals);
        }
        const key = (xs: number[][]) => xs.map((v) => v.join('')).sort().join('|');
        expect(key(mine)).toBe(key(want));
        expect(mine.length).toBeGreaterThan(0); // the true digits are one of them
      }
    }
  });
  it('cageOk reads each operation', () => {
    expect(cageOk('add', 7, [3, 4])).toBe(true);
    expect(cageOk('add', 7, [3, 5])).toBe(false);
    expect(cageOk('mul', 12, [3, 4])).toBe(true);
    expect(cageOk('mul', 12, [2, 2, 3])).toBe(true);
    expect(cageOk('sub', 2, [5, 3])).toBe(true);
    expect(cageOk('sub', 2, [3, 5])).toBe(true);
    expect(cageOk('div', 3, [6, 2])).toBe(true);
    expect(cageOk('div', 3, [2, 6])).toBe(true);
    expect(cageOk('div', 2, [5, 2])).toBe(false);
    expect(cageOk('none', 4, [4])).toBe(true);
    expect(cageOk('none', 4, [3])).toBe(false);
    expect(cageOk('sub', 1, [1, 2, 3])).toBe(false);
    expect(cageOk('add', 3, [3])).toBe(false);
  });
});

// ── Latin squares and exact counts ───────────────────────────────────────────

describe('exact counts', () => {
  it('there are 12 Latin squares of order 3, 576 of order 4 and 161,280 of order 5, by the plain enumeration', () => {
    expect(squares(3)).toHaveLength(12);
    expect(squares(4)).toHaveLength(576);
    expect(squares(5)).toHaveLength(161_280);
  });
  it('one two-square cage on a 4x4 grid leaves 48 squares for every pair of digits that fits', () => {
    // sum 3: (1,2) (2,1); quotient 2: (1,2) (2,1) (2,4) (4,2); difference 3: (1,4) (4,1); product 12: (3,4) (4,3); difference 1: six pairs
    const count = (pred: (a: number, b: number) => boolean) => squares(4).filter((s) => pred(s[0], s[1])).length;
    expect(count((a, b) => a + b === 3)).toBe(2 * 48);
    expect(count((a, b) => Math.max(a, b) / Math.min(a, b) === 2)).toBe(4 * 48);
    expect(count((a, b) => Math.abs(a - b) === 3)).toBe(2 * 48);
    expect(count((a, b) => a * b === 12)).toBe(2 * 48);
    expect(count((a, b) => Math.abs(a - b) === 1)).toBe(6 * 48);
  });
  it('a puzzle of cages that fix every square has exactly one solution, and a loose one counts the same in all three counters', () => {
    const sol = [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1];
    const fixed: Puzzle = { n: 4, cages: sol.map((v, i) => ({ op: 'none' as const, target: v, cells: [i] })) };
    expect(solve(fixed).count).toBe(1);
    expect(naiveCount(fixed, 10)).toBe(1);
    expect(oracleCount(fixed, 10)).toBe(1);
    // left half fixed, right half in four cages
    const loose: Puzzle = {
      n: 4,
      cages: [
        ...[0, 1, 4, 5, 8, 9, 12, 13].map((i) => ({ op: 'none' as const, target: sol[i], cells: [i] })),
        { op: 'add', target: 7, cells: [2, 3] }, { op: 'add', target: 7, cells: [6, 7] }, { op: 'add', target: 3, cells: [10, 11] }, { op: 'add', target: 3, cells: [14, 15] },
      ].sort((a, b) => a.cells[0] - b.cells[0]),
    };
    const a = solve(loose, 100).count;
    expect(a).toBe(naiveCount(loose, 100));
    expect(a).toBe(oracleCount(loose, 100));
    expect(a).toBe(4); // the two squares of the first pair and of the second pair of rows can each swap places
  });
  it('cages that cannot hold leave no solution', () => {
    const bad: Puzzle = { n: 3, cages: [{ op: 'add', target: 9, cells: [0, 1, 2] }, { op: 'none', target: 1, cells: [3] }, { op: 'none', target: 1, cells: [4] }, { op: 'none', target: 2, cells: [5] }, { op: 'none', target: 1, cells: [6] }, { op: 'none', target: 2, cells: [7] }, { op: 'none', target: 3, cells: [8] }] };
    expect(solve(bad).count).toBe(0);
    expect(oracleCount(bad, 5)).toBe(0);
    expect(naiveCount(bad, 5)).toBe(0);
  });
  it('a larger blank-ish grid reports an exhausted budget instead of a false count', () => {
    const { puzzle } = makePuzzle(6, 'hard', mulberry32(3));
    expect(solve(puzzle, 1_000_000, 0).complete).toBe(false);
    expect(hasUniqueSolution(puzzle, 0)).toBe(false);
    expect(hasUniqueSolution(puzzle)).toBe(true);
  });
});

// ── Rules ────────────────────────────────────────────────────────────────────

describe('rules', () => {
  const good: Puzzle = { n: 3, cages: [{ op: 'add', target: 4, cells: [0, 1] }, { op: 'none', target: 1, cells: [2] }, { op: 'sub', target: 1, cells: [3, 6] }, { op: 'mul', target: 6, cells: [4, 5, 8] }, { op: 'none', target: 2, cells: [7] }] };
  it('accepts a sound puzzle and rejects malformed ones', () => {
    expect(() => checkPuzzle(good)).not.toThrow();
    const bad = (mut: (p: Puzzle) => void): Puzzle => { const p = clone(good); mut(p); return p; };
    expect(() => checkPuzzle({ ...good, n: 2 })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, n: 7 })).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages.pop(); }))).toThrow(RangeError); // square 7 uncovered
    expect(() => checkPuzzle(bad((p) => { p.cages[1].cells = [1]; }))).toThrow(RangeError); // square in two cages
    expect(() => checkPuzzle(bad((p) => { p.cages[0].cells = [0, 2]; p.cages[1].cells = [1]; }))).toThrow(RangeError); // not connected
    expect(() => checkPuzzle(bad((p) => { p.cages[0].op = 'none'; }))).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages[1].op = 'add'; }))).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages[3].op = 'sub'; }))).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages[0].target = 0; }))).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages[0].target = 1.5; }))).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages[0].cells = [1, 0]; }))).toThrow(RangeError); // not ascending
    expect(() => checkPuzzle(bad((p) => { (p.cages[0] as unknown as { op: string }).op = 'pow'; }))).toThrow(RangeError);
    expect(() => checkPuzzle(bad((p) => { p.cages[0].cells = [0, 99]; }))).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, cages: 'x' as unknown as Cage[] })).toThrow(RangeError);
    expect(() => solve({ ...good, n: 9 })).toThrow(RangeError);
    expect(MAX_CAGE).toBe(6);
  });
  it('knows which squares are connected', () => {
    expect(isConnected(4, [0, 1, 5])).toBe(true);
    expect(isConnected(4, [3, 4])).toBe(false); // end of one row and start of the next: not neighbours
    expect(isConnected(4, [0, 5])).toBe(false);
    expect(isConnected(4, [])).toBe(false);
    expect(isConnected(4, [2])).toBe(true);
  });
  it('names the cages in print and in words', () => {
    expect(cageLabel({ op: 'mul', target: 12, cells: [0, 1] })).toBe('12×');
    expect(cageLabel({ op: 'sub', target: 3, cells: [0, 1] })).toBe('3−');
    expect(cageLabel({ op: 'div', target: 2, cells: [0, 1] })).toBe('2÷');
    expect(cageLabel({ op: 'add', target: 7, cells: [0, 1] })).toBe('7+');
    expect(cageLabel({ op: 'none', target: 4, cells: [0] })).toBe('4');
    expect(opSymbol('none')).toBe('');
    expect(cageWords({ op: 'add', target: 7, cells: [0, 1, 2] })).toBe('cage of 3 squares, adds up to 7');
    expect(cageWords({ op: 'mul', target: 6, cells: [0, 1] })).toBe('cage of 2 squares, multiplies to 6');
    expect(cageWords({ op: 'sub', target: 1, cells: [0, 1] })).toBe('cage of 2 squares, difference 1');
    expect(cageWords({ op: 'div', target: 2, cells: [0, 1] })).toBe('cage of 2 squares, quotient 2');
    expect(cageWords({ op: 'none', target: 3, cells: [0] })).toBe('fixed digit 3');
  });
  it('lists the squares fixed by one-square cages', () => {
    expect(givensOf(good)).toEqual([0, 0, 1, 0, 0, 0, 0, 2, 0]);
    expect(cageIndex(good)).toEqual([0, 0, 1, 2, 3, 3, 2, 4, 3]);
    expect(singleCount(good)).toBe(2);
    expect(cageCount(good)).toBe(5);
    expect(largestCage(good)).toBe(3);
  });
  it('conflicts flag repeated digits, and nothing else', () => {
    const g = new Array(16).fill(0);
    g[0] = 2; g[2] = 2; g[5] = 3; g[13] = 3; g[7] = 1;
    expect([...conflicts(4, g)].sort((a, b) => a - b)).toEqual([0, 2, 5, 13]);
    expect(conflicts(4, new Array(16).fill(0)).size).toBe(0);
  });
  it('cageState waits for the cage to settle, then says ok or bad', () => {
    const p: Puzzle = { n: 4, cages: [{ op: 'add', target: 5, cells: [0, 1] }, { op: 'mul', target: 6, cells: [2, 3] }, { op: 'sub', target: 1, cells: [4, 8] }, { op: 'div', target: 2, cells: [5, 9] }, ...[6, 7, 10, 11, 12, 13, 14, 15].map((i) => ({ op: 'none' as const, target: 1, cells: [i] }))] };
    const g = new Array(16).fill(0);
    expect(cageState(p, g, 0)).toBe('');
    g[0] = 5; // already past 5
    expect(cageState(p, g, 0)).toBe('bad');
    g[0] = 4;
    expect(cageState(p, g, 0)).toBe(''); // 4 so far, one more square to go
    g[1] = 1;
    expect(cageState(p, g, 0)).toBe('ok');
    g[1] = 2;
    expect(cageState(p, g, 0)).toBe('bad');
    g[2] = 4; // 4 does not divide 6
    expect(cageState(p, g, 1)).toBe('bad');
    g[2] = 2;
    expect(cageState(p, g, 1)).toBe('');
    g[3] = 3;
    expect(cageState(p, g, 1)).toBe('ok');
    g[4] = 1;
    expect(cageState(p, g, 2)).toBe('');
    g[8] = 2;
    expect(cageState(p, g, 2)).toBe('ok');
    g[5] = 1; g[9] = 2;
    expect(cageState(p, g, 3)).toBe('ok');
    g[9] = 3;
    expect(cageState(p, g, 3)).toBe('bad');
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

// ── Solver against the independent counters ──────────────────────────────────

describe('solver', () => {
  it('agrees with the full enumeration and the square-by-square counter on random cage layouts of orders 3 and 4', () => {
    const rng = mulberry32(2718);
    let none = 0;
    let one = 0;
    let many = 0;
    for (let t = 0; t < 120; t++) {
      const n = 3 + (t % 2);
      const sol = latinSquare(n, rng);
      const p = randomLayout(n, sol, rng, 1 + (t % 4));
      if (t % 5 === 4) { const c = p.cages[Math.floor(rng() * p.cages.length)]; if (c.op !== 'none') c.target += 1 + Math.floor(rng() * 3); }
      const cap = 5;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      const a = naiveCount(p, cap);
      const b = oracleCount(p, cap);
      if (engine.count !== a || a !== b) throw new Error(`t=${t} n=${n}: engine ${engine.count}, enumeration ${a}, search ${b}`);
      for (const s of engine.solutions) { expect(isLatin(s, n)).toBe(true); expect(agrees(p, s)).toBe(true); }
      if (a === 0) none++; else if (a === 1) one++; else many++;
    }
    expect(none).toBeGreaterThan(3);
    expect(one).toBeGreaterThan(10);
    expect(many).toBeGreaterThan(10);
  }, 180_000);
  it('agrees with both counters on random layouts of order 5 and with the square-by-square counter on order 6', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 24; t++) {
      const n = 5 + (t % 2);
      const sol = latinSquare(n, rng);
      const p = randomLayout(n, sol, rng, 2 + (t % 3));
      const cap = 4;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      const b = oracleCount(p, cap);
      expect(engine.count, `t=${t} n=${n}`).toBe(b);
      if (n === 5 && t < 12) expect(naiveCount(p, cap), `t=${t} naive`).toBe(b);
    }
  }, 300_000);
  it('never modifies the puzzle it is given', () => {
    const { puzzle, solution } = makePuzzle(6, 'hard', mulberry32(9));
    const copy = JSON.stringify(puzzle);
    solve(puzzle, 3);
    hasUniqueSolution(puzzle);
    candidatesFor(puzzle, solution);
    nextHint(puzzle, givensOf(puzzle), solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
  it('candidate digits keep the true digit, and come back null if the entries contradict the cages', () => {
    const rng = mulberry32(31);
    for (let t = 0; t < 60; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(900 + t));
      const grid = solution.map((v) => (rng() < 0.3 ? v : 0));
      const cand = candidatesFor(puzzle, grid);
      expect(cand).not.toBeNull();
      if (cand) solution.forEach((v, i) => expect((cand[i] >> v) & 1).toBe(1));
    }
    const { puzzle } = makePuzzle(4, 'easy', mulberry32(4));
    const entries = new Array(16).fill(0);
    entries[0] = 2; entries[1] = 2;
    expect(candidatesFor(puzzle, entries)).toBeNull();
    expect(digitsOf(0b10110)).toEqual([1, 2, 4]);
  });
});

// ── Generation ───────────────────────────────────────────────────────────────

describe('puzzle generation', () => {
  it('every 4x4 and 5x5 puzzle is well formed, has the stored Latin square as its only solution (two independent counters), and cages the answer meets', () => {
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
          if (n === 4 || seed <= 2) expect(naiveCount(puzzle, 2), tag).toBe(1);
          for (const c of puzzle.cages) expect(c.cells.length).toBeLessThanOrEqual(4);
        }
      }
    }
  }, 300_000);
  it('6x6 puzzles for seeds 1 to 6 of each level have exactly one solution, found by the solver and checked by the square-by-square counter', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 6; seed++) {
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
  it('Medium keeps at most its target of given digits on every seed tried, and the targets are pinned', () => {
    expect(SIZES.map((n) => singleTarget(n, 'medium'))).toEqual([2, 3, 5]);
    expect(SIZES.map((n) => singleTarget(n, 'hard'))).toEqual([0, 0, 0]);
    expect(SIZES.map((n) => singleTarget(n, 'easy'))).toEqual([16, 25, 36]);
    expect(SIZE_WEIGHTS.easy).toHaveLength(4);
    expect(GEN_NODES).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (let seed = 1; seed <= 12; seed++) {
        expect(singleCount(makePuzzle(n, 'medium', mulberry32(seed)).puzzle), `${n} #${seed}`).toBeLessThanOrEqual(singleTarget(n, 'medium'));
      }
    }
  });
  it('no cage is larger than four squares and every cage is connected', () => {
    for (const n of SIZES) for (const level of LEVELS) for (let seed = 1; seed <= 6; seed++) {
      const { puzzle } = makePuzzle(n, level, mulberry32(seed));
      for (const c of puzzle.cages) { expect(c.cells.length).toBeLessThanOrEqual(4); expect(isConnected(n, c.cells)).toBe(true); }
    }
  });
  it('harder levels keep fewer given digits and bigger cages, on average', () => {
    const avg = (n: number, level: Level, f: (p: Puzzle) => number) => {
      let t = 0;
      for (let seed = 1; seed <= 10; seed++) t += f(makePuzzle(n, level, mulberry32(seed)).puzzle);
      return t / 10;
    };
    for (const n of SIZES) {
      expect(avg(n, 'easy', singleCount)).toBeGreaterThan(avg(n, 'medium', singleCount));
      expect(avg(n, 'medium', singleCount)).toBeGreaterThan(avg(n, 'hard', singleCount) - 0.001);
      expect(avg(n, 'easy', cageCount)).toBeGreaterThan(avg(n, 'hard', cageCount));
    }
  }, 120_000);
  it('given digits and cage counts over seeds 1 to 20, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const s: number[] = [];
      const c: number[] = [];
      let big = 0;
      for (let seed = 1; seed <= 20; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; s.push(singleCount(p)); c.push(cageCount(p)); big = Math.max(big, largestCage(p)); }
      return { singles: [Math.min(...s), Math.max(...s)], cages: [Math.min(...c), Math.max(...c)], largest: big };
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
    for (let seed = 1; seed <= 8; seed++) makePuzzle(6, 'hard', mulberry32(seed));
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
    expect(base).toBe(hashString('calcudoku|2026-11-05|5|medium'));
    expect(Number.isInteger(base) && base >= 0 && base < 2 ** 32).toBe(true);
  });
  it('reads the date from one clock reading in the local zone', () => {
    const d = new Date(2026, 10, 5, 23, 59, 59);
    expect(localIsoDate(d)).toBe('2026-11-05');
    expect(dailyFor(5, 'easy', d)).toEqual({ date: '2026-11-05', seed: dailySeed('2026-11-05', 5, 'easy') });
    expect(localIsoDate(new Date(2027, 0, 2))).toBe('2027-01-02');
  });
  it('the same day gives the same puzzle on every device', () => {
    const day = dailyFor(5, 'hard', new Date(2026, 10, 5));
    expect(makePuzzle(5, 'hard', mulberry32(day.seed))).toEqual(makePuzzle(5, 'hard', mulberry32(day.seed)));
  });
});

// ── Hints ────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('on a board with no mistakes, name a right digit for an empty square and always say something', () => {
    const rng = mulberry32(4242);
    const whys: Record<string, number> = {};
    for (let t = 0; t < 150; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[Math.floor(t / 3) % 3], mulberry32(1500 + t));
      const given = givensOf(puzzle);
      const grid = given.map((g, i) => g || (rng() < rng() * 0.9 ? solution[i] : 0));
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
    expect((whys.last ?? 0) + (whys['cage-last'] ?? 0) + (whys.cage ?? 0) + (whys['only-digit'] ?? 0)).toBeGreaterThan(90);
  }, 120_000);
  it('the last-gap and last-cage-square reasons are only given when they are true', () => {
    const { puzzle, solution } = makePuzzle(5, 'medium', mulberry32(3));
    const given = givensOf(puzzle);
    const grid = solution.slice();
    const target = given.findIndex((g, i) => !g && puzzle.cages[cageIndex(puzzle)[i]].cells.length > 1);
    grid[target] = 0;
    const h = nextHint(puzzle, grid, solution);
    expect(h).toMatchObject({ kind: 'move', cell: target, value: solution[target] });
    expect(h?.kind === 'move' && h.why).toBe('last');
    expect(h?.kind === 'move' && h.text).toMatch(new RegExp(`^(Row ${rowOf(5, target) + 1}|Column ${colOf(5, target) + 1}) has every digit except ${solution[target]}, so row ${rowOf(5, target) + 1}, column ${colOf(5, target) + 1} must be ${solution[target]}\\.$`));
  });
  it('explains a cage whose other squares are all filled', () => {
    // a 3x3 puzzle where a square can be found only through its cage
    const sol = [1, 2, 3, 2, 3, 1, 3, 1, 2];
    const p: Puzzle = {
      n: 3,
      cages: [{ op: 'add', target: 3, cells: [0, 1] }, { op: 'none', target: 3, cells: [2] }, { op: 'sub', target: 1, cells: [3, 4] }, { op: 'none', target: 1, cells: [5] }, { op: 'mul', target: 3, cells: [6, 7] }, { op: 'none', target: 2, cells: [8] }],
    };
    expect(isSolved(p, sol)).toBe(true);
    const grid = [1, 0, 3, 0, 0, 1, 0, 0, 2];
    const h = nextHint(p, grid, sol);
    expect(h?.kind).toBe('move');
    if (h?.kind === 'move') {
      expect(h.value).toBe(sol[h.cell]);
      expect(['last', 'cage-last', 'cage', 'only-digit']).toContain(h.why);
    }
  });
  it('flag wrong digits first and name them all', () => {
    const { puzzle, solution } = makePuzzle(6, 'medium', mulberry32(5));
    const grid = givensOf(puzzle);
    const empties = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    grid[empties[0]] = solution[empties[0]] === 6 ? 5 : solution[empties[0]] + 1;
    grid[empties[1]] = solution[empties[1]];
    expect(nextHint(puzzle, grid, solution)).toEqual({ kind: 'mistake', cells: [empties[0]], text: '1 digit is wrong. Fix it first, then ask for a hint.' });
    grid[empties[2]] = solution[empties[2]] === 6 ? 5 : solution[empties[2]] + 1;
    const h2 = nextHint(puzzle, grid, solution);
    expect(h2?.kind === 'mistake' && h2.text).toBe('2 digits are wrong. Fix them first, then ask for a hint.');
    expect(wrongCells(grid, solution)).toEqual([empties[0], empties[2]].sort((a, b) => a - b));
  });
  it('are null once every square is filled', () => {
    const { puzzle, solution } = makePuzzle(4, 'easy', mulberry32(2));
    expect(nextHint(puzzle, solution, solution)).toBeNull();
  });
  it('following the hints from a fresh puzzle fills in the whole answer, one square per hint', () => {
    for (const [n, level, seed] of [[4, 'easy', 1], [5, 'medium', 2], [6, 'hard', 3], [6, 'easy', 4], [5, 'hard', 5]] as const) {
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
      const given = givensOf(puzzle);
      const grid = given.slice();
      let used = 0;
      for (let h = nextHint(puzzle, grid, solution); h && used < 100; h = nextHint(puzzle, grid, solution)) {
        if (h.kind !== 'move') throw new Error('unexpected mistake');
        grid[h.cell] = h.value;
        used++;
      }
      expect(used).toBe(n * n - given.filter((v) => v).length);
      expect(isSolved(puzzle, grid)).toBe(true);
      expect(grid).toEqual(solution);
    }
  }, 60_000);
});

// ── Fuzz ─────────────────────────────────────────────────────────────────────

describe('fuzz', () => {
  it('conflicts, cageState and isSolved never throw on random grids and never call a random grid solved', () => {
    const rng = mulberry32(8642);
    for (let t = 0; t < 600; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(3000 + (t % 40)));
      const grid = Array.from({ length: n * n }, () => (rng() < 0.7 ? 1 + Math.floor(rng() * n) : 0));
      expect(() => conflicts(n, grid)).not.toThrow();
      for (let k = 0; k < puzzle.cages.length; k++) expect(() => cageState(puzzle, grid, k)).not.toThrow();
      expect(isSolved(puzzle, grid)).toBe(grid.every((v, i) => v === solution[i]));
    }
  }, 120_000);
  it('a solved grid has no conflicts, every cage reads ok, and no strict part of it conflicts or reads bad', () => {
    for (const n of SIZES) {
      const { puzzle, solution } = makePuzzle(n, 'medium', mulberry32(77));
      expect(conflicts(n, solution).size).toBe(0);
      puzzle.cages.forEach((_, k) => expect(cageState(puzzle, solution, k)).toBe('ok'));
      const rng = mulberry32(5);
      for (let t = 0; t < 40; t++) {
        const part = solution.map((v) => (rng() < 0.5 ? v : 0));
        expect(conflicts(n, part).size).toBe(0);
        puzzle.cages.forEach((_, k) => expect(cageState(puzzle, part, k)).not.toBe('bad'));
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
    expect(plural(1, 'digit')).toBe('1 digit');
    expect(plural(2, 'digit')).toBe('2 digits');
    expect(where(5, 7)).toBe('row 2, column 3');
    expect(placeMessage(5, 7, 4)).toBe('Row 2, column 3: 4.');
    expect(placeMessage(5, 7, 0)).toBe('Row 2, column 3: cleared.');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
