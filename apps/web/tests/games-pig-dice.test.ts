/**
 * games-pig-dice.test.ts - the engine behind `pig-dice`.
 *
 * Pinned: the turn rules (a 1 loses the turn total and passes the turn, any other roll adds
 * to it, banking adds it to the score, reaching the goal wins at once, banking nothing is not
 * allowed), the die, the three computer players (Easy banks at 15, Medium at 20 with a catch-up
 * rule, Hard plays the best possible game). The Hard table is checked against an independent
 * solver (a different iteration order and data layout) on small goals, against the engine
 * itself by playing thousands of games from fixed positions, and against two published
 * facts: the first player wins the 100-point game about 53.06 percent of the time with best
 * play, and banking at 20 gives the best average score for one turn (about 8.14). Thousands
 * of simulated games always end. The sanitisers, the win counts and the text are pinned too.
 */
import { describe, it, expect } from 'vitest';
import {
  GOALS, LEVELS, EASY_HOLD, MEDIUM_HOLD, MAX_WINS, DIE_PIPS,
  mulberry32, rollDie, newGame, other, applyRoll, applyHold,
  easyShouldRoll, mediumShouldRoll, hardShouldRoll, shouldRoll, solvePig, getTable, createPigSolver, hasTable, storeTable, winChance, choiceValues,
  winsKey, parseWins, addWin, parseSetup, seatName, describeEvent, shareText,
  type GameState, type Seat, type Level, type PigTable,
} from '../src/components/apps-private/pig-dice/helpers';
import calculatorSource from '../src/components/apps-private/pig-dice/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');
const at = (s: Partial<GameState> & { scores?: [number, number] }): GameState => ({ ...newGame(100), ...s });

describe('the die', () => {
  it('maps the unit interval onto 1 to 6 with exact boundaries', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 1 / 6 - 1e-9)).toBe(1);
    expect(rollDie(() => 1 / 6 + 1e-9)).toBe(2);
    expect(rollDie(() => 5 / 6 + 1e-9)).toBe(6);
    expect(rollDie(() => 0.9999999999)).toBe(6);
  });
  it('survives a broken generator', () => {
    expect(rollDie(() => NaN)).toBe(1);
    expect(rollDie(() => -1)).toBe(1);
    expect(rollDie(() => 9)).toBe(6);
  });
  it('is close to uniform over a long seeded run, so the six chances add up to one', () => {
    const rng = mulberry32(2024);
    const n = 60000;
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) c[rollDie(rng)]++;
    expect(c[0]).toBe(0);
    for (let f = 1; f <= 6; f++) expect(Math.abs(c[f] / n - 1 / 6)).toBeLessThan(0.01);
    expect(c.reduce((a, b) => a + b, 0)).toBe(n);
  });
  it('shows each face as the right number of dots, mirrored the way a real die is', () => {
    for (let v = 1; v <= 6; v++) {
      const pips = DIE_PIPS[v];
      expect(pips, `face ${v}`).toHaveLength(v);
      expect(new Set(pips).size).toBe(v);
      expect([...pips].map((i) => 8 - i).sort((a, b) => a - b)).toEqual([...pips].sort((a, b) => a - b));
    }
    expect(DIE_PIPS[0]).toEqual([]);
  });
});

