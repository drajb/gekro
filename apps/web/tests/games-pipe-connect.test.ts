/**
 * games-pipe-connect.test.ts - the engine behind `pipe-connect`.
 *
 * Pinned: the shape tables and quarter-turn arithmetic, that a turn only
 * rotates one tile and four turns restore it, that open ends and "joined to the
 * source" are counted correctly, that grown trees are real spanning trees, that
 * every puzzle is solvable (the tree it was grown from finishes it), and that
 * the exact search agrees with a brute force that tries EVERY orientation of
 * every tile on small boards, both for the fewest turns and the number of
 * finished layouts, including boards with no solution. Hints are exactly one
 * turn closer to done.
 */
import { describe, it, expect } from 'vitest';
import {
  NORTH, EAST, SOUTH, WEST, DIRS, KINDS, SIZES, MIN_DIM, MAX_DIM, mulberry32, baseMask, periodOf, rotMask, maskOf, orientations, turnsTo, popcount, kindOfMask,
  neighbour, makeBoard, cellMask, turn, joined, openEnds, openEndsAt, distances, connectedCount, isSolved, growTree, makePuzzle, turnsToLayout, solve, hintTile,
  bestKey, MAX_BEST_TURNS, sanitiseBest, clampSize, plural, describeOpenings, describeTile, DIR_NAMES,
  type Board, type Kind,
} from '../src/components/apps-private/pipe-connect/helpers';

const key = (b: Board): string => b.rots.join('');

// ── Independent oracle pieces (written differently from the engine) ───────────

/** Rotate by lookup, one direction at a time. */
const NEXT: Record<number, number> = { 1: 2, 2: 4, 4: 8, 8: 1 };
const rot1 = (m: number): number => [1, 2, 4, 8].reduce((acc, bit) => (m & bit ? acc | NEXT[bit] : acc), 0);
const BASE: Record<Kind, number> = { cap: 1, straight: 5, elbow: 3, tee: 11, cross: 15 };

/** Fewest clockwise quarter turns between two orientations of a shape, by trying 0..3 turns. */
const slowTurns = (kind: Kind, rot: number, target: number): number | null => {
  let m = BASE[kind];
  for (let i = 0; i < rot; i++) m = rot1(m);
  for (let t = 0; t < 4; t++) {
    if (m === target) return t;
    m = rot1(m);
  }
  return null;
};

/** Tree check: all openings match, none leave the grid, one connected network with exactly V-1 pipes. */
const isTreeLayout = (w: number, h: number, masks: number[]): boolean => {
  let pipes = 0;
  const adj: number[][] = masks.map(() => []);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const m = masks[i];
      if (r === 0 && (m & 1)) return false;
      if (c === w - 1 && (m & 2)) return false;
      if (r === h - 1 && (m & 4)) return false;
      if (c === 0 && (m & 8)) return false;
      if (c < w - 1) {
        const right = (m & 2) !== 0;
        const left = (masks[i + 1] & 8) !== 0;
        if (right !== left) return false;
        if (right) { pipes++; adj[i].push(i + 1); adj[i + 1].push(i); }
      }
      if (r < h - 1) {
        const down = (m & 4) !== 0;
        const up = (masks[i + w] & 1) !== 0;
        if (down !== up) return false;
        if (down) { pipes++; adj[i].push(i + w); adj[i + w].push(i); }
      }
    }
  }
  if (pipes !== w * h - 1) return false;
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const x = stack.pop()!;
    for (const y of adj[x]) if (!seen.has(y)) { seen.add(y); stack.push(y); }
  }
  return seen.size === w * h;
};

/** Brute force: every orientation of every tile. Returns the fewest turns and the number of finished layouts. */
const bruteForce = (b: Board): { turns: number | null; count: number } => {
  const total = b.w * b.h;
  const opts = b.kinds.map((k) => {
    const set = new Set<number>();
    let m = BASE[k];
    for (let i = 0; i < 4; i++) { set.add(m); m = rot1(m); }
    return [...set];
  });
  const masks = new Array(total).fill(0);
  let best: number | null = null;
  let count = 0;
  const go = (i: number): void => {
    if (i === total) {
      if (!isTreeLayout(b.w, b.h, masks)) return;
      let cost = 0;
      for (let j = 0; j < total; j++) cost += slowTurns(b.kinds[j], b.rots[j], masks[j])!;
      count++;
      if (best === null || cost < best) best = cost;
      return;
    }
    for (const m of opts[i]) { masks[i] = m; go(i + 1); }
  };
  go(0);
  return { turns: best, count };
};

