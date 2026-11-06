/**
 * games-sea-and-islands.test.ts - the engine behind `sea-and-islands`.
 *
 * Pinned: exact counts that can be worked out by hand (one island that fills the grid has 1 solution, an island
 * of 15 squares on a 4x4 grid has 15, an island of 14 has 24 minus the neighbours of its number); the rules against
 * a plain brute force that tries every choice of land squares on boards up to 5x5; the solver's count against that
 * brute force and against a second independently written counter (square by square, with islands checked as soon as
 * they are closed in) on random numbers and on numbers read off random layouts; every generated puzzle has exactly
 * one solution per the second counter; the level of a puzzle is the amount of search its proof needed (Easy is
 * settled by reasoning alone, Medium needs 2 to 12 nodes, Hard more) and every seed tried got the level asked for;
 * number counts quoted on the guide page; hints never contradict the solution and repeated hints finish the
 * puzzle; the daily seed; storage is sanitised.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SIZES, LEVELS, UNKNOWN, LAND, SEA, MAX_BEST_SECONDS, GEN_NODES, MAX_ATTEMPTS, MEDIUM_NODES, MAX_ISLANDS, SETTLE_ROUNDS,
  mulberry32, hashString, shuffled, blankPuzzle, checkPuzzle, orth, islandCount, landTotal, largestIsland, islandsOf, conflictDetail, conflicts,
  clueState, isSolved, landOf, solve, solveByReasoning, undecidedCells, hasUniqueSolution, makePuzzle, randomLand, gradeOf, maxIsland,
  nextHint, wrongMarks, bestKey, sanitiseBest, formatTime, plural, where, markMessage, rowOf, colOf,
  dailySeed, dailyFor, localIsoDate,
  type Puzzle, type Level,
} from '../src/components/apps-private/sea-and-islands/helpers';

// Making puzzles is slow when the machine is busy, so every test here gets a generous limit.
vi.setConfig({ testTimeout: 180_000 });

// ── Independent oracles ──────────────────────────────────────────────────────

/** Every rule in plain terms, for a set of land squares (which must include every numbered square). */
const naiveOk = (p: Puzzle, land: Set<number>): boolean => {
  const n = p.n;
  const nb = (i: number): number[] => {
    const out: number[] = [];
    if (rowOf(n, i) > 0) out.push(i - n);
    if (rowOf(n, i) < n - 1) out.push(i + n);
    if (colOf(n, i) > 0) out.push(i - 1);
    if (colOf(n, i) < n - 1) out.push(i + 1);
    return out;
  };
  for (let i = 0; i < n * n; i++) if (p.clues[i] > 0 && !land.has(i)) return false;
  const seen = new Set<number>();
  for (const s of land) {
    if (seen.has(s)) continue;
    const comp = [s];
    seen.add(s);
    for (let k = 0; k < comp.length; k++) for (const j of nb(comp[k])) if (land.has(j) && !seen.has(j)) { seen.add(j); comp.push(j); }
    const numbers = comp.filter((i) => p.clues[i] > 0);
    if (numbers.length !== 1 || p.clues[numbers[0]] !== comp.length) return false;
  }
  const sea: number[] = [];
  for (let i = 0; i < n * n; i++) if (!land.has(i)) sea.push(i);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const i = r * n + c;
    if (!land.has(i) && !land.has(i + 1) && !land.has(i + n) && !land.has(i + n + 1)) return false;
  }
  if (sea.length) {
    const reach = new Set<number>([sea[0]]);
    const q = [sea[0]];
    for (let k = 0; k < q.length; k++) for (const j of nb(q[k])) if (!land.has(j) && !reach.has(j)) { reach.add(j); q.push(j); }
    if (reach.size !== sea.length) return false;
  }
  return true;
};

const choose = (a: number, b: number): number => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return Math.round(r); };

/** Count the solutions by trying every choice of the right number of land squares. Boards up to 5x5. */
const bruteCount = (p: Puzzle, cap: number): number => {
  const n = p.n;
  const fixed: number[] = [];
  for (let i = 0; i < n * n; i++) if (p.clues[i] > 0) fixed.push(i);
  const total = p.clues.reduce((a, b) => a + b, 0);
  const free: number[] = [];
  for (let i = 0; i < n * n; i++) if (p.clues[i] === 0) free.push(i);
  const need = total - fixed.length;
  if (need < 0 || need > free.length) return 0;
  if (choose(free.length, need) > 6_000_000) throw new Error('too many combinations for brute force');
  let count = 0;
  const land = new Set<number>(fixed);
  const go = (from: number, left: number): void => {
    if (count >= cap) return;
    if (left === 0) { if (naiveOk(p, land)) count++; return; }
    for (let j = from; j <= free.length - left; j++) {
      land.add(free[j]);
      go(j + 1, left - 1);
      land.delete(free[j]);
      if (count >= cap) return;
    }
  };
  go(0, need);
  return count;
};

