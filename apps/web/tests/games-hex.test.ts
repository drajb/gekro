/**
 * games-hex.test.ts - the engine behind `hex`.
 *
 * Pinned: the six-neighbour geometry (checked against a count of edges and a second,
 * cube-coordinate definition of "next to"), win detection by union-find compared with a flood
 * fill written separately (every position of the 2 x 2 and 3 x 3 boards, and thousands of random
 * boards up to 8 x 8), the theorem that a full board has exactly one winner, the shortest
 * winning chain, play and the swap rule (and that the swap preserves who is winning), the
 * three computer levels (legal, deterministic for a seed, playout counts, Medium and Hard beat
 * Easy), and the time budget.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, playMove, outcome, winner, connected, winningPath, neighbours, neighbourTable, emptyCells, stoneCount, canSwap, swapSides, swapTarget,
  randomAdjacent, candidateCells, mcMove, chooseMove, decide, shouldSwap, modestOpening, edgeDistance, centreOf, cellName, rowOf, colOf,
  onStartEdge, onEndEdge, otherPlayer, nameOf, sideLabel, describeResult, stonesText, thinkingMessage, undoIndex, cleanSize, cleanLevel,
  mulberry32, shuffled, SKY, ROSE, SIZES, DEFAULT_SIZE, MEDIUM_PLAYOUTS, HARD_PLAYOUTS, HARD_BUDGET_MS,
  type State, type Player, type Level,
} from '../src/components/apps-private/hex/helpers';
import calculatorSource from '../src/components/apps-private/hex/Calculator.astro?raw';

// ── An independent oracle: cube coordinates and a flood fill ────────────────
// Two cells are next to each other when their cube coordinates (x = col, z = row, y = -x - z)
// are at distance 1. The flood fill starts from the player's own stones on their starting side.

const cube = (n: number, i: number): [number, number, number] => {
  const x = i % n;
  const z = Math.floor(i / n);
  return [x, -x - z, z];
};
const touching = (n: number, a: number, b: number): boolean => {
  const [ax, ay, az] = cube(n, a);
  const [bx, by, bz] = cube(n, b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz)) === 1;
};
/** Length (in stones) of the shortest chain, or 0 when there is none. */
const floodShortest = (cells: ArrayLike<number>, n: number, p: Player): number => {
  const dist = new Map<number, number>();
  const queue: number[] = [];
  for (let i = 0; i < n * n; i++) {
    const starts = p === SKY ? i % n === 0 : Math.floor(i / n) === 0;
    if (cells[i] === p && starts) { dist.set(i, 1); queue.push(i); }
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    const ends = p === SKY ? i % n === n - 1 : Math.floor(i / n) === n - 1;
    if (ends) return dist.get(i)!;
    for (let j = 0; j < n * n; j++) {
      if (cells[j] === p && !dist.has(j) && touching(n, i, j)) { dist.set(j, dist.get(i)! + 1); queue.push(j); }
    }
  }
  return 0;
};
const floodWins = (cells: ArrayLike<number>, n: number, p: Player): boolean => floodShortest(cells, n, p) > 0;

const randomBoard = (n: number, rng: () => number, fill: number): Int8Array => {
  const cells = new Int8Array(n * n);
  const order = shuffled(Array.from({ length: n * n }, (_, i) => i), rng);
  const count = Math.round(fill * n * n);
  for (let k = 0; k < count; k++) cells[order[k]] = k % 2 === 0 ? SKY : ROSE;
  return cells;
};

