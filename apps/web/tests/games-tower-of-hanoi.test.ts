/**
 * games-tower-of-hanoi.test.ts - the engine behind `tower-of-hanoi`.
 *
 * Pinned: the optimal solution is legal and has exactly 2^n - 1 moves for every
 * n from 1 to 12; an exhaustive breadth-first search over all 3^n positions
 * agrees that 2^n - 1 is the shortest possible for n up to 8; the number of
 * reachable positions is 3^n; the disc moved at step k is set by the trailing
 * zero bits of k; Auto-solve is shortest from every position up to 6 discs;
 * and the basic rules (larger-on-smaller, empty pick, undo, win) hold.
 */
import { describe, it, expect } from 'vitest';
import {
  initialState, applyMove, applyAll, moveOf, moveProblem, isLegalMove, explainProblem, isSolved, legalMoves, reverseMove,
  optimalMoves, optimalSolution, trailingZeros, solveFrom, autoPlan, keyOf, stateFromKey, bfsDistances, describePeg,
  verdict, clampDiscs, formatTime, topDisc, ENGINE_MAX, MIN_DISCS, MAX_DISCS,
  type State,
} from '../src/components/apps-private/tower-of-hanoi/helpers';

const legalState = (s: State): boolean => {
  const all = s.pegs.flat().slice().sort((a, b) => a - b);
  if (all.length !== s.discs || all.some((d, i) => d !== i + 1)) return false;
  return s.pegs.every((peg) => peg.every((d, i) => i === 0 || peg[i - 1] > d));
};

const PERMS: [number, number, number][] = [[0, 2, 1], [0, 1, 2], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

describe('initial state', () => {
  it('stacks every disc on the first peg, largest at the bottom', () => {
    const s = initialState(4);
    expect(s.pegs).toEqual([[4, 3, 2, 1], [], []]);
    expect(s.discs).toBe(4);
    expect(topDisc(s, 0)).toBe(1);
    expect(topDisc(s, 1)).toBe(0);
  });
  it('can start on another peg', () => {
    expect(initialState(3, 2).pegs).toEqual([[], [], [3, 2, 1]]);
  });
  it('rejects a disc count or peg outside the engine range', () => {
    expect(() => initialState(0)).toThrow(RangeError);
    expect(() => initialState(ENGINE_MAX + 1)).toThrow(RangeError);
    expect(() => initialState(2.5)).toThrow(RangeError);
    expect(() => initialState(3, 3)).toThrow(RangeError);
  });
});

describe('minimum move count', () => {
  it('is 2^n - 1', () => {
    expect([1, 2, 3, 4, 5, 8, 12].map(optimalMoves)).toEqual([1, 3, 7, 15, 31, 255, 4095]);
  });
  it('each extra disc doubles the work and adds one', () => {
    for (let n = 1; n < ENGINE_MAX; n++) expect(optimalMoves(n + 1)).toBe(2 * optimalMoves(n) + 1);
  });
});

describe('rules', () => {
  it('rejects putting a larger disc on a smaller one', () => {
    let s = initialState(3);
    s = applyMove(s, { from: 0, to: 1 })!; // disc 1 to peg 2
    expect(moveProblem(s, 0, 1)).toBe('larger'); // disc 2 on disc 1
    expect(applyMove(s, { from: 0, to: 1 })).toBeNull();
    expect(explainProblem(s, 0, 1)).toContain('larger disc never sits on a smaller one');
    expect(isLegalMove(s, 1, 0)).toBe(true); // the small disc can go back on the larger one
  });
  it('rejects picking from an empty peg', () => {
    const s = initialState(3);
    expect(moveProblem(s, 1, 2)).toBe('empty');
    expect(applyMove(s, { from: 1, to: 2 })).toBeNull();
    expect(moveOf(s, 2, 0)).toBeNull();
    expect(explainProblem(s, 1, 2)).toContain('Peg 2 is empty');
  });
  it('rejects a move to the same peg and to a peg that does not exist', () => {
    const s = initialState(3);
    expect(moveProblem(s, 0, 0)).toBe('same');
    for (const [f, t] of [[-1, 0], [0, 3], [0, 1.5], [NaN, 0]]) expect(moveProblem(s, f, t)).toBe('range');
    expect(explainProblem(s, 0, 7)).toContain('not a peg');
  });
  it('a legal move reports which disc moved', () => {
    expect(moveOf(initialState(3), 0, 2)).toEqual({ disc: 1, from: 0, to: 2 });
  });
  it('applyMove never changes the state it is given', () => {
    const s = initialState(4);
    const before = JSON.stringify(s);
    const t = applyMove(s, { from: 0, to: 2 })!;
    expect(JSON.stringify(s)).toBe(before);
    expect(t).not.toBe(s);
    expect(t.pegs[0]).toEqual([4, 3, 2]);
    expect(t.pegs[2]).toEqual([1]);
    expect(t.pegs[1]).toEqual([]);
    expect(legalState(t)).toBe(true);
  });
  it('from the start there are exactly two legal moves; from any position at most three', () => {
    expect(legalMoves(initialState(5))).toHaveLength(2);
    const dist = bfsDistances(initialState(5));
    for (const k of dist.keys()) {
      const n = legalMoves(stateFromKey(5, k)).length;
      expect(n >= 2 && n <= 3, `key ${k}`).toBe(true);
    }
  });
  it('random play only ever reaches legal positions', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let s = initialState(6);
    for (let i = 0; i < 2000; i++) {
      const ms = legalMoves(s);
      s = applyMove(s, ms[Math.floor(rnd() * ms.length)])!;
      expect(legalState(s)).toBe(true);
    }
  });
});

