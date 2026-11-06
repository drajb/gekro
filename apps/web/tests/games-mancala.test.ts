/**
 * games-mancala.test.ts - the engine behind `mancala` (the classic six-pit rules).
 *
 * Pinned: the opening position, sowing round the ring and past the opponent's store,
 * extra turns, captures (and the cases where nothing is captured), the end-of-game
 * sweep, the safety limit on game length, illegal input, seed conservation, a second
 * independently written implementation of the rules (two arrays per side and a
 * track of 2n + 1 cells, no shared code) compared with the engine over thousands of
 * random games, the whole state space of the 3-pit board checked for loops, the
 * alpha-beta search compared with a plain minimax with no pruning (exact on the
 * 3-pit board, depth-limited on the real one), the three computer levels (legal,
 * deterministic for a seed, Medium and Hard beat Easy), and the time budget.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, applyMove, isOver, result, sideSeeds, totalSeeds, storeOf, storeIndex, firstPit, otherPlayer, pitOwner, isStore, oppositeOf,
  cellsOf, evaluate, terminalScore, searchValue, bestMove, deepMove, randomMove, chooseMove, mulberry32, shuffled,
  seedsText, nameOf, describeResult, thinkingMessage, undoIndex, cleanSeeds, cleanLevel,
  PITS, SEED_CHOICES, DEFAULT_SEEDS, MAX_PLIES, MEDIUM_DEPTH, HARD_DEPTH, HARD_BUDGET_MS, HARD_NODE_CAP, lastSearchNodes, WIN_SCORE,
  type State, type Player, type Level,
} from '../src/components/apps-private/mancala/helpers';
import calculatorSource from '../src/components/apps-private/mancala/Calculator.astro?raw';

/** Build a state from the six (n) pits of each side and the two stores. */
const mk = (n: number, side0: number[], store0: number, side1: number[], store1: number, toMove: Player = 0, plies = 0): State => {
  const pits = new Int8Array(2 * n + 2);
  side0.forEach((v, i) => { pits[i] = v; });
  pits[n] = store0;
  side1.forEach((v, i) => { pits[n + 1 + i] = v; });
  pits[2 * n + 1] = store1;
  return { n, pits, toMove, plies };
};
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);

// ── An independent implementation of the six-pit rules (the oracle) ─────────────────────
// Each side is its own array of n pits numbered in the direction the seeds travel; a player's
// "track" is [own pits 0..n-1, own store, opponent pits 0..n-1] and seeds walk round it, which
// is how the opponent's store gets skipped without any index arithmetic on a 2n + 2 ring.

interface Ref { pits: [number[], number[]]; store: [number, number]; toMove: Player }

const toRef = (s: State): Ref => ({
  pits: [Array.from(s.pits.slice(0, s.n)), Array.from(s.pits.slice(s.n + 1, 2 * s.n + 1))],
  store: [s.pits[s.n], s.pits[2 * s.n + 1]],
  toMove: s.toMove,
});
const refOver = (r: Ref): boolean => sum(r.pits[0]) === 0 || sum(r.pits[1]) === 0;
const refMoves = (r: Ref): number[] => (refOver(r) ? [] : r.pits[r.toMove].map((v, k) => (v > 0 ? k : -1)).filter((k) => k >= 0));
const toPit = (r: Ref, k: number, n: number): number => (r.toMove === 0 ? k : n + 1 + k);

interface RefPlay { ref: Ref; extra: boolean; captured: number; lastOnOwnSide: number }
const refPlay = (r: Ref, k: number): RefPlay => {
  const n = r.pits[0].length;
  const p = r.toMove;
  const q = (1 - p) as Player;
  const pits: [number[], number[]] = [r.pits[0].slice(), r.pits[1].slice()];
  const store: [number, number] = [r.store[0], r.store[1]];
  let seeds = pits[p][k];
  pits[p][k] = 0;
  const len = 2 * n + 1;
  let pos = k;
  const put = (at: number): void => {
    if (at < n) pits[p][at]++;
    else if (at === n) store[p]++;
    else pits[q][at - n - 1]++;
  };
  while (seeds > 0) { pos = (pos + 1) % len; put(pos); seeds--; }
  const extra = pos === n;
  let captured = 0;
  if (pos < n && pits[p][pos] === 1 && pits[q][n - 1 - pos] > 0) {
    captured = pits[q][n - 1 - pos] + 1;
    store[p] += captured;
    pits[p][pos] = 0;
    pits[q][n - 1 - pos] = 0;
  }
  if (sum(pits[0]) === 0 || sum(pits[1]) === 0) {
    store[0] += sum(pits[0]);
    store[1] += sum(pits[1]);
    pits[0] = pits[0].map(() => 0);
    pits[1] = pits[1].map(() => 0);
  }
  return { ref: { pits, store, toMove: extra ? p : q }, extra, captured, lastOnOwnSide: pos < n ? pos : -1 };
};

