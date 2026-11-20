/**
 * games-water-jugs.test.ts - the engine behind `water-jugs`.
 *
 * Pinned: fill, empty and pour behave as the page says (a pour stops when the source is
 * empty or the target is full, and a move that changes nothing is refused); the fewest
 * moves reported by the breadth-first search agrees with a second implementation that
 * relaxes every edge over every possible set of amounts (Bellman-Ford), for every
 * target of every pair of jugs up to size 9, many sets of three jugs, and from every
 * position of several puzzles, not just the empty start; for two jugs the set of
 * measurable targets matches the number-theory rule (a multiple of the greatest common
 * divisor, at most the larger jug); every generated puzzle is solvable, has the fewest
 * moves it claims, sits in its difficulty's range, and on Hard needs all three jugs; the
 * same seed gives the same puzzle; the hint is always one step on a shortest route; and
 * the sanitisers reject junk.
 */
import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, SPECS, MAX_JUGS, MAX_CAP, mulberry32, JUG_NAMES, plural, emptyAmounts, applyMove, legalMoves, isGoal, amountsKey, sameMove,
  solveFrom, fewestMoves, hintMove, makePuzzle, fallbackFor, solvedKey, perfectKey, MAX_COUNT, sanitiseBest, clampDifficulty, moveText, resultText,
  describeAmounts,
  type Move, type Amounts,
} from '../src/components/apps-private/water-jugs/helpers';

// ── A second implementation ───────────────────────────────────────────────────

const refRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z = z ^ (z + Math.imul(z ^ (z >>> 7), z | 61));
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
};

/** All positions reachable from `start` and their neighbours, with moves restated as plain transfers. */
const neighbours = (caps: number[], a: number[]): number[][] => {
  const out: number[][] = [];
  const n = caps.length;
  for (let i = 0; i < n; i++) {
    const f = a.slice(); f[i] = caps[i]; out.push(f); // fill (may equal a; harmless)
    const e = a.slice(); e[i] = 0; out.push(e); // empty
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const total = a[i] + a[j];
      const p = a.slice();
      p[j] = Math.min(caps[j], total); // the receiving jug takes what fits
      p[i] = total - p[j]; // the rest stays behind
      out.push(p);
    }
  }
  return out.filter((x) => x.join(',') !== a.join(','));
};

const allStates = (caps: number[]): number[][] => {
  let acc: number[][] = [[]];
  for (const c of caps) {
    const next: number[][] = [];
    for (const p of acc) for (let v = 0; v <= c; v++) next.push([...p, v]);
    acc = next;
  }
  return acc;
};

/** Distance to the nearest goal from every position, by relaxing every edge until nothing improves. */
const bellman = (caps: number[], target: number): Map<string, number> => {
  const states = allStates(caps);
  const dist = new Map<string, number>();
  for (const s of states) dist.set(s.join(','), s.includes(target) ? 0 : Infinity);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of states) {
      const k = s.join(',');
      for (const t of neighbours(caps, s)) {
        const d = dist.get(t.join(','))! + 1;
        if (d < dist.get(k)!) { dist.set(k, d); changed = true; }
      }
    }
  }
  return dist;
};