describe('undo', () => {
  it('reverseMove takes every move of a solution back to the start', () => {
    const start = initialState(5);
    const moves = optimalSolution(5, 0, 2, 1);
    let s = applyAll(start, moves)!;
    for (const m of moves.slice().reverse()) s = applyMove(s, reverseMove(m))!;
    expect(s).toEqual(start);
  });
  it('a single move and its reverse is a round trip', () => {
    const start = initialState(3);
    const m = moveOf(start, 0, 1)!;
    expect(applyMove(applyMove(start, m)!, reverseMove(m))).toEqual(start);
  });
});

describe('win detection', () => {
  it('the start is not solved, a full tower on another peg is', () => {
    expect(isSolved(initialState(3))).toBe(false);
    expect(isSolved(initialState(3, 1))).toBe(true);
    expect(isSolved(initialState(3, 2))).toBe(true);
  });
  it('is false after any proper prefix of the solution and true after all of it', () => {
    const start = initialState(5);
    const moves = optimalSolution(5, 0, 2, 1);
    let s = start;
    moves.forEach((m, i) => {
      s = applyMove(s, m)!;
      expect(isSolved(s), `after move ${i + 1}`).toBe(i === moves.length - 1);
    });
  });
  it('is false when all but one disc are on the target', () => {
    const s: State = { discs: 3, pegs: [[1], [], [3, 2]] };
    expect(isSolved(s)).toBe(false);
  });
});

