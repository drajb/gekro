/**
 * games-ten-thousand.test.ts - the engine behind `ten-thousand`.
 *
 * Pinned: the scoring table (checked against an independent exact-cover scorer that tries every way to
 * split a set of dice into singles, sets, a straight and three pairs), which picks are allowed (every
 * die in a pick must be needed), which rolls score at all (checked on all 6^n ordered rolls, with the
 * chance of a bust for 1 to 6 dice pinned: 1,080 of 46,656 for six), the turn rules (hot dice, bust,
 * opening score, bank, a final round that every player gets to finish), the exact roll-or-bank table
 * (checked against a naive memoised enumeration of every ordered roll near the cap, and against a long
 * simulation of the Hard player), the three computer levels, the stored best scores (sanitised), the URL
 * parsing and the text. Thousands of random games always finish.
 */
import { describe, it, expect } from 'vitest';
import {
  GOALS, OPENINGS, TURN_CAP, MAX_ROUNDS, DIE_PIPS, LEVELS, mulberry32, rollDie, rollN, scoreDice, selectionScore, hasScoring, allPicks,
  bestPick, popcount, bustChance, rollValue, turnValue, freshTurnValue, newGame, canBank, rollTurn, takeDice, bankTurn, autoPickMask,
  computerAction, playComputerTurn, sanitizeStore, recordGame, parseSetup, clampGoal, clampOpening, plural, dieWord, pointsWord, playerName,
  describeEvent, resultSentence, shareText, type Game, type Level,
} from '../src/components/apps-private/ten-thousand/helpers';
import calculatorSource from '../src/components/apps-private/ten-thousand/Calculator.astro?raw';

const src = calculatorSource.replace(/\r\n?/g, '\n');

// ── Independent oracle: exact cover of a set of dice by scoring groups ───────

/** The best score that uses EVERY die in the set, or 0 when some die cannot be part of any score. */
const exactCover = (dice: number[]): number => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  let best = 0;
  if (dice.length === 6) {
    if (c.slice(1).every((n) => n === 1)) best = Math.max(best, 1500);
    if (c.slice(1).filter((n) => n === 2).length === 3) best = Math.max(best, 1000);
  }
  const go = (counts: number[]): number => {
    const f = counts.findIndex((n, i) => i > 0 && n > 0);
    if (f < 0) return 0;
    let top = -1;
    if (f === 1 && counts[1] >= 1) { const next = counts.slice(); next[1]--; const r = go(next); if (r >= 0) top = Math.max(top, 100 + r); }
    if (f === 5 && counts[5] >= 1) { const next = counts.slice(); next[5]--; const r = go(next); if (r >= 0) top = Math.max(top, 50 + r); }
    for (let g = 3; g <= counts[f]; g++) {
      const next = counts.slice();
      next[f] -= g;
      const r = go(next);
      if (r >= 0) top = Math.max(top, (f === 1 ? 1000 : f * 100) * 2 ** (g - 3) + r);
    }
    return top;
  };
  return Math.max(best, go(c));
};

/** Every multiset of n dice (as a sorted array), with how many ordered rolls make it. */
const multisets = (n: number): { dice: number[]; ways: number }[] => {
  const fact = [1, 1, 2, 6, 24, 120, 720];
  const out: { dice: number[]; ways: number }[] = [];
  const counts = [0, 0, 0, 0, 0, 0];
  const go = (face: number, left: number) => {
    if (face === 6) {
      if (left !== 0) return;
      const dice: number[] = [];
      counts.forEach((c, f) => { for (let i = 0; i < c; i++) dice.push(f + 1); });
      let ways = fact[n];
      for (const c of counts) ways /= fact[c];
      out.push({ dice, ways });
      return;
    }
    for (let k = 0; k <= left; k++) { counts[face] = k; go(face + 1, left - k); }
    counts[face] = 0;
  };
  go(0, n);
  return out;
};