const randomKinds = (n: number, rng: () => number): Kind[] => {
  const pool: Kind[] = ['cap', 'cap', 'straight', 'straight', 'elbow', 'elbow', 'elbow', 'tee', 'tee', 'cross'];
  return Array.from({ length: n }, () => pool[Math.floor(rng() * pool.length)]);
};

const applyNeed = (b: Board, need: number[]): Board => {
  let cur = b;
  need.forEach((n, i) => { for (let t = 0; t < n; t++) cur = turn(cur, i); });
  return cur;
};

describe('shapes and quarter turns', () => {
  it('has the base openings and periods the page describes', () => {
    expect(baseMask('cap')).toBe(NORTH);
    expect(baseMask('straight')).toBe(NORTH | SOUTH);
    expect(baseMask('elbow')).toBe(NORTH | EAST);
    expect(baseMask('tee')).toBe(NORTH | EAST | WEST);
    expect(baseMask('cross')).toBe(15);
    expect(KINDS.map(periodOf)).toEqual([4, 2, 4, 4, 1]);
    expect(KINDS.map((k) => popcount(baseMask(k)))).toEqual([1, 2, 2, 3, 4]);
  });
  it('rotMask goes clockwise, wraps, and matches the lookup version', () => {
    expect(rotMask(NORTH, 1)).toBe(EAST);
    expect(rotMask(EAST, 1)).toBe(SOUTH);
    expect(rotMask(SOUTH, 1)).toBe(WEST);
    expect(rotMask(WEST, 1)).toBe(NORTH);
    for (let m = 0; m < 16; m++) {
      expect(rotMask(m, 4)).toBe(m);
      expect(rotMask(m, 1)).toBe(rot1(m));
      expect(rotMask(m, 2)).toBe(rot1(rot1(m)));
      expect(rotMask(m, -1)).toBe(rotMask(m, 3));
      expect(popcount(rotMask(m, 1))).toBe(popcount(m));
    }
  });
  it('orientations are the distinct looks: 4, 2 and 1', () => {
    expect(orientations('cap')).toHaveLength(4);
    expect(orientations('elbow')).toHaveLength(4);
    expect(orientations('tee')).toHaveLength(4);
    expect(orientations('straight')).toHaveLength(2);
    expect(orientations('cross')).toHaveLength(1);
    for (const k of KINDS) expect(new Set(orientations(k)).size).toBe(orientations(k).length);
  });
  it('turnsTo is the fewest clockwise turns, null for an impossible look, and agrees with the slow version', () => {
    for (const k of KINDS) {
      for (let rot = 0; rot < 4; rot++) {
        for (let target = 0; target < 16; target++) expect(turnsTo(k, rot, target)).toBe(slowTurns(k, rot, target));
      }
    }
    expect(turnsTo('elbow', 0, NORTH | EAST)).toBe(0);
    expect(turnsTo('elbow', 0, EAST | SOUTH)).toBe(1);
    expect(turnsTo('elbow', 0, WEST | NORTH)).toBe(3);
    expect(turnsTo('straight', 0, EAST | WEST)).toBe(1);
    expect(turnsTo('straight', 1, NORTH | SOUTH)).toBe(1);
    expect(turnsTo('straight', 2, NORTH | SOUTH)).toBe(0);
    expect(turnsTo('cap', 0, NORTH | SOUTH)).toBeNull();
    expect(turnsTo('cross', 3, 15)).toBe(0);
  });
  it('kindOfMask names the shape of any opening set', () => {
    expect(kindOfMask(0)).toBeNull();
    expect(kindOfMask(NORTH)).toBe('cap');
    expect(kindOfMask(EAST | WEST)).toBe('straight');
    expect(kindOfMask(NORTH | WEST)).toBe('elbow');
    expect(kindOfMask(NORTH | EAST | SOUTH)).toBe('tee');
    expect(kindOfMask(15)).toBe('cross');
    for (const k of KINDS) for (const m of orientations(k)) expect(kindOfMask(m)).toBe(k);
  });
});