/**
 * Second counter: decide squares in reading order, land or sea. A numbered square is land. No 2 by 2 block of sea. An
 * island that has more squares than its number, or two numbers, is dropped at once. An island is closed once every
 * neighbour of every square in it has been decided; then it must have exactly one number and exactly that many
 * squares. At the end the sea must be one piece.
 */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 40_000_000): number => {
  const n = p.n;
  const total = p.clues.reduce((a, b) => a + b, 0);
  const val = new Array<number>(n * n).fill(-1); // -1 undecided, 0 sea, 1 land
  let count = 0;
  let nodes = 0;
  let landSoFar = 0;
  const nb = (i: number): number[] => {
    const out: number[] = [];
    if (rowOf(n, i) > 0) out.push(i - n);
    if (colOf(n, i) > 0) out.push(i - 1);
    if (colOf(n, i) < n - 1) out.push(i + 1);
    if (rowOf(n, i) < n - 1) out.push(i + n);
    return out;
  };
  /** The piece of decided land that holds square s, and whether it is closed. */
  const piece = (s: number): { cells: number[]; closed: boolean } => {
    const cells = [s];
    const seen = new Set<number>([s]);
    let closed = true;
    for (let k = 0; k < cells.length; k++) {
      for (const j of nb(cells[k])) {
        if (val[j] === -1) closed = false;
        else if (val[j] === 1 && !seen.has(j)) { seen.add(j); cells.push(j); }
      }
    }
    return { cells, closed };
  };
  const pieceOk = (s: number): boolean => {
    const { cells, closed } = piece(s);
    const numbers = cells.filter((i) => p.clues[i] > 0);
    if (numbers.length > 1) return false;
    if (numbers.length === 1 && cells.length > p.clues[numbers[0]]) return false;
    if (closed) return numbers.length === 1 && cells.length === p.clues[numbers[0]];
    return true;
  };
  const seaOneSeaPiece = (): boolean => {
    const sea: number[] = [];
    for (let i = 0; i < n * n; i++) if (val[i] === 0) sea.push(i);
    if (!sea.length) return true;
    const seen = new Set<number>([sea[0]]);
    const q = [sea[0]];
    for (let k = 0; k < q.length; k++) for (const j of nb(q[k])) if (val[j] === 0 && !seen.has(j)) { seen.add(j); q.push(j); }
    return seen.size === sea.length;
  };
  const after = (i: number): boolean => {
    // check every piece that touches i, and i itself
    const starts = new Set<number>();
    if (val[i] === 1) starts.add(i);
    for (const j of nb(i)) if (val[j] === 1) starts.add(j);
    for (const s of starts) if (!pieceOk(s)) return false;
    if (val[i] === 0 && rowOf(n, i) > 0 && colOf(n, i) > 0 && val[i - 1] === 0 && val[i - n] === 0 && val[i - n - 1] === 0) return false;
    return true;
  };
  const go = (i: number): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    if (i === n * n) { if (landSoFar === total && seaOneSeaPiece()) count++; return; }
    const choices = p.clues[i] > 0 ? [1] : [0, 1];
    for (const v of choices) {
      if (v === 1 && p.clues[i] === 0 && landSoFar >= total) continue;
      val[i] = v;
      if (v === 1) landSoFar++;
      if (after(i)) go(i + 1);
      if (v === 1) landSoFar--;
      val[i] = -1;
      if (count >= cap) return;
    }
  };
  go(0);
  return count;
};


/** Puzzles are slow to make on a busy machine, so tests that only read them share one copy per (size, level, seed). */
const genCache = new Map<string, ReturnType<typeof makePuzzle>>();
const gen = (n: number, level: Level, seed: number): ReturnType<typeof makePuzzle> => {
  const key = `${n}|${level}|${seed}`;
  let hit = genCache.get(key);
  if (!hit) { hit = makePuzzle(n, level, mulberry32(seed)); genCache.set(key, hit); }
  return hit;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, clues: p.clues.slice() });