describe('the turn rules', () => {
  it('starts at 0 to 0 with nothing rolled, either seat first', () => {
    expect(newGame(100)).toEqual({ goal: 100, scores: [0, 0], turn: 0, turnTotal: 0, status: 'playing', winner: -1, lastRoll: 0 });
    expect(newGame(50, 1).turn).toBe(1);
  });
  it('falls back to 100 for a silly goal', () => {
    for (const g of [0, 1, -5, 2.5, NaN, Infinity, 5000]) expect(newGame(g).goal, String(g)).toBe(100);
    expect(newGame(50).goal).toBe(50);
  });
  it('a roll of 2 to 6 adds to the turn total and keeps the turn', () => {
    let s = newGame(100);
    for (const d of [2, 3, 4, 5, 6]) {
      const before = s.turnTotal;
      const r = applyRoll(s, d);
      expect(r.event).toEqual({ type: 'roll', seat: 0, roll: d, turnTotal: before + d });
      s = r.state;
      expect(s.turn).toBe(0);
      expect(s.turnTotal).toBe(before + d);
      expect(s.lastRoll).toBe(d);
    }
    expect(s.scores).toEqual([0, 0]);
  });
  it('a 1 loses the turn total and hands over the turn, banked points stay', () => {
    const s = at({ scores: [30, 12], turn: 0, turnTotal: 17 });
    const r = applyRoll(s, 1);
    expect(r.event).toEqual({ type: 'bust', seat: 0, lost: 17 });
    expect(r.state).toMatchObject({ scores: [30, 12], turn: 1, turnTotal: 0, lastRoll: 1, status: 'playing' });
  });
  it('a 1 as the very first roll of a turn loses nothing but still passes the turn', () => {
    const r = applyRoll(newGame(100), 1);
    expect(r.event).toEqual({ type: 'bust', seat: 0, lost: 0 });
    expect(r.state.turn).toBe(1);
  });
  it('banking adds the turn total to the score and passes the turn', () => {
    const s = at({ scores: [30, 12], turn: 1, turnTotal: 9 });
    const r = applyHold(s);
    expect(r.event).toEqual({ type: 'hold', seat: 1, banked: 9, score: 21 });
    expect(r.state).toMatchObject({ scores: [30, 21], turn: 0, turnTotal: 0 });
  });
  it('banking nothing is not allowed', () => {
    const s = newGame(100);
    const r = applyHold(s);
    expect(r.state).toBe(s);
    expect(r.event).toBeNull();
  });
  it('reaching the goal on a roll wins at once and banks the total', () => {
    const s = at({ scores: [85, 40], turn: 0, turnTotal: 9 });
    const r = applyRoll(s, 6);
    expect(r.event).toEqual({ type: 'win', seat: 0, roll: 6, score: 100 });
    expect(r.state).toMatchObject({ status: 'won', winner: 0, scores: [100, 40], turnTotal: 0 });
  });
  it('one short of the goal does not win', () => {
    const s = at({ scores: [85, 40], turn: 0, turnTotal: 8 });
    expect(applyRoll(s, 6).event?.type).toBe('roll'); // 85 + 14 = 99
    expect(applyRoll(s, 6).state.status).toBe('playing');
    expect(applyRoll(s, 3).event?.type).toBe('roll'); // 85 + 11 = 96
  });
  it('going past the goal also wins, with the real total as the score', () => {
    const s = at({ scores: [98, 0], turn: 0, turnTotal: 0 });
    const r = applyRoll(s, 5);
    expect(r.state).toMatchObject({ status: 'won', winner: 0 });
    expect(r.state.scores[0]).toBe(103);
  });
  it('the second seat can win too', () => {
    const s = at({ scores: [10, 95], turn: 1, turnTotal: 0 });
    const r = applyRoll(s, 5);
    expect(r.state).toMatchObject({ status: 'won', winner: 1, scores: [10, 100] });
  });
  it('ignores bad dice and a finished game, and never changes the state it is given', () => {
    const s = at({ turnTotal: 7 });
    const before = JSON.stringify(s);
    for (const bad of [0, 7, 2.5, NaN, -1]) {
      const r = applyRoll(s, bad);
      expect(r.state).toBe(s);
      expect(r.event).toBeNull();
    }
    applyRoll(s, 4);
    applyRoll(s, 1);
    applyHold(s);
    expect(JSON.stringify(s)).toBe(before);
    const won = applyRoll(at({ scores: [99, 0] }), 3).state;
    expect(applyRoll(won, 3).state).toBe(won);
    expect(applyHold({ ...won, turnTotal: 5 }).state.status).toBe('won');
    expect(applyHold({ ...won, turnTotal: 5 }).event).toBeNull();
  });
  it('other() swaps the seats', () => {
    expect(other(0)).toBe(1);
    expect(other(1)).toBe(0);
  });
});

