/**
 * games-backgammon.test.ts - the engine behind `backgammon`.
 *
 * Pinned: the starting position (167 pips each), entering from the bar, blocking by two checkers,
 * hitting a lone checker, bearing off (exact die, or a larger die from the highest point only, and
 * never while a checker is outside the home board), doubles played four times, the rule that you must
 * use as much of the throw as you can and the larger die if only one can be played, gammons and
 * backgammons, and the opening throw. A second implementation, written in each player's own point
 * numbers (1 to 24, bar 25, off 0) with plain recursion over every order of the dice, is compared with the
 * engine on thousands of positions and all 21 throws. The one-step-at-a-time rules the page uses
 * are checked to reach exactly the same plays. The computer is checked for legality, determinism,
 * evaluation counts and strength.
 */
import { describe, it, expect } from 'vitest';
import {
  startPos, newGame, stepsFor, applyStep, legalSteps, generatePlays, winnerOf, gamePoints, pips, checkersOf, ownAt, barOf, offOf, keyOf, hasContact,
  evaluate, chooseTurn, openingRoll, rollDie, rollDice, diceToPlay, describeStep, describeResult, pointsText, resultKind, pointNumber, undoIndex, mulberry32,
  opponent, nameOf, isHome, ROLLS, SOLID, RING, BAR, OFF, CHECKERS, SLOTS, WIN_VALUE, HARD_CANDIDATES, HARD_EVALS,
  type Pos, type Side, type Level, type Step, type Stats,
} from '../src/components/apps-private/backgammon/helpers';

// ── Independent oracle ──
interface OPos { mine: number[]; theirs: number[] }
/** The position from the mover's own point of view: points 1 to 24 (24 is the farthest), 25 the bar, 0 off. */
const toOracle = (pos: Pos, side: Side): OPos => {
  const mine = new Array(26).fill(0);
  const theirs = new Array(26).fill(0);
  const opp = opponent(side);
  for (let p = 1; p <= 24; p++) {
    const idx = side === SOLID ? p - 1 : 24 - p;
    mine[p] = ownAt(pos, side, idx);
    theirs[25 - p] = ownAt(pos, opp, idx);
  }
  mine[25] = barOf(pos, side); mine[0] = offOf(pos, side);
  theirs[25] = barOf(pos, opp); theirs[0] = offOf(pos, opp);
  return { mine, theirs };
};
interface OMove { from: number; to: number; die: number }
const oSingles = (o: OPos, d: number): OMove[] => {
  const out: OMove[] = [];
  if (o.mine[25] > 0) {
    const to = 25 - d;
    if (o.theirs[25 - to] < 2) out.push({ from: 25, to, die: d });
    return out;
  }
  let allHome = true;
  for (let p = 7; p <= 24; p++) if (o.mine[p] > 0) allHome = false;
  for (let p = 1; p <= 24; p++) {
    if (o.mine[p] === 0) continue;
    const to = p - d;
    if (to >= 1) { if (o.theirs[25 - to] < 2) out.push({ from: p, to, die: d }); }
    else if (allHome) {
      if (to === 0) out.push({ from: p, to: 0, die: d });
      else {
        let higher = false;
        for (let q = p + 1; q <= 6; q++) if (o.mine[q] > 0) higher = true;
        if (!higher) out.push({ from: p, to: 0, die: d });
      }
    }
  }
  return out;
};
const oApply = (o: OPos, m: OMove): OPos => {
  const mine = o.mine.slice();
  const theirs = o.theirs.slice();
  mine[m.from]--;
  if (m.to >= 1) {
    if (theirs[25 - m.to] === 1) { theirs[25 - m.to] = 0; theirs[25]++; }
    mine[m.to]++;
  } else mine[0]++;
  return { mine, theirs };
};
const oKey = (o: OPos): string => o.mine.join(',') + '|' + o.theirs.join(',');
/** All maximal plays by brute force over every order of the dice and every choice, with the larger-die rule. */
const oPlays = (o: OPos, dice: number[]): Set<string> => {
  const nonDouble = dice.length === 2 && dice[0] !== dice[1];
  const orders: number[][] = nonDouble ? [[dice[0], dice[1]], [dice[1], dice[0]]] : [dice.length === 2 ? [dice[0], dice[0], dice[0], dice[0]] : dice];
  const results: { key: string; used: number; firstDie: number }[] = [];
  const seen = new Set<string>();
  const dfs = (cur: OPos, order: number[], k: number, first: number) => {
    const memo = `${oKey(cur)}#${k}#${first}#${order.join('')}`;
    if (seen.has(memo)) return;
    seen.add(memo);
    if (k === order.length) { results.push({ key: oKey(cur), used: k, firstDie: first }); return; }
    const ms = oSingles(cur, order[k]);
    if (!ms.length) { results.push({ key: oKey(cur), used: k, firstDie: first }); return; }
    for (const m of ms) dfs(oApply(cur, m), order, k + 1, k === 0 ? m.die : first);
  };
  for (const order of orders) dfs(o, order, 0, 0);
  const most = Math.max(...results.map((r) => r.used));
  if (most === 0) return new Set();
  let keep = results.filter((r) => r.used === most);
  if (most === 1 && nonDouble) {
    const big = Math.max(dice[0], dice[1]);
    const bigs = keep.filter((r) => r.firstDie === big);
    if (bigs.length) keep = bigs;
  }
  return new Set(keep.map((r) => r.key));
};

