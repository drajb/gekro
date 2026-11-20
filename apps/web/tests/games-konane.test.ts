/**
 * games-konane.test.ts - the engine behind `konane`.
 *
 * Pinned: the checker-pattern start (18 and 32 stones a side), the opening (Solid takes a corner
 * or middle stone, Ring takes a neighbour of the gap), single and multi-hop jumps in a straight
 * line only, no turning, no jumping own stones or two stones at once, loss for the side with no
 * jump. Move generation is compared with a second, coordinate-based implementation on thousands
 * of positions from random play. Alpha-beta is compared with plain minimax, a complete solve of
 * the 4 x 4 board, and exhaustive search of end positions on 6 x 6. The computer levels are legal,
 * seeded, bounded by their node counts, and ordered by strength.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, applyMove, playLegal, outcome, openingCells, jumpsFrom, countMoves, countStones, chooseMove, searchMove,
  negamax, evaluate, mulberry32, shuffled, opponent, nameOf, cellName, validSize, undoCount, describeOutcome, describeMove,
  stonesText, movesText, startColour, thinkingMessage,
  SOLID, RING, SIZES, WIN_SCORE, MEDIUM_DEPTH, MEDIUM_NODES, HARD_NODES, HARD_MAX_DEPTH,
  type Game, type Move, type Side, type Level, type Budget,
} from '../src/components/apps-private/konane/helpers';

// ── Independent oracle: a grid of characters, coordinates, recursion per direction ──
type Cell = 'S' | 'R' | '.';
interface OGame { n: number; g: Cell[][]; turn: 'S' | 'R'; phase: 0 | 1 | 2 }
const toO = (g: Game): OGame => ({
  n: g.size,
  g: Array.from({ length: g.size }, (_, r) => Array.from({ length: g.size }, (_, c): Cell => (g.board[r * g.size + c] === 1 ? 'S' : g.board[r * g.size + c] === 2 ? 'R' : '.'))),
  turn: g.toMove === SOLID ? 'S' : 'R',
  phase: g.phase,
});
const oStart = (n: number): OGame => ({
  n,
  g: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c): Cell => ((r + c) % 2 === 0 ? 'S' : 'R'))),
  turn: 'S',
  phase: 0,
});
interface OMove { from: [number, number] | null; to: [number, number]; taken: [number, number][] }
const oMoves = (o: OGame): OMove[] => {
  const n = o.n;
  const out: OMove[] = [];
  if (o.phase === 0) {
    const h = n / 2;
    const cand: [number, number][] = [[0, 0], [n - 1, n - 1], [h - 1, h - 1], [h, h]];
    const seen = new Set<string>();
    for (const [r, c] of cand) if (!seen.has(`${r},${c}`)) { seen.add(`${r},${c}`); out.push({ from: null, to: [r, c], taken: [[r, c]] }); }
    return out;
  }
  if (o.phase === 1) {
    let gr = -1;
    let gc = -1;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (o.g[r][c] === '.') { gr = r; gc = c; }
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = gr + dr;
      const c = gc + dc;
      if (r >= 0 && r < n && c >= 0 && c < n && o.g[r][c] === 'R') out.push({ from: null, to: [r, c], taken: [[r, c]] });
    }
    return out;
  }
  const me = o.turn;
  const foe = me === 'S' ? 'R' : 'S';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (o.g[r][c] !== me) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const go = (cr: number, cc: number, taken: [number, number][]) => {
        const mr = cr + dr; const mc = cc + dc; const lr = cr + 2 * dr; const lc = cc + 2 * dc;
        if (lr < 0 || lr >= n || lc < 0 || lc >= n) return;
        if (o.g[mr][mc] !== foe || o.g[lr][lc] !== '.') return;
        const t: [number, number][] = [...taken, [mr, mc]];
        out.push({ from: [r, c], to: [lr, lc], taken: t });
        go(lr, lc, t);
      };
      go(r, c, []);
    }
  }
  return out;
};
const oPlay = (o: OGame, m: OMove): OGame => {
  const g = o.g.map((row) => row.slice());
  if (m.from === null) {
    g[m.to[0]][m.to[1]] = '.';
    return { n: o.n, g, turn: o.turn === 'S' ? 'R' : 'S', phase: o.phase === 0 ? 1 : 2 };
  }
  g[m.to[0]][m.to[1]] = g[m.from[0]][m.from[1]];
  g[m.from[0]][m.from[1]] = '.';
  for (const [r, c] of m.taken) g[r][c] = '.';
  return { n: o.n, g, turn: o.turn === 'S' ? 'R' : 'S', phase: 2 };
};
/** Exhaustive result for the side to move: +1 wins, -1 loses (no draws exist). */
const oSolve = (o: OGame, memo = new Map<string, number>()): number => {
  const key = o.phase + o.turn + o.g.map((r) => r.join('')).join('/');
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const ms = oMoves(o);
  let v: number;
  if (o.phase === 2 && ms.length === 0) v = -1;
  else {
    v = -1;
    for (const m of ms) if (-oSolve(oPlay(o, m), memo) === 1) { v = 1; break; }
  }
  memo.set(key, v);
  return v;
};
const key = (m: { from: number; to: number; captured: number[] }): string => `${m.from}>${m.to}:${m.captured.slice().sort((a, b) => a - b).join(',')}`;
const oKey = (m: OMove, n: number): string => `${m.from ? m.from[0] * n + m.from[1] : -1}>${m.to[0] * n + m.to[1]}:${m.taken.map(([r, c]) => r * n + c).sort((a, b) => a - b).join(',')}`;

