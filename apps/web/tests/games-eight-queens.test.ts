/**
 * games-eight-queens.test.ts - the engine behind `eight-queens`.
 *
 * Pinned: the solution counts for N = 4 to 12 (2, 10, 4, 40, 92, 352, 724, 2680, 14200) found by the
 * engine and compared with two independent counters (a permutation brute force for N up to 8, and a
 * plain row-by-row search with explicit checks for N up to 10) and, for N = 5 and 6, with every way of
 * choosing N cells; the number of basic solutions (1, 2, 1, 6, 12, 46, 92, 341, 1787) worked out by
 * rotating and reflecting, and the class sizes for N = 8; attacks, conflicts and attacked squares
 * against a model written with sets of diagonals; "solutions still possible" and the hint against a
 * filter over a brute-force list; the sanitisers (junk sizes and junk placements); and the words.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_N, MAX_N, DEFAULT_N, SOLUTION_COUNTS, BASIC_COUNTS, MIN_CELL_PX,
  cleanN, rowOf, colOf, cellName, isCell, mulberry32, attacks, cleanPlacement, conflictCells, conflictPairs, attackCounts, isSolved, safeCells,
  allSolutions, countSolutions, solutionCells, solutionsContaining, solutionsLeft, transformCells, basicKey, hintCell, pickSolution,
  queensText, pairsText, describeToggle, describeSolved, shareText,
} from '../src/components/apps-private/eight-queens/helpers';

// ── Independent oracles ─────────────────────────────────────────────────────

/** Every permutation of 0..n-1 that has no two queens on a diagonal (rows and columns are fine by construction). */
const bruteForcePermutations = (n: number): number[][] => {
  const out: number[][] = [];
  const perm: number[] = [];
  const used = new Array(n).fill(false);
  const rec = (): void => {
    if (perm.length === n) {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(perm[i] - perm[j]) === j - i) return;
      out.push(perm.slice());
      return;
    }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      used[c] = true;
      perm.push(c);
      rec();
      perm.pop();
      used[c] = false;
    }
  };
  rec();
  return out;
};

/** A plain row-by-row search: put a queen in each row and test it against every earlier row with explicit checks. */
const rowSearchCount = (n: number): number => {
  const cols: number[] = [];
  let count = 0;
  const ok = (r: number, c: number): boolean => {
    for (let k = 0; k < r; k++) {
      if (cols[k] === c) return false;
      if (cols[k] - c === k - r || cols[k] - c === r - k) return false;
    }
    return true;
  };
  const rec = (r: number): void => {
    if (r === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (!ok(r, c)) continue;
      cols[r] = c;
      rec(r + 1);
    }
  };
  rec(0);
  return count;
};

/** The conflict model, using sets of row, column, sum and difference values instead of coordinates compared pairwise. */
const modelConflicts = (n: number, queens: number[]): { pairs: number; cells: number[] } => {
  const rows = new Map<number, number[]>();
  const cols = new Map<number, number[]>();
  const sums = new Map<number, number[]>();
  const diffs = new Map<number, number[]>();
  const add = (m: Map<number, number[]>, k: number, q: number) => { m.set(k, [...(m.get(k) ?? []), q]); };
  for (const q of queens) {
    const r = Math.floor(q / n);
    const c = q % n;
    add(rows, r, q); add(cols, c, q); add(sums, r + c, q); add(diffs, r - c, q);
  }
  let pairs = 0;
  const hit = new Set<number>();
  for (const m of [rows, cols, sums, diffs]) {
    for (const group of m.values()) {
      pairs += (group.length * (group.length - 1)) / 2;
      if (group.length > 1) for (const q of group) hit.add(q);
    }
  }
  return { pairs, cells: [...hit].sort((a, b) => a - b) };
};

const randomPlacement = (n: number, k: number, rng: () => number): number[] => {
  const all = Array.from({ length: n * n }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, k).sort((a, b) => a - b);
};

// ── The counts ──────────────────────────────────────────────────────────────

