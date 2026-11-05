/**
 * games-binary-puzzle.test.ts - the engine behind `binary-puzzle`.
 *
 * Pinned: the rules checker agrees with an independent checker on every 4x4 grid and on
 * random partial grids; the number of complete 4x4 and 6x6 solutions comes out the same
 * from the engine's solver and from a brute-force row enumeration; the engine solver's
 * solution count equals an independently written row-by-row counter on many puzzles;
 * every generated puzzle has exactly one solution (per the independent counter), its
 * clues match its solution, and a Hard puzzle has no clue left to remove; hints are
 * always right and repeated hints solve a puzzle; storage is sanitised.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, MAX_BEST_SECONDS, SYMBOL_NAMES,
  mulberry32, shuffled, emptyGrid, countClues, isComplete, conflicts, conflictDetail, isValidSolution, solve, hasUniqueSolution,
  randomSolution, targetClues, makePuzzle, findDeduction, findLookahead, nextHint, deductionText, wrongCells, where, linesOf,
  bestKey, sanitiseBest, formatTime, plural, placeMessage, symbolPlural,
  type Grid, type Level,
} from '../src/components/apps-private/binary-puzzle/helpers';

// ── Independent oracle ───────────────────────────────────────────────────────

/** Every row of length n with n/2 of each symbol and no three equal in a row, as arrays of 1 and 2. Plain integer enumeration. */
const validRows = (n: number): number[][] => {
  const out: number[][] = [];
  for (let mask = 0; mask < 2 ** n; mask++) {
    let ones = 0;
    for (let b = 0; b < n; b++) ones += (mask >> b) & 1;
    if (ones !== n / 2) continue;
    const row = Array.from({ length: n }, (_, b) => ((mask >> b) & 1) + 1);
    let ok = true;
    for (let b = 0; b + 2 < n; b++) if (row[b] === row[b + 1] && row[b] === row[b + 2]) ok = false;
    if (ok) out.push(row);
  }
  return out;
};
const ROWS: Record<number, number[][]> = { 4: validRows(4), 6: validRows(6), 8: validRows(8), 10: validRows(10) };

/**
 * Count solutions row by row: choose each row from the valid rows that agree with the
 * clues, keep every column free of triples and not over-full, reject repeated rows, and
 * at the end require distinct columns. Shares no code with the engine.
 */
const oracleCount = (puzzle: Grid, n: number, cap: number): number => {
  const rows = ROWS[n];
  const half = n / 2;
  let count = 0;
  const chosen: number[][] = [];
  const colCount = Array.from({ length: n }, () => [0, 0, 0]);
  const go = (r: number): void => {
    if (count >= cap) return;
    if (r === n) {
      const cols = Array.from({ length: n }, (_, c) => chosen.map((row) => row[c]).join(''));
      if (new Set(cols).size === n) count++;
      return;
    }
    for (const row of rows) {
      let ok = true;
      for (let c = 0; c < n && ok; c++) {
        const clue = puzzle[r * n + c];
        if (clue && clue !== row[c]) ok = false;
      }
      if (!ok) continue;
      if (chosen.some((o) => o.every((v, c) => v === row[c]))) continue;
      for (let c = 0; c < n && ok; c++) {
        if (colCount[c][row[c]] + 1 > half) ok = false;
        if (r >= 2 && chosen[r - 1][c] === row[c] && chosen[r - 2][c] === row[c]) ok = false;
      }
      if (!ok) continue;
      chosen.push(row);
      for (let c = 0; c < n; c++) colCount[c][row[c]]++;
      go(r + 1);
      for (let c = 0; c < n; c++) colCount[c][row[c]]--;
      chosen.pop();
    }
  };
  go(0);
  return count;
};