describe('turning and joining', () => {
  const four: Board = makeBoard(2, 2, ['elbow', 'elbow', 'elbow', 'elbow'], [1, 2, 0, 3], 0);
  it('turn rotates one tile clockwise and never changes its input', () => {
    const before = key(four);
    const t = turn(four, 2);
    expect(key(four)).toBe(before);
    expect(t.rots).toEqual([1, 2, 1, 3]);
    expect(cellMask(t, 2)).toBe(EAST | SOUTH);
  });
  it('four turns restore a tile, a cross never changes, a straight repeats after two', () => {
    const b = makeBoard(2, 2, ['tee', 'cross', 'straight', 'cap'], [0, 0, 0, 0], 0);
    let x = b;
    for (let i = 0; i < 4; i++) x = turn(x, 0);
    expect(x.rots).toEqual(b.rots);
    expect(cellMask(turn(b, 1), 1)).toBe(15);
    expect(cellMask(turn(turn(b, 2), 2), 2)).toBe(cellMask(b, 2));
    expect(() => turn(b, 4)).toThrow(RangeError);
    expect(() => turn(b, -1)).toThrow(RangeError);
    expect(() => turn(b, 1.5)).toThrow(RangeError);
  });
  it('a ring of four elbows has no open ends and is joined to the source', () => {
    // top-left E+S, top-right S+W, bottom-left N+E, bottom-right W+N
    expect(openEnds(four)).toBe(0);
    expect(connectedCount(four)).toBe(4);
    expect(isSolved(four)).toBe(true);
    expect(distances(four)).toEqual([0, 1, 1, 2]);
  });
  it('counts openings that face the edge or a neighbour that does not open back', () => {
    const b = makeBoard(2, 2, ['cap', 'cap', 'cap', 'cap'], [1, 3, 0, 0], 0); // E, W, N, N
    expect(joined(b, 0, EAST)).toBe(true);
    expect(joined(b, 1, WEST)).toBe(true);
    expect(joined(b, 0, NORTH)).toBe(false);
    expect(joined(b, 2, NORTH)).toBe(false); // above it is a cap that opens west, not south
    expect(openEnds(b)).toBe(2);
    expect(openEndsAt(b, 0)).toBe(0);
    expect(openEndsAt(b, 2)).toBe(1);
    expect(isSolved(b)).toBe(false);
    expect(connectedCount(b)).toBe(2);
  });
  it('is not solved when the network is split in two even with no open ends', () => {
    const b = makeBoard(2, 4, ['cap', 'cap', 'cap', 'cap', 'cap', 'cap', 'cap', 'cap'], [1, 3, 1, 3, 1, 3, 1, 3], 0);
    expect(openEnds(b)).toBe(0);
    expect(connectedCount(b)).toBe(2);
    expect(isSolved(b)).toBe(false);
  });
  it('neighbour stops at the edge', () => {
    expect(neighbour({ w: 3, h: 2 }, 0, NORTH)).toBe(-1);
    expect(neighbour({ w: 3, h: 2 }, 0, WEST)).toBe(-1);
    expect(neighbour({ w: 3, h: 2 }, 2, EAST)).toBe(-1);
    expect(neighbour({ w: 3, h: 2 }, 5, SOUTH)).toBe(-1);
    expect(neighbour({ w: 3, h: 2 }, 4, NORTH)).toBe(1);
    expect(neighbour({ w: 3, h: 2 }, 1, SOUTH)).toBe(4);
  });
  it('rejects bad sizes and sources', () => {
    expect(() => makeBoard(1, 3, ['cap', 'cap', 'cap'], [0, 0, 0], 0)).toThrow(RangeError);
    expect(() => makeBoard(9, 2, new Array(18).fill('cap'), new Array(18).fill(0), 0)).toThrow(RangeError);
    expect(() => makeBoard(2, 2, ['cap', 'cap', 'cap'], [0, 0, 0], 0)).toThrow(RangeError);
    expect(() => makeBoard(2, 2, ['cap', 'cap', 'cap', 'cap'], [0, 0, 0, 0], 4)).toThrow(RangeError);
    expect(() => makeBoard(2.5, 2, ['cap'], [0], 0)).toThrow(RangeError);
    expect(MIN_DIM).toBe(2);
    expect(MAX_DIM).toBe(8);
    expect([...SIZES]).toEqual([4, 5, 6, 7, 8]);
  });
});