describe('how many solutions each size has', () => {
  const KNOWN: Record<number, number> = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724, 11: 2680, 12: 14200 };
  const KNOWN_BASIC: Record<number, number> = { 4: 1, 5: 2, 6: 1, 7: 6, 8: 12, 9: 46, 10: 92, 11: 341, 12: 1787 };

  it('has the published counts, the table the page shows matches them, and the page range is 4 to 12', () => {
    expect(MIN_N).toBe(4);
    expect(MAX_N).toBe(12);
    expect(DEFAULT_N).toBe(8);
    expect(SOLUTION_COUNTS).toEqual(KNOWN);
    expect(BASIC_COUNTS).toEqual(KNOWN_BASIC);
    for (let n = MIN_N; n <= MAX_N; n++) expect(countSolutions(n), `n=${n}`).toBe(KNOWN[n]);
  }, 60_000);

  it('agrees with a permutation brute force for N = 4 to 8, solution by solution', () => {
    for (let n = 4; n <= 8; n++) {
      const brute = bruteForcePermutations(n).map((p) => p.join(',')).sort();
      const mine = allSolutions(n).map((p) => p.join(',')).sort();
      expect(mine, `n=${n}`).toEqual(brute);
    }
  }, 120_000);

  it('agrees with a plain row-by-row search for N = 4 to 10', () => {
    for (let n = 4; n <= 10; n++) expect(rowSearchCount(n), `n=${n}`).toBe(countSolutions(n));
  }, 120_000);

  it('boards 2 by 2 and 3 by 3 have no solution by the plain search, which is why the page starts at 4 (1 by 1 has one)', () => {
    expect(rowSearchCount(1)).toBe(1);
    expect(rowSearchCount(2)).toBe(0);
    expect(rowSearchCount(3)).toBe(0);
    expect(MIN_N).toBe(4);
  });

  it('agrees with checking every way of choosing N cells for N = 5 and 6 (isSolved on each set)', () => {
    for (const n of [5, 6]) {
      let solved = 0;
      let seen = 0;
      const pick: number[] = [];
      const rec = (from: number): void => {
        if (pick.length === n) { seen++; if (isSolved(n, pick)) solved++; return; }
        for (let c = from; c < n * n; c++) { pick.push(c); rec(c + 1); pick.pop(); }
      };
      rec(0);
      expect(solved, `n=${n}`).toBe(KNOWN[n]);
      expect(seen).toBe(n === 5 ? 53130 : 1947792);
    }
  }, 180_000);

  it('lists solutions in dictionary order, each a column for every row, with no repeats, and nothing for sizes outside 4 to 12 (3 and 2 have none)', () => {
    for (let n = 4; n <= 9; n++) {
      const list = allSolutions(n);
      for (let i = 1; i < list.length; i++) {
        let cmp = 0;
        for (let k = 0; k < n && cmp === 0; k++) cmp = list[i - 1][k] - list[i][k];
        expect(cmp).toBeLessThan(0);
      }
      for (const sol of list) { expect(sol).toHaveLength(n); expect(new Set(sol).size).toBe(n); }
    }
    expect(allSolutions(3)).toEqual([]);
    expect(allSolutions(2)).toEqual([]);
    expect(allSolutions(13)).toEqual([]);
    expect(allSolutions(NaN)).toEqual([]);
    expect(allSolutions(8.5)).toEqual([]);
    expect(allSolutions(4)).toEqual([[1, 3, 0, 2], [2, 0, 3, 1]]);
  });

  it('every solution passes isSolved and has no attacking pair, for every size', () => {
    for (let n = 4; n <= 10; n++) {
      for (const sol of allSolutions(n)) {
        const cells = solutionCells(n, sol);
        expect(isSolved(n, cells)).toBe(true);
        expect(modelConflicts(n, cells).pairs).toBe(0);
      }
    }
  }, 60_000);

  it('moving any one queen of a solution to a cell it can reach breaks it or gives a different solution, never a false "solved"', () => {
    const rng = mulberry32(5);
    const n = 8;
    const sols = new Set(allSolutions(n).map((s) => solutionCells(n, s).join(',')));
    for (let t = 0; t < 400; t++) {
      const sol = allSolutions(n)[Math.floor(rng() * 92)];
      const cells = solutionCells(n, sol);
      const k = Math.floor(rng() * n);
      const to = Math.floor(rng() * n * n);
      if (cells.includes(to)) continue;
      const moved = cells.slice(); moved[k] = to; moved.sort((a, b) => a - b);
      expect(isSolved(n, moved)).toBe(sols.has(moved.join(',')));
    }
  });
});