/** Random numbers built here and not by the engine, so there may be no solution at all. */
const randomNumbers = (n: number, rng: () => number): Puzzle => {
  const clues = new Array<number>(n * n).fill(0);
  const k = 2 + Math.floor(rng() * 4);
  for (const i of shuffled(Array.from({ length: n * n }, (_, x) => x), rng).slice(0, k)) clues[i] = 1 + Math.floor(rng() * 4);
  return { n, clues };
};

/** Numbers read off a random valid layout from the engine's own layout builder, each on a random square of its island. */
const numbersFromLayout = (n: number, rng: () => number): Puzzle | null => {
  const lay = randomLand(n, rng);
  if (!lay) return null;
  const groups: number[][] = lay.sizes.map(() => []);
  lay.owner.forEach((k, i) => { if (k >= 0) groups[k].push(i); });
  const clues = new Array<number>(n * n).fill(0);
  for (const g of groups) clues[g[Math.floor(rng() * g.length)]] = g.length;
  return { n, clues };
};

const EXPECTED_RANGES: Record<string, { islands: number[]; land: number[]; largest: number; nodes: number[] }> = {
  '5-easy': { islands: [3, 7], land: [7, 12], largest: 5, nodes: [1, 1] }, '5-medium': { islands: [3, 5], land: [7, 12], largest: 5, nodes: [3, 9] }, '5-hard': { islands: [2, 5], land: [7, 12], largest: 5, nodes: [13, 103] },
  '7-easy': { islands: [7, 12], land: [14, 20], largest: 6, nodes: [1, 1] }, '7-medium': { islands: [7, 12], land: [15, 21], largest: 6, nodes: [3, 11] }, '7-hard': { islands: [5, 9], land: [16, 23], largest: 6, nodes: [13, 131] },
  '9-easy': { islands: [15, 19], land: [27, 34], largest: 6, nodes: [1, 1] }, '9-medium': { islands: [13, 17], land: [28, 34], largest: 7, nodes: [3, 11] }, '9-hard': { islands: [11, 17], land: [28, 36], largest: 7, nodes: [13, 645] },
};

// ── Geometry and rules ───────────────────────────────────────────────────────

