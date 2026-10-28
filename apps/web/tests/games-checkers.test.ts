/**
 * games-checkers.test.ts - the engine behind `checkers`.
 *
 * Pinned: the opening position and its seven legal moves, mandatory capture, a
 * choice between captures, multi-jumps (including a king looping back through its
 * own start square and never jumping a piece twice), crowning ending the turn,
 * kings moving and capturing both ways, a side with no legal move losing, the
 * 40-ply no-progress draw, undo bookkeeping, the published perft node counts for
 * English draughts, the three computer levels (always legal, deterministic for a
 * seed, alpha-beta agrees with plain minimax, Hard answers inside its time cap)
 * and self-play fuzz.
 *
 * Boards are written as 8 rows of 8 characters: x dark man, X dark king, o light
 * man, O light king, . empty. Row 0 is the top; pieces sit where row + column is odd.
 */
import { describe, it, expect } from 'vitest';
import {
  initialBoard, initialState, parseBoard, boardToString, legalMoves, hasMoves, findMove, applyMove, stepState, result, describeOutcome,
  describeMove, undoCount, perft, evaluate, search, randomMove, bestMove, chooseMove, countPieces, mulberry32, shuffled, opponent, nameOf,
  cellName, rowOf, colOf, isPlaySquare, STEP, JUMP, LEVEL_LIMIT, NO_PROGRESS_LIMIT, MAN_VALUE, KING_VALUE, WIN_SCORE,
  DARK, LIGHT, DARK_MAN, LIGHT_MAN, DARK_KING, LIGHT_KING,
  type Board, type Side, type Move, type Level, type GameState,
} from '../src/components/apps-private/checkers/helpers';

const rc = (r: number, c: number): number => r * 8 + c;
const EMPTY_ROW = '........';
const paths = (ms: Move[]): string[] => ms.map((m) => m.path.join('>')).sort();
/** A path of (row, column) pairs as the string legalMoves paths are compared with. */
const P = (...sq: [number, number][]): string => sq.map(([r, c]) => rc(r, c)).join('>');
const sortedPaths = (...ps: string[]): string[] => ps.slice().sort();

/** Play a whole game, asking `pick` for each move. Throws if a move is missing or illegal. */
const playOut = (pick: (s: GameState, ply: number) => Move | null, maxPlies = 400) => {
  let s = initialState();
  const log: { side: Side; move: Move; before: Board }[] = [];
  for (let ply = 0; ply < maxPlies; ply++) {
    const out = result(s.board, s.toMove, s.quiet);
    if (out.over) return { state: s, log, outcome: out };
    const m = pick(s, ply);
    if (!m || !findMove(s.board, s.toMove, m.path)) throw new Error(`illegal or missing move at ply ${ply}`);
    log.push({ side: s.toMove, move: m, before: s.board });
    s = stepState(s, m);
  }
  throw new Error('game did not finish');
};

describe('geometry', () => {
  it('has 32 playing squares and the bottom-left corner is one of them', () => {
    const play = Array.from({ length: 64 }, (_, i) => i).filter(isPlaySquare);
    expect(play).toHaveLength(32);
    expect(isPlaySquare(rc(7, 0))).toBe(true);
    expect(isPlaySquare(rc(0, 0))).toBe(false);
  });
  it('step and jump tables stop at the edges', () => {
    expect(STEP[rc(0, 1)]).toEqual([-1, -1, rc(1, 0), rc(1, 2)]);
    expect(JUMP[rc(0, 1)]).toEqual([-1, -1, -1, rc(2, 3)]);
    expect(STEP[rc(4, 3)]).toEqual([rc(3, 2), rc(3, 4), rc(5, 2), rc(5, 4)]);
    expect(JUMP[rc(7, 0)]).toEqual([-1, rc(5, 2), -1, -1]);
  });
  it('names a square with 1-based row and column', () => {
    expect(cellName(0)).toBe('row 1, column 1');
    expect(cellName(63)).toBe('row 8, column 8');
    expect(rowOf(rc(5, 2))).toBe(5);
    expect(colOf(rc(5, 2))).toBe(2);
  });
  it('rejects a piece on an unused square and a board of the wrong size', () => {
    expect(() => parseBoard('x' + '.'.repeat(63))).toThrow(RangeError);
    expect(() => parseBoard('xo')).toThrow(RangeError);
  });
});

