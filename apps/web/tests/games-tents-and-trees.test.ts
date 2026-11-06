/**
 * games-tents-and-trees.test.ts - the engine behind `tents-and-trees`.
 *
 * Pinned: the rules (a tent beside every tree, each tent with its own tree, no two tents touching, row and
 * column counts) against a plain brute-force check that tries every set of squares of the right size on boards
 * up to 5x5; the solver's count of different tent layouts against that brute force and against a second
 * independently written counter (row by row, with bit masks) on random layouts with counts shown, hidden and
 * damaged; every generated puzzle has exactly one solution per the second counter; a Hard puzzle has no
 * number left to hide; number-hiding and tree counts quoted on the guide page; hints never contradict the
 * solution and repeated hints finish the puzzle; the daily seed; storage is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, HIDDEN, TENT, GRASS, MAX_BEST_SECONDS, GEN_NODES, MAX_ATTEMPTS,
  mulberry32, hashString, shuffled, blankPuzzle, checkPuzzle, orth, around, treeCount, hiddenCount, tentsOf, hasPerfectPairing,
  conflictDetail, conflicts, lineTents, countState, isSolved, solve, hasUniqueSolution, makePuzzle, treeShare, hideTarget,
  nextHint, wrongMarks, bestKey, sanitiseBest, formatTime, plural, where, markMessage, rowOf, colOf,
  dailySeed, dailyFor, localIsoDate,
  type Puzzle, type Level,
} from '../src/components/apps-private/tents-and-trees/helpers';

// ── Independent oracles ──────────────────────────────────────────────────────

/** Can the tents be matched one to one with the trees beside them? Tries every assignment, no cleverness. */
const bruteMatch = (n: number, trees: number[], tents: number[]): boolean => {
  const treeCells = trees.map((t, i) => (t === 1 ? i : -1)).filter((i) => i >= 0);
  if (treeCells.length !== tents.length) return false;
  const used = new Array<boolean>(treeCells.length).fill(false);
  const go = (k: number): boolean => {
    if (k === tents.length) return true;
    for (let t = 0; t < treeCells.length; t++) {
      if (used[t]) continue;
      const dr = Math.abs(rowOf(n, tents[k]) - rowOf(n, treeCells[t]));
      const dc = Math.abs(colOf(n, tents[k]) - colOf(n, treeCells[t]));
      if (dr + dc !== 1) continue;
      used[t] = true;
      if (go(k + 1)) return true;
      used[t] = false;
    }
    return false;
  };
  return go(0);
};

/** Every rule in plain terms, for a list of tent squares. */
const bruteRules = (p: Puzzle, tents: number[]): boolean => {
  const n = p.n;
  for (const t of tents) if (p.trees[t] === 1) return false;
  for (let a = 0; a < tents.length; a++) for (let b = a + 1; b < tents.length; b++) {
    if (Math.abs(rowOf(n, tents[a]) - rowOf(n, tents[b])) <= 1 && Math.abs(colOf(n, tents[a]) - colOf(n, tents[b])) <= 1) return false;
  }
  for (let k = 0; k < n; k++) {
    if (p.rows[k] !== HIDDEN && tents.filter((t) => rowOf(n, t) === k).length !== p.rows[k]) return false;
    if (p.cols[k] !== HIDDEN && tents.filter((t) => colOf(n, t) === k).length !== p.cols[k]) return false;
  }
  return bruteMatch(n, p.trees, tents);
};

/** Count the different tent layouts by trying every set of non-tree squares with as many squares as there are trees. Boards up to 5x5. */
const bruteCount = (p: Puzzle, cap: number): number => {
  const n = p.n;
  const k = p.trees.reduce((a, b) => a + b, 0);
  const free = p.trees.map((t, i) => (t === 0 ? i : -1)).filter((i) => i >= 0);
  let count = 0;
  const pick: number[] = [];
  const go = (from: number): void => {
    if (count >= cap) return;
    if (pick.length === k) { if (bruteRules(p, pick)) count++; return; }
    for (let j = from; j <= free.length - (k - pick.length); j++) {
      pick.push(free[j]);
      go(j + 1);
      pick.pop();
      if (count >= cap) return;
    }
  };
  go(0);
  void n;
  return count;
};

