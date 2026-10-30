/**
 * games-four-in-a-row.test.ts - the engine behind `four-in-a-row`.
 *
 * Pinned: there are exactly 69 winning lines and every one is detected with its
 * four cells, gravity and full-column rules hold, a finished game accepts no more
 * moves, the computer takes a win and blocks a loss at every depth, alpha-beta
 * pruning never changes a search value, seeded play is reproducible, thousands of
 * moves of self-play keep the board consistent, and a depth-7 move is fast enough
 * to run on the main thread.
 */
import { describe, it, expect } from 'vitest';
import {
  COLS, ROWS, CELLS, WINDOWS, LEVELS, idx, rowOf, colOf, other, emptyBoard, boardFromRows, boardToRows, countDiscs,
  freeInColumn, playerToMove, winner, describeLine, isDraw, legalColumns, drop, scoreMoves, bestMove, chooseMove,
  applyResult, scoreResult, nearestOpenColumn, UNDO_NOTE, mulberry32, type Board, type Player,
} from '../src/components/apps-private/four-in-a-row/helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = (name: string): string => readFileSync(join(process.cwd(), 'src/components/apps-private/four-in-a-row', name), 'utf8');

// ── helpers local to the tests ──────────────────────────────────────────────

/** A plain four-in-a-row check written separately from the engine, to compare against it. */
const referenceWinner = (b: Board): Player | null => {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r * COLS + c];
      if (!p) continue;
      for (const [dr, dc] of dirs) {
        let n = 1;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr * COLS + cc] !== p) break;
          n++;
        }
        if (n === 4) return p as Player;
      }
    }
  }
  return null;
};

const mirror = (b: Board): Board => {
  const m = emptyBoard();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) m[idx(r, COLS - 1 - c)] = b[idx(r, c)];
  return m;
};

/** Random legal play for `plies` moves (stops early on a win or a full board). Player 1 moves first. */
const randomPosition = (rng: () => number, plies: number): { board: Board; toMove: Player } => {
  let board = emptyBoard();
  let toMove: Player = 1;
  for (let i = 0; i < plies; i++) {
    const legal = legalColumns(board);
    if (!legal.length) break;
    const r = drop(board, legal[Math.floor(rng() * legal.length)], toMove)!;
    board = r.board;
    if (winner(board)) break;
    toMove = other(toMove);
  }
  return { board, toMove };
};

type Mover = (b: Board, p: Player) => number;
const randomMover = (rng: () => number): Mover => (b) => {
  const legal = legalColumns(b);
  return legal[Math.floor(rng() * legal.length)];
};

/** Play a whole game. Returns the winner (or 0 for a draw) and the number of discs played. */
const playGame = (first: Mover, second: Mover): { winner: 0 | Player; moves: number } => {
  let board = emptyBoard();
  let p: Player = 1;
  for (let i = 0; i < CELLS; i++) {
    const col = (p === 1 ? first : second)(board, p);
    board = drop(board, col, p)!.board;
    const w = winner(board);
    if (w) return { winner: w.player, moves: i + 1 };
    p = other(p);
  }
  return { winner: 0, moves: CELLS };
};

// A full board with no four in a row (21 discs each).
const DRAW_ROWS = ['XXXOXXX', 'XXXOXXX', 'XXOXOOO', 'OOOXOXO', 'XOOOXOO', 'OOXOOOX'];

// ── geometry and codec ──────────────────────────────────────────────────────

describe('geometry', () => {
  it('has 69 winning lines: 24 horizontal, 21 vertical, 24 diagonal', () => {
    expect(WINDOWS).toHaveLength(69);
    const kinds = WINDOWS.map((w) => describeLine(w));
    expect(kinds.filter((k) => k === 'horizontal')).toHaveLength(24);
    expect(kinds.filter((k) => k === 'vertical')).toHaveLength(21);
    expect(kinds.filter((k) => k === 'diagonal')).toHaveLength(24);
  });
  it('every line is four distinct, evenly spaced cells on the board', () => {
    for (const w of WINDOWS) {
      expect(new Set(w).size).toBe(4);
      const dr = rowOf(w[1]) - rowOf(w[0]);
      const dc = colOf(w[1]) - colOf(w[0]);
      expect(Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0)).toBe(true);
      for (let k = 1; k < 4; k++) {
        expect(rowOf(w[k]) - rowOf(w[k - 1])).toBe(dr);
        expect(colOf(w[k]) - colOf(w[k - 1])).toBe(dc);
      }
      w.forEach((i) => expect(i >= 0 && i < CELLS).toBe(true));
    }
  });
  it('the corner cell sits in 3 lines and the board holds 276 cell slots in total', () => {
    expect(WINDOWS.filter((w) => w.includes(idx(5, 0)))).toHaveLength(3);
    expect(WINDOWS.reduce((n, w) => n + w.length, 0)).toBe(276);
  });
});