const randomGame = (size: number, seed: number, plies = 1000): { positions: Game[]; last: Game } => {
  const rng = mulberry32(seed);
  let g = newGame(size);
  const positions: Game[] = [g];
  for (let i = 0; i < plies; i++) {
    const ms = legalMoves(g);
    if (!ms.length) break;
    g = playLegal(g, ms[Math.floor(rng() * ms.length)]);
    positions.push(g);
  }
  return { positions, last: g };
};

describe('setup and opening', () => {
  it('6 x 6 and 8 x 8 start with a checker pattern and equal stones', () => {
    expect(SIZES).toEqual([6, 8]);
    for (const n of [6, 8]) {
      const g = newGame(n);
      expect(countStones(g.board)).toEqual({ solid: n * n / 2, ring: n * n / 2 });
      expect(g.board[0]).toBe(SOLID);
      expect(g.board[1]).toBe(RING);
      expect(g.board[n]).toBe(RING);
      expect(g.board[n + 1]).toBe(SOLID);
      expect(g.toMove).toBe(SOLID);
      expect(g.phase).toBe(0);
      expect(startColour(0, 0)).toBe(SOLID);
    }
    expect(countStones(newGame(6).board)).toEqual({ solid: 18, ring: 18 });
    expect(countStones(newGame(8).board)).toEqual({ solid: 32, ring: 32 });
  });
  it('Solid may take a corner or middle stone it owns: 4 choices, all Solid stones', () => {
    expect(openingCells(6)).toEqual([0, 14, 21, 35]);
    expect(openingCells(8)).toEqual([0, 27, 36, 63]);
    for (const n of [4, 6, 8]) {
      const ms = legalMoves(newGame(n));
      expect(ms).toHaveLength(4);
      expect(ms.every((m) => m.kind === 'remove' && newGame(n).board[m.to] === SOLID)).toBe(true);
    }
  });
  it('Ring then takes a Ring stone next to the gap: 2 choices at a corner, 4 at the middle', () => {
    const corner = playLegal(newGame(6), legalMoves(newGame(6))[0]);
    expect(corner.phase).toBe(1);
    expect(corner.toMove).toBe(RING);
    expect(legalMoves(corner).map((m) => m.to)).toEqual([1, 6]);
    const mid = applyMove(newGame(6), { kind: 'remove', from: -1, to: 14, captured: [14] })!;
    expect(legalMoves(mid).map((m) => m.to)).toEqual([8, 13, 15, 20]);
    const opened = applyMove(mid, legalMoves(mid)[0])!;
    expect(opened.phase).toBe(2);
    expect(opened.toMove).toBe(SOLID);
    expect(countStones(opened.board)).toEqual({ solid: 17, ring: 17 });
  });
  it('rejects an opening that is not allowed and unsupported sizes', () => {
    const g = newGame(6);
    expect(applyMove(g, { kind: 'remove', from: -1, to: 1, captured: [1] })).toBeNull(); // a Ring stone
    expect(applyMove(g, { kind: 'remove', from: -1, to: 2, captured: [2] })).toBeNull(); // not a corner or middle
    expect(applyMove(g, { kind: 'jump', from: 0, to: 2, captured: [1] })).toBeNull();
    for (const bad of [0, 3, 5, 7, 10, -6, NaN, 6.5]) expect(() => newGame(bad)).toThrow(RangeError);
    expect(validSize(6)).toBe(true);
    expect(validSize('6' as unknown as number)).toBe(false);
    expect(validSize(2)).toBe(false);
  });
});