describe('basic solutions (rotations and reflections treated as one)', () => {
  it('finds 1, 2, 1, 6, 12, 46, 92, 341, 1787 different boards for N = 4 to 12', () => {
    const expected = [1, 2, 1, 6, 12, 46, 92, 341, 1787];
    for (let n = 4; n <= 12; n++) {
      const classes = new Set(allSolutions(n).map((s) => basicKey(n, solutionCells(n, s))));
      expect(classes.size, `n=${n}`).toBe(expected[n - 4]);
      expect(BASIC_COUNTS[n]).toBe(expected[n - 4]);
    }
  }, 120_000);

  it('for 8 queens, 11 of the 12 families have 8 boards and one has 4 (it looks the same turned half a circle)', () => {
    const sizes = new Map<string, number>();
    for (const s of allSolutions(8)) {
      const k = basicKey(8, solutionCells(8, s));
      sizes.set(k, (sizes.get(k) ?? 0) + 1);
    }
    const bySize: Record<number, number> = {};
    for (const v of sizes.values()) bySize[v] = (bySize[v] ?? 0) + 1;
    expect(bySize).toEqual({ 8: 11, 4: 1 });
  });

  it('every one of the eight turns of a solution is a solution, and the key is the same for all of them', () => {
    for (const n of [5, 6, 7, 8]) {
      const sols = new Set(allSolutions(n).map((s) => solutionCells(n, s).join(',')));
      for (const s of allSolutions(n)) {
        const cells = solutionCells(n, s);
        const key = basicKey(n, cells);
        for (let t = 0; t < 8; t++) {
          const turned = transformCells(n, cells, t);
          expect(sols.has(turned.join(','))).toBe(true);
          expect(basicKey(n, turned)).toBe(key);
        }
      }
    }
  });

  it('transform 0 is the identity, four quarter-turns bring a board home, and different boards get different keys', () => {
    const cells = [1, 7, 10, 14];
    expect(transformCells(4, cells, 0)).toEqual(cells);
    let c = cells;
    for (let i = 0; i < 4; i++) c = transformCells(4, c, 3);
    expect(c).toEqual(cells);
    expect(basicKey(4, [0, 1])).not.toBe(basicKey(4, [0, 5]));
  });
});

// ── Attacks, conflicts, attacked squares ────────────────────────────────────

describe('attacks and conflicts', () => {
  it('attacks along a row, a column and both diagonals, not for a knight move, not for itself', () => {
    const n = 8;
    expect(attacks(n, 0, 7)).toBe(true); // row
    expect(attacks(n, 3, 59)).toBe(true); // column
    expect(attacks(n, 0, 63)).toBe(true); // main diagonal
    expect(attacks(n, 7, 56)).toBe(true); // other diagonal
    expect(attacks(n, 0, 17)).toBe(false); // a knight move
    expect(attacks(n, 9, 9)).toBe(false);
    expect(attacks(n, 0, 8 * 2 + 3)).toBe(false);
  });

  it('matches the model in 3000 random placements, for the pair count, the cells in conflict and the attack counts', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 3000; t++) {
      const n = MIN_N + Math.floor(rng() * 9);
      const k = Math.floor(rng() * (n + 1));
      const q = randomPlacement(n, k, rng);
      const m = modelConflicts(n, q);
      expect(conflictPairs(n, q)).toBe(m.pairs);
      expect(conflictCells(n, q).sort((a, b) => a - b)).toEqual(m.cells);
      const counts = attackCounts(n, q);
      for (let i = 0; i < n * n; i++) {
        let expected = 0;
        for (const x of q) if (x !== i && modelConflicts(n, [x, i]).pairs > 0) expected++;
        expect(counts[i]).toBe(expected);
      }
    }
  }, 120_000);

  it('safeCells lists exactly the empty cells that no queen attacks', () => {
    const rng = mulberry32(7);
    for (let t = 0; t < 400; t++) {
      const n = MIN_N + Math.floor(rng() * 9);
      const q = randomPlacement(n, Math.floor(rng() * 5), rng);
      const expected: number[] = [];
      for (let i = 0; i < n * n; i++) if (!q.includes(i) && modelConflicts(n, [...q, i]).pairs === modelConflicts(n, q).pairs) expected.push(i);
      expect(safeCells(n, q)).toEqual(expected);
    }
    expect(safeCells(4, [])).toHaveLength(16);
    expect(safeCells(4, [0])).toEqual([6, 7, 9, 11, 13, 14]);
  });

  it('isSolved needs exactly N queens and no attack', () => {
    expect(isSolved(4, [1, 7, 8, 14])).toBe(true);
    expect(isSolved(4, [1, 7, 8])).toBe(false);
    expect(isSolved(4, [])).toBe(false);
    expect(isSolved(4, [0, 1, 2, 3])).toBe(false);
    expect(isSolved(5, [0, 7, 14, 16, 23].slice(0, 5))).toBe(conflictPairs(5, [0, 7, 14, 16, 23]) === 0);
  });
});