describe('rules', () => {
  it('rejects malformed puzzles', () => {
    expect(() => blankPuzzle(3)).toThrow(RangeError);
    expect(() => blankPuzzle(11)).toThrow(RangeError);
    const good = blankPuzzle(5);
    expect(() => checkPuzzle(good)).not.toThrow();
    expect(() => checkPuzzle({ ...good, clues: good.clues.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, clues: [-1, ...good.clues.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, clues: [26, ...good.clues.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, clues: [1.5, ...good.clues.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ n: 9, clues: new Array(81).fill(1) })).toThrow(RangeError); // more than 30 islands
    expect(() => solve({ ...good, n: 12 })).toThrow(RangeError);
    expect(MAX_ISLANDS).toBe(30);
  });
  it('neighbours and counts', () => {
    expect(orth(4, 0).sort((a, b) => a - b)).toEqual([1, 4]);
    expect(orth(4, 5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9]);
    const p = blankPuzzle(5);
    p.clues[0] = 3; p.clues[12] = 1; p.clues[24] = 5;
    expect(islandCount(p)).toBe(3);
    expect(landTotal(p)).toBe(9);
    expect(largestIsland(p)).toBe(5);
    expect(maxIsland(5)).toBe(5);
    expect(maxIsland(7)).toBe(6);
    expect(maxIsland(9)).toBe(7);
  });
  it('islandsOf groups the land and the numbers in each group', () => {
    const p = blankPuzzle(4);
    p.clues[0] = 2; p.clues[15] = 1;
    const marks = new Array(16).fill(UNKNOWN);
    marks[1] = LAND; marks[5] = LAND; marks[10] = LAND;
    const pcs = islandsOf(p, marks);
    expect(pcs.map((x) => x.cells)).toEqual([[0, 1, 5], [10], [15]]);
    expect(pcs.map((x) => x.clueCells)).toEqual([[0], [], [15]]);
    expect(landOf(p, marks)).toEqual([0, 1, 5, 10, 15]);
  });
  it('clueState says ok, over or nothing', () => {
    const p = blankPuzzle(4);
    p.clues[0] = 2; p.clues[3] = 1;
    const marks = new Array(16).fill(UNKNOWN);
    expect(clueState(p, marks, 0)).toBe('');
    marks[1] = LAND;
    expect(clueState(p, marks, 0)).toBe('ok');
    marks[4] = LAND;
    expect(clueState(p, marks, 0)).toBe('over');
    expect(clueState(p, marks, 3)).toBe('ok');
    expect(clueState(p, marks, 7)).toBe('');
    marks[2] = LAND; // joins the 2 and the 1 into one island
    expect(clueState(p, marks, 3)).toBe('over');
  });
  it('conflicts flag islands that are too big, join two numbers, are walled in, and blocks the player marked all sea', () => {
    const p = blankPuzzle(5);
    p.clues[0] = 1; p.clues[4] = 2; p.clues[24] = 1;
    const marks = new Array(25).fill(UNKNOWN);
    expect(conflicts(p, marks).size).toBe(0); // nothing marked, nothing blamed
    marks[1] = LAND; // joins nothing, but the 1 at 0 is now bigger than 1
    expect([...conflictDetail(p, marks).island].sort((a, b) => a - b)).toEqual([0, 1]);
    marks[1] = UNKNOWN;
    marks[6] = SEA; marks[7] = SEA; marks[11] = SEA; marks[12] = SEA;
    expect([...conflictDetail(p, marks).pool].sort((a, b) => a - b)).toEqual([6, 7, 11, 12]);
    marks[12] = UNKNOWN;
    expect(conflictDetail(p, marks).pool.size).toBe(0);
    // a lone land square with sea marked on all sides and no number
    const q = blankPuzzle(5);
    q.clues[24] = 1;
    const m2 = new Array(25).fill(UNKNOWN);
    m2[12] = LAND; m2[7] = SEA; m2[11] = SEA; m2[13] = SEA; m2[17] = SEA;
    expect([...conflictDetail(q, m2).island]).toEqual([12]);
    m2[17] = UNKNOWN;
    expect(conflictDetail(q, m2).island.size).toBe(0);
    // two numbers joined
    const r = blankPuzzle(5);
    r.clues[0] = 2; r.clues[2] = 2;
    const m3 = new Array(25).fill(UNKNOWN);
    m3[1] = LAND;
    expect([...conflictDetail(r, m3).island].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });
  it('isSolved agrees with the plain rules on generated, damaged and random boards', () => {
    const rng = mulberry32(55);
    for (let t = 0; t < 300; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = gen(n, LEVELS[t % 3], 200 + (t % 30));
      const marks = solution.map((v) => (v === 1 ? LAND : SEA));
      const mode = t % 5;
      if (mode === 1) { const i = Math.floor(rng() * marks.length); marks[i] = marks[i] === LAND ? SEA : LAND; }
      if (mode === 2) { const ls = marks.map((m, i) => (m === LAND ? i : -1)).filter((i) => i >= 0); const a = ls[Math.floor(rng() * ls.length)]; marks[a] = SEA; marks[Math.min(n * n - 1, a + 1)] = LAND; }
      if (mode === 3) for (let i = 0; i < marks.length; i++) if (marks[i] === SEA && rng() < 0.4) marks[i] = UNKNOWN; // unmarked counts as sea
      if (mode === 4) marks[Math.floor(rng() * marks.length)] = LAND;
      const land = new Set<number>();
      marks.forEach((m, i) => { if (m === LAND || puzzle.clues[i] > 0) land.add(i); });
      expect(isSolved(puzzle, marks), `t=${t} mode ${mode}`).toBe(naiveOk(puzzle, land));
    }
  });
  it('a solved board has no conflicts and every number reads ok', () => {
    for (const n of SIZES) {
      const { puzzle, solution } = gen(n, 'easy', 40);
      const marks = solution.map((v) => (v === 1 ? LAND : SEA));
      expect(isSolved(puzzle, marks)).toBe(true);
      expect(conflicts(puzzle, marks).size).toBe(0);
      puzzle.clues.forEach((c, i) => { if (c > 0) expect(clueState(puzzle, marks, i)).toBe('ok'); });
    }
  });
});

// ── Exact counts ─────────────────────────────────────────────────────────────

describe('exact counts', () => {
  it('one island that fills the whole 4x4 grid has exactly one solution wherever its number sits', () => {
    for (const at of [0, 5, 15]) {
      const p = blankPuzzle(4);
      p.clues[at] = 16;
      expect(solve(p, 10).count).toBe(1);
      expect(oracleCount(p, 10)).toBe(1);
      expect(bruteCount(p, 10)).toBe(1);
    }
  });
  it('an island of 15 squares on a 4x4 grid has 15 solutions: any square but the numbered one is the sea', () => {
    for (const at of [0, 1, 5]) {
      const p = blankPuzzle(4);
      p.clues[at] = 15;
      expect(solve(p, 100).count, `at ${at}`).toBe(15);
      expect(oracleCount(p, 100), `at ${at}`).toBe(15);
      expect(bruteCount(p, 100), `at ${at}`).toBe(15);
    }
  });
  it('an island of 14 has 24 neighbouring pairs of sea squares to choose from, minus those that use the numbered square', () => {
    // a 4x4 grid has 12 horizontal and 12 vertical neighbouring pairs; a corner square is in 2 of them, an edge square in 3, an inner square in 4
    for (const [at, pairs] of [[0, 2], [1, 3], [5, 4]] as const) {
      const p = blankPuzzle(4);
      p.clues[at] = 14;
      expect(solve(p, 100).count, `at ${at}`).toBe(24 - pairs);
      expect(oracleCount(p, 100), `at ${at}`).toBe(24 - pairs);
      expect(bruteCount(p, 100), `at ${at}`).toBe(24 - pairs);
    }
  });
  it('impossible puzzles have no solution: touching ones, and too much land', () => {
    const a = blankPuzzle(4);
    a.clues[0] = 1; a.clues[1] = 1; // two islands side by side are one island
    expect(solve(a, 10).count).toBe(0);
    expect(bruteCount(a, 10)).toBe(0);
    expect(oracleCount(a, 10)).toBe(0);
    const b = blankPuzzle(4);
    b.clues[0] = 12; b.clues[15] = 5; // 17 land squares in 16
    expect(solve(b, 10).count).toBe(0);
    expect(oracleCount(b, 10)).toBe(0);
    const c = blankPuzzle(4);
    c.clues[5] = 1; // a lone 1 in the middle: the rest is sea with a 2x2 block of it
    expect(solve(c, 10).count).toBe(0);
    expect(bruteCount(c, 10)).toBe(0);
  });
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
    solveByReasoning(puzzle);
    undecidedCells(puzzle);
    nextHint(puzzle, new Array(49).fill(0), solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
});

// ── Solver against the independent counters ──────────────────────────────────

describe('solver', () => {
  it('agrees with the brute force and the square-by-square counter on random numbers up to 5x5, including ones with no solution', () => {
    const rng = mulberry32(2718);
    let none = 0;
    let one = 0;
    let many = 0;
    let compared = 0;
    for (let t = 0; t < 220; t++) {
      const n = 4 + (t % 2);
      const p = t % 2 === 0 ? randomNumbers(n, rng) : (numbersFromLayout(n, rng) ?? randomNumbers(n, rng));
      const total = landTotal(p);
      if (total >= n * n - 1) continue;
      const cap = 5;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      let brute: number;
      try { brute = bruteCount(p, cap); } catch { continue; }
      const second = oracleCount(p, cap);
      if (engine.count !== brute || brute !== second) throw new Error(`t=${t} n=${n}: engine ${engine.count}, brute ${brute}, second ${second}\n${p.clues.join(',')}`);
      for (const s of engine.solutions) expect(naiveOk(p, new Set(s.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)))).toBe(true);
      if (brute === 0) none++; else if (brute === 1) one++; else many++;
      compared++;
    }
    expect(compared).toBeGreaterThan(120);
    expect(none).toBeGreaterThan(10);
    expect(one).toBeGreaterThan(10);
    expect(many).toBeGreaterThan(10);
  }, 300_000);
  it('agrees with the square-by-square counter on numbers read off random layouts of 6x6 and 7x7', () => {
    const rng = mulberry32(99);
    let compared = 0;
    for (let t = 0; t < 40; t++) {
      const n = 6 + (t % 2);
      const p = numbersFromLayout(n, rng);
      if (!p) continue;
      const cap = 4;
      const engine = solve(p, cap, 2_000_000);
      expect(engine.complete).toBe(true);
      expect(engine.count, `t=${t} n=${n}`).toBe(oracleCount(p, cap));
      compared++;
    }
    expect(compared).toBeGreaterThan(20);
  }, 300_000);
  it('reasoning alone never contradicts the solver: when it settles a puzzle the answer is the unique one', () => {
    const rng = mulberry32(5);
    let unsettled = 0;
    for (let t = 0; t < 60; t++) {
      const n = 5 + (t % 3);
      const p = numbersFromLayout(n, rng);
      if (!p) continue;
      const by = solveByReasoning(p);
      const r = solve(p, 2, 50_000);
      if (by) {
        expect(r.count).toBe(1);
        expect(r.solutions[0]).toEqual(by);
      } else unsettled++;
    }
    expect(unsettled).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (let seed = 1; seed <= 4; seed++) {
        const g = gen(n, 'easy', seed);
        expect(solveByReasoning(g.puzzle)).toEqual(g.solution);
        expect(undecidedCells(g.puzzle)).toEqual([]);
      }
    }
    const h = makePuzzle(7, 'hard', mulberry32(1));
    expect(undecidedCells(h.puzzle)?.length).toBeGreaterThan(0);
  }, 120_000);
});

// ── Generation ───────────────────────────────────────────────────────────────

describe('puzzle generation', () => {
  it('every 5x5 and 7x7 puzzle is well formed and has the stored layout as its only solution per the independent counters', () => {
    for (const n of [5, 7]) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 10; seed++) {
          const { puzzle, solution } = gen(n, level, seed);
          const tag = `${n} ${level} #${seed}`;
          expect(() => checkPuzzle(puzzle), tag).not.toThrow();
          expect(naiveOk(puzzle, new Set(solution.map((v, i) => (v ? i : -1)).filter((i) => i >= 0))), tag).toBe(true);
          expect(oracleCount(puzzle, 2), tag).toBe(1);
          expect(solve(puzzle, 2).solutions[0], tag).toEqual(solution);
          if (n === 5 && seed <= 4) expect(bruteCount(puzzle, 2), tag).toBe(1);
          expect(solution.reduce((a, b) => a + b, 0), tag).toBe(landTotal(puzzle));
        }
      }
    }
  }, 600_000);
  it('9x9 puzzles for seeds 1 to 6 of each level have exactly one solution, by the solver and by the square-by-square counter', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 6; seed++) {
        const { puzzle, solution } = gen(9, level, seed);
        const tag = `9 ${level} #${seed}`;
        const r = solve(puzzle, 2);
        expect(r.complete, tag).toBe(true);
        expect(r.count, tag).toBe(1);
        expect(r.solutions[0], tag).toEqual(solution);
        expect(oracleCount(puzzle, 2), tag).toBe(1);
      }
    }
  }, 900_000);
  it('the level is the amount of search the proof needed, and every seed tried got the level it asked for', () => {
    expect([1, 2, 12, 13, 500].map((k) => gradeOf(k))).toEqual(['easy', 'medium', 'medium', 'hard', 'hard']);
    expect(MEDIUM_NODES).toBe(12);
    expect(GEN_NODES).toBeGreaterThan(0);
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(SETTLE_ROUNDS).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 20; seed++) {
          const g = gen(n, level, seed);
          const tag = `${n} ${level} #${seed}`;
          expect(g.matched, tag).toBe(true);
          expect(gradeOf(g.nodes), tag).toBe(level);
          const nodes = solve(g.puzzle, 2).nodes;
          expect(nodes, tag).toBe(g.nodes);
          const by = solveByReasoning(g.puzzle);
          if (level === 'easy') expect(by, tag).toEqual(g.solution);
          else expect(by, tag).toBeNull();
        }
      }
    }
  }, 600_000);
  it('numbers over seeds 1 to 20, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const k: number[] = [];
      const l: number[] = [];
      const b: number[] = [];
      const s: number[] = [];
      for (let seed = 1; seed <= 20; seed++) {
        const g = gen(n, level, seed);
        k.push(islandCount(g.puzzle)); l.push(landTotal(g.puzzle)); b.push(largestIsland(g.puzzle)); s.push(g.nodes);
      }
      return { islands: [Math.min(...k), Math.max(...k)], land: [Math.min(...l), Math.max(...l)], largest: Math.max(...b), nodes: [Math.min(...s), Math.max(...s)] };
    };
    const got = Object.fromEntries(SIZES.flatMap((n) => LEVELS.map((lv) => [`${n}-${lv}`, range(n, lv)])));
    expect(got).toEqual(EXPECTED_RANGES);
  }, 300_000);
  it('is deterministic per seed and differs across seeds', () => {
    for (const n of SIZES) {
      expect(makePuzzle(n, 'medium', mulberry32(21))).toEqual(makePuzzle(n, 'medium', mulberry32(21)));
      expect(makePuzzle(n, 'medium', mulberry32(21)).solution).not.toEqual(makePuzzle(n, 'medium', mulberry32(22)).solution);
    }
  });
  it('a 9x9 puzzle of every level is made in a reasonable time (generous bound)', () => {
    const t0 = performance.now();
    for (const level of LEVELS) for (let seed = 1; seed <= 4; seed++) makePuzzle(9, level, mulberry32(seed));
    expect(performance.now() - t0).toBeLessThan(120_000);
  }, 150_000);
  it('the layouts the generator starts from have no 2x2 block of sea, one piece of sea and islands no bigger than the cap', () => {
    const rng = mulberry32(31);
    let made = 0;
    for (let t = 0; t < 60; t++) {
      const n = SIZES[t % 3];
      const lay = randomLand(n, rng);
      if (!lay) continue;
      made++;
      const land = new Set<number>(lay.owner.map((k, i) => (k >= 0 ? i : -1)).filter((i) => i >= 0));
      const p: Puzzle = { n, clues: new Array(n * n).fill(0) };
      // give each island its number on its first square
      const first = new Map<number, number>();
      lay.owner.forEach((k, i) => { if (k >= 0 && !first.has(k)) first.set(k, i); });
      first.forEach((i, k) => { p.clues[i] = lay.sizes[k]; });
      expect(naiveOk(p, land), `t=${t}`).toBe(true);
      expect(Math.max(...lay.sizes)).toBeLessThanOrEqual(maxIsland(n));
    }
    expect(made).toBeGreaterThan(30);
  });
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
    expect(base).toBe(hashString('sea-and-islands|2026-11-05|7|medium'));
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
    const { puzzle, solution } = gen(5, 'easy', 3);
    const marks = new Array(25).fill(UNKNOWN);
    const seaAt = solution.findIndex((v) => v === 0);
    const landAt = solution.findIndex((v, i) => v === 1 && puzzle.clues[i] === 0);
    marks[seaAt] = LAND; // land where the answer has sea
    if (landAt >= 0) marks[landAt] = SEA; // sea where the answer has land
    const want = [seaAt, landAt].filter((i) => i >= 0).sort((a, b) => a - b);
    expect(wrongMarks(puzzle, marks, solution)).toEqual(want);
    const h = nextHint(puzzle, marks, solution);
    expect(h).toEqual({ kind: 'mistake', cells: want, text: `${want.length} mark${want.length === 1 ? ' is' : 's are'} wrong. Fix ${want.length === 1 ? 'it' : 'them'} first, then ask for a hint.` });
  });
  it('a numbered square is never called wrong, and a clean board has no mistakes', () => {
    const { puzzle, solution } = gen(5, 'easy', 3);
    expect(wrongMarks(puzzle, new Array(25).fill(UNKNOWN), solution)).toEqual([]);
    const marks = solution.map((v) => (v === 1 ? LAND : SEA));
    expect(wrongMarks(puzzle, marks, solution)).toEqual([]);
    puzzle.clues.forEach((c, i) => { if (c > 0) marks[i] = SEA; });
    expect(wrongMarks(puzzle, marks, solution)).toEqual([]);
  });
  it('a hint never contradicts the solution, on boards with random correct marks', () => {
    const rng = mulberry32(4242);
    const whys: Record<string, number> = {};
    for (let t = 0; t < 240; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = gen(n, LEVELS[Math.floor(t / 3) % 3], 1500 + t);
      const marks = new Array(n * n).fill(UNKNOWN);
      const keep = rng() * 0.8;
      for (let i = 0; i < n * n; i++) {
        if (puzzle.clues[i] > 0) continue;
        if (rng() < keep) marks[i] = solution[i] === 1 ? LAND : SEA;
      }
      const h = nextHint(puzzle, marks, solution);
      if (!h) { expect(marks.every((m, i) => puzzle.clues[i] > 0 || (solution[i] === 1 ? m === LAND : m === SEA))).toBe(true); continue; }
      if (h.kind !== 'move') throw new Error('expected a move hint');
      expect(marks[h.cell]).not.toBe(h.mark);
      expect(puzzle.clues[h.cell]).toBe(0);
      expect(solution[h.cell], `t=${t} ${h.why}`).toBe(h.mark === LAND ? 1 : 0);
      expect(h.text.length).toBeGreaterThan(15);
      expect(h.text).toMatch(/\.$/);
      expect(h.text.charAt(0)).toBe(h.text.charAt(0).toUpperCase());
      whys[h.why] = (whys[h.why] ?? 0) + 1;
    }
    expect(Object.keys(whys).length).toBeGreaterThanOrEqual(3);
    const reasoned = Object.entries(whys).filter(([k]) => k !== 'reveal').reduce((a, [, v]) => a + v, 0);
    expect(reasoned).toBeGreaterThan(120);
  }, 180_000);
  it('following the hints from a fresh puzzle fills in the whole answer and never a wrong mark', () => {
    for (const [n, level, seed] of [[5, 'easy', 1], [7, 'medium', 2], [9, 'hard', 3], [9, 'easy', 4], [7, 'hard', 5], [5, 'hard', 6]] as const) {
      const { puzzle, solution } = gen(n, level, seed);
      const marks = new Array(n * n).fill(UNKNOWN);
      let used = 0;
      for (let h = nextHint(puzzle, marks, solution); h && used < 400; h = nextHint(puzzle, marks, solution)) {
        if (h.kind !== 'move') throw new Error('unexpected mistake');
        marks[h.cell] = h.mark;
        used++;
        expect(wrongMarks(puzzle, marks, solution)).toEqual([]);
      }
      expect(isSolved(puzzle, marks), `${n} ${level} #${seed}`).toBe(true);
      expect(landOf(puzzle, marks)).toEqual(solution.map((v, i) => (v ? i : -1)).filter((i) => i >= 0));
    }
  }, 180_000);
  it('an Easy puzzle is solved by hints that all have a reason', () => {
    const { puzzle, solution } = gen(7, 'easy', 8);
    const marks = new Array(49).fill(UNKNOWN);
    const seen = new Set<string>();
    for (let h = nextHint(puzzle, marks, solution); h; h = nextHint(puzzle, marks, solution)) {
      if (h.kind !== 'move') throw new Error('unexpected mistake');
      expect(h.why, h.text).not.toBe('reveal');
      seen.add(h.why);
      marks[h.cell] = h.mark;
    }
    expect(isSolved(puzzle, marks)).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  }, 120_000);
  it('are null once every square agrees with the answer', () => {
    const { puzzle, solution } = gen(5, 'easy', 2);
    expect(nextHint(puzzle, solution.map((v) => (v === 1 ? LAND : SEA)), solution)).toBeNull();
  });
});