describe('jumping', () => {
  const play = (rows: string[], turn: Side = SOLID): Game => {
    const n = rows.length;
    const board = new Int8Array(n * n);
    rows.forEach((row, r) => [...row].forEach((ch, c) => { board[r * n + c] = ch === 'S' ? SOLID : ch === 'R' ? RING : 0; }));
    return { size: n, board, toMove: turn, phase: 2 };
  };
  it('jumps one enemy stone into the empty square beyond', () => {
    const g = play(['......', '......', '..SR..', '......', '......', '......']);
    const ms = legalMoves(g);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ kind: 'jump', from: 14, to: 16, captured: [15] });
    const after = applyMove(g, ms[0])!;
    expect(after.board[14]).toBe(0);
    expect(after.board[15]).toBe(0);
    expect(after.board[16]).toBe(SOLID);
    expect(after.toMove).toBe(RING);
  });
  it('may hop several times in one line, and offers every stopping point', () => {
    const g = play(['......', '......', 'SR.R.R', '......', '......', '......']);
    const ms = legalMoves(g).filter((m) => m.from === 12);
    expect(ms.map((m) => [m.to, m.captured.length])).toEqual([[14, 1], [16, 2]]);
    const done = applyMove(g, ms[1])!;
    expect(countStones(done.board)).toEqual({ solid: 1, ring: 1 });
  });
  it('cannot turn a corner in the middle of a move', () => {
    const g = play(['......', '..R...', '.SR...', '......', '......', '......']);
    // S at (2,1) jumps east over (2,2) to (2,3); the Ring stone at (1,2) is above (2,2) but the mover may not turn.
    const ms = legalMoves(g);
    expect(ms.map((m) => m.to)).toEqual([15]);
    expect(ms.every((m) => m.captured.length === 1)).toBe(true);
  });
  it('cannot jump its own stone, two stones at once, or into an occupied square', () => {
    expect(legalMoves(play(['......', '......', '..SS.R', '......', '......', '......']))).toHaveLength(0); // own stone, then a gap
    expect(legalMoves(play(['......', '......', 'SRR...', '......', '......', '......']))).toHaveLength(0); // two in a row
    expect(legalMoves(play(['......', '......', 'SRS...', '......', '......', '......']))).toHaveLength(0); // landing taken
  });
  it('does not jump over the board edge', () => {
    expect(legalMoves(play(['......', '......', '......', '......', '......', '....SR']))).toHaveLength(0);
    expect(legalMoves(play(['S.....', 'R.....', '......', '......', '......', '......'], RING)).map((m) => m.to)).toEqual([]);
  });
  it('a player with no jump loses, and the other side wins', () => {
    const g = play(['......', '......', '..S...', '......', '......', 'R.....']);
    expect(legalMoves(g)).toHaveLength(0);
    expect(outcome(g)).toEqual({ over: true, winner: RING });
    expect(outcome(playLegal(newGame(6), legalMoves(newGame(6))[0]))).toEqual({ over: false, winner: null });
    expect(outcome(newGame(6))).toEqual({ over: false, winner: null });
  });
  it('never mutates the position it is given', () => {
    const g = play(['......', '......', 'SRSR..', '......', '......', '......']);
    const copy = g.board.slice();
    for (const m of legalMoves(g)) applyMove(g, m);
    expect(g.board).toEqual(copy);
  });
  it('jumpsFrom on an empty square or a bad index gives nothing', () => {
    const g = newGame(6);
    expect(jumpsFrom(g.board, 6, 0 + 2)).toEqual([]);
    const h = play(['......', '......', '..SR..', '......', '......', '......']);
    expect(jumpsFrom(h.board, 6, 0)).toEqual([]);
  });
});