describe('board helpers', () => {
  it('round-trips between rows of text and a board, top row first', () => {
    const rows = ['.......', '.......', '.......', '...X...', '..XO...', '.XOOX..'];
    const b = boardFromRows(rows);
    expect(boardToRows(b)).toEqual(rows);
    expect(b[idx(5, 1)]).toBe(1);
    expect(b[idx(5, 2)]).toBe(2);
    expect(countDiscs(b)).toBe(7);
  });
  it('rejects a board of the wrong shape', () => {
    expect(() => boardFromRows(['.......'])).toThrow();
    expect(() => boardFromRows(Array(6).fill('......'))).toThrow();
  });
  it('counts free cells per column and ignores bad columns', () => {
    const b = boardFromRows(['.......', '.......', '.X.....', '.O.....', '.X.....', '.O.....']);
    expect(freeInColumn(b, 1)).toBe(2);
    expect(freeInColumn(b, 0)).toBe(6);
    expect(freeInColumn(b, -1)).toBe(0);
    expect(freeInColumn(b, 7)).toBe(0);
    expect(freeInColumn(b, 1.5)).toBe(0);
  });
  it('says whose turn it is from the disc count and who started', () => {
    expect(playerToMove(emptyBoard())).toBe(1);
    expect(playerToMove(drop(emptyBoard(), 3, 1)!.board)).toBe(2);
    expect(playerToMove(drop(emptyBoard(), 3, 1)!.board, 2)).toBe(1);
  });
});

// ── dropping discs ──────────────────────────────────────────────────────────

