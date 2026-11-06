/**
 * games-nested-tic-tac-toe.test.ts - the engine behind `nested-tic-tac-toe`.
 *
 * Pinned: the "sent to" rule (the cell you play inside a small board names the small board the next
 * player must use; a decided board means a free choice among open boards), small-board wins and
 * draws, the three-boards-in-a-row win, the count rule when every board is decided, and perft
 * counts (81 and 720 by hand). A second implementation written with four coordinates (big row,
 * big column, row, column) is run in lockstep with the engine on thousands of random games and
 * must agree on every legal move, every board status and every result. Alpha-beta is compared
 * with exhaustive minimax on endgames. The three computer levels are legal, seeded, bounded by
 * their node counts, and ordered by strength.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, legalMoves, applyMove, playLegal, isLegal, countBoards, chooseMove, searchMove, negamax, evaluate, perft, mulberry32,
  boardOf, posOf, rowOf, colOf, cellAt, cellName, boardName, boardsText, describeResult, describeMove, undoCount, nameOf, opponent,
  CROSS, RING, DRAWN, LINES, WIN_SCORE, MEDIUM_DEPTH, MEDIUM_NODES, HARD_MAX_DEPTH, HARD_NODES,
  type Game, type Side, type Level, type Budget,
} from '../src/components/apps-private/nested-tic-tac-toe/helpers';

// ── Independent oracle: [bigRow][bigCol][row][col] with letters ──
type Mark = '.' | 'X' | 'O';
type Status = '.' | 'X' | 'O' | '=';
interface OG {
  m: Mark[][][][];
  won: Status[][];
  turn: 'X' | 'O';
  target: [number, number] | null;
  over: boolean;
  winner: 'X' | 'O' | null;
}
type OMove = [number, number, number, number];
const oNew = (): OG => ({
  m: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, (): Mark => '.')))),
  won: Array.from({ length: 3 }, () => Array.from({ length: 3 }, (): Status => '.')),
  turn: 'X', target: null, over: false, winner: null,
});
const oClone = (o: OG): OG => ({ m: o.m.map((a) => a.map((b) => b.map((r) => r.slice()))), won: o.won.map((r) => r.slice()), turn: o.turn, target: o.target ? [o.target[0], o.target[1]] : null, over: o.over, winner: o.winner });
const three = (get: (r: number, c: number) => string, p: string): boolean => {
  for (let i = 0; i < 3; i++) {
    if (get(i, 0) === p && get(i, 1) === p && get(i, 2) === p) return true;
    if (get(0, i) === p && get(1, i) === p && get(2, i) === p) return true;
  }
  return (get(0, 0) === p && get(1, 1) === p && get(2, 2) === p) || (get(0, 2) === p && get(1, 1) === p && get(2, 0) === p);
};
const oLegal = (o: OG): OMove[] => {
  if (o.over) return [];
  const out: OMove[] = [];
  const boards: [number, number][] = [];
  if (o.target && o.won[o.target[0]][o.target[1]] === '.') boards.push(o.target);
  else for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (o.won[a][b] === '.') boards.push([a, b]);
  for (const [a, b] of boards) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (o.m[a][b][r][c] === '.') out.push([a, b, r, c]);
  return out;
};
const oPlay = (o: OG, mv: OMove): OG => {
  const n = oClone(o);
  const [a, b, r, c] = mv;
  n.m[a][b][r][c] = o.turn;
  const cell = (rr: number, cc: number) => n.m[a][b][rr][cc];
  if (three(cell, o.turn)) n.won[a][b] = o.turn;
  else if (n.m[a][b].every((row) => row.every((v) => v !== '.'))) n.won[a][b] = '=';
  if (n.won[a][b] === o.turn && three((rr, cc) => n.won[rr][cc], o.turn)) { n.over = true; n.winner = o.turn; }
  else if (n.won.every((row) => row.every((v) => v !== '.'))) {
    const x = n.won.flat().filter((v) => v === 'X').length;
    const y = n.won.flat().filter((v) => v === 'O').length;
    n.over = true;
    n.winner = x > y ? 'X' : y > x ? 'O' : null;
  }
  n.target = n.won[r][c] === '.' ? [r, c] : null;
  n.turn = o.turn === 'X' ? 'O' : 'X';
  return n;
};
const toCell = (mv: OMove): number => (mv[0] * 3 + mv[1]) * 9 + mv[2] * 3 + mv[3];
const fromCell = (cell: number): OMove => [Math.floor(boardOf(cell) / 3), boardOf(cell) % 3, Math.floor(posOf(cell) / 3), posOf(cell) % 3];
const oSolve = (o: OG, memo = new Map<string, number>()): number => {
  const key = o.turn + (o.target ? o.target.join('') : 'x') + o.m.flat(3).join('');
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let v: number;
  if (o.over) v = o.winner === null ? 0 : o.winner === o.turn ? 1 : -1;
  else {
    v = -1;
    for (const mv of oLegal(o)) { v = Math.max(v, -oSolve(oPlay(o, mv), memo)); if (v === 1) break; }
  }
  memo.set(key, v);
  return v;
};
const oPerft = (o: OG, depth: number): number => {
  if (depth === 0 || o.over) return 1;
  let n = 0;
  for (const mv of oLegal(o)) n += depth === 1 ? 1 : oPerft(oPlay(o, mv), depth - 1);
  return n;
};
const same = (g: Game, o: OG, label: string) => {
  expect(legalMoves(g).slice().sort((a, b) => a - b), label).toEqual(oLegal(o).map(toCell).sort((a, b) => a - b));
  expect(g.over, label).toBe(o.over);
  expect(g.winner === 0 ? null : g.winner === CROSS ? 'X' : 'O', label).toBe(o.winner);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const st = g.small[a * 3 + b];
    expect(st === 0 ? '.' : st === CROSS ? 'X' : st === RING ? 'O' : '=', `${label} board ${a},${b}`).toBe(o.won[a][b]);
  }
  expect(g.toMove === CROSS ? 'X' : 'O').toBe(o.turn);
};

const lockstep = (seed: number): { engine: Game; oracle: OG; plies: number } => {
  const rng = mulberry32(seed);
  let g = newGame();
  let o = oNew();
  let plies = 0;
  same(g, o, `seed ${seed} start`);
  while (!g.over) {
    const ms = legalMoves(g);
    const m = ms[Math.floor(rng() * ms.length)];
    g = playLegal(g, m);
    o = oPlay(o, fromCell(m));
    plies++;
    same(g, o, `seed ${seed} ply ${plies}`);
  }
  return { engine: g, oracle: o, plies };
};

describe('geometry', () => {
  it('numbers cells board * 9 + position and maps them to the 9 x 9 view and back', () => {
    for (let c = 0; c < 81; c++) expect(cellAt(rowOf(c), colOf(c))).toBe(c);
    expect(rowOf(0)).toBe(0);
    expect(colOf(80)).toBe(8);
    expect(cellAt(4, 4)).toBe(40);
    expect(cellAt(0, 3)).toBe(9);
    expect(cellAt(3, 0)).toBe(27);
    expect(cellName(0)).toBe('row 1, column 1');
    expect(boardName(5)).toBe('the board in row 2, column 3');
    expect(LINES).toHaveLength(8);
  });
});

describe('the sent-to rule', () => {
  it('opens with all 81 cells and sends the next player to the board matching the cell played', () => {
    const g = newGame();
    expect(legalMoves(g)).toHaveLength(81);
    expect(g.toMove).toBe(CROSS);
    // Cell 5 inside board 0: the next player must use board 5.
    const g1 = applyMove(g, 5)!;
    expect(g1.forced).toBe(5);
    expect(legalMoves(g1)).toEqual([45, 46, 47, 48, 49, 50, 51, 52, 53]);
    // Playing the centre cell of the centre board sends the opponent to the centre board again.
    const g2 = applyMove(g, 40)!;
    expect(legalMoves(g2)).toEqual([36, 37, 38, 39, 41, 42, 43, 44]);
  });
  it('rejects moves outside the sent-to board, taken cells, and junk', () => {
    const g1 = applyMove(newGame(), 5)!;
    expect(applyMove(g1, 0)).toBeNull();
    expect(applyMove(g1, 5)).toBeNull();
    for (const bad of [-1, 81, 1.5, NaN, Infinity, '45' as unknown as number, null as unknown as number]) expect(isLegal(g1, bad as number)).toBe(false);
    expect(isLegal(g1, 45)).toBe(true);
  });
  it('a won board is closed; being sent there gives a free choice among the open boards', () => {
    const cells = new Int8Array(81);
    cells[72] = CROSS; cells[73] = CROSS; cells[75] = RING; cells[76] = RING;
    const g: Game = { ...newGame(), cells, forced: 8, toMove: CROSS };
    const won = playLegal(g, 74); // Cross completes 72, 73, 74
    expect(won.small[8]).toBe(CROSS);
    expect(won.forced).toBe(2); // position 2 sends Ring to board 2, which is open
    // Ring plays position 8 of board 0, which points at the won board 8: free choice.
    const free = playLegal({ ...won, toMove: RING, forced: -1 }, 8);
    expect(free.forced).toBe(-1);
    const moves = legalMoves(free);
    expect(moves.every((m) => boardOf(m) !== 8)).toBe(true);
    expect([...new Set(moves.map(boardOf))].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(moves).toHaveLength(71); // 72 cells in boards 0 to 7, minus the one just played
    // Nobody can play in the won board, even by name.
    expect(applyMove(free, 77)).toBeNull();
  });
  it('a full drawn board is also decided', () => {
    // Fill board 4 with no line: X O X / X O O / O X X  (checked to have no line)
    const pattern = [CROSS, RING, CROSS, CROSS, RING, RING, RING, CROSS, CROSS];
    const cells = new Int8Array(81);
    pattern.forEach((v, i) => { cells[36 + i] = v; });
    const missing = 38; // leave pos 2 open to play last
    cells[missing] = 0;
    const g: Game = { ...newGame(), cells, forced: 4, toMove: CROSS };
    const after = playLegal(g, missing);
    expect(after.small[4]).toBe(DRAWN);
    expect(after.over).toBe(false);
    expect(after.forced).toBe(2);
  });
  it('three in a row inside a board wins it, in every one of the eight lines', () => {
    for (const line of LINES) {
      const cells = new Int8Array(81);
      cells[9 * 3 + line[0]] = CROSS;
      cells[9 * 3 + line[1]] = CROSS;
      const g: Game = { ...newGame(), cells, forced: 3, toMove: CROSS };
      const after = playLegal(g, 27 + line[2]);
      expect(after.small[3]).toBe(CROSS);
    }
  });
});

describe('winning the game', () => {
  it('three won boards in a row on the big grid ends the game, in all eight lines', () => {
    for (const line of LINES) {
      const small = new Int8Array(9);
      small[line[0]] = CROSS; small[line[1]] = CROSS;
      const cells = new Int8Array(81);
      const b = line[2];
      cells[b * 9 + 0] = CROSS; cells[b * 9 + 1] = CROSS;
      const g: Game = { ...newGame(), small, cells, forced: b, toMove: CROSS };
      const after = playLegal(g, b * 9 + 2);
      expect(after.over).toBe(true);
      expect(after.winner).toBe(CROSS);
      expect(after.reason).toBe('line');
      expect(legalMoves(after)).toEqual([]);
      expect(applyMove(after, 0)).toBeNull();
    }
  });
  it('a line made of drawn or mixed boards does not win', () => {
    const small = new Int8Array(9);
    small[0] = CROSS; small[1] = DRAWN;
    const cells = new Int8Array(81);
    cells[2 * 9 + 0] = CROSS; cells[2 * 9 + 1] = CROSS;
    const g: Game = { ...newGame(), small, cells, forced: 2, toMove: CROSS };
    const after = playLegal(g, 2 * 9 + 2);
    expect(after.small[2]).toBe(CROSS);
    expect(after.over).toBe(false);
  });
  it('when all boards are decided with no line, more boards wins; equal is a draw', () => {
    // Eight boards decided with no big line, one cell left to decide the last board for Cross.
    const make = (small: number[], lastBoard: number): Game => {
      const cells = new Int8Array(81);
      cells[lastBoard * 9 + 0] = CROSS; cells[lastBoard * 9 + 1] = CROSS;
      return { ...newGame(), small: Int8Array.from(small), cells, forced: lastBoard, toMove: CROSS };
    };
    // X wins boards 4 total? Layout chosen so no line of X exists: X at 0, 1, 5, 6, ... check with the oracle idea: lines need 3.
    const small = [CROSS, CROSS, RING, RING, RING, CROSS, CROSS, DRAWN, 0]; // board 8 open
    const g = make(small, 8);
    const after = playLegal(g, 8 * 9 + 2);
    expect(after.small[8]).toBe(CROSS);
    // Cross now has 0, 1, 5, 6, 8: is there a line? 0-1-2 no (2 is Ring), 2-5-8 no, 6-7-8 no (7 drawn), 0-4-8 no, 2-4-6 no, 0-3-6 no (3 Ring)
    expect(after.over).toBe(true);
    expect(after.reason).toBe('count');
    expect(after.winner).toBe(CROSS);
    expect(countBoards(after)).toEqual({ cross: 5, ring: 3, drawn: 1, open: 0 });
    expect(describeResult(after, null)).toBe('Cross wins with 5 boards to 3.');
    expect(describeResult(after, CROSS)).toBe('You win with 5 boards to 3.');
    expect(describeResult(after, RING)).toBe('The computer wins with 5 boards to 3.');
    // A draw: 4 boards each plus one drawn, last board decided as drawn.
    const small2 = [CROSS, RING, CROSS, RING, CROSS, RING, RING, CROSS, 0];
    const cells = new Int8Array(81);
    const pattern = [CROSS, RING, CROSS, CROSS, RING, RING, RING, CROSS, 0];
    pattern.forEach((v, i) => { cells[72 + i] = v; });
    // Last cell: Cross at pos 8 gives X O X / X O O / O X X : no line, board drawn.
    const g2: Game = { ...newGame(), small: Int8Array.from(small2), cells, forced: 8, toMove: CROSS };
    const after2 = playLegal(g2, 80);
    expect(after2.small[8]).toBe(DRAWN);
    expect(after2.over).toBe(true);
    expect(after2.winner).toBe(0);
    expect(after2.reason).toBe('draw');
    expect(describeResult(after2, null)).toBe('Draw, 4 boards each.');
  });
  it('plural helpers and move descriptions', () => {
    expect(boardsText(1)).toBe('1 board');
    expect(boardsText(0)).toBe('0 boards');
    const g0 = newGame();
    const g1 = playLegal(g0, 5);
    expect(describeMove(g1, g0, CROSS)).toBe('Cross played row 2, column 3. Ring must play in the board in row 2, column 3.');
    expect(nameOf(CROSS)).toBe('Cross');
    expect(nameOf(RING)).toBe('Ring');
    expect(opponent(CROSS)).toBe(RING);
  });
});

describe('perft', () => {
  it('depth 1 is 81 and depth 2 is 720 (9 x 9 first moves, with 8 replies when the cell is on its own board)', () => {
    expect(perft(newGame(), 0)).toBe(1);
    expect(perft(newGame(), 1)).toBe(81);
    expect(perft(newGame(), 2)).toBe(81 * 9 - 9);
    expect(perft(newGame(), 2)).toBe(720);
  });
  it('depths 3 and 4 equal the second implementation', () => {
    expect(perft(newGame(), 3)).toBe(oPerft(oNew(), 3));
    expect(perft(newGame(), 4)).toBe(oPerft(oNew(), 4));
    expect(perft(newGame(), 3)).toBe(6336);
    expect(perft(newGame(), 4)).toBe(55080);
  }, 60_000);
  it('a game cannot end before the fifth ply (nobody has three marks)', () => {
    const rng = mulberry32(1);
    for (let k = 0; k < 200; k++) {
      let g = newGame();
      for (let i = 0; i < 4; i++) { const ms = legalMoves(g); g = playLegal(g, ms[Math.floor(rng() * ms.length)]); expect(g.over).toBe(false); }
    }
  });
});

describe('agreement with the second implementation', () => {
  it('1000 random games: every legal move set, board status, winner and turn agrees at every ply', () => {
    let plies = 0;
    let line = 0; let count = 0; let draw = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const r = lockstep(seed);
      plies += r.plies;
      if (r.engine.reason === 'line') line++; else if (r.engine.reason === 'count') count++; else draw++;
      expect(r.plies).toBeLessThanOrEqual(81);
      expect(r.plies).toBeGreaterThanOrEqual(5);
    }
    expect(plies).toBeGreaterThan(20000);
    expect(line).toBeGreaterThan(250); // most random games end with a line of boards
    expect(line + count + draw).toBe(1000);
  }, 120_000);
  it('reaches all three kinds of ending in random play', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 6000 && seen.size < 3; seed++) seen.add(lockstep(seed + 10000).engine.reason);
    expect([...seen].sort()).toEqual(['count', 'draw', 'line']);
  }, 120_000);
  it('the engine never changes a position it was handed', () => {
    const g = playLegal(playLegal(newGame(), 40), 36);
    const cells = g.cells.slice();
    const small = g.small.slice();
    for (const m of legalMoves(g)) applyMove(g, m);
    expect(g.cells).toEqual(cells);
    expect(g.small).toEqual(small);
  });
});

describe('exact search on endgames', () => {
  /** Replay a seeded random game on both implementations until at most `left` playable cells remain. */
  const endgame = (seed: number, left: number): { eg: Game; og: OG } | null => {
    const rng = mulberry32(seed);
    let og = oNew();
    let eg = newGame();
    for (;;) {
      if (eg.over) return null;
      let remaining = 0;
      for (let b = 0; b < 9; b++) if (eg.small[b] === 0) for (let s = 0; s < 9; s++) if (eg.cells[b * 9 + s] === 0) remaining++;
      if (remaining <= left) return { eg, og };
      const ms = legalMoves(eg);
      const m = ms[Math.floor(rng() * ms.length)];
      eg = playLegal(eg, m);
      og = oPlay(og, fromCell(m));
    }
  };
  it('full-depth alpha-beta says win, draw or loss exactly as exhaustive minimax does, on 40 endgames', () => {
    let checked = 0;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 600 && checked < 40; seed++) {
      const e = endgame(seed, 9);
      if (!e) continue;
      same(e.eg, e.og, `seed ${seed}`);
      const budget: Budget = { nodes: 0, limit: 50_000_000, aborted: false };
      const v = negamax(e.eg, 100, -Infinity, Infinity, budget);
      expect(budget.aborted).toBe(false);
      const sign = v > WIN_SCORE - 200 ? 1 : v < -WIN_SCORE + 200 ? -1 : 0;
      expect(sign, `seed ${seed}`).toBe(oSolve(e.og) || 0);
      seen.add(sign);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(30);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  }, 120_000);
  it('a pruned search returns exactly what an unpruned search returns for a fixed depth', () => {
    const plain = (g: Game, depth: number, ply: number): number => {
      if (g.over) return g.winner === 0 ? 0 : g.winner === g.toMove ? WIN_SCORE - ply : -WIN_SCORE + ply;
      if (depth <= 0) return evaluate(g);
      let best = -Infinity;
      for (const m of legalMoves(g)) best = Math.max(best, -plain(playLegal(g, m), depth - 1, ply + 1));
      return best;
    };
    for (let seed = 1; seed <= 8; seed++) {
      const rng = mulberry32(seed + 77);
      let g = newGame();
      for (let i = 0; i < 6 + seed; i++) { const ms = legalMoves(g); g = playLegal(g, ms[Math.floor(rng() * ms.length)]); }
      for (const depth of [1, 2, 3]) {
        const budget: Budget = { nodes: 0, limit: 50_000_000, aborted: false };
        expect(negamax(g, depth, -Infinity, Infinity, budget), `seed ${seed} depth ${depth}`).toBe(plain(g, depth, 0));
      }
    }
  }, 60_000);
  it('stops at its node budget and says so', () => {
    const budget: Budget = { nodes: 0, limit: 100, aborted: false };
    negamax(newGame(), 10, -Infinity, Infinity, budget);
    expect(budget.aborted).toBe(true);
    expect(budget.nodes).toBeLessThanOrEqual(101);
  });
});