describe('initial position', () => {
  const b = initialBoard();
  it('has twelve pieces each, all men, on the playing squares only', () => {
    expect(countPieces(b)).toEqual({ dark: 12, light: 12, darkKings: 0, lightKings: 0 });
    for (let i = 0; i < 64; i++) if (b[i]) expect(isPlaySquare(i)).toBe(true);
    for (let c = 0; c < 8; c++) for (const r of [3, 4]) expect(b[rc(r, c)]).toBe(0);
    expect(b[rc(7, 0)]).toBe(DARK_MAN);
    expect(b[rc(0, 1)]).toBe(LIGHT_MAN);
  });
  it('gives Dark exactly 7 legal moves, all simple steps from row 6 to row 5', () => {
    const ms = legalMoves(b, DARK);
    expect(ms).toHaveLength(7);
    expect(ms.every((m) => m.captured.length === 0 && !m.crown && rowOf(m.from) === 5 && rowOf(m.to) === 4)).toBe(true);
    expect(paths(ms)).toEqual(sortedPaths(
      P([5, 0], [4, 1]), P([5, 2], [4, 1]), P([5, 2], [4, 3]), P([5, 4], [4, 3]), P([5, 4], [4, 5]), P([5, 6], [4, 5]), P([5, 6], [4, 7]),
    ));
  });
  it('gives Light 7 replies too, and the game is not over', () => {
    expect(legalMoves(b, LIGHT)).toHaveLength(7);
    expect(result(b, DARK, 0)).toEqual({ over: false, winner: null, reason: 'none' });
  });
  it('round-trips through the text format', () => {
    expect(parseBoard(boardToString(b))).toEqual(b);
    expect(boardToString(b)).toHaveLength(64);
  });
  it('starts with Dark to move and a fresh counter', () => {
    const s = initialState();
    expect(s.toMove).toBe(DARK);
    expect(s.quiet).toBe(0);
  });
});

describe('simple moves', () => {
  it('a dark man steps up the board and a light man steps down, never the other way', () => {
    const d = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...x....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    expect(paths(legalMoves(d, DARK))).toEqual(sortedPaths(P([4, 3], [3, 2]), P([4, 3], [3, 4])));
    const l = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...o....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    expect(paths(legalMoves(l, LIGHT))).toEqual(sortedPaths(P([4, 3], [5, 2]), P([4, 3], [5, 4])));
  });
  it('a king moves one square in all four directions', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...X....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    expect(paths(legalMoves(b, DARK))).toEqual(sortedPaths(P([4, 3], [3, 2]), P([4, 3], [3, 4]), P([4, 3], [5, 2]), P([4, 3], [5, 4])));
    const l = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...O....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    expect(legalMoves(l, LIGHT)).toHaveLength(4);
  });
  it('a king in the corner has one move, and a piece cannot step onto its own side', () => {
    const corner = parseBoard(EMPTY_ROW.repeat(7) + 'X.......');
    expect(paths(legalMoves(corner, DARK))).toEqual([P([7, 0], [6, 1])]);
    const blocked = parseBoard(EMPTY_ROW.repeat(6) + '.x......' + 'X.......');
    expect(legalMoves(blocked, DARK).filter((m) => m.from === rc(7, 0))).toEqual([]);
  });
  it('a man reaching the far row is crowned on that move, either colour', () => {
    const b = parseBoard(EMPTY_ROW + '..x.....' + EMPTY_ROW.repeat(6));
    const ms = legalMoves(b, DARK);
    expect(ms).toHaveLength(2);
    expect(ms.every((m) => m.crown && rowOf(m.to) === 0)).toBe(true);
    expect(applyMove(b, ms[0])[ms[0].to]).toBe(DARK_KING);
    const light = parseBoard(EMPTY_ROW.repeat(6) + '.o......' + EMPTY_ROW);
    const lm = legalMoves(light, LIGHT);
    expect(lm.every((m) => m.crown && rowOf(m.to) === 7)).toBe(true);
    expect(applyMove(light, lm[0])[lm[0].to]).toBe(LIGHT_KING);
  });
  it('a king that reaches the back row is not crowned again', () => {
    const b = parseBoard(EMPTY_ROW + '..X.....' + EMPTY_ROW.repeat(6));
    expect(legalMoves(b, DARK).every((m) => !m.crown)).toBe(true);
  });
});

describe('captures are mandatory', () => {
  const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...o....', '..x.....', EMPTY_ROW, 'x.......'].join(''));
  it('only the capture is offered when a simple move also exists', () => {
    const ms = legalMoves(b, DARK);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ from: rc(5, 2), to: rc(3, 4), captured: [rc(4, 3)], crown: false });
    expect(ms[0].path).toEqual([rc(5, 2), rc(3, 4)]);
  });
  it('the other side is bound by the same rule', () => {
    const lm = legalMoves(b, LIGHT);
    expect(lm).toHaveLength(1);
    expect(lm[0]).toMatchObject({ from: rc(4, 3), to: rc(6, 1), captured: [rc(5, 2)] });
  });
  it('removes the captured piece and moves the capturer', () => {
    const after = applyMove(b, legalMoves(b, DARK)[0]);
    expect(after[rc(4, 3)]).toBe(0);
    expect(after[rc(5, 2)]).toBe(0);
    expect(after[rc(3, 4)]).toBe(DARK_MAN);
    expect(countPieces(after)).toEqual({ dark: 2, light: 0, darkKings: 0, lightKings: 0 });
  });
  it('two pieces in a row cannot be jumped, so no capture is forced', () => {
    const shut = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....o...', '...o....', '..x.....', EMPTY_ROW, EMPTY_ROW].join(''));
    expect(legalMoves(shut, DARK).every((m) => m.captured.length === 0)).toBe(true);
    expect(legalMoves(shut, DARK).length).toBeGreaterThan(0);
  });
  it('you cannot jump your own piece', () => {
    const own = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....x...', '...x....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    expect(legalMoves(own, DARK).every((m) => m.captured.length === 0)).toBe(true);
  });
  it('a man cannot capture backwards', () => {
    const back = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....x...', '...o....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    // The light man sits below the dark man with an empty square beyond it, but men only capture forward.
    expect(legalMoves(back, DARK).every((m) => m.captured.length === 0)).toBe(true);
    expect(legalMoves(back, LIGHT).every((m) => m.captured.length === 0)).toBe(true);
  });
  it('a king can capture backwards', () => {
    const back = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....X...', '...o....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    const ms = legalMoves(back, DARK);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ from: rc(3, 4), to: rc(5, 2), captured: [rc(4, 3)] });
  });
});