// ── Hints and what is left ──────────────────────────────────────────────────

describe('solutions still possible, hints and shown solutions', () => {
  it('solutionsLeft equals a filter over the brute-force list for random placements of 0 to 4 queens', () => {
    const rng = mulberry32(31);
    for (let t = 0; t < 400; t++) {
      const n = 5 + Math.floor(rng() * 4); // 5 to 8
      const q = randomPlacement(n, Math.floor(rng() * 5), rng);
      const brute = bruteForcePermutations(n).filter((p) => q.every((c) => p[Math.floor(c / n)] === c % n)).length;
      expect(solutionsLeft(n, q), `n=${n} q=${q}`).toBe(brute);
      expect(solutionsContaining(n, q)).toHaveLength(brute);
    }
  }, 120_000);

  it('with no queens every solution is still possible; a corner queen on 8x8 leaves 4 of the 92', () => {
    for (let n = 4; n <= 10; n++) expect(solutionsLeft(n, [])).toBe(SOLUTION_COUNTS[n]);
    expect(solutionsLeft(8, [0])).toBe(4);
    expect(solutionsLeft(8, [0, 1])).toBe(0);
    expect(solutionsLeft(3, [0])).toBe(0);
  });

  it('a hint is a free cell that keeps at least one solution possible, and placing hints one by one finishes the board', () => {
    const rng = mulberry32(12);
    for (let t = 0; t < 60; t++) {
      const n = 4 + Math.floor(rng() * 7); // 4 to 10
      let q: number[] = [];
      // Start from a few random queens that can still be completed.
      const start = randomPlacement(n, Math.floor(rng() * 3), rng);
      if (solutionsLeft(n, start) > 0 && conflictPairs(n, start) === 0) q = start;
      let guard = 0;
      while (q.length < n && guard++ < 20) {
        const h = hintCell(n, q);
        expect(h).not.toBeNull();
        expect(q.includes(h as number)).toBe(false);
        q = [...q, h as number].sort((a, b) => a - b);
        expect(solutionsLeft(n, q)).toBeGreaterThan(0);
      }
      expect(isSolved(n, q), `n=${n}`).toBe(true);
    }
  }, 120_000);

  it('gives no hint when the queens attack each other, when no solution contains them, or when the board is already complete', () => {
    expect(hintCell(8, [0, 1])).toBeNull(); // attack
    expect(hintCell(8, [0, 10])).toBeNull(); // attack on the diagonal
    expect(conflictPairs(6, [0, 9])).toBe(0);
    expect(solutionsLeft(6, [0, 9])).toBe(0);
    expect(hintCell(6, [0, 9])).toBeNull(); // no attack but no solution
    expect(hintCell(4, [1, 7, 8, 14])).toBeNull(); // complete
    expect(hintCell(3, [])).toBeNull();
  });

  it('pickSolution returns a solution that keeps the queens when it can, any solution otherwise, and is repeatable for a seed', () => {
    const n = 8;
    const a = pickSolution(n, [], mulberry32(4));
    expect(a.keeps).toBe(true);
    expect(isSolved(n, a.cells)).toBe(true);
    expect(pickSolution(n, [], mulberry32(4))).toEqual(a);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(pickSolution(n, [], mulberry32(i)).cells.join(','));
    expect(seen.size).toBeGreaterThan(10);
    const mine = pickSolution(n, [0], mulberry32(3));
    expect(mine.keeps).toBe(true);
    expect(mine.cells).toContain(0);
    expect(isSolved(n, mine.cells)).toBe(true);
    const other = pickSolution(n, [0, 1], mulberry32(3));
    expect(other.keeps).toBe(false);
    expect(isSolved(n, other.cells)).toBe(true);
    for (const r of [0, 0.999999999, 0.5]) expect(isSolved(n, pickSolution(n, [], () => r).cells)).toBe(true);
  });
});