describe('computer players', () => {
  const levels: Level[] = ['easy', 'medium', 'hard'];
  const duel = (a: Level, b: Level, games: number, seedBase: number): { aWins: number; bWins: number; draws: number } => {
    let aWins = 0; let bWins = 0; let draws = 0;
    for (let k = 0; k < games; k++) {
      const rng = mulberry32(seedBase + k);
      const aSide: Side = k % 2 === 0 ? CROSS : RING;
      let g = newGame();
      while (!g.over) {
        const m = chooseMove(g, g.toMove === aSide ? a : b, rng);
        g = applyMove(g, m) ?? (() => { throw new Error('illegal move chosen'); })();
      }
      if (g.winner === 0) draws++; else if (g.winner === aSide) aWins++; else bWins++;
    }
    return { aWins, bWins, draws };
  };

  it('returns -1 when the game is over and the only move when there is one', () => {
    const over = { ...newGame(), over: true };
    for (const l of levels) expect(chooseMove(over, l, mulberry32(1))).toBe(-1);
    const cells = new Int8Array(81).fill(CROSS);
    cells[7] = 0;
    const small = new Int8Array(9).fill(DRAWN);
    small[0] = 0;
    const one: Game = { ...newGame(), cells, small, forced: 0, toMove: RING };
    for (const l of levels) expect(chooseMove(one, l, mulberry32(1))).toBe(7);
  });
  it('always plays a legal move at every level over many positions', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed + 600);
      let g = newGame();
      for (let i = 0; i < 70 && !g.over; i++) {
        const ms = legalMoves(g);
        for (const l of levels) {
          if (i % 9 === seed % 9) expect(ms).toContain(chooseMove(g, l, mulberry32(seed * 31 + i)));
        }
        g = playLegal(g, ms[Math.floor(rng() * ms.length)]);
      }
    }
  }, 120_000);
  it('is deterministic for a seed and Easy varies with the seed', () => {
    const g = playLegal(playLegal(newGame(), 40), 38);
    for (const l of levels) expect(chooseMove(g, l, mulberry32(5))).toBe(chooseMove(g, l, mulberry32(5)));
    const seen = new Set<number>();
    for (let s = 1; s <= 60; s++) seen.add(chooseMove(newGame(), 'easy', mulberry32(s)));
    expect(seen.size).toBeGreaterThan(20);
  });
  it('Medium and Hard take a game-winning move and block a game-losing one', () => {
    // Cross owns boards 0 and 1; a third board in the top row (board 2) is one move from won.
    const small = new Int8Array(9);
    small[0] = CROSS; small[1] = CROSS;
    const cells = new Int8Array(81);
    cells[2 * 9 + 3] = CROSS; cells[2 * 9 + 4] = CROSS;
    const win: Game = { ...newGame(), small, cells, forced: 2, toMove: CROSS };
    for (const l of ['medium', 'hard'] as Level[]) expect(chooseMove(win, l, mulberry32(3))).toBe(2 * 9 + 5);
    // Same position with Ring to move: Ring must occupy cell 2*9+5 to stop it.
    const block: Game = { ...win, toMove: RING };
    for (const l of ['medium', 'hard'] as Level[]) expect(chooseMove(block, l, mulberry32(3))).toBe(2 * 9 + 5);
  });
  it('Hard beats Easy in at least 5 of 6 games, never losing one, and Medium beats Easy in at least 5 of 6', () => {
    const h = duel('hard', 'easy', 6, 100);
    expect(h.aWins).toBeGreaterThanOrEqual(5);
    expect(h.bWins).toBe(0);
    const m = duel('medium', 'easy', 6, 200);
    expect(m.aWins).toBeGreaterThanOrEqual(5);
  }, 240_000);
  it('the budgets are fixed numbers and the slowest Hard move stays under 2.5 s', () => {
    expect(HARD_NODES).toBe(90000);
    expect(MEDIUM_NODES).toBe(12000);
    expect(MEDIUM_DEPTH).toBe(4);
    expect(HARD_MAX_DEPTH).toBe(14);
    let worst = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const rng = mulberry32(seed + 50);
      let g = newGame();
      for (let i = 0; i < 60 && !g.over; i++) {
        if (i % 12 === 0) {
          const t = performance.now();
          searchMove(g, HARD_MAX_DEPTH, HARD_NODES, mulberry32(seed));
          worst = Math.max(worst, performance.now() - t);
        }
        const ms = legalMoves(g);
        g = playLegal(g, ms[Math.floor(rng() * ms.length)]);
      }
    }
    expect(worst).toBeLessThan(2500);
  }, 120_000);
});

describe('undo count', () => {
  it('takes back the person\'s last move and the replies, or one move for two people', () => {
    expect(undoCount([], CROSS)).toBe(0);
    expect(undoCount([RING], CROSS)).toBe(0);
    expect(undoCount([CROSS, RING], CROSS)).toBe(2);
    expect(undoCount([CROSS, RING, CROSS, RING], RING)).toBe(1);
    expect(undoCount([CROSS], null)).toBe(1);
    expect(undoCount([], null)).toBe(0);
  });
});