/** Only the positions reachable from empty can ever be visited; distances there are what players see. */
const refFewest = (caps: number[], target: number): number | null => {
  const d = bellman(caps, target).get(caps.map(() => 0).join(','))!;
  return Number.isFinite(d) ? d : null;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// ── Basics ────────────────────────────────────────────────────────────────────

describe('seeded random numbers', () => {
  it('match a second implementation', () => {
    for (const seed of [0, 1, 42, 2 ** 31, 2 ** 32 - 1]) {
      const a = mulberry32(seed);
      const b = refRng(seed);
      for (let i = 0; i < 200; i++) expect(a()).toBe(b());
    }
  });
});

describe('moves', () => {
  const caps = [3, 5];
  it('fill brings a jug to the brim, empty drains it, and a move that changes nothing is refused', () => {
    expect(applyMove(caps, [0, 0], { kind: 'fill', i: 1 })).toEqual([0, 5]);
    expect(applyMove(caps, [0, 5], { kind: 'fill', i: 1 })).toBeNull();
    expect(applyMove(caps, [2, 5], { kind: 'empty', i: 1 })).toEqual([2, 0]);
    expect(applyMove(caps, [2, 0], { kind: 'empty', i: 1 })).toBeNull();
  });
  it('pour stops when the source is empty or the target is full', () => {
    expect(applyMove(caps, [3, 0], { kind: 'pour', i: 0, j: 1 })).toEqual([0, 3]); // all of it fits
    expect(applyMove(caps, [0, 5], { kind: 'pour', i: 1, j: 0 })).toEqual([3, 2]); // only 3 fit
    expect(applyMove(caps, [3, 5], { kind: 'pour', i: 0, j: 1 })).toBeNull(); // target full
    expect(applyMove(caps, [0, 4], { kind: 'pour', i: 0, j: 1 })).toBeNull(); // source empty
    expect(applyMove(caps, [3, 2], { kind: 'pour', i: 0, j: 0 })).toBeNull(); // into itself
  });
  it('rejects jugs that do not exist and never modifies its input', () => {
    const a = [1, 2];
    expect(applyMove(caps, a, { kind: 'fill', i: 2 })).toBeNull();
    expect(applyMove(caps, a, { kind: 'fill', i: -1 })).toBeNull();
    expect(applyMove(caps, a, { kind: 'pour', i: 0, j: 7 })).toBeNull();
    applyMove(caps, a, { kind: 'pour', i: 0, j: 1 });
    expect(a).toEqual([1, 2]);
  });
  it('legalMoves lists exactly the moves that change something', () => {
    expect(legalMoves(caps, [0, 0]).map(moveText)).toEqual(['Fill jug A from the tap', 'Fill jug B from the tap']);
    const all = legalMoves([3, 5, 4], [1, 2, 3]);
    for (const m of all) expect(applyMove([3, 5, 4], [1, 2, 3], m)).not.toBeNull();
    // 3 fills? only jugs not full; 3 empties; pours between non-empty source and non-full target
    expect(all.filter((m) => m.kind === 'fill').length).toBe(3);
    expect(all.filter((m) => m.kind === 'empty').length).toBe(3);
    expect(all.filter((m) => m.kind === 'pour').length).toBe(6);
  });
  it('legalMoves agrees with the second implementation on every position of several jug sets', () => {
    for (const caps2 of [[3, 5], [4, 7], [2, 3, 4], [3, 5, 8]]) {
      for (const s of allStates(caps2)) {
        const mine = legalMoves(caps2, s).map((m) => applyMove(caps2, s, m)!.join(',')).sort();
        const theirs = neighbours(caps2, s).map((t) => t.join(',')).sort();
        // the same set of results (different moves may give the same position)
        expect([...new Set(mine)]).toEqual([...new Set(theirs)]);
      }
    }
  });
  it('pours keep the total, fills and empties change it by the right amount', () => {
    const rng = mulberry32(3);
    const capsX = [4, 7, 9];
    let a: Amounts = emptyAmounts(capsX);
    for (let step = 0; step < 3000; step++) {
      const moves = legalMoves(capsX, a);
      const m = moves[Math.floor(rng() * moves.length)];
      const t = applyMove(capsX, a, m)!;
      const sum = (x: number[]) => x.reduce((p, q) => p + q, 0);
      if (m.kind === 'pour') expect(sum(t)).toBe(sum(a));
      else if (m.kind === 'fill') expect(sum(t)).toBe(sum(a) + capsX[m.i] - a[m.i]);
      else expect(sum(t)).toBe(sum(a) - a[m.i]);
      t.forEach((v, i) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(capsX[i]); expect(Number.isInteger(v)).toBe(true); });
      a = t;
    }
  });
  it('keys are unique per position', () => {
    const keys = new Set(allStates([5, 7, 9]).map(amountsKey));
    expect(keys.size).toBe(6 * 8 * 10);
    expect(MAX_CAP).toBe(20);
    expect(MAX_JUGS).toBe(3);
  });
});