const T = (d: number): number => (d > 0 ? WIN_SCORE + d : d < 0 ? -WIN_SCORE + d : 0);
const refEval = (r: Ref): number => {
  const me = r.toMove;
  const opp = (1 - me) as Player;
  return 10 * (r.store[me] - r.store[opp]) + 2 * (sum(r.pits[me]) - sum(r.pits[opp])) + 3;
};
/** Plain minimax with no pruning and no move ordering. */
const refValue = (r: Ref, depth: number, memo?: Map<string, number>): number => {
  if (refOver(r)) return T(r.store[r.toMove] - r.store[1 - r.toMove]);
  if (depth <= 0) return refEval(r);
  const key = memo ? JSON.stringify([r.pits, r.store, r.toMove]) : '';
  if (memo) { const hit = memo.get(key); if (hit !== undefined) return hit; }
  let best = -Infinity;
  for (const k of refMoves(r)) {
    const c = refPlay(r, k);
    const v = c.ref.toMove === r.toMove ? refValue(c.ref, depth - 1, memo) : -refValue(c.ref, depth - 1, memo);
    if (v > best) best = v;
  }
  if (memo) memo.set(key, best);
  return best;
};

/** A random game: yields every position on the way. */
const randomGame = (n: number, seeds: number, rng: () => number, maxPlies = 600): State[] => {
  let s = newGame(n, seeds, rng() < 0.5 ? 0 : 1);
  const out = [s];
  for (let i = 0; i < maxPlies && !isOver(s); i++) {
    const m = legalMoves(s);
    s = applyMove(s, m[Math.floor(rng() * m.length)])!.state;
    out.push(s);
  }
  return out;
};

describe('geometry', () => {
  it('has 2n + 2 cells with a store after each side', () => {
    expect(cellsOf(6)).toBe(14);
    expect(storeIndex(0, 6)).toBe(6);
    expect(storeIndex(1, 6)).toBe(13);
    expect(firstPit(0, 6)).toBe(0);
    expect(firstPit(1, 6)).toBe(7);
    expect(otherPlayer(0)).toBe(1);
    expect(otherPlayer(1)).toBe(0);
  });
  it('tells pits from stores and gives every pit exactly one opposite', () => {
    for (let i = 0; i < 14; i++) {
      if (isStore(i, 6)) expect(pitOwner(i, 6)).toBeNull();
      else {
        expect(pitOwner(i, 6)).toBe(i < 6 ? 0 : 1);
        const o = oppositeOf(i, 6);
        expect(pitOwner(o, 6)).toBe(i < 6 ? 1 : 0);
        expect(oppositeOf(o, 6)).toBe(i);
      }
    }
    expect(oppositeOf(0, 6)).toBe(12);
    expect(oppositeOf(5, 6)).toBe(7);
    expect(pitOwner(-1, 6)).toBeNull();
    expect(pitOwner(99, 6)).toBeNull();
  });
});