describe('geometry', () => {
  it('gives every cell the right neighbours', () => {
    const n = 11;
    expect(neighbours(n, 5 * n + 5)).toEqual([4 * n + 5, 4 * n + 6, 5 * n + 4, 5 * n + 6, 6 * n + 4, 6 * n + 5]);
    expect(neighbours(n, 0)).toEqual([1, n]);
    expect(neighbours(n, n - 1)).toEqual([n - 2, 2 * n - 2, 2 * n - 1]);
    expect(neighbours(n, n * (n - 1))).toEqual([n * (n - 2), n * (n - 2) + 1, n * (n - 1) + 1]);
    expect(neighbours(n, n * n - 1)).toEqual([n * (n - 1) - 1, n * n - 2]);
  });
  it('has (n - 1)(3n - 1) pairs of neighbours, is symmetric and agrees with the cube-coordinate definition', () => {
    for (const n of [2, 3, 5, 7, 9, 11]) {
      const table = neighbourTable(n);
      let total = 0;
      for (let i = 0; i < n * n; i++) {
        total += table[i].length;
        for (const j of table[i]) expect(neighbours(n, j)).toContain(i);
        for (let j = 0; j < n * n; j++) expect(table[i].includes(j)).toBe(touching(n, i, j));
      }
      expect(total / 2).toBe((n - 1) * (3 * n - 1));
    }
  });
  it('names a cell with 1-based row and column and finds the centre', () => {
    expect(cellName(11, 0)).toBe('row 1, column 1');
    expect(cellName(11, 120)).toBe('row 11, column 11');
    expect(rowOf(11, 25)).toBe(2);
    expect(colOf(11, 25)).toBe(3);
    expect(centreOf(11)).toBe(60);
    expect(centreOf(7)).toBe(24);
    expect(centreOf(9)).toBe(40);
  });
  it('knows the sides: Sky left and right, Rose top and bottom', () => {
    const n = 7;
    for (let i = 0; i < n * n; i++) {
      expect(onStartEdge(n, i, SKY)).toBe(i % n === 0);
      expect(onEndEdge(n, i, SKY)).toBe(i % n === n - 1);
      expect(onStartEdge(n, i, ROSE)).toBe(Math.floor(i / n) === 0);
      expect(onEndEdge(n, i, ROSE)).toBe(Math.floor(i / n) === n - 1);
    }
    expect(edgeDistance(11, 0)).toBe(0);
    expect(edgeDistance(11, 60)).toBe(5);
    expect(edgeDistance(11, 12)).toBe(1);
  });
});

describe('a new game', () => {
  it('is empty, Sky moves first, and the sizes are 7, 9 and 11', () => {
    const s = newGame();
    expect(DEFAULT_SIZE).toBe(11);
    expect(SIZES).toEqual([7, 9, 11]);
    expect(s.n).toBe(11);
    expect(stoneCount(s.cells)).toBe(0);
    expect(s.toMove).toBe(SKY);
    expect(emptyCells(s)).toHaveLength(121);
    expect(s.pie).toBe(false);
    expect(newGame(7, true).pie).toBe(true);
  });
  it('rejects junk sizes', () => {
    for (const bad of [0, 1, 14, 2.5, NaN, Infinity, -3]) expect(() => newGame(bad)).toThrow(RangeError);
  });
});