const enginePlays = (pos: Pos, side: Side, dice: number[]): Set<string> => new Set(generatePlays(pos, side, dice).map((p) => oKey(toOracle(p.pos, side))));

// ── helpers for building positions ──
const mk = (spec: { s?: Record<number, number>; r?: Record<number, number>; barS?: number; barR?: number; offS?: number; offR?: number }): Pos => {
  const p = new Int8Array(SLOTS);
  for (const [i, n] of Object.entries(spec.s ?? {})) p[Number(i)] += n;
  for (const [i, n] of Object.entries(spec.r ?? {})) p[Number(i)] -= n;
  p[24] = spec.barS ?? 0; p[25] = spec.barR ?? 0; p[26] = spec.offS ?? 0; p[27] = spec.offR ?? 0;
  return p;
};
const check15 = (pos: Pos) => { expect(checkersOf(pos, SOLID)).toBe(CHECKERS); expect(checkersOf(pos, RING)).toBe(CHECKERS); };

/** A random but legal position: no point holds both colours, 15 checkers a side, some on the bar or borne off. */
const randomPos = (rng: () => number, kind: 'mid' | 'bearoff'): Pos => {
  const p = new Int8Array(SLOTS);
  for (const side of [SOLID, RING] as Side[]) {
    const sgn = side === SOLID ? 1 : -1;
    let left = CHECKERS;
    if (kind === 'mid') {
      const bar = rng() < 0.3 ? 1 + Math.floor(rng() * 2) : 0;
      p[side === SOLID ? 24 : 25] = bar; left -= bar;
      const off = rng() < 0.25 ? Math.floor(rng() * 5) : 0;
      p[side === SOLID ? 26 : 27] = off; left -= off;
    } else {
      const off = Math.floor(rng() * 12);
      p[side === SOLID ? 26 : 27] = off; left -= off;
    }
    const spots: number[] = [];
    for (let i = 0; i < 24; i++) {
      const homeOnly = kind === 'bearoff';
      if (homeOnly && !isHome(side, i)) continue;
      if (p[i] !== 0) continue;
      spots.push(i);
    }
    // choose a handful of points for this side
    const mine: number[] = [];
    const n = 1 + Math.floor(rng() * 6);
    for (let k = 0; k < n && spots.length; k++) mine.push(spots.splice(Math.floor(rng() * spots.length), 1)[0]);
    if (!mine.length) { p[side === SOLID ? 26 : 27] += left; continue; }
    while (left > 0) { const i = mine[Math.floor(rng() * mine.length)]; if (Math.abs(p[i] + sgn) <= 15) { p[i] += sgn; left--; } }
  }
  // Clashing points (both colours chose the same point) are resolved by the first writer: rebuild without clashes.
  return p;
};
/** randomPos may put checkers of both colours on one point (they cancel); reject those. */
const validRandom = (rng: () => number, kind: 'mid' | 'bearoff'): Pos => {
  for (let tries = 0; tries < 1000; tries++) {
    const p = randomPos(rng, kind);
    let ok = true;
    // randomPos adds with signs, so a clash shows up as a wrong total
    if (checkersOf(p, SOLID) !== CHECKERS || checkersOf(p, RING) !== CHECKERS) ok = false;
    if (ok) return p;
  }
  throw new Error('no random position');
};

const ALL_THROWS: [number, number][] = ROLLS.map((r) => r.dice);