describe('choosing between captures', () => {
  it('offers the same piece both directions when two enemies are in reach', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...o.o..', '....x...', EMPTY_ROW, EMPTY_ROW].join(''));
    expect(paths(legalMoves(b, DARK))).toEqual(sortedPaths(P([5, 4], [3, 2]), P([5, 4], [3, 6])));
  });
  it('offers captures by different pieces', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '.o...o..', 'x.....x.', EMPTY_ROW, EMPTY_ROW].join(''));
    expect(paths(legalMoves(b, DARK))).toEqual(sortedPaths(P([5, 0], [3, 2]), P([5, 6], [3, 4])));
  });
  it('does not force the longer capture: a single jump is as legal as a double', () => {
    // The man at (6,1) can take two ((5,2) then (3,4)); the man at (6,5) can take only (5,6).
    const c = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....o...', EMPTY_ROW, '..o...o.', '.x...x..', EMPTY_ROW].join(''));
    const ms = legalMoves(c, DARK);
    expect(paths(ms)).toEqual(sortedPaths(P([6, 1], [4, 3], [2, 5]), P([6, 5], [4, 7])));
    expect(ms.map((m) => m.captured.length).sort()).toEqual([1, 2]);
  });
});

describe('multi-jumps', () => {
  it('continues with the same piece while another jump is available, and offers no partial move', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....o...', EMPTY_ROW, '..o.....', '.x......', EMPTY_ROW].join(''));
    const ms = legalMoves(b, DARK);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([rc(6, 1), rc(4, 3), rc(2, 5)]);
    expect(ms[0].captured).toEqual([rc(5, 2), rc(3, 4)]);
    expect(ms[0].to).toBe(rc(2, 5));
    expect(findMove(b, DARK, [rc(6, 1), rc(4, 3)])).toBeNull(); // stopping after one jump is not allowed
    const after = applyMove(b, ms[0]);
    expect(countPieces(after)).toEqual({ dark: 1, light: 0, darkKings: 0, lightKings: 0 });
    expect(after[rc(2, 5)]).toBe(DARK_MAN);
  });
  it('branches when the second jump can go two ways', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '..o.o...', EMPTY_ROW, '..o.....', '.x......', EMPTY_ROW].join(''));
    const ms = legalMoves(b, DARK);
    expect(paths(ms)).toEqual(sortedPaths(P([6, 1], [4, 3], [2, 1]), P([6, 1], [4, 3], [2, 5])));
    expect(ms.every((m) => m.captured.length === 2 && m.captured[0] === rc(5, 2))).toBe(true);
  });
  it('a light man can take three in a row going down the board', () => {
    const b = parseBoard(['.o......', '..x.....', EMPTY_ROW, '....x...', EMPTY_ROW, '......x.', EMPTY_ROW, EMPTY_ROW].join(''));
    const ms = legalMoves(b, LIGHT);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([rc(0, 1), rc(2, 3), rc(4, 5), rc(6, 7)]);
    expect(ms[0].captured).toEqual([rc(1, 2), rc(3, 4), rc(5, 6)]);
    expect(countPieces(applyMove(b, ms[0])).dark).toBe(0);
  });
  it('a king may loop back through its own start square, in either direction, and takes four', () => {
    // Enemy men at (3,2) (3,4) (5,2) (5,4) form a diamond around the king's start square (6,3)... which the king can circle.
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '..o.o...', EMPTY_ROW, '..o.o...', '...X....', EMPTY_ROW].join(''));
    const ms = legalMoves(b, DARK);
    expect(ms).toHaveLength(2);
    for (const m of ms) {
      expect(m.captured).toHaveLength(4);
      expect(new Set(m.captured).size).toBe(4);
      expect(m.from).toBe(rc(6, 3));
      expect(m.to).toBe(rc(6, 3));
      expect(m.path).toHaveLength(5);
    }
    const after = applyMove(b, ms[0]);
    expect(after[rc(6, 3)]).toBe(DARK_KING);
    expect(countPieces(after).light).toBe(0);
  });
  it('a jumped piece stays on the board until the move ends, so it is never jumped twice', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '..o.....', '.X......', EMPTY_ROW].join(''));
    const ms = legalMoves(b, DARK);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([rc(6, 1), rc(4, 3)]); // it cannot jump straight back over (5,2)
    expect(ms[0].captured).toEqual([rc(5, 2)]);
  });
});