describe('who has won, against a flood fill written separately', () => {
  it('agrees on every position of the 2 x 2 board and every position of the 3 x 3 board', () => {
    let boards = 0;
    for (const n of [2, 3]) {
      const total = 3 ** (n * n);
      for (let code = 0; code < total; code++) {
        const cells = new Int8Array(n * n);
        let c = code;
        for (let i = 0; i < n * n; i++) { cells[i] = c % 3; c = Math.floor(c / 3); }
        const sky = floodWins(cells, n, SKY);
        const rose = floodWins(cells, n, ROSE);
        expect(connected(cells, n, SKY)).toBe(sky);
        expect(connected(cells, n, ROSE)).toBe(rose);
        expect(winner(cells, n)).toBe(sky ? SKY : rose ? ROSE : 0);
        expect(sky && rose).toBe(false); // both can never be joined at once
        boards++;
      }
    }
    expect(boards).toBe(81 + 19683);
  });
  it('agrees on 3000 random boards of 4 x 4 to 8 x 8, half full to completely full', () => {
    const rng = mulberry32(2026);
    let wins = 0;
    for (let g = 0; g < 3000; g++) {
      const n = 4 + (g % 5);
      const cells = randomBoard(n, rng, 0.5 + rng() * 0.5);
      const sky = floodWins(cells, n, SKY);
      const rose = floodWins(cells, n, ROSE);
      expect(connected(cells, n, SKY)).toBe(sky);
      expect(connected(cells, n, ROSE)).toBe(rose);
      expect(sky && rose).toBe(false);
      if (sky || rose) wins++;
    }
    expect(wins).toBeGreaterThan(500); // plenty of won boards, and plenty that are not won yet
    expect(3000 - wins).toBeGreaterThan(500);
  });
  it('a full board always has exactly one winner (the theorem the playouts rely on), up to 11 x 11', () => {
    const rng = mulberry32(11);
    for (let g = 0; g < 1500; g++) {
      const n = [2, 3, 4, 5, 7, 9, 11][g % 7];
      const cells = randomBoard(n, rng, 1);
      expect(stoneCount(cells)).toBe(n * n);
      const sky = floodWins(cells, n, SKY);
      const rose = floodWins(cells, n, ROSE);
      expect(sky !== rose).toBe(true);
      expect(winner(cells, n)).toBe(sky ? SKY : ROSE);
      expect(connected(cells, n, SKY)).toBe(!connected(cells, n, ROSE));
    }
  });
  it('an empty board and a lone stone are not wins; a full row is', () => {
    const n = 7;
    expect(winner(new Int8Array(n * n), n)).toBe(0);
    const row = new Int8Array(n * n);
    for (let c = 0; c < n; c++) row[3 * n + c] = SKY;
    expect(winner(row, n)).toBe(SKY);
    const col = new Int8Array(n * n);
    for (let r = 0; r < n; r++) col[r * n + 2] = ROSE;
    expect(winner(col, n)).toBe(ROSE);
    // A row with a hole is not a win, and a diagonal chain that follows the slant is.
    const hole = row.slice();
    hole[3 * n + 3] = 0;
    expect(winner(hole, n)).toBe(0);
    const slant = new Int8Array(n * n);
    for (let r = 0; r < n; r++) slant[r * n + (n - 1 - r)] = ROSE; // (r, n-1-r): each step is down-left, which is a neighbour
    expect(winner(slant, n)).toBe(ROSE);
    // The other diagonal is NOT connected: (r, r) and (r+1, r+1) do not touch.
    const wrong = new Int8Array(n * n);
    for (let r = 0; r < n; r++) wrong[r * n + r] = ROSE;
    expect(winner(wrong, n)).toBe(0);
  });
});