describe('the computer players', () => {
  it('Easy banks at 15 or more', () => {
    expect(EASY_HOLD).toBe(15);
    for (let k = 1; k < 15; k++) expect(easyShouldRoll(at({ turnTotal: k })), `k=${k}`).toBe(true);
    for (let k = 15; k < 40; k++) expect(easyShouldRoll(at({ turnTotal: k })), `k=${k}`).toBe(false);
  });
  it('Medium banks at 20 or more in an ordinary position', () => {
    expect(MEDIUM_HOLD).toBe(20);
    for (let k = 1; k < 20; k++) expect(mediumShouldRoll(at({ scores: [30, 30], turnTotal: k })), `k=${k}`).toBe(true);
    for (let k = 20; k < 40; k++) expect(mediumShouldRoll(at({ scores: [30, 30], turnTotal: k })), `k=${k}`).toBe(false);
  });
  it('Medium keeps going when the opponent is close to winning and ahead', () => {
    const s = (k: number) => at({ scores: [50, 80], turn: 0, turnTotal: k });
    expect(mediumShouldRoll(s(25))).toBe(true);
    expect(mediumShouldRoll(s(31))).toBe(true);
    expect(mediumShouldRoll(s(32))).toBe(false);
    // Near the goal itself the target is the points still needed.
    expect(mediumShouldRoll(at({ scores: [90, 99], turn: 0, turnTotal: 9 }))).toBe(true);
  });
  it('Medium plays the plain 20 rule when it is the one ahead', () => {
    expect(mediumShouldRoll(at({ scores: [80, 60], turn: 0, turnTotal: 20 }))).toBe(false);
    expect(mediumShouldRoll(at({ scores: [60, 80], turn: 1, turnTotal: 20 }))).toBe(false);
  });
  it('shouldRoll always rolls with nothing to bank, whatever the level', () => {
    for (const lv of LEVELS) expect(shouldRoll(lv, newGame(100), getTable(100)), lv).toBe(true);
  });
  it('shouldRoll dispatches to the right rule', () => {
    const s = at({ scores: [30, 30], turnTotal: 17 });
    expect(shouldRoll('easy', s)).toBe(false);
    expect(shouldRoll('medium', s)).toBe(true);
  });
});

// A second solver, written differently: plain nested arrays, a Jacobi sweep (every state
// is recomputed from the previous sweep only) and no ordering tricks.
const oracle = (G: number): number[][][] => {
  let V = Array.from({ length: G }, () => Array.from({ length: G }, () => new Array<number>(G).fill(0.5)));
  for (let iter = 0; iter < 20000; iter++) {
    const N = V.map((a) => a.map((b) => b.slice()));
    let diff = 0;
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) for (let k = 0; i + k < G; k++) {
      let roll = (1 - V[j][i][0]) / 6;
      for (let r = 2; r <= 6; r++) roll += (i + k + r >= G ? 1 : V[i][j][k + r]) / 6;
      let best = roll;
      if (k > 0) best = Math.max(roll, 1 - V[j][i + k][0]);
      diff = Math.max(diff, Math.abs(best - V[i][j][k]));
      N[i][j][k] = best;
    }
    V = N;
    if (diff < 1e-13) break;
  }
  return V;
};