describe('crowning ends the turn', () => {
  const man = parseBoard([EMPTY_ROW, '..o.o...', '.x......', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
  it('a man that jumps onto the far row stops there even though a king could jump on', () => {
    const ms = legalMoves(man, DARK);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([rc(2, 1), rc(0, 3)]);
    expect(ms[0].captured).toEqual([rc(1, 2)]);
    expect(ms[0].crown).toBe(true);
    const after = applyMove(man, ms[0]);
    expect(after[rc(0, 3)]).toBe(DARK_KING);
    expect(after[rc(1, 4)]).toBe(LIGHT_MAN); // the second piece is untouched
  });
  it('the same jump by a king carries on', () => {
    const king = parseBoard([EMPTY_ROW, '..o.o...', '.X......', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    const ms = legalMoves(king, DARK);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([rc(2, 1), rc(0, 3), rc(2, 5)]);
    expect(ms[0].captured).toEqual([rc(1, 2), rc(1, 4)]);
    expect(ms[0].crown).toBe(false);
  });
  it('a light man crowns on the bottom row and also stops', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....o...', '.x.x....', EMPTY_ROW].join(''));
    const ms = legalMoves(b, LIGHT);
    expect(ms).toHaveLength(1);
    expect(ms[0].path).toEqual([rc(5, 4), rc(7, 2)]);
    expect(ms[0].captured).toEqual([rc(6, 3)]);
    expect(ms[0].crown).toBe(true);
    const after = applyMove(b, ms[0]);
    expect(after[rc(7, 2)]).toBe(LIGHT_KING);
    expect(after[rc(6, 1)]).toBe(DARK_MAN);
  });
  it('a man that crowns by a simple step is a king on the next turn and moves both ways', () => {
    const b = parseBoard(EMPTY_ROW + '..x.....' + EMPTY_ROW.repeat(6));
    const step = legalMoves(b, DARK).find((m) => m.to === rc(0, 3)) as Move;
    const after = applyMove(b, step);
    expect(after[rc(0, 3)]).toBe(DARK_KING);
    expect(paths(legalMoves(after, DARK))).toEqual(sortedPaths(P([0, 3], [1, 2]), P([0, 3], [1, 4])));
  });
});

describe('the end of the game', () => {
  it('a side whose pieces are all blocked loses', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '..o.....', '.o......', 'x.......'].join(''));
    expect(hasMoves(b, DARK)).toBe(false);
    expect(result(b, DARK, 0)).toEqual({ over: true, winner: LIGHT, reason: 'blocked' });
  });
  it('a side with no pieces loses', () => {
    const b = parseBoard(EMPTY_ROW + '..o.....' + EMPTY_ROW.repeat(6));
    expect(result(b, DARK, 0)).toEqual({ over: true, winner: LIGHT, reason: 'no-pieces' });
  });
  it('capturing the last piece ends the game for the side to move next', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...o....', '..x.....', EMPTY_ROW, EMPTY_ROW].join(''));
    const s = stepState({ board: b, toMove: DARK, quiet: 7 }, legalMoves(b, DARK)[0]);
    expect(s.toMove).toBe(LIGHT);
    expect(result(s.board, s.toMove, s.quiet)).toEqual({ over: true, winner: DARK, reason: 'no-pieces' });
  });
  it('a game in progress reports nothing', () => {
    expect(result(initialBoard(), LIGHT, 12).over).toBe(false);
  });
  it('describes results for two players and for a player against the computer', () => {
    const blocked = { over: true, winner: DARK as Side, reason: 'blocked' as const };
    const none = { over: true, winner: LIGHT as Side, reason: 'no-pieces' as const };
    expect(describeOutcome(blocked, null)).toBe('Dark (solid) wins: Light (ring) has no legal move.');
    expect(describeOutcome(none, null)).toBe('Light (ring) wins: Dark (solid) has no pieces left.');
    expect(describeOutcome(blocked, DARK)).toBe('You win: the computer has no legal move.');
    expect(describeOutcome(blocked, LIGHT)).toBe('The computer wins: you have no legal move.');
    expect(describeOutcome(none, DARK)).toBe('The computer wins: you have no pieces left.');
    expect(describeOutcome({ over: true, winner: null, reason: 'forty-ply' }, null)).toContain('40 moves in a row');
    expect(describeOutcome({ over: false, winner: null, reason: 'none' }, null)).toBe('Game in progress.');
  });
});