describe('the winning chain', () => {
  it('is a valid shortest chain from side to side for random won boards', () => {
    const rng = mulberry32(77);
    let checked = 0;
    for (let g = 0; g < 600; g++) {
      const n = 3 + (g % 6);
      const cells = randomBoard(n, rng, 0.6 + rng() * 0.4);
      const w = winner(cells, n);
      if (w === 0) { expect(winningPath(cells, n, SKY)).toEqual([]); expect(winningPath(cells, n, ROSE)).toEqual([]); continue; }
      const path = winningPath(cells, n, w);
      expect(path.length).toBe(floodShortest(cells, n, w));
      expect(onStartEdge(n, path[0], w)).toBe(true);
      expect(onEndEdge(n, path[path.length - 1], w)).toBe(true);
      for (const i of path) expect(cells[i]).toBe(w);
      for (let k = 1; k < path.length; k++) expect(touching(n, path[k - 1], path[k])).toBe(true);
      expect(new Set(path).size).toBe(path.length);
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });
  it('outcome reports the winner and the chain, and play stops after a win', () => {
    let s = newGame(3);
    // Sky takes the middle row; Rose plays elsewhere.
    const plan = [3, 0, 4, 1, 5];
    for (const m of plan) s = playMove(s, m)!;
    const o = outcome(s);
    expect(o).toEqual({ over: true, winner: SKY, path: [3, 4, 5] });
    expect(playMove(s, 8)).toBeNull();
    expect(outcome(newGame(3))).toEqual({ over: false, winner: 0, path: [] });
  });
});

describe('playing', () => {
  it('places stones alternately, never mutates, and rejects taken cells and junk', () => {
    const s = newGame(7);
    const a = playMove(s, 24)!;
    expect(a.cells[24]).toBe(SKY);
    expect(a.toMove).toBe(ROSE);
    expect(a.plies).toBe(1);
    expect(s.cells[24]).toBe(0);
    expect(playMove(a, 24)).toBeNull();
    const b = playMove(a, 25)!;
    expect(b.cells[25]).toBe(ROSE);
    expect(b.toMove).toBe(SKY);
    for (const junk of [-1, 49, 1.5, NaN, Infinity, '3' as unknown as number]) expect(playMove(s, junk)).toBeNull();
  });
  it('random complete games on 2 x 2 to 7 x 7 always end with one winner before the board is over-full', () => {
    const rng = mulberry32(5);
    for (let g = 0; g < 600; g++) {
      const n = 2 + (g % 6);
      let s = newGame(n);
      let guard = 0;
      while (!outcome(s).over && guard++ < n * n + 1) {
        const empties = emptyCells(s);
        expect(empties.length).toBeGreaterThan(0); // a full board always has a winner, so we never run out
        s = playMove(s, empties[Math.floor(rng() * empties.length)])!;
      }
      const o = outcome(s);
      expect(o.over).toBe(true);
      expect(o.winner).not.toBe(0);
      expect(stoneCount(s.cells)).toBe(s.plies);
      // The first player to join their sides wins, so the last stone was placed by the winner.
      expect(otherPlayer(s.toMove)).toBe(o.winner);
    }
  });
});

describe('the swap rule', () => {
  it('is available only to the second player, only right after the first stone, and only when the rule is on', () => {
    expect(canSwap(newGame(7, true))).toBe(false);
    const one = playMove(newGame(7, true), 10)!;
    expect(canSwap(one)).toBe(true);
    expect(canSwap(playMove(newGame(7, false), 10)!)).toBe(false);
    expect(canSwap(playMove(one, 11)!)).toBe(false);
    expect(swapSides(newGame(7, true))).toBeNull();
    expect(swapSides(playMove(newGame(7, false), 10)!)).toBeNull();
  });
  it('turns the opening stone into a Rose stone reflected across the long diagonal and hands the move back to Sky', () => {
    const n = 7;
    const first = playMove(newGame(n, true), 1 * n + 4)!; // row 1, column 4
    expect(swapTarget(first)).toBe(4 * n + 1);
    const after = swapSides(first)!;
    expect(stoneCount(after.cells)).toBe(1);
    expect(after.cells[4 * n + 1]).toBe(ROSE);
    expect(after.cells[1 * n + 4]).toBe(0);
    expect(after.toMove).toBe(SKY);
    expect(after.swapped).toBe(true);
    expect(canSwap(after)).toBe(false);
    expect(first.cells[1 * n + 4]).toBe(SKY); // the original is untouched
    // A cell on the diagonal stays where it is.
    expect(swapSides(playMove(newGame(n, true), 2 * n + 2)!)!.cells[2 * n + 2]).toBe(ROSE);
  });
  it('reflecting a board across the long diagonal and swapping colours keeps who is winning (so the swap is fair)', () => {
    const rng = mulberry32(31);
    for (let g = 0; g < 600; g++) {
      const n = 3 + (g % 6);
      const cells = randomBoard(n, rng, 0.4 + rng() * 0.6);
      const mirrored = new Int8Array(n * n);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const v = cells[r * n + c];
        mirrored[c * n + r] = v === 0 ? 0 : v === SKY ? ROSE : SKY;
      }
      const w = winner(cells, n);
      expect(winner(mirrored, n)).toBe(w === 0 ? 0 : otherPlayer(w));
    }
  });
  it('the computer swaps a stone two or more steps in from the edge and not one on the edge zone', () => {
    const n = 11;
    for (let i = 0; i < n * n; i++) {
      const s = playMove(newGame(n, true), i)!;
      expect(shouldSwap(s)).toBe(edgeDistance(n, i) >= 2);
    }
    const rng = mulberry32(2);
    for (let g = 0; g < 50; g++) expect(edgeDistance(n, modestOpening(n, rng))).toBe(1);
  });
  it('decide() either swaps or places a legal stone', () => {
    const rng = mulberry32(8);
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      for (const cell of [0, 12, 60]) {
        const s = playMove(newGame(11, true), cell)!;
        const d = decide(s, level, rng, { now: () => 0, budgetMs: 1e9 });
        if (d.swap) expect(canSwap(s)).toBe(true);
        else expect(s.cells[d.cell]).toBe(0);
      }
    }
    const strong = playMove(newGame(11, true), 60)!;
    expect(decide(strong, 'hard', mulberry32(1))).toEqual({ swap: true });
    const weak = playMove(newGame(11, true), 0)!;
    const d = decide(weak, 'hard', mulberry32(1), { now: () => 0, budgetMs: 1e9 });
    expect(d.swap).toBe(false);
  });
});