describe('the starting position', () => {
  const g = newGame();
  it('has 15 checkers a side, 167 pips each, 2 on the farthest point, and nothing on the bar or borne off', () => {
    check15(g.pos);
    expect(pips(g.pos, SOLID)).toBe(167);
    expect(pips(g.pos, RING)).toBe(167);
    expect(g.pos[23]).toBe(2); expect(g.pos[12]).toBe(5); expect(g.pos[7]).toBe(3); expect(g.pos[5]).toBe(5);
    expect(g.pos[0]).toBe(-2); expect(g.pos[11]).toBe(-5); expect(g.pos[16]).toBe(-3); expect(g.pos[18]).toBe(-5);
    expect(barOf(g.pos, SOLID) + barOf(g.pos, RING) + offOf(g.pos, SOLID) + offOf(g.pos, RING)).toBe(0);
    expect(hasContact(g.pos)).toBe(true);
    expect(winnerOf(g.pos)).toBe(0);
    expect(g.toMove).toBe(SOLID);
  });
  it('is the same board seen from either side (mirror image)', () => {
    const a = toOracle(g.pos, SOLID);
    const b = toOracle(g.pos, RING);
    expect(a.mine).toEqual(b.mine);
    expect(a.theirs).toEqual(b.theirs);
    expect(a.mine[24]).toBe(2); expect(a.mine[13]).toBe(5); expect(a.mine[8]).toBe(3); expect(a.mine[6]).toBe(5);
  });
  it('point numbers are each side\'s own: 24 is the farthest, 1 the nearest to bearing off', () => {
    expect(pointNumber(SOLID, 23)).toBe(24);
    expect(pointNumber(RING, 0)).toBe(24);
    expect(pointNumber(SOLID, 0)).toBe(1);
    expect(pointNumber(RING, 23)).toBe(1);
  });
  it('6-5 lets one checker run from the farthest point to the 13-point, through either intermediate point', () => {
    const plays = generatePlays(g.pos, SOLID, [6, 5]);
    const keys = new Set(plays.map((p) => keyOf(p.pos)));
    const run = applyStep(applyStep(g.pos, SOLID, { from: 23, to: 17, die: 6, hit: false }), SOLID, { from: 17, to: 12, die: 5, hit: false });
    expect(keys.has(keyOf(run))).toBe(true);
    expect(run[12]).toBe(6);
    expect(plays.every((p) => p.steps.length === 2)).toBe(true);
  });
  it('a 5 from the farthest point is blocked by the enemy\'s five checkers on their 6-point, a 6 is not', () => {
    // Index 17 is empty but index 18 holds five enemy checkers: a 5 from index 23 lands on 18 and is blocked.
    expect(stepsFor(g.pos, SOLID, 5).some((s) => s.from === 23)).toBe(false);
    expect(stepsFor(g.pos, SOLID, 6).some((s) => s.from === 23)).toBe(true);
    expect(stepsFor(g.pos, SOLID, 6).some((s) => s.from === 12 && s.to === 6)).toBe(true);
  });
});

describe('single steps', () => {
  it('entering from the bar uses the die as the point count from the far end, and is blocked by two enemy checkers', () => {
    const pos = mk({ s: { 5: 14 }, r: { 20: 2, 21: 1, 3: 14 }, barS: 1 });
    // Solid enters at index 24 - die. Index 20 holds 2 Ring checkers (die 4 blocked), index 21 holds 1 (die 3 hits).
    expect(stepsFor(pos, SOLID, 4)).toEqual([]);
    expect(stepsFor(pos, SOLID, 3)).toEqual([{ from: BAR, to: 21, die: 3, hit: true }]);
    expect(stepsFor(pos, SOLID, 6)).toEqual([{ from: BAR, to: 18, die: 6, hit: false }]);
    // Ring enters at index die - 1
    const ringBar = mk({ s: { 0: 2, 1: 1, 20: 12 }, r: { 20: 0, 10: 14 }, barR: 1 });
    expect(stepsFor(ringBar, RING, 1)).toEqual([]); // index 0: two Solid checkers
    expect(stepsFor(ringBar, RING, 2)).toEqual([{ from: BAR, to: 1, die: 2, hit: true }]);
  });
  it('with a checker on the bar nothing else may move', () => {
    const pos = mk({ s: { 5: 14 }, r: { 3: 15 }, barS: 1 });
    expect(stepsFor(pos, SOLID, 2).every((s) => s.from === BAR)).toBe(true);
    expect(legalSteps(pos, SOLID, [2, 3]).every((s) => s.from === BAR)).toBe(true);
  });
  it('hitting a lone checker sends it to the bar; two checkers are a block', () => {
    const pos = mk({ s: { 10: 1, 5: 14 }, r: { 7: 1, 8: 1, 3: 13 } });
    const hit = stepsFor(pos, SOLID, 3).find((s) => s.from === 10)!;
    expect(hit).toEqual({ from: 10, to: 7, die: 3, hit: true });
    const after = applyStep(pos, SOLID, hit);
    expect(after[7]).toBe(1);
    expect(barOf(after, RING)).toBe(1);
    check15(after);
    const blocked = mk({ s: { 10: 1, 5: 14 }, r: { 7: 2, 3: 13 } });
    expect(stepsFor(blocked, SOLID, 3).some((s) => s.from === 10)).toBe(false);
  });
  it('cannot bear off while a checker is outside the home board or on the bar', () => {
    const outside = mk({ s: { 0: 1, 1: 1, 2: 12, 6: 1 }, r: { 20: 15 } });
    expect(stepsFor(outside, SOLID, 6).some((s) => s.to === OFF)).toBe(false);
    const onBar = mk({ s: { 0: 1, 1: 13 }, r: { 20: 15 }, barS: 1 });
    expect(stepsFor(onBar, SOLID, 6).some((s) => s.to === OFF)).toBe(false);
  });
  it('bears off with the exact die, and with a larger die only from the highest point', () => {
    const pos = mk({ s: { 0: 3, 2: 4, 4: 8 }, r: { 20: 15 } });
    expect(stepsFor(pos, SOLID, 1).filter((s) => s.to === OFF).map((s) => s.from)).toEqual([0]);
    expect(stepsFor(pos, SOLID, 3).filter((s) => s.to === OFF).map((s) => s.from)).toEqual([2]);
    // a 6 is bigger than every point: only the highest point (index 4, point 5) may bear off
    expect(stepsFor(pos, SOLID, 6).filter((s) => s.to === OFF).map((s) => s.from)).toEqual([4]);
    // a 4 may bear off from point 4 exactly? index 3 is empty, so a 4 is bigger than the point-3 checkers but there are higher ones: no
    expect(stepsFor(pos, SOLID, 4).filter((s) => s.to === OFF)).toEqual([]);
    // Ring: its home is indexes 18 to 23 and index 23 is its point 1
    const ring = mk({ s: { 5: 15 }, r: { 23: 2, 21: 4, 19: 9 } });
    expect(stepsFor(ring, RING, 1).filter((s) => s.to === OFF).map((s) => s.from)).toEqual([23]);
    expect(stepsFor(ring, RING, 5).filter((s) => s.to === OFF).map((s) => s.from)).toEqual([19]);
    expect(stepsFor(ring, RING, 6).filter((s) => s.to === OFF).map((s) => s.from)).toEqual([19]);
  });
  it('a borne-off checker leaves the board and the count is kept', () => {
    const pos = mk({ s: { 0: 14 }, offS: 1, r: { 20: 15 } });
    const s = stepsFor(pos, SOLID, 1)[0];
    const after = applyStep(pos, SOLID, s);
    expect(offOf(after, SOLID)).toBe(2);
    check15(after);
  });
});

