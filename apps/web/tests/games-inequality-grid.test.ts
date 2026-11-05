/**
 * games-inequality-grid.test.ts - the engine behind `inequality-grid`.
 *
 * Pinned: the number of Latin squares of orders 2, 3, 4 and 5 (2, 12, 576, 161,280) from the
 * solver and, for order 4, from an independently written counter; exact halving and quartering
 * facts for a single sign or a single given; the solver's solution count against that independent
 * counter on generated, thinned and deliberately broken puzzles; every generated puzzle has exactly
 * one solution (per the independent counter), a Latin-square answer that agrees with every clue, and
 * clue counts within the level targets; a Hard puzzle has no clue left to remove; hints are always
 * right and repeated hints solve a puzzle; storage is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, GT, LT, MAX_BEST_SECONDS, GEN_NODES,
  mulberry32, shuffled, blankPuzzle, checkPuzzle, relationsOf, signCount, givenCount, maxSigns, describeSigns, targets,
  conflicts, conflictDetail, isSolved, isLatin, completeRows, solve, hasUniqueSolution, candidatesFor, latinSquare, makePuzzle,
  nextHint, wrongCells, bestKey, sanitiseBest, formatTime, plural, where, placeMessage, digitsOf, rowOf, colOf,
  type Puzzle, type Level,
} from '../src/components/apps-private/inequality-grid/helpers';

// ── Independent oracle ───────────────────────────────────────────────────────

/**
 * Count solutions by depth-first search with arc consistency. Every square keeps a list of digits
 * it may still hold. Fixing a square removes its digit from its row and column; a sign keeps only
 * digits that have a partner in the other square's list that makes the sign true. That is repeated
 * until nothing changes, then the square with the shortest list is tried digit by digit. Plain
 * lists and loops, no bitmasks, and no shared code with the engine.
 */
const oracleCount = (p: Puzzle, cap: number, maxNodes = 3_000_000): number => {
  const n = p.n;
  const all = Array.from({ length: n }, (_, k) => k + 1);
  // constraints as [a, b, relation seen from a]: 1 = a must be larger than b, 2 = a must be smaller
  const cons: [number, number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) {
    const s = p.hsign[r * (n - 1) + c];
    if (s) { cons.push([r * n + c, r * n + c + 1, s]); cons.push([r * n + c + 1, r * n + c, s === 1 ? 2 : 1]); }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) {
    const s = p.vsign[r * n + c];
    if (s) { cons.push([r * n + c, (r + 1) * n + c, s]); cons.push([(r + 1) * n + c, r * n + c, s === 1 ? 2 : 1]); }
  }
  const peersOf = (i: number): number[] => {
    const r = Math.floor(i / n);
    const c = i % n;
    const out: number[] = [];
    for (let k = 0; k < n; k++) { if (k !== c) out.push(r * n + k); if (k !== r) out.push(k * n + c); }
    return out;
  };
  const peers = Array.from({ length: n * n }, (_, i) => peersOf(i));
  /** Shrink the lists until stable; false if some list empties. */
  const settle = (dom: number[][]): boolean => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n * n; i++) {
        if (dom[i].length === 0) return false;
        if (dom[i].length === 1) {
          const d = dom[i][0];
          for (const j of peers[i]) {
            if (dom[j].includes(d)) { dom[j] = dom[j].filter((x) => x !== d); changed = true; if (dom[j].length === 0) return false; }
          }
        }
      }
      for (const [a, b, rel] of cons) {
        const keep = dom[a].filter((x) => dom[b].some((y) => (rel === 1 ? x > y : x < y)));
        if (keep.length !== dom[a].length) { dom[a] = keep; changed = true; if (keep.length === 0) return false; }
      }
    }
    return true;
  };
  const start = Array.from({ length: n * n }, (_, i) => (p.givens[i] ? [p.givens[i]] : all.slice()));
  let count = 0;
  let nodes = 0;
  const go = (dom: number[][]): void => {
    if (count >= cap) return;
    if (++nodes > maxNodes) throw new Error('oracle node budget spent');
    if (!settle(dom)) return;
    let best = -1;
    for (let i = 0; i < n * n; i++) if (dom[i].length > 1 && (best < 0 || dom[i].length < dom[best].length)) best = i;
    if (best < 0) { count++; return; }
    for (const d of dom[best]) {
      const next = dom.map((l) => l.slice());
      next[best] = [d];
      go(next);
      if (count >= cap) return;
    }
  };
  go(start);
  return count;
};

