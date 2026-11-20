/**
 * games-royal-game-of-ur.test.ts - the engine behind `royal-game-of-ur`.
 *
 * Pinned: the four two-sided dice (1, 4, 6, 4, 1 chances out of 16, by enumeration and by a seeded
 * sample), the geometry of the 3 x 8 board and the two 14-square paths (private squares, 8 shared
 * squares, five rosettes), every movement rule (own pieces block, exact throw to leave, capture on
 * shared squares only, the centre rosette is safe, rosettes give another throw), and a win by seven
 * pieces home. A second implementation that works on physical board squares (written coordinate lists,
 * a row-based idea of "shared") is run in lockstep with the engine on thousands of random games.
 * The expectimax computer is checked on forced wins, probabilities, node counts and strength.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalFrom, applyMove, passTurn, rollDice, trackSquare, posAt, squareName, piecesOf, countHome, countWaiting, expectimax, evaluate,
  chooseMove, mulberry32, opponent, nameOf, isShared, isRosette, describeThrow, describeMove, describeResult, piecesText, undoIndex,
  SOLID, RING, PIECES, LAST, HOME, CENTRE, ROSETTES, ROLL_ODDS, HARD_DEPTH, MEDIUM_DEPTH, EXPECTIMAX_WIN,
  type Game, type Side, type Level, type Stats,
} from '../src/components/apps-private/royal-game-of-ur/helpers';

// ── Independent oracle on physical squares ──
const PATH: Record<'S' | 'R', [number, number][]> = {
  S: [[2, 3], [2, 2], [2, 1], [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [2, 7], [2, 6]],
  R: [[0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [0, 7], [0, 6]],
};
const ROSETTE_SQUARES = new Set(['0,0', '2,0', '1,3', '0,6', '2,6']);
interface OG { board: Map<string, 'S' | 'R'>; wait: Record<'S' | 'R', number>; home: Record<'S' | 'R', number>; turn: 'S' | 'R' }
const oFrom = (g: Game): OG => {
  const board = new Map<string, 'S' | 'R'>();
  const wait = { S: 0, R: 0 };
  const home = { S: 0, R: 0 };
  for (const [side, key, arr] of [[SOLID, 'S', g.solid], [RING, 'R', g.ring]] as const) {
    void side;
    for (const p of arr) {
      if (p === 0) wait[key]++;
      else if (p === 15) home[key]++;
      else board.set(PATH[key][p - 1].join(','), key);
    }
  }
  return { board, wait, home, turn: g.toMove === SOLID ? 'S' : 'R' };
};
interface OMove { from: string; to: string; capture: boolean; extra: boolean }
const oMoves = (o: OG, roll: number): OMove[] => {
  if (roll < 1) return [];
  const me = o.turn;
  const foe = me === 'S' ? 'R' : 'S';
  const out: OMove[] = [];
  const starts: { idx: number; key: string }[] = [];
  if (o.wait[me] > 0) starts.push({ idx: 0, key: 'start' });
  PATH[me].forEach((sq, i) => { if (o.board.get(sq.join(',')) === me) starts.push({ idx: i + 1, key: sq.join(',') }); });
  for (const s of starts) {
    const t = s.idx + roll;
    if (t > 15) continue;
    if (t === 15) { out.push({ from: s.key, to: 'off', capture: false, extra: false }); continue; }
    const sq = PATH[me][t - 1].join(',');
    const occ = o.board.get(sq);
    if (occ === me) continue;
    if (occ === foe && sq === '1,3') continue;
    out.push({ from: s.key, to: sq, capture: occ === foe, extra: ROSETTE_SQUARES.has(sq) });
  }
  return out;
};
const oApply = (o: OG, m: OMove): OG => {
  const me = o.turn;
  const foe = me === 'S' ? 'R' : 'S';
  const board = new Map(o.board);
  const wait = { ...o.wait };
  const home = { ...o.home };
  if (m.from === 'start') wait[me]--; else board.delete(m.from);
  if (m.to === 'off') home[me]++;
  else {
    if (board.get(m.to) === foe) wait[foe]++;
    board.set(m.to, me);
  }
  const won = home[me] === 7;
  return { board, wait, home, turn: m.extra && !won ? me : foe };
};
const engineMove = (g: Game, from: number, roll: number): OMove => {
  const side = g.toMove === SOLID ? 'S' : 'R';
  const key = from === 0 ? 'start' : PATH[side][from - 1].join(',');
  const t = from + roll;
  return { from: key, to: t === 15 ? 'off' : PATH[side][t - 1].join(','), capture: false, extra: false };
};
const same = (g: Game, o: OG, label: string) => {
  const e = oFrom(g);
  expect([...e.board.entries()].sort(), label).toEqual([...o.board.entries()].sort());
  expect(e.wait, label).toEqual(o.wait);
  expect(e.home, label).toEqual(o.home);
  expect(e.turn, label).toBe(o.turn);
};

describe('the dice', () => {
  it('chances out of 16 for 0 to 4 marked dice are 1, 4, 6, 4, 1 (by listing all 16 outcomes)', () => {
    expect(ROLL_ODDS).toEqual([1, 4, 6, 4, 1]);
    expect(ROLL_ODDS.reduce((a, b) => a + b, 0)).toBe(16);
    const counts = [0, 0, 0, 0, 0];
    for (let mask = 0; mask < 16; mask++) counts[[0, 1, 2, 3].filter((b) => mask & (1 << b)).length]++;
    expect(counts).toEqual([1, 4, 6, 4, 1]);
  });
  it('a throw is the number of dice that come up marked, each with probability one half', () => {
    expect(rollDice(() => 0.1)).toBe(4);
    expect(rollDice(() => 0.9)).toBe(0);
    const seq = [0.1, 0.9, 0.2, 0.7];
    let i = 0;
    expect(rollDice(() => seq[i++])).toBe(2);
    const rng = mulberry32(4);
    const seen = [0, 0, 0, 0, 0];
    const N = 32000;
    for (let k = 0; k < N; k++) seen[rollDice(rng)]++;
    ROLL_ODDS.forEach((w, n) => expect(Math.abs(seen[n] / N - w / 16)).toBeLessThan(0.01));
    expect(seen.every((x, n) => x > 0 || n < 0)).toBe(true);
  });
});

describe('the board', () => {
  it('each side has a path of 14 distinct squares: 4 private, 8 shared, 2 private', () => {
    for (const side of [SOLID, RING] as Side[]) {
      const sq = Array.from({ length: LAST }, (_, i) => trackSquare(side, i + 1)!);
      expect(new Set(sq.map((s) => s.join(','))).size).toBe(14);
      expect(sq.slice(4, 12).every((s) => s[0] === 1)).toBe(true); // the middle row
      expect([...sq.slice(0, 4), ...sq.slice(12)].every((s) => s[0] === (side === SOLID ? 2 : 0))).toBe(true);
    }
    const s = (side: Side) => Array.from({ length: LAST }, (_, i) => trackSquare(side, i + 1)!.join(','));
    // the shared squares are the same squares for both sides; the private ones never overlap
    expect(s(SOLID).slice(4, 12)).toEqual(s(RING).slice(4, 12));
    const priv = new Set([...s(SOLID).slice(0, 4), ...s(SOLID).slice(12)]);
    for (const x of [...s(RING).slice(0, 4), ...s(RING).slice(12)]) expect(priv.has(x)).toBe(false);
  });
  it('matches the hand-written coordinate lists of the second implementation', () => {
    for (let p = 1; p <= LAST; p++) {
      expect(trackSquare(SOLID, p)).toEqual(PATH.S[p - 1]);
      expect(trackSquare(RING, p)).toEqual(PATH.R[p - 1]);
      expect(posAt(SOLID, ...PATH.S[p - 1])).toBe(p);
      expect(posAt(RING, ...PATH.R[p - 1])).toBe(p);
    }
    expect(trackSquare(SOLID, 0)).toBeNull();
    expect(trackSquare(SOLID, 15)).toBeNull();
    expect(trackSquare(SOLID, 1.5)).toBeNull();
    expect(posAt(SOLID, 0, 0)).toBe(0);
  });
  it('has five rosettes: the 4th and 14th square of each path and the shared centre (the 8th)', () => {
    expect(ROSETTES).toEqual([4, 8, 14]);
    const sq = new Set<string>();
    for (const side of [SOLID, RING] as Side[]) for (const p of ROSETTES) sq.add(trackSquare(side, p)!.join(','));
    expect([...sq].sort()).toEqual([...ROSETTE_SQUARES].sort());
    expect(CENTRE).toBe(8);
    expect(isRosette(8) && isRosette(4) && isRosette(14) && !isRosette(5)).toBe(true);
    expect(isShared(5) && isShared(12) && !isShared(4) && !isShared(13)).toBe(true);
  });
  it('names squares for screen readers', () => {
    expect(squareName(SOLID, 0)).toBe('the waiting area');
    expect(squareName(SOLID, HOME)).toBe('home');
    expect(squareName(SOLID, 1)).toBe('row 3, column 4');
    expect(squareName(RING, 1)).toBe('row 1, column 4');
    expect(squareName(RING, CENTRE)).toBe('row 2, column 4');
  });
});

describe('movement rules', () => {
  const at = (solid: number[], ring: number[], toMove: Side = SOLID): Game => ({
    solid: [...solid, ...new Array(PIECES - solid.length).fill(0)].sort((a, b) => a - b),
    ring: [...ring, ...new Array(PIECES - ring.length).fill(0)].sort((a, b) => a - b),
    toMove, over: false, winner: 0,
  });
  it('starts with seven waiting pieces each and nothing home', () => {
    const g = newGame();
    expect(g.solid).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(g.ring).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(g.toMove).toBe(SOLID);
    expect(newGame(RING).toMove).toBe(RING);
    expect(countWaiting(g.solid)).toBe(7);
    expect(countHome(g.solid)).toBe(0);
  });
  it('a throw of 0 or an out-of-range throw gives no move', () => {
    const g = newGame();
    for (const r of [0, -1, 5, 1.5, NaN]) expect(legalFrom(g, r)).toEqual([]);
    expect(applyMove(g, 0, 0)).toBeNull();
    expect(applyMove(g, 5, 0)).toBeNull();
  });
  it('waiting pieces enter on the square matching the throw; seven waiting pieces count as one choice', () => {
    for (let r = 1; r <= 4; r++) {
      const g = newGame();
      expect(legalFrom(g, r)).toEqual([0]);
      const m = applyMove(g, r, 0)!;
      expect(m.to).toBe(r);
      expect(m.game.solid).toEqual([0, 0, 0, 0, 0, 0, r]);
      expect(m.game.toMove).toBe(r === 4 ? SOLID : RING);
    }
  });
  it('a piece cannot land on one of its own pieces', () => {
    const g = at([2, 4], []); // pieces on 2 and 4, five waiting
    expect(legalFrom(g, 2)).toEqual([4]); // 0 -> 2 and 2 -> 4 are blocked by own pieces, 4 -> 6 is free
    expect(legalFrom(g, 1)).toEqual([0, 2, 4]);
    const k = at([1, 3], []);
    expect(legalFrom(k, 2)).toEqual([0, 3]); // 1 -> 3 is blocked
  });
  it('rosettes on 4, 8 and 14 give another throw', () => {
    expect(applyMove(newGame(), 4, 0)!.extra).toBe(true);
    expect(applyMove(at([5], []), 3, 5)!.extra).toBe(true); // 5 + 3 = 8
    expect(applyMove(at([12], []), 2, 12)!.extra).toBe(true); // 12 + 2 = 14
    expect(applyMove(newGame(), 3, 0)!.extra).toBe(false);
    expect(applyMove(at([13], []), 2, 13)!.extra).toBe(false); // 13 + 2 = 15 is home, not a rosette
    expect(applyMove(at([13], []), 2, 13)!.game.toMove).toBe(RING);
    const extra = applyMove(newGame(), 4, 0)!;
    expect(extra.game.toMove).toBe(SOLID);
  });
  it('a piece leaves the board only on an exact throw', () => {
    const g = at([14, 13], []);
    expect(legalFrom(g, 1)).toContain(14);
    expect(legalFrom(g, 2)).toContain(13);
    expect(legalFrom(at([14], []), 2)).not.toContain(14); // would overshoot
    expect(legalFrom(at([13], []), 3)).not.toContain(13);
    expect(legalFrom(at([13], []), 4)).not.toContain(13);
    const m = applyMove(at([14], []), 1, 14)!;
    expect(m.home).toBe(true);
    expect(m.to).toBe(HOME);
    expect(m.game.solid.filter((x) => x === HOME)).toHaveLength(1);
    expect(m.extra).toBe(false);
  });
  it('captures a lone enemy piece on a shared square and sends it back to the start', () => {
    const g = at([6], [7, 0], SOLID);
    const m = applyMove(g, 1, 6)!;
    expect(m.captured).toBe(true);
    expect(m.game.ring).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(m.game.solid).toContain(7);
  });
  it('the centre rosette is safe: it cannot be captured and cannot be entered while an enemy stands there', () => {
    const g = at([5], [CENTRE], SOLID);
    expect(legalFrom(g, 3)).not.toContain(5); // 5 + 3 = 8 is occupied by the enemy on the safe square
    expect(legalFrom(g, 3)).toEqual([0]); // only a waiting piece can move (0 -> 3)
    const free = at([5], [], SOLID);
    expect(legalFrom(free, 3)).toContain(5);
    // another shared square is not safe
    expect(applyMove(at([5], [7], SOLID), 2, 5)!.captured).toBe(true);
  });
  it('private squares are never contested: the same path position on the other side is a different square', () => {
    // Ring piece on its own square 3 does not stop Solid entering square 3 of Solid's own lane.
    const g = at([], [3], SOLID);
    expect(applyMove(g, 3, 0)!.captured).toBe(false);
  });
  it('a side with no legal move passes', () => {
    const g = at([14], []);
    expect(legalFrom({ ...g, solid: [14, 14, 14, 14, 14, 14, 14] }, 3)).toEqual([]);
    const p = passTurn(g);
    expect(p.toMove).toBe(RING);
    expect(p.solid).toEqual(g.solid);
    expect(p.solid).not.toBe(g.solid);
  });
  it('seven pieces home wins and ends the game with no extra throw', () => {
    const g = at([HOME, HOME, HOME, HOME, HOME, HOME, 14], []);
    const m = applyMove(g, 1, 14)!;
    expect(m.game.over).toBe(true);
    expect(m.game.winner).toBe(SOLID);
    expect(m.extra).toBe(false);
    expect(legalFrom(m.game, 1)).toEqual([]);
    expect(applyMove(m.game, 1, 0)).toBeNull();
  });
  it('never mutates the position it is given', () => {
    const g = at([4, 6, 8], [5, 7]);
    const copy = JSON.stringify(g);
    for (let r = 1; r <= 4; r++) for (const f of legalFrom(g, r)) applyMove(g, r, f);
    passTurn(g);
    expect(JSON.stringify(g)).toBe(copy);
  });
  it('plain-language helpers', () => {
    expect(describeThrow(0)).toBe('Threw 0: no move.');
    expect(describeThrow(3)).toBe('Threw 3.');
    expect(piecesText(1)).toBe('1 piece');
    expect(piecesText(2)).toBe('2 pieces');
    expect(nameOf(SOLID)).toBe('Solid');
    expect(opponent(RING)).toBe(SOLID);
    const m = applyMove(newGame(), 4, 0)!;
    expect(describeMove(SOLID, 0, m)).toBe('Solid entered a piece at row 3, column 1. Rosette: Solid throws again.');
    const c = applyMove(at([6], [7]), 1, 6)!;
    expect(describeMove(SOLID, 6, c)).toBe('Solid moved a piece to row 2, column 3. It sent an enemy piece back to the start.');
    const w = applyMove(at([HOME, HOME, HOME, HOME, HOME, HOME, 14], []), 1, 14)!;
    expect(describeMove(SOLID, 14, w)).toBe('Solid moved a piece and took it home.');
    expect(describeResult(w.game, null)).toBe('Solid wins, with all 7 pieces home.');
    expect(describeResult(w.game, SOLID)).toBe('You win, with all 7 pieces home.');
    expect(describeResult(w.game, RING)).toBe('The computer wins, with all 7 pieces home.');
    expect(describeResult(newGame(), null)).toBe('In progress.');
    expect(undoIndex([], SOLID)).toBe(-1);
    expect(undoIndex([SOLID, RING, SOLID], SOLID)).toBe(2);
    expect(undoIndex([SOLID, RING], null)).toBe(1);
  });
});

describe('agreement with the second implementation (physical squares)', () => {
  it('600 random games: the same legal moves for every throw, and the same board, turn and result after every move', () => {
    let plies = 0; let captures = 0; let extras = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const rng = mulberry32(seed);
      let g = newGame(seed % 2 ? SOLID : RING);
      let o = oFrom(g);
      for (let step = 0; step < 4000 && !g.over; step++) {
        // Every throw 1 to 4 must give identical move sets.
        for (let r = 1; r <= 4; r++) {
          const mine = legalFrom(g, r).map((f) => engineMove(g, f, r)).map((m) => `${m.from}>${m.to}`).sort();
          const theirs = oMoves(o, r).map((m) => `${m.from}>${m.to}`).sort();
          expect(mine, `seed ${seed} step ${step} roll ${r}`).toEqual(theirs);
        }
        const r = rollDice(rng);
        const from = legalFrom(g, r);
        if (!from.length) { g = passTurn(g); o = { ...o, turn: o.turn === 'S' ? 'R' : 'S' }; plies++; continue; }
        const f = from[Math.floor(rng() * from.length)];
        const em = engineMove(g, f, r);
        const om = oMoves(o, r).find((m) => m.from === em.from && m.to === em.to)!;
        const res = applyMove(g, r, f)!;
        expect(res.captured).toBe(om.capture);
        expect(res.extra).toBe(om.extra && !res.game.over);
        g = res.game;
        o = oApply(o, om);
        if (res.captured) captures++;
        if (res.extra) extras++;
        plies++;
        same(g, o, `seed ${seed} step ${step}`);
      }
      expect(g.over, `seed ${seed} did not finish`).toBe(true);
      expect(g.winner === 0 ? 0 : countHome(piecesOf(g, g.winner))).toBe(7);
    }
    expect(captures).toBeGreaterThan(500);
    expect(extras).toBeGreaterThan(500);
    expect(plies).toBeGreaterThan(20000);
  }, 300_000);
});

describe('invariants over random play', () => {
  it('seven pieces a side, sorted, no two own pieces on one square, no two pieces on one shared square', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed + 9000);
      let g = newGame();
      for (let step = 0; step < 3000 && !g.over; step++) {
        const r = rollDice(rng);
        const from = legalFrom(g, r);
        if (!from.length) { g = passTurn(g); continue; }
        g = applyMove(g, r, from[Math.floor(rng() * from.length)])!.game;
        for (const arr of [g.solid, g.ring]) {
          expect(arr).toHaveLength(PIECES);
          expect([...arr].sort((a, b) => a - b)).toEqual(arr);
          const board = arr.filter((x) => x > 0 && x < HOME);
          expect(new Set(board).size).toBe(board.length);
        }
        const sh = [...g.solid, ...g.ring].filter((x) => x >= 5 && x <= 12);
        const sq = [...g.solid.filter((x) => x >= 5 && x <= 12), ...g.ring.filter((x) => x >= 5 && x <= 12)];
        expect(new Set(sq).size).toBe(sh.length);
      }
      expect(g.over).toBe(true);
    }
  }, 120_000);
});

describe('computer players', () => {
  const at = (solid: number[], ring: number[], toMove: Side = SOLID): Game => ({
    solid: [...solid, ...new Array(PIECES - solid.length).fill(0)].sort((a, b) => a - b),
    ring: [...ring, ...new Array(PIECES - ring.length).fill(0)].sort((a, b) => a - b),
    toMove, over: false, winner: 0,
  });
  const levels: Level[] = ['easy', 'medium', 'hard'];

  it('the throw odds sum to one inside expectimax and a won or lost position is worth the win score', () => {
    const won: Game = { ...at([HOME, HOME, HOME, HOME, HOME, HOME, HOME], []), over: true, winner: SOLID };
    expect(evaluate(won, SOLID)).toBe(EXPECTIMAX_WIN);
    expect(evaluate(won, RING)).toBe(-EXPECTIMAX_WIN);
    expect(expectimax(won, 3, SOLID)).toBe(EXPECTIMAX_WIN);
    // At depth 0 the value is the heuristic; deeper values are averages, so a position where everything wins stays at the win score.
    const g = at([HOME, HOME, HOME, HOME, HOME, HOME, 14], []);
    expect(expectimax(g, 0, SOLID)).toBe(evaluate(g, SOLID));
  });
  it('returns -1 when nothing can move, the only move when there is one', () => {
    for (const l of levels) expect(chooseMove(newGame(), 0, l, mulberry32(1))).toBe(-1);
    for (const l of levels) expect(chooseMove(newGame(), 2, l, mulberry32(1))).toBe(0);
  });
  it('always plays a legal move at every level', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed + 77);
      let g = newGame();
      for (let step = 0; step < 60 && !g.over; step++) {
        const r = rollDice(rng);
        const legal = legalFrom(g, r);
        if (!legal.length) { g = passTurn(g); continue; }
        for (const l of levels) expect(legal).toContain(chooseMove(g, r, l, mulberry32(seed + step), undefined));
        g = applyMove(g, r, legal[Math.floor(rng() * legal.length)])!.game;
      }
    }
  }, 120_000);
  it('captures a piece that is about to escape when that is the better move', () => {
    // Ring has a piece on 11 about to run home; Solid can capture it with a 1 from 10 (or move a rear piece).
    const g = at([10, 2], [11, HOME, HOME, HOME, HOME, HOME, HOME], SOLID);
    for (const l of ['medium', 'hard'] as Level[]) expect(chooseMove(g, 1, l, mulberry32(9))).toBe(10);
  });
  it('depth values: Medium looks one move ahead and Hard two', () => {
    expect(MEDIUM_DEPTH).toBe(1);
    expect(HARD_DEPTH).toBe(2);
  });
  it('is deterministic for a seed and Easy varies with the seed', () => {
    const g = at([2, 6], [5, 9], SOLID);
    for (const l of levels) expect(chooseMove(g, 2, l, mulberry32(5))).toBe(chooseMove(g, 2, l, mulberry32(5)));
    const seen = new Set<number>();
    for (let s = 1; s <= 40; s++) seen.add(chooseMove(at([2, 6, 9], [], SOLID), 1, 'easy', mulberry32(s)));
    expect(seen.size).toBeGreaterThan(1);
  });
  it('searches a bounded number of positions: under 40 thousand per Hard move, and each move well inside 3 s', () => {
    let worst = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed + 1234);
      let g = newGame();
      for (let step = 0; step < 150 && !g.over; step++) {
        const r = rollDice(rng);
        const legal = legalFrom(g, r);
        if (!legal.length) { g = passTurn(g); continue; }
        const stats: Stats = { nodes: 0 };
        const t = performance.now();
        const m = chooseMove(g, r, 'hard', rng, stats);
        expect(performance.now() - t).toBeLessThan(3000);
        worst = Math.max(worst, stats.nodes);
        g = applyMove(g, r, m)!.game;
      }
    }
    expect(worst).toBeLessThan(40000);
  }, 120_000);

  const duel = (a: Level, b: Level, games: number, seedBase: number): number => {
    let aWins = 0;
    for (let k = 0; k < games; k++) {
      const rng = mulberry32(seedBase + k);
      const aSide: Side = k % 2 === 0 ? SOLID : RING;
      let g = newGame();
      for (let step = 0; step < 5000 && !g.over; step++) {
        const r = rollDice(rng);
        const legal = legalFrom(g, r);
        if (!legal.length) { g = passTurn(g); continue; }
        const m = chooseMove(g, r, g.toMove === aSide ? a : b, rng);
        g = applyMove(g, r, m)!.game;
      }
      expect(g.over).toBe(true);
      if (g.winner === aSide) aWins++;
    }
    return aWins;
  };
  it('Hard and Medium each beat Easy in at least 90% of 60 games, and Hard beats Medium in more than half of 100 (sides alternate)', () => {
    expect(duel('hard', 'easy', 60, 100)).toBeGreaterThanOrEqual(54);
    expect(duel('medium', 'easy', 60, 300)).toBeGreaterThanOrEqual(54);
    expect(duel('hard', 'medium', 100, 500)).toBeGreaterThanOrEqual(52);
  }, 240_000);
});
