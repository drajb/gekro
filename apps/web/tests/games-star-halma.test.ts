/**
 * games-star-halma.test.ts - the engine behind `star-halma`.
 *
 * Pinned: the 121-point star (row widths from an independently written table, six points of 10, a
 * central hexagon of 61, 312 neighbour pairs), the starting positions for 2 and 3 sides, the eight
 * possible first moves, steps and hop chains, no captures, the win (all 10 pieces in the opposite
 * point), passing, and the move limit. Destinations are compared with a second implementation that
 * uses doubled row/column coordinates and recursion, on thousands of random boards and on every
 * position of random games. The computer levels are legal, seeded, bounded, ordered by strength, and
 * finish whole games.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, applyMove, playLegal, destinationsFrom, movesFor, piecesHome, distanceSum, minDistanceSum, chooseMove, mulberry32,
  indexOf, rowOf, colOf, rowPosition, cellName, hexDistance, tipOf, campOf, oppositeCamp, campOfSeat, goalOfSeat, nameOf, describeMove, describeResult, thinkingMessage,
  movesText, piecesText, undoCount, goalFull,
  CELLS, PIECES, CX, CY, CZ, NEIGH, DIRS, CAMP_CELLS, SEAT_CAMPS, SEAT_NAMES, MAX_MOVES_EACH, LAYOUT_COLS, LAYOUT_ROWS, HARD_CANDIDATES,
  type Game, type Move, type Level, type Players, type Stats,
} from '../src/components/apps-private/star-halma/helpers';

// ── Independent oracle: doubled coordinates (row, col), neighbours at (0, +-2) and (+-1, +-1) ──
const WIDTHS: [number, number, number][] = [
  // row, first column, count (cells sit two columns apart)
  [0, 12, 1], [1, 11, 2], [2, 10, 3], [3, 9, 4], [4, 0, 13], [5, 1, 12], [6, 2, 11], [7, 3, 10], [8, 4, 9],
  [9, 3, 10], [10, 2, 11], [11, 1, 12], [12, 0, 13], [13, 9, 4], [14, 10, 3], [15, 11, 2], [16, 12, 1],
];
const O_CELLS: [number, number][] = [];
for (const [r, c0, n] of WIDTHS) for (let k = 0; k < n; k++) O_CELLS.push([r, c0 + 2 * k]);
const O_SET = new Set(O_CELLS.map(([r, c]) => `${r},${c}`));
const O_DIRS: [number, number][] = [[0, 2], [0, -2], [-1, 1], [-1, -1], [1, 1], [1, -1]];
const oDest = (occ: Map<string, number>, from: [number, number]): Set<string> => {
  const out = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const fk = key(from[0], from[1]);
  for (const [dr, dc] of O_DIRS) {
    const k = key(from[0] + dr, from[1] + dc);
    if (O_SET.has(k) && !occ.has(k)) out.add(k);
  }
  const visited = new Set<string>([fk]);
  const hop = (r: number, c: number) => {
    for (const [dr, dc] of O_DIRS) {
      const over = key(r + dr, c + dc);
      const land = key(r + 2 * dr, c + 2 * dc);
      if (over === fk || !occ.has(over) || !O_SET.has(land) || occ.has(land) || visited.has(land)) continue;
      visited.add(land);
      out.add(land);
      hop(r + 2 * dr, c + 2 * dc);
    }
  };
  hop(from[0], from[1]);
  return out;
};
const toO = (i: number): [number, number] => [rowOf(i), colOf(i)];
const occOf = (board: Int8Array): Map<string, number> => {
  const m = new Map<string, number>();
  board.forEach((v, i) => { if (v) m.set(toO(i).join(','), v); });
  return m;
};
const engineDest = (board: Int8Array, from: number): string[] => destinationsFrom(board, from).map((t) => toO(t).join(',')).sort();
const oracleDest = (board: Int8Array, from: number): string[] => [...oDest(occOf(board), toO(from))].sort();

describe('geometry', () => {
  it('is the 121-point star: row widths 1 2 3 4 13 12 11 10 9 10 11 12 13 4 3 2 1, matching an independent table cell for cell', () => {
    expect(CELLS).toBe(121);
    expect(O_CELLS).toHaveLength(121);
    expect(new Set(Array.from({ length: CELLS }, (_, i) => `${rowOf(i)},${colOf(i)}`))).toEqual(O_SET);
    expect(LAYOUT_ROWS).toBe(17);
    expect(LAYOUT_COLS).toBe(26);
    for (let i = 0; i < CELLS; i++) expect(CX[i] + CY[i] + CZ[i]).toBe(0);
    for (let i = 0; i < CELLS; i++) expect(indexOf(CX[i], CY[i])).toBe(i);
    expect(indexOf(9, 9)).toBe(-1);
  });
  it('has six points of 10 cells, a central hexagon of 61, and tips 16 steps from the opposite tip', () => {
    expect(CAMP_CELLS.map((c) => c.length)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(new Set(CAMP_CELLS.flat()).size).toBe(60);
    let centre = 0;
    for (let i = 0; i < CELLS; i++) if (campOf(i) < 0) centre++;
    expect(centre).toBe(61);
    for (let c = 0; c < 6; c++) {
      expect(oppositeCamp(oppositeCamp(c))).toBe(c);
      expect(hexDistance(tipOf(c), tipOf(oppositeCamp(c)))).toBe(16);
      expect(CAMP_CELLS[c].includes(tipOf(c))).toBe(true);
    }
  });
  it('has 312 neighbour pairs, the same as a brute-force count of pairs at distance 1, and degree 6 inside', () => {
    let engine = 0;
    for (let i = 0; i < CELLS; i++) for (let d = 0; d < 6; d++) if (NEIGH[i * 6 + d] >= 0) engine++;
    let brute = 0;
    for (let i = 0; i < CELLS; i++) for (let j = 0; j < CELLS; j++) if (i !== j && hexDistance(i, j) === 1) brute++;
    expect(engine).toBe(brute);
    expect(engine / 2).toBe(312);
    // the same count from the doubled-coordinate table
    let o = 0;
    for (const [r, c] of O_CELLS) for (const [dr, dc] of O_DIRS) if (O_SET.has(`${r + dr},${c + dc}`)) o++;
    expect(o).toBe(engine);
    // the tip has 2 neighbours, the centre has 6
    expect(NEIGH.slice(tipOf(0) * 6, tipOf(0) * 6 + 6).filter((n) => n >= 0)).toHaveLength(2);
    expect(Array.from({ length: 6 }, (_, d) => NEIGH[indexOf(0, 0) * 6 + d]).every((n) => n >= 0)).toBe(true);
    expect(DIRS).toHaveLength(6);
  });
  it('numbers rows and positions for reading out', () => {
    expect(rowPosition(0)).toBe(0);
    expect(cellName(0)).toBe('row 1, point 1');
    expect(cellName(CELLS - 1)).toBe('row 17, point 1');
    expect(rowPosition(indexOf(-4, -4))).toBe(0); // the bottom tip is the only cell of the last row
    let widths = 0;
    for (let i = 0; i < CELLS; i++) widths = Math.max(widths, rowPosition(i) + 1);
    expect(widths).toBe(13);
  });
});

describe('the starting position', () => {
  it('2 sides: 10 pieces each in opposite points; 3 sides: every other point, all facing an empty point', () => {
    const two = newGame(2);
    expect(piecesHome(two.board, 2, 0)).toBe(0);
    expect(two.board.filter((v) => v === 1)).toHaveLength(10);
    expect(two.board.filter((v) => v === 2)).toHaveLength(10);
    for (const i of CAMP_CELLS[3]) expect(two.board[i]).toBe(1);
    for (const i of CAMP_CELLS[0]) expect(two.board[i]).toBe(2);
    expect(SEAT_CAMPS[2]).toEqual([3, 0]);
    const three = newGame(3);
    expect(SEAT_CAMPS[3]).toEqual([3, 5, 1]);
    for (const seat of [0, 1, 2]) {
      expect(three.board.filter((v) => v === seat + 1)).toHaveLength(10);
      expect(CAMP_CELLS[goalOfSeat(3, seat)].every((i) => three.board[i] === 0)).toBe(true);
      expect(goalOfSeat(3, seat)).toBe(oppositeCamp(campOfSeat(3, seat)));
    }
    expect(three.toMove).toBe(0);
    expect(three.over).toBe(false);
    expect(() => newGame(4 as unknown as Players)).toThrow(RangeError);
    expect(() => newGame(1 as unknown as Players)).toThrow(RangeError);
  });
  it('the first player has exactly 14 moves: 4 front pieces step to 2 empty points each (8), and the 3 pieces behind them each hop a front piece (6)', () => {
    for (const players of [2, 3] as Players[]) {
      const g = newGame(players);
      const ms = legalMoves(g);
      expect(ms).toHaveLength(14);
      expect(ms.filter((m) => hexDistance(m.from, m.to) === 1)).toHaveLength(8);
      expect(ms.filter((m) => hexDistance(m.from, m.to) === 2)).toHaveLength(6);
      expect(new Set(ms.map((m) => m.from)).size).toBe(7);
    }
  });
  it('the distance sum starts at the same value for every side and the best possible sum is lower', () => {
    const g = newGame(3);
    const sums = [0, 1, 2].map((s) => distanceSum(g.board, 3, s));
    expect(new Set(sums).size).toBe(1);
    expect(minDistanceSum(3, 0)).toBeLessThan(sums[0]);
    expect(minDistanceSum(2, 0)).toBe(minDistanceSum(2, 1));
    // 10 pieces filling the goal point: tip at 0, then 1+1, 2+2+2, 3+3+3+3 steps from the tip = 0 + 2 + 6 + 12 = 20
    expect(minDistanceSum(2, 0)).toBe(20);
    expect(sums[0]).toBe(10 * 16 - 20);
  });
});

describe('steps and hops', () => {
  const put = (cells: [number, number, number][], players: Players = 2): Int8Array => {
    const b = new Int8Array(CELLS);
    for (const [x, y, v] of cells) b[indexOf(x, y)] = v;
    return b;
  };
  it('a piece steps to any empty neighbour', () => {
    const b = put([[0, 0, 1]]);
    expect(destinationsFrom(b, indexOf(0, 0))).toHaveLength(6);
    const edge = put([[4, 4, 1]]); // a tip point
    expect(destinationsFrom(edge, indexOf(4, 4))).toHaveLength(2);
  });
  it('hops over any neighbouring piece, of either side, into the empty point beyond', () => {
    for (const other of [1, 2]) {
      const b = put([[0, 0, 1], [1, -1, other]]);
      const d = destinationsFrom(b, indexOf(0, 0));
      expect(d).toContain(indexOf(2, -2));
      expect(d).not.toContain(indexOf(1, -1)); // occupied
    }
  });
  it('cannot hop over an empty point, over a piece with a piece behind it, or off the star', () => {
    const behind = put([[0, 0, 1], [1, -1, 2], [2, -2, 2]]);
    expect(destinationsFrom(behind, indexOf(0, 0))).not.toContain(indexOf(2, -2));
    expect(destinationsFrom(behind, indexOf(0, 0))).not.toContain(indexOf(3, -3));
    const tip = put([[4, 3, 1], [4, 4, 2]]); // piece below the top tip: hopping the tip would leave the star
    expect(destinationsFrom(tip, indexOf(4, 3))).not.toContain(-1);
  });
  it('chains hops in any directions and reports every stopping point once', () => {
    // A piece at (0,0); stones at (1,-1) and (3,-2) ... line them up so the piece lands on (2,-2) then hops again.
    const b = put([[0, 0, 1], [1, -1, 2], [2, -1, 2], [2, -3, 2]]);
    const d = destinationsFrom(b, indexOf(0, 0));
    expect(d).toContain(indexOf(2, -2)); // first hop over (1,-1)
    // from (2,-2): over (2,-1) in direction (0,+1,-1)? lands (2,0), and over (2,-3)? direction (0,-1,+1): lands (2,-4)
    expect(d).toContain(indexOf(2, 0));
    expect(d).toContain(indexOf(2, -4));
    expect(new Set(d).size).toBe(d.length);
    expect([...d].sort((a, c) => a - c)).toEqual(d);
  });
  it('the moving piece does not block itself: its starting point counts as empty during a chain', () => {
    // A ring of pieces lets a chain come back round past the start; compare with the oracle.
    const b = put([[0, 0, 1], [1, 0, 2], [0, 1, 2], [-1, 1, 2]]);
    expect(engineDest(b, indexOf(0, 0))).toEqual(oracleDest(b, indexOf(0, 0)));
  });
  it('applyMove only allows a reachable point for the side to move, and moves exactly one piece', () => {
    const g = newGame(2);
    const from = legalMoves(g)[0].from;
    const to = legalMoves(g)[0].to;
    const after = applyMove(g, from, to)!;
    expect(after.board[from]).toBe(0);
    expect(after.board[to]).toBe(1);
    expect(after.toMove).toBe(1);
    expect(after.moves).toBe(1);
    expect(after.board.filter((v) => v === 1)).toHaveLength(10);
    expect(applyMove(g, from, from)).toBeNull();
    expect(applyMove(g, to, from)).toBeNull(); // empty start
    expect(applyMove(g, CAMP_CELLS[0][0], indexOf(0, 0))).toBeNull(); // the other side's piece
    for (const bad of [-1, 121, 1.5, NaN, Infinity, '5' as unknown as number]) {
      expect(applyMove(g, bad as number, 0)).toBeNull();
      expect(applyMove(g, from, bad as number)).toBeNull();
    }
    expect(g.board.filter((v) => v === 1)).toHaveLength(10); // untouched
    expect(g.moves).toBe(0);
  });
});

describe('agreement with the second implementation', () => {
  it('3000 random boards: every piece has exactly the same set of destinations', () => {
    let checked = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const rng = mulberry32(seed);
      const b = new Int8Array(CELLS);
      const n = 6 + Math.floor(rng() * 70);
      for (let k = 0; k < n; k++) b[Math.floor(rng() * CELLS)] = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < CELLS; i++) {
        if (!b[i]) continue;
        expect(engineDest(b, i), `seed ${seed} cell ${i}`).toEqual(oracleDest(b, i));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50000);
  }, 120_000);
  it('every position of 60 random games (2 and 3 sides): same destinations for every piece of the side to move', () => {
    let positions = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed + 500);
      let g = newGame(seed % 2 ? 2 : 3);
      for (let k = 0; k < 80 && !g.over; k++) {
        const ms = legalMoves(g);
        for (let i = 0; i < CELLS; i++) if (g.board[i] === g.toMove + 1) expect(engineDest(g.board, i)).toEqual(oracleDest(g.board, i));
        positions++;
        const m = ms[Math.floor(rng() * ms.length)];
        g = playLegal(g, m.from, m.to);
        expect(g.board.filter((v) => v > 0)).toHaveLength(g.players * PIECES);
      }
    }
    expect(positions).toBeGreaterThan(3000);
  }, 120_000);
});

describe('winning, passing and the move limit', () => {
  /** A position where `seat` has 9 pieces in its goal point and the 10th is one step from the last empty hole. */
  const nearlyHome = (players: Players, seat: number): { g: Game; from: number; to: number } => {
    const goal = CAMP_CELLS[goalOfSeat(players, seat)];
    // The hole is a cell on the edge of the point that touches the central hexagon.
    const hole = goal.find((i) => Array.from({ length: 6 }, (_, d) => NEIGH[i * 6 + d]).some((n) => n >= 0 && campOf(n) < 0))!;
    const start = Array.from({ length: 6 }, (_, d) => NEIGH[hole * 6 + d]).find((n) => n >= 0 && campOf(n) < 0)!;
    const board = new Int8Array(CELLS);
    for (const i of goal) if (i !== hole) board[i] = seat + 1;
    board[start] = seat + 1;
    return { g: { players, board, toMove: seat, moves: 0, over: false, winner: -1, reason: 'none' }, from: start, to: hole };
  };
  it('the side whose 10 pieces all stand in the opposite point wins, and nobody can move afterwards', () => {
    for (const [players, seat] of [[2, 0], [2, 1], [3, 0], [3, 1], [3, 2]] as [Players, number][]) {
      const { g, from, to } = nearlyHome(players, seat);
      expect(piecesHome(g.board, players, seat)).toBe(9);
      const after = applyMove(g, from, to)!;
      expect(after.over).toBe(true);
      expect(after.winner).toBe(seat);
      expect(after.reason).toBe('home');
      expect(piecesHome(after.board, players, seat)).toBe(10);
      expect(legalMoves(after)).toEqual([]);
      expect(applyMove(after, from, to)).toBeNull();
    }
  });
  it('a piece another side leaves in your goal point cannot hold the game up: a full point with at least one of your own pieces wins', () => {
    const { g, from, to } = nearlyHome(2, 0);
    const board = g.board.slice();
    const intruder = CAMP_CELLS[goalOfSeat(2, 0)].find((i) => i !== to && board[i] === 1)!;
    board[intruder] = 2; // a Diamond piece stays in the goal point
    const after = playLegal({ ...g, board }, from, to);
    expect(goalFull(after.board, 2, 0)).toBe(true);
    expect(piecesHome(after.board, 2, 0)).toBe(9);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(0);
    // With a hole left in the point there is no win, and a point full of other sides' pieces alone is not a win either.
    expect(goalFull(g.board, 2, 0)).toBe(false);
    expect(goalFull(newGame(2).board, 2, 0)).toBe(false); // 10 enemy pieces, none of yours
  });
  it('a side is also checked after another side moves: another side filling the last hole of your point completes it for you', () => {
    const { g, to } = nearlyHome(2, 0);
    const board = g.board.slice();
    const start = board.findIndex((v, i) => v === 1 && !CAMP_CELLS[goalOfSeat(2, 0)].includes(i));
    board[start] = 2; // the outside piece is a Diamond piece instead, and it is Diamond's move
    const after = playLegal({ ...g, board, toMove: 1 }, start, to);
    expect(goalFull(after.board, 2, 0)).toBe(true);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(0);
  });
  it('a side that cannot move passes; if nobody can move the game is a drawn stand-off', () => {
    // Side 2 is completely boxed in at a tip by its own pieces and side 1 pieces; side 1 can still move.
    const board = new Int8Array(CELLS);
    const tip = tipOf(0);
    board[indexOf(0, 0)] = 1; // a free piece far from the box
    board[tip] = 2;
    for (let d = 0; d < 6; d++) { const n = NEIGH[tip * 6 + d]; if (n >= 0) board[n] = 1; }
    // second ring behind those neighbours so no hop is possible
    for (let d = 0; d < 6; d++) {
      const n = NEIGH[tip * 6 + d];
      if (n < 0) continue;
      for (let e = 0; e < 6; e++) { const m = NEIGH[n * 6 + e]; if (m >= 0 && board[m] === 0) board[m] = 1; }
    }
    expect(movesFor(board, 1)).toEqual([]);
    expect(movesFor(board, 0).length).toBeGreaterThan(0);
    const g: Game = { players: 2, board, toMove: 0, moves: 0, over: false, winner: -1, reason: 'none' };
    const m = legalMoves(g).find((x) => x.from === indexOf(0, 0))!;
    const after = playLegal(g, m.from, m.to);
    expect(after.toMove).toBe(0); // the stuck side is skipped
    expect(after.over).toBe(false);
  });
  it('the game is a draw after 150 moves each (300 for two sides, 450 for three) with no winner', () => {
    expect(MAX_MOVES_EACH).toBe(150);
    const g = newGame(2);
    const late: Game = { ...g, moves: 299 };
    const m = legalMoves(late)[0];
    const after = playLegal(late, m.from, m.to);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(-1);
    expect(after.reason).toBe('limit');
    expect(describeResult(after, [0])).toBe('Draw: 150 moves each were played with no winner.');
    const three: Game = { ...newGame(3), moves: 449 };
    const m3 = legalMoves(three)[0];
    expect(playLegal(three, m3.from, m3.to).over).toBe(true);
    const notYet: Game = { ...newGame(3), moves: 448 };
    expect(playLegal(notYet, legalMoves(notYet)[0].from, legalMoves(notYet)[0].to).over).toBe(false);
  });
  it('plain-language helpers', () => {
    expect(nameOf(0)).toBe('Circle');
    expect(SEAT_NAMES).toEqual(['Circle', 'Diamond', 'Triangle']);
    expect(movesText(1)).toBe('1 move');
    expect(movesText(2)).toBe('2 moves');
    expect(piecesText(1)).toBe('1 piece');
    expect(describeMove(1, 0, 2)).toBe('Diamond moved from row 1, point 1 to row 2, point 2.');
    const win: Game = { ...newGame(2), over: true, winner: 1, reason: 'home' };
    expect(describeResult(win, null)).toBe('Diamonds win by filling the opposite point.');
    expect(describeResult(win, [1])).toBe('You win by filling the opposite point.');
    expect(describeResult(win, [0])).toBe('The computer wins (Diamonds) by filling the opposite point.');
    expect(describeResult({ ...win, winner: -1, reason: 'blocked' }, null)).toBe('Draw: nobody can move.');
    expect(describeResult(newGame(2), null)).toBe('In progress.');
    expect(undoCount([], [0])).toBe(0);
    expect(undoCount([1], [0])).toBe(0);
    expect(undoCount([0, 1], [0])).toBe(2);
    expect(undoCount([0, 1, 0, 1], [0])).toBe(2);
    expect(undoCount([0, 1, 2, 1], [0, 1, 2])).toBe(1);
    expect(undoCount([0], null)).toBe(1);
    expect(undoCount([], null)).toBe(0);
  });
});