describe('move generation against an independent coordinate-based implementation', () => {
  it('agrees on every position of 300 random 6 x 6 games and 100 random 8 x 8 games', () => {
    let positions = 0;
    for (const [size, games] of [[6, 300], [8, 100]] as const) {
      for (let seed = 1; seed <= games; seed++) {
        for (const g of randomGame(size, seed * 7 + size).positions) {
          const mine = legalMoves(g).map(key).sort();
          const theirs = oMoves(toO(g)).map((m) => oKey(m, size)).sort();
          expect(mine).toEqual(theirs);
          positions++;
        }
      }
    }
    expect(positions).toBeGreaterThan(4000);
  }, 60_000);
  it('countMoves equals the length of the generated list for both sides', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const g of randomGame(6, seed).positions) {
        if (g.phase !== 2) continue;
        for (const p of [SOLID, RING] as Side[]) {
          const list = legalMoves({ ...g, toMove: p });
          expect(countMoves(g.board, g.size, p)).toBe(list.length);
        }
      }
    }
  });
});

describe('random play always ends, conserves stones, and the loser really is stuck', () => {
  it('250 random games', () => {
    for (let seed = 1; seed <= 250; seed++) {
      const size = seed % 3 === 0 ? 8 : 6;
      const { positions, last } = randomGame(size, seed + 99);
      const o = outcome(last);
      expect(o.over, `seed ${seed}`).toBe(true);
      expect(o.winner).toBe(opponent(last.toMove));
      expect(oMoves(toO(last))).toHaveLength(0);
      expect(positions.length).toBeLessThan(size * size);
      let prev = size * size;
      for (const p of positions) {
        const c = countStones(p.board);
        expect(c.solid + c.ring).toBeLessThanOrEqual(prev);
        prev = c.solid + c.ring;
        // stones never share a cell with the wrong parity: each stone sits on its own colour's squares
        for (let i = 0; i < p.board.length; i++) if (p.board[i] !== 0) expect(p.board[i]).toBe(startColour(Math.floor(i / size), i % size));
      }
    }
  }, 60_000);
});