describe('the best-play table', () => {
  for (const G of [8, 15, 24]) {
    it(`matches an independent solver for a ${G}-point game, state by state`, () => {
      const t = solvePig(G, 1e-12);
      const V = oracle(G);
      let worst = 0;
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) for (let k = 0; i + k < G; k++) {
        worst = Math.max(worst, Math.abs(winChance(t, i, j, k) - V[i][j][k]));
      }
      expect(worst).toBeLessThan(1e-7);
    }, 60_000);
    it(`makes the same roll or bank choice as the independent solver in a ${G}-point game wherever the choice matters`, () => {
      const t = solvePig(G, 1e-12);
      const V = oracle(G);
      let checked = 0;
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) for (let k = 1; i + k < G; k++) {
        let roll = (1 - V[j][i][0]) / 6;
        for (let r = 2; r <= 6; r++) roll += (i + k + r >= G ? 1 : V[i][j][k + r]) / 6;
        const hold = 1 - V[j][i + k][0];
        if (Math.abs(roll - hold) < 1e-6) continue; // a tie: either choice is right
        const s: GameState = { ...newGame(G), scores: [i, j], turn: 0, turnTotal: k };
        expect(hardShouldRoll(t, s), `G=${G} i=${i} j=${j} k=${k}`).toBe(roll > hold);
        checked++;
      }
      expect(checked).toBeGreaterThan(50);
    }, 60_000);
  }
  it('every win chance is a probability, and a banked win is certain', () => {
    const t = solvePig(20, 1e-12);
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) for (let k = 0; i + k < 20; k++) {
      const w = winChance(t, i, j, k);
      expect(w >= 0 && w <= 1, `${i},${j},${k}`).toBe(true);
    }
    expect(winChance(t, 15, 3, 5)).toBe(1);
    expect(winChance(t, 15, 3, 20)).toBe(1);
  });
  it('the player to move has the edge at the start, and more of a lead is better', () => {
    const t = solvePig(30, 1e-10);
    expect(winChance(t, 0, 0, 0)).toBeGreaterThan(0.5);
    expect(winChance(t, 10, 0, 0)).toBeGreaterThan(winChance(t, 0, 0, 0));
    expect(winChance(t, 0, 10, 0)).toBeLessThan(winChance(t, 0, 0, 0));
    // Mirror states: if I am to move at (i, j) the other player at (j, i) is not to move, so the two chances relate.
    expect(winChance(t, 5, 5, 0)).toBeGreaterThan(0.5);
  });
  it('plays like the engine: the table chance matches thousands of games played from fixed positions', () => {
    const G = 20;
    const t = solvePig(G, 1e-11);
    const rng = mulberry32(31337);
    const playFrom = (me: number, opp: number, k: number): boolean => {
      let s: GameState = { ...newGame(G), scores: [me, opp], turn: 0, turnTotal: k };
      let guard = 0;
      while (s.status === 'playing' && guard++ < 10000) {
        if (shouldRoll('hard', s, t)) s = applyRoll(s, rollDie(rng)).state;
        else s = applyHold(s).state;
      }
      return s.winner === 0;
    };
    for (const [me, opp, k] of [[0, 0, 0], [0, 0, 8], [5, 12, 3], [12, 5, 0], [10, 17, 6]]) {
      const n = 30000;
      let wins = 0;
      for (let g = 0; g < n; g++) if (playFrom(me, opp, k)) wins++;
      expect(Math.abs(wins / n - winChance(t, me, opp, k)), `from ${me},${opp},${k}`).toBeLessThan(0.012);
    }
  }, 60_000);
  it('for the real 100-point game the first player wins about 53.06 percent with best play', () => {
    const t = getTable(100);
    expect(winChance(t, 0, 0, 0)).toBeCloseTo(0.5306, 4);
    expect(t.residual).toBeLessThan(1e-7);
  }, 30_000);
  it('is solved once and kept', () => {
    expect(getTable(50)).toBe(getTable(50));
  });
  it('banks at about 21 at the start of a 100-point game and rolls on when far behind', () => {
    const t = getTable(100);
    const roll = (me: number, opp: number, k: number) => hardShouldRoll(t, { ...newGame(100), scores: [me, opp], turn: 0, turnTotal: k });
    expect(roll(0, 0, 1)).toBe(true);
    expect(roll(0, 0, 20)).toBe(true);
    let firstBank = 0;
    for (let k = 1; k < 100; k++) if (!roll(0, 0, k)) { firstBank = k; break; }
    expect(firstBank).toBeGreaterThanOrEqual(20);
    expect(firstBank).toBeLessThanOrEqual(22);
    // The opponent is one turn from winning: banking is no use, so the best play keeps rolling.
    expect(roll(0, 98, 30)).toBe(true);
    // One turn total from winning by banking is always taken by the engine itself, so there is nothing to choose.
    expect(roll(60, 10, 0)).toBe(true);
  }, 30_000);
  it('computes the 100-point table inside a generous time budget', () => {
    const t0 = performance.now();
    solvePig(100, 1e-8);
    expect(performance.now() - t0).toBeLessThan(15000);
  }, 30_000);
  it('a table solved in slices is identical to the one-go solve, and no slice does the whole job', () => {
    for (const goal of [20, 50]) {
      const whole = solvePig(goal, 1e-8);
      const solver = createPigSolver(goal, 1e-8);
      let ticks = 0;
      let steps = 0;
      // A fake clock that moves one unit per reading makes the slicing independent of machine speed.
      const clock = () => ticks++;
      while (!solver.step(3, clock)) { steps++; expect(steps).toBeLessThan(100_000); }
      expect(solver.done).toBe(true);
      expect(steps).toBeGreaterThan(5);
      const t = solver.table();
      expect(t.goal).toBe(whole.goal);
      expect(t.sweeps).toBe(whole.sweeps);
      expect(t.residual).toBe(whole.residual);
      expect(Array.from(t.win)).toEqual(Array.from(whole.win));
      expect(solver.step(3, clock)).toBe(true); // asking again changes nothing
    }
  }, 30_000);
  it('a stored table is found by getTable, so a page that solved it in slices never solves it twice', () => {
    expect(hasTable(37)).toBe(false);
    const solver = createPigSolver(37, 1e-8);
    expect(solver.step(Infinity)).toBe(true);
    storeTable(solver.table());
    expect(hasTable(37)).toBe(true);
    expect(getTable(37).win).toBe(solver.table().win);
  }, 30_000);
  it('the page solves Hard in slices and says so, instead of solving inside the click', () => {
    expect(calculatorSource).toContain('createPigSolver');
    expect(calculatorSource).toContain('Thinking...');
  });
  it('choiceValues agree with the table', () => {
    const t = solvePig(20, 1e-11);
    for (const [me, opp, k] of [[0, 0, 5], [3, 9, 8], [12, 4, 4]]) {
      const v = choiceValues(t, me, opp, k);
      expect(winChance(t, me, opp, k)).toBeCloseTo(Math.max(v.roll, v.hold), 8);
    }
    expect(choiceValues(t, 0, 0, 0).hold).toBe(-1);
  });
});

