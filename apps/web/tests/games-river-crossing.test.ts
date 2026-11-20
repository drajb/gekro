/**
 * games-river-crossing.test.ts - the engine behind `river-crossing`.
 *
 * Pinned: the six levels are well formed; the fewest crossings (or least minutes) the
 * engine reports for each level is 7, 17, 9, 9, 23 and 13, and that agrees with a
 * second implementation that models the rules with plain arrays and finds distances
 * by Bellman-Ford relaxation over every position (a different algorithm from the
 * engine's Dijkstra), from EVERY reachable position, not just the start; the two
 * lantern levels also match the classic closed-form rule for crossing times; every
 * position reachable by legal play can still reach the goal (no dead ends); a crossing
 * can always be undone by crossing the same group back; the hint always moves one
 * step closer to the best total; a long fuzz of random legal play never leaves a
 * forbidden pair alone; and the sanitisers reject junk.
 */
import { describe, it, expect } from 'vitest';
import {
  LEVELS, MAX_LEVEL, allMask, startState, isGoal, sameState, stateKey, popcount, bitsOf, boatBank, moveProblem, applyMove, moveCost,
  legalMoves, solveFrom, bestCost, hintMove, bestKey, MAX_BEST, sanitiseBest, clampLevel, plural, groupNames, unitWord, scoreText,
  explainProblem, describeMove, describeState,
  type Level, type State,
} from '../src/components/apps-private/river-crossing/helpers';

// ── A second implementation, written with plain arrays ────────────────────────

interface Plain { side: number[]; boat: number }
const toPlain = (L: Level, s: State): Plain => ({ side: L.people.map((_, i) => (s.far & (1 << i) ? 1 : 0)), boat: s.boat });
const fromPlain = (pl: Plain): State => ({ far: pl.side.reduce((m, v, i) => m | (v << i), 0), boat: pl.boat as 0 | 1 });

/** All crossings the rules allow from a position, restated person by person. */
const plainMoves = (L: Level, pl: Plain): { next: Plain; cost: number; group: number[] }[] => {
  const n = L.people.length;
  const out: { next: Plain; cost: number; group: number[] }[] = [];
  const here = L.people.map((_, i) => i).filter((i) => pl.side[i] === pl.boat);
  const rec = (start: number, chosen: number[]): void => {
    if (chosen.length) {
      const okSize = chosen.length <= L.cap;
      const okRower = chosen.some((i) => L.people[i].rows);
      const okDriver = L.driver < 0 || chosen.includes(L.driver);
      if (okSize && okRower && okDriver) {
        const side = pl.side.slice();
        for (const i of chosen) side[i] = 1 - pl.boat;
        const boat = 1 - pl.boat;
        // after the crossing, the bank the boat left has nobody to watch it
        let safe = true;
        for (const [a, b] of L.conflicts) if (side[a] === pl.boat && side[b] === pl.boat) safe = false;
        if (safe) {
          const cost = L.metric === 'moves' ? 1 : Math.max(...chosen.map((i) => L.people[i].time));
          out.push({ next: { side, boat }, cost, group: chosen.slice() });
        }
      }
    }
    if (chosen.length >= L.cap) return;
    for (let k = start; k < here.length; k++) { chosen.push(here[k]); rec(k + 1, chosen); chosen.pop(); }
  };
  rec(0, []);
  void n;
  return out;
};

const plainKey = (pl: Plain): string => `${pl.side.join('')}/${pl.boat}`;

/** Every position reachable from the start. */
const reachable = (L: Level): Map<string, Plain> => {
  const seen = new Map<string, Plain>();
  const start: Plain = { side: L.people.map(() => 0), boat: 0 };
  seen.set(plainKey(start), start);
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const m of plainMoves(L, cur)) {
      const k = plainKey(m.next);
      if (!seen.has(k)) { seen.set(k, m.next); stack.push(m.next); }
    }
  }
  return seen;
};

/** Distance to the goal from every reachable position, by relaxing every edge until nothing improves. */
const bellmanToGoal = (L: Level): Map<string, number> => {
  const nodes = reachable(L);
  const dist = new Map<string, number>();
  for (const [k, pl] of nodes) dist.set(k, pl.side.every((x) => x === 1) ? 0 : Infinity);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, pl] of nodes) {
      for (const m of plainMoves(L, pl)) {
        const d = m.cost + dist.get(plainKey(m.next))!;
        if (d < dist.get(k)!) { dist.set(k, d); changed = true; }
      }
    }
  }
  return dist;
};