describe('using the whole throw', () => {
  it('must play both dice when it is possible, even if one order blocks the other', () => {
    // Solid has one checker on index 8 and the rest home. A 3 then a 6 is impossible (index 5 then -1), but 6 then 3 ... check by oracle below.
    const pos = mk({ s: { 8: 1, 0: 14 }, r: { 5: 2, 20: 13 } });
    // Playing the 3 first lands on index 5 (blocked, two Ring checkers), so the 3 must be played elsewhere or the 6 first.
    const plays = generatePlays(pos, SOLID, [3, 6]);
    expect(plays.length).toBeGreaterThan(0);
    const most = Math.max(...plays.map((p) => p.steps.length));
    expect(plays.every((p) => p.steps.length === most)).toBe(true);
    expect(enginePlays(pos, SOLID, [3, 6])).toEqual(oPlays(toOracle(pos, SOLID), [3, 6]));
  });
  it('when only one die can be played, the larger must be played if it can', () => {
    // Solid has a checker on the bar. A 6 enters at index 18 and a 2 enters at index 22, both open, but index 16 is blocked,
    // so after either entry the other die has nowhere to go (18 - 2 = 16 and 22 - 6 = 16).
    const pos = mk({ s: { 0: 14 }, barS: 1, r: { 16: 2, 20: 13 } });
    const plays = generatePlays(pos, SOLID, [6, 2]);
    expect(plays).toHaveLength(1);
    expect(plays[0].steps).toHaveLength(1);
    expect(plays[0].steps[0].die).toBe(6);
    expect(legalSteps(pos, SOLID, [6, 2]).map((s) => s.die)).toEqual([6]);
    expect(enginePlays(pos, SOLID, [6, 2])).toEqual(oPlays(toOracle(pos, SOLID), [6, 2]));
    // With the dice the other way round the answer is the same.
    expect(generatePlays(pos, SOLID, [2, 6])[0].steps[0].die).toBe(6);
    // If the larger die cannot be entered, the smaller one is played.
    const only2 = mk({ s: { 0: 14 }, barS: 1, r: { 18: 2, 16: 2, 20: 11 } });
    const p2 = generatePlays(only2, SOLID, [6, 2]);
    expect(p2).toHaveLength(1);
    expect(p2[0].steps[0].die).toBe(2);
  });
  it('the larger die is forced when the checker could move with either die but not both', () => {
    // One checker on index 11: a 6 moves it to 5, a 2 moves it to 9, and after either move the other die is blocked by index 3.
    const pos = mk({ s: { 11: 1, 0: 14 }, r: { 3: 2, 20: 13 } });
    const plays = generatePlays(pos, SOLID, [6, 2]);
    expect(plays.every((p) => p.steps.length === 1)).toBe(true);
    expect(plays.every((p) => p.steps[0].die === 6)).toBe(true);
    expect(enginePlays(pos, SOLID, [6, 2])).toEqual(oPlays(toOracle(pos, SOLID), [6, 2]));
    expect(legalSteps(pos, SOLID, [6, 2]).every((s) => s.die === 6)).toBe(true);
  });
  it('doubles are played up to four times, and fewer when blocked', () => {
    const start = startPos();
    const plays = generatePlays(start, SOLID, diceToPlay([3, 3]));
    expect(plays.length).toBeGreaterThan(10);
    expect(plays.every((p) => p.steps.length === 4)).toBe(true);
    expect(diceToPlay([3, 3])).toEqual([3, 3, 3, 3]);
    expect(diceToPlay([6, 2])).toEqual([6, 2]);
    expect(enginePlays(start, SOLID, [3, 3, 3, 3])).toEqual(oPlays(toOracle(start, SOLID), [3, 3, 3, 3]));
  });
  it('a throw with no legal move gives no plays and no steps', () => {
    const pos = mk({ s: { 5: 14 }, barS: 1, r: { 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 3: 3 } });
    expect(generatePlays(pos, SOLID, [3, 4])).toEqual([]);
    expect(legalSteps(pos, SOLID, [3, 4])).toEqual([]);
    expect(legalSteps(pos, SOLID, [])).toEqual([]);
  });
  it('plays are distinct by result, each is a legal sequence, and none mutates the position', () => {
    const pos = startPos();
    const copy = pos.slice();
    const plays = generatePlays(pos, SOLID, [4, 2]);
    expect(new Set(plays.map((p) => keyOf(p.pos))).size).toBe(plays.length);
    expect(pos).toEqual(copy);
    for (const p of plays) {
      let cur = pos;
      for (const s of p.steps) {
        expect(stepsFor(cur, SOLID, s.die).some((x) => x.from === s.from && x.to === s.to)).toBe(true);
        cur = applyStep(cur, SOLID, s);
      }
      expect(cur).toEqual(p.pos);
      check15(cur);
    }
  });
});