const clone = (p: Puzzle): Puzzle => ({ n: p.n, givens: p.givens.slice(), hsign: p.hsign.slice(), vsign: p.vsign.slice() });

/** Plain statement of "every row and column holds each digit once", for comparison with isLatin. */
const naiveLatin = (g: number[], n: number): boolean => {
  for (let a = 0; a < n; a++) {
    const row = [...g.slice(a * n, a * n + n)].sort((x, y) => x - y).join();
    const col = Array.from({ length: n }, (_, b) => g[b * n + a]).sort((x, y) => x - y).join();
    const want = Array.from({ length: n }, (_, k) => k + 1).join();
    if (row !== want || col !== want) return false;
  }
  return true;
};

/** Do all clues of a puzzle agree with this grid? */
const agrees = (p: Puzzle, g: number[]): boolean => {
  const n = p.n;
  for (let i = 0; i < n * n; i++) if (p.givens[i] && p.givens[i] !== g[i]) return false;
  for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) {
    const s = p.hsign[r * (n - 1) + c];
    if (s === GT && !(g[r * n + c] > g[r * n + c + 1])) return false;
    if (s === LT && !(g[r * n + c] < g[r * n + c + 1])) return false;
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) {
    const s = p.vsign[r * n + c];
    if (s === GT && !(g[r * n + c] > g[(r + 1) * n + c])) return false;
    if (s === LT && !(g[r * n + c] < g[(r + 1) * n + c])) return false;
  }
  return true;
};

// ── Latin squares ────────────────────────────────────────────────────────────