/** The classic rule for the least total time with a lantern and a bridge for two. */
const classicLantern = (times: number[]): number => {
  const t = times.slice().sort((a, b) => a - b);
  const f = (n: number): number => {
    if (n === 1) return t[0];
    if (n === 2) return t[1];
    if (n === 3) return t[0] + t[1] + t[2];
    return Math.min(t[0] + 2 * t[1] + t[n - 1], 2 * t[0] + t[n - 2] + t[n - 1]) + f(n - 2);
  };
  return f(t.length);
};

// ── Levels ────────────────────────────────────────────────────────────────────

describe('levels', () => {
  it('are numbered 1 to 6 and well formed', () => {
    expect(MAX_LEVEL).toBe(6);
    expect(LEVELS.map((L) => L.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const L of LEVELS) {
      expect(L.title.length).toBeGreaterThan(3);
      expect(L.story.length).toBeGreaterThan(40);
      expect(L.cap).toBeGreaterThanOrEqual(1);
      expect(L.people.length).toBeGreaterThanOrEqual(3);
      expect(L.people.length).toBeLessThanOrEqual(8);
      expect(new Set(L.people.map((p) => p.name)).size).toBe(L.people.length);
      for (const p of L.people) {
        expect(p.name).toMatch(/^[a-z]+$/);
        expect(p.icon.length).toBeGreaterThan(0);
        if (L.metric === 'time') expect(p.time).toBeGreaterThan(0);
      }
      for (const [a, b] of L.conflicts) {
        expect(a).not.toBe(b);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(L.people.length);
      }
      if (L.driver >= 0) expect(L.people[L.driver].rows).toBe(true);
      expect(L.people.some((p) => p.rows)).toBe(true);
      // no story has any scary words
      expect(L.story).not.toMatch(/\b(eat|eats|ate|kill|die|drown|danger|attack|bite|hurt)\b/i);
    }
  });
  it('mix boat levels and lantern levels with growing difficulty', () => {
    expect(LEVELS.map((L) => L.metric)).toEqual(['moves', 'time', 'moves', 'moves', 'time', 'moves']);
  });
});

// ── The fewest crossings, against a second implementation ─────────────────────

describe('best totals', () => {
  it('are 7, 17, 9, 9, 23 and 13', () => {
    expect(LEVELS.map(bestCost)).toEqual([7, 17, 9, 9, 23, 13]);
  });

  it('match the second implementation (Bellman-Ford over plain-array rules) from the start of every level', () => {
    for (const L of LEVELS) {
      const dist = bellmanToGoal(L);
      const start = plainKey({ side: L.people.map(() => 0), boat: 0 });
      expect(dist.get(start), L.title).toBe(bestCost(L));
    }
  });

  it('match the second implementation from EVERY reachable position of every level', () => {
    for (const L of LEVELS) {
      const nodes = reachable(L);
      const dist = bellmanToGoal(L);
      for (const [k, pl] of nodes) {
        const plan = solveFrom(L, fromPlain(pl));
        expect(plan?.cost, `${L.title} at ${k}`).toBe(dist.get(k));
      }
    }
  });

  it('agree with the classic rule for the lantern levels and with the well-known 7 for the first level', () => {
    for (const L of LEVELS.filter((x) => x.metric === 'time')) {
      expect(bestCost(L)).toBe(classicLantern(L.people.map((p) => p.time)));
    }
    expect(classicLantern([1, 2, 5, 10])).toBe(17);
    expect(bestCost(LEVELS[0])).toBe(7);
  });

  it('legal moves match the second implementation at every reachable position', () => {
    for (const L of LEVELS) {
      for (const [, pl] of reachable(L)) {
        const mine = legalMoves(L, fromPlain(pl)).map((g) => bitsOf(g).join(',')).sort();
        const theirs = plainMoves(L, pl).map((m) => m.group.slice().sort((a, b) => a - b).join(',')).sort();
        expect(mine).toEqual(theirs);
      }
    }
  });

  it('every reachable position can still reach the goal (no dead ends), and a crossing can always be undone', () => {
    for (const L of LEVELS) {
      for (const [, pl] of reachable(L)) {
        const s = fromPlain(pl);
        expect(solveFrom(L, s), `${L.title}`).not.toBeNull();
        for (const g of legalMoves(L, s)) {
          const t = applyMove(L, s, g)!;
          const back = applyMove(L, t, g);
          expect(back, `${L.title}: undo of ${g}`).not.toBeNull();
          expect(sameState(back!, s)).toBe(true);
        }
      }
    }
  });
});

describe('plans', () => {
  it('are legal, end at the goal, and cost what they say', () => {
    for (const L of LEVELS) {
      const plan = solveFrom(L)!;
      let s = startState();
      let total = 0;
      for (const g of plan.moves) {
        expect(moveProblem(L, s, g), `${L.title}`).toBeNull();
        total += moveCost(L, g);
        s = applyMove(L, s, g)!;
      }
      expect(isGoal(L, s)).toBe(true);
      expect(total).toBe(plan.cost);
    }
  });
  it('return a zero-cost empty plan when already finished', () => {
    const L = LEVELS[0];
    const done: State = { far: allMask(L), boat: 1 };
    expect(solveFrom(L, done)).toEqual({ cost: 0, moves: [] });
    expect(hintMove(L, done)).toBe(0);
  });
});

// ── Rules ─────────────────────────────────────────────────────────────────────

describe('rules of a crossing', () => {
  const L1 = LEVELS[0]; // farmer 0, fox 1, hen 2, grain 3; cap 2
  const bit = (...ids: number[]) => ids.reduce((m, i) => m | (1 << i), 0);

  it('start with everyone on the left bank and the boat there too', () => {
    const s = startState();
    expect(s).toEqual({ far: 0, boat: 0 });
    expect(boatBank(L1, s)).toBe(allMask(L1));
    expect(isGoal(L1, s)).toBe(false);
  });

  it('refuse an empty crossing, a crowd, a missing farmer and someone on the other bank', () => {
    const s = startState();
    expect(moveProblem(L1, s, 0)).toEqual({ code: 'empty' });
    expect(moveProblem(L1, s, 999)).toEqual({ code: 'empty' });
    expect(moveProblem(L1, s, -3)).toEqual({ code: 'empty' });
    expect(moveProblem(L1, s, 1.5)).toEqual({ code: 'empty' });
    expect(moveProblem(L1, s, bit(0, 1, 2))).toEqual({ code: 'toomany' });
    expect(moveProblem(L1, s, bit(1))).toEqual({ code: 'driver' });
    const mid = applyMove(L1, s, bit(0, 2))!; // farmer and hen cross
    expect(moveProblem(L1, mid, bit(0, 1))).toEqual({ code: 'elsewhere', who: 1 });
  });

  it('refuse leaving a forbidden pair alone, naming the pair and the bank', () => {
    const s = startState();
    const p = moveProblem(L1, s, bit(0, 3)); // farmer and grain leave fox and hen
    expect(p).toEqual({ code: 'unsafe', a: 1, b: 2, bank: 'left' });
    expect(explainProblem(L1, p!)).toBe('The fox and the hen cannot be left alone together on the left bank.');
    // farmer alone leaves all three together
    expect(moveProblem(L1, s, bit(0))).not.toBeNull();
    // taking the hen across is fine
    expect(moveProblem(L1, s, bit(0, 2))).toBeNull();
  });

  it('the farmer going back alone is allowed when the bank he leaves is safe', () => {
    let s = applyMove(L1, startState(), bit(0, 2))!; // hen across
    expect(moveProblem(L1, s, bit(0))).toBeNull(); // right bank: only the hen
    s = applyMove(L1, s, bit(0))!;
    expect(s).toEqual({ far: bit(2), boat: 0 });
  });

  it('a lantern level needs somebody who can carry the lantern and respects the bridge size', () => {
    const L2 = LEVELS[1];
    expect(moveProblem(L2, startState(), bit(0, 1, 2))).toEqual({ code: 'toomany' });
    expect(moveProblem(L2, startState(), bit(0, 3))).toBeNull();
    expect(moveCost(L2, bit(0, 3))).toBe(10);
    expect(moveCost(L2, bit(1))).toBe(2);
    expect(moveCost(L1, bit(0, 1))).toBe(1);
    const noRower: Level = { ...L2, people: L2.people.map((p) => ({ ...p, rows: false })) };
    expect(moveProblem(noRower, startState(), bit(0))).toEqual({ code: 'norower' });
  });

  it('applyMove never modifies its input', () => {
    const s = startState();
    const copy = { ...s };
    applyMove(L1, s, bit(0, 2));
    expect(s).toEqual(copy);
  });

  it('describes crossings and positions in plain words', () => {
    expect(groupNames(L1, bit(0, 2))).toBe('farmer and hen');
    expect(groupNames(LEVELS[3], bit(0, 1, 2))).toBe('farmer, fox and hen');
    expect(describeMove(L1, startState(), bit(0, 2))).toBe('farmer and hen cross to the right bank.');
    expect(describeMove(LEVELS[1], startState(), bit(0, 1))).toBe('duck and cat cross to the right bank (2 minutes).');
    expect(describeState(L1, startState())).toBe('Left bank: farmer, fox, hen and grain. Right bank: nobody. The boat is on the left bank.');
    expect(describeState(LEVELS[1], { far: bit(0, 1), boat: 1 })).toBe('Left bank: dog and cow. Right bank: duck and cat. The lantern is on the right bank.');
    expect(unitWord(L1)).toBe('crossing');
    expect(unitWord(LEVELS[1])).toBe('minute');
    expect(scoreText(L1, 1)).toBe('1 crossing');
    expect(scoreText(LEVELS[1], 17)).toBe('17 minutes');
    expect(explainProblem(L1, { code: 'toomany' })).toMatch(/At most 2 people fit at once, counting the farmer/);
    expect(explainProblem(L1, { code: 'driver' })).toBe('The farmer has to go along.');
    expect(plural(1, 'move')).toBe('1 move');
    expect(popcount(0b10110)).toBe(3);
    expect(stateKey({ far: 5, boat: 1 })).toBe(11);
  });
});

// ── Hints ─────────────────────────────────────────────────────────────────────

describe('hint', () => {
  it('follows a best plan from the start of every level, to the goal, at the best total', () => {
    for (const L of LEVELS) {
      let s = startState();
      let total = 0;
      for (let guard = 0; guard < 60 && !isGoal(L, s); guard++) {
        const g = hintMove(L, s);
        expect(g).toBeGreaterThan(0);
        total += moveCost(L, g);
        s = applyMove(L, s, g)!;
      }
      expect(isGoal(L, s)).toBe(true);
      expect(total).toBe(bestCost(L));
    }
  });
  it('from any reachable position is one step on a best route', () => {
    for (const L of LEVELS) {
      for (const [, pl] of reachable(L)) {
        const s = fromPlain(pl);
        if (isGoal(L, s)) continue;
        const g = hintMove(L, s);
        const t = applyMove(L, s, g)!;
        expect(moveCost(L, g) + solveFrom(L, t)!.cost).toBe(solveFrom(L, s)!.cost);
      }
    }
  });
});

// ── Fuzz ──────────────────────────────────────────────────────────────────────

describe('random play', () => {
  it('never leaves a forbidden pair alone and keeps every person on exactly one bank (3000 random games)', () => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let game = 0; game < 3000; game++) {
      const L = LEVELS[game % LEVELS.length];
      let s = startState();
      for (let step = 0; step < 40; step++) {
        const moves = legalMoves(L, s);
        if (!moves.length) break;
        const g = moves[Math.floor(rnd() * moves.length)];
        const t = applyMove(L, s, g)!;
        expect(t.far & ~allMask(L)).toBe(0);
        // the bank the boat left (the old boat bank) must hold no forbidden pair
        const left = t.boat === 1 ? allMask(L) & ~t.far : t.far;
        for (const [a, b] of L.conflicts) expect((left & (1 << a)) && (left & (1 << b))).toBeFalsy();
        s = t;
        if (isGoal(L, s)) break;
      }
    }
  });
});