describe('published facts about the rules', () => {
  // Expected points banked in one turn if the player rolls until the turn total reaches h, then banks.
  const turnScore = (h: number): number => {
    const f = new Array<number>(h + 8).fill(0);
    for (let k = h - 1; k >= 0; k--) {
      let v = 0;
      for (let r = 2; r <= 6; r++) v += (k + r >= h ? k + r : f[k + r]) / 6;
      f[k] = v;
    }
    return f[0];
  };
  it('rolling is worth it on average exactly while the turn total is under 20', () => {
    for (let k = 0; k <= 40; k++) {
      let gain = 0;
      for (let d = 1; d <= 6; d++) gain += (d === 1 ? -k : d) / 6;
      expect(gain).toBeCloseTo((20 - k) / 6, 12);
      if (k < 20) expect(gain).toBeGreaterThan(0);
      if (k > 20) expect(gain).toBeLessThan(0);
    }
  });
  it('banking at 20 gives the best average turn: about 8.14 points, tied with 21', () => {
    let best = 0;
    let bestH = 0;
    for (let h = 2; h <= 60; h++) {
      const v = turnScore(h);
      if (v > best + 1e-12) { best = v; bestH = h; }
    }
    expect([20, 21]).toContain(bestH);
    expect(turnScore(20)).toBeCloseTo(turnScore(21), 10);
    expect(turnScore(20)).toBeCloseTo(8.14, 2);
    expect(turnScore(15)).toBeLessThan(turnScore(20));
  });
  it('a Monte Carlo of the engine agrees with the exact average turn for a bank-at-20 player', () => {
    const rng = mulberry32(5);
    let total = 0;
    const turns = 100000;
    for (let t = 0; t < turns; t++) {
      let s: GameState = newGame(1000);
      for (;;) {
        const r = applyRoll(s, rollDie(rng));
        s = r.state;
        if (r.event?.type === 'bust') break;
        if (s.turnTotal >= 20) { total += s.turnTotal; break; }
      }
    }
    expect(Math.abs(total / turns - turnScore(20))).toBeLessThan(0.1);
  });
});