describe('Latin squares', () => {
  it('there are 2, 12, 576 and 161,280 of order 2, 3, 4 and 5, counted by the solver', () => {
    expect(solve(blankPuzzle(2), 1000).count).toBe(2);
    expect(solve(blankPuzzle(3), 1000).count).toBe(12);
    expect(solve(blankPuzzle(4), 100_000).count).toBe(576);
    const five = solve(blankPuzzle(5), 1_000_000, 5_000_000);
    expect(five.complete).toBe(true);
    expect(five.count).toBe(161_280);
  }, 120_000);
  it('the independent counter gets the same numbers for orders 2, 3 and 4', () => {
    expect(oracleCount(blankPuzzle(2), 1000)).toBe(2);
    expect(oracleCount(blankPuzzle(3), 1000)).toBe(12);
    expect(oracleCount(blankPuzzle(4), 100_000)).toBe(576);
  });
  it('every square list the solver gives is a Latin square, and they are all different', () => {
    const r = solve(blankPuzzle(4), 1000);
    expect(new Set(r.solutions.map((s) => s.join(''))).size).toBe(576);
    for (const s of r.solutions) { expect(isLatin(s, 4)).toBe(true); expect(naiveLatin(s, 4)).toBe(true); }
  });
  it('random Latin squares are Latin, differ across seeds and are deterministic per seed', () => {
    for (const n of [2, 3, 4, 5, 6, 7]) {
      const a = latinSquare(n, mulberry32(8));
      expect(isLatin(a, n)).toBe(true);
      expect(latinSquare(n, mulberry32(8))).toEqual(a);
      const seen = new Set<string>();
      for (let seed = 1; seed <= 10; seed++) {
        const s = latinSquare(n, mulberry32(seed));
        expect(naiveLatin(s, n)).toBe(true);
        seen.add(s.join(''));
      }
      expect(seen.size).toBeGreaterThan(n === 2 ? 1 : 5);
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

describe('symmetry facts that give exact counts', () => {
  it('one sign between two squares of a row halves the 576 squares of order 4', () => {
    for (const rel of [GT, LT]) {
      const p = blankPuzzle(4);
      p.hsign[1 * 3 + 2] = rel;
      expect(solve(p, 10_000).count).toBe(288);
      expect(oracleCount(p, 10_000)).toBe(288);
    }
  });
  it('one sign between two squares of a column halves it too', () => {
    for (const rel of [GT, LT]) {
      const p = blankPuzzle(4);
      p.vsign[2 * 4 + 0] = rel;
      expect(solve(p, 10_000).count).toBe(288);
      expect(oracleCount(p, 10_000)).toBe(288);
    }
  });
  it('one given digit leaves a quarter of them: 144', () => {
    for (const d of [1, 2, 3, 4]) {
      const p = blankPuzzle(4);
      p.givens[5] = d;
      expect(solve(p, 10_000).count).toBe(144);
    }
    const p = blankPuzzle(4);
    p.givens[0] = 3;
    expect(oracleCount(p, 10_000)).toBe(144);
  });
  it('a sign that cannot hold, or two givens that clash, leave no solution', () => {
    const a = blankPuzzle(4);
    a.hsign[0] = GT; a.hsign[1] = GT; a.hsign[2] = GT; // 4 > 3 > 2 > 1 forced across row 0: fine
    expect(solve(a, 10_000).count).toBeGreaterThan(0);
    a.vsign[0] = LT; // square (0,0) below square (1,0)? (0,0) must be smaller than (1,0), but (0,0) is 4 in row 0
    expect(solve(a, 10_000).count).toBe(0);
    expect(oracleCount(a, 10_000)).toBe(0);
    const b = blankPuzzle(4);
    b.givens[0] = 2; b.givens[1] = 2;
    expect(solve(b).count).toBe(0);
    expect(oracleCount(b, 10)).toBe(0);
  });
});

// ── Rules ────────────────────────────────────────────────────────────────────

describe('rules', () => {
  it('rejects malformed puzzles', () => {
    expect(() => blankPuzzle(1)).toThrow(RangeError);
    expect(() => blankPuzzle(8)).toThrow(RangeError);
    const good = blankPuzzle(4);
    expect(() => checkPuzzle(good)).not.toThrow();
    expect(() => checkPuzzle({ ...good, givens: good.givens.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, hsign: good.hsign.slice(1) })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, vsign: [...good.vsign, 0] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, givens: [5, ...good.givens.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, hsign: [3, ...good.hsign.slice(1)] })).toThrow(RangeError);
    expect(() => checkPuzzle({ ...good, givens: [1.5, ...good.givens.slice(1)] })).toThrow(RangeError);
    expect(() => solve({ ...good, n: 9 })).toThrow(RangeError);
  });
  it('reads signs in the order the page expects', () => {
    const p = blankPuzzle(3);
    p.hsign[0 * 2 + 1] = GT; // (0,1) > (0,2)
    p.vsign[1 * 3 + 2] = LT; // (1,2) < (2,2)
    expect(relationsOf(p)).toEqual([
      { a: 1, b: 2, rel: GT, dir: 'h' },
      { a: 5, b: 8, rel: LT, dir: 'v' },
    ]);
    expect(signCount(p)).toBe(2);
    expect(maxSigns(3)).toBe(12);
    expect(maxSigns(7)).toBe(84);
    expect(describeSigns(p, 1)).toBe('greater than the square to its right');
    expect(describeSigns(p, 2)).toBe('less than the square to its left');
    expect(describeSigns(p, 5)).toBe('less than the square below');
    expect(describeSigns(p, 8)).toBe('greater than the square above');
    expect(describeSigns(p, 0)).toBe('');
  });
  it('conflicts flag repeated digits and untrue signs, and nothing else', () => {
    const p = blankPuzzle(4);
    p.hsign[0] = GT; // (0,0) > (0,1)
    p.vsign[0] = LT; // (0,0) < (1,0)
    const g = new Array(16).fill(0);
    g[0] = 2; g[1] = 3; // sign broken: 2 > 3 is false
    g[4] = 1; // second sign broken: 2 < 1 is false
    g[2] = 3; // 3 repeated in row 0
    const d = conflictDetail(p, g);
    expect([...d.sign].sort((a, b) => a - b)).toEqual([0, 1, 4]);
    expect([...d.repeat].sort((a, b) => a - b)).toEqual([1, 2]);
    expect([...conflicts(p, g)].sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
    expect(conflicts(p, new Array(16).fill(0)).size).toBe(0);
    const col = new Array(16).fill(0);
    col[1] = 4; col[13] = 4; // a repeat down column 1
    expect([...conflicts(blankPuzzle(4), col)].sort((a, b) => a - b)).toEqual([1, 13]);
  });
  it('isSolved agrees with an independent check on generated, damaged and random grids', () => {
    const rng = mulberry32(55);
    for (let t = 0; t < 300; t++) {
      const n = SIZES[t % 4];
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
  it('completeRows lists the rows that are full, distinct and true to their signs', () => {
    const p = blankPuzzle(4);
    p.hsign[0] = GT; // row 0: first > second
    const g = new Array(16).fill(0);
    g[0] = 2; g[1] = 1; g[2] = 4; g[3] = 3; // row 0 done and true
    g[4] = 1; g[5] = 2; g[6] = 3; g[7] = 3; // row 1 has a repeat
    g[8] = 1; g[9] = 2; g[10] = 3; // row 2 not full
    expect(completeRows(p, g)).toEqual([0]);
    g[0] = 1; g[1] = 2; // swap the first two: 1 > 2 is false
    expect(completeRows(p, g)).toEqual([]);
  });
});

// ── Solver against the independent counter ───────────────────────────────────

describe('solver', () => {
  it('agrees with the independent counter on thinned and broken puzzles of every size', () => {
    const rng = mulberry32(2718);
    let none = 0;
    let one = 0;
    let many = 0;
    for (let t = 0; t < 160; t++) {
      const n = SIZES[t % 4];
      const { puzzle, solution } = makePuzzle(n, LEVELS[Math.floor(t / 4) % 3], mulberry32(700 + t));
      const p = clone(puzzle);
      const mode = t % 5;
      if (mode === 1) p.hsign = p.hsign.map((s) => (rng() < 0.4 ? 0 : s));
      if (mode === 2) p.givens = p.givens.map(() => 0);
      if (mode === 3) { p.givens = p.givens.map((g) => (rng() < 0.5 ? 0 : g)); p.vsign = p.vsign.map((s) => (rng() < 0.3 ? 0 : s)); }
      if (mode === 4) { // flip one sign: usually leaves no solution, sometimes a different one
        const all = [...p.hsign.keys()].filter((k) => p.hsign[k]);
        if (all.length) p.hsign[all[Math.floor(rng() * all.length)]] ^= 3;
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
  }, 180_000);
  it('stops on a spent node budget and says so', () => {
    const r = solve(blankPuzzle(7), 1_000_000, 5);
    expect(r.complete).toBe(false);
    expect(hasUniqueSolution(blankPuzzle(4), 3)).toBe(false);
  });
  it('never modifies the puzzle it is given', () => {
    const { puzzle, solution } = makePuzzle(6, 'hard', mulberry32(9));
    const copy = JSON.stringify(puzzle);
    solve(puzzle, 3);
    hasUniqueSolution(puzzle);
    candidatesFor(puzzle, solution);
    nextHint(puzzle, puzzle.givens, solution);
    expect(JSON.stringify(puzzle)).toBe(copy);
  });
  it('candidate digits keep the true digit, and come back null if the entries contradict the clues', () => {
    const rng = mulberry32(31);
    for (let t = 0; t < 60; t++) {
      const n = SIZES[t % 4];
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
  it('every puzzle is well formed, has the stored Latin square as its only solution, and clues that agree with it', () => {
    for (const n of SIZES) {
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
  }, 180_000);
  it('Easy and Medium puzzles reach their clue targets on every seed tried, and the targets are pinned', () => {
    expect(SIZES.map((n) => targets(n, 'easy'))).toEqual([
      { givens: 5, signs: 18 }, { givens: 8, signs: 30 }, { givens: 11, signs: 45 }, { givens: 15, signs: 63 },
    ]);
    expect(SIZES.map((n) => targets(n, 'medium'))).toEqual([
      { givens: 2, signs: 14 }, { givens: 3, signs: 22 }, { givens: 5, signs: 33 }, { givens: 6, signs: 47 },
    ]);
    expect(SIZES.map((n) => targets(n, 'hard'))).toEqual(SIZES.map(() => ({ givens: 0, signs: 0 })));
    expect(GEN_NODES).toBeGreaterThan(0);
    for (const n of SIZES) {
      for (const level of ['easy', 'medium'] as Level[]) {
        const t = targets(n, level);
        for (let seed = 1; seed <= 8; seed++) {
          const { puzzle } = makePuzzle(n, level, mulberry32(seed));
          // The targets are reached on every seed tried: removal never gets stuck above them.
          expect(givenCount(puzzle), `${n} ${level} #${seed}`).toBeLessThanOrEqual(Math.max(t.givens, 0));
          expect(signCount(puzzle), `${n} ${level} #${seed}`).toBeLessThanOrEqual(t.signs);
        }
      }
    }
  });
  it('a Hard puzzle is minimal: taking away any one given or sign gives more than one solution (independent counter)', () => {
    for (const n of [4, 5, 6]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { puzzle } = makePuzzle(n, 'hard', mulberry32(seed));
        puzzle.givens.forEach((g, i) => {
          if (!g) return;
          const q = clone(puzzle);
          q.givens[i] = 0;
          expect(oracleCount(q, 2), `${n} #${seed} given ${i}`).toBeGreaterThan(1);
        });
        (['hsign', 'vsign'] as const).forEach((key) => puzzle[key].forEach((s, k) => {
          if (!s) return;
          const q = clone(puzzle);
          q[key][k] = 0;
          expect(oracleCount(q, 2), `${n} #${seed} ${key} ${k}`).toBeGreaterThan(1);
        }));
      }
    }
  }, 180_000);
  it('harder levels keep fewer clues in total', () => {
    const total = (n: number, level: Level) => {
      let t = 0;
      for (let seed = 1; seed <= 10; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; t += givenCount(p) + signCount(p); }
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
      for (let seed = 1; seed <= 20; seed++) { const p = makePuzzle(n, level, mulberry32(seed)).puzzle; g.push(givenCount(p)); s.push(signCount(p)); }
      return { givens: [Math.min(...g), Math.max(...g)], signs: [Math.min(...s), Math.max(...s)] };
    };
    const got = Object.fromEntries(SIZES.flatMap((n) => LEVELS.map((l) => [`${n}-${l}`, range(n, l)])));
    expect(got).toEqual({
      '4-easy': { givens: [5, 5], signs: [18, 18] }, '4-medium': { givens: [2, 4], signs: [14, 14] }, '4-hard': { givens: [0, 4], signs: [1, 6] },
      '5-easy': { givens: [8, 8], signs: [30, 30] }, '5-medium': { givens: [3, 3], signs: [22, 22] }, '5-hard': { givens: [0, 2], signs: [7, 12] },
      '6-easy': { givens: [11, 11], signs: [45, 45] }, '6-medium': { givens: [5, 5], signs: [33, 33] }, '6-hard': { givens: [0, 3], signs: [10, 19] },
      '7-easy': { givens: [15, 15], signs: [63, 63] }, '7-medium': { givens: [6, 6], signs: [47, 47] }, '7-hard': { givens: [0, 4], signs: [20, 29] },
    });
  }, 120_000);
  it('is deterministic per seed and differs across seeds', () => {
    for (const n of SIZES) {
      expect(makePuzzle(n, 'medium', mulberry32(21))).toEqual(makePuzzle(n, 'medium', mulberry32(21)));
      expect(makePuzzle(n, 'medium', mulberry32(21)).solution).not.toEqual(makePuzzle(n, 'medium', mulberry32(22)).solution);
    }
  });
  it('a 7x7 Hard puzzle is made in a reasonable time (generous bound)', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= 6; seed++) makePuzzle(7, 'hard', mulberry32(seed));
    expect(performance.now() - t0).toBeLessThan(90_000);
  }, 120_000);
  it('rejects bad sizes', () => {
    expect(() => makePuzzle(1, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(8, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => latinSquare(0, mulberry32(1))).toThrow(RangeError);
  });
});

// ── Hints ────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('on a board with no mistakes, name a right digit for an empty square and always say something', () => {
    const rng = mulberry32(4242);
    const whys: Record<string, number> = {};
    for (let t = 0; t < 160; t++) {
      const n = SIZES[t % 4];
      const { puzzle, solution } = makePuzzle(n, LEVELS[Math.floor(t / 4) % 3], mulberry32(1500 + t));
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
    expect((whys.last ?? 0) + (whys['only-digit'] ?? 0)).toBeGreaterThan(100);
  }, 120_000);
  it('the last-gap reason is only given when that really is the last gap', () => {
    const { puzzle, solution } = makePuzzle(5, 'medium', mulberry32(3));
    const grid = solution.slice();
    const target = 7;
    grid[target] = 0;
    for (const g of puzzle.givens.keys()) if (puzzle.givens[g]) grid[g] = puzzle.givens[g];
    const h = nextHint(puzzle, grid, solution);
    expect(h).toMatchObject({ kind: 'move', cell: target, value: solution[target], why: 'last' });
    expect(h?.kind === 'move' && h.text).toBe(
      `${h?.kind === 'move' && h.text.startsWith('Row') ? `Row ${rowOf(5, target) + 1}` : `Column ${colOf(5, target) + 1}`} has every digit except ${solution[target]}, so row ${rowOf(5, target) + 1}, column ${colOf(5, target) + 1} must be ${solution[target]}.`);
  });
  it('flag wrong digits first and name them all', () => {
    const { puzzle, solution } = makePuzzle(6, 'medium', mulberry32(5));
    const grid = puzzle.givens.slice();
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
    for (const [n, level, seed] of [[4, 'easy', 1], [5, 'medium', 2], [6, 'hard', 3], [7, 'easy', 4], [7, 'hard', 5]] as const) {
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
  it('conflicts and isSolved never throw on random grids and never call a random grid solved', () => {
    const rng = mulberry32(8642);
    for (let t = 0; t < 800; t++) {
      const n = SIZES[t % 4];
      const { puzzle, solution } = makePuzzle(n, LEVELS[t % 3], mulberry32(3000 + (t % 40)));
      const grid = Array.from({ length: n * n }, () => (rng() < 0.7 ? 1 + Math.floor(rng() * n) : 0));
      expect(() => conflicts(puzzle, grid)).not.toThrow();
      expect(isSolved(puzzle, grid)).toBe(grid.every((v, i) => v === solution[i]));
    }
  }, 120_000);
  it('a solved grid has no conflicts and no strict part of it conflicts', () => {
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
    expect(bestKey(6, 'hard')).toBe('6-hard');
  });
  it('keeps whole positive seconds for known sizes and levels and drops everything else', () => {
    expect(sanitiseBest({ '4-easy': 75, '6-medium': 240, '7-hard': 3600 })).toEqual({ '4-easy': 75, '6-medium': 240, '7-hard': 3600 });
    expect(sanitiseBest({ '4-easy': 75, '3-easy': 3, '4-wild': 3, x: 1 })).toEqual({ '4-easy': 75 });
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