describe('agreement with the second implementation', () => {
  it('every one of the 21 throws, on positions from random games: the same set of resulting positions', () => {
    let checked = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed);
      let g = newGame(seed % 2 ? SOLID : RING);
      for (let turn = 0; turn < 40 && !winnerOf(g.pos); turn++) {
        if (turn % 2 === 0) {
          for (const t of ALL_THROWS) {
            const dice = diceToPlay(t);
            expect(enginePlays(g.pos, g.toMove, dice), `seed ${seed} turn ${turn} throw ${t}`).toEqual(oPlays(toOracle(g.pos, g.toMove), dice));
            checked++;
          }
        }
        const t = rollDice(rng);
        const plays = generatePlays(g.pos, g.toMove, diceToPlay(t));
        const pos = plays.length ? plays[Math.floor(rng() * plays.length)].pos : g.pos;
        g = { pos, toMove: opponent(g.toMove) };
      }
    }
    expect(checked).toBeGreaterThan(200);
  }, 180_000);
  it('3000 random positions (bar, borne off, bear-off): same plays as the oracle for random throws', () => {
    let withPlays = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const rng = mulberry32(seed + 70000);
      const pos = validRandom(rng, seed % 3 === 0 ? 'bearoff' : 'mid');
      // points must not hold both colours: the generator can overlap, so skip those
      let clash = false;
      for (let i = 0; i < 24; i++) if (pos[i] !== 0 && ((pos[i] > 0 && ownAt(pos, RING, i) > 0) || (pos[i] < 0 && ownAt(pos, SOLID, i) > 0))) clash = true;
      if (clash) continue;
      const side: Side = seed % 2 ? SOLID : RING;
      const dice = diceToPlay(rollDice(rng));
      const mine = enginePlays(pos, side, dice);
      expect(mine, `seed ${seed}`).toEqual(oPlays(toOracle(pos, side), dice));
      if (mine.size) withPlays++;
    }
    expect(withPlays).toBeGreaterThan(1500);
  }, 180_000);
  it('the one-step-at-a-time rules the page uses reach exactly the same final positions as the whole-play generator', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = mulberry32(seed + 5);
      const kind = seed % 3 === 0 ? 'bearoff' : 'mid';
      const pos = seed % 2 ? validRandom(rng, kind) : newGame().pos;
      let clash = false;
      for (let i = 0; i < 24; i++) if (pos[i] > 0 && ownAt(pos, RING, i) > 0) clash = true;
      if (clash) continue;
      const side: Side = seed % 4 < 2 ? SOLID : RING;
      const dice = diceToPlay(rollDice(rng));
      const reached = new Set<string>();
      const walk = (p: Pos, left: number[]) => {
        const steps = legalSteps(p, side, left);
        if (!steps.length) { reached.add(keyOf(p)); return; }
        const seen = new Set<string>();
        for (const s of steps) {
          const np = applyStep(p, side, s);
          const rest = left.slice(); rest.splice(rest.indexOf(s.die), 1);
          const k = keyOf(np) + rest.join('');
          if (seen.has(k)) continue;
          seen.add(k);
          walk(np, rest);
        }
      };
      walk(pos, dice);
      const plays = new Set(generatePlays(pos, side, dice).map((p) => keyOf(p.pos)));
      if (plays.size === 0) { expect(reached).toEqual(new Set([keyOf(pos)])); continue; }
      expect(reached, `seed ${seed}`).toEqual(plays);
    }
  }, 180_000);
  it('opening throws from the start: the number of distinct plays equals the oracle for all 15 non-double and 6 double throws', () => {
    const counts: Record<string, number> = {};
    for (const t of ALL_THROWS) {
      const dice = diceToPlay(t);
      const mine = enginePlays(startPos(), SOLID, dice);
      expect(mine).toEqual(oPlays(toOracle(startPos(), SOLID), dice));
      counts[t.join('-')] = mine.size;
    }
    // The numbers of distinct resulting positions, each already equal to the second implementation's.
    expect(counts).toEqual({
      '1-1': 42, '1-2': 15, '1-3': 16, '1-4': 14, '1-5': 8, '1-6': 10, '2-2': 75, '2-3': 17, '2-4': 18, '2-5': 8, '2-6': 14, '3-3': 73,
      '3-4': 17, '3-5': 9, '3-6': 14, '4-4': 52, '4-5': 9, '4-6': 14, '5-5': 4, '5-6': 7, '6-6': 11,
    });
  });
});