describe('grown trees', () => {
  it('are spanning trees on every size and shape', () => {
    for (let w = 2; w <= 8; w++) {
      for (let h = 2; h <= 8; h++) {
        for (let seed = 1; seed <= 6; seed++) {
          const masks = growTree(w, h, mulberry32(seed * 1000 + w * 10 + h));
          expect(isTreeLayout(w, h, masks), `${w}x${h} seed ${seed}`).toBe(true);
          expect(masks.every((m) => m !== 0)).toBe(true);
        }
      }
    }
  });
  it('are deterministic for a seed and vary between seeds', () => {
    expect(growTree(6, 6, mulberry32(5))).toEqual(growTree(6, 6, mulberry32(5)));
    const seen = new Set<string>();
    for (let s = 1; s <= 30; s++) seen.add(growTree(6, 6, mulberry32(s)).join(','));
    expect(seen.size).toBeGreaterThanOrEqual(29);
  });
  it('give a mix of shapes at the sizes the page offers', () => {
    for (const n of SIZES) {
      const counts: Record<string, number> = {};
      for (let s = 1; s <= 20; s++) {
        for (const m of growTree(n, n, mulberry32(s * 3 + n))) counts[kindOfMask(m)!] = (counts[kindOfMask(m)!] ?? 0) + 1;
      }
      for (const k of ['cap', 'straight', 'elbow', 'tee']) expect(counts[k], `${n} ${k}`).toBeGreaterThan(0);
    }
  });
});

describe('puzzles', () => {
  it('are valid, unfinished, and finished by the tree they came from', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 25; seed++) {
        const p = makePuzzle(n, n, mulberry32(seed * 131 + n));
        const b = p.board;
        expect(b.w).toBe(n);
        expect(b.kinds).toHaveLength(n * n);
        expect(isSolved(b), `${n} ${seed}`).toBe(false);
        expect(p.plannedTurns).toBeGreaterThan(0);
        expect(turnsToLayout(b, p.target)).toBe(p.plannedTurns);
        expect(b.kinds.every((k, i) => k === kindOfMask(p.target[i]))).toBe(true);
        const done = applyNeed(b, b.kinds.map((k, i) => turnsTo(k, b.rots[i], p.target[i])!));
        expect(isSolved(done)).toBe(true);
        expect(openEnds(done)).toBe(0);
        expect(connectedCount(done)).toBe(n * n);
        expect(isTreeLayout(n, n, done.kinds.map((_, i) => cellMask(done, i)))).toBe(true);
      }
    }
  });
  it('are deterministic by seed', () => {
    const a = makePuzzle(6, 6, mulberry32(77));
    const c = makePuzzle(6, 6, mulberry32(77));
    expect(a).toEqual(c);
    expect(makePuzzle(6, 6, mulberry32(78))).not.toEqual(a);
  });
  it('rejects a bad size', () => {
    expect(() => makePuzzle(1, 5, mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(5, 9, mulberry32(1))).toThrow(RangeError);
  });
});