describe('optimal solution', () => {
  it('has exactly 2^n - 1 moves, every one legal, ending with the tower on the target (n = 1 to 12)', () => {
    for (let n = 1; n <= ENGINE_MAX; n++) {
      const moves = optimalSolution(n, 0, 2, 1);
      expect(moves, `n=${n}`).toHaveLength(2 ** n - 1);
      expect(moves).toHaveLength(optimalMoves(n));
      let s = initialState(n);
      for (const m of moves) {
        expect(m.disc).toBe(topDisc(s, m.from));
        expect(isLegalMove(s, m.from, m.to)).toBe(true);
        s = applyMove(s, m)!;
      }
      expect(s).toEqual(initialState(n, 2));
      expect(applyAll(initialState(n), moves)).toEqual(initialState(n, 2));
    }
  });
  it('works for every ordering of from, to and via', () => {
    for (const [from, to, via] of PERMS) {
      for (const n of [1, 2, 5, 8]) {
        const end = applyAll(initialState(n, from), optimalSolution(n, from, to, via));
        expect(end, `${from}->${to} via ${via}, n=${n}`).toEqual(initialState(n, to));
      }
    }
  });
  it('rejects bad arguments', () => {
    expect(() => optimalSolution(0, 0, 2, 1)).toThrow(RangeError);
    expect(() => optimalSolution(3, 0, 0, 1)).toThrow(RangeError);
    expect(() => optimalSolution(3, 0, 1, 5)).toThrow(RangeError);
  });
  it('applyAll stops at the first illegal move', () => {
    expect(applyAll(initialState(3), [{ from: 0, to: 1 }, { from: 0, to: 1 }])).toBeNull();
    expect(applyAll(initialState(3), [])).toEqual(initialState(3));
  });
  it('is the same plan solveFrom builds from the start', () => {
    for (let n = 1; n <= 9; n++) expect(solveFrom(initialState(n), 2)).toEqual(optimalSolution(n, 0, 2, 1));
  });
});

describe('exhaustive search over the state space', () => {
  it('3^n positions are reachable, and every one is a legal position (n = 1 to 8)', () => {
    for (let n = 1; n <= 8; n++) {
      const dist = bfsDistances(initialState(n));
      expect(dist.size, `n=${n}`).toBe(3 ** n);
      for (let key = 0; key < 3 ** n; key++) {
        expect(dist.has(key)).toBe(true);
        const s = stateFromKey(n, key);
        expect(legalState(s)).toBe(true);
        expect(keyOf(s)).toBe(key);
      }
    }
  });
  it('the shortest path to a full tower on another peg is 2^n - 1 moves (n = 1 to 8)', () => {
    for (let n = 1; n <= 8; n++) {
      const dist = bfsDistances(initialState(n));
      expect(dist.get(keyOf(initialState(n, 2))), `n=${n} to peg 3`).toBe(2 ** n - 1);
      expect(dist.get(keyOf(initialState(n, 1))), `n=${n} to peg 2`).toBe(2 ** n - 1);
    }
  });
  it('the farthest any position is from the start is also 2^n - 1', () => {
    for (let n = 1; n <= 8; n++) {
      expect(Math.max(...bfsDistances(initialState(n)).values())).toBe(2 ** n - 1);
    }
  });
});

describe('which disc moves at step k', () => {
  it('trailingZeros counts trailing zero bits', () => {
    expect([1, 2, 3, 4, 6, 8, 12, 16, 96, 4096].map(trailingZeros)).toEqual([0, 1, 0, 2, 1, 3, 2, 4, 5, 12]);
    expect(() => trailingZeros(0)).toThrow(RangeError);
    expect(() => trailingZeros(-4)).toThrow(RangeError);
  });
  it('step k moves the disc labelled trailingZeros(k) + 1 (n = 1 to 12)', () => {
    for (let n = 1; n <= ENGINE_MAX; n++) {
      optimalSolution(n, 0, 2, 1).forEach((m, i) => {
        expect(m.disc - 1, `n=${n} step ${i + 1}`).toBe(trailingZeros(i + 1));
      });
    }
  });
  it('disc d moves exactly 2^(n-d) times, so the smallest does half the work and the largest moves once', () => {
    for (let n = 1; n <= ENGINE_MAX; n++) {
      const counts = new Array(n + 1).fill(0);
      for (const m of optimalSolution(n, 0, 2, 1)) counts[m.disc]++;
      for (let d = 1; d <= n; d++) expect(counts[d], `n=${n} disc ${d}`).toBe(2 ** (n - d));
    }
  });
  it('the smallest disc moves on every odd step and always travels the same way round', () => {
    for (let n = 1; n <= ENGINE_MAX; n++) {
      const moves = optimalSolution(n, 0, 2, 1);
      const step = n % 2 === 1 ? 2 : 1; // odd n: 1 to 3 to 2 to 1; even n: 1 to 2 to 3 to 1
      moves.forEach((m, i) => {
        expect(m.disc === 1, `n=${n} step ${i + 1}`).toBe((i + 1) % 2 === 1);
        if (m.disc === 1) expect(m.to).toBe((m.from + step) % 3);
      });
    }
  });
  it('the other disc never moves twice in a row', () => {
    const moves = optimalSolution(8, 0, 2, 1);
    for (let i = 1; i < moves.length; i++) expect(moves[i].disc).not.toBe(moves[i - 1].disc);
  });
});