describe('computer players', () => {
  it('Easy plays next to existing stones, any cell on an empty board, and returns -1 on a full board', () => {
    const rng = mulberry32(4);
    const s = playMove(newGame(11), 60)!;
    const near = new Set(neighbours(11, 60));
    for (let i = 0; i < 100; i++) expect(near.has(randomAdjacent(s, rng))).toBe(true);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(randomAdjacent(newGame(11), rng));
    expect(seen.size).toBeGreaterThan(50);
    expect(randomAdjacent({ ...newGame(2), cells: Int8Array.from([1, 2, 1, 2]) }, rng)).toBe(-1);
    expect(chooseMove({ ...newGame(2), cells: Int8Array.from([1, 2, 1, 2]) }, 'hard', rng)).toBe(-1);
  });
  it('every level plays a free cell, and is deterministic for a seed (with a fixed clock)', () => {
    const rng = mulberry32(9);
    const fast = { now: () => 0, budgetMs: 1e9 };
    for (let g = 0; g < 12; g++) {
      let s = newGame(7);
      const plies = g * 3;
      for (let i = 0; i < plies; i++) { const e = emptyCells(s); const n2 = playMove(s, e[Math.floor(rng() * e.length)]); if (!n2 || outcome(n2).over) break; s = n2; }
      for (const level of ['easy', 'medium', 'hard'] as Level[]) {
        const m = chooseMove(s, level, mulberry32(g), fast);
        expect(s.cells[m]).toBe(0);
        expect(chooseMove(s, level, mulberry32(g), fast)).toBe(m);
      }
    }
  }, 60_000);
  it('opens in the centre on a plain board and modestly when the swap rule is on', () => {
    expect(chooseMove(newGame(11), 'medium', mulberry32(1))).toBe(centreOf(11));
    expect(chooseMove(newGame(7), 'hard', mulberry32(1))).toBe(centreOf(7));
    expect(edgeDistance(9, chooseMove(newGame(9, true), 'hard', mulberry32(1)))).toBe(1);
  });
  it('runs the stated number of playouts (counted through the random numbers it uses)', () => {
    expect(MEDIUM_PLAYOUTS).toBe(500);
    expect(HARD_PLAYOUTS).toBe(8000);
    const s = playMove(playMove(newGame(7), 24)!, 25)!;
    const cands = candidateCells(s).length;
    const empties = emptyCells(s).length;
    for (const playouts of [MEDIUM_PLAYOUTS, HARD_PLAYOUTS]) {
      let calls = 0;
      const base = mulberry32(3);
      const rng = () => { calls++; return base(); };
      mcMove(s, playouts, rng, { now: () => 0, budgetMs: 1e9 });
      // shuffling the candidates uses (cands - 1) numbers, each playout fills (empties - 1) cells and shuffles them with (empties - 2).
      expect(calls).toBe((cands - 1) + playouts * (empties - 2));
    }
  });
  it('takes the winning cell when one stone completes a chain', () => {
    const n = 5;
    let s = newGame(n);
    // Sky on row 2 except column 2; Rose stones scattered elsewhere; Sky to move.
    const sky = [2 * n + 0, 2 * n + 1, 2 * n + 3, 2 * n + 4];
    const rose = [0, 1, 4 * n + 4, 4 * n + 3];
    const cells = new Int8Array(n * n);
    sky.forEach((i) => { cells[i] = SKY; });
    rose.forEach((i) => { cells[i] = ROSE; });
    s = { ...s, cells, toMove: SKY, plies: 8 };
    const gap = 2 * n + 2;
    for (const level of ['medium', 'hard'] as Level[]) {
      for (const seed of [1, 2, 3, 4]) expect(chooseMove(s, level, mulberry32(seed), { now: () => 0, budgetMs: 1e9 })).toBe(gap);
    }
  });
  it('Medium beats Easy in at least 5 of 6 seeded games on 7 x 7, alternating colours', () => {
    expect(playGames('medium', 6)).toBeGreaterThanOrEqual(5);
  }, 120_000);
  it('Hard beats Easy in at least 5 of 6 seeded games on 7 x 7, alternating colours', () => {
    expect(playGames('hard', 6)).toBeGreaterThanOrEqual(5);
  }, 120_000);
});