describe('the exact search agrees with brute force', () => {
  it('on small boards grown from trees: same fewest turns, same number of finished layouts', () => {
    const dims: [number, number][] = [[3, 3], [3, 3], [2, 4], [4, 2], [2, 5], [3, 3]];
    let compared = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const [w, h] = dims[seed % dims.length];
      const p = makePuzzle(w, h, mulberry32(seed * 91));
      const bf = bruteForce(p.board);
      const mine = solve(p.board, { countAll: true });
      expect(mine.status).toBe('solved');
      if (mine.status !== 'solved') continue;
      expect(mine.turns, `${w}x${h} seed ${seed}`).toBe(bf.turns);
      expect(mine.count).toBe(bf.count);
      expect(bf.count).toBeGreaterThanOrEqual(1);
      expect(mine.turns).toBeLessThanOrEqual(p.plannedTurns);
      // the pruned search (the one the page uses) reports the same fewest turns
      const fast = solve(p.board);
      expect(fast.status === 'solved' && fast.turns).toBe(bf.turns);
      compared++;
    }
    expect(compared).toBe(24);
  }, 120_000);
  it('on random shapes, including boards with no finished layout', () => {
    const rng = mulberry32(2025);
    let solvable = 0;
    let none = 0;
    for (let trial = 0; trial < 40; trial++) {
      const [w, h] = trial % 2 ? [3, 3] : [2, 4];
      // Start from a real tree (so the pipe count can work out), then disturb it: swap tiles or change a shape.
      const kinds = makePuzzle(w, h, rng).board.kinds.slice();
      const mode = trial % 4;
      if (mode < 2) {
        const a = Math.floor(rng() * kinds.length);
        const c = Math.floor(rng() * kinds.length);
        [kinds[a], kinds[c]] = [kinds[c], kinds[a]];
      } else if (mode === 2) {
        const a = Math.floor(rng() * kinds.length);
        kinds[a] = kinds[a] === 'elbow' ? 'straight' : kinds[a] === 'straight' ? 'elbow' : kinds[a];
      } else {
        kinds.splice(0, kinds.length, ...randomKinds(w * h, rng));
      }
      const b = makeBoard(w, h, kinds, Array.from({ length: w * h }, () => Math.floor(rng() * 4)), Math.floor(rng() * w * h));
      const bf = bruteForce(b);
      const mine = solve(b, { countAll: true });
      if (bf.turns === null) {
        none++;
        expect(mine.status, `trial ${trial}`).toBe('none');
        expect(solve(b).status).toBe('none');
      } else {
        solvable++;
        expect(mine.status).toBe('solved');
        if (mine.status === 'solved') {
          expect(mine.turns).toBe(bf.turns);
          expect(mine.count).toBe(bf.count);
        }
      }
    }
    expect(solvable).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  }, 120_000);
  it('the turns it reports finish the board: apply them and the board is solved', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 10; seed++) {
        const p = makePuzzle(n, n, mulberry32(seed * 17 + n));
        const r = solve(p.board);
        expect(r.status).toBe('solved');
        if (r.status !== 'solved') continue;
        expect(r.need.reduce((a, c) => a + c, 0)).toBe(r.turns);
        expect(r.turns).toBeLessThanOrEqual(p.plannedTurns);
        expect(isSolved(applyNeed(p.board, r.need))).toBe(true);
      }
    }
  });
  it('honours the step limit', () => {
    const p = makePuzzle(8, 8, mulberry32(3));
    expect(solve(p.board, { maxNodes: 5 }).status).toBe('limit');
  });
  it('worst case on the biggest board stays inside a generous time budget', () => {
    const t0 = Date.now();
    for (let s = 1; s <= 30; s++) {
      const r = solve(makePuzzle(8, 8, mulberry32(s)).board);
      expect(r.status).toBe('solved');
    }
    expect(Date.now() - t0).toBeLessThan(20_000);
  }, 30_000);
  it('most 8x8 boards have exactly one finished layout (not promised, just measured here)', () => {
    let unique = 0;
    const total = 60;
    for (let s = 1; s <= total; s++) {
      const r = solve(makePuzzle(8, 8, mulberry32(s * 5)).board, { countAll: true, maxNodes: 5_000_000 });
      if (r.status === 'solved' && r.count === 1) unique++;
    }
    expect(unique).toBeGreaterThanOrEqual(Math.floor(total * 0.85));
  }, 60_000);
});

describe('a finished board is always a tree', () => {
  it('on small boards, over EVERY orientation, isSolved is true exactly for the tree layouts', () => {
    const dims: [number, number][] = [[3, 3], [2, 4], [3, 3], [4, 2], [2, 3], [3, 2]];
    let finished = 0;
    for (let seed = 1; seed <= dims.length; seed++) {
      const [w, h] = dims[seed - 1];
      const p = makePuzzle(w, h, mulberry32(seed * 313));
      const b0 = p.board;
      const opts = b0.kinds.map((k) => orientations(k));
      const chosen = new Array(w * h).fill(0);
      const go = (i: number): void => {
        if (i === w * h) {
          const rots = b0.kinds.map((k, j) => turnsTo(k, 0, chosen[j])!);
          const board = makeBoard(w, h, b0.kinds, rots, b0.source);
          const tree = isTreeLayout(w, h, chosen);
          expect(isSolved(board), `${w}x${h} seed ${seed}`).toBe(tree);
          if (tree) finished++;
          return;
        }
        for (const m of opts[i]) { chosen[i] = m; go(i + 1); }
      };
      go(0);
    }
    expect(finished).toBeGreaterThanOrEqual(dims.length);
  }, 120_000);
});

describe('hints', () => {
  it('turning the hinted tile once always brings the fewest remaining turns down by exactly one', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 12; seed++) {
        let b = makePuzzle(n, n, mulberry32(seed * 29 + n)).board;
        for (let step = 0; step < 6; step++) {
          const before = solve(b);
          if (before.status !== 'solved' || before.turns === 0) break;
          const h = hintTile(b);
          expect(h).not.toBeNull();
          expect(h!.turns).toBeGreaterThan(0);
          b = turn(b, h!.cell);
          const after = solve(b);
          expect(after.status === 'solved' && after.turns, `${n} ${seed} step ${step}`).toBe(before.turns - 1);
        }
      }
    }
  });
  it('is null when the board is finished', () => {
    const p = makePuzzle(5, 5, mulberry32(4));
    const r = solve(p.board);
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(hintTile(applyNeed(p.board, r.need))).toBeNull();
  });
  it('is null when there is no finished layout', () => {
    expect(hintTile(makeBoard(2, 2, ['cap', 'cap', 'cap', 'cap'], [0, 0, 0, 0], 0))).toBeNull();
  });
  it('always follows one cheapest layout to the end', () => {
    let b = makePuzzle(6, 6, mulberry32(321)).board;
    for (let guard = 0; guard < 400 && !isSolved(b); guard++) b = turn(b, hintTile(b)!.cell);
    expect(isSolved(b)).toBe(true);
  });
});