describe('drop', () => {
  it('lands on the bottom row, then stacks upward, without changing the input', () => {
    const b0 = emptyBoard();
    const a = drop(b0, 4, 1)!;
    expect(a.row).toBe(5);
    expect(a.board[idx(5, 4)]).toBe(1);
    expect(countDiscs(b0)).toBe(0);
    const b = drop(a.board, 4, 2)!;
    expect(b.row).toBe(4);
    expect(b.board[idx(4, 4)]).toBe(2);
    expect(b.board[idx(5, 4)]).toBe(1);
    expect(countDiscs(a.board)).toBe(1);
  });
  it('fills a column in six drops and then refuses a seventh', () => {
    let b = emptyBoard();
    for (let i = 0; i < 6; i++) {
      const r = drop(b, 0, (i % 2 === 0 ? 1 : 2));
      expect(r).not.toBeNull();
      expect(r!.row).toBe(5 - i);
      b = r!.board;
    }
    expect(freeInColumn(b, 0)).toBe(0);
    expect(drop(b, 0, 1)).toBeNull();
    expect(legalColumns(b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('rejects columns and players that do not exist', () => {
    const b = emptyBoard();
    for (const col of [-1, 7, 3.5, NaN, Infinity]) expect(drop(b, col, 1)).toBeNull();
    for (const p of [0, 3, -1, NaN]) expect(drop(b, 3, p)).toBeNull();
  });
  it('refuses any move once someone has four', () => {
    let b = emptyBoard();
    for (let c = 0; c < 4; c++) b = drop(b, c, 1)!.board;
    expect(winner(b)).not.toBeNull();
    for (let c = 0; c < COLS; c++) expect(drop(b, c, 2)).toBeNull();
    expect(legalColumns(b)).toEqual([]);
  });
});

// ── winning ─────────────────────────────────────────────────────────────────

describe('winner', () => {
  it('finds nothing on an empty board', () => {
    expect(winner(emptyBoard())).toBeNull();
  });
  it('detects every one of the 69 lines for either player and returns exactly its four cells', () => {
    for (const w of WINDOWS) {
      for (const p of [1, 2] as Player[]) {
        const b = emptyBoard();
        for (const i of w) b[i] = p;
        const r = winner(b);
        expect(r?.player).toBe(p);
        expect(r?.cells).toEqual(w);
        expect(referenceWinner(b)).toBe(p);
      }
    }
  });
  it('detects horizontal wins at both edges, vertical wins at both walls and diagonals in the corners', () => {
    expect(winner(boardFromRows(['.......', '.......', '.......', '.......', '.......', 'XXXX...']))?.cells).toEqual([35, 36, 37, 38]);
    expect(winner(boardFromRows(['.......', '.......', '.......', '.......', '.......', '...OOOO']))?.player).toBe(2);
    expect(winner(boardFromRows(['.......', '.......', 'X......', 'X......', 'X......', 'X......']))?.cells).toEqual([14, 21, 28, 35]);
    expect(winner(boardFromRows(['......O', '......O', '......O', '......O', '.......', '.......']))?.cells).toEqual([6, 13, 20, 27]);
    expect(winner(boardFromRows(['.......', '.......', 'X......', '.X.....', '..X....', '...X...']))?.cells).toEqual([14, 22, 30, 38]);
    expect(winner(boardFromRows(['.......', '.......', '...O...', '..O....', '.O.....', 'O......']))?.cells).toEqual([17, 23, 29, 35]);
  });
  it('does not call three in a row, or a broken four, a win', () => {
    expect(winner(boardFromRows(['.......', '.......', '.......', '.......', '.......', 'XXX....']))).toBeNull();
    expect(winner(boardFromRows(['.......', '.......', '.......', '.......', '.......', 'XXOXX..']))).toBeNull();
    expect(winner(boardFromRows(['.......', '.......', '.......', 'X......', 'X......', 'X.....X']))).toBeNull();
    expect(winner(boardFromRows(['.......', '.......', '.......', '...X...', '..X....', '.X.....']))).toBeNull();
  });
  it('does not let a line wrap from the end of one row to the start of the next', () => {
    // Cells 4,5,6 end the top row and cell 7 starts the next: four neighbours in memory, not on the board.
    const b = boardFromRows(['....XXX', 'X......', '.......', '.......', '.......', '.......']);
    expect(winner(b)).toBeNull();
    const c = boardFromRows(['.......', '.......', '.......', '.......', '.....XX', 'XX.....']);
    expect(winner(c)).toBeNull();
  });
  it('reports a line of five or more as a win by that player', () => {
    const r = winner(boardFromRows(['.......', '.......', '.......', '.......', '.......', 'XXXXX..']));
    expect(r?.player).toBe(1);
    expect(r?.cells).toHaveLength(4);
  });
  it('describes a winning line by its direction', () => {
    expect(describeLine([35, 36, 37, 38])).toBe('horizontal');
    expect(describeLine([14, 21, 28, 35])).toBe('vertical');
    expect(describeLine([14, 22, 30, 38])).toBe('diagonal');
    expect(describeLine([17, 23, 29, 35])).toBe('diagonal');
  });
});

describe('draw', () => {
  it('recognises a full board with no four as a draw', () => {
    const b = boardFromRows(DRAW_ROWS);
    expect(countDiscs(b)).toBe(CELLS);
    expect(winner(b)).toBeNull();
    expect(referenceWinner(b)).toBeNull();
    expect(isDraw(b)).toBe(true);
    expect(legalColumns(b)).toEqual([]);
    for (let c = 0; c < COLS; c++) expect(drop(b, c, 1)).toBeNull();
  });
  it('is not a draw while a column has room, and not a draw when the last disc wins', () => {
    expect(isDraw(emptyBoard())).toBe(false);
    const almost = boardFromRows(DRAW_ROWS);
    almost[0] = 0; // open the top of column 0
    expect(isDraw(almost)).toBe(false);
    expect(legalColumns(almost)).toEqual([0]);
    const full = boardFromRows(['XXXXOXO', 'OOXOXOX', 'XXOXOXO', 'OOXOXOX', 'XOXOXOX', 'OXOXOXO']);
    expect(countDiscs(full)).toBe(CELLS);
    expect(winner(full)).not.toBeNull();
    expect(isDraw(full)).toBe(false);
  });
});

// ── the computer ────────────────────────────────────────────────────────────

describe('computer: takes a win', () => {
  const horizontal = boardFromRows(['.......', '.......', '.......', '.......', 'O......', 'XXX.OO.']);
  const vertical = boardFromRows(['.......', '.......', '.......', '.X.....', '.X.....', '.X..OOO']);
  const diagonal = boardFromRows(['.......', '.......', '.......', '..XO...', '.XOX...', 'XOOO..X']);
  // The last two also give the opponent a threat, so winning must beat blocking.
  const cases: [string, Board, number][] = [
    ['horizontally', horizontal, 3],
    ['vertically, ahead of blocking a threat', vertical, 1],
    ['along a diagonal, ahead of blocking a threat', diagonal, 3],
    ['along the mirrored diagonal', mirror(diagonal), 3],
    ['along the mirrored row', mirror(horizontal), 3],
  ];
  for (const [name, board, col] of cases) {
    for (const depth of [1, 2, 4, 7]) {
      it(`wins ${name} at depth ${depth}`, () => {
        expect(bestMove(board, 1, depth, mulberry32(depth))).toBe(col);
      });
    }
  }
  it('wins for the second player too, at every depth', () => {
    const b = boardFromRows(['.......', '.......', '.......', '.......', 'X.X....', 'OOO.X..']);
    for (const depth of [1, 2, 4, 7]) expect(bestMove(b, 2, depth, mulberry32(depth))).toBe(3);
  });
  it('prefers a win now over a bigger plan later', () => {
    const b = boardFromRows(['.......', '.......', '.......', '.......', 'O.O....', 'XXX.O..']);
    expect(bestMove(b, 1, 5, mulberry32(1))).toBe(3);
  });
});

describe('computer: blocks a loss', () => {
  const horizontal = boardFromRows(['.......', '.......', '.......', '.......', 'X......', 'OOO.X.X']);
  const vertical = boardFromRows(['.......', '.......', '.......', '..O....', '..O....', 'XXO..X.']);
  const diagonal = boardFromRows(['.......', '.......', '.......', '..OX...', '.OXX...', 'OXXO...']);
  const cases: [string, Board, number][] = [
    ['a row', horizontal, 3],
    ['a column', vertical, 2],
    ['a diagonal', diagonal, 3],
    ['the mirrored diagonal', mirror(diagonal), 3],
    ['the mirrored row', mirror(horizontal), 3],
  ];
  for (const [name, board, col] of cases) {
    for (const depth of [1, 2, 3, 5]) {
      it(`blocks ${name} at depth ${depth}`, () => {
        expect(bestMove(board, 1, depth, mulberry32(depth + 9))).toBe(col);
      });
    }
  }
  it('blocks for the second player too', () => {
    const b = boardFromRows(['.......', '.......', '.......', '.......', '.O.....', 'XXX.O..']);
    expect(bestMove(b, 2, 2, mulberry32(4))).toBe(3);
  });
});

describe('computer: looks ahead', () => {
  it('sees a double threat three plies away and builds an open three', () => {
    const b = boardFromRows(['.......', '.......', '.......', '.......', '..OO...', '..XX...']);
    for (const depth of [3, 4, 5]) expect([1, 4]).toContain(bestMove(b, 1, depth, mulberry32(depth)));
    // That is a forced win: every other move scores far below it.
    const scores = scoreMoves(b, 1, 3);
    const top = Math.max(...scores.map((s) => s.score));
    expect(top).toBeGreaterThan(90000);
    expect(scores.filter((s) => s.score === top).map((s) => s.col).sort()).toEqual([1, 4]);
  });
  it('scores a lost position as a large negative number', () => {
    // O has an open three on the bottom row and X cannot stop both ends.
    const b = boardFromRows(['.......', '.......', '.......', '.......', '.X.X...', '.OOO...']);
    const best = Math.max(...scoreMoves(b, 1, 3).map((s) => s.score));
    expect(best).toBeLessThan(-90000);
  });
  it('opens in the centre column at every level', () => {
    for (const depth of [1, 4, 7]) expect(bestMove(emptyBoard(), 1, depth, mulberry32(depth))).toBe(3);
  });
});

describe('computer: legality', () => {
  it('never returns a full or out-of-range column', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      const { board, toMove } = randomPosition(rng, 8 + Math.floor(rng() * 28));
      if (winner(board) || !legalColumns(board).length) continue;
      for (const depth of [1, 2, 3, 4]) {
        const col = bestMove(board, toMove, depth, rng);
        expect(legalColumns(board)).toContain(col);
        expect(drop(board, col, toMove)).not.toBeNull();
      }
      for (const level of ['easy', 'medium', 'hard'] as const) {
        if (level === 'hard' && seed % 5 !== 0) continue; // depth 7 is covered in the timing tests
        expect(legalColumns(board)).toContain(chooseMove(board, toMove, level, rng));
      }
    }
  });
  it('plays the only open column when there is just one', () => {
    const b = boardFromRows(DRAW_ROWS);
    b[4] = 0; // only column 4 has room
    for (const depth of [1, 3, 7]) expect(bestMove(b, 1, depth, mulberry32(2))).toBe(4);
  });
  it('returns -1 when there is nothing to play', () => {
    expect(bestMove(boardFromRows(DRAW_ROWS), 1, 4, mulberry32(1))).toBe(-1);
    const won = boardFromRows(['.......', '.......', '.......', '.......', '.......', 'XXXX...']);
    expect(bestMove(won, 2, 4, mulberry32(1))).toBe(-1);
    expect(chooseMove(won, 2, 'hard', mulberry32(1))).toBe(-1);
    expect(chooseMove(boardFromRows(DRAW_ROWS), 1, 'easy', mulberry32(1))).toBe(-1);
    expect(bestMove(emptyBoard(), 3 as unknown as Player, 4, mulberry32(1))).toBe(-1);
    expect(bestMove(new Uint8Array(5), 1, 4, mulberry32(1))).toBe(-1);
  });
  it('treats a silly depth as depth 1 or a sane cap instead of failing', () => {
    for (const d of [0, -3, NaN, 1.9]) expect(legalColumns(emptyBoard())).toContain(bestMove(emptyBoard(), 1, d, mulberry32(1)));
  });
});

describe('computer: alpha-beta pruning is exact', () => {
  it('gives the same value for every column with and without pruning', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const rng = mulberry32(seed * 7);
      const { board, toMove } = randomPosition(rng, 6 + Math.floor(rng() * 24));
      if (winner(board) || !legalColumns(board).length) continue;
      for (const depth of [2, 3, 4]) {
        expect(scoreMoves(board, toMove, depth, true), `seed ${seed} depth ${depth}`).toEqual(scoreMoves(board, toMove, depth, false));
      }
    }
  });
  it('bestMove always picks one of the columns with the top full-search value', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed * 13);
      const { board, toMove } = randomPosition(rng, 4 + Math.floor(rng() * 26));
      if (winner(board) || !legalColumns(board).length) continue;
      for (const depth of [2, 3, 4]) {
        const scores = scoreMoves(board, toMove, depth, false);
        const top = Math.max(...scores.map((s) => s.score));
        const allowed = scores.filter((s) => s.score === top).map((s) => s.col);
        expect(allowed, `seed ${seed} depth ${depth}`).toContain(bestMove(board, toMove, depth, mulberry32(seed + depth)));
      }
    }
  });
  it('scoreMoves lists exactly the legal columns', () => {
    const b = boardFromRows(DRAW_ROWS);
    b[2] = 0;
    b[5] = 0;
    expect(scoreMoves(b, 1, 3).map((s) => s.col).sort()).toEqual([2, 5]);
    expect(scoreMoves(boardFromRows(DRAW_ROWS), 1, 3)).toEqual([]);
  });
});