describe('solving small boards exactly', () => {
  it('alpha-beta agrees with a full solve of 4 x 4 (a first-player win or loss, from the opening)', () => {
    const exact = oSolve(oStart(4));
    const budget: Budget = { nodes: 0, limit: 5_000_000, aborted: false };
    const v = negamax(newGame(4), 100, -Infinity, Infinity, budget);
    expect(budget.aborted).toBe(false);
    expect(Math.sign(v)).toBe(exact);
    expect(Math.abs(v)).toBeGreaterThan(WIN_SCORE - 100);
  });
  it('after each Solid opening on 4 x 4 the search and the oracle agree on who wins', () => {
    for (const m of legalMoves(newGame(4))) {
      const g = playLegal(newGame(4), m);
      const o = toO(g);
      const budget: Budget = { nodes: 0, limit: 5_000_000, aborted: false };
      expect(Math.sign(negamax(g, 100, -Infinity, Infinity, budget))).toBe(oSolve(o));
    }
  });
  it('on 6 x 6 end positions (12 stones or fewer) alpha-beta equals the exhaustive result', () => {
    let checked = 0;
    for (let seed = 1; seed <= 400 && checked < 40; seed++) {
      const { positions } = randomGame(6, seed + 5000);
      const g = positions.find((p) => p.phase === 2 && countStones(p.board).solid + countStones(p.board).ring <= 12 && legalMoves(p).length > 0);
      if (!g) continue;
      const budget: Budget = { nodes: 0, limit: 5_000_000, aborted: false };
      const v = negamax(g, 100, -Infinity, Infinity, budget);
      expect(budget.aborted).toBe(false);
      expect(Math.sign(v), `seed ${seed}`).toBe(oSolve(toO(g)));
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(30);
  }, 60_000);
  it('a pruned search returns exactly what an unpruned search returns for a fixed depth', () => {
    const plain = (g: Game, depth: number, ply: number): number => {
      const ms = legalMoves(g);
      if (g.phase === 2 && ms.length === 0) return -WIN_SCORE + ply;
      if (depth <= 0) return g.phase === 2 ? evaluate(g) : 0;
      let best = -Infinity;
      for (const m of ms) best = Math.max(best, -plain(playLegal(g, m), depth - 1, ply + 1));
      return best;
    };
    for (let seed = 1; seed <= 12; seed++) {
      const { positions } = randomGame(6, seed + 300);
      const g = positions[Math.min(positions.length - 1, 4 + (seed % 5))];
      for (const depth of [1, 2, 3, 4]) {
        const budget: Budget = { nodes: 0, limit: 5_000_000, aborted: false };
        expect(negamax(g, depth, -Infinity, Infinity, budget), `seed ${seed} depth ${depth}`).toBe(plain(g, depth, 0));
      }
    }
  });
  it('stops at its node budget and says so', () => {
    const budget: Budget = { nodes: 0, limit: 50, aborted: false };
    negamax(playLegal(playLegal(newGame(8), legalMoves(newGame(8))[0]), legalMoves(playLegal(newGame(8), legalMoves(newGame(8))[0]))[0]), 12, -Infinity, Infinity, budget);
    expect(budget.aborted).toBe(true);
    expect(budget.nodes).toBeLessThanOrEqual(51);
  });
});

describe('computer players', () => {
  const levels: Level[] = ['easy', 'medium', 'hard'];
  const playOut = (pick: (g: Game, p: Side) => Move | null): { last: Game; plies: number } => {
    let g = newGame(6);
    let plies = 0;
    for (; plies < 200; plies++) {
      const m = pick(g, g.toMove);
      if (!m) break;
      g = applyMove(g, m) ?? (() => { throw new Error('illegal move chosen'); })();
    }
    return { last: g, plies };
  };

  it('returns null when there is nothing to play and the forced move when there is only one', () => {
    const stuck: Game = { size: 6, board: new Int8Array(36), toMove: SOLID, phase: 2 };
    for (const l of levels) expect(chooseMove(stuck, l, mulberry32(1))).toBeNull();
    const board = new Int8Array(36);
    board[14] = SOLID; board[15] = RING;
    const one: Game = { size: 6, board, toMove: SOLID, phase: 2 };
    for (const l of levels) expect(chooseMove(one, l, mulberry32(1))).toMatchObject({ from: 14, to: 16 });
  });
  it('always plays a legal move, at every level, over many positions including the openings', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { positions } = randomGame(seed % 2 ? 6 : 8, seed + 40);
      for (const g of positions.filter((_, i) => i % 4 === 0)) {
        const legal = legalMoves(g).map(key);
        if (!legal.length) continue;
        for (const l of levels) expect(legal).toContain(key(chooseMove(g, l, mulberry32(seed))!));
      }
    }
  }, 240_000);
  it('is deterministic for a seed and Easy varies with the seed', () => {
    const { positions } = randomGame(6, 8);
    const g = positions[6];
    for (const l of levels) expect(key(chooseMove(g, l, mulberry32(77))!)).toBe(key(chooseMove(g, l, mulberry32(77))!));
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) seen.add(key(chooseMove(newGame(6), 'easy', mulberry32(s))!));
    expect(seen.size).toBe(4);
  });
  it('plays a winning move when one exists (leaves the opponent without a jump)', () => {
    // Solid to move; the only winning idea is the jump that removes Ring's last mobile stone.
    const board = new Int8Array(36);
    board[12] = SOLID; board[13] = RING; // (2,0) S, (2,1) R; landing (2,2) empty
    board[34] = RING; // far Ring stone with no neighbours: Ring cannot move
    const g: Game = { size: 6, board, toMove: SOLID, phase: 2 };
    for (const l of ['medium', 'hard'] as Level[]) {
      const m = chooseMove(g, l, mulberry32(4))!;
      const after = applyMove(g, m)!;
      expect(outcome(after)).toEqual({ over: true, winner: SOLID });
    }
  });
  it('Hard finds a forced win that is two moves deep', () => {
    // Solid can jump to leave Ring a single reply that then leaves Ring stuck; verified by the oracle solver.
    let found = 0;
    for (let seed = 1; seed <= 200 && found < 5; seed++) {
      const { positions } = randomGame(6, seed + 900);
      const g = positions.find((p) => p.phase === 2 && countStones(p.board).solid + countStones(p.board).ring <= 11 && legalMoves(p).length > 1);
      if (!g) continue;
      const winning = legalMoves(g).filter((m) => oSolve(toO(playLegal(g, m))) === -1);
      if (!winning.length) continue;
      expect(winning.map(key)).toContain(key(chooseMove(g, 'hard', mulberry32(seed))!));
      found++;
    }
    expect(found).toBeGreaterThanOrEqual(5);
  }, 60_000);
  it('Hard beats Easy in at least 9 of 10 games and Medium beats Easy in at least 8 of 10 (colours alternate)', () => {
    const duel = (strong: Level, games: number): number => {
      let wins = 0;
      for (let k = 0; k < games; k++) {
        const rng = mulberry32(500 + k);
        const strongSide: Side = k % 2 === 0 ? SOLID : RING;
        const { last } = playOut((g, p) => chooseMove(g, p === strongSide ? strong : 'easy', rng));
        if (outcome(last).winner === strongSide) wins++;
      }
      return wins;
    };
    expect(duel('hard', 10)).toBeGreaterThanOrEqual(9);
    expect(duel('medium', 10)).toBeGreaterThanOrEqual(8);
  }, 240_000);
  it('is bounded: the budgets are fixed numbers and the slowest move on a 8 x 8 board stays well under 2.5 s', () => {
    expect(HARD_NODES).toBe(80000);
    expect(MEDIUM_NODES).toBe(12000);
    expect(MEDIUM_DEPTH).toBe(3);
    expect(HARD_MAX_DEPTH).toBe(16);
    let worst = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const { positions } = randomGame(8, seed + 70);
      for (const g of positions.filter((p, i) => i % 8 === 0 && legalMoves(p).length > 1)) {
        const t = performance.now();
        searchMove(g, HARD_MAX_DEPTH, HARD_NODES, mulberry32(seed));
        worst = Math.max(worst, performance.now() - t);
      }
    }
    expect(worst).toBeLessThan(2500);
  }, 240_000);
});