// ── Input cleaning and words ────────────────────────────────────────────────

describe('input cleaning', () => {
  it('cleanN accepts whole numbers 4 to 12 (as numbers or short digit strings) and falls back for anything else', () => {
    for (let n = 4; n <= 12; n++) { expect(cleanN(n)).toBe(n); expect(cleanN(String(n))).toBe(n); }
    for (const junk of [3, 13, 0, -4, 8.5, NaN, Infinity, '', ' 8', '8.0', '08x', '1e1', '99999', '__proto__', 'constructor', null, undefined, true, [], {}, [8], '-8']) {
      expect(cleanN(junk), String(junk)).toBe(8);
    }
    expect(cleanN('x', 6)).toBe(6);
    expect(cleanN('007')).toBe(8); // three digits is not a size
    expect(cleanN('07')).toBe(7);
  });

  it('cleanPlacement keeps distinct on-board cells in order and drops everything else, never more than N', () => {
    expect(cleanPlacement(8, [9, 3, 3, 63, 64, -1, 2.5, NaN, '5', null, undefined, {}])).toEqual([3, 9, 63]);
    expect(cleanPlacement(8, 'x')).toEqual([]);
    expect(cleanPlacement(8, null)).toEqual([]);
    expect(cleanPlacement(8, { 0: 1, length: 1 })).toEqual([]);
    expect(cleanPlacement(4, Array.from({ length: 16 }, (_, i) => i))).toHaveLength(4);
    expect(isCell(4, 15)).toBe(true);
    expect(isCell(4, 16)).toBe(false);
    expect(isCell(4, '3')).toBe(false);
  });

  it('names cells with 1-based row and column', () => {
    expect(cellName(8, 0)).toBe('row 1, column 1');
    expect(cellName(8, 63)).toBe('row 8, column 8');
    expect(cellName(12, 25)).toBe('row 3, column 2');
    expect(rowOf(8, 63)).toBe(7);
    expect(colOf(8, 63)).toBe(7);
  });
});

describe('words', () => {
  it('pluralises and describes', () => {
    expect(queensText(1)).toBe('1 queen');
    expect(queensText(0)).toBe('0 queens');
    expect(queensText(8)).toBe('8 queens');
    expect(pairsText(1)).toBe('1 pair');
    expect(pairsText(3)).toBe('3 pairs');
    expect(describeToggle(8, 0, true, [0])).toBe('Queen placed on row 1, column 1. 1 queen of 8. No queens attack each other.');
    expect(describeToggle(8, 1, true, [0, 1])).toBe('Queen placed on row 1, column 2. 2 queens of 8. 1 pair attack each other.');
    expect(describeToggle(8, 1, false, [0])).toBe('Queen taken off row 1, column 2. 1 queen of 8. No queens attack each other.');
    expect(describeSolved(8, true, 3)).toBe('Solved: 8 queens and none attack another. A new basic solution, 3 of 12 found.');
    expect(describeSolved(8, false, 3)).toBe('Solved: 8 queens and none attack another. You had already found this basic solution, 3 of 12 found.');
    expect(shareText(8, [], false, false)).toBe('Eight Queens 8x8 - 0 queens placed, not solved yet');
    expect(shareText(8, [1], false, true)).toBe('Eight Queens 8x8 - 1 queen placed, not solved yet');
    expect(shareText(8, [], true, false)).toBe('Eight Queens 8x8 - solved');
    expect(shareText(8, [], true, true)).toBe('Eight Queens 8x8 - solved with a hint');
  });
  it('states the smallest cell the page allows', () => {
    expect(MIN_CELL_PX).toBe(28);
  });
});

describe('seeded randomness', () => {
  it('is repeatable and stays in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 100; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});