// ── Fewest moves against the second implementation ────────────────────────────

describe('fewest moves', () => {
  it('is the well-known 6 for jugs of 3 and 5 measuring 4', () => {
    expect(fewestMoves([3, 5], 4)).toBe(6);
    expect(fewestMoves([5, 3], 4)).toBe(6);
    expect(fewestMoves([3, 5], 1)).toBe(4);
    expect(fewestMoves([3, 5], 5)).toBe(1);
    expect(fewestMoves([3, 5], 0)).toBe(0); // zero is already in an empty jug
  });

  it('matches the second implementation for every target of every pair of jugs from 1 to 9', () => {
    for (let a = 1; a <= 9; a++) {
      for (let b = a; b <= 9; b++) {
        for (let t = 1; t <= b; t++) {
          const dist = bellman([a, b], t);
          const ref = dist.get('0,0')!;
          expect(fewestMoves([a, b], t), `${a},${b} -> ${t}`).toBe(Number.isFinite(ref) ? ref : null);
        }
      }
    }
  }, 120_000);

  it('matches for 60 sets of three jugs and every target', () => {
    const rng = mulberry32(88);
    for (let k = 0; k < 60; k++) {
      const caps = [2 + Math.floor(rng() * 7), 2 + Math.floor(rng() * 7), 2 + Math.floor(rng() * 7)];
      const top = Math.max(...caps);
      for (let t = 1; t <= top; t++) {
        const ref = refFewest(caps, t);
        expect(fewestMoves(caps, t), `${caps.join(',')} -> ${t}`).toBe(ref);
      }
    }
  }, 240_000);

  it('matches from every position of several puzzles, not only from empty jugs', () => {
    for (const [caps, t] of [[[3, 5], 4], [[5, 8], 4], [[3, 8, 11], 4], [[4, 7, 9], 6]] as [number[], number][]) {
      const dist = bellman(caps, t);
      for (const s of allStates(caps)) {
        const plan = solveFrom(caps, t, s);
        const ref = dist.get(s.join(','))!;
        expect(plan ? plan.moves.length : null, `${caps.join(',')} from ${s.join(',')}`).toBe(Number.isFinite(ref) ? ref : null);
      }
    }
  }, 120_000);

  it('for two jugs, a target can be measured exactly when it is a multiple of the gcd and at most the larger jug', () => {
    for (let a = 1; a <= 12; a++) {
      for (let b = 1; b <= 12; b++) {
        for (let t = 1; t <= 13; t++) {
          const rule = t % gcd(a, b) === 0 && t <= Math.max(a, b);
          expect(fewestMoves([a, b], t) !== null, `${a},${b} -> ${t}`).toBe(rule);
        }
      }
    }
  }, 120_000);

  it('plans are legal move lists that end on the target, and they are never longer than any found by the second implementation', () => {
    for (const [caps, t] of [[[3, 5], 4], [[5, 8], 4], [[3, 8, 11], 4], [[7, 11], 6]] as [number[], number][]) {
      const plan = solveFrom(caps, t)!;
      let a = emptyAmounts(caps);
      plan.moves.forEach((m) => { a = applyMove(caps, a, m)!; expect(a).not.toBeNull(); });
      expect(isGoal(a, t)).toBe(true);
      expect(plan.moves.length).toBe(refFewest(caps, t));
    }
  });

  it('returns an empty plan when already finished, and null for impossible or invalid input', () => {
    expect(solveFrom([3, 5], 4, [0, 4])).toEqual({ moves: [] });
    expect(solveFrom([4, 6], 3)).toBeNull();
    expect(solveFrom([3], 2)).toBeNull();
    expect(solveFrom([3, 5, 7, 9], 2)).toBeNull();
    expect(solveFrom([0, 5], 2)).toBeNull();
    expect(solveFrom([3, 21], 2)).toBeNull();
    expect(solveFrom([3, 2.5], 2)).toBeNull();
  });
});