describe('finishing the game', () => {
  it('the first side to bear off all 15 checkers wins, and scoring counts single, gammon and backgammon', () => {
    const single = mk({ offS: 15, s: {}, r: { 20: 14 }, offR: 1 });
    expect(winnerOf(single)).toBe(SOLID);
    expect(gamePoints(single)).toBe(1);
    const gammon = mk({ offS: 15, r: { 20: 15 } });
    expect(gamePoints(gammon)).toBe(2);
    const backgammonBar = mk({ offS: 15, r: { 20: 14 }, barR: 1 });
    expect(gamePoints(backgammonBar)).toBe(3);
    const backgammonHome = mk({ offS: 15, r: { 20: 14, 3: 1 } }); // a Ring checker in Solid's home board (indexes 0 to 5)
    expect(gamePoints(backgammonHome)).toBe(3);
    const ringWins = mk({ offR: 15, s: { 10: 15 } });
    expect(winnerOf(ringWins)).toBe(RING);
    expect(gamePoints(ringWins)).toBe(2);
    expect(gamePoints(mk({ offR: 15, s: { 20: 14 }, barS: 1 }))).toBe(3);
    expect(gamePoints(mk({ offR: 15, s: { 10: 14, 21: 1 } }))).toBe(3); // a Solid checker in Ring's home board (18 to 23)
    expect(gamePoints(startPos())).toBe(0);
    expect(winnerOf(startPos())).toBe(0);
  });
  it('plain-language scoring text', () => {
    expect(pointsText(1)).toBe('1 point');
    expect(pointsText(3)).toBe('3 points');
    expect(resultKind(1)).toBe('a single game');
    expect(resultKind(2)).toBe('a gammon');
    expect(resultKind(3)).toBe('a backgammon');
    expect(describeResult(mk({ offS: 15, r: { 20: 15 } }), null)).toBe('Solid wins a gammon (2 points).');
    expect(describeResult(mk({ offS: 15, r: { 20: 14 }, offR: 1 }), SOLID)).toBe('You win a single game (1 point).');
    expect(describeResult(mk({ offS: 15, r: { 20: 14 }, offR: 1 }), RING)).toBe('The computer wins a single game (1 point).');
    expect(describeResult(startPos(), null)).toBe('In progress.');
    expect(nameOf(SOLID)).toBe('Solid');
  });
  it('step text uses each viewer\'s own point numbers', () => {
    const s: Step = { from: 12, to: 7, die: 5, hit: true };
    expect(describeStep(s, SOLID, SOLID)).toBe('Solid moved from point 13 to point 8 and hit a checker.');
    expect(describeStep(s, SOLID, RING)).toBe('Solid moved from point 12 to point 17 and hit a checker.');
    expect(describeStep({ from: BAR, to: 20, die: 4, hit: false }, SOLID, SOLID)).toBe('Solid moved from the bar to point 21.');
    expect(describeStep({ from: 3, to: OFF, die: 4, hit: false }, SOLID, SOLID)).toBe('Solid moved from point 4 to off the board.');
  });
  it('random games always finish, conserve 15 checkers a side, never mix colours on a point, and the winner has all 15 off', () => {
    let gammons = 0;
    let games = 0;
    let mixed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed + 200);
      const open = openingRoll(rng);
      let g = { pos: startPos(), toMove: open.first };
      let dice = open.dice;
      let turns = 0;
      while (!winnerOf(g.pos) && turns < 3000) {
        const plays = generatePlays(g.pos, g.toMove, diceToPlay(dice));
        if (plays.length) g = { pos: plays[Math.floor(rng() * plays.length)].pos, toMove: g.toMove };
        if (checkersOf(g.pos, SOLID) !== CHECKERS || checkersOf(g.pos, RING) !== CHECKERS) throw new Error('checker count changed');
        for (let i = 0; i < 24; i++) if (g.pos[i] > 0 && ownAt(g.pos, RING, i) > 0) mixed++;
        g = { pos: g.pos, toMove: opponent(g.toMove) };
        dice = rollDice(rng);
        turns++;
      }
      expect(winnerOf(g.pos), `seed ${seed}`).not.toBe(0);
      const w = winnerOf(g.pos) as Side;
      expect(offOf(g.pos, w)).toBe(15);
      const pts = gamePoints(g.pos);
      expect(pts).toBeGreaterThanOrEqual(1);
      expect(pts).toBeLessThanOrEqual(3);
      games++;
      if (pts >= 2) gammons++;
    }
    expect(mixed).toBe(0);
    expect(games).toBe(40);
    expect(gammons).toBeGreaterThan(0);
  }, 240_000);
});