describe('opening position', () => {
  const s = newGame();
  it('has 6 pits of 4 seeds per side, empty stores and 48 seeds', () => {
    expect(PITS).toBe(6);
    expect(DEFAULT_SEEDS).toBe(4);
    expect(SEED_CHOICES).toEqual([3, 4, 5]);
    expect(Array.from(s.pits)).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(totalSeeds(s)).toBe(48);
    expect(s.toMove).toBe(0);
    expect(isOver(s)).toBe(false);
  });
  it('offers all six pits to the first player and six to the second', () => {
    expect(legalMoves(s)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(legalMoves(newGame(6, 4, 1))).toEqual([7, 8, 9, 10, 11, 12]);
  });
  it('has the 3 and 5 seed options and rejects junk sizes', () => {
    expect(totalSeeds(newGame(6, 3))).toBe(36);
    expect(totalSeeds(newGame(6, 5))).toBe(60);
    expect(() => newGame(0, 4)).toThrow(RangeError);
    expect(() => newGame(9, 4)).toThrow(RangeError);
    expect(() => newGame(6, 0)).toThrow(RangeError);
    expect(() => newGame(6, 7)).toThrow(RangeError);
    expect(() => newGame(6.5, 4)).toThrow(RangeError);
    expect(() => newGame(NaN, 4)).toThrow(RangeError);
  });
  it('gives exactly one extra-turn opening with 4 seeds (the third pit) and none that capture', () => {
    const results = legalMoves(s).map((m) => applyMove(s, m)!);
    expect(results.filter((r) => r.extra).map((r) => r.pit)).toEqual([2]);
    expect(results.every((r) => r.captured === 0)).toBe(true);
  });
});

describe('sowing', () => {
  it('drops one seed in each following cell, including the own store', () => {
    const r = applyMove(newGame(), 2)!;
    expect(r.path).toEqual([3, 4, 5, 6]);
    expect(Array.from(r.state.pits)).toEqual([4, 4, 0, 5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 0]);
    expect(r.extra).toBe(true);
    expect(r.state.toMove).toBe(0);
    expect(r.state.plies).toBe(1);
  });
  it('passes the turn when the last seed does not land in the store', () => {
    const r = applyMove(newGame(), 0)!;
    expect(r.path).toEqual([1, 2, 3, 4]);
    expect(r.extra).toBe(false);
    expect(r.state.toMove).toBe(1);
  });
  it('carries on into the opponent pits', () => {
    const r = applyMove(newGame(), 5)!;
    expect(r.path).toEqual([6, 7, 8, 9]);
    expect(Array.from(r.state.pits)).toEqual([4, 4, 4, 4, 4, 0, 1, 5, 5, 5, 4, 4, 4, 0]);
  });
  it('skips the opponent store and wraps to the own side', () => {
    const s = mk(6, [0, 0, 0, 0, 0, 9], 0, [1, 1, 1, 1, 1, 1], 0);
    const r = applyMove(s, 5)!;
    expect(r.path).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1]); // 13 (the second store) is skipped
    expect(r.state.pits[13]).toBe(0);
    expect(r.state.pits[0]).toBe(1);
    // The last seed fell in the empty pit 1 opposite pit 11 (1 + the seed just sown = 2): 2 + 1 are captured.
    expect(r.captured).toBe(3);
    expect(r.state.pits[6]).toBe(1 + 3);
    expect(r.state.pits[1]).toBe(0);
  });
  it('skips the first player store when the second player sows round', () => {
    const s = mk(6, [1, 1, 1, 1, 1, 1], 0, [0, 0, 0, 0, 0, 9], 0, 1);
    const r = applyMove(s, 12)!;
    expect(r.path).toEqual([13, 0, 1, 2, 3, 4, 5, 7, 8]); // 6 (the first store) is skipped
    expect(r.state.pits[6]).toBe(0);
    expect(r.state.pits[13]).toBe(1 + 3); // the store pass plus a capture of pit 4 (1 + 1) and the capturing seed
  });
  it('a lap of 13 seeds comes back to the starting pit, which then holds one seed', () => {
    const s = mk(6, [13, 0, 0, 0, 0, 0], 0, [0, 1, 1, 1, 1, 1], 0);
    const r = applyMove(s, 0)!;
    expect(r.path).toHaveLength(13);
    expect(r.path[12]).toBe(0);
    expect(new Set(r.path).size).toBe(13); // every cell except the second store got exactly one
    expect(r.path).not.toContain(13);
    expect(totalSeeds(r.state)).toBe(totalSeeds(s));
  });
  it('never mutates the state it is given', () => {
    const s = newGame();
    const copy = Array.from(s.pits);
    applyMove(s, 3);
    expect(Array.from(s.pits)).toEqual(copy);
    expect(s.plies).toBe(0);
  });
});

