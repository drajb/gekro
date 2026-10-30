/**
 * games-sudoku.test.ts - the engine behind `sudoku`.
 *
 * Pinned: a published puzzle solves to its published answer, a puzzle with two
 * answers is detected as such, every generated puzzle has exactly one solution
 * and consistent givens, the daily seed is stable, and hints are always right.
 */
import { describe, it, expect } from 'vitest';
import {
  parseGrid, gridToString, solve, conflicts, isSolved, makePuzzle, dailySeed, hashString, mulberry32, shuffled,
  candidates, digitsOf, nextHint, countGivens, formatTime, TARGET_GIVENS, PEERS, UNITS, randomSolved,
  peersWithNote, sanitiseBest, localIsoDate, MAX_BEST_SECONDS,
} from '../src/components/apps-private/sudoku/helpers';

const WIKI = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const WIKI_SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('geometry', () => {
  it('every cell has 20 peers and there are 27 units of 9', () => {
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
    expect(UNITS).toHaveLength(27);
    expect(UNITS.every((u) => new Set(u).size === 9)).toBe(true);
  });
});

describe('solver', () => {
  it('solves the well-known published puzzle to its published answer', () => {
    const r = solve(parseGrid(WIKI), 2);
    expect(r.count).toBe(1);
    expect(gridToString(r.solution!).replace(/\./g, '0')).toBe(WIKI_SOLVED);
  });
  it('reports two solutions for an under-determined puzzle', () => {
    const r = solve(parseGrid('0'.repeat(81)), 2);
    expect(r.count).toBe(2);
  });
  it('finds no solution when the givens already conflict', () => {
    const g = parseGrid(WIKI);
    g[2] = 5; // another 5 in row 1
    expect(solve(g, 1).count).toBe(0);
  });
  it('finds no solution for a grid that is consistent but unsolvable', () => {
    const g = parseGrid('0'.repeat(81));
    for (let c = 0; c < 8; c++) g[c] = c + 1; // row 1 holds 1..8, so its last cell needs 9
    g[17] = 9; // but 9 already sits in that cell's column... via row 2, col 9 sharing the box
    expect(solve(g, 1).count).toBe(0);
  });
});

describe('conflicts and completion', () => {
  it('flags duplicates in a row, column and box', () => {
    const g = parseGrid('0'.repeat(81));
    g[0] = 5; g[8] = 5; // same row
    g[9] = 7; g[72] = 7; // same column
    g[30] = 2; g[40] = 2; // same box
    expect([...conflicts(g)].sort((a, b) => a - b)).toEqual([0, 8, 9, 30, 40, 72].sort((a, b) => a - b));
  });
  it('recognises a solved grid and rejects an incomplete one', () => {
    expect(isSolved(parseGrid(WIKI_SOLVED))).toBe(true);
    expect(isSolved(parseGrid(WIKI))).toBe(false);
  });
});

describe('candidates', () => {
  it('lists exactly the digits not used by peers', () => {
    const g = parseGrid(WIKI);
    // Cell r1c3 in the published puzzle has three candidates, 1, 2 and 4 (the published answer is 4).
    expect(digitsOf(candidates(g, 2))).toEqual([1, 2, 4]);
    expect(candidates(g, 0)).toBe(0); // a given has no candidates
  });
});

describe('generator', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = makePuzzle(12345, 'medium');
    const b = makePuzzle(12345, 'medium');
    const c = makePuzzle(54321, 'medium');
    expect(gridToString(a.puzzle)).toBe(gridToString(b.puzzle));
    expect(gridToString(a.puzzle)).not.toBe(gridToString(c.puzzle));
  });
  for (const d of ['easy', 'medium', 'hard'] as const) {
    it(`${d}: unique solution, givens agree with it, clue count near target`, () => {
      for (const seed of [1, 2, 3, 20261022]) {
        const p = makePuzzle(seed, d);
        expect(solve(p.puzzle, 2).count, `${d} ${seed}`).toBe(1);
        expect(gridToString(solve(p.puzzle, 1).solution!)).toBe(gridToString(p.solution));
        expect(isSolved(p.solution)).toBe(true);
        p.puzzle.forEach((v, i) => { if (v) expect(v).toBe(p.solution[i]); });
        expect(p.givens).toBe(countGivens(p.puzzle));
        expect(p.givens).toBeGreaterThanOrEqual(TARGET_GIVENS[d] - 1); // pair removal can overshoot by one
        expect(p.givens).toBeLessThanOrEqual(TARGET_GIVENS[d] + 8);
      }
    });
  }
  it('uses 180-degree symmetry for the given cells', () => {
    const p = makePuzzle(777, 'medium');
    for (let i = 0; i < 81; i++) expect(!!p.puzzle[i]).toBe(!!p.puzzle[80 - i]);
  });
  it('hard puzzles generate quickly enough to run on the main thread', () => {
    const t = performance.now();
    makePuzzle(99, 'hard');
    expect(performance.now() - t).toBeLessThan(4000);
  });
  it('randomSolved always returns a valid full grid', () => {
    for (let s = 1; s <= 5; s++) expect(isSolved(randomSolved(mulberry32(s)))).toBe(true);
  });
});