// ── Generated puzzles ─────────────────────────────────────────────────────────

describe('generated puzzles', () => {
  it('are solvable, claim the true fewest moves, and sit in the difficulty range (60 seeds each)', () => {
    DIFFICULTIES.forEach((_, d) => {
      const spec = SPECS[d];
      for (let seed = 1; seed <= 60; seed++) {
        const p = makePuzzle(d, mulberry32(seed));
        expect(p.caps.length).toBe(spec.jugs);
        expect(new Set(p.caps).size).toBe(spec.jugs);
        for (const c of p.caps) { expect(c).toBeGreaterThanOrEqual(spec.minCap); expect(c).toBeLessThanOrEqual(spec.maxCap); }
        expect(p.caps.includes(p.target)).toBe(false);
        expect(p.target).toBeGreaterThanOrEqual(1);
        expect(p.target).toBeLessThan(Math.max(...p.caps));
        expect(p.best, `${DIFFICULTIES[d]} seed ${seed}`).toBe(refFewest(p.caps, p.target));
        expect(p.best).toBeGreaterThanOrEqual(spec.minMoves);
        expect(p.best).toBeLessThanOrEqual(spec.maxMoves);
      }
    });
  }, 240_000);

  it('on Hard need all three jugs: leaving any one out is impossible or takes more moves', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makePuzzle(2, mulberry32(seed + 300));
      for (let skip = 0; skip < 3; skip++) {
        const rest = p.caps.filter((_, k) => k !== skip);
        const alt = refFewest(rest, p.target);
        expect(alt === null || alt > p.best, `seed ${seed} without jug ${skip}`).toBe(true);
      }
    }
  }, 240_000);

  it('give the same puzzle for the same seed and a mix of puzzles across seeds', () => {
    DIFFICULTIES.forEach((_, d) => {
      expect(makePuzzle(d, mulberry32(11))).toEqual(makePuzzle(d, mulberry32(11)));
      const keys = new Set(Array.from({ length: 80 }, (_, i) => JSON.stringify(makePuzzle(d, mulberry32(1000 + i)))));
      expect(keys.size).toBeGreaterThanOrEqual(d === 0 ? 12 : 20);
    });
  });

  it('fall back to a built-in puzzle that is valid when no try is allowed', () => {
    DIFFICULTIES.forEach((_, d) => {
      const p = fallbackFor(d);
      const spec = SPECS[d];
      expect(p.caps.length).toBe(spec.jugs);
      expect(p.best).toBe(refFewest(p.caps, p.target));
      expect(p.best).toBeGreaterThanOrEqual(spec.minMoves - (d === 0 ? 0 : 0));
      expect(p.best).toBeLessThanOrEqual(spec.maxMoves);
      expect(p.caps.includes(p.target)).toBe(false);
    });
  });

  it('treat an unknown difficulty as Easy', () => {
    const p = makePuzzle(7, mulberry32(2));
    expect(p.caps.length).toBe(2);
    expect(makePuzzle(-1, mulberry32(2))).toEqual(makePuzzle(0, mulberry32(2)));
    expect(makePuzzle(1.5, mulberry32(2))).toEqual(makePuzzle(0, mulberry32(2)));
  });
});

// ── Hint ──────────────────────────────────────────────────────────────────────