describe('helpers', () => {
  it('shuffle is a permutation and mulberry32 is seeded', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(3)).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(mulberry32(9)()).toBe(mulberry32(9)());
  });
  it('names, plurals and messages', () => {
    expect(nameOf(SOLID)).toBe('Solid');
    expect(nameOf(RING)).toBe('Ring');
    expect(cellName(0, 6)).toBe('row 1, column 1');
    expect(cellName(35, 6)).toBe('row 6, column 6');
    expect(stonesText(1)).toBe('1 stone');
    expect(stonesText(3)).toBe('3 stones');
    expect(movesText(1)).toBe('1 move');
    expect(movesText(0)).toBe('0 moves');
    expect(describeMove({ kind: 'jump', from: 14, to: 16, captured: [15] }, SOLID, 6)).toBe('Solid jumped from row 3, column 3 to row 3, column 5 and took 1 stone.');
    expect(describeMove({ kind: 'remove', from: -1, to: 0, captured: [0] }, SOLID, 6)).toBe('Solid took the stone at row 1, column 1.');
    expect(describeOutcome({ over: true, winner: SOLID }, SOLID)).toBe('You win. The computer has no jump left.');
    expect(describeOutcome({ over: true, winner: SOLID }, RING)).toBe('The computer wins. You have no jump left.');
    expect(describeOutcome({ over: true, winner: RING }, null)).toBe('Ring wins. Solid has no jump left.');
    expect(describeOutcome({ over: false, winner: null }, null)).toBe('In progress.');
  });
  it('undoCount takes back the person\'s last move and the replies, or one move for two people', () => {
    expect(undoCount([], SOLID)).toBe(0);
    expect(undoCount([RING], SOLID)).toBe(0);
    expect(undoCount([SOLID, RING], SOLID)).toBe(2);
    expect(undoCount([RING, SOLID, RING, SOLID], SOLID)).toBe(1);
    expect(undoCount([SOLID], null)).toBe(1);
    expect(undoCount([], null)).toBe(0);
  });

  it('thinkingMessage keeps the move sentence and appends the wait note', () => {
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Solid moved.')).toBe('Solid moved. Computer is thinking...');
  });
});