describe('the 40-ply no-progress draw', () => {
  const kings = parseBoard('.......O' + EMPTY_ROW.repeat(6) + 'X.......');
  it('is a draw at exactly 40 plies and not at 39', () => {
    expect(NO_PROGRESS_LIMIT).toBe(40);
    expect(result(kings, DARK, 39).over).toBe(false);
    expect(result(kings, DARK, 40)).toEqual({ over: true, winner: null, reason: 'forty-ply' });
    expect(result(kings, LIGHT, 41).reason).toBe('forty-ply');
  });
  it('shuffling kings for 40 plies with no capture ends the game as a draw', () => {
    let s: GameState = { board: kings, toMove: DARK, quiet: 0 };
    const darkPath = [rc(7, 0), rc(6, 1)];
    const lightPath = [rc(0, 7), rc(1, 6)];
    for (let ply = 0; ply < 40; ply++) {
      expect(result(s.board, s.toMove, s.quiet).over, `ply ${ply}`).toBe(false);
      const cur = s.toMove === DARK ? darkPath : lightPath;
      const at = s.board.indexOf(s.toMove === DARK ? DARK_KING : LIGHT_KING);
      const to = at === cur[0] ? cur[1] : cur[0];
      const m = findMove(s.board, s.toMove, [at, to]);
      expect(m, `ply ${ply}`).not.toBeNull();
      s = stepState(s, m as Move);
      expect(s.quiet).toBe(ply + 1);
    }
    expect(result(s.board, s.toMove, s.quiet)).toEqual({ over: true, winner: null, reason: 'forty-ply' });
  });
  it('a man move resets the counter', () => {
    const withMan = parseBoard('.......O' + EMPTY_ROW.repeat(3) + '...x....' + EMPTY_ROW.repeat(3));
    const m = legalMoves(withMan, DARK)[0];
    expect(stepState({ board: withMan, toMove: DARK, quiet: 39 }, m).quiet).toBe(0);
  });
  it('a capture resets the counter, even by a king', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '....O...', '.....x..', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW].join(''));
    const ms = legalMoves(b, LIGHT);
    expect(ms).toHaveLength(1);
    expect(ms[0].captured).toEqual([rc(4, 5)]);
    expect(stepState({ board: b, toMove: LIGHT, quiet: 38 }, ms[0]).quiet).toBe(0);
  });
  it('a king step without a capture adds one', () => {
    const m = legalMoves(kings, DARK)[0];
    expect(stepState({ board: kings, toMove: DARK, quiet: 5 }, m).quiet).toBe(6);
  });
  it('a loss outranks the draw', () => {
    const b = parseBoard(EMPTY_ROW + '..o.....' + EMPTY_ROW.repeat(6));
    expect(result(b, DARK, 40)).toMatchObject({ winner: LIGHT, reason: 'no-pieces' });
  });
});

describe('undo bookkeeping', () => {
  it('against the computer it returns to your last move, whoever moved first', () => {
    expect(undoCount([], DARK)).toBe(0);
    expect(undoCount([DARK, LIGHT], DARK)).toBe(2);
    expect(undoCount([DARK, LIGHT, DARK, LIGHT], DARK)).toBe(2);
    expect(undoCount([DARK, LIGHT, DARK], DARK)).toBe(1);
    expect(undoCount([DARK, LIGHT, DARK, LIGHT, DARK], LIGHT)).toBe(2);
    expect(undoCount([DARK], LIGHT)).toBe(0); // the human (Light) has not moved yet
  });
  it('against a person it takes back one move', () => {
    expect(undoCount([DARK, LIGHT, DARK], null)).toBe(1);
    expect(undoCount([], null)).toBe(0);
  });
  it('moves never mutate earlier positions, so a saved state restores exactly', () => {
    const rng = mulberry32(5);
    let s = initialState();
    const before: GameState[] = [];
    const moves: Move[] = [];
    const movers: Side[] = [];
    for (let i = 0; i < 24; i++) {
      const m = randomMove(s.board, s.toMove, rng);
      if (!m) break;
      before.push(s);
      moves.push(m);
      movers.push(s.toMove);
      s = stepState(s, m);
    }
    // Replaying the first k moves from scratch matches the position that was saved before move k.
    before.forEach((saved, k) => {
      let replay = initialState();
      for (let j = 0; j < k; j++) replay = stepState(replay, moves[j]);
      expect(boardToString(saved.board)).toBe(boardToString(replay.board));
      expect(saved.toMove).toBe(replay.toMove);
      expect(saved.quiet).toBe(replay.quiet);
    });
    // Undo against the computer lands on a position where the human is to move.
    const n = undoCount(movers, DARK);
    expect(before[movers.length - n].toMove).toBe(DARK);
  });
});