/** Naive statement of the three rules on a complete or partial grid: true when something is broken. */
const naiveBroken = (g: Grid, n: number): boolean => {
  const at = (r: number, c: number) => g[r * n + c];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b + 2 < n; b++) {
      if (at(a, b) && at(a, b) === at(a, b + 1) && at(a, b) === at(a, b + 2)) return true;
      if (at(b, a) && at(b, a) === at(b + 1, a) && at(b, a) === at(b + 2, a)) return true;
    }
    for (const sym of [1, 2]) {
      let rc = 0;
      let cc = 0;
      for (let b = 0; b < n; b++) { if (at(a, b) === sym) rc++; if (at(b, a) === sym) cc++; }
      if (rc > n / 2 || cc > n / 2) return true;
    }
  }
  const full = (line: number[]) => line.every((v) => v !== 0);
  const rowStrs: string[] = [];
  const colStrs: string[] = [];
  for (let a = 0; a < n; a++) {
    const row = Array.from({ length: n }, (_, b) => at(a, b));
    const col = Array.from({ length: n }, (_, b) => at(b, a));
    if (full(row)) rowStrs.push(row.join(''));
    if (full(col)) colStrs.push(col.join(''));
  }
  return new Set(rowStrs).size !== rowStrs.length || new Set(colStrs).size !== colStrs.length;
};

const gridFromMask = (mask: number, N: number): Grid => Array.from({ length: N }, (_, i) => ((mask >> i) & 1) + 1);
const randomPartial = (n: number, rng: () => number, density: number): Grid =>
  Array.from({ length: n * n }, () => (rng() < density ? 1 + Math.floor(rng() * 2) : 0));

// ── Rules ────────────────────────────────────────────────────────────────────

