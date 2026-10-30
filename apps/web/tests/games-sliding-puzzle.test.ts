/**
 * games-sliding-puzzle.test.ts - the engine behind `sliding-puzzle`.
 *
 * Pinned: move legality and whole-run slides, the inversion-parity rule (proved
 * by exhaustive search on 3x3 and 2x2), that every shuffle is solvable and never
 * already solved, that the 3x3 hint is always the first step of a shortest
 * solution, and the arithmetic quoted on the content page.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, solvedBoard, isSolved, gapIndex, tilesHome, mulberry32, gapNeighbours, runLength, canMove, applyMove, arrowTarget,
  inversions, isSolvable, shuffle, distancesFromSolved, optimalLength3, hint3, formatTime, rowOf, colOf,
  sanitiseBest, plural, slideMessage, MAX_BEST_MOVES, MAX_BEST_SECONDS,
  type Board,
} from '../src/components/apps-private/sliding-puzzle/helpers';

const key = (b: Board): string => b.join(',');

/** Every ordering of 0..len-1 (Heap's algorithm). */
const permutations = (len: number, visit: (p: number[]) => void): void => {
  const a = Array.from({ length: len }, (_, i) => i);
  const c = new Array(len).fill(0);
  visit(a);
  let i = 0;
  while (i < len) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [a[j], a[i]] = [a[i], a[j]];
      visit(a);
      c[i]++;
      i = 0;
    } else { c[i] = 0; i++; }
  }
};

const factorial = (k: number): bigint => (k <= 1 ? 1n : BigInt(k) * factorial(k - 1));