/** Second counter: choose a whole row at a time as a bit mask of tents. */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 30_000_000): number => {
  const n = p.n;
  const pop = (m: number) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const patterns: number[][] = [];
  for (let r = 0; r < n; r++) {
    const list: number[] = [];
    for (let m = 0; m < 1 << n; m++) {
      if (m & (m << 1)) continue; // two tents side by side
      let onTree = false;
      for (let c = 0; c < n; c++) if ((m >> c) & 1 && p.trees[r * n + c] === 1) onTree = true;
      if (onTree) continue;
      if (p.rows[r] !== HIDDEN && pop(m) !== p.rows[r]) continue;
      list.push(m);
    }
    patterns.push(list);
  }
  const trees = p.trees.reduce((a, b) => a + b, 0);
  const treeMask = Array.from({ length: n }, (_, r) => { let m = 0; for (let c = 0; c < n; c++) if (p.trees[r * n + c] === 1) m |= 1 << c; return m; });
  let tentsSoFar = 0;
  const colT = new Array<number>(n).fill(0);
  const chosen: number[] = [];
  let count = 0;
  let nodes = 0;
  // Kuhn's algorithm from the tree side (the engine matches from the tent side).
  const pairable = (): boolean => {
    const tents: number[] = [];
    chosen.forEach((m, r) => { for (let c = 0; c < n; c++) if ((m >> c) & 1) tents.push(r * n + c); });
    if (tents.length !== trees) return false;
    const treeCells = p.trees.map((t, i) => (t === 1 ? i : -1)).filter((i) => i >= 0);
    const mate = new Map<number, number>();
    const aug = (t: number, seen: Set<number>): boolean => {
      for (const tent of tents) {
        if (seen.has(tent)) continue;
        const d = Math.abs(rowOf(n, tent) - rowOf(n, t)) + Math.abs(colOf(n, tent) - colOf(n, t));
        if (d !== 1) continue;
        seen.add(tent);
        const cur = mate.get(tent);
        if (cur === undefined || aug(cur, seen)) { mate.set(tent, t); return true; }
      }
      return false;
    };
    return treeCells.every((t) => aug(t, new Set()));
  };
  const go = (r: number): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    if (r === n) {
      for (let c = 0; c < n; c++) if (p.cols[c] !== HIDDEN && colT[c] !== p.cols[c]) return;
      if (pairable()) count++;
      return;
    }
    const prev = r > 0 ? chosen[r - 1] : 0;
    const prev2 = r > 1 ? chosen[r - 2] : 0;
    for (const m of patterns[r]) {
      if (prev & (m | (m << 1) | (m >> 1))) continue;
      // Every tree in the row above must by now have a tent beside it: left, right, above or below.
      if (r > 0 && (treeMask[r - 1] & ~(prev2 | (prev << 1) | (prev >> 1) | m)) !== 0) continue;
      // The last row's trees can only be served by row n - 2 and their own row.
      if (r === n - 1 && (treeMask[r] & ~(prev | (m << 1) | (m >> 1))) !== 0) continue;
      if (tentsSoFar + pop(m) > trees) continue;
      let ok = true;
      for (let c = 0; c < n; c++) if ((m >> c) & 1) { colT[c]++; if (p.cols[c] !== HIDDEN && colT[c] > p.cols[c]) ok = false; }
      chosen.push(m);
      tentsSoFar += pop(m);
      if (ok) go(r + 1);
      tentsSoFar -= pop(m);
      chosen.pop();
      for (let c = 0; c < n; c++) if ((m >> c) & 1) colT[c]--;
      if (count >= cap) return;
    }
  };
  go(0);
  return count;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, trees: p.trees.slice(), rows: p.rows.slice(), cols: p.cols.slice() });