describe('the scoring table', () => {
  it('pins the rules the page shows', () => {
    expect(scoreDice([1])).toBe(100);
    expect(scoreDice([5])).toBe(50);
    expect(scoreDice([1, 1])).toBe(200);
    expect(scoreDice([5, 5])).toBe(100);
    expect(scoreDice([2])).toBe(0);
    expect(scoreDice([2, 2, 2])).toBe(200);
    expect(scoreDice([3, 3, 3])).toBe(300);
    expect(scoreDice([4, 4, 4])).toBe(400);
    expect(scoreDice([5, 5, 5])).toBe(500);
    expect(scoreDice([6, 6, 6])).toBe(600);
    expect(scoreDice([1, 1, 1])).toBe(1000);
    expect(scoreDice([4, 4, 4, 4])).toBe(800);
    expect(scoreDice([4, 4, 4, 4, 4])).toBe(1600);
    expect(scoreDice([4, 4, 4, 4, 4, 4])).toBe(3200);
    expect(scoreDice([1, 1, 1, 1])).toBe(2000);
    expect(scoreDice([1, 1, 1, 1, 1])).toBe(4000);
    expect(scoreDice([1, 1, 1, 1, 1, 1])).toBe(8000);
    expect(scoreDice([1, 2, 3, 4, 5, 6])).toBe(1500);
    expect(scoreDice([2, 2, 3, 3, 4, 4])).toBe(1000);
    expect(scoreDice([1, 1, 5, 5, 6, 6])).toBe(1000);
    expect(scoreDice([2, 2, 2, 5])).toBe(250);
    expect(scoreDice([1, 5, 2, 3, 3, 4])).toBe(150);
    expect(scoreDice([])).toBe(0);
    expect(scoreDice([1, 2, 3, 4, 5, 6, 1])).toBe(0);
  });
  it('matches an independent exact-cover scorer on every set of 1 to 6 dice and every pick inside it', () => {
    let picked = 0;
    for (let n = 1; n <= 6; n++) {
      for (const { dice } of multisets(n)) {
        for (let mask = 1; mask < 1 << n; mask++) {
          const chosen = dice.filter((_, i) => mask & (1 << i));
          const want = exactCover(chosen);
          const got = selectionScore(dice, mask);
          if (got !== want) throw new Error(`dice ${dice} mask ${mask}: engine ${got}, oracle ${want}`);
          if (got > 0) picked++;
        }
      }
    }
    expect(picked).toBeGreaterThan(1000);
  });
  it('refuses junk picks', () => {
    const dice = [1, 2, 3];
    for (const bad of [0, -1, 8, 100, 1.5, NaN, Infinity]) expect(selectionScore(dice, bad), String(bad)).toBe(0);
    expect(selectionScore(dice, 0b011)).toBe(0); // the 2 is not part of any score
    expect(selectionScore(dice, 0b001)).toBe(100);
  });
  it('lists every allowed pick and the best one (most points, then fewest dice)', () => {
    const picks = allPicks([1, 1, 5, 2, 3, 4]);
    expect(picks.map((p) => p.score).sort((a, b) => a - b)).toEqual([50, 100, 100, 150, 150, 200, 250].sort((a, b) => a - b));
    const best = bestPick([1, 1, 5, 2, 3, 4]);
    expect(best).toEqual({ mask: 0b000111, score: 250, used: 3 });
    expect(bestPick([2, 3, 4, 6])).toBeNull();
    expect(popcount(0b10110)).toBe(3);
  });
});

describe('which rolls score', () => {
  it('agrees with an independent search for all ordered rolls of 1 to 6 dice, and pins the bust counts', () => {
    const busts: number[] = [];
    for (let n = 1; n <= 6; n++) {
      let bust = 0;
      for (const { dice, ways } of multisets(n)) {
        // The independent test: some subset of the dice can be covered exactly by scoring groups.
        let any = false;
        for (let mask = 1; mask < 1 << n && !any; mask++) if (exactCover(dice.filter((_, i) => mask & (1 << i))) > 0) any = true;
        expect(hasScoring(dice), `dice ${dice}`).toBe(any);
        if (!any) bust += ways;
      }
      busts.push(bust);
      expect(bustChance(n)).toBeCloseTo(bust / 6 ** n, 12);
    }
    expect(busts).toEqual([4, 16, 60, 204, 600, 1080]);
    expect(bustChance(6)).toBeCloseTo(1080 / 46656, 12);
    expect(Number.isNaN(bustChance(0))).toBe(true);
    expect(Number.isNaN(bustChance(7))).toBe(true);
  });
});