describe('daily seed', () => {
  it('is stable for a date and difficulty and differs otherwise', () => {
    expect(dailySeed('2026-10-22', 'hard')).toBe(dailySeed('2026-10-22', 'hard'));
    expect(dailySeed('2026-10-22', 'hard')).not.toBe(dailySeed('2026-10-23', 'hard'));
    expect(dailySeed('2026-10-22', 'hard')).not.toBe(dailySeed('2026-10-22', 'easy'));
  });
  it('hashes to an unsigned 32-bit integer', () => {
    const h = hashString('sudoku');
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
  });
});

describe('shuffle', () => {
  it('is a permutation and does not mutate its input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = shuffled(src, mulberry32(3));
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('hints', () => {
  it('always suggests a digit that agrees with the solution', () => {
    for (const seed of [11, 12, 13]) {
      const p = makePuzzle(seed, 'hard');
      const g = p.puzzle.slice();
      let guard = 0;
      while (guard++ < 90) {
        const h = nextHint(g, p.solution);
        if (!h) break;
        expect(h.digit, `${h.technique} @${h.cell}`).toBe(p.solution[h.cell]);
        expect(h.reason.length).toBeGreaterThan(10);
        g[h.cell] = h.digit;
      }
      expect(isSolved(g)).toBe(true);
    }
  });
  it('returns null once the grid is full', () => {
    expect(nextHint(parseGrid(WIKI_SOLVED), parseGrid(WIKI_SOLVED))).toBeNull();
  });
  it('names a naked single on the published puzzle', () => {
    const h = nextHint(parseGrid(WIKI), parseGrid(WIKI_SOLVED))!;
    expect(h.technique === 'naked single' || h.technique === 'hidden single').toBe(true);
  });
});

describe('pencil notes follow a placed digit', () => {
  it('peersWithNote lists exactly the peers that carry the digit in their notes', () => {
    const notes = new Array(81).fill(0);
    notes[1] |= 1 << 5; // same row as cell 0
    notes[9] |= 1 << 5; // same column
    notes[10] |= 1 << 5; // same box
    notes[4] |= 1 << 5; // same row, different box
    notes[40] |= 1 << 5; // not a peer of cell 0
    notes[0] |= 1 << 5; // the cell itself is never its own peer
    notes[2] |= 1 << 6; // a peer but a different digit
    expect(peersWithNote(notes, 0, 5)).toEqual([1, 4, 9, 10]);
    expect(peersWithNote(notes, 0, 6)).toEqual([2]);
    expect(peersWithNote(notes, 0, 7)).toEqual([]);
  });
  it('clearing those peers after a hint leaves no note for the hinted digit in its row, column or box', () => {
    const p = makePuzzle(31, 'hard');
    const g = p.puzzle.slice();
    const notes = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) if (!g[i]) notes[i] = digitsOf(candidates(g, i)).reduce((m, d) => m | (1 << d), 0);
    const h = nextHint(g, p.solution)!;
    g[h.cell] = h.digit;
    notes[h.cell] = 0;
    for (const q of peersWithNote(notes, h.cell, h.digit)) notes[q] &= ~(1 << h.digit);
    for (const q of PEERS[h.cell]) expect(notes[q] & (1 << h.digit), `peer ${q}`).toBe(0);
  });
});

describe('saved best times', () => {
  it('keeps whole positive seconds for the three levels and drops everything else', () => {
    expect(sanitiseBest({ easy: 95, medium: 400, hard: 1200 })).toEqual({ easy: 95, medium: 400, hard: 1200 });
    expect(sanitiseBest({ easy: '95', extra: 5 })).toEqual({ easy: 95 });
    expect(sanitiseBest({ easy: 0, medium: -3, hard: 1.5 })).toEqual({});
    expect(sanitiseBest({ easy: NaN, medium: Infinity, hard: 1e300 })).toEqual({});
    expect(sanitiseBest({ easy: MAX_BEST_SECONDS })).toEqual({ easy: MAX_BEST_SECONDS });
    expect(sanitiseBest({ easy: MAX_BEST_SECONDS + 1 })).toEqual({});
  });
  it('survives storage that is not an object', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
  });
});

describe('local date', () => {
  it('formats a date as YYYY-MM-DD from its local parts, padded', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localIsoDate(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
    expect(localIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('time formatting', () => {
  it('formats minutes and seconds and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