describe('rules checker', () => {
  it('agrees with the independent statement of the rules on all 65536 4x4 grids', () => {
    let valid = 0;
    for (let mask = 0; mask < 65536; mask++) {
      const g = gridFromMask(mask, 16);
      const engine = isValidSolution(g, 4);
      const naive = !naiveBroken(g, 4);
      if (engine !== naive) throw new Error(`4x4 grid ${mask}: engine ${engine}, naive ${naive}`);
      if (engine) valid++;
    }
    expect(valid).toBe(72);
  });
  it('agrees with the independent checker on random partial grids of every size', () => {
    const rng = mulberry32(99);
    for (const n of [4, 6, 8, 10]) {
      for (let t = 0; t < 1500; t++) {
        const g = randomPartial(n, rng, 0.2 + rng() * 0.8);
        expect(conflicts(g, n).size > 0, `n=${n} t=${t}`).toBe(naiveBroken(g, n));
      }
    }
  });
  it('flags the right squares for each kind of conflict', () => {
    const g = emptyGrid(6);
    g[0] = 1; g[1] = 1; g[2] = 1; // three in a row
    const d = conflictDetail(g, 6);
    expect([...d.triple].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(d.count.size).toBe(0);
    const h = emptyGrid(6);
    h[6] = 2; h[8] = 2; h[10] = 2; h[11] = 2; // four squares in row 2 (half of 6 is 3)
    const e = conflictDetail(h, 6);
    expect([...e.count].sort((a, b) => a - b)).toEqual([6, 8, 10, 11]);
    const t = emptyGrid(4);
    for (const i of [0, 1, 2, 3]) t[i] = i % 2 ? 1 : 2; // 2121
    for (const i of [4, 5, 6, 7]) t[i] = i % 2 ? 1 : 2; // 2121 again
    expect([...conflictDetail(t, 4).twin].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('does not flag empty squares or a clean partial grid', () => {
    expect(conflicts(emptyGrid(8), 8).size).toBe(0);
    const g = emptyGrid(6);
    g[0] = 1; g[1] = 1; g[2] = 2;
    expect(conflicts(g, 6).size).toBe(0);
  });
  it('rejects bad sizes and bad grids', () => {
    expect(() => emptyGrid(5)).toThrow(RangeError);
    expect(() => emptyGrid(2)).toThrow(RangeError);
    expect(() => emptyGrid(12)).toThrow(RangeError);
    expect(() => linesOf(7)).toThrow(RangeError);
    expect(() => conflicts([1, 2, 1], 4)).toThrow(RangeError);
    expect(() => conflicts(new Array(16).fill(3), 4)).toThrow(RangeError);
    expect(() => solve([...new Array(15).fill(0), 9], 4)).toThrow(RangeError);
    expect(() => isValidSolution(new Array(16).fill(0.5), 4)).toThrow(RangeError);
  });
  it('isComplete and clue counting', () => {
    expect(isComplete([1, 2, 1, 2])).toBe(true);
    expect(isComplete([1, 0, 1, 2])).toBe(false);
    expect(isComplete([])).toBe(false);
    expect(countClues([1, 0, 2, 0])).toBe(2);
  });
});

// ── Counting all solutions ───────────────────────────────────────────────────

describe('solution counts of the empty grid', () => {
  it('4x4 has 72 and 6x6 has 4140 complete grids, from the engine and from brute force', () => {
    // Brute force for 6x6: every combination of 6 valid rows with distinct rows, then check columns directly.
    const rows = ROWS[6];
    let brute = 0;
    const pick: number[][] = [];
    const go = (r: number): void => {
      if (r === 6) {
        const g = pick.flat();
        if (!naiveBroken(g, 6) && g.every((v) => v !== 0)) brute++;
        return;
      }
      for (const row of rows) { pick.push(row); go(r + 1); pick.pop(); }
    };
    go(0);
    expect(brute).toBe(4140);
    expect(solve(emptyGrid(6), 6, 100_000).count).toBe(4140);
    expect(solve(emptyGrid(4), 4, 1000).count).toBe(72);
    expect(oracleCount(emptyGrid(6), 6, 100_000)).toBe(4140);
    expect(oracleCount(emptyGrid(4), 4, 1000)).toBe(72);
    expect(solve(emptyGrid(6), 6, 100_000).complete).toBe(true);
  }, 60_000);
  it('every solution the engine lists is valid and they are all different', () => {
    const r = solve(emptyGrid(6), 6, 100_000);
    expect(new Set(r.solutions.map((s) => s.join(''))).size).toBe(4140);
    for (const s of r.solutions) expect(isValidSolution(s, 6)).toBe(true);
  });
  it('the number of valid rows is as expected for each size', () => {
    expect(Object.fromEntries(Object.entries(ROWS).map(([n, v]) => [n, v.length]))).toEqual({ 4: 6, 6: 14, 8: 34, 10: 84 });
  });
});

describe('solver against the independent counter', () => {
  it('agrees on random partial puzzles of sizes 4, 6 and 8, including contradictory ones', () => {
    const rng = mulberry32(31415);
    let unsolvable = 0;
    let unique = 0;
    let many = 0;
    for (const n of [4, 6, 8]) {
      for (let t = 0; t < 250; t++) {
        // A mix: clues copied from a real solution (satisfiable) and pure noise (often not).
        let g: Grid;
        if (t % 3 === 0) g = randomPartial(n, rng, 0.25 + rng() * 0.3);
        else {
          const sol = randomSolution(n, rng);
          const keep = 0.2 + rng() * 0.5;
          g = sol.map((v) => (rng() < keep ? v : 0));
        }
        const cap = 6;
        const engine = solve(g, n, cap);
        const oracle = oracleCount(g, n, cap);
        expect(engine.complete).toBe(true);
        if (engine.count !== oracle) throw new Error(`n=${n} t=${t} grid ${g.join('')}: engine ${engine.count}, oracle ${oracle}`);
        if (oracle === 0) unsolvable++; else if (oracle === 1) unique++; else many++;
      }
    }
    expect(unsolvable).toBeGreaterThan(20);
    expect(unique).toBeGreaterThan(20);
    expect(many).toBeGreaterThan(20);
  }, 120_000);
  it('10x10 uniqueness checks match too (fewer samples)', () => {
    const rng = mulberry32(2718);
    for (let t = 0; t < 12; t++) {
      const sol = randomSolution(10, rng);
      const g = sol.map((v) => (rng() < 0.45 ? v : 0));
      expect(solve(g, 10, 2).count).toBe(oracleCount(g, 10, 2));
    }
  }, 120_000);
  it('a solution is returned in the grid it solves, with clues untouched', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 30; t++) {
      const n = [4, 6, 8][t % 3];
      const sol = randomSolution(n, rng);
      const g = sol.map((v) => (rng() < 0.5 ? v : 0));
      const r = solve(g, n, 3);
      for (const s of r.solutions) {
        expect(isValidSolution(s, n)).toBe(true);
        g.forEach((v, i) => { if (v) expect(s[i]).toBe(v); });
      }
    }
  });
  it('hasUniqueSolution is false for none, many, and a spent node budget', () => {
    expect(hasUniqueSolution(emptyGrid(6), 6)).toBe(false);
    const bad = emptyGrid(4);
    bad[0] = 1; bad[1] = 1; bad[2] = 1;
    expect(solve(bad, 4).count).toBe(0);
    expect(hasUniqueSolution(bad, 4)).toBe(false);
    expect(solve(emptyGrid(10), 10, 5, 3).complete).toBe(false);
    expect(hasUniqueSolution(emptyGrid(4), 4, 1)).toBe(false);
  });
  it('never modifies the grid it is given', () => {
    const g = randomSolution(6, mulberry32(1)).map((v, i) => (i % 3 ? v : 0));
    const copy = g.slice();
    solve(g, 6, 5);
    hasUniqueSolution(g, 6);
    nextHint(g, 6, randomSolution(6, mulberry32(1)));
    expect(g).toEqual(copy);
  });
});

// ── Solution generation ──────────────────────────────────────────────────────

describe('random solutions', () => {
  it('are valid for every size, differ across seeds, and are deterministic per seed', () => {
    for (const n of SIZES) {
      const a = randomSolution(n, mulberry32(7));
      expect(isValidSolution(a, n)).toBe(true);
      expect(randomSolution(n, mulberry32(7))).toEqual(a);
      const seen = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const s = randomSolution(n, mulberry32(seed));
        expect(isValidSolution(s, n)).toBe(true);
        seen.add(s.join(''));
      }
      expect(seen.size).toBeGreaterThan(n === 6 ? 5 : 9);
    }
  }, 60_000);
});

describe('puzzle generation', () => {
  const sample = (n: number, level: Level, seeds: number[]) => seeds.map((seed) => ({ seed, ...makePuzzle(n, level, mulberry32(seed)) }));

  it('every puzzle has exactly one solution (independent counter), the stored solution, and clues taken from it', () => {
    for (const n of SIZES) {
      for (const level of LEVELS) {
        for (const p of sample(n, level, n === 10 ? [1, 2, 3] : [1, 2, 3, 4, 5, 6])) {
          expect(oracleCount(p.puzzle, n, 2), `${n} ${level} #${p.seed}`).toBe(1);
          expect(isValidSolution(p.solution, n)).toBe(true);
          p.puzzle.forEach((v, i) => { if (v) expect(v).toBe(p.solution[i]); });
          expect(solve(p.puzzle, n, 2).solutions[0]).toEqual(p.solution);
          expect(countClues(p.puzzle)).toBeGreaterThan(0);
          expect(countClues(p.puzzle)).toBeLessThan(n * n);
        }
      }
    }
  }, 180_000);
  it('Easy and Medium stop at their stated clue targets, which are pinned for the guide page', () => {
    expect(SIZES.map((n) => targetClues(n, 'easy'))).toEqual([20, 36, 55]);
    expect(SIZES.map((n) => targetClues(n, 'medium'))).toEqual([16, 27, 42]);
    expect(SIZES.map((n) => targetClues(n, 'hard'))).toEqual([0, 0, 0]);
    for (const n of [6, 8]) {
      for (const level of ['easy', 'medium'] as Level[]) {
        for (const p of sample(n, level, [1, 2, 3, 4, 5, 6])) {
          // Removal stops at the target, so the clue count is at the target unless no further clue could go.
          expect(countClues(p.puzzle)).toBeLessThanOrEqual(targetClues(n, level) + 2);
        }
      }
    }
  }, 60_000);
  it('clue counts over seeds 1 to 30, as quoted on the guide page', () => {
    const range = (n: number, level: Level) => {
      const counts = sample(n, level, Array.from({ length: 30 }, (_, k) => k + 1)).map((p) => countClues(p.puzzle));
      return [Math.min(...counts), Math.max(...counts)];
    };
    for (const n of SIZES) {
      expect(range(n, 'easy')).toEqual([targetClues(n, 'easy'), targetClues(n, 'easy')]);
      expect(range(n, 'medium')).toEqual([targetClues(n, 'medium'), targetClues(n, 'medium')]);
    }
    expect(range(6, 'hard')).toEqual([6, 11]);
    expect(range(8, 'hard')).toEqual([12, 18]);
    expect(range(10, 'hard')).toEqual([18, 25]);
  }, 120_000);
  it('a Hard puzzle is minimal: taking away any single clue gives more than one solution (independent counter)', () => {
    for (const n of [6, 8]) {
      for (const p of sample(n, 'hard', [1, 2, 3, 4])) {
        p.puzzle.forEach((v, i) => {
          if (!v) return;
          const g = p.puzzle.slice();
          g[i] = 0;
          expect(oracleCount(g, n, 2), `${n} #${p.seed} clue ${i}`).toBeGreaterThan(1);
        });
      }
    }
  }, 120_000);
  it('harder levels leave fewer clues', () => {
    const avg = (n: number, level: Level) => {
      const s = sample(n, level, [1, 2, 3, 4, 5, 6, 7, 8]);
      return s.reduce((t, p) => t + countClues(p.puzzle), 0) / s.length;
    };
    for (const n of [6, 8]) {
      expect(avg(n, 'easy')).toBeGreaterThan(avg(n, 'medium'));
      expect(avg(n, 'medium')).toBeGreaterThan(avg(n, 'hard'));
    }
  }, 120_000);
  it('is deterministic per seed and differs across seeds', () => {
    for (const n of SIZES) {
      expect(makePuzzle(n, 'medium', mulberry32(11))).toEqual(makePuzzle(n, 'medium', mulberry32(11)));
      expect(makePuzzle(n, 'medium', mulberry32(11)).puzzle).not.toEqual(makePuzzle(n, 'medium', mulberry32(12)).puzzle);
    }
  }, 60_000);
  it('a 10x10 Hard puzzle is made in a reasonable time (generous bound)', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= 3; seed++) makePuzzle(10, 'hard', mulberry32(seed));
    expect(performance.now() - t0).toBeLessThan(90_000);
  }, 120_000);
  it('rejects bad sizes', () => {
    expect(() => makePuzzle(7, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(12, 'easy', mulberry32(1))).toThrow(RangeError);
  });
});