describe('dice', () => {
  it('a die is 1 to 6 and uniform over 60000 seeded throws', () => {
    const rng = mulberry32(8);
    const seen = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) seen[rollDie(rng)]++;
    expect(seen[0]).toBe(0);
    for (let d = 1; d <= 6; d++) expect(Math.abs(seen[d] / 60000 - 1 / 6)).toBeLessThan(0.01);
    expect(rollDie(() => 0.999999999)).toBe(6);
    expect(rollDie(() => 0)).toBe(1);
  });
  it('the 21 throws have probabilities that add up to one (6 doubles at 1/36, 15 others at 2/36)', () => {
    expect(ROLLS).toHaveLength(21);
    expect(ROLLS.reduce((a, r) => a + r.weight, 0)).toBeCloseTo(1, 12);
    expect(ROLLS.filter((r) => r.dice[0] === r.dice[1])).toHaveLength(6);
  });
  it('the opening throw is never a tie, the higher die starts and plays both numbers, and it is fair', () => {
    let solid = 0;
    const N = 20000;
    for (let k = 0; k < N; k++) {
      const o = openingRoll(mulberry32(k));
      expect(o.dice[0]).not.toBe(o.dice[1]);
      if (o.first === SOLID) solid++;
    }
    expect(Math.abs(solid / N - 0.5)).toBeLessThan(0.02);
    // with fixed dice: Solid throws 5, Ring throws 3
    const seq = [(5 - 1) / 6 + 0.01, (3 - 1) / 6 + 0.01];
    let i = 0;
    const o = openingRoll(() => seq[i++]);
    expect(o).toEqual({ first: SOLID, dice: [5, 3] });
    let j = 0;
    const tied = [0.01, 0.01, 0.5, 0.9];
    const o2 = openingRoll(() => tied[j++]);
    expect(o2.dice).toEqual([4, 6]);
    expect(o2.first).toBe(RING);
  });
});