/** Wins by the strong level over Easy; colours alternate, nothing is shared between games. */
const playGames = (strong: Level, games: number): number => {
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const strongSide: Player = g % 2 === 0 ? SKY : ROSE;
    const rng = mulberry32(500 + g);
    let s = newGame(7);
    let guard = 0;
    while (!outcome(s).over && guard++ < 60) {
      const level: Level = s.toMove === strongSide ? strong : 'easy';
      const m = chooseMove(s, level, rng, { now: () => 0, budgetMs: 1e9 });
      s = playMove(s, m)!;
    }
    if (outcome(s).winner === strongSide) wins++;
  }
  return wins;
};

describe('time budget', () => {
  it('Hard answers 11 x 11 positions within a generous bound, with the real settings', () => {
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
    const rng = mulberry32(42);
    let worst = 0;
    let count = 0;
    for (let g = 0; g < 10; g++) {
      let s = newGame(11);
      const plies = 2 + g * 9;
      for (let i = 0; i < plies; i++) { const e = emptyCells(s); const next = playMove(s, e[Math.floor(rng() * e.length)]); if (!next || outcome(next).over) break; s = next; }
      if (outcome(s).over) continue;
      const t0 = performance.now();
      const m = chooseMove(s, 'hard', rng);
      const dt = performance.now() - t0;
      worst = Math.max(worst, dt);
      count++;
      expect(s.cells[m]).toBe(0);
    }
    expect(count).toBeGreaterThan(7);
    expect(worst).toBeLessThan(4000);
  }, 120_000);
  it('with a fast seeded generator the full Hard search finishes inside the budget on an empty-ish 11 x 11 board', () => {
    // The page seeds mulberry32 once per thinking turn (a per-number system call was ~50x slower and used up the whole budget).
    // A fake clock that advances 1 ms per reading proves every one of the playouts ran before the 0.8 s budget ended.
    let ticks = 0;
    let calls = 0;
    const base = mulberry32(11);
    const rng = () => { calls++; return base(); };
    const s = playMove(playMove(newGame(11), 60)!, 61)!;
    const cands = candidateCells(s).length;
    const empties = emptyCells(s).length;
    mcMove(s, HARD_PLAYOUTS, rng, { now: () => ticks++, budgetMs: HARD_BUDGET_MS });
    // The deadline is read once up front and then once every 32 playouts, so 8000 playouts need about 250 readings: far below 800.
    expect(ticks).toBeLessThan(HARD_BUDGET_MS);
    expect(calls).toBe((cands - 1) + HARD_PLAYOUTS * (empties - 2));
  }, 60_000);
  it('stops playing out when the clock runs out and still returns a free cell', () => {
    const s = playMove(newGame(11), 60)!;
    let t = 0;
    const m = mcMove(s, 1e9, mulberry32(1), { now: () => (t += 10), budgetMs: 500 });
    expect(s.cells[m]).toBe(0);
    expect(mcMove(s, 5, mulberry32(1), { now: () => 0, budgetMs: 0 })).toBeGreaterThanOrEqual(0);
  });
});