describe('describeMove', () => {
  it('says what moved, what was taken and whether it was crowned', () => {
    const simple = legalMoves(initialBoard(), DARK).find((m) => m.from === rc(5, 0)) as Move;
    expect(describeMove(simple, DARK)).toBe('Dark (solid) moved from row 6, column 1 to row 5, column 2.');
    const b = parseBoard(EMPTY_ROW + '..o.....' + '.x......' + EMPTY_ROW.repeat(5));
    const crown = legalMoves(b, DARK)[0];
    expect(describeMove(crown, DARK)).toBe('Dark (solid) moved from row 3, column 2 to row 1, column 4 and captured 1 piece and was crowned.');
    expect(nameOf(LIGHT)).toBe('Light (ring)');
    expect(opponent(DARK)).toBe(LIGHT);
  });
});

describe('perft from the starting position', () => {
  // Published node counts for English draughts (move sequences; a multi-jump is one move).
  const EXPECTED = [7, 49, 302, 1469, 7361, 36768, 179740];
  EXPECTED.forEach((n, i) => {
    it(`depth ${i + 1} = ${n}`, () => {
      expect(perft(initialBoard(), DARK, i + 1)).toBe(n);
    });
  });
  it('depth 0 is one node', () => {
    expect(perft(initialBoard(), DARK, 0)).toBe(1);
  });
});