/** A random puzzle built here and not by the engine: random non-touching tents, a tree beside each, counts from the tents. */
const randomPuzzle = (n: number, tentsWanted: number, rng: () => number): { puzzle: Puzzle; tents: number[] } | null => {
  const tent = new Array<number>(n * n).fill(0);
  const tents: number[] = [];
  for (const i of shuffled(Array.from({ length: n * n }, (_, k) => k), rng)) {
    if (tents.length >= tentsWanted) break;
    let touch = false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = rowOf(n, i) + dr;
      const c = colOf(n, i) + dc;
      if (r >= 0 && r < n && c >= 0 && c < n && tent[r * n + c]) touch = true;
    }
    if (touch) continue;
    tent[i] = 1;
    tents.push(i);
  }
  const trees = new Array<number>(n * n).fill(0);
  for (const t of tents) {
    const spots = [t - n, t + n, t - 1, t + 1].filter((j) => j >= 0 && j < n * n && Math.abs(colOf(n, j) - colOf(n, t)) <= 1 && Math.abs(rowOf(n, j) - rowOf(n, t)) <= 1 && (colOf(n, j) === colOf(n, t) || rowOf(n, j) === rowOf(n, t)) && !tent[j] && !trees[j]);
    if (!spots.length) return null;
    trees[spots[Math.floor(rng() * spots.length)]] = 1;
  }
  const p: Puzzle = { n, trees, rows: new Array(n).fill(0), cols: new Array(n).fill(0) };
  for (let k = 0; k < n; k++) {
    p.rows[k] = tents.filter((t) => rowOf(n, t) === k).length;
    p.cols[k] = tents.filter((t) => colOf(n, t) === k).length;
  }
  return { puzzle: p, tents };
};

const EXPECTED_RANGES: Record<string, { trees: number[]; hidden: number[] }> = {
  '5-easy': { trees: [4, 8], hidden: [0, 0] }, '5-medium': { trees: [4, 8], hidden: [3, 3] }, '5-hard': { trees: [4, 8], hidden: [7, 10] },
  '7-easy': { trees: [10, 13], hidden: [0, 0] }, '7-medium': { trees: [10, 13], hidden: [4, 4] }, '7-hard': { trees: [10, 13], hidden: [9, 14] },
  '9-easy': { trees: [16, 19], hidden: [0, 0] }, '9-medium': { trees: [16, 19], hidden: [5, 5] }, '9-hard': { trees: [16, 19], hidden: [11, 17] },
};

// ── Geometry and pairing ─────────────────────────────────────────────────────

describe('geometry', () => {
  it('lists neighbours straight and all round', () => {
    expect(orth(4, 0).sort((a, b) => a - b)).toEqual([1, 4]);
    expect(orth(4, 5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9]);
    expect(orth(4, 3).sort((a, b) => a - b)).toEqual([2, 7]);
    expect(around(4, 0).sort((a, b) => a - b)).toEqual([1, 4, 5]);
    expect(around(4, 5)).toHaveLength(8);
    expect(around(4, 15).sort((a, b) => a - b)).toEqual([10, 11, 14]);
  });
  it('the pairing check agrees with trying every assignment', () => {
    const rng = mulberry32(8);
    let yes = 0;
    let no = 0;
    for (let t = 0; t < 400; t++) {
      const n = 4 + (t % 2);
      const made = randomPuzzle(n, 3 + (t % 3), rng);
      if (!made) continue;
      const tents = made.tents.slice();
      if (t % 3 === 1) tents[0] = Math.floor(rng() * n * n); // damage: a tent somewhere else
      const uniq = new Set(tents);
      if (uniq.size !== tents.length) continue;
      const want = bruteMatch(n, made.puzzle.trees, tents);
      expect(hasPerfectPairing(n, made.puzzle.trees, tents)).toBe(want);
      if (want) yes++; else no++;
    }
    expect(yes).toBeGreaterThan(50);
    expect(no).toBeGreaterThan(20);
  });
  it('two tents that both touch only one tree cannot both be paired', () => {
    const trees = new Array(16).fill(0);
    trees[5] = 1; trees[10] = 1;
    expect(hasPerfectPairing(4, trees, [1, 4])).toBe(false); // both beside tree 5
    expect(hasPerfectPairing(4, trees, [1, 11])).toBe(true);
  });
});

// ── Rules ────────────────────────────────────────────────────────────────────