describe('fuzz', () => {
  it('random turns never throw, never lose a tile, and keep shapes', () => {
    const rng = mulberry32(99);
    for (let run = 0; run < 60; run++) {
      const n = SIZES[run % SIZES.length];
      let b = makePuzzle(n, n, rng).board;
      const kinds = b.kinds.slice();
      for (let step = 0; step < 200; step++) {
        b = turn(b, Math.floor(rng() * n * n));
        expect(b.kinds).toEqual(kinds);
        expect(b.rots.every((r) => Number.isInteger(r) && r >= 0 && r < 4)).toBe(true);
        expect(openEnds(b)).toBeGreaterThanOrEqual(0);
        expect(connectedCount(b)).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('four turns of any tile on a finished board leave it finished', () => {
    const p = makePuzzle(5, 5, mulberry32(8));
    const r = solve(p.board);
    if (r.status !== 'solved') throw new Error('unsolvable');
    const done = applyNeed(p.board, r.need);
    expect(isSolved(done)).toBe(true);
    for (let i = 0; i < 25; i++) {
      let x = done;
      for (let t = 0; t < 4; t++) x = turn(x, i);
      expect(isSolved(x)).toBe(true);
    }
  });
});

describe('sanitisers and text', () => {
  it('sanitiseBest keeps only known sizes with whole numbers in range, in a fresh object', () => {
    expect(sanitiseBest({ s4: 20, s8: 90, s5: MAX_BEST_TURNS })).toEqual({ s4: 20, s8: 90, s5: MAX_BEST_TURNS });
    expect(sanitiseBest({ s4: 0, s5: -3, s6: 2.5, s7: NaN, s8: MAX_BEST_TURNS + 1 })).toEqual({});
    expect(sanitiseBest({ s4: '12' as unknown as number, s3: 5, s9: 5, x: 1 })).toEqual({});
    expect(sanitiseBest(null)).toEqual({});
    expect(sanitiseBest([1])).toEqual({});
    expect(sanitiseBest('s4')).toEqual({});
    expect(sanitiseBest(JSON.parse('{"__proto__":{"s4":3},"s5":9}'))).toEqual({ s5: 9 });
    const raw = { s4: 4 };
    expect(sanitiseBest(raw)).not.toBe(raw);
    expect(bestKey(6)).toBe('s6');
  });
  it('clampSize accepts only the offered sizes', () => {
    expect(clampSize('6', 5)).toBe(6);
    expect(clampSize(8, 5)).toBe(8);
    expect(clampSize('3', 5)).toBe(5);
    expect(clampSize('9', 5)).toBe(5);
    expect(clampSize('5.5', 5)).toBe(5);
    expect(clampSize('', 5)).toBe(5);
    expect(clampSize(NaN, 5)).toBe(5);
    expect(clampSize([6], 5)).toBe(5);
  });
  it('plural and descriptions read well', () => {
    expect(plural(1, 'turn')).toBe('1 turn');
    expect(plural(3, 'turn')).toBe('3 turns');
    expect(describeOpenings(NORTH)).toBe('up');
    expect(describeOpenings(NORTH | EAST)).toBe('up and right');
    expect(describeOpenings(NORTH | EAST | SOUTH)).toBe('up, right and down');
    expect(describeOpenings(15)).toBe('up, right, down and left');
    expect(DIRS.map((d) => DIR_NAMES[d])).toEqual(['up', 'right', 'down', 'left']);
    const b = makeBoard(2, 2, ['elbow', 'cap', 'cap', 'cap'], [1, 3, 1, 0], 0);
    expect(describeTile(b, 0, true)).toBe('Row 1, column 1: source, elbow open right and down, joined to the source, 1 open end');
    expect(describeTile(b, 1, false)).toBe('Row 1, column 2: end cap open left, not joined to the source');
    expect(maskOf('cap', 3)).toBe(WEST);
  });
});