// ── Hints ────────────────────────────────────────────────────────────────────

describe('hints', () => {
  it('are always correct moves on a puzzle that has no mistakes, and always say something', () => {
    const rng = mulberry32(8080);
    let simple = 0;
    let deeper = 0;
    let reveal = 0;
    for (let t = 0; t < 180; t++) {
      const n = [4, 6, 8][t % 3];
      const level = LEVELS[t % 3];
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(1000 + t));
      // A mid-game state: some empty squares filled in correctly.
      const g = puzzle.map((v, i) => (!v && rng() < rng() * 0.8 ? solution[i] : v));
      if (isComplete(g)) continue;
      const h = nextHint(g, n, solution);
      expect(h).not.toBeNull();
      if (!h || h.kind !== 'move') throw new Error('expected a move hint');
      expect(g[h.cell]).toBe(0);
      expect(h.value).toBe(solution[h.cell]);
      expect(h.text.length).toBeGreaterThan(10);
      expect(h.text).toMatch(/[.]$/);
      expect(h.text.charAt(0)).toBe(h.text.charAt(0).toUpperCase());
      if (h.rule === 'lookahead') deeper++; else if (h.rule === 'reveal') reveal++; else simple++;
    }
    expect(simple).toBeGreaterThan(30);
    expect(simple + deeper + reveal).toBeGreaterThan(100);
  }, 180_000);
  it('flag mistakes first, naming every wrong square', () => {
    const { puzzle, solution } = makePuzzle(6, 'medium', mulberry32(3));
    const g = puzzle.slice();
    const empties = g.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    g[empties[0]] = 3 - solution[empties[0]];
    g[empties[1]] = 3 - solution[empties[1]];
    g[empties[2]] = solution[empties[2]];
    const h = nextHint(g, 6, solution);
    expect(h?.kind).toBe('mistake');
    if (h?.kind === 'mistake') {
      expect(h.cells).toEqual([empties[0], empties[1]].sort((a, b) => a - b));
      expect(h.text).toBe('2 squares are wrong. Fix them first, then ask for a hint.');
    }
    expect(wrongCells(g, solution)).toEqual([empties[0], empties[1]].sort((a, b) => a - b));
    const one = puzzle.slice();
    one[empties[0]] = 3 - solution[empties[0]];
    const h1 = nextHint(one, 6, solution);
    expect(h1?.kind === 'mistake' && h1.text).toBe('1 square is wrong. Fix it first, then ask for a hint.');
  });
  it('are null when the grid is complete', () => {
    const { solution } = makePuzzle(6, 'easy', mulberry32(2));
    expect(nextHint(solution, 6, solution)).toBeNull();
  });
  it('following hints from a fresh puzzle solves it, one square per hint', () => {
    for (const [n, level, seed] of [[6, 'easy', 1], [6, 'hard', 2], [8, 'medium', 3], [8, 'hard', 4]] as const) {
      const { puzzle, solution } = makePuzzle(n, level, mulberry32(seed));
      const g = puzzle.slice();
      let used = 0;
      for (let h = nextHint(g, n, solution); h && used < n * n; h = nextHint(g, n, solution)) {
        if (h.kind !== 'move') throw new Error('unexpected mistake');
        g[h.cell] = h.value;
        used++;
      }
      expect(used).toBe(n * n - countClues(puzzle));
      expect(isValidSolution(g, n)).toBe(true);
      expect(g).toEqual(solution);
    }
  }, 120_000);
  it('simple rule deductions are sound: the forced value matches every solution of the grid', () => {
    const rng = mulberry32(606);
    for (let t = 0; t < 400; t++) {
      const n = [4, 6, 8][t % 3];
      const sol = randomSolution(n, rng);
      const g = sol.map((v) => (rng() < 0.45 ? v : 0));
      const d = findDeduction(g, n);
      if (!d) continue;
      expect(g[d.cell]).toBe(0);
      expect(d.value).toBe(sol[d.cell]);
      // And in every solution of the partial grid, not just the one we started from.
      for (const s of solve(g, n, 8).solutions) expect(s[d.cell]).toBe(d.value);
    }
  }, 120_000);
  it('look-ahead deductions are sound too', () => {
    const rng = mulberry32(707);
    for (let t = 0; t < 150; t++) {
      const n = [6, 8][t % 2];
      const sol = randomSolution(n, rng);
      const g = sol.map((v) => (rng() < 0.4 ? v : 0));
      const d = findLookahead(g, n);
      if (!d) continue;
      for (const s of solve(g, n, 8).solutions) expect(s[d.cell]).toBe(d.value);
    }
  }, 120_000);
  it('explain each rule in words with the right symbol names', () => {
    expect(deductionText({ cell: 2, value: 2, rule: 'pair', kind: 'row', index: 0 }, 6)).toBe(
      'Two circles sit side by side in row 1, so a third would break the rule. Row 1, column 3 must be a square.');
    expect(deductionText({ cell: 7, value: 1, rule: 'gap', kind: 'column', index: 1 }, 6)).toBe(
      'A square on each side of a gap in column 2: the gap, row 2, column 2, must be a circle.');
    expect(deductionText({ cell: 4, value: 2, rule: 'count', kind: 'row', index: 0 }, 6)).toBe(
      'Row 1 already holds 3 circles, which is half, so every empty square there is a square. Try row 1, column 5.');
    expect(deductionText({ cell: 0, value: 1, rule: 'reveal', kind: 'row', index: 0 }, 6)).toBe('Row 1, column 1 is a circle.');
    expect(symbolPlural(1)).toBe('circles');
    expect(SYMBOL_NAMES[2]).toBe('square');
  });
  it('a pair, a gap and a count are each found on a hand-made grid', () => {
    const g = emptyGrid(6);
    g[0] = 1; g[1] = 1;
    expect(findDeduction(g, 6)).toMatchObject({ cell: 2, value: 2, rule: 'pair', kind: 'row' });
    const h = emptyGrid(6);
    h[6] = 2; h[8] = 2;
    expect(findDeduction(h, 6)).toMatchObject({ cell: 7, value: 1, rule: 'gap' });
    const c = emptyGrid(6);
    c[12] = 1; c[13] = 2; c[14] = 1; c[17] = 1; // row 3: 1 2 1 _ _ 1 -> three circles already, so the rest are squares
    expect(findDeduction(c, 6)).toMatchObject({ cell: 15, value: 2, rule: 'count', kind: 'row', index: 2 });
  });
});