describe('computer: seeded randomness', () => {
  it('gives the same move for the same seed, across many positions', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { board, toMove } = randomPosition(mulberry32(seed), 5 + (seed % 20));
      if (winner(board) || !legalColumns(board).length) continue;
      for (const depth of [1, 3]) {
        expect(bestMove(board, toMove, depth, mulberry32(99))).toBe(bestMove(board, toMove, depth, mulberry32(99)));
      }
      expect(chooseMove(board, toMove, 'easy', mulberry32(5))).toBe(chooseMove(board, toMove, 'easy', mulberry32(5)));
    }
  });
  it('breaks ties with the rng and only among equally good columns', () => {
    let found = 0;
    for (let seed = 1; seed <= 300 && found < 3; seed++) {
      const rng = mulberry32(seed);
      const { board, toMove } = randomPosition(rng, 2 + Math.floor(rng() * 6));
      if (winner(board) || !legalColumns(board).length) continue;
      const scores = scoreMoves(board, toMove, 1, false);
      const top = Math.max(...scores.map((s) => s.score));
      const tied = scores.filter((s) => s.score === top).map((s) => s.col);
      if (tied.length < 2 || top > 90000) continue;
      found++;
      const seen = new Set<number>();
      for (let s = 1; s <= 60; s++) seen.add(bestMove(board, toMove, 1, mulberry32(s)));
      expect([...seen].every((c) => tied.includes(c))).toBe(true);
      expect(seen.size).toBeGreaterThan(1);
    }
    expect(found).toBeGreaterThan(0);
  });
  it('rng values at the very edge of [0, 1) still give a legal column', () => {
    const b = emptyBoard();
    expect(legalColumns(b)).toContain(bestMove(b, 1, 1, () => 0));
    expect(legalColumns(b)).toContain(bestMove(b, 1, 1, () => 0.9999999999));
    expect(legalColumns(b)).toContain(chooseMove(b, 1, 'easy', () => 0.9999999999));
    expect(legalColumns(b)).toContain(chooseMove(b, 1, 'easy', () => 0));
  });
  it('mulberry32 repeats for a seed and stays inside [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});

describe('difficulty levels', () => {
  it('looks 1, 4 and 7 moves ahead, and only Easy ever plays at random', () => {
    expect(LEVELS.easy.depth).toBe(1);
    expect(LEVELS.medium.depth).toBe(4);
    expect(LEVELS.hard.depth).toBe(7);
    expect(LEVELS.easy.randomChance).toBe(0.25);
    expect(LEVELS.medium.randomChance).toBe(0);
    expect(LEVELS.hard.randomChance).toBe(0);
  });
  it('Easy sometimes ignores the search and plays a random legal column', () => {
    // First draw 0.1 is under the random-move chance, the second picks the first legal column.
    const seq = [0.1, 0];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    expect(chooseMove(emptyBoard(), 1, 'easy', rng)).toBe(0);
    // A draw above the chance falls through to the search, which opens in the centre.
    expect(chooseMove(emptyBoard(), 1, 'easy', () => 0.9)).toBe(3);
  });
  it('Medium and Hard never roll for a random move', () => {
    let calls = 0;
    const rng = () => { calls++; return 0.5; };
    const b = boardFromRows(['.......', '.......', '.......', '.......', '.......', 'XXX.OO.']);
    expect(chooseMove(b, 1, 'medium', rng)).toBe(3);
    expect(calls).toBe(0);
  });
  it('an unknown level falls back to Medium', () => {
    expect(legalColumns(emptyBoard())).toContain(chooseMove(emptyBoard(), 1, 'nonsense' as never, mulberry32(1)));
  });
});

describe('strength', () => {
  it('Medium beats a random player in nearly every game, from either seat', () => {
    let wins = 0;
    let losses = 0;
    const games = 16;
    for (let g = 0; g < games; g++) {
      const rng = mulberry32(1000 + g);
      const ai: Mover = (b, p) => chooseMove(b, p, 'medium', rng);
      const rnd = randomMover(mulberry32(2000 + g));
      const aiFirst = g % 2 === 0;
      const r = playGame(aiFirst ? ai : rnd, aiFirst ? rnd : ai);
      const aiSeat = aiFirst ? 1 : 2;
      if (r.winner === aiSeat) wins++;
      else if (r.winner !== 0) losses++;
    }
    expect(wins).toBeGreaterThanOrEqual(games - 1);
    expect(losses).toBe(0);
  });
  it('Medium wins more than it loses against Easy', () => {
    let medium = 0;
    let easy = 0;
    const games = 12;
    for (let g = 0; g < games; g++) {
      const m = mulberry32(300 + g);
      const e = mulberry32(400 + g);
      const mediumMover: Mover = (b, p) => chooseMove(b, p, 'medium', m);
      const easyMover: Mover = (b, p) => chooseMove(b, p, 'easy', e);
      const mediumFirst = g % 2 === 0;
      const r = playGame(mediumFirst ? mediumMover : easyMover, mediumFirst ? easyMover : mediumMover);
      if (r.winner === 0) continue;
      if ((r.winner === 1) === mediumFirst) medium++; else easy++;
    }
    expect(medium).toBeGreaterThan(easy);
  });
});

// ── self-play fuzz ──────────────────────────────────────────────────────────

describe('self-play fuzz', () => {
  const checkGame = (movers: [Mover, Mover]): { winner: 0 | Player; moves: number } => {
    let board = emptyBoard();
    let p: Player = 1;
    let n1 = 0;
    let n2 = 0;
    for (let ply = 0; ply < CELLS; ply++) {
      const before = board.slice();
      const legal = legalColumns(board);
      expect(legal.length).toBeGreaterThan(0);
      const col = movers[p - 1](board, p);
      expect(legal).toContain(col);
      const r = drop(board, col, p)!;
      expect(r).not.toBeNull();
      // The old board is untouched, exactly one cell changed, and it is the lowest empty one in the column.
      expect(board).toEqual(before);
      const changed = [...r.board].map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
      expect(changed).toEqual([idx(r.row, col)]);
      expect(r.board[idx(r.row, col)]).toBe(p);
      for (let rr = r.row + 1; rr < ROWS; rr++) expect(r.board[idx(rr, col)]).not.toBe(0); // supported from below
      for (let rr = 0; rr < r.row; rr++) expect(r.board[idx(rr, col)]).toBe(0); // nothing floating above
      board = r.board;
      if (p === 1) n1++; else n2++;
      expect(countDiscs(board)).toBe(ply + 1);
      expect(n1 - n2 === 0 || n1 - n2 === 1).toBe(true);
      expect(board.filter((v) => v === 1)).toHaveLength(n1);
      expect(board.filter((v) => v === 2)).toHaveLength(n2);
      // The engine agrees with the separate reference check on every position.
      const w = winner(board);
      expect(w?.player ?? null).toBe(referenceWinner(board));
      if (w) {
        expect(w.player).toBe(p); // only the mover can have just completed a line
        expect(w.cells.every((i) => board[i] === p)).toBe(true);
        expect(legalColumns(board)).toEqual([]);
        for (let c = 0; c < COLS; c++) expect(drop(board, c, other(p))).toBeNull();
        expect(isDraw(board)).toBe(false);
        return { winner: p, moves: ply + 1 };
      }
      p = other(p);
    }
    expect(countDiscs(board)).toBe(CELLS);
    expect(isDraw(board)).toBe(true);
    expect(legalColumns(board)).toEqual([]);
    return { winner: 0, moves: CELLS };
  };

  it('240 random games stay consistent from the first disc to the last', () => {
    let wins1 = 0;
    let wins2 = 0;
    let draws = 0;
    for (let g = 0; g < 240; g++) {
      const a = randomMover(mulberry32(g * 2 + 1));
      const b = randomMover(mulberry32(g * 2 + 2));
      const r = checkGame([a, b]);
      expect(r.moves).toBeGreaterThanOrEqual(7);
      if (r.winner === 1) wins1++; else if (r.winner === 2) wins2++; else draws++;
    }
    expect(wins1 + wins2 + draws).toBe(240);
    expect(wins1).toBeGreaterThan(0);
    expect(wins2).toBeGreaterThan(0);
  }, 60000);
  it('40 games of the computer against random play stay consistent, and a finished game is never extended', () => {
    for (let g = 0; g < 40; g++) {
      const rng = mulberry32(5000 + g);
      const ai: Mover = (b, p) => bestMove(b, p, 2 + (g % 3), rng);
      const rnd = randomMover(mulberry32(6000 + g));
      checkGame(g % 2 === 0 ? [ai, rnd] : [rnd, ai]);
    }
  }, 60000);
  it('20 computer-versus-computer games at different depths finish legally', () => {
    for (let g = 0; g < 20; g++) {
      const r1 = mulberry32(7000 + g);
      const r2 = mulberry32(8000 + g);
      checkGame([(b, p) => bestMove(b, p, 1 + (g % 4), r1), (b, p) => bestMove(b, p, 3, r2)]);
    }
  }, 60000);
});

// ── speed ───────────────────────────────────────────────────────────────────

describe('speed', () => {
  it('a depth-7 move takes well under the bound on several positions, from empty to crowded', () => {
    const positions: { board: Board; toMove: Player }[] = [{ board: emptyBoard(), toMove: 1 }];
    for (const plies of [6, 10, 14, 18, 22, 26]) {
      for (let seed = 100; seed < 400; seed++) {
        const pos = randomPosition(mulberry32(seed), plies);
        if (countDiscs(pos.board) === plies && !winner(pos.board)) { positions.push(pos); break; }
      }
    }
    expect(positions.length).toBe(7);
    let worst = 0;
    for (const { board, toMove } of positions) {
      const t = performance.now();
      const col = bestMove(board, toMove, LEVELS.hard.depth, mulberry32(1));
      const ms = performance.now() - t;
      worst = Math.max(worst, ms);
      expect(legalColumns(board)).toContain(col);
      expect(ms).toBeLessThan(5000); // generous: it is typically a small fraction of a second
    }
    expect(worst).toBeLessThan(5000);
  });
  it('a whole Hard-versus-Medium game stays fast enough to play interactively', () => {
    const r1 = mulberry32(21);
    const r2 = mulberry32(22);
    const t = performance.now();
    const r = playGame((b, p) => chooseMove(b, p, 'hard', r1), (b, p) => chooseMove(b, p, 'medium', r2));
    expect(performance.now() - t).toBeLessThan(60000);
    expect(r.moves).toBeGreaterThanOrEqual(7);
  });
});

// ── streaks ─────────────────────────────────────────────────────────────────

describe('streaks', () => {
  it('a win extends the streak, a loss ends it and a draw leaves it alone', () => {
    expect(applyResult(0, 'win')).toBe(1);
    expect(applyResult(4, 'win')).toBe(5);
    expect(applyResult(4, 'loss')).toBe(0);
    expect(applyResult(4, 'draw')).toBe(4);
    expect(applyResult(0, 'draw')).toBe(0);
  });
  it('survives bad input', () => {
    expect(applyResult(NaN, 'win')).toBe(1);
    expect(applyResult(-3, 'draw')).toBe(0);
    expect(applyResult(Infinity, 'win')).toBe(1);
    expect(applyResult(2.7, 'win')).toBe(3);
  });
});

describe('a game that used Undo is not counted', () => {
  it('leaves the streak and the best alone, whatever the result', () => {
    expect(scoreResult(3, 5, 'win', true)).toEqual({ streak: 3, best: 5, counted: false });
    expect(scoreResult(3, 5, 'loss', true)).toEqual({ streak: 3, best: 5, counted: false });
    expect(scoreResult(4, 4, 'win', true)).toEqual({ streak: 4, best: 4, counted: false });
    expect(UNDO_NOTE).toBe('You used Undo, so this game is not counted.');
  });
  it('counts an ordinary game: a win extends both streaks, a loss resets the streak but keeps the best, a draw changes nothing', () => {
    expect(scoreResult(4, 4, 'win', false)).toEqual({ streak: 5, best: 5, counted: true });
    expect(scoreResult(2, 7, 'win', false)).toEqual({ streak: 3, best: 7, counted: true });
    expect(scoreResult(6, 7, 'loss', false)).toEqual({ streak: 0, best: 7, counted: true });
    expect(scoreResult(2, 7, 'draw', false)).toEqual({ streak: 2, best: 7, counted: true });
  });
  it('survives bad numbers', () => {
    expect(scoreResult(NaN, NaN, 'win', false)).toEqual({ streak: 1, best: 1, counted: true });
    expect(scoreResult(-2, -9, 'win', true)).toEqual({ streak: 0, best: 0, counted: false });
  });
  it('the page tracks Undo per game and the content page says so', () => {
    const src = page('Calculator.astro');
    expect(src).toContain("if (mode === 'cpu') usedUndo = true;");
    expect(src).toContain('usedUndo = false;');
    expect(src).toContain('scoreResult(streaks[diff]');
    const md = readFileSync(join(process.cwd(), 'src/content/apps/four-in-a-row.md'), 'utf8');
    expect(md).not.toContain('Using undo does not change your win streak');
    expect(md).toContain('is not counted');
  });
});

describe('focus and page text', () => {
  it('finds the nearest column with room, preferring the left on a tie', () => {
    const b = emptyBoard();
    expect(nearestOpenColumn(b, 3)).toBe(3);
    const full = (cols: number[]): Board => {
      const x = emptyBoard(); // only the free-cell count matters here, so the fill need not be a legal game
      for (const c of cols) for (let r = 0; r < ROWS; r++) x[idx(r, c)] = 1;
      return x;
    };
    expect(nearestOpenColumn(full([3]), 3)).toBe(2);
    expect(nearestOpenColumn(full([2, 3]), 3)).toBe(4);
    expect(nearestOpenColumn(full([0, 1, 2, 3]), 1)).toBe(4);
    expect(nearestOpenColumn(full([0, 1, 2, 3, 4, 5]), 0)).toBe(6);
    expect(nearestOpenColumn(full([0, 1, 2, 3, 4, 5, 6]), 3)).toBe(-1);
    expect(nearestOpenColumn(b, 99)).toBe(6);
  });
  it('the page does not refocus the hovered column, sends focus to New game after Play again, and uses tokens for colour', () => {
    const src = page('Calculator.astro');
    expect(src).not.toContain('heads[cursor].focus()');
    expect(src).toContain("g('fr-again').addEventListener('click', () => { newGame(); g('fr-new').focus(); });");
    expect(src).not.toContain('rgba(');
    expect(src).not.toContain('rgb(');
    expect(/#[0-9a-fA-F]{6}/.test(src)).toBe(false);
    expect(src).not.toContain('as plain numbers');
  });
});