describe('words and bookkeeping', () => {
  it('names the sides', () => {
    expect(nameOf(SKY)).toBe('Sky');
    expect(nameOf(ROSE)).toBe('Rose');
    expect(otherPlayer(SKY)).toBe(ROSE);
    expect(sideLabel(SKY, null)).toBe('Sky');
    expect(sideLabel(SKY, SKY)).toBe('You (Sky)');
    expect(sideLabel(ROSE, SKY)).toBe('Computer (Rose)');
  });
  it('describes every result', () => {
    expect(describeResult(0, null)).toBe('The game is not finished.');
    expect(describeResult(SKY, null)).toBe('Sky wins by joining left to right.');
    expect(describeResult(ROSE, null)).toBe('Rose wins by joining top to bottom.');
    expect(describeResult(SKY, SKY)).toBe('You win! Your Sky chain joins left to right.');
    expect(describeResult(ROSE, SKY)).toBe('The computer wins with a Rose chain from top to bottom.');
    expect(describeResult(ROSE, ROSE)).toBe('You win! Your Rose chain joins top to bottom.');
  });
  it('pluralises, keeps notes and finds the undo target', () => {
    expect(stonesText(1)).toBe('1 stone');
    expect(stonesText(0)).toBe('0 stones');
    expect(stonesText(12)).toBe('12 stones');
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Swapped.')).toBe('Swapped. Computer is thinking...');
    expect(undoIndex([], SKY)).toBe(-1);
    expect(undoIndex([SKY, ROSE, SKY, ROSE], SKY)).toBe(2);
    expect(undoIndex([SKY, ROSE, SKY, ROSE], ROSE)).toBe(3);
    expect(undoIndex([ROSE, ROSE], SKY)).toBe(-1);
    expect(undoIndex([SKY, ROSE, SKY], null)).toBe(2);
  });
  it('cleans the size and the level from the address bar', () => {
    expect(cleanSize('7')).toBe(7);
    expect(cleanSize(9)).toBe(9);
    expect(cleanSize('11')).toBe(11);
    for (const junk of ['0', '8', '12', '99', '-7', '7.5', 'abc', '', '1e1', '__proto__', NaN, Infinity, null, undefined, [], {}, '٧']) {
      expect(cleanSize(junk)).toBe(DEFAULT_SIZE);
    }
    expect(cleanSize('x', 7)).toBe(7);
    expect(cleanLevel('hard')).toBe('hard');
    expect(cleanLevel('nope')).toBe('medium');
    expect(cleanLevel(undefined, 'easy')).toBe('easy');
    expect(cleanLevel('constructor')).toBe('medium');
  });
});

describe('the page keeps the move sentence when the computer starts thinking', () => {
  it('"Computer is thinking..." is appended to the sentence just announced (the stone placed or the swap), not put in its place', () => {
    expect(calculatorSource).toContain('thinkingMessage(carry)');
    expect(calculatorSource).not.toContain('thinkingMessage(note)');
    expect(calculatorSource).toContain('carry = msg;');
    expect(thinkingMessage('You placed a Sky stone at D4.')).toBe('You placed a Sky stone at D4. Computer is thinking...');
  });
  it('Hard stops playing out after 0.4 of a second at most, as the page says', () => {
    expect(HARD_BUDGET_MS).toBe(400);
  });
});