describe('the dice', () => {
  it('maps the unit interval onto 1 to 6 and survives a broken generator', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999999)).toBe(6);
    expect(rollDie(() => NaN)).toBe(1);
    expect(rollDie(() => -1)).toBe(1);
    expect(rollDie(() => 9)).toBe(6);
    expect(rollN(4, () => 0.5)).toHaveLength(4);
    expect(rollN(-3, () => 0.5)).toHaveLength(0);
    expect(rollN(99, () => 0.5)).toHaveLength(6);
    expect(rollN(1.5, () => 0.5)).toHaveLength(0);
  });
  it('is close to fair over a long seeded run', () => {
    const rng = mulberry32(11);
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) c[rollDie(rng)]++;
    for (let f = 1; f <= 6; f++) expect(Math.abs(c[f] / 60000 - 1 / 6)).toBeLessThan(0.01);
  });
  it('draws each face as the right number of dots', () => {
    for (let v = 1; v <= 6; v++) expect(DIE_PIPS[v]).toHaveLength(v);
  });
});

describe('the turn rules', () => {
  /** A game whose next roll is the given dice, built by feeding the die generator the right numbers. */
  const rigged = (faces: number[]) => { let i = 0; return () => ((faces[i++ % faces.length] - 1) + 0.5) / 6; };

  it('starts with six dice, nothing banked, either seat first', () => {
    const g = newGame(2, 10000, 500);
    expect(g).toMatchObject({ goal: 10000, opening: 500, players: 2, scores: [0, 0], seat: 0, round: 1, phase: 'roll', left: 6, total: 0, final: false });
    expect(newGame(3, 5000, 0, 2).seat).toBe(2);
    expect(newGame(9, 5000, 0).players).toBe(2);
    expect(newGame(2, 7, 3).goal).toBe(10000);
    expect(newGame(2, 7, 3).opening).toBe(500);
  });
  it('a scoring roll moves to the pick phase; a roll with nothing busts and passes the dice', () => {
    const g = newGame(2, 10000, 0);
    const ok = rollTurn(g, rigged([1, 2, 3, 4, 6, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(ok.state.phase).toBe('pick');
    expect(ok.event.t).toBe('roll');
    const bust = rollTurn(g, rigged([2, 2, 3, 3, 4, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(bust.event).toMatchObject({ t: 'bust', seat: 0, lost: 0 });
    expect(bust.state.seat).toBe(1);
    expect(bust.state.phase).toBe('roll');
    expect(bust.state.total).toBe(0);
    expect(bust.state.left).toBe(6);
    expect(bust.state.dice).toEqual([2, 2, 3, 3, 4, 6]);
  });
  it('refuses actions out of order and picks that do not score', () => {
    const g = newGame(2, 10000, 0);
    expect(takeDice(g, 1)).toBeNull();
    expect(bankTurn(g)).toBeNull();
    const picked = rollTurn(g, rigged([1, 2, 3, 4, 6, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(rollTurn(picked.state, mulberry32(1))).toBeNull();
    expect(bankTurn(picked.state)).toBeNull();
    expect(takeDice(picked.state, 0)).toBeNull();
    expect(takeDice(picked.state, 0b000010)).toBeNull();
    expect(takeDice(picked.state, 0b111111)).toBeNull();
    expect(takeDice(picked.state, 99)).toBeNull();
  });
  it('sets dice aside, adds to the turn total, then banks or rolls the rest', () => {
    const g = newGame(2, 10000, 0);
    let r = rollTurn(g, rigged([1, 5, 2, 3, 4, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    r = takeDice(r.state, 0b000011) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(r.event).toMatchObject({ t: 'take', score: 150, used: 2, hot: false, total: 150 });
    expect(r.state).toMatchObject({ phase: 'decide', left: 4, total: 150 });
    const rolled = rollTurn(r.state, rigged([1, 1, 1, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(rolled.state.dice).toHaveLength(4);
    const banked = bankTurn(r.state) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(banked.event).toEqual({ t: 'bank', seat: 0, amount: 150, score: 150 });
    expect(banked.state.scores).toEqual([150, 0]);
    expect(banked.state.seat).toBe(1);
    expect(banked.state.total).toBe(0);
    expect(banked.state.left).toBe(6);
  });
  it('rolls six fresh dice after every die has scored (hot dice) and keeps the turn total', () => {
    const g = newGame(2, 10000, 0);
    let r = rollTurn(g, rigged([1, 2, 3, 4, 5, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    r = takeDice(r.state, 0b111111) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(r.event).toMatchObject({ score: 1500, used: 6, hot: true });
    expect(r.state.left).toBe(6);
    expect(r.state.total).toBe(1500);
    expect(r.state.phase).toBe('decide');
  });
  it('loses the turn total on a bust and passes the turn', () => {
    const g = newGame(2, 10000, 0);
    let r = rollTurn(g, rigged([1, 2, 3, 4, 6, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    r = takeDice(r.state, 1) as NonNullable<ReturnType<typeof rollTurn>>;
    const bust = rollTurn(r.state, rigged([2, 3, 4, 6, 2])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(bust.event).toMatchObject({ t: 'bust', lost: 100 });
    expect(bust.state.scores).toEqual([0, 0]);
    expect(bust.state.seat).toBe(1);
  });
  it('needs the opening score before the first bank, and not after', () => {
    let g = newGame(2, 10000, 500);
    let r = rollTurn(g, rigged([1, 2, 3, 4, 6, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    r = takeDice(r.state, 1) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(canBank(r.state)).toBe(false);
    expect(bankTurn(r.state)).toBeNull();
    g = { ...r.state, total: 500 };
    expect(canBank(g)).toBe(true);
    g = { ...r.state, scores: [50, 0], total: 100 };
    expect(canBank(g)).toBe(true);
    expect(canBank({ ...g, total: 0 })).toBe(false);
  });
  it('plays a final round so every player gets the same number of turns, and the highest score wins', () => {
    // Seat 0 banks the goal; seat 1 still gets a turn.
    let g: Game = { ...newGame(2, 5000, 0), scores: [4900, 4000], phase: 'decide', total: 200, left: 4, dice: [] };
    const b = bankTurn(g) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(b.state.final).toBe(true);
    expect(b.state.phase).toBe('roll');
    expect(b.state.seat).toBe(1);
    // Seat 1 banks and the round ends: seat 1 passes 5100.
    g = { ...b.state, phase: 'decide', total: 1500, left: 3 };
    const end = bankTurn(g) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(end.state.phase).toBe('over');
    expect(end.state.winners).toEqual([1]);
    // If the last seat reaches the goal first, the game ends at once.
    const last: Game = { ...newGame(2, 5000, 0, 1), scores: [3000, 4900], seat: 1, phase: 'decide', total: 150, left: 2 };
    const done = bankTurn(last) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(done.state.phase).toBe('over');
    expect(done.state.winners).toEqual([1]);
  });
  it('stops a game that goes on and on at the round limit', () => {
    const g: Game = { ...newGame(2, 10000, 0, 1), round: MAX_ROUNDS, seat: 1, scores: [50, 100] };
    const r = rollTurn(g, rigged([2, 2, 3, 3, 4, 6])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(r.state.phase).toBe('over');
    expect(r.state.winners).toEqual([1]);
  });
  it('has an auto pick that takes the best scoring dice', () => {
    const g = rollTurn(newGame(2, 10000, 0), rigged([1, 1, 1, 5, 2, 3])) as NonNullable<ReturnType<typeof rollTurn>>;
    expect(autoPickMask(g.state)).toBe(0b001111);
    expect(autoPickMask(newGame(2, 10000, 0))).toBe(0);
  });
});

describe('the exact roll-or-bank table', () => {
  /** A naive version: enumerate every ordered roll, every pick, memoise by (dice, total). */
  const memo = new Map<string, number>();
  const optionCache = new Map<string, { score: number; used: number }[]>();
  const options = (dice: number[]) => {
    const key = [...dice].sort().join('');
    let o = optionCache.get(key);
    if (!o) {
      o = [];
      const sorted = [...dice].sort();
      for (let mask = 1; mask < 1 << sorted.length; mask++) {
        const s = exactCover(sorted.filter((_, i) => mask & (1 << i)));
        if (s > 0) o.push({ score: s, used: popcount(mask) });
      }
      optionCache.set(key, o);
    }
    return o;
  };
  const naiveRoll = (n: number, t: number): number => {
    const key = `${n}:${t}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let sum = 0;
    const total = 6 ** n;
    for (let k = 0; k < total; k++) {
      const dice: number[] = [];
      let x = k;
      for (let i = 0; i < n; i++) { dice.push((x % 6) + 1); x = Math.floor(x / 6); }
      let best = 0;
      for (const pk of options(dice)) {
        const nt = t + pk.score;
        const left = pk.used === n ? 6 : n - pk.used;
        best = Math.max(best, nt >= TURN_CAP ? nt : Math.max(nt, naiveRoll(left, nt)));
      }
      sum += best;
    }
    const v = sum / total;
    memo.set(key, v);
    return v;
  };

  it('matches a naive enumeration of every ordered roll for totals just under the cap', () => {
    for (const n of [1, 2, 3, 4, 6]) {
      for (const t of [TURN_CAP - 50, TURN_CAP - 150, TURN_CAP - 300]) {
        expect(rollValue(n, t), `${n} dice, total ${t}`).toBeCloseTo(naiveRoll(n, t), 7);
      }
    }
  }, 120_000);
  it('is bounded: never worse than banking, a bust is worth nothing, above the cap it is the total', () => {
    for (let n = 1; n <= 6; n++) {
      for (let t = 0; t <= TURN_CAP + 500; t += 50) {
        expect(turnValue(n, t)).toBeGreaterThanOrEqual(t);
        expect(rollValue(n, t)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(rollValue(3, TURN_CAP + 100)).toBe(TURN_CAP + 100);
    expect(Number.isNaN(rollValue(0, 0))).toBe(true);
    expect(Number.isNaN(rollValue(3, 75))).toBe(true);
    expect(Number.isNaN(rollValue(3, -50))).toBe(true);
  });
  it('rolls on from a fresh start and from hot dice, banks with few dice left and a lot at risk', () => {
    expect(rollValue(6, 0)).toBeGreaterThan(0);
    expect(rollValue(6, 1000)).toBeGreaterThan(1000);
    expect(rollValue(1, 1000)).toBeLessThan(1000);
    expect(rollValue(2, 500)).toBeLessThan(500);
    expect(rollValue(5, 300)).toBeGreaterThan(300);
  });
  it('pins the average value of a fresh turn played for the most points', () => {
    expect(freshTurnValue()).toBeCloseTo(PIN.fresh, 1);
  });
  it('agrees with a long simulation of the Hard player taking one turn at a time', () => {
    const rng = mulberry32(2718);
    const n = 20000;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const g0 = { ...newGame(2, 1_000_000, 0), scores: [0, 0] };
      const r = playComputerTurn(g0, 'hard', rng);
      total += r.state.scores[0];
    }
    expect(Math.abs(total / n - freshTurnValue())).toBeLessThan(18);
  }, 120_000);
});

describe('the computer players', () => {
  const play = (levels: Level[], seed: number, start = 0): Game => {
    const rng = mulberry32(seed);
    let g = newGame(levels.length, 10000, 500, start);
    for (let guard = 0; g.phase !== 'over' && guard < 2000; guard++) g = playComputerTurn(g, levels[g.seat], rng).state;
    return g;
  };
  it('always take a legal action, in every phase', () => {
    const rng = mulberry32(5);
    for (const level of LEVELS) {
      let g = newGame(3, 10000, 500);
      for (let step = 0; step < 3000 && g.phase !== 'over'; step++) {
        const a = computerAction(g, level);
        const r = a.kind === 'roll' ? rollTurn(g, rng) : a.kind === 'take' ? takeDice(g, a.mask) : bankTurn(g);
        expect(r, `${level} ${JSON.stringify(a)} in ${g.phase}`).not.toBeNull();
        g = (r as NonNullable<typeof r>).state;
      }
      expect(g.phase).toBe('over');
    }
  });
  it('Hard beats Easy and Medium head to head', () => {
    let hardVsEasy = 0;
    let hardVsMedium = 0;
    const N = 160;
    for (let i = 0; i < N; i++) {
      const a = play(['hard', 'easy'], 100 + i, i % 2);
      if (a.winners.length === 1 && a.winners[0] === 0) hardVsEasy++;
      const b = play(['hard', 'medium'], 900 + i, i % 2);
      if (b.winners.length === 1 && b.winners[0] === 0) hardVsMedium++;
    }
    expect(hardVsEasy / N).toBeGreaterThan(0.6);
    expect(hardVsMedium / N).toBeGreaterThan(0.5);
  }, 180_000);
  it('banks at once when that reaches the goal, and keeps rolling in a final round until ahead', () => {
    const win: Game = { ...newGame(2, 5000, 0), scores: [4800, 100], phase: 'decide', total: 250, left: 3 };
    for (const l of LEVELS) expect(computerAction(win, l)).toEqual({ kind: 'bank' });
    const behind: Game = { ...newGame(2, 5000, 0), scores: [2000, 5200], phase: 'decide', total: 800, left: 2, final: true };
    expect(computerAction(behind, 'hard')).toEqual({ kind: 'roll' });
    expect(computerAction({ ...behind, total: 3500 }, 'hard')).toEqual({ kind: 'bank' });
    // The opening score: nothing to bank yet, so it must roll.
    const opening: Game = { ...newGame(2, 10000, 500), phase: 'decide', total: 300, left: 3 };
    for (const l of LEVELS) expect(computerAction(opening, l)).toEqual({ kind: 'roll' });
  });
  it('survives a broken generator', () => {
    expect(() => playComputerTurn(newGame(2, 5000, 0), 'hard', () => NaN)).not.toThrow();
  });
});

describe('fuzz: random games never break an invariant', () => {
  it('plays 400 games with random legal actions: scores are multiples of 50 that never fall, and every game ends', () => {
    const rng = mulberry32(31);
    for (let n = 0; n < 400; n++) {
      const players = 2 + (n % 3);
      let g = newGame(players, GOALS[n % 2], OPENINGS[n % 2]);
      let steps = 0;
      while (g.phase !== 'over') {
        expect(steps++).toBeLessThan(60000);
        const before = g.scores.slice();
        let r;
        const roll = rng();
        if (g.phase === 'roll') r = rollTurn(g, rng);
        else if (g.phase === 'pick') {
          const picks = allPicks(g.dice);
          expect(picks.length).toBeGreaterThan(0);
          r = takeDice(g, picks[Math.floor(rng() * picks.length)].mask);
        } else r = roll < 0.45 && canBank(g) ? bankTurn(g) : rollTurn(g, rng);
        expect(r).not.toBeNull();
        g = (r as NonNullable<typeof r>).state;
        g.scores.forEach((s, i) => { expect(s % 50).toBe(0); expect(s).toBeGreaterThanOrEqual(before[i]); });
        expect(g.total % 50).toBe(0);
        expect(g.left).toBeGreaterThanOrEqual(1);
        expect(g.left).toBeLessThanOrEqual(6);
      }
      expect(g.winners.length).toBeGreaterThanOrEqual(1);
      const top = Math.max(...g.scores);
      for (const w of g.winners) expect(g.scores[w]).toBe(top);
    }
  }, 120_000);
  it('computer-only games of every size and level always end with a winner at or above the goal (or the round limit)', () => {
    for (let n = 0; n < 150; n++) {
      const levels = Array.from({ length: 2 + (n % 3) }, (_, i) => LEVELS[(n + i) % 3]);
      const rng = mulberry32(700 + n);
      let g = newGame(levels.length, 5000, OPENINGS[n % 2]);
      for (let guard = 0; g.phase !== 'over' && guard < 3000; guard++) g = playComputerTurn(g, levels[g.seat], rng).state;
      expect(g.phase).toBe('over');
      expect(Math.max(...g.scores)).toBeGreaterThanOrEqual(5000);
    }
  }, 120_000);
});

describe('stored results, setup and text', () => {
  it('reads junk safely', () => {
    const empty = { b: 0, n: 0, w: 0, h: 0 };
    expect(sanitizeStore(null)).toEqual(empty);
    expect(sanitizeStore('x')).toEqual(empty);
    expect(sanitizeStore([1])).toEqual(empty);
    expect(sanitizeStore(JSON.parse('{"__proto__":{"b":5000},"b":125,"n":1.5,"w":"2","h":-1}'))).toEqual(empty);
    expect(sanitizeStore({ b: 10500, n: 4, w: 2, h: 7, extra: 1 })).toEqual({ b: 10500, n: 4, w: 2, h: 7 });
    expect(sanitizeStore({ b: 999999 }).b).toBe(0);
    expect(sanitizeStore({ n: 1, w: 5 }).w).toBe(1);
  });
  it('records games: best only above the old best, wins and hot dice counted', () => {
    const s = sanitizeStore(null);
    let r = recordGame(s, 10500, true, 2);
    expect(r.record).toBe(true);
    expect(r.store).toEqual({ b: 10500, n: 1, w: 1, h: 2 });
    r = recordGame(r.store, 9000, false, 0);
    expect(r.record).toBe(false);
    expect(r.store).toEqual({ b: 10500, n: 2, w: 1, h: 2 });
    expect(recordGame(s, 125, true, 0).record).toBe(false);
    expect(recordGame(s, 1e9, true, 0).store).toBe(s);
    expect(recordGame(s, NaN, true, 0).store).toBe(s);
  });
  it('clamps junk URL parameters', () => {
    expect(parseSetup({}, 9)).toEqual({ computers: 1, level: 'medium', goal: 10000, opening: 500, seed: 9 });
    expect(parseSetup({ c: '3', l: 'hard', g: '5000', o: '0', s: '44' }, 1)).toEqual({ computers: 3, level: 'hard', goal: 5000, opening: 0, seed: 44 });
    for (const c of ['0', '4', '-1', 'x', '', '1.5']) expect(parseSetup({ c }, 1).computers, c).toBe(1);
    for (const g of ['0', '999', 'x', '', '-5000']) expect(parseSetup({ g }, 1).goal, g).toBe(10000);
    for (const o of ['100', 'x', '-1']) expect(parseSetup({ o }, 1).opening, o).toBe(500);
    for (const s of ['0', 'abc', '4294967296', '1.5', '']) expect(parseSetup({ s }, 7).seed, s).toBe(7);
    expect(clampGoal(5000)).toBe(5000);
    expect(clampGoal('5000')).toBe(10000);
    expect(clampOpening(0)).toBe(0);
  });
  it('words things correctly', () => {
    expect(plural(1, 'game')).toBe('1 game');
    expect(dieWord(1)).toBe('1 die');
    expect(dieWord(3)).toBe('3 dice');
    expect(pointsWord(50)).toBe('50 points');
    expect(playerName(0)).toBe('You');
    expect(playerName(3)).toBe('Computer 3');
    expect(describeEvent({ t: 'roll', seat: 0, dice: [1, 5] })).toBe('You rolled 1, 5.');
    expect(describeEvent({ t: 'bust', seat: 1, dice: [2, 3], lost: 300 })).toBe('Computer 1 rolled 2, 3: nothing scores. 300 points lost.');
    expect(describeEvent({ t: 'bust', seat: 0, dice: [2], lost: 0 })).toContain('Nothing was at risk.');
    expect(describeEvent({ t: 'take', seat: 0, score: 1500, used: 6, hot: true, total: 1500 })).toContain('Hot dice');
    expect(describeEvent({ t: 'bank', seat: 0, amount: 450, score: 450 })).toBe('You banked 450 points and have 450.');
    expect(describeEvent({ t: 'bank', seat: 2, amount: 50, score: 600 })).toBe('Computer 2 banked 50 points and has 600.');
    expect(resultSentence([10200, 9800], [0])).toBe('You win! You 10200, Computer 1 9800.');
    expect(resultSentence([9000, 10050], [1])).toBe('Computer 1 wins! You 9000, Computer 1 10050.');
    expect(resultSentence([10000, 10000], [0, 1])).toBe('A tie between You and Computer 1. You 10000, Computer 1 10000.');
    const setup = parseSetup({}, 3);
    expect(shareText(setup, newGame(2, 10000, 500))).toBe('Ten Thousand (1 computer, Medium, race to 10000): game in progress, You 0, Computer 1 0');
  });
});

describe('the page', () => {
  it('has the shell events, a live region, sound off by default and reduced motion', () => {
    expect(src).toMatch(/id="tnth-app"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/app:copy/);
    expect(src).toMatch(/app:export/);
    expect(src).toMatch(/app:reset/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/aria-pressed="false"/);
  });
});

// The figure the guide page states. Computed by the solver; the simulation above checks it.
const PIN = { fresh: 561.7 };
