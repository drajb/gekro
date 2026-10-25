/**
 * games-tic-tac-toe.test.ts - the engine behind `tic-tac-toe`.
 *
 * Pinned (and quoted on the content page, so a wrong number there fails here):
 * the rules, the exact number of reachable positions and complete games found by
 * exhaustive enumeration, that the Unbeatable computer never loses against any
 * sequence of opponent moves as either X or O, that Medium always takes a win and
 * always blocks, that Easy only plays legal moves, and that every chooser is
 * deterministic for a seed.
 */
import { describe, it, expect } from 'vitest';
import {
  LINES, emptyBoard, other, mulberry32, winningLine, winnerOf, isFull, gameState, isOver, turnOf, legalMoves, play,
  winningMoves, positionValue, moveScores, bestMoves, outcomeUnderPerfectPlay, chooseEasy, chooseMedium, chooseUnbeatable,
  chooseMove, resultFor, nextStreak, parseBest, cellLabel, squareName,
  type Board, type Cell, type Mark, type Level,
} from '../src/components/apps-private/tic-tac-toe/helpers';

/** Build a board from a 9-character string: X, O or any other character for empty. */
const b = (s: string): Cell[] => Array.from(s).map((ch) => (ch === 'X' || ch === 'O' ? ch : ''));
const key = (board: Board): string => board.map((c) => c || '-').join('');

// ── Exhaustive enumeration, done once and shared ────────────────────────────

interface Census {
  positions: Set<string>;
  nonTerminal: Cell[][];
  games: number;
  xWins: number;
  oWins: number;
  draws: number;
}

const census = (): Census => {
  const positions = new Set<string>();
  const nonTerminal: Cell[][] = [];
  const out = { games: 0, xWins: 0, oWins: 0, draws: 0 };
  const walk = (board: Cell[]): void => {
    const k = key(board);
    const first = !positions.has(k);
    positions.add(k);
    const s = gameState(board);
    if (s === 'playing') {
      if (first) nonTerminal.push(board);
      for (const m of legalMoves(board)) walk(play(board, m) as Cell[]);
      return;
    }
    out.games += 1;
    if (s === 'X') out.xWins += 1;
    else if (s === 'O') out.oWins += 1;
    else out.draws += 1;
  };
  walk(emptyBoard());
  return { positions, nonTerminal, ...out };
};
const C = census();