// ── Saved best times and text ────────────────────────────────────────────────

describe('saved best times', () => {
  it('keys are size and level', () => {
    expect(bestKey(8, 'medium')).toBe('8-medium');
  });
  it('keeps whole positive seconds for known sizes and levels and drops everything else', () => {
    expect(sanitiseBest({ '6-easy': 75, '8-medium': 240, '10-hard': 3600 })).toEqual({ '6-easy': 75, '8-medium': 240, '10-hard': 3600 });
    expect(sanitiseBest({ '6-easy': 75, '7-easy': 3, '6-wild': 3, x: 1 })).toEqual({ '6-easy': 75 });
    expect(sanitiseBest({ '6-easy': 0, '8-easy': -3, '10-easy': 1.5, '6-hard': NaN, '8-hard': Infinity })).toEqual({});
  });
  it('rejects numeric strings, booleans, arrays, null and objects; caps the value', () => {
    expect(sanitiseBest({ '6-easy': '12', '8-easy': true, '10-easy': [12], '6-hard': null, '8-hard': { a: 1 } })).toEqual({});
    expect(sanitiseBest({ '6-easy': MAX_BEST_SECONDS })).toEqual({ '6-easy': MAX_BEST_SECONDS });
    expect(sanitiseBest({ '6-easy': MAX_BEST_SECONDS + 1, '8-easy': 1e300 })).toEqual({});
  });
  it('survives storage that is not an object and ignores prototype keys', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"6-easy": 5}, "constructor": 3, "6-easy": 4}'));
    expect(out).toEqual({ '6-easy': 4 });
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
    expect(plural(1, 'square')).toBe('1 square');
    expect(plural(2, 'square')).toBe('2 squares');
    expect(where(6, 8)).toBe('row 2, column 3');
    expect(placeMessage(6, 8, 1)).toBe('Row 2, column 3: circle.');
    expect(placeMessage(6, 8, 2)).toBe('Row 2, column 3: square.');
    expect(placeMessage(6, 8, 0)).toBe('Row 2, column 3: cleared.');
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