describe('seeded randomness', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v >= 0 && v < 1).toBe(true);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('shuffled is a permutation and does not mutate its input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(src, mulberry32(3));
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('computer players', () => {
  const midgame = (seed: number, plies: number): GameState => {
    const rng = mulberry32(seed);
    let s = initialState();
    for (let i = 0; i < plies; i++) {
      const m = randomMove(s.board, s.toMove, rng);
      if (!m) break;
      s = stepState(s, m);
    }
    return s;
  };
  const legalPath = (s: GameState, m: Move | null): boolean => !!m && !!findMove(s.board, s.toMove, m.path);

  it('every level returns null when there is no legal move', () => {
    const stuck = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '..o.....', '.o......', 'x.......'].join(''));
    for (const level of ['easy', 'medium', 'hard'] as Level[]) expect(chooseMove(stuck, DARK, level, mulberry32(1))).toBeNull();
    expect(bestMove(stuck, DARK, { depth: 3 }, mulberry32(1))).toBeNull();
    expect(search(stuck, DARK, { depth: 3 }, mulberry32(1)).score).toBe(-WIN_SCORE);
  });
  it('returns the only legal move without searching', () => {
    const one = parseBoard(EMPTY_ROW.repeat(7) + 'X.......');
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      expect(chooseMove(one, DARK, level, mulberry32(1))!.path).toEqual([rc(7, 0), rc(6, 1)]);
    }
  });
  it('never plays an illegal move, at any level, over many positions', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const plies of [0, 1, 6, 14, 24, 40, 60]) {
        const s = midgame(seed, plies);
        if (!hasMoves(s.board, s.toMove)) continue;
        const rng = mulberry32(seed * 100 + plies);
        expect(legalPath(s, randomMove(s.board, s.toMove, rng))).toBe(true);
        expect(legalPath(s, bestMove(s.board, s.toMove, { depth: 3 }, rng))).toBe(true);
        expect(legalPath(s, bestMove(s.board, s.toMove, { depth: 4, guard: true }, rng))).toBe(true);
      }
    }
  });
  it('Medium and Hard at their real settings never play an illegal move', () => {
    for (const seed of [21, 22, 23]) {
      const s = midgame(seed, 16);
      for (const level of ['medium', 'hard'] as Level[]) {
        expect(legalPath(s, chooseMove(s.board, s.toMove, level, mulberry32(seed)))).toBe(true);
      }
    }
  });
  it('is deterministic for a seed when the search is not time limited', () => {
    const s = midgame(9, 14);
    for (const lim of [{ depth: 3 }, { depth: 5, guard: true }]) {
      const a = bestMove(s.board, s.toMove, lim, mulberry32(77))!;
      const b = bestMove(s.board, s.toMove, lim, mulberry32(77))!;
      expect(a.path).toEqual(b.path);
    }
    const e1 = chooseMove(s.board, s.toMove, 'easy', mulberry32(77))!;
    const e2 = chooseMove(s.board, s.toMove, 'easy', mulberry32(77))!;
    expect(e1.path).toEqual(e2.path);
  });
  it('Easy varies with the seed and reaches every opening move', () => {
    const b = initialBoard();
    const seen = new Set<string>();
    for (let s = 1; s <= 80; s++) seen.add(randomMove(b, DARK, mulberry32(s))!.path.join('>'));
    expect(seen.size).toBe(7);
  });
  it('avoids a move that loses a piece for nothing (Medium and Hard)', () => {
    // Stepping to (4,3) lets the light man at (3,2) jump it; (4,5) is safe.
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '..o.....', EMPTY_ROW, '....x...', EMPTY_ROW, '......x.'].join(''));
    expect(legalMoves(b, DARK).filter((m) => m.from === rc(5, 4))).toHaveLength(2);
    for (const lim of [{ depth: 3 }, { depth: 4, guard: true }]) {
      for (let seed = 1; seed <= 5; seed++) {
        const m = bestMove(b, DARK, lim, mulberry32(seed))!;
        expect(m.path).not.toEqual([rc(5, 4), rc(4, 3)]);
      }
    }
  });
  it('takes the capture when one is forced, whatever the level', () => {
    const b = parseBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...o....', '..x.....', EMPTY_ROW, 'x.......'].join(''));
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      expect(chooseMove(b, DARK, level, mulberry32(3))!.captured).toEqual([rc(4, 3)]);
    }
  });

  it('alpha-beta returns exactly what plain minimax returns (depths 1 to 3)', () => {
    const plain = (b: Board, side: Side, depth: number, ply: number): number => {
      const moves = legalMoves(b, side);
      if (!moves.length) return -(WIN_SCORE - ply);
      if (depth <= 0 && moves[0].captured.length === 0) return evaluate(b, side);
      let best = -Infinity;
      for (const m of moves) best = Math.max(best, -plain(applyMove(b, m), opponent(side), depth - 1, ply + 1));
      return best;
    };
    let checked = 0;
    for (const [seed, plies] of [[1, 6], [2, 10], [3, 16], [4, 22], [5, 30], [6, 36]]) {
      const s = midgame(seed, plies);
      if (legalMoves(s.board, s.toMove).length < 2) continue;
      for (const depth of [1, 2, 3]) {
        const expected = Math.max(...legalMoves(s.board, s.toMove).map((m) => -plain(applyMove(s.board, m), opponent(s.toMove), depth - 1, 1)));
        const got = search(s.board, s.toMove, { depth }, mulberry32(seed));
        expect(got.score, `seed ${seed} depth ${depth}`).toBe(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12);
  });

  it('iterative deepening reaches the requested depth when time is not limited', () => {
    const s = midgame(4, 12);
    expect(search(s.board, s.toMove, { depth: 5 }, mulberry32(1)).depth).toBe(5);
  });
  it('Hard\'s full 7-ply search from the opening finishes with no time cap needed (under 5 s)', () => {
    const t = performance.now();
    const info = search(initialBoard(), DARK, { depth: 7, guard: true }, mulberry32(1));
    expect(info.depth).toBe(7);
    expect(performance.now() - t).toBeLessThan(5000);
  });
  it('a time cap stops deepening early but still returns a legal move', () => {
    const s = initialState();
    const info = search(s.board, s.toMove, { depth: 40, timeMs: 150 }, mulberry32(1));
    expect(info.depth).toBeGreaterThanOrEqual(1);
    expect(info.depth).toBeLessThan(40);
    expect(legalPath(s, info.move)).toBe(true);
  });

  it('Medium beats Easy: across 12 seeded games (alternating colours) Medium wins at least 10', () => {
    let wins = 0;
    for (let g = 0; g < 12; g++) {
      const rng = mulberry32(2000 + g);
      const medSide: Side = g % 2 === 0 ? DARK : LIGHT;
      const out = playOut((s) => (s.toMove === medSide ? bestMove(s.board, s.toMove, LEVEL_LIMIT.medium, rng) : randomMove(s.board, s.toMove, rng)));
      if (out.outcome.winner === medSide) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(10);
  }, 120000);

  it('Hard (depth 5) beats Easy: across 6 seeded games (alternating colours) Hard wins at least 5', () => {
    let wins = 0;
    for (let g = 0; g < 6; g++) {
      const rng = mulberry32(3000 + g);
      const hardSide: Side = g % 2 === 0 ? DARK : LIGHT;
      const out = playOut((s) => (s.toMove === hardSide ? bestMove(s.board, s.toMove, { depth: 5, guard: true }, rng) : randomMove(s.board, s.toMove, rng)));
      if (out.outcome.winner === hardSide) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 120000);
});

describe('Hard answers quickly', () => {
  it('the real Hard setting (depth 7, about 1 s cap) always answers in well under 1.5 s', () => {
    expect(LEVEL_LIMIT.hard).toEqual({ depth: 7, timeMs: 1000, guard: true });
    const rng = mulberry32(31);
    let s = initialState();
    let worst = 0;
    let asked = 0;
    for (let ply = 0; ply < 80; ply++) {
      if (result(s.board, s.toMove, s.quiet).over) break;
      if (ply % 5 === 0) {
        const t = performance.now();
        const m = chooseMove(s.board, s.toMove, 'hard', rng);
        worst = Math.max(worst, performance.now() - t);
        asked++;
        expect(legalPath(s, m)).toBe(true);
      }
      s = stepState(s, randomMove(s.board, s.toMove, rng) as Move);
    }
    expect(asked).toBeGreaterThanOrEqual(5);
    expect(worst).toBeLessThan(1500);
  }, 60000);
  const legalPath = (s: GameState, m: Move | null): boolean => !!m && !!findMove(s.board, s.toMove, m.path);
});

describe('self-play fuzz', () => {
  it('300 random games all end legally with the piece counts conserved', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      const g = playOut((s) => randomMove(s.board, s.toMove, rng), 600);
      expect(g.outcome.over, `seed ${seed}`).toBe(true);
      expect(g.log[0].side).toBe(DARK);
      for (const { side, move, before } of g.log) {
        const after = applyMove(before, move);
        const b0 = countPieces(before);
        const b1 = countPieces(after);
        const own = side === DARK ? 'dark' : 'light';
        const other = side === DARK ? 'light' : 'dark';
        expect(b1[own]).toBe(b0[own]);
        expect(b1[other]).toBe(b0[other] - move.captured.length);
        expect(b1.dark).toBeLessThanOrEqual(12);
        expect(b1.light).toBeLessThanOrEqual(12);
        for (let i = 0; i < 64; i++) if (after[i]) expect(isPlaySquare(i)).toBe(true);
        // A man only ever moves forward.
        const piece = before[move.from];
        if (piece === DARK_MAN) expect(rowOf(move.to)).toBeLessThan(rowOf(move.from));
        if (piece === LIGHT_MAN) expect(rowOf(move.to)).toBeGreaterThan(rowOf(move.from));
        // Crowning happens exactly when a man ends on the far row.
        const far = side === DARK ? 0 : 7;
        const isMan = piece === DARK_MAN || piece === LIGHT_MAN;
        expect(move.crown).toBe(isMan && rowOf(move.to) === far);
        // Captures are mandatory: a simple move is never played while a capture existed.
        if (!move.captured.length) expect(legalMoves(before, side).every((m) => m.captured.length === 0)).toBe(true);
      }
      const end = g.state;
      const final = countPieces(end.board);
      if (g.outcome.winner !== null) {
        const loserPieces = g.outcome.winner === DARK ? final.light : final.dark;
        expect(loserPieces === 0 || !hasMoves(end.board, opponent(g.outcome.winner))).toBe(true);
      }
    }
  }, 120000);
  it('mixed-level games (Easy, Medium, Hard at depth 2) also end legally', () => {
    const levels: Level[] = ['easy', 'medium', 'hard'];
    for (let seed = 1; seed <= 9; seed++) {
      const rng = mulberry32(seed + 500);
      const g = playOut((s) => {
        const level = levels[(seed + (s.toMove === DARK ? 0 : 1)) % 3];
        return level === 'hard' ? bestMove(s.board, s.toMove, { depth: 2, guard: true }, rng) : chooseMove(s.board, s.toMove, level, rng);
      }, 400);
      expect(g.outcome.over).toBe(true);
    }
  }, 120000);
});

describe('evaluation', () => {
  it('is zero for both sides on the opening position', () => {
    const b = initialBoard();
    expect(evaluate(b, DARK)).toBe(0);
    expect(evaluate(b, LIGHT)).toBe(0);
    expect(evaluate(b, DARK, true)).toBe(0);
  });
  it('is zero-sum between the two sides', () => {
    const rng = mulberry32(8);
    let s = initialState();
    for (let i = 0; i < 24; i++) {
      const m = randomMove(s.board, s.toMove, rng);
      if (!m) break;
      s = stepState(s, m);
      expect(evaluate(s.board, DARK) + evaluate(s.board, LIGHT)).toBe(0);
    }
  });
  it('values a king above a man and an extra piece above nothing', () => {
    expect(MAN_VALUE).toBe(100);
    expect(KING_VALUE).toBe(165);
    const man = parseBoard(EMPTY_ROW.repeat(7) + 'x.......');
    const king = parseBoard(EMPTY_ROW.repeat(7) + 'X.......');
    expect(evaluate(king, DARK)).toBeGreaterThan(evaluate(man, DARK));
    const up = parseBoard(EMPTY_ROW + '..o.....' + EMPTY_ROW.repeat(5) + 'x.x.....');
    const even = parseBoard(EMPTY_ROW + '..o.....' + EMPTY_ROW.repeat(5) + 'x.......');
    expect(evaluate(up, DARK)).toBeGreaterThan(evaluate(even, DARK));
  });
  it('rewards an advanced man and, with the guard on, a man kept on the back row', () => {
    const home = parseBoard(EMPTY_ROW.repeat(7) + '..x.....');
    const advanced = parseBoard(EMPTY_ROW.repeat(4) + '...x....' + EMPTY_ROW.repeat(3));
    expect(evaluate(advanced, DARK)).toBeGreaterThan(evaluate(home, DARK));
    expect(evaluate(home, DARK, true)).toBeGreaterThan(evaluate(home, DARK, false));
    expect(evaluate(advanced, DARK, true)).toBe(evaluate(advanced, DARK, false));
  });
  it('the sign flips with the side', () => {
    const one = parseBoard(EMPTY_ROW.repeat(7) + 'x.......');
    expect(evaluate(one, DARK)).toBe(-evaluate(one, LIGHT));
  });
});