// ── Fuzz ─────────────────────────────────────────────────────────────────────

describe('fuzz', () => {
  it('rule checks never throw on random boards and never call a random board solved', () => {
    const rng = mulberry32(8642);
    for (let t = 0; t < 600; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = gen(n, LEVELS[t % 3], 3000 + (t % 40));
      const marks = Array.from({ length: n * n }, () => Math.floor(rng() * 3));
      expect(() => conflicts(puzzle, marks)).not.toThrow();
      puzzle.clues.forEach((_, i) => expect(() => clueState(puzzle, marks, i)).not.toThrow());
      const same = marks.every((m, i) => (m === LAND || puzzle.clues[i] > 0) === (solution[i] === 1));
      expect(isSolved(puzzle, marks)).toBe(same);
    }
  }, 120_000);
  it('sea marks never change whether a board is solved', () => {
    const { puzzle, solution } = gen(7, 'medium', 10);
    const rng = mulberry32(3);
    for (let t = 0; t < 30; t++) {
      const marks = solution.map((v) => (v === 1 ? LAND : rng() < 0.5 ? SEA : UNKNOWN));
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
    expect(plural(1, 'mark')).toBe('1 mark');
    expect(plural(2, 'mark')).toBe('2 marks');
    expect(where(5, 7)).toBe('row 2, column 3');
    expect(markMessage(5, 7, LAND)).toBe('Row 2, column 3: land.');
    expect(markMessage(5, 7, SEA)).toBe('Row 2, column 3: sea.');
    expect(markMessage(5, 7, UNKNOWN)).toBe('Row 2, column 3: cleared.');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('clone helper copies', () => {
    const p = blankPuzzle(5);
    const q = clone(p);
    q.clues[0] = 3;
    expect(p.clues[0]).toBe(0);
  });
});