describe('computer players', () => {
  const levels: Level[] = ['easy', 'medium', 'hard'];
  const play = (players: Players, pickLevel: (seat: number) => Level, seed: number, cap = 5000): Game => {
    const rng = mulberry32(seed);
    let g = newGame(players);
    for (let k = 0; k < cap && !g.over; k++) {
      const m = chooseMove(g, pickLevel(g.toMove), rng);
      if (!m) throw new Error('no move for the side to move');
      g = applyMove(g, m.from, m.to) ?? (() => { throw new Error('illegal move chosen'); })();
    }
    return g;
  };

  it('returns null when the side to move has no move', () => {
    const g = { ...newGame(2), over: true };
    for (const l of levels) expect(chooseMove(g, l, mulberry32(1))).toBeNull();
  });
  it('always plays a legal move at every level over many positions', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const rng = mulberry32(seed + 31);
      let g = newGame(seed % 2 ? 2 : 3);
      for (let k = 0; k < 60 && !g.over; k++) {
        const legal = legalMoves(g).map((m) => `${m.from}>${m.to}`);
        for (const l of levels) {
          const m = chooseMove(g, l, mulberry32(seed * 100 + k))!;
          expect(legal).toContain(`${m.from}>${m.to}`);
        }
        const ms = legalMoves(g);
        const m = ms[Math.floor(rng() * ms.length)];
        g = playLegal(g, m.from, m.to);
      }
    }
  }, 120_000);
  it('is deterministic for a seed and Easy varies with the seed', () => {
    const g = playLegal(newGame(2), legalMoves(newGame(2))[0].from, legalMoves(newGame(2))[0].to);
    for (const l of levels) expect(chooseMove(g, l, mulberry32(5))).toEqual(chooseMove(g, l, mulberry32(5)));
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) { const m = chooseMove(newGame(2), 'easy', mulberry32(s))!; seen.add(`${m.from}>${m.to}`); }
    expect(seen.size).toBeGreaterThan(3);
  });
  it('Medium takes the biggest gain: a hop beats a single step', () => {
    // A Circle piece in the middle with a Diamond piece next to it toward the top: hopping it gains 2 steps, stepping gains 1.
    const board = new Int8Array(CELLS);
    board[indexOf(0, 0)] = 1;
    board[indexOf(1, 0)] = 2;
    const g: Game = { players: 2, board, toMove: 0, moves: 0, over: false, winner: -1, reason: 'none' };
    for (let s = 1; s <= 5; s++) expect(chooseMove(g, 'medium', mulberry32(s))).toEqual({ from: indexOf(0, 0), to: indexOf(2, 0) });
    const gains = legalMoves(g).map((x) => hexDistance(x.from, tipOf(0)) - hexDistance(x.to, tipOf(0)));
    expect(Math.max(...gains)).toBe(2);
  });
  it('Medium and Hard finish a whole 2-side game with a winner inside the move limit, from several seeds', () => {
    for (const level of ['medium', 'hard'] as Level[]) {
      for (const seed of [1, 2, 3]) {
        const g = play(2, () => level, seed);
        expect(g.over, `${level} seed ${seed}`).toBe(true);
        expect(g.winner, `${level} seed ${seed} reason ${g.reason}`).toBeGreaterThanOrEqual(0);
        expect(g.reason).toBe('home');
        expect(g.moves).toBeLessThan(2 * MAX_MOVES_EACH);
        expect(goalFull(g.board, 2, g.winner)).toBe(true);
      }
    }
  }, 240_000);
  it('three computers finish a 3-side game with a winner', () => {
    for (const seed of [1, 2]) {
      const g = play(3, () => 'hard', seed);
      expect(g.over).toBe(true);
      expect(g.winner).toBeGreaterThanOrEqual(0);
      expect(goalFull(g.board, 3, g.winner)).toBe(true);
    }
  }, 240_000);
  it('Hard beats Easy and Medium beats Easy in every one of 6 games (sides alternate)', () => {
    for (const strong of ['hard', 'medium'] as Level[]) {
      let wins = 0;
      for (let k = 0; k < 6; k++) {
        const strongSeat = k % 2;
        const g = play(2, (s) => (s === strongSeat ? strong : 'easy'), 40 + k);
        if (g.winner === strongSeat) wins++;
      }
      expect(wins, strong).toBe(6);
    }
  }, 240_000);
  it('is bounded: a Hard move searches at most 2 x 14 + 2 positions and stays well inside 2.5 s', () => {
    expect(HARD_CANDIDATES).toBe(14);
    let worstSearches = 0; let worstMs = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const rng = mulberry32(seed + 900);
      let g = newGame(seed % 2 ? 2 : 3);
      for (let k = 0; k < 120 && !g.over; k++) {
        const stats: Stats = { searches: 0 };
        const t = performance.now();
        const m = chooseMove(g, 'hard', rng, stats)!;
        worstMs = Math.max(worstMs, performance.now() - t);
        worstSearches = Math.max(worstSearches, stats.searches);
        g = playLegal(g, m.from, m.to);
      }
    }
    expect(worstSearches).toBeLessThanOrEqual(2 * 14 + 2);
    expect(worstMs).toBeLessThan(2500);
  }, 240_000);

  it('thinkingMessage keeps the move sentence and appends the wait note', () => {
    expect(thinkingMessage('')).toBe('Computer is thinking...');
    expect(thinkingMessage('Circle moved from A to B.')).toBe('Circle moved from A to B. Computer is thinking...');
  });
});