describe('captures', () => {
  it('takes the opposite pit and the capturing seed when the last seed lands in an empty own pit', () => {
    const s = mk(6, [1, 0, 0, 0, 0, 2], 0, [3, 4, 5, 6, 7, 8], 0);
    // First pit holds 1 seed -> lands in pit 1 (empty); opposite of index 1 is index 11 (holding 7).
    const r = applyMove(s, 0)!;
    expect(r.captured).toBe(8);
    expect(r.capturedFrom).toBe(oppositeOf(1, 6));
    expect(r.state.pits[6]).toBe(8);
    expect(r.state.pits[1]).toBe(0);
    expect(r.state.pits[11]).toBe(0);
    expect(r.state.toMove).toBe(1);
  });
  it('captures for the second player too', () => {
    const s = mk(6, [2, 3, 4, 5, 6, 7], 0, [1, 0, 0, 0, 0, 3], 0, 1);
    const r = applyMove(s, 7)!;
    // The seed lands in the empty pit 8, opposite pit 4 (holding 6): 6 + 1 are captured.
    expect(r.captured).toBe(7);
    expect(r.state.pits[13]).toBe(7);
    expect(r.state.pits[8]).toBe(0);
    expect(r.state.pits[oppositeOf(8, 6)]).toBe(0);
  });
  it('captures nothing when the opposite pit is empty and leaves the seed where it fell', () => {
    const t = mk(6, [1, 0, 0, 0, 0, 0], 0, [3, 4, 5, 6, 0, 8], 0);
    expect(t.pits[11]).toBe(0); // the pit opposite index 1
    const r = applyMove(t, 0)!;
    expect(r.captured).toBe(0);
    expect(r.capturedFrom).toBe(-1);
    expect(r.state.pits[1]).toBe(1);
  });
  it('captures nothing when the last seed lands in a pit that already had seeds', () => {
    const s = mk(6, [1, 2, 0, 0, 0, 0], 0, [3, 4, 5, 6, 7, 8], 0);
    expect(applyMove(s, 0)!.captured).toBe(0);
  });
  it('captures nothing when the last seed lands on the opponent side', () => {
    const s = mk(6, [0, 0, 0, 0, 3, 0], 0, [0, 0, 0, 0, 0, 5], 0);
    const r = applyMove(s, 4)!;
    expect(r.path).toEqual([5, 6, 7]);
    expect(r.captured).toBe(0);
    expect(r.extra).toBe(false);
    const t = mk(6, [0, 0, 0, 0, 0, 2], 0, [0, 3, 0, 0, 0, 5], 0);
    const r2 = applyMove(t, 5)!;
    expect(r2.path).toEqual([6, 7]);
    expect(r2.captured).toBe(0);
  });
  it('an extra turn is never a capture', () => {
    const s = mk(6, [0, 0, 0, 0, 0, 1], 0, [3, 4, 5, 6, 7, 8], 0);
    const r = applyMove(s, 5)!;
    expect(r.extra).toBe(true);
    expect(r.captured).toBe(0);
  });
  it('a lap that ends in the (now empty) starting pit captures the opposite pit', () => {
    const s = mk(6, [13, 0, 0, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0);
    const r = applyMove(s, 0)!;
    // Every pit got one seed on the way round, so the opposite pit holds 2 when the last seed lands.
    expect(r.captured).toBe(3);
    expect(r.capturedFrom).toBe(12);
    expect(r.state.pits[6]).toBe(1 + 3);
    expect(r.state.pits[0]).toBe(0);
  });
});

describe('end of the game', () => {
  it('ends when a side runs out and the other side keeps its own seeds', () => {
    const s = mk(6, [0, 0, 0, 0, 0, 1], 10, [0, 2, 0, 3, 0, 0], 12);
    const r = applyMove(s, 5)!; // last seed into the store: the first side is now empty
    expect(r.over).toBe(true);
    expect(r.swept).toBe(5);
    expect(isOver(r.state)).toBe(true);
    expect(Array.from(r.state.pits)).toEqual([0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 17]);
    expect(result(r.state)).toEqual({ scores: [11, 17], margin: -6, winner: 1 });
    expect(legalMoves(r.state)).toEqual([]);
    expect(applyMove(r.state, 0)).toBeNull();
  });
  it('ends when the move empties the opponent side, and the mover keeps what is left on their own side', () => {
    const s = mk(6, [3, 0, 0, 0, 0, 0], 20, [0, 0, 0, 0, 0, 1], 5, 1);
    // second player plays their only pit; it goes into their store (index 13 is skipped? no: pit 12 -> 13)
    const r = applyMove(s, 12)!;
    expect(r.extra).toBe(true);
    expect(r.over).toBe(true);
    expect(r.state.pits[13]).toBe(6);
    expect(r.state.pits[6]).toBe(23);
    expect(totalSeeds(r.state)).toBe(29);
  });
  it('a capture that empties both sides also ends the game', () => {
    const s = mk(6, [1, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 5, 0], 0);
    const r = applyMove(s, 0)!;
    expect(r.captured).toBe(6); // opposite of index 1 is index 11, holding 5
    expect(r.over).toBe(true);
    expect(r.swept).toBe(0);
    expect(result(r.state)).toEqual({ scores: [6, 0], margin: 6, winner: 0 });
  });
  it('reports a draw, a first-player win and a second-player win', () => {
    expect(result(mk(6, [0, 0, 0, 0, 0, 0], 24, [0, 0, 0, 0, 0, 0], 24)).winner).toBe('draw');
    expect(result(mk(6, [0, 0, 0, 0, 0, 0], 30, [0, 0, 0, 0, 0, 0], 18)).winner).toBe(0);
    expect(result(mk(6, [0, 0, 0, 0, 0, 0], 18, [0, 0, 0, 0, 0, 0], 30)).winner).toBe(1);
  });
  it('stops after MAX_PLIES moves and gives each side its own seeds', () => {
    expect(MAX_PLIES).toBe(1000);
    const s = mk(6, [1, 1, 1, 1, 1, 1], 0, [1, 1, 1, 1, 1, 1], 0, 0, MAX_PLIES - 1);
    const r = applyMove(s, 0)!;
    expect(r.over).toBe(true);
    expect(isOver(r.state)).toBe(true);
    expect(totalSeeds(r.state)).toBe(12);
    expect(sideSeeds(r.state, 0)).toBe(0);
    expect(sideSeeds(r.state, 1)).toBe(0);
  });
});

describe('illegal input', () => {
  const s = newGame();
  it('rejects empty pits, the opponent pits, stores, out-of-range and non-integer input', () => {
    const e = mk(6, [0, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0);
    expect(applyMove(e, 0)).toBeNull();
    expect(applyMove(s, 7)).toBeNull();
    expect(applyMove(s, 6)).toBeNull();
    expect(applyMove(s, 13)).toBeNull();
    expect(applyMove(s, -1)).toBeNull();
    expect(applyMove(s, 14)).toBeNull();
    expect(applyMove(s, 1.5)).toBeNull();
    expect(applyMove(s, NaN)).toBeNull();
    expect(applyMove(s, Infinity)).toBeNull();
    expect(applyMove(s, '2' as unknown as number)).toBeNull();
  });
});

describe('the rules match an independent implementation', () => {
  it('agrees on legal moves, resulting boards, extra turns and captures over 3000 random games', () => {
    const rng = mulberry32(20261105);
    let positions = 0;
    let extras = 0;
    let captures = 0;
    let maxPlies = 0;
    for (let g = 0; g < 3000; g++) {
      const n = [3, 4, 6][g % 3];
      const seeds = 1 + (g % 5);
      let s = newGame(n, seeds, g % 2 === 0 ? 0 : 1);
      const total = totalSeeds(s);
      let plies = 0;
      while (!isOver(s)) {
        const ref = toRef(s);
        expect(legalMoves(s)).toEqual(refMoves(ref).map((k) => toPit(ref, k, n)));
        const ks = refMoves(ref);
        const k = ks[Math.floor(rng() * ks.length)];
        const rp = refPlay(ref, k);
        const mr = applyMove(s, toPit(ref, k, n))!;
        expect(toRef(mr.state)).toEqual(rp.ref);
        expect(mr.extra).toBe(rp.extra);
        expect(mr.captured).toBe(rp.captured);
        expect(totalSeeds(mr.state)).toBe(total);
        if (mr.extra) extras++;
        if (mr.captured) captures++;
        s = mr.state;
        plies++;
        positions++;
      }
      maxPlies = Math.max(maxPlies, plies);
      expect(isOver(s)).toBe(true);
      expect(sideSeeds(s, 0) + sideSeeds(s, 1)).toBe(0);
      expect(storeOf(s, 0) + storeOf(s, 1)).toBe(total);
      expect(refOver(toRef(s))).toBe(true);
    }
    expect(positions).toBeGreaterThan(20000);
    expect(extras).toBeGreaterThan(500);
    expect(captures).toBeGreaterThan(500);
    // Random play ends long before the safety limit.
    expect(maxPlies).toBeLessThan(MAX_PLIES / 2);
  }, 60_000);

  it('keeps every seed: pits plus stores always add up to the starting total', () => {
    const rng = mulberry32(5);
    for (let g = 0; g < 300; g++) {
      for (const s of randomGame(6, SEED_CHOICES[g % 3], rng)) expect(totalSeeds(s)).toBe(12 * SEED_CHOICES[g % 3]);
    }
  });
});

describe('the whole 3-pit, 2-seed game', () => {
  // Every position reachable from the start, found by exhaustive search. No position repeats on any
  // path (the game cannot loop), and it is small enough to solve exactly.
  const n = 3;
  const start = newGame(n, 2);
  const key = (s: State): string => `${Array.from(s.pits).join(',')}|${s.toMove}`;
  const seen = new Map<string, State>();
  const onPath = new Set<string>();
  let cycle = false;
  let longest = 0;
  const depthOf = new Map<string, number>();
  const walk = (s: State): number => {
    const k = key(s);
    if (onPath.has(k)) { cycle = true; return 0; }
    const known = depthOf.get(k);
    if (known !== undefined) return known;
    seen.set(k, s);
    onPath.add(k);
    let d = 0;
    for (const m of legalMoves(s)) d = Math.max(d, 1 + walk(applyMove(s, m)!.state));
    onPath.delete(k);
    depthOf.set(k, d);
    return d;
  };
  longest = walk(start);

  it('has no loops and a bounded length', () => {
    expect(cycle).toBe(false);
    expect(seen.size).toBeGreaterThan(50);
    expect(longest).toBeLessThan(60);
  });

  it('the alpha-beta search agrees with plain minimax with no pruning on every position', () => {
    const memo = new Map<string, number>();
    let checked = 0;
    for (const s of seen.values()) {
      if (isOver(s)) continue;
      const exact = refValue(toRef(s), 1000, memo);
      expect(searchValue(s, 1000) + 0).toBe(exact + 0); // + 0 turns a negated zero (-0) into 0
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  }, 60_000);

  it('bestMove chooses a move whose exact value is the best, whatever the seed', () => {
    const memo = new Map<string, number>();
    let checked = 0;
    for (const s of seen.values()) {
      if (isOver(s)) continue;
      const ref = toRef(s);
      const values = refMoves(ref).map((k) => {
        const c = refPlay(ref, k);
        return { pit: toPit(ref, k, n), v: c.ref.toMove === ref.toMove ? refValue(c.ref, 1000, memo) : -refValue(c.ref, 1000, memo) };
      });
      const top = Math.max(...values.map((x) => x.v));
      const optimal = values.filter((x) => x.v === top).map((x) => x.pit);
      for (const seed of [1, 2, 3]) expect(optimal).toContain(bestMove(s, 1000, mulberry32(seed)));
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  }, 60_000);

  it('the first player with 2 seeds in 3 pits has a definite value that both implementations agree on', () => {
    const v = refValue(toRef(start), 1000, new Map());
    expect(searchValue(start, 1000) + 0).toBe(v + 0);
    expect(Number.isInteger(v)).toBe(true);
    expect(Math.abs(v)).toBeLessThanOrEqual(WIN_SCORE + 24);
  });
});

describe('the depth-limited search matches a plain depth-limited minimax on the real board', () => {
  it('gives the same value at depths 1 to 4 for random positions from random games', () => {
    const rng = mulberry32(777);
    let checked = 0;
    for (let g = 0; g < 14; g++) {
      const states = randomGame(6, SEED_CHOICES[g % 3], rng);
      for (let k = 0; k < states.length; k += 3) {
        const s = states[k];
        if (isOver(s)) continue;
        for (let d = 1; d <= 4; d++) {
          expect(searchValue(s, d) + 0).toBe(refValue(toRef(s), d) + 0);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  }, 120_000);

  it('values a finished game exactly and a won position above any heuristic score', () => {
    const won = mk(6, [0, 0, 0, 0, 0, 0], 30, [0, 0, 0, 0, 0, 0], 18);
    expect(terminalScore(won)).toBe(WIN_SCORE + 12);
    expect(terminalScore({ ...won, toMove: 1 })).toBe(-WIN_SCORE - 12);
    expect(terminalScore(mk(6, [0, 0, 0, 0, 0, 0], 24, [0, 0, 0, 0, 0, 0], 24))).toBe(0);
    expect(searchValue(won, 5)).toBe(WIN_SCORE + 12);
    const s = newGame();
    expect(Math.abs(evaluate(s))).toBeLessThan(WIN_SCORE);
    expect(evaluate(s)).toBe(3); // level: stores 0 to 0, 24 seeds each, plus the small bonus for having the move
  });
});

describe('computer players', () => {
  it('Easy returns a legal pit, is deterministic for a seed and varies between seeds', () => {
    const s = newGame();
    const a = randomMove(s, mulberry32(1));
    expect(legalMoves(s)).toContain(a);
    expect(randomMove(s, mulberry32(1))).toBe(a);
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(randomMove(s, mulberry32(i)));
    expect(seen.size).toBeGreaterThan(3);
    expect(randomMove(mk(6, [0, 0, 0, 0, 0, 0], 20, [0, 0, 0, 0, 0, 0], 28), mulberry32(1))).toBe(-1);
  });
  it('every level plays a legal move in every position of 40 random games, and returns -1 when the game is over', () => {
    const rng = mulberry32(99);
    const fast = { now: () => 0, maxDepth: 4 };
    for (let g = 0; g < 40; g++) {
      for (const s of randomGame(6, SEED_CHOICES[g % 3], rng)) {
        for (const level of ['easy', 'medium', 'hard'] as Level[]) {
          const m = chooseMove(s, level, mulberry32(g), fast);
          if (isOver(s)) expect(m).toBe(-1);
          else expect(legalMoves(s)).toContain(m);
        }
      }
    }
  }, 120_000);
  it('Medium and Hard are deterministic for a seed (with a fixed clock)', () => {
    const s = applyMove(newGame(), 0)!.state;
    expect(bestMove(s, MEDIUM_DEPTH, mulberry32(4))).toBe(bestMove(s, MEDIUM_DEPTH, mulberry32(4)));
    const o = { now: () => 0, maxDepth: 6 };
    expect(deepMove(s, mulberry32(4), o)).toBe(deepMove(s, mulberry32(4), o));
  });
  it('Medium (4 moves) beats Easy in at least 10 of 12 seeded games, alternating who sows first', () => {
    let wins = 0;
    for (let g = 0; g < 12; g++) {
      const mediumSide: Player = (g % 2) as Player;
      const rng = mulberry32(1000 + g);
      let s = newGame(6, 4, 0);
      let guard = 0;
      while (!isOver(s) && guard++ < 400) {
        const m = s.toMove === mediumSide ? chooseMove(s, 'medium', rng) : chooseMove(s, 'easy', rng);
        s = applyMove(s, m)!.state;
      }
      expect(isOver(s)).toBe(true);
      const r = result(s);
      if (r.winner === mediumSide) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(10);
  }, 120_000);
  it('Hard (searching 5 moves here) beats Easy in at least 5 of 6 seeded games', () => {
    let wins = 0;
    for (let g = 0; g < 6; g++) {
      const hardSide: Player = (g % 2) as Player;
      const rng = mulberry32(2000 + g);
      let s = newGame(6, 4, 0);
      let guard = 0;
      while (!isOver(s) && guard++ < 400) {
        const m = s.toMove === hardSide ? chooseMove(s, 'hard', rng, { maxDepth: 5, budgetMs: 5000 }) : chooseMove(s, 'easy', rng);
        s = applyMove(s, m)!.state;
      }
      if (result(s).winner === hardSide) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 120_000);
});

describe('time budget', () => {
  it('states the numbers the page quotes', () => {
    expect(MEDIUM_DEPTH).toBe(4);
    expect(HARD_DEPTH).toBe(8);
    expect(HARD_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
  it('Hard answers every position it is asked about within a generous bound, with the real settings', () => {
    const rng = mulberry32(31337);
    let worst = 0;
    let count = 0;
    for (let g = 0; g < 10; g++) {
      const states = randomGame(6, SEED_CHOICES[g % 3], rng);
      for (let k = 0; k < states.length; k += 4) {
        const s = states[k];
        if (isOver(s)) continue;
        const t0 = performance.now();
        const m = deepMove(s, rng);
        const dt = performance.now() - t0;
        worst = Math.max(worst, dt);
        count++;
        expect(legalMoves(s)).toContain(m);
      }
    }
    expect(count).toBeGreaterThan(20);
    // Design cap is 1 s; allow a lot more for a loaded machine.
    expect(worst).toBeLessThan(4000);
  }, 120_000);
  it('answers the opening within the bound for each seed count', () => {
    for (const seeds of SEED_CHOICES) {
      const t0 = performance.now();
      const m = deepMove(newGame(6, seeds), mulberry32(seeds));
      expect(performance.now() - t0).toBeLessThan(4000);
      expect(legalMoves(newGame(6, seeds))).toContain(m);
    }
  }, 30_000);
  it('stops deepening when the clock runs out: a zero budget still gives a legal move from the first finished depth', () => {
    const s = newGame();
    const m = deepMove(s, mulberry32(3), { budgetMs: 0 });
    expect(legalMoves(s)).toContain(m);
    let ticks = 0;
    const m2 = deepMove(s, mulberry32(3), { now: () => ticks++ * 50, budgetMs: 100 });
    expect(legalMoves(s)).toContain(m2);
  });
  it('the clock and a node cap are live from the first depth: a tiny budget or cap stops the search almost at once and still gives a legal move', () => {
    expect(HARD_BUDGET_MS).toBe(350); // the number on the guide page
    expect(HARD_NODE_CAP).toBe(100000);
    const s = newGame();
    let t = 0;
    const m = deepMove(s, mulberry32(5), { now: () => (t += 10), budgetMs: 5 });
    expect(legalMoves(s)).toContain(m);
    expect(lastSearchNodes).toBeLessThanOrEqual(64);
    for (const cap of [1, 40, 500, 5000]) {
      const m2 = deepMove(s, mulberry32(5), { now: () => 0, budgetMs: 1e9, maxNodes: cap });
      expect(legalMoves(s)).toContain(m2);
      expect(lastSearchNodes).toBeLessThanOrEqual(cap + 64);
    }
  });
  it('with the real settings no Hard search visits more than the cap (plus one clock check), over many positions', () => {
    const rng = mulberry32(77);
    for (let g = 0; g < 12; g++) {
      for (const s of randomGame(6, SEED_CHOICES[g % 3], rng).filter((_, i) => i % 5 === 0)) {
        if (isOver(s) || legalMoves(s).length < 2) continue;
        deepMove(s, rng, { now: () => 0 });
        expect(lastSearchNodes).toBeLessThanOrEqual(HARD_NODE_CAP + 64);
      }
    }
  }, 120_000);
  it('a lone legal move is returned at once', () => {
    const s = mk(6, [0, 0, 0, 3, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0);
    expect(deepMove(s, mulberry32(1))).toBe(3);
    expect(bestMove(s, 4, mulberry32(1))).toBe(3);
  });
});

describe('words and bookkeeping', () => {
  it('pluralises seeds', () => {
    expect(seedsText(0)).toBe('0 seeds');
    expect(seedsText(1)).toBe('1 seed');
    expect(seedsText(2)).toBe('2 seeds');
  });
  it('names the sides', () => {
    expect(nameOf(0, null)).toBe('Bottom player');
    expect(nameOf(1, null)).toBe('Top player');
    expect(nameOf(0, 0)).toBe('You');
    expect(nameOf(1, 0)).toBe('Computer');
    expect(nameOf(0, 1)).toBe('Computer');
    expect(nameOf(1, 1)).toBe('You');
  });
  it('describes every result', () => {
    const r = (a: number, b: number) => result(mk(6, [0, 0, 0, 0, 0, 0], a, [0, 0, 0, 0, 0, 0], b));
    expect(describeResult(r(30, 18), 0)).toBe('You win 30 to 18.');
    expect(describeResult(r(30, 18), 1)).toBe('The computer wins 30 to 18.');
    expect(describeResult(r(18, 30), 1)).toBe('You win 30 to 18.');
    expect(describeResult(r(18, 30), 0)).toBe('The computer wins 30 to 18.');
    expect(describeResult(r(30, 18), null)).toBe('Bottom player wins 30 to 18.');
    expect(describeResult(r(18, 30), null)).toBe('Top player wins 30 to 18.');
    expect(describeResult(r(24, 24), 0)).toBe('Draw, 24 each.');
    expect(describeResult(r(24, 24), null)).toBe('Draw, 24 each.');
  });
  it('keeps a pass or extra-turn note in the thinking message', () => {
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('You go again.')).toBe('You go again. Computer is thinking...');
  });
  it('finds the move Undo goes back to', () => {
    expect(undoIndex([], 0)).toBe(-1);
    expect(undoIndex([], null)).toBe(-1);
    expect(undoIndex([0, 1, 0, 1], 0)).toBe(2);
    expect(undoIndex([0, 1, 0, 1], 1)).toBe(3);
    expect(undoIndex([0, 0, 1, 1, 1], 0)).toBe(1); // extra turns by the computer after your move go back too
    expect(undoIndex([1, 1], 0)).toBe(-1);
    expect(undoIndex([0, 1, 0], null)).toBe(2);
  });
  it('cleans the seed count and the level from the address bar', () => {
    expect(cleanSeeds('3')).toBe(3);
    expect(cleanSeeds('5')).toBe(5);
    expect(cleanSeeds(4)).toBe(4);
    for (const junk of ['0', '2', '6', '99', '-1', '4.5', 'abc', '', '1e1', '__proto__', NaN, Infinity, null, undefined, [], {}, '٤']) {
      expect(cleanSeeds(junk)).toBe(DEFAULT_SEEDS);
    }
    expect(cleanLevel('easy')).toBe('easy');
    expect(cleanLevel('hard')).toBe('hard');
    expect(cleanLevel('nope')).toBe('medium');
    expect(cleanLevel(undefined, 'easy')).toBe('easy');
    expect(cleanLevel('__proto__')).toBe('medium');
  });
  it('shuffles without losing or inventing items', () => {
    const a = [1, 2, 3, 4, 5, 6, 7];
    const b = shuffled(a, mulberry32(8));
    expect(b.slice().sort()).toEqual(a);
    expect(a).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('the page keeps the move sentence when the computer starts thinking', () => {
  it('"Computer is thinking..." is appended to the sentence just announced (the move, captures, go again), not put in its place', () => {
    expect(calculatorSource).toContain('thinkingMessage(carry)');
    expect(calculatorSource).not.toContain('thinkingMessage(note)');
    expect(calculatorSource).toContain('carry = msg;');
    expect(thinkingMessage('You sowed pit 3. Captured 5 seeds from pit 4.')).toBe('You sowed pit 3. Captured 5 seeds from pit 4. Computer is thinking...');
  });
});