describe('geometry and rules', () => {
  it('has eight distinct lines of three, and every square sits on 2 to 4 of them', () => {
    expect(LINES).toHaveLength(8);
    expect(new Set(LINES.map((l) => [...l].sort().join())).size).toBe(8);
    const counts = Array.from({ length: 9 }, (_, i) => LINES.filter((l) => l.includes(i)).length);
    expect(counts).toEqual([3, 2, 3, 2, 4, 2, 3, 2, 3]); // corners 3, edges 2, centre 4
  });

  it('detects a win on every line for both marks, and reports the line', () => {
    for (const line of LINES) {
      for (const m of ['X', 'O'] as Mark[]) {
        const board = emptyBoard();
        for (const i of line) board[i] = m;
        expect(winnerOf(board)).toBe(m);
        expect(winningLine(board)).toEqual({ mark: m, line });
        expect(gameState(board)).toBe(m);
        expect(isOver(board)).toBe(true);
      }
    }
  });

  it('sees no winner on an empty board, a mixed line, or a drawn full board', () => {
    expect(winnerOf(emptyBoard())).toBeNull();
    expect(winningLine(b('XXO------'))).toBeNull();
    const drawn = b('XOXXOOOXX');
    expect(isFull(drawn)).toBe(true);
    expect(winnerOf(drawn)).toBeNull();
    expect(gameState(drawn)).toBe('draw');
  });

  it('reports a win on the last square as a win, not a draw', () => {
    const board = b('XOXOXOOXX'); // X completes the 0-4-8 diagonal on a full board
    expect(isFull(board)).toBe(true);
    expect(gameState(board)).toBe('X');
  });

  it('gives X the first move and alternates', () => {
    expect(turnOf(emptyBoard())).toBe('X');
    expect(turnOf(b('X--------'))).toBe('O');
    expect(turnOf(b('XO-------'))).toBe('X');
  });

  it('lists the empty squares as legal moves, and none once the game is over', () => {
    expect(legalMoves(emptyBoard())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(legalMoves(b('XO-------'))).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(legalMoves(b('XXXOO----'))).toEqual([]);
    expect(legalMoves(b('XOXXOOOXX'))).toEqual([]);
  });
});

describe('play: only legal moves are accepted', () => {
  it('places the side-to-move mark on a copy and leaves the input untouched', () => {
    const start = emptyBoard();
    const after = play(start, 4) as Cell[];
    expect(after[4]).toBe('X');
    expect(start[4]).toBe('');
    expect((play(after, 0) as Cell[])[0]).toBe('O');
  });

  it('refuses an occupied square', () => {
    const board = b('X--------');
    expect(play(board, 0)).toBeNull();
    expect(play(play(board, 1) as Cell[], 1)).toBeNull();
  });

  it('refuses any move after the game has ended, even on an empty square', () => {
    const won = b('XXXOO----');
    expect(isOver(won)).toBe(true);
    for (let i = 0; i < 9; i++) expect(play(won, i)).toBeNull();
  });

  it('refuses squares outside the board and non-integers', () => {
    for (const bad of [-1, 9, 10, 1.5, NaN, Infinity, -Infinity]) expect(play(emptyBoard(), bad)).toBeNull();
  });
});

describe('exhaustive enumeration', () => {
  it('finds 5,478 distinct reachable positions, counting the empty board', () => {
    expect(C.positions.size).toBe(5478);
    expect(C.positions.has('---------')).toBe(true);
  });

  it('finds 255,168 possible complete games: 131,184 X wins, 77,904 O wins, 46,080 draws', () => {
    expect(C.games).toBe(255168);
    expect(C.xWins).toBe(131184);
    expect(C.oWins).toBe(77904);
    expect(C.draws).toBe(46080);
    expect(C.xWins + C.oWins + C.draws).toBe(C.games);
  });

  it('every reachable position has a legal mark count and at most one winner', () => {
    for (const k of C.positions) {
      const x = [...k].filter((c) => c === 'X').length;
      const o = [...k].filter((c) => c === 'O').length;
      expect(x === o || x === o + 1, k).toBe(true);
      const xLines = LINES.filter((l) => l.every((i) => k[i] === 'X')).length;
      const oLines = LINES.filter((l) => l.every((i) => k[i] === 'O')).length;
      expect(xLines > 0 && oLines > 0, k).toBe(false);
      if (xLines) expect(x, k).toBe(o + 1); // X just moved
      if (oLines) expect(x, k).toBe(o); // O just moved
    }
  });
});

describe('minimax', () => {
  it('values the empty board as a draw, and every opening move as a draw', () => {
    expect(positionValue(emptyBoard())).toBe(0);
    expect(outcomeUnderPerfectPlay(emptyBoard())).toBe(0);
    expect(bestMoves(emptyBoard())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('after a corner opening only the centre holds the draw for O', () => {
    expect(bestMoves(b('X--------'))).toEqual([4]);
  });

  it('after a centre opening only the corners hold the draw for O', () => {
    expect(bestMoves(b('----X----'))).toEqual([0, 2, 6, 8]);
  });

  it('takes an immediate win and prefers it to a slower one', () => {
    const board = b('XX-OO----');
    expect(bestMoves(board)).toEqual([2]);
    expect(outcomeUnderPerfectPlay(board)).toBe(1);
  });

  it('blocks a threat it cannot otherwise survive', () => {
    expect(bestMoves(b('XX--O----'))).toEqual([2]);
  });

  it('sees a fork as a forced win for the side that can make it', () => {
    const board = b('XO--X---O'); // X to move; playing 6 threatens both 2 and 3
    expect(turnOf(board)).toBe('X');
    expect(outcomeUnderPerfectPlay(board)).toBe(1);
    expect(winningMoves(play(board, 6) as Cell[], 'X')).toEqual([2, 3]);
  });

  it('agrees with a plain depth-first outcome search on every reachable position', () => {
    const plain = (board: Cell[]): number => {
      const s = gameState(board);
      if (s === 'draw') return 0;
      if (s !== 'playing') return -1; // the side to move has already lost
      let bestV = -2;
      for (const m of legalMoves(board)) bestV = Math.max(bestV, -plain(play(board, m) as Cell[]) || 0);
      return bestV;
    };
    for (const board of C.nonTerminal) expect(outcomeUnderPerfectPlay(board), key(board)).toBe(plain(board));
  });

  it('returns no best moves once the game is over', () => {
    expect(bestMoves(b('XXXOO----'))).toEqual([]);
    expect(moveScores(b('XOXXOOOXX'))).toEqual([]);
  });

  it('best moves are always a non-empty subset of the legal moves', () => {
    for (const board of C.nonTerminal) {
      const best = bestMoves(board);
      const legal = legalMoves(board);
      expect(best.length).toBeGreaterThan(0);
      expect(best.every((m) => legal.includes(m))).toBe(true);
    }
  });
});

describe('Unbeatable never loses', () => {
  /**
   * Walk every line of play where the computer plays only moves from its best set
   * and the opponent tries every legal move. Returns the number of finished games
   * and the number the computer lost.
   */
  const everyOpponentLine = (computer: Mark): { lines: number; lost: number } => {
    let lines = 0;
    let lost = 0;
    const walk = (board: Cell[]): void => {
      const s = gameState(board);
      if (s !== 'playing') { lines++; if (s === other(computer)) lost++; return; }
      const moves = turnOf(board) === computer ? bestMoves(board) : legalMoves(board);
      for (const m of moves) walk(play(board, m) as Cell[]);
    };
    walk(emptyBoard());
    return { lines, lost };
  };

  it('as X (moving first) loses to no sequence of opponent moves', () => {
    const r = everyOpponentLine('X');
    expect(r.lost).toBe(0);
    expect(r.lines).toBeGreaterThan(1000);
  });

  it('as O (moving second) loses to no sequence of opponent moves', () => {
    const r = everyOpponentLine('O');
    expect(r.lost).toBe(0);
    expect(r.lines).toBeGreaterThan(1000);
  });

  it('the move it actually picks is always in the best set, whatever the rng says', () => {
    for (const board of C.nonTerminal) {
      const best = bestMoves(board);
      for (const rng of [() => 0, () => 0.5, () => 0.999999999, mulberry32(7)]) {
        expect(best).toContain(chooseUnbeatable(board, rng) as number);
      }
    }
  });

  it('never loses a played game against any opponent move list, with real rng choices', () => {
    for (const computer of ['X', 'O'] as Mark[]) {
      for (let seed = 1; seed <= 300; seed++) {
        const rng = mulberry32(seed);
        const opp = mulberry32(seed * 7919);
        let board: Cell[] = emptyBoard();
        while (!isOver(board)) {
          const mv = turnOf(board) === computer ? chooseUnbeatable(board, rng) : chooseEasy(board, opp);
          board = play(board, mv as number) as Cell[];
        }
        expect(winnerOf(board), `${computer} seed ${seed}`).not.toBe(other(computer));
      }
    }
  });

  it('punishes a random opponent: wins far more than it draws and never loses', () => {
    let wins = 0;
    let games = 0;
    for (const computer of ['X', 'O'] as Mark[]) {
      for (let seed = 1; seed <= 400; seed++) {
        const rng = mulberry32(seed);
        const opp = mulberry32(seed + 90000);
        let board: Cell[] = emptyBoard();
        while (!isOver(board)) {
          const mv = turnOf(board) === computer ? chooseUnbeatable(board, rng) : chooseEasy(board, opp);
          board = play(board, mv as number) as Cell[];
        }
        games++;
        if (winnerOf(board) === computer) wins++;
        else expect(winnerOf(board)).toBeNull();
      }
    }
    expect(wins / games).toBeGreaterThan(0.6);
  });

  it('two Unbeatable players always draw', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      let board: Cell[] = emptyBoard();
      while (!isOver(board)) board = play(board, chooseUnbeatable(board, rng) as number) as Cell[];
      expect(gameState(board)).toBe('draw');
    }
  });
});

describe('Medium', () => {
  it('always takes an immediate win when one exists', () => {
    let checked = 0;
    for (const board of C.nonTerminal) {
      const mover = turnOf(board);
      const wins = winningMoves(board, mover);
      if (!wins.length) continue;
      for (let seed = 1; seed <= 4; seed++) {
        const mv = chooseMedium(board, mulberry32(seed)) as number;
        expect(wins, key(board)).toContain(mv);
        expect(winnerOf(play(board, mv) as Cell[])).toBe(mover);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('always blocks an immediate loss when it cannot win itself', () => {
    let checked = 0;
    for (const board of C.nonTerminal) {
      const mover = turnOf(board);
      if (winningMoves(board, mover).length) continue;
      const threats = winningMoves(board, other(mover));
      if (!threats.length) continue;
      for (let seed = 1; seed <= 4; seed++) {
        expect(threats, key(board)).toContain(chooseMedium(board, mulberry32(seed)) as number);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('prefers its own win over a block when both are available', () => {
    const board = b('XX-OO----'); // X to move: win at 2 beats blocking O at 5
    expect(winningMoves(board, 'X')).toEqual([2]);
    expect(winningMoves(board, 'O')).toEqual([5]);
    for (let seed = 1; seed <= 20; seed++) expect(chooseMedium(board, mulberry32(seed))).toBe(2);
  });

  it('plays varied legal moves when there is nothing to win or block', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) seen.add(chooseMedium(emptyBoard(), mulberry32(seed)) as number);
    expect(seen.size).toBe(9);
  });

  it('is beatable: a fork leaves it only one block, and X wins at the other square', () => {
    const forked = play(b('XO--X---O'), 6) as Cell[]; // X now threatens 2 and 3; O to move with no win of its own
    expect(winningMoves(forked, 'O')).toEqual([]);
    for (let seed = 1; seed <= 20; seed++) {
      const afterBlock = play(forked, chooseMedium(forked, mulberry32(seed)) as number) as Cell[];
      const finish = winningMoves(afterBlock, 'X');
      expect(finish.length).toBeGreaterThan(0);
      expect(winnerOf(play(afterBlock, finish[0]) as Cell[])).toBe('X');
    }
  });
});

describe('Easy', () => {
  it('only ever plays a legal move, in every reachable position and for many seeds', () => {
    for (const board of C.nonTerminal) {
      const legal = legalMoves(board);
      for (let seed = 1; seed <= 3; seed++) expect(legal).toContain(chooseEasy(board, mulberry32(seed)) as number);
    }
  });

  it('can pick every empty square from the empty board', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) seen.add(chooseEasy(emptyBoard(), mulberry32(seed)) as number);
    expect([...seen].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('survives extreme rng values without leaving the legal set', () => {
    const board = b('XO-------');
    for (const v of [0, 0.5, 0.9999999999, 1]) expect(legalMoves(board)).toContain(chooseEasy(board, () => v) as number);
  });
});

describe('choosers on a finished game', () => {
  it('return null when there is nothing to play', () => {
    const levels: Level[] = ['easy', 'medium', 'unbeatable'];
    for (const done of [b('XXXOO----'), b('XOXXOOOXX'), b('OOOXX-X--')]) {
      for (const l of levels) expect(chooseMove(done, l, mulberry32(1))).toBeNull();
    }
  });

  it('dispatches by level', () => {
    const board = b('XX-OO----');
    expect(chooseMove(board, 'medium', mulberry32(1))).toBe(2);
    expect(chooseMove(board, 'unbeatable', mulberry32(1))).toBe(2);
    expect(legalMoves(board)).toContain(chooseMove(board, 'easy', mulberry32(1)) as number);
  });
});

describe('determinism', () => {
  const selfPlay = (level: Level, seed: number): string => {
    const rng = mulberry32(seed);
    let board: Cell[] = emptyBoard();
    const moves: number[] = [];
    while (!isOver(board)) {
      const mv = chooseMove(board, level, rng) as number;
      moves.push(mv);
      board = play(board, mv) as Cell[];
    }
    return moves.join('');
  };

  for (const level of ['easy', 'medium', 'unbeatable'] as Level[]) {
    it(`${level}: the same seed replays the same game, different seeds differ`, () => {
      expect(selfPlay(level, 42)).toBe(selfPlay(level, 42));
      const games = new Set<string>();
      for (let s = 1; s <= 40; s++) games.add(selfPlay(level, s));
      expect(games.size).toBeGreaterThan(5);
    });
  }

  it('mulberry32 is deterministic and stays inside [0, 1)', () => {
    const a = mulberry32(5);
    const c = mulberry32(5);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(c());
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});

describe('results, streaks and storage', () => {
  it('reads the result from the point of view of one side', () => {
    expect(resultFor(b('XXXOO----'), 'X')).toBe('win');
    expect(resultFor(b('XXXOO----'), 'O')).toBe('loss');
    expect(resultFor(b('XOXXOOOXX'), 'X')).toBe('draw');
    expect(resultFor(b('XO-------'), 'X')).toBeNull();
  });

  it('extends the unbeaten streak on a win or draw and ends it on a loss', () => {
    expect(nextStreak(0, 'win')).toBe(1);
    expect(nextStreak(4, 'draw')).toBe(5);
    expect(nextStreak(9, 'loss')).toBe(0);
    expect(nextStreak(-3, 'win')).toBe(1);
    expect(nextStreak(NaN, 'win')).toBe(1);
  });

  it('keeps only positive whole numbers from storage', () => {
    expect(parseBest(null)).toEqual({ easy: 0, medium: 0, unbeatable: 0 });
    expect(parseBest('{"easy":3,"medium":7,"unbeatable":12}')).toEqual({ easy: 3, medium: 7, unbeatable: 12 });
    expect(parseBest('{"easy":-1,"medium":2.5,"unbeatable":"9"}')).toEqual({ easy: 0, medium: 0, unbeatable: 0 });
    expect(parseBest('{"easy":null,"medium":1e99}')).toEqual({ easy: 0, medium: 0, unbeatable: 0 });
  });

  it('survives corrupt storage values', () => {
    for (const raw of ['not json', '[]', '42', 'null', '{"easy":', '']) {
      expect(parseBest(raw)).toEqual({ easy: 0, medium: 0, unbeatable: 0 });
    }
  });
});

describe('labels', () => {
  it('names squares the way the page announces them', () => {
    expect(cellLabel(0, '')).toBe('Row 1, column 1, empty');
    expect(cellLabel(5, 'X')).toBe('Row 2, column 3, X');
    expect(cellLabel(8, 'O', true)).toBe('Row 3, column 3, O, in the winning line');
    expect(squareName(4)).toBe('row 2, column 2');
  });

  it('no label or name contains the em-dash character', () => {
    for (let i = 0; i < 9; i++) expect(cellLabel(i, 'X', true) + squareName(i)).not.toContain(String.fromCharCode(0x2014));
  });
});