describe('whole games', () => {
  type Policy = (s: GameState) => boolean;
  const policy = (level: Level, goal: number): Policy => {
    const table = level === 'hard' ? getTable(goal) : undefined;
    return (s) => shouldRoll(level, s, table);
  };
  const play = (goal: number, first: Seat, p0: Policy, p1: Policy, rng: () => number) => {
    let s: GameState = newGame(goal, first);
    let steps = 0;
    while (s.status === 'playing') {
      if (steps++ > 100000) throw new Error('game did not end');
      const roll = (s.turn === 0 ? p0 : p1)(s);
      const r = roll ? applyRoll(s, rollDie(rng)) : applyHold(s);
      if (!r.event) throw new Error('illegal action');
      s = r.state;
      // Invariants after every action.
      if (s.scores.some((x, i) => x < 0 || (s.status === 'playing' && x >= goal && i >= 0))) throw new Error('score out of range');
      if (s.turnTotal < 0) throw new Error('turn total');
    }
    return s;
  };
  it('every level against every level, both goals, both first players: games always end with one winner at the goal', () => {
    const rng = mulberry32(88);
    for (const goal of GOALS) for (const a of LEVELS) for (const b of LEVELS) for (const first of [0, 1] as Seat[]) {
      for (let g = 0; g < 60; g++) {
        const s = play(goal, first, policy(a, goal), policy(b, goal), rng);
        expect(s.status).toBe('won');
        expect(s.scores[s.winner as Seat]).toBeGreaterThanOrEqual(goal);
        expect(s.scores[other(s.winner as Seat)]).toBeLessThan(goal);
      }
    }
  }, 60_000);
  it('Hard beats Easy and Medium over a long seeded run, swapping who starts', () => {
    const rng = mulberry32(2718);
    const duel = (a: Level, b: Level, n: number): number => {
      let wins = 0;
      for (let g = 0; g < n; g++) {
        const first = (g % 2) as Seat;
        const s = play(100, first, policy(a, 100), policy(b, 100), rng);
        if (s.winner === 0) wins++;
      }
      return wins / n;
    };
    const hardVsEasy = duel('hard', 'easy', 6000);
    const hardVsMedium = duel('hard', 'medium', 6000);
    const mediumVsEasy = duel('medium', 'easy', 6000);
    expect(hardVsEasy).toBeGreaterThan(0.5);
    expect(hardVsMedium).toBeGreaterThan(0.5);
    expect(mediumVsEasy).toBeGreaterThan(0.5);
    expect(hardVsEasy).toBeGreaterThan(mediumVsEasy - 0.02);
  }, 120_000);
  it('a seed replays the same game', () => {
    const a = play(100, 0, policy('medium', 100), policy('easy', 100), mulberry32(9));
    const b = play(100, 0, policy('medium', 100), policy('easy', 100), mulberry32(9));
    expect(a).toEqual(b);
  });
});