describe('hint', () => {
  it('follows a shortest route from empty jugs for 60 generated puzzles', () => {
    for (let seed = 1; seed <= 20; seed++) {
      DIFFICULTIES.forEach((_, d) => {
        const p = makePuzzle(d, mulberry32(seed + 50));
        let a = emptyAmounts(p.caps);
        let steps = 0;
        while (!isGoal(a, p.target) && steps < 40) {
          const m = hintMove(p.caps, p.target, a)!;
          expect(m).not.toBeNull();
          a = applyMove(p.caps, a, m)!;
          steps++;
        }
        expect(steps).toBe(p.best);
      });
    }
  });
  it('from any position is one step closer, and is null at a finished position', () => {
    const caps = [3, 8, 11];
    const dist = bellman(caps, 4);
    for (const s of allStates(caps)) {
      const d = dist.get(s.join(','))!;
      if (!Number.isFinite(d) || d === 0) { expect(hintMove(caps, 4, s)).toBeNull(); continue; }
      const m = hintMove(caps, 4, s)!;
      expect(dist.get(applyMove(caps, s, m)!.join(','))).toBe(d - 1);
    }
  }, 120_000);
});

// ── Storage and text ──────────────────────────────────────────────────────────

describe('saved results', () => {
  it('keeps whole counts for the three difficulties and never more perfect than solved', () => {
    expect(sanitiseBest({ s0: 5, p0: 3, s1: 2, p1: 2, s2: 99999, p2: 1 })).toEqual({ s0: 5, p0: 3, s1: 2, p1: 2, s2: 99999, p2: 1 });
    expect(sanitiseBest({ s0: 2, p0: 7 })).toEqual({ s0: 2, p0: 2 });
    expect(sanitiseBest({ p0: 4 })).toEqual({});
    expect(sanitiseBest({ s0: 0, s1: -1, s2: 100000, p0: 1.5 })).toEqual({});
    expect(sanitiseBest({ s3: 4, s: 4 })).toEqual({});
    expect(sanitiseBest({ s0: '4', s1: null, s2: NaN })).toEqual({});
    expect(MAX_COUNT).toBe(99999);
    expect(solvedKey(1)).toBe('s1');
    expect(perfectKey(2)).toBe('p2');
  });
  it('rejects junk and never copies prototype keys', () => {
    for (const bad of [null, undefined, 3, 'x', [], [1], true]) expect(sanitiseBest(bad)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"s0": 5}, "s1": 4}'));
    expect(out).toEqual({ s1: 4 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
  it('clampDifficulty accepts only 0, 1 and 2', () => {
    expect(clampDifficulty('2', 0)).toBe(2);
    expect(clampDifficulty(1, 0)).toBe(1);
    for (const bad of ['3', '-1', '', 'x', 1.5, NaN, null, undefined, [], {}, Infinity]) expect(clampDifficulty(bad, 1)).toBe(1);
  });
});

describe('text', () => {
  it('describes moves and amounts', () => {
    const m: Move = { kind: 'pour', i: 1, j: 0 };
    expect(moveText(m)).toBe('Pour jug B into jug A');
    expect(moveText({ kind: 'fill', i: 0 })).toBe('Fill jug A from the tap');
    expect(moveText({ kind: 'empty', i: 2 })).toBe('Empty jug C down the drain');
    expect(describeAmounts([3, 5], [3, 2])).toBe('Jug A has 3 of 3, Jug B has 2 of 5.');
    expect(resultText([3, 5], m, [3, 2])).toBe('Pour jug B into jug A. Jug A has 3 of 3, Jug B has 2 of 5.');
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(6, 'move')).toBe('6 moves');
    expect(JUG_NAMES).toEqual(['A', 'B', 'C']);
    expect(sameMove({ kind: 'pour', i: 0, j: 1 }, { kind: 'pour', i: 0, j: 1 })).toBe(true);
    expect(sameMove({ kind: 'pour', i: 0, j: 1 }, { kind: 'pour', i: 0, j: 2 })).toBe(false);
    expect(sameMove({ kind: 'fill', i: 0 }, { kind: 'empty', i: 0 })).toBe(false);
  });
});