// ── Storage ───────────────────────────────────────────────────────────────────

describe('saved best scores', () => {
  it('keeps whole numbers from 1 to 9999 for the six known levels only', () => {
    expect(sanitiseBest({ l1: 7, l2: 17, l6: 9999 })).toEqual({ l1: 7, l2: 17, l6: 9999 });
    expect(sanitiseBest({ l1: 0, l2: -1, l3: 10000, l4: 1.5, l5: '9' })).toEqual({});
    expect(sanitiseBest({ l7: 3, l0: 3, x: 1 })).toEqual({});
    expect(MAX_BEST).toBe(9999);
    expect(bestKey(4)).toBe('l4');
  });
  it('rejects junk and never copies prototype keys', () => {
    for (const bad of [null, undefined, 4, 'x', [], [1, 2], true]) expect(sanitiseBest(bad)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"l1": 3}, "l2": 20}'));
    expect(out).toEqual({ l2: 20 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
  it('clampLevel accepts only level numbers', () => {
    expect(clampLevel('3', 1)).toBe(3);
    expect(clampLevel(6, 1)).toBe(6);
    for (const bad of ['0', '7', '', 'x', 2.5, NaN, null, undefined, [], {}, Infinity]) expect(clampLevel(bad, 2)).toBe(2);
  });
});