describe('win counts', () => {
  it('has six keys, one per level and goal', () => {
    expect(winsKey('hard', 100)).toBe('hard-100');
    expect(new Set(LEVELS.flatMap((l) => GOALS.map((g) => winsKey(l, g)))).size).toBe(6);
  });
  it('adds one win at a time and stops at the cap', () => {
    let w = addWin({}, 'easy-50');
    expect(w).toEqual({ 'easy-50': 1 });
    w = addWin(w, 'easy-50');
    expect(w['easy-50']).toBe(2);
    expect(addWin({ 'easy-50': MAX_WINS }, 'easy-50')['easy-50']).toBe(MAX_WINS);
    const same = { 'easy-50': 3 };
    expect(addWin(same, 'bogus')).toBe(same);
    expect(addWin(same, '__proto__')).toBe(same);
    expect(same).toEqual({ 'easy-50': 3 });
  });
  it('sanitises stored data into a fresh object', () => {
    const stored = JSON.parse('{"easy-50": 4, "hard-100": 2.5, "medium-50": "7", "bogus": 3, "__proto__": {"a": 1}, "easy-100": 10000, "hard-50": 0, "medium-100": 9999}');
    const out = parseWins(stored);
    expect(out).toEqual({ 'easy-50': 4, 'medium-100': 9999 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(parseWins([1])).toEqual({});
    expect(parseWins(null)).toEqual({});
    expect(parseWins('x')).toEqual({});
  });
});

describe('setup from the address', () => {
  it('defaults to the computer, Medium, 100 points', () => {
    expect(parseSetup({})).toEqual({ opponent: 'cpu', level: 'medium', goal: 100 });
  });
  it('reads good values', () => {
    expect(parseSetup({ o: 'friend', l: 'hard', g: '50' })).toEqual({ opponent: 'friend', level: 'hard', goal: 50 });
    expect(parseSetup({ o: 'cpu', l: 'easy', g: 100 }).goal).toBe(100);
  });
  it('rejects junk', () => {
    for (const g of [0, 75, -50, 50.5, 'x', '', NaN, Infinity, null, undefined, [], {}, '1e2']) expect(parseSetup({ g }).goal, String(g)).toBe(100);
    expect(parseSetup({ l: '__proto__' }).level).toBe('medium');
    expect(parseSetup({ l: ['hard'] }).level).toBe('medium');
    expect(parseSetup({ o: 'FRIEND' }).opponent).toBe('cpu');
  });
});

describe('text', () => {
  it('names the seats', () => {
    expect(seatName('cpu', 0)).toBe('You');
    expect(seatName('cpu', 1)).toBe('The computer');
    expect(seatName('friend', 0)).toBe('Player 1');
    expect(seatName('friend', 1)).toBe('Player 2');
  });
  it('describes rolls, a bust, banking and a win with the right verbs and plurals', () => {
    expect(describeEvent({ type: 'roll', seat: 0, roll: 4, turnTotal: 9 }, 'cpu')).toBe('You rolled a 4. Turn total 9.');
    expect(describeEvent({ type: 'bust', seat: 0, lost: 12 }, 'cpu')).toBe('You rolled a 1. Oops, the 12 points from this turn are lost. The computer is up.');
    expect(describeEvent({ type: 'bust', seat: 1, lost: 1 }, 'cpu')).toBe('The computer rolled a 1. Oops, the 1 point from this turn is lost. You are up.');
    expect(describeEvent({ type: 'bust', seat: 0, lost: 0 }, 'friend')).toBe('Player 1 rolled a 1. Nothing to lose yet. Player 2 is up.');
    expect(describeEvent({ type: 'hold', seat: 0, banked: 1, score: 41 }, 'cpu')).toBe('You banked 1 point and now have 41.');
    expect(describeEvent({ type: 'hold', seat: 1, banked: 20, score: 41 }, 'cpu')).toBe('The computer banked 20 points and now has 41.');
    expect(describeEvent({ type: 'win', seat: 0, roll: 5, score: 102 }, 'cpu')).toBe('You rolled a 5 and reached 102. You win!');
    expect(describeEvent({ type: 'win', seat: 1, roll: 5, score: 100 }, 'friend')).toBe('Player 2 rolled a 5 and reached 100. Player 2 wins!');
  });
  it('writes the share line for an unfinished and finished game', () => {
    const setup = { opponent: 'cpu' as const, level: 'hard' as const, goal: 100 as const };
    const s = at({ scores: [40, 52] });
    expect(shareText(setup, s)).toBe('Pig Dice (race to 100, Hard computer): game in progress, 40 to 52');
    expect(shareText(setup, { ...s, status: 'won', winner: 0, scores: [101, 52] })).toBe('Pig Dice (race to 100, Hard computer): I won, 101 to 52');
    expect(shareText(setup, { ...s, status: 'won', winner: 1, scores: [40, 100] })).toBe('Pig Dice (race to 100, Hard computer): the computer won, 40 to 100');
    expect(shareText({ opponent: 'friend', level: 'easy', goal: 50 }, { ...s, goal: 50, status: 'won', winner: 1, scores: [20, 51] })).toBe('Pig Dice (race to 50, two players): Player 2 won, 20 to 51');
  });
});

describe('the page (read from source)', () => {
  it('has a polite live status line, honours reduced motion and uses its own storage key', () => {
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/gk:game:pig-dice/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/crypto\.getRandomValues/);
  });
});

describe('page source: key repeat and light theme', () => {
  it('swallows a held Enter or Space on a button instead of rolling again and again', () => {
    expect(src).toMatch(/if \(e\.repeat\) \{[\s\S]{0,200}e\.preventDefault\(\)/);
  });
  it('draws pips and the Bank label in a theme-aware ink', () => {
    expect(src).toContain('.theme-light #pgd-app { --pgd-ink: var(--color-text-primary); }');
    expect(src).toMatch(/\.pgd-pip \{[^}]*background: var\(--pgd-ink\)/);
    expect(src).toMatch(/\.pgd-bank \{[\s\S]*?color: var\(--pgd-ink\)/);
  });
});

// Used only to keep the type import honest.
export type _Unused = PigTable;