describe('computer players', () => {
  const levels: Level[] = ['easy', 'medium', 'hard'];
  const play = (pickLevel: (side: Side) => Level, seed: number): { pos: Pos; turns: number } => {
    const rng = mulberry32(seed);
    const open = openingRoll(rng);
    let g = { pos: startPos(), toMove: open.first };
    let dice = open.dice;
    let turns = 0;
    while (!winnerOf(g.pos) && turns < 2000) {
      const p = chooseTurn(g, diceToPlay(dice), pickLevel(g.toMove), rng);
      g = { pos: p ? p.pos : g.pos, toMove: opponent(g.toMove) };
      dice = rollDice(rng);
      turns++;
    }
    return { pos: g.pos, turns };
  };

  it('returns null when nothing can be played, and the only play when there is one', () => {
    const blocked = { pos: mk({ s: { 5: 14 }, barS: 1, r: { 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 3: 3 } }), toMove: SOLID as Side };
    for (const l of levels) expect(chooseTurn(blocked, [3, 4], l, mulberry32(1))).toBeNull();
    const one = { pos: mk({ s: { 5: 14 }, barS: 1, r: { 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 3: 3 } }), toMove: SOLID as Side };
    for (const l of levels) {
      const p = chooseTurn(one, [1, 6], l, mulberry32(1));
      expect(p).not.toBeNull();
    }
  });
  it('always plays one of the legal plays at every level, over many positions', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed + 31);
      let g = newGame(seed % 2 ? SOLID : RING);
      for (let turn = 0; turn < 24 && !winnerOf(g.pos); turn++) {
        const dice = diceToPlay(rollDice(rng));
        const legal = new Set(generatePlays(g.pos, g.toMove, dice).map((p) => keyOf(p.pos)));
        for (const l of levels) {
          const p = chooseTurn(g, dice, l, mulberry32(seed * 100 + turn));
          if (!legal.size) expect(p).toBeNull();
          else expect(legal.has(keyOf(p!.pos))).toBe(true);
        }
        const plays = generatePlays(g.pos, g.toMove, dice);
        g = { pos: plays.length ? plays[Math.floor(rng() * plays.length)].pos : g.pos, toMove: opponent(g.toMove) };
      }
    }
  }, 180_000);
  it('is deterministic for a seed and Easy varies with the seed', () => {
    const g = newGame();
    for (const l of levels) expect(keyOf(chooseTurn(g, [4, 2], l, mulberry32(5))!.pos)).toBe(keyOf(chooseTurn(g, [4, 2], l, mulberry32(5))!.pos));
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) seen.add(keyOf(chooseTurn(g, [4, 2], 'easy', mulberry32(s))!.pos));
    expect(seen.size).toBeGreaterThan(5);
  });
  it('evaluation: a won game outranks everything, the race is pips, and hits and the bar matter', () => {
    const won = mk({ offS: 15, r: { 20: 15 } });
    expect(evaluate(won, SOLID)).toBeGreaterThan(WIN_VALUE);
    expect(evaluate(won, RING)).toBeLessThan(-WIN_VALUE);
    expect(evaluate(mk({ offS: 15, r: { 20: 14 }, offR: 1 }), SOLID)).toBe(WIN_VALUE + 500);
    expect(evaluate(mk({ offS: 15, r: { 20: 15 } }), SOLID)).toBe(WIN_VALUE + 1000);
    // pure race (no contact): the side with fewer pips is better by exactly the pip difference
    const race = mk({ s: { 0: 15 }, r: { 23: 15 } });
    expect(hasContact(race)).toBe(false);
    expect(evaluate(race, SOLID)).toBe(pips(race, RING) - pips(race, SOLID));
    expect(evaluate(race, SOLID) + evaluate(race, RING)).toBe(0);
    // a checker on the bar is bad
    const base = mk({ s: { 5: 15 }, r: { 18: 15 } });
    const withBar = mk({ s: { 5: 14 }, barS: 1, r: { 18: 15 } });
    expect(evaluate(withBar, SOLID)).toBeLessThan(evaluate(base, SOLID));
    // the position is symmetric: the opening position is worth zero to each side
    expect(evaluate(startPos(), SOLID)).toBeCloseTo(0, 9);
    expect(evaluate(startPos(), RING)).toBeCloseTo(0, 9);
  });
  it('Medium and Hard hit a blot when it is free and safe, and Hard prefers not to leave a blot in direct range', () => {
    // Ring has a lone checker on index 15 in Solid's way; Solid can hit it with a 4 from index 19.
    const pos = mk({ s: { 19: 1, 12: 5, 7: 3, 5: 5, 23: 1 }, r: { 15: 1, 0: 2, 11: 5, 16: 3, 18: 4 } });
    check15(pos);
    for (const l of ['medium', 'hard'] as Level[]) {
      const p = chooseTurn({ pos, toMove: SOLID }, [4, 4], l, mulberry32(3))!;
      expect(barOf(p.pos, RING)).toBeGreaterThan(0);
    }
  });
  it('Hard beats Easy in at least 9 of 10 games and Medium beats Easy in at least 9 of 10 (sides alternate)', () => {
    for (const strong of ['hard', 'medium'] as Level[]) {
      let wins = 0;
      for (let k = 0; k < 10; k++) {
        const strongSide: Side = k % 2 === 0 ? SOLID : RING;
        const r = play((s) => (s === strongSide ? strong : 'easy'), 900 + k);
        if (winnerOf(r.pos) === strongSide) wins++;
      }
      expect(wins, strong).toBeGreaterThanOrEqual(9);
    }
  }, 600_000);
  it('Hard wins at least half of 30 games against Medium (sides alternate); the game is mostly luck, so no more is claimed', () => {
    let wins = 0;
    for (let k = 0; k < 30; k++) {
      const side: Side = k % 2 === 0 ? SOLID : RING;
      const r = play((s) => (s === side ? 'hard' : 'medium'), 5000 + k);
      if (winnerOf(r.pos) === side) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(15);
  }, 600_000);
  it('is bounded: Hard looks at no more than a fixed number of positions per turn and takes well under 6 s', () => {
    expect(HARD_CANDIDATES).toBe(7);
    expect(HARD_EVALS).toBe(30000);
    let worstMs = 0; let worstEvals = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const rng = mulberry32(seed + 3000);
      let g = newGame();
      for (let turn = 0; turn < 30 && !winnerOf(g.pos); turn++) {
        const dice = diceToPlay(rollDice(rng));
        const stats: Stats = { evals: 0 };
        const t = performance.now();
        const p = chooseTurn(g, dice, 'hard', rng, stats);
        worstMs = Math.max(worstMs, performance.now() - t);
        worstEvals = Math.max(worstEvals, stats.evals);
        g = { pos: p ? p.pos : g.pos, toMove: opponent(g.toMove) };
      }
    }
    expect(worstEvals).toBeLessThan(HARD_EVALS + 3000);
    expect(worstMs).toBeLessThan(6000);
  }, 300_000);
  it('Undo goes back to the start of the person\'s last turn, or the last turn with two people', () => {
    expect(undoIndex([], SOLID)).toBe(-1);
    expect(undoIndex([RING], SOLID)).toBe(-1);
    expect(undoIndex([SOLID, RING, SOLID, RING], SOLID)).toBe(2);
    expect(undoIndex([SOLID, RING], null)).toBe(1);
    expect(undoIndex([], null)).toBe(-1);
    expect(isHome(SOLID, 5) && !isHome(SOLID, 6) && isHome(RING, 18) && !isHome(RING, 17)).toBe(true);
  });
});