describe('rules', () => {
  it('rejects malformed puzzles', () => {
    expect(() => blankPuzzle(3)).toThrow(RangeError);
    expect(() => blankPuzzle(11)).toThrow(RangeError);
    const good = blankPuzzle(5);
    expect(() => checkPuzzle(good)).not.toThrow();
    expect(() => checkPuzzle({ ...good, trees: good.trees.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, trees: [2, ...good.trees.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, rows: [0, 0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, cols: [6, 0, 0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, cols: [-2, 0, 0, 0, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, rows: [1.5, 0, 0, 0, 0] })).toThrow(RangeError);
    expect(() => solve({ ...good, n: 12 })).toThrow(RangeError);
  });
  it('conflicts mark tents that touch, and tents with no tree beside them', () => {
    const p = blankPuzzle(5);
    p.trees[0] = 1;
    const marks = new Array(25).fill(0);
    marks[1] = TENT; // beside the tree: fine
    marks[7] = TENT; // touches 1 at a corner... 7 is (1,2), 1 is (0,1): diagonal
    marks[24] = TENT; // alone, no tree
    const d = conflictDetail(p, marks);
    expect([...d.touch].sort((a, b) => a - b)).toEqual([1, 7]);
    expect([...d.lonely].sort((a, b) => a - b)).toEqual([7, 24]);
    expect([...conflicts(p, marks)].sort((a, b) => a - b)).toEqual([1, 7, 24]);
    expect(conflicts(p, new Array(25).fill(0)).size).toBe(0);
    marks[1] = GRASS;
    expect(conflictDetail(p, marks).touch.size).toBe(0);
  });
  it('countState says ok, over or nothing, and nothing for a hidden number', () => {
    const p = blankPuzzle(5);
    p.rows[1] = 1; p.cols[2] = 2;
    const marks = new Array(25).fill(0);
    expect(countState(p, marks, 'row', 1)).toBe('');
    marks[6] = TENT;
    expect(countState(p, marks, 'row', 1)).toBe('ok');
    marks[8] = TENT;
    expect(countState(p, marks, 'row', 1)).toBe('over');
    expect(countState(p, marks, 'col', 2)).toBe('');
    marks[12] = TENT;
    expect(countState(p, marks, 'col', 2)).toBe(''); // one of two
    marks[22] = TENT;
    expect(countState(p, marks, 'col', 2)).toBe('ok');
    expect(countState(p, marks, 'row', 0)).toBe('');
    expect(lineTents(5, marks, 'row', 1)).toBe(2);
    expect(lineTents(5, marks, 'col', 2)).toBe(2);
    expect(lineTents(5, marks, 'row', 4)).toBe(1);
  });
  it('isSolved agrees with the plain rules on generated, damaged and random boards', () => {
    const rng = mulberry32(55);
    for (let t = 0; t < 300; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(200 + (t % 30)));
      const marks = solution.slice();
      const mode = t % 5;
      if (mode === 1) { const i = Math.floor(rng() * marks.length); marks[i] = marks[i] === 1 ? 0 : 1; }
      if (mode === 2) { const tents = tentsOf(marks); const a = tents[Math.floor(rng() * tents.length)]; marks[a] = 0; marks[Math.min(n * n - 1, a + 1)] = 1; }
      if (mode === 3) for (let i = 0; i < marks.length; i++) if (marks[i] === 0 && rng() < 0.3) marks[i] = GRASS;
      if (mode === 4) marks[Math.floor(rng() * marks.length)] = TENT;
      const tents = tentsOf(marks);
      expect(isSolved(puzzle, marks), `t=${t} mode ${mode}`).toBe(bruteRules(puzzle, tents));
    }
  });
  it('a solved board has no conflicts and every count reads ok', () => {
    for (const n of SIZES) {
      const { puzzle, solution } = makePuzzle(n, 'easy', mulberry32(40));
      expect(isSolved(puzzle, solution)).toBe(true);
      expect(conflicts(puzzle, solution).size).toBe(0);
      for (let k = 0; k < n; k++) { expect(countState(puzzle, solution, 'row', k)).toBe('ok'); expect(countState(puzzle, solution, 'col', k)).toBe('ok'); }
    }
  });
});

// ── Solver against the independent counters ──────────────────────────────────

describe('solver', () => {
  it('agrees with the brute force and the row-by-row counter on random layouts up to 5x5, counts shown, hidden and damaged', () => {
    const rng = mulberry32(2718);
    let none = 0;
    let one = 0;
    let many = 0;
    let compared = 0;
    for (let t = 0; t < 160; t++) {
      const n = 4 + (t % 2);
      const made = randomPuzzle(n, 2 + (t % 4), rng);
      if (!made) continue;
      const p = made.puzzle;
      const mode = t % 4;
      if (mode === 1) for (let k = 0; k < n; k++) if (rng() < 0.4) p.rows[k] = HIDDEN;
      if (mode === 2) { for (let k = 0; k < n; k++) { if (rng() < 0.5) p.rows[k] = HIDDEN; if (rng() < 0.5) p.cols[k] = HIDDEN; } }
      if (mode === 3) { const k = Math.floor(rng() * n); p.cols[k] = Math.min(n, p.cols[k] + 1); }
      const cap = 5;
      const engine = solve(p, cap);
      expect(engine.complete).toBe(true);
      const brute = bruteCount(p, cap);
      const second = oracleCount(p, cap);
      if (engine.count !== brute || brute !== second) throw new Error(`t=${t} n=${n} mode ${mode}: engine ${engine.count}, brute ${brute}, rows ${second}`);
      for (const s of engine.solutions) expect(bruteRules(p, tentsOf(s))).toBe(true);
      if (brute === 0) none++; else if (brute === 1) one++; else many++;
      compared++;
    }
    expect(compared).toBeGreaterThan(120);
    expect(none).toBeGreaterThan(10);
    expect(one).toBeGreaterThan(10);
    expect(many).toBeGreaterThan(10);
  }, 300_000);
  it('agrees with the row-by-row counter on random layouts of 6x6 to 9x9', () => {
    const rng = mulberry32(99);
    let compared = 0;
    for (let t = 0; t < 40; t++) {
      const n = 6 + (t % 4);
      const made = randomPuzzle(n, Math.round(n * n * 0.2), rng);
      if (!made) continue;
      const p = made.puzzle;
      if (t % 3 === 1) for (let k = 0; k < n; k++) if (rng() < 0.3) p.cols[k] = HIDDEN;
      const cap = 4;
      const engine = solve(p, cap, 2_000_000);
      expect(engine.complete).toBe(true);
      expect(engine.count, `t=${t} n=${n}`).toBe(oracleCount(p, cap));
      compared++;
    }
    expect(compared).toBeGreaterThan(30);
  }, 300_000);
  it('counts two pairings that give the same tents once', () => {
    // two trees either side of a square: one tent in the middle could belong to either, but only two tents fit when counts say so
    const p = blankPuzzle(5);
    p.trees[7] = 1; p.trees[9] = 1; // (1,2) and (1,4)
    p.rows = [HIDDEN, HIDDEN, HIDDEN, HIDDEN, HIDDEN];
    p.cols = [HIDDEN, HIDDEN, HIDDEN, HIDDEN, HIDDEN];
    const r = solve(p, 10_000);
    const keys = new Set(r.solutions.map((s) => s.join('')));
    expect(keys.size).toBe(r.count);
    expect(r.count).toBe(bruteCount(p, 10_000));
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
    nextHint(puzzle, new Array(49).fill(0), solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
});

// ── Generation ───────────────────────────────────────────────────────────────

describe('puzzle generation', () => {
  it('every 5x5 and 7x7 puzzle is well formed and has the stored layout as its only solution per the independent counters', () => {
    for (const n of [5, 7]) {
      for (const level of LEVELS) {
        for (let seed = 1; seed <= 10; seed++) {
          const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
          const tag = `${n} ${level} #${seed}`;
          expect(() => checkPuzzle(puzzle), tag).not.toThrow();
          expect(isSolved(puzzle, solution), tag).toBe(true);
          expect(bruteRules(puzzle, tentsOf(solution)), tag).toBe(true);
          expect(oracleCount(puzzle, 2), tag).toBe(1);
          expect(solve(puzzle, 2).solutions[0], tag).toEqual(solution);
          if (n === 5 && seed <= 3) expect(bruteCount(puzzle, 2), tag).toBe(1);
          expect(tentsOf(solution).length, tag).toBe(treeCount(puzzle));
        }
      }
    }
  }, 300_000);
  it('9x9 puzzles for seeds 1 to 8 of each level have exactly one solution per the row-by-row counter', () => {
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
  it('Easy shows every number, Medium hides at most its share, and the targets are pinned', () => {
    expect(SIZES.map((n) => hideTarget(n, 'easy'))).toEqual([0, 0, 0]);
    expect(SIZES.map((n) => hideTarget(n, 'medium'))).toEqual([3, 4, 5]);
    expect(SIZES.map((n) => hideTarget(n, 'hard'))).toEqual([10, 14, 18]);
    expect(SIZES.map((n) => treeShare(n))).toEqual([30, 26, 24]);
    expect(GEN_NODES).toBeGreaterThan(0);
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (let seed = 1; seed <= 12; seed++) {
        expect(hiddenCount(makePuzzle(n, 'easy', mulberry32(seed)).puzzle), `${n} easy #${seed}`).toBe(0);
        expect(hiddenCount(makePuzzle(n, 'medium', mulberry32(seed)).puzzle), `${n} medium #${seed}`).toBeLessThanOrEqual(hideTarget(n, 'medium'));
      }
    }
  });
  it('a Hard puzzle is minimal: showing any hidden number is not needed, and hiding any shown number gives more than one solution (independent counter)', () => {
    for (const n of [5, 7, 9]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { puzzle } = makePuzzle(n, 'hard', mulberry32(seed));
        for (const key of ['rows', 'cols'] as const) puzzle[key].forEach((c, k) => {
          if (c === HIDDEN) return;
          const q = clone(puzzle);
          q[key][k] = HIDDEN;
          expect(oracleCount(q, 2), `${n} #${seed} ${key} ${k}`).toBeGreaterThan(1);
        });
      }
    }
  }, 300_000);
  it('harder levels show fewer numbers', () => {
    for (const n of SIZES) {
      let easy = 0;
      let medium = 0;
      let hard = 0;
      for (let seed = 1; seed <= 10; seed++) {
        easy += hiddenCount(makePuzzle(n, 'easy', mulberry32(seed)).puzzle);
        medium += hiddenCount(makePuzzle(n, 'medium', mulberry32(seed)).puzzle);
        hard += hiddenCount(makePuzzle(n, 'hard', mulberry32(seed)).puzzle);
      }
      expect(easy).toBe(0);
      expect(medium).toBeGreaterThan(0);
      expect(hard).toBeGreaterThan(medium);
    }
  }, 120_000);
  it('trees and hidden numbers over seeds 1 to 20, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const t: number[] = [];
      const h: number[] = [];
      for (let seed = 1; seed <= 20; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; t.push(treeCount(p)); h.push(hiddenCount(p)); }
      return { trees: [Math.min(...t), Math.max(...t)], hidden: [Math.min(...h), Math.max(...h)] };
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
    expect(base).toBe(hashString('tents-and-trees|2026-11-05|7|medium'));
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

/** A little 4x4 puzzle worked out by hand: trees at (0,0) and (2,3), tents at (1,0) and (3,3). */
const small = (): { p: Puzzle; solution: number[] } => {
  const p = blankPuzzle(4);
  p.trees[0] = 1; p.trees[11] = 1;
  p.rows = [0, 1, 0, 1];
  p.cols = [1, 0, 0, 1];
  const solution = new Array(16).fill(0);
  solution[4] = 1; solution[15] = 1;
  return { p, solution };
};

describe('hints', () => {
  it('the hand-worked 4x4 puzzle has one solution and the first hint says why', () => {
    const { p, solution } = small();
    const r = solve(p, 5);
    expect(r.count).toBe(1);
    expect(r.solutions[0]).toEqual(solution);
    expect(oracleCount(p, 5)).toBe(1);
    expect(bruteCount(p, 5)).toBe(1);
    const h = nextHint(p, new Array(16).fill(0), solution);
    expect(h).toEqual({
      kind: 'move', cell: 4, mark: TENT, why: 'tree',
      text: 'The tree at row 1, column 1 has only one square left where its tent can stand, so row 2, column 1 is a tent.',
    });
  });
  it('after that tent, the next hint is about the other tree, and then there is nothing left', () => {
    const { p, solution } = small();
    const marks = new Array(16).fill(0);
    marks[4] = TENT;
    const h = nextHint(p, marks, solution);
    expect(h?.kind === 'move' && h.cell).toBe(15);
    expect(h?.kind === 'move' && h.mark).toBe(TENT);
    marks[15] = TENT;
    expect(nextHint(p, marks, solution)).toBeNull();
  });
  it('flags wrong marks first and names them all', () => {
    const { p, solution } = small();
    const marks = new Array(16).fill(0);
    marks[5] = TENT; // no tent in the answer
    marks[4] = GRASS; // a tent in the answer
    marks[8] = GRASS; // fine
    expect(wrongMarks(marks, solution)).toEqual([4, 5]);
    expect(nextHint(p, marks, solution)).toEqual({ kind: 'mistake', cells: [4, 5], text: '2 marks are wrong. Fix them first, then ask for a hint.' });
    marks[4] = 0;
    expect(nextHint(p, marks, solution)).toEqual({ kind: 'mistake', cells: [5], text: '1 mark is wrong. Fix it first, then ask for a hint.' });
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
        if (solution[i] === 1 && rng() < keep) marks[i] = TENT;
        else if (solution[i] === 0 && rng() < keep * 0.5 && puzzle.trees[i] === 0) marks[i] = GRASS;
      }
      const h = nextHint(puzzle, marks, solution);
      if (!h) { expect(tentsOf(marks).length).toBe(treeCount(puzzle)); continue; }
      if (h.kind !== 'move') throw new Error('expected a move hint');
      expect(marks[h.cell]).not.toBe(h.mark);
      if (h.mark === TENT) expect(solution[h.cell], `t=${t} ${h.why}`).toBe(1);
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
  it('following the hints from a fresh puzzle places every tent and never a wrong mark', () => {
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
      expect(tentsOf(marks)).toEqual(tentsOf(solution));
    }
  }, 120_000);
  it('are null once every tent is placed', () => {
    const { puzzle, solution } = makePuzzle(5, 'easy', mulberry32(2));
    expect(nextHint(puzzle, solution, solution)).toBeNull();
  });
});

// ── Fuzz ─────────────────────────────────────────────────────────────────────

describe('fuzz', () => {
  it('conflicts, countState and isSolved never throw on random boards and never call a random board solved', () => {
    const rng = mulberry32(8642);
    for (let t = 0; t < 600; t++) {
      const n = SIZES[t % 3];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(3000 + (t % 40)));
      const marks = Array.from({ length: n * n }, () => Math.floor(rng() * 3));
      expect(() => conflicts(puzzle, marks)).not.toThrow();
      for (let k = 0; k < n; k++) { expect(() => countState(puzzle, marks, 'row', k)).not.toThrow(); expect(() => countState(puzzle, marks, 'col', k)).not.toThrow(); }
      const same = marks.every((v, i) => (v === TENT) === (solution[i] === 1));
      expect(isSolved(puzzle, marks)).toBe(same);
    }
  }, 120_000);
  it('marks of "no tent" never change whether a board is solved', () => {
    const { puzzle, solution } = makePuzzle(7, 'medium', mulberry32(10));
    const rng = mulberry32(3);
    for (let t = 0; t < 30; t++) {
      const marks = solution.map((v, i) => (v === 1 ? TENT : puzzle.trees[i] === 0 && rng() < 0.5 ? GRASS : 0));
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
    expect(plural(1, 'tent')).toBe('1 tent');
    expect(plural(2, 'tent')).toBe('2 tents');
    expect(where(5, 7)).toBe('row 2, column 3');
    expect(markMessage(5, 7, TENT)).toBe('Row 2, column 3: tent.');
    expect(markMessage(5, 7, GRASS)).toBe('Row 2, column 3: no tent here.');
    expect(markMessage(5, 7, 0)).toBe('Row 2, column 3: cleared.');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