describe('Auto-solve from any position', () => {
  it('is legal, ends solved, and is the shortest possible from every position (n = 3 to 6)', () => {
    for (let n = MIN_DISCS; n <= 6; n++) {
      const to2 = bfsDistances(initialState(n, 1));
      const to3 = bfsDistances(initialState(n, 2));
      for (let key = 0; key < 3 ** n; key++) {
        const s = stateFromKey(n, key);
        const plan = autoPlan(s);
        const best = Math.min(to2.get(key)!, to3.get(key)!);
        if (isSolved(s)) { expect(plan).toEqual([]); continue; }
        expect(plan.length, `n=${n} key=${key}`).toBe(best);
        const end = applyAll(s, plan);
        expect(end && isSolved(end), `n=${n} key=${key}`).toBe(true);
      }
    }
  });
  it('solveFrom to a chosen peg is shortest to that peg', () => {
    for (let n = 3; n <= 5; n++) {
      for (const target of [0, 1, 2]) {
        const dist = bfsDistances(initialState(n, target));
        for (let key = 0; key < 3 ** n; key++) {
          expect(solveFrom(stateFromKey(n, key), target).length, `n=${n} t=${target} key=${key}`).toBe(dist.get(key));
        }
      }
    }
  });
  it('after a few wrong moves it finishes from where the player is', () => {
    let s = initialState(5);
    for (const [f, t] of [[0, 1], [0, 2], [1, 2], [0, 1], [2, 0]]) s = applyMove(s, { from: f, to: t })!;
    const plan = autoPlan(s);
    expect(isSolved(applyAll(s, plan)!)).toBe(true);
    expect(plan.length).toBeLessThanOrEqual(optimalMoves(5));
  });
  it('rejects a target that is not a peg', () => {
    expect(() => solveFrom(initialState(3), 3)).toThrow(RangeError);
  });
});

describe('descriptions and formatting', () => {
  it('describes a peg bottom to top with the top named', () => {
    expect(describePeg(1, [3, 1])).toBe('Peg 2: discs 3 and 1, top is 1');
    expect(describePeg(0, [5, 3, 1])).toBe('Peg 1: discs 5, 3 and 1, top is 1');
    expect(describePeg(2, [4])).toBe('Peg 3: disc 4, top is 4');
    expect(describePeg(2, [])).toBe('Peg 3: empty');
  });
  it('says Perfect at the minimum and how far over otherwise', () => {
    expect(verdict(7, 3)).toBe('Perfect');
    expect(verdict(8, 3)).toBe('1 over the minimum');
    expect(verdict(20, 3)).toBe('13 over the minimum');
  });
  it('clamps a disc count into the offered range', () => {
    expect(MIN_DISCS).toBe(3);
    expect(MAX_DISCS).toBe(8);
    expect(clampDiscs(1)).toBe(3);
    expect(clampDiscs(99)).toBe(8);
    expect(clampDiscs('5')).toBe(5);
    expect(clampDiscs('abc')).toBe(4);
    expect(clampDiscs(NaN, 6)).toBe(6);
    expect(clampDiscs(undefined)).toBe(4);
    expect(clampDiscs(5.6)).toBe(6);
  });
  it('formats time and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});