describe('solved board', () => {
  it('lists 1..n*n-1 in order with the gap last, for every size', () => {
    expect(solvedBoard(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect([...SIZES]).toEqual([3, 4, 5]);
    for (const n of SIZES) {
      const b = solvedBoard(n);
      expect(b).toHaveLength(n * n);
      expect(b.filter((v) => v !== 0)).toHaveLength(n * n - 1); // 8, 15 and 24 tiles
      expect(isSolved(b)).toBe(true);
      expect(gapIndex(b)).toBe(n * n - 1);
      expect(tilesHome(b)).toBe(n * n - 1);
      expect(inversions(b)).toBe(0);
    }
  });
  it('rejects boards that are close but not solved', () => {
    expect(isSolved([1, 2, 3, 4, 5, 6, 7, 0, 8])).toBe(false);
    expect(isSolved([0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(false);
    expect(isSolved([1, 2, 3, 4, 5, 6, 8, 7, 0])).toBe(false);
  });
  it('counts tiles on their home cell and ignores the gap', () => {
    expect(tilesHome([1, 2, 3, 4, 5, 6, 7, 0, 8])).toBe(7);
    expect(tilesHome([0, 2, 3, 4, 5, 6, 7, 8, 1])).toBe(7); // tiles 2 to 8 are home; 1 is not
    expect(tilesHome([2, 1, 3, 4, 5, 6, 7, 8, 0])).toBe(6);
  });
  it('maps indices to rows and columns', () => {
    expect([rowOf(7, 3), colOf(7, 3)]).toEqual([2, 1]);
    expect([rowOf(0, 5), colOf(24, 5)]).toEqual([0, 4]);
  });
});

describe('gap neighbours', () => {
  it('has 2 in a corner, 3 on an edge and 4 in the middle', () => {
    expect(gapNeighbours(solvedBoard(3), 3).sort()).toEqual([5, 7]); // bottom-right corner
    expect(gapNeighbours([1, 0, 2, 3, 4, 5, 6, 7, 8], 3).sort()).toEqual([0, 2, 4]); // top edge
    expect(gapNeighbours([1, 2, 3, 4, 0, 5, 6, 7, 8], 3).sort()).toEqual([1, 3, 5, 7]); // centre
  });
});

describe('legal moves', () => {
  const b: Board = [1, 2, 3, 4, 5, 6, 7, 0, 8]; // gap at index 7 (row 3, col 2)
  it('slides a tile that touches the gap, and only that tile', () => {
    expect(applyMove(b, 3, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(applyMove(b, 3, 6)).toEqual([1, 2, 3, 4, 5, 6, 0, 7, 8]);
    expect(applyMove(b, 3, 4)).toEqual([1, 2, 3, 4, 0, 6, 7, 5, 8]);
    expect(runLength(b, 3, 8)).toBe(1);
  });
  it('refuses the gap itself, diagonals, out-of-range and non-integer indices', () => {
    expect(applyMove(b, 3, 7)).toBeNull(); // the gap
    expect(applyMove(b, 3, 3)).toBeNull(); // not in line
    expect(applyMove(b, 3, 5)).toBeNull(); // diagonal
    expect(applyMove(b, 3, -1)).toBeNull();
    expect(applyMove(b, 3, 9)).toBeNull();
    expect(applyMove(b, 3, 1.5)).toBeNull();
    expect(applyMove(b, 3, NaN)).toBeNull();
    expect(canMove(b, 3, 5)).toBe(false);
    expect(canMove(b, 3, 8)).toBe(true);
  });
  it('slides the whole run when a tile is in line with the gap (row)', () => {
    const r: Board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(runLength(r, 3, 2)).toBe(2);
    expect(applyMove(r, 3, 2)).toEqual([1, 2, 0, 3, 4, 5, 6, 7, 8]);
    expect(applyMove(r, 3, 1)).toEqual([1, 0, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('slides the whole run when a tile is in line with the gap (column)', () => {
    const r: Board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(runLength(r, 3, 6)).toBe(2);
    expect(applyMove(r, 3, 6)).toEqual([3, 1, 2, 6, 4, 5, 0, 7, 8]);
  });
  it('slides a run towards a gap that sits at the far end', () => {
    // Gap at 15 (bottom-right). Choosing index 12 (same row) slides tiles 13, 14, 15 one step right.
    expect(applyMove(solvedBoard(4), 4, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15]);
    expect(runLength(solvedBoard(4), 4, 12)).toBe(3);
    // Choosing index 3 (same column) slides tiles 4, 8, 12 down one cell.
    expect(applyMove(solvedBoard(4), 4, 3)).toEqual([1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8, 13, 14, 15, 12]);
    expect(runLength(solvedBoard(4), 4, 3)).toBe(3);
  });
  it('always keeps a valid permutation, never mutates its input, and is reversible', () => {
    const rng = mulberry32(5);
    for (const n of SIZES) {
      let cur = shuffle(n, rng);
      for (let step = 0; step < 300; step++) {
        const idx = Math.floor(rng() * n * n);
        const gap = gapIndex(cur);
        const before = cur.slice();
        const next = applyMove(cur, n, idx);
        expect(cur).toEqual(before);
        if (next === null) { expect(canMove(cur, n, idx)).toBe(false); continue; }
        expect([...next].sort((x, y) => x - y)).toEqual(Array.from({ length: n * n }, (_, i) => i));
        expect(gapIndex(next)).toBe(idx);
        // Choosing the old gap cell slides the same run back.
        expect(applyMove(next, n, gap)).toEqual(cur);
        cur = next;
      }
    }
  });
  it('moves exactly runLength tiles', () => {
    const rng = mulberry32(9);
    for (const n of SIZES) {
      const cur = shuffle(n, rng);
      for (let idx = 0; idx < n * n; idx++) {
        const next = applyMove(cur, n, idx);
        if (!next) continue;
        const changed = cur.reduce((k, v, i) => (v !== next[i] ? k + 1 : k), 0);
        expect(changed).toBe(runLength(cur, n, idx) + 1); // the moved tiles plus the cell the gap leaves
      }
    }
  });
});

describe('arrow keys', () => {
  it('pick the tile that travels in the arrow direction', () => {
    const mid: Board = [1, 2, 3, 4, 0, 5, 6, 7, 8]; // gap at 4
    expect(arrowTarget(mid, 3, 'left')).toBe(5); // tile right of the gap slides left
    expect(arrowTarget(mid, 3, 'right')).toBe(3);
    expect(arrowTarget(mid, 3, 'up')).toBe(7);
    expect(arrowTarget(mid, 3, 'down')).toBe(1);
  });
  it('return null where there is no tile on that side of the gap', () => {
    const solved = solvedBoard(3); // gap in the bottom-right corner
    expect(arrowTarget(solved, 3, 'left')).toBeNull();
    expect(arrowTarget(solved, 3, 'up')).toBeNull();
    expect(arrowTarget(solved, 3, 'right')).toBe(7);
    expect(arrowTarget(solved, 3, 'down')).toBe(5);
    const corner: Board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(arrowTarget(corner, 3, 'right')).toBeNull();
    expect(arrowTarget(corner, 3, 'down')).toBeNull();
  });
  it('always give a legal move that lands the gap where the tile was', () => {
    const b = shuffle(4, mulberry32(21));
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      const idx = arrowTarget(b, 4, dir);
      if (idx === null) continue;
      expect(canMove(b, 4, idx)).toBe(true);
      expect(runLength(b, 4, idx)).toBe(1);
    }
  });
});

describe('inversion parity', () => {
  it('counts inversions and skips the gap', () => {
    expect(inversions([1, 2, 3, 4, 5, 6, 8, 7, 0])).toBe(1);
    expect(inversions([0, 3, 2, 1, 4, 5, 6, 7, 8])).toBe(3);
    expect(inversions([8, 7, 6, 5, 4, 3, 2, 1, 0])).toBe(28);
  });
  it('flags the classic swapped-14-15 board as unsolvable', () => {
    const b = solvedBoard(4);
    [b[13], b[14]] = [b[14], b[13]];
    expect(isSolvable(b, 4)).toBe(false);
    expect(isSolvable(solvedBoard(4), 4)).toBe(true);
  });
  it('flips with every swap of two tiles, for every size', () => {
    const rng = mulberry32(31);
    for (const n of SIZES) {
      const b = shuffle(n, rng);
      for (let k = 0; k < 40; k++) {
        const tiles = b.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        const x = tiles[Math.floor(rng() * tiles.length)];
        const y = tiles[Math.floor(rng() * tiles.length)];
        if (x === y) continue;
        const before = isSolvable(b, n);
        [b[x], b[y]] = [b[y], b[x]];
        expect(isSolvable(b, n)).toBe(!before);
      }
    }
  });
  it('is unchanged by every legal move (the invariant behind the whole rule), on 3x3, 4x4 and 5x5', () => {
    const rng = mulberry32(77);
    for (const n of SIZES) {
      let cur = solvedBoard(n);
      for (let step = 0; step < 2000; step++) {
        const opts = gapNeighbours(cur, n);
        cur = applyMove(cur, n, opts[Math.floor(rng() * opts.length)]) as Board;
        expect(isSolvable(cur, n)).toBe(true);
      }
    }
  });
});

describe('exhaustive proof on 2x2 (even width)', () => {
  it('reaches exactly 12 of the 24 arrangements, and the parity rule picks the same 12', () => {
    const reach = distancesFromSolved(2);
    expect(reach.size).toBe(12);
    let solvable = 0;
    let total = 0;
    let agree = true;
    const seen = new Set<string>();
    permutations(4, (p) => {
      total++;
      const ok = isSolvable(p, 2);
      if (ok) solvable++;
      seen.add(key(p));
      if (reachable2(p, reach) !== ok) agree = false;
    });
    expect(total).toBe(24);
    expect(seen.size).toBe(24);
    expect(solvable).toBe(12);
    expect(agree).toBe(true);
  });
});

/** 2x2 encoding is base 4, as used by distancesFromSolved. */
const reachable2 = (b: Board, reach: Map<number, number>): boolean => reach.has(b.reduce((acc, v) => acc * b.length + v, 0));

describe('exhaustive proof on 3x3 (odd width)', () => {
  const reach = distancesFromSolved(3);
  const enc = (b: Board): number => b.reduce((acc, v) => acc * 9 + v, 0);

  it('breadth-first search from solved reaches exactly 181,440 boards', () => {
    expect(reach.size).toBe(181440);
  });
  it('181,440 is exactly half of the 362,880 arrangements, and the parity rule agrees on every single one', () => {
    let total = 0;
    let reachable = 0;
    let solvable = 0;
    let mismatches = 0;
    permutations(9, (p) => {
      total++;
      const isReach = reach.has(enc(p));
      const ok = isSolvable(p, 3);
      if (isReach) reachable++;
      if (ok) solvable++;
      if (isReach !== ok) mismatches++;
    });
    expect(total).toBe(362880);
    expect(total).toBe(Number(factorial(9)));
    expect(reachable).toBe(181440);
    expect(solvable).toBe(181440);
    expect(reachable * 2).toBe(total);
    expect(mismatches).toBe(0);
  });
  it('the hardest 3x3 boards need 31 slides, and only 2 boards need that many', () => {
    let max = 0;
    let atMax = 0;
    for (const d of reach.values()) {
      if (d > max) { max = d; atMax = 1; } else if (d === max) atMax++;
    }
    expect(max).toBe(31);
    expect(atMax).toBe(2);
  });
  it('every shuffle on 3x3 lands inside the reachable set', () => {
    for (let s = 1; s <= 300; s++) expect(reach.has(enc(shuffle(3, mulberry32(s))))).toBe(true);
  });
  it('builds the table fast enough to run on the main thread (the hint is computed on first use)', () => {
    const t = performance.now();
    distancesFromSolved(3);
    expect(performance.now() - t).toBeLessThan(3000);
  });
  it('is refused for frames it cannot enumerate', () => {
    expect(() => distancesFromSolved(4)).toThrow(RangeError);
    expect(() => distancesFromSolved(1)).toThrow(RangeError);
  });
});

describe('what the content page quotes', () => {
  it('half of all arrangements, per size', () => {
    expect(factorial(9) / 2n).toBe(181440n);
    expect(factorial(16)).toBe(20922789888000n);
    expect(factorial(16) / 2n).toBe(10461394944000n); // 4x4: about 10.5 trillion reachable
    expect(factorial(25) / 2n).toBe(7755605021665492992000000n); // 5x5: about 7.8 x 10^24 reachable
  });
});

describe('shuffle', () => {
  it('is a valid permutation, solvable and never solved, for many seeds and sizes', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      for (let s = 1; s <= 400; s++) {
        const b = shuffle(n, mulberry32(s));
        expect([...b].sort((x, y) => x - y)).toEqual(Array.from({ length: n * n }, (_, i) => i));
        expect(isSolvable(b, n), `${n}x${n} seed ${s}`).toBe(true);
        expect(isSolved(b), `${n}x${n} seed ${s}`).toBe(false);
      }
    }
  });
  it('is deterministic for a seed and varies across seeds', () => {
    expect(shuffle(4, mulberry32(123))).toEqual(shuffle(4, mulberry32(123)));
    const boards = new Set<string>();
    for (let s = 1; s <= 50; s++) boards.add(key(shuffle(5, mulberry32(s))));
    expect(boards.size).toBe(50);
  });
  it('puts the gap anywhere, not always in the corner', () => {
    const gaps = new Set<number>();
    for (let s = 1; s <= 200; s++) gaps.add(gapIndex(shuffle(3, mulberry32(s))));
    expect(gaps.size).toBe(9);
  });
  it('is uniform over the solvable boards: every non-solved 2x2 board turns up about equally often', () => {
    const counts = new Map<string, number>();
    const draws = 11000;
    for (let s = 1; s <= draws; s++) {
      const k = key(shuffle(2, mulberry32(s)));
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    expect(counts.size).toBe(11); // 12 reachable boards minus the solved one
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });
  it('does not mutate shared state between calls', () => {
    const a = shuffle(3, mulberry32(8));
    const copy = a.slice();
    shuffle(3, mulberry32(9));
    expect(a).toEqual(copy);
    expect(solvedBoard(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
  });
});

describe('win detection', () => {
  it('turns true exactly when the last tile arrives', () => {
    let b: Board = [1, 2, 3, 4, 5, 6, 7, 0, 8];
    expect(isSolved(b)).toBe(false);
    b = applyMove(b, 3, 8) as Board;
    expect(isSolved(b)).toBe(true);
    b = applyMove(b, 3, 7) as Board;
    expect(isSolved(b)).toBe(false);
  });
  it('follows a scramble made of legal moves back to solved by reversing it', () => {
    const rng = mulberry32(2026);
    for (const n of SIZES) {
      let cur = solvedBoard(n);
      const gaps: number[] = [];
      for (let k = 0; k < 120; k++) {
        const opts = gapNeighbours(cur, n);
        gaps.push(gapIndex(cur));
        cur = applyMove(cur, n, opts[Math.floor(rng() * opts.length)]) as Board;
      }
      for (const g of gaps.reverse()) cur = applyMove(cur, n, g) as Board;
      expect(isSolved(cur)).toBe(true);
    }
  });
});

describe('3x3 hints', () => {
  it('the optimal length is 0 for solved, 1 after one slide, and null for unsolvable or non-3x3 boards', () => {
    expect(optimalLength3(solvedBoard(3))).toBe(0);
    expect(optimalLength3([1, 2, 3, 4, 5, 6, 7, 0, 8])).toBe(1);
    expect(optimalLength3([1, 2, 3, 4, 5, 6, 8, 7, 0])).toBeNull(); // 7 and 8 swapped
    expect(optimalLength3(solvedBoard(4))).toBeNull();
  });
  it('is null when there is nothing to hint', () => {
    expect(hint3(solvedBoard(3))).toBeNull();
    expect(hint3([1, 2, 3, 4, 5, 6, 8, 7, 0])).toBeNull();
    expect(hint3(solvedBoard(4))).toBeNull();
  });
  it('always names a tile next to the gap, and following hints solves the puzzle in exactly the shortest number of slides', () => {
    for (let s = 1; s <= 40; s++) {
      let b = shuffle(3, mulberry32(s));
      const shortest = optimalLength3(b) as number;
      expect(shortest).toBeGreaterThan(0);
      expect(shortest).toBeLessThanOrEqual(31);
      let steps = 0;
      while (!isSolved(b)) {
        const h = hint3(b)!;
        expect(h.remaining).toBe(shortest - steps);
        expect(gapNeighbours(b, 3)).toContain(h.idx);
        expect(b[h.idx]).toBe(h.tile);
        b = applyMove(b, 3, h.idx) as Board;
        steps++;
        expect(steps).toBeLessThanOrEqual(31);
      }
      expect(steps).toBe(shortest);
    }
  });
  it('every single slide changes the shortest distance by exactly one', () => {
    const b = shuffle(3, mulberry32(4));
    const here = optimalLength3(b) as number;
    for (const idx of gapNeighbours(b, 3)) {
      const next = optimalLength3(applyMove(b, 3, idx) as Board) as number;
      expect(Math.abs(next - here)).toBe(1);
    }
  });
});

describe('saved best results', () => {
  it('keeps whole positive numbers under the six known keys and drops everything else', () => {
    expect(sanitiseBest({ m3: 20, t3: 45, m4: 80, t4: 300, m5: 200, t5: 900 })).toEqual({ m3: 20, t3: 45, m4: 80, t4: 300, m5: 200, t5: 900 });
    expect(sanitiseBest({ m3: '20', m6: 5, x: 1 })).toEqual({ m3: 20 });
    expect(sanitiseBest({ m3: 0, t3: -3, m4: 1.5, t4: NaN, m5: Infinity, t5: 'x' })).toEqual({});
  });
  it('caps moves and seconds at sane limits', () => {
    expect(sanitiseBest({ m4: MAX_BEST_MOVES, t4: MAX_BEST_SECONDS })).toEqual({ m4: MAX_BEST_MOVES, t4: MAX_BEST_SECONDS });
    expect(sanitiseBest({ m4: MAX_BEST_MOVES + 1, t4: MAX_BEST_SECONDS + 1 })).toEqual({});
    expect(sanitiseBest({ m4: 1e300 })).toEqual({});
  });
  it('survives storage that is not an object', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
  });
});

describe('result text', () => {
  it('plural says "1 move" and "2 moves"', () => {
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
    expect(plural(2, 'move')).toBe('2 moves');
    expect(plural(1, 'hint')).toBe('1 hint');
  });
  it('slideMessage names where a single tile landed and how many tiles are in place', () => {
    const before: Board = [1, 2, 3, 4, 5, 6, 7, 0, 8];
    const after = applyMove(before, 3, 6) as Board; // tile 7 slides right
    expect(slideMessage(after, 3, 7, 1)).toBe('Tile 7 slid to row 3, column 2. 6 of 8 in place.');
  });
  it('slideMessage reports a whole run and reads the tile position from the board after the move', () => {
    const before: Board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const after = applyMove(before, 3, 2) as Board; // tiles 1 and 2 slide left
    expect(slideMessage(after, 3, 2, runLength(before, 3, 2))).toBe('2 tiles slid, tile 2 is now at row 1, column 2. 2 of 8 in place.');
  });
});

describe('prng and time formatting', () => {
  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBe(true);
    }
  });
  it('formats minutes and seconds and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
