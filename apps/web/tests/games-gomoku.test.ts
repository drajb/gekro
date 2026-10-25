/**
 * games-gomoku.test.ts - the engine behind `gomoku`.
 *
 * Pinned: freestyle win detection in all four directions (five, six and longer lines
 * all win, four does not), no wrap-around between rows, draws on a full board, the
 * candidate neighbourhood, the pattern table, threat detection, the three computer
 * levels (always finish a four, always block a four, never an occupied cell,
 * deterministic for a seed, Hard answers within its time cap), game state with undo,
 * and self-play fuzz games that must end legally.
 */
import { describe, it, expect } from 'vitest';
import {
  newBoard, parseBoard, boardToString, sizeOf, centerOf, cellName, rowOf, colOf, placeStone, takeBack, lineAt, findWinner, isFull,
  countStones, candidates, directionClasses, classOfLine, attackScore, defenseScore, scoreCell, winningCells, openFourCells, threats,
  evaluate, forcedWin, randomMove, scoredMove, searchMove, bestMove, newGame, playMove, replay, undoMoves, undoCountVsComputer, stonesOf,
  sideOfMove, describeResult, mulberry32, shuffled, opponent, nameOf, EMPTY, SOLID, RING, SIZES, DEFAULT_SIZE, DIRS, CLASS,
  PATTERN_STATES, HARD_DEPTH, HARD_BREADTH, FORCING_FOURS,
  type Board, type Side, type Level, type Game,
} from '../src/components/apps-private/gomoku/helpers';

const rc = (n: number) => (r: number, c: number): number => r * n + c;
const asc = (a: number[]): number[] => a.slice().sort((x, y) => x - y);

/** A board of size n with the given stones, as [row, col] pairs. */
const mk = (n: number, solid: [number, number][] = [], ring: [number, number][] = []): Board => {
  const b = newBoard(n);
  for (const [r, c] of solid) b[r * n + c] = SOLID;
  for (const [r, c] of ring) b[r * n + c] = RING;
  return b;
};

/** `len` cells in a line from (r, c) in direction `d`. */
const lineCells = (n: number, r: number, c: number, d: number, len: number): number[] =>
  Array.from({ length: len }, (_, k) => (r + DIRS[d][0] * k) * n + (c + DIRS[d][1] * k));

const fill = (b: Board, cells: number[], side: Side): Board => { for (const i of cells) b[i] = side; return b; };

/** Legal random moves until the game ends. */
const randomGame = (n: number, rng: () => number): Game => {
  let g = newGame(n);
  while (g.status === 'playing') {
    const empties: number[] = [];
    for (let i = 0; i < g.board.length; i++) if (g.board[i] === EMPTY) empties.push(i);
    g = playMove(g, empties[Math.floor(rng() * empties.length)]) as Game;
  }
  return g;
};

/** Play a game where `pick` chooses each move. */
const playOut = (n: number, pick: (b: Board, side: Side, ply: number) => number, maxPlies = 400): Game => {
  let g = newGame(n);
  for (let ply = 0; g.status === 'playing' && ply < maxPlies; ply++) {
    const cell = pick(g.board, g.toMove, ply);
    const next = playMove(g, cell);
    if (!next) throw new Error(`illegal move ${cell} at ply ${ply}`);
    g = next;
  }
  return g;
};

/** The pattern with no five anywhere: two-wide stripes shifted one cell per row. */
const drawBoard = (n: number): Board => {
  const b = newBoard(n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) b[r * n + c] = (Math.floor(c / 2) + r) % 2 === 0 ? SOLID : RING;
  return b;
};

describe('board basics', () => {
  it('offers the three sizes with 13 as the default', () => {
    expect([...SIZES]).toEqual([9, 13, 15]);
    expect(DEFAULT_SIZE).toBe(13);
    for (const n of SIZES) expect(sizeOf(newBoard(n))).toBe(n);
  });
  it('names cells with 1-based rows and columns and finds the centre', () => {
    expect(cellName(0, 13)).toBe('row 1, column 1');
    expect(cellName(13 * 13 - 1, 13)).toBe('row 13, column 13');
    expect(rowOf(rc(15)(4, 9), 15)).toBe(4);
    expect(colOf(rc(15)(4, 9), 15)).toBe(9);
    expect(centerOf(9)).toBe(rc(9)(4, 4));
    expect(centerOf(13)).toBe(rc(13)(6, 6));
    expect(centerOf(15)).toBe(rc(15)(7, 7));
  });
  it('round-trips through the text format and rejects non-square input', () => {
    const b = mk(9, [[0, 0], [4, 4]], [[8, 8], [1, 2]]);
    expect(parseBoard(boardToString(b))).toEqual(b);
    expect(() => parseBoard('xo.')).toThrow(RangeError);
    expect(() => parseBoard('')).toThrow(RangeError);
  });
  it('places a stone on a copy and refuses occupied or out-of-range cells', () => {
    const b = newBoard(9);
    const copy = b.slice();
    const next = placeStone(b, 10, SOLID)!;
    expect(next[10]).toBe(SOLID);
    expect(b).toEqual(copy);
    expect(placeStone(next, 10, RING)).toBeNull();
    expect(placeStone(b, -1, SOLID)).toBeNull();
    expect(placeStone(b, 81, SOLID)).toBeNull();
    expect(placeStone(b, 1.5, SOLID)).toBeNull();
  });
  it('takes a stone back on a copy', () => {
    const b = placeStone(newBoard(9), 40, RING)!;
    const back = takeBack(b, 40)!;
    expect(back[40]).toBe(EMPTY);
    expect(b[40]).toBe(RING);
    expect(takeBack(back, 40)).toBeNull();
    expect(takeBack(b, 99)).toBeNull();
  });
  it('counts stones and sides', () => {
    expect(countStones(mk(9, [[0, 0], [1, 1]], [[2, 2]]))).toEqual({ solid: 2, ring: 1, empty: 78 });
    expect(opponent(SOLID)).toBe(RING);
    expect(opponent(RING)).toBe(SOLID);
    expect(nameOf(SOLID)).toBe('Solid');
    expect(nameOf(RING)).toBe('Ring');
  });
});

describe('win detection', () => {
  const dirNames = ['across', 'down', 'down-right', 'down-left'];
  for (const n of SIZES) {
    for (let d = 0; d < 4; d++) {
      it(`${n} x ${n}: five ${dirNames[d]} wins at every starting position`, () => {
        let tested = 0;
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const er = r + DIRS[d][0] * 4;
            const ec = c + DIRS[d][1] * 4;
            if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
            const cells = lineCells(n, r, c, d, 5);
            const b = fill(newBoard(n), cells, SOLID);
            for (const i of cells) expect(lineAt(b, i)).toEqual(asc(cells));
            expect(findWinner(b)).toEqual({ side: SOLID, line: asc(cells) });
            tested++;
          }
        }
        expect(tested).toBeGreaterThan(0);
      });
    }
  }

  it('four in a row does not win in any direction', () => {
    for (let d = 0; d < 4; d++) {
      const cells = lineCells(13, 5, 4, d, 4);
      const b = fill(newBoard(13), cells, RING);
      expect(findWinner(b)).toBeNull();
      for (const i of cells) expect(lineAt(b, i)).toBeNull();
    }
  });
  it('freestyle: six, seven and nine in a row all win, and the whole line is reported', () => {
    for (let d = 0; d < 4; d++) {
      for (const len of [6, 7, 9]) {
        const cells = lineCells(15, d === 3 ? 0 : 1, d === 3 ? 10 : 2, d, len);
        const b = fill(newBoard(15), cells, RING);
        expect(findWinner(b)).toEqual({ side: RING, line: asc(cells) });
        expect(lineAt(b, cells[Math.floor(len / 2)])).toEqual(asc(cells));
      }
    }
  });
  it('joining two groups into an overline wins (xx.xxx filled in the middle)', () => {
    const b = fill(newBoard(13), [rc(13)(6, 2), rc(13)(6, 3), rc(13)(6, 5), rc(13)(6, 6), rc(13)(6, 7)], SOLID);
    expect(findWinner(b)).toBeNull();
    const after = placeStone(b, rc(13)(6, 4), SOLID)!;
    expect(lineAt(after, rc(13)(6, 4))).toEqual([2, 3, 4, 5, 6, 7].map((c) => rc(13)(6, c)));
  });
  it('a line broken by an enemy stone or a gap is not a win', () => {
    expect(findWinner(parseBoard(`
      .........
      .........
      .........
      .........
      xxxoxx...
      .........
      .........
      .........
      .........`))).toBeNull();
    expect(findWinner(parseBoard(`
      .........
      .........
      .........
      .........
      xx.xxx...
      .........
      .........
      .........
      .........`))).toBeNull();
  });
  it('stones of two colours never combine into a line', () => {
    const b = newBoard(9);
    [0, 1, 2, 3].forEach((c) => { b[rc(9)(4, c)] = SOLID; });
    [4, 5, 6, 7, 8].forEach((c) => { b[rc(9)(4, c)] = RING; });
    expect(findWinner(b)).toEqual({ side: RING, line: [4, 5, 6, 7, 8].map((c) => rc(9)(4, c)) });
    expect(lineAt(b, rc(9)(4, 3))).toBeNull();
  });
  it('one stone that finishes two lines reports both', () => {
    const n = 13;
    const cross = [...lineCells(n, 4, 6, 1, 2), ...lineCells(n, 7, 6, 1, 2), ...lineCells(n, 6, 4, 0, 2), ...lineCells(n, 6, 7, 0, 2)];
    const b = fill(newBoard(n), cross, SOLID);
    expect(findWinner(b)).toBeNull();
    const done = placeStone(b, rc(n)(6, 6), SOLID)!;
    const expected = asc([...cross, rc(n)(6, 6)]);
    expect(lineAt(done, rc(n)(6, 6))).toEqual(expected);
  });
  it('lineAt is null for an empty cell and for out-of-range input', () => {
    const b = newBoard(9);
    expect(lineAt(b, 0)).toBeNull();
    expect(lineAt(b, -1)).toBeNull();
    expect(lineAt(b, 81)).toBeNull();
  });

  describe('edges: no wrap-around between rows or around the board', () => {
    it('five consecutive indices across a row break are not a line', () => {
      // (r, 5..8) then (r+1, 0) are five consecutive cell numbers on a 9 x 9 board.
      const b = fill(newBoard(9), [rc(9)(2, 5), rc(9)(2, 6), rc(9)(2, 7), rc(9)(2, 8), rc(9)(3, 0)], SOLID);
      expect(findWinner(b)).toBeNull();
      for (const n of [9, 13, 15]) {
        const w = fill(newBoard(n), [rc(n)(3, n - 3), rc(n)(3, n - 2), rc(n)(3, n - 1), rc(n)(4, 0), rc(n)(4, 1)], RING);
        expect(findWinner(w)).toBeNull();
        expect(lineAt(w, rc(n)(4, 0))).toBeNull();
      }
    });
    it('a diagonal that leaves the board and re-enters on the other side is not a line', () => {
      const n = 9;
      // (0,6), (1,7), (2,8) then wrapping would continue at (3,0), (4,1) in index space.
      const b = fill(newBoard(n), [rc(n)(0, 6), rc(n)(1, 7), rc(n)(2, 8), rc(n)(3, 0), rc(n)(4, 1)], SOLID);
      expect(findWinner(b)).toBeNull();
      // Down-left: (0,2), (1,1), (2,0) then wrapping would continue at (2,8), (3,7).
      const c = fill(newBoard(n), [rc(n)(0, 2), rc(n)(1, 1), rc(n)(2, 0), rc(n)(2, 8), rc(n)(3, 7)], SOLID);
      expect(findWinner(c)).toBeNull();
    });
    it('a column of five touching the top, bottom, left and right edges wins', () => {
      const n = 9;
      expect(findWinner(fill(newBoard(n), lineCells(n, 0, 0, 1, 5), SOLID))).not.toBeNull();
      expect(findWinner(fill(newBoard(n), lineCells(n, 4, 8, 1, 5), SOLID))).not.toBeNull();
      expect(findWinner(fill(newBoard(n), lineCells(n, 8, 4, 0, 5), SOLID))).not.toBeNull();
      expect(findWinner(fill(newBoard(n), lineCells(n, 0, 4, 0, 5), SOLID))).not.toBeNull();
      expect(findWinner(fill(newBoard(n), lineCells(n, 0, 8, 3, 5), SOLID))).not.toBeNull();
      expect(findWinner(fill(newBoard(n), lineCells(n, 4, 0, 2, 5), SOLID))).not.toBeNull();
    });
    it('corner stones: a diagonal of five from corner to corner of the winning area wins', () => {
      const n = 9;
      expect(findWinner(fill(newBoard(n), lineCells(n, 0, 0, 2, 9), RING))!.line).toHaveLength(9);
    });
  });
});

describe('draws', () => {
  for (const n of SIZES) {
    it(`${n} x ${n}: the stripe pattern fills the board with no five anywhere`, () => {
      const b = drawBoard(n);
      expect(isFull(b)).toBe(true);
      expect(findWinner(b)).toBeNull();
      for (let i = 0; i < b.length; i++) expect(lineAt(b, i)).toBeNull();
    });
  }
  for (const n of SIZES) {
    it(`${n} x ${n}: playing the pattern out move by move ends in a draw, never a win on the way`, () => {
      const b = drawBoard(n);
      const solids: number[] = [];
      const rings: number[] = [];
      b.forEach((v, i) => (v === SOLID ? solids : rings).push(i));
      expect(solids.length).toBe(rings.length + 1); // the first player makes the last move on an odd board
      const order: number[] = [];
      for (let k = 0; k < solids.length; k++) { order.push(solids[k]); if (k < rings.length) order.push(rings[k]); }
      let g = newGame(n);
      for (const [k, cell] of order.entries()) {
        expect(g.status).toBe('playing');
        g = playMove(g, cell) as Game;
        if (k < order.length - 1) expect(g.status).toBe('playing');
      }
      expect(g.status).toBe('draw');
      expect(g.winner).toBe(0);
      expect(g.line).toEqual([]);
      expect(playMove(g, 0)).toBeNull();
      expect(describeResult(g, null)).toContain('Draw');
    });
  }
  it('a nearly full board is not a draw yet', () => {
    const b = drawBoard(9);
    b[40] = EMPTY;
    expect(isFull(b)).toBe(false);
  });
});

describe('candidate generation', () => {
  it('on an empty board the only candidate is the centre', () => {
    for (const n of SIZES) expect(candidates(newBoard(n))).toEqual([centerOf(n)]);
  });
  it('lists exactly the empty cells within 2 of a stone, in ascending order', () => {
    const n = 13;
    const b = mk(n, [[6, 6]]);
    const c = candidates(b, 2);
    expect(c).toHaveLength(24);
    expect(c).toEqual(asc(c));
    expect(c.includes(rc(n)(6, 6))).toBe(false);
    for (const i of c) expect(Math.max(Math.abs(rowOf(i, n) - 6), Math.abs(colOf(i, n) - 6))).toBeLessThanOrEqual(2);
    expect(c.includes(rc(n)(6, 9))).toBe(false); // 3 away
    expect(c.includes(rc(n)(9, 9))).toBe(false);
    expect(c.includes(rc(n)(8, 8))).toBe(true);
  });
  it('radius 1 gives the eight neighbours', () => {
    expect(candidates(mk(13, [[6, 6]]), 1)).toHaveLength(8);
  });
  it('is clipped at the edges and corners', () => {
    expect(candidates(mk(9, [[0, 0]]), 2)).toHaveLength(8);
    expect(candidates(mk(9, [[0, 4]]), 2)).toHaveLength(14); // 3 rows x 5 columns, minus the stone
  });
  it('merges the neighbourhoods of several stones and excludes occupied cells', () => {
    const b = mk(13, [[2, 2]], [[2, 3]]);
    const c = candidates(b, 2);
    expect(c.includes(rc(13)(2, 3))).toBe(false);
    expect(c.includes(rc(13)(2, 2))).toBe(false);
    expect(c.includes(rc(13)(2, 5))).toBe(true); // 2 from the ring stone
    expect(c.includes(rc(13)(2, 6))).toBe(false);
  });
  it('shrinks to nothing on a full board', () => {
    expect(candidates(drawBoard(9))).toEqual([]);
  });
});

describe('pattern table', () => {
  it('has 3^8 states, every one classified', () => {
    expect(PATTERN_STATES).toBe(6561);
    for (let i = 0; i < PATTERN_STATES; i += 97) {
      const line = [0, 0, 0, 0, 1, 0, 0, 0, 0];
      let v = i;
      for (const k of [0, 1, 2, 3, 5, 6, 7, 8]) { line[k] = v % 3; v = Math.floor(v / 3); }
      const cls = classOfLine(line);
      expect(cls).toBeGreaterThanOrEqual(0);
      expect(cls).toBeLessThanOrEqual(CLASS.five);
    }
  });
  const cls = (b: Board, r: number, c: number, side: Side = SOLID): number[] => directionClasses(b, r * sizeOf(b) + c, side);
  it('classifies a lone stone as nothing and two open stones as an open two', () => {
    expect(Math.max(...cls(newBoard(13), 6, 6))).toBe(CLASS.none);
    expect(cls(mk(13, [[6, 5]]), 6, 6)[0]).toBe(CLASS.openTwo);
  });
  it('classifies a blocked two as a plain two, and a two with no room for five as nothing', () => {
    expect(cls(mk(13, [[6, 5]], [[6, 2], [6, 8]]), 6, 6)[0]).toBe(CLASS.two); // exactly five free cells
    expect(cls(mk(13, [[6, 5]], [[6, 3], [6, 8]]), 6, 6)[0]).toBe(CLASS.none); // only four free cells: can never be five
  });
  it('classifies open and blocked threes', () => {
    expect(cls(mk(13, [[6, 4], [6, 5]]), 6, 6)[0]).toBe(CLASS.openThree);
    expect(cls(mk(13, [[6, 4], [6, 5]], [[6, 3]]), 6, 6)[0]).toBe(CLASS.three);
    expect(cls(mk(13, [[6, 4], [6, 5]], [[6, 7]]), 6, 6)[0]).toBe(CLASS.three);
  });
  it('a split three (xx.x with room on both sides) counts as an open three', () => {
    expect(cls(mk(13, [[6, 3], [6, 4]]), 6, 6)[0]).toBe(CLASS.openThree);
  });
  it('classifies fours: open four with two finishing cells, plain four with one', () => {
    expect(cls(mk(13, [[6, 4], [6, 5], [6, 6]]), 6, 7)[0]).toBe(CLASS.openFour);
    expect(cls(mk(13, [[6, 4], [6, 5], [6, 6]], [[6, 3]]), 6, 7)[0]).toBe(CLASS.four);
    expect(cls(mk(9, [[4, 5], [4, 6], [4, 7]]), 4, 8)[0]).toBe(CLASS.four); // the edge blocks one end
    expect(cls(mk(13, [[6, 3], [6, 4], [6, 6], [6, 7]]), 6, 5)[0]).toBe(CLASS.five);
    expect(cls(mk(13, [[6, 3], [6, 4], [6, 6]]), 6, 7)[0]).toBe(CLASS.four); // x x . x X : fill the gap to finish
  });
  it('classifies five and longer', () => {
    expect(cls(mk(13, [[6, 3], [6, 4], [6, 5], [6, 6]]), 6, 7)[0]).toBe(CLASS.five);
    expect(cls(mk(13, [[6, 3], [6, 4], [6, 5], [6, 7], [6, 8]]), 6, 6)[0]).toBe(CLASS.five); // makes six
  });
  it('uses the same table in all four directions', () => {
    const n = 13;
    for (let d = 0; d < 4; d++) {
      const stones = lineCells(n, 4 + (d === 3 ? 0 : 0), d === 3 ? 8 : 4, d, 3).map((i) => [rowOf(i, n), colOf(i, n)] as [number, number]);
      const b = mk(n, stones);
      const [r, c] = [stones[2][0] + DIRS[d][0], stones[2][1] + DIRS[d][1]];
      expect(directionClasses(b, r * n + c, SOLID)[d]).toBe(CLASS.openFour);
    }
  });
  it('treats the board edge as a block', () => {
    // Three at the edge of a 9 x 9 board: the fourth stone has only one open end.
    expect(cls(mk(9, [[0, 0], [0, 1], [0, 2]]), 0, 3)[0]).toBe(CLASS.four);
    // A column running along the left edge is not blocked by that edge: it is open at both ends.
    expect(cls(mk(9, [[3, 0], [4, 0]]), 5, 0)[1]).toBe(CLASS.openThree);
  });
  it('judges enemy stones as blocks, and the other side as its own', () => {
    const b = mk(13, [[6, 4], [6, 5]], [[6, 7]]);
    expect(cls(b, 6, 6, SOLID)[0]).toBe(CLASS.three);
    // For Ring the cell next to its own stone at (6,7) is a closed two: Solid's stones block the left.
    expect(cls(b, 6, 6, RING)[0]).toBe(CLASS.two);
  });
});

describe('scoring', () => {
  it('ranks shapes: five > open four > four > open three > three > open two', () => {
    const n = 13;
    const five = attackScore(mk(n, [[6, 3], [6, 4], [6, 5], [6, 6]]), rc(n)(6, 7), SOLID);
    const open4 = attackScore(mk(n, [[6, 4], [6, 5], [6, 6]]), rc(n)(6, 7), SOLID);
    const four = attackScore(mk(n, [[6, 4], [6, 5], [6, 6]], [[6, 3]]), rc(n)(6, 7), SOLID);
    const open3 = attackScore(mk(n, [[6, 4], [6, 5]]), rc(n)(6, 6), SOLID);
    const three = attackScore(mk(n, [[6, 4], [6, 5]], [[6, 3]]), rc(n)(6, 6), SOLID);
    const open2 = attackScore(mk(n, [[6, 5]]), rc(n)(6, 6), SOLID);
    expect(five).toBeGreaterThan(open4);
    expect(open4).toBeGreaterThan(four);
    expect(four).toBeGreaterThan(open3);
    expect(open3).toBeGreaterThan(three);
    expect(three).toBeGreaterThan(open2);
    expect(open2).toBeGreaterThan(0);
  });
  it('a four-three and a double four score above a lone open three', () => {
    const n = 13;
    // Placing at (6,6): a four across (3 stones + this one with the far end blocked) and an open three down.
    const fourThree = mk(n, [[6, 3], [6, 4], [6, 5], [4, 6], [5, 6]], [[6, 2]]);
    expect(attackScore(fourThree, rc(n)(6, 6), SOLID)).toBeGreaterThan(attackScore(mk(n, [[6, 4], [6, 5]]), rc(n)(6, 6), SOLID) + 10000);
  });
  it('defense scores what the opponent would build there, and a block of their five outranks everything but our own five', () => {
    const n = 13;
    const b = mk(n, [[0, 0]], [[6, 3], [6, 4], [6, 5], [6, 6]]);
    const block = scoreCell(b, rc(n)(6, 7), SOLID);
    expect(defenseScore(b, rc(n)(6, 7), SOLID)).toBeGreaterThanOrEqual(900000);
    expect(block).toBeGreaterThan(scoreCell(b, rc(n)(2, 2), SOLID));
    const own = mk(n, [[0, 0], [1, 0], [2, 0], [3, 0]], [[6, 3], [6, 4], [6, 5], [6, 6]]);
    expect(scoreCell(own, rc(n)(4, 0), SOLID)).toBeGreaterThan(scoreCell(own, rc(n)(6, 7), SOLID));
  });
  it('blocking an open three scores above building a lone open two', () => {
    const n = 13;
    const b = mk(n, [[2, 2]], [[6, 5], [6, 6], [6, 7]]);
    expect(scoreCell(b, rc(n)(6, 4), SOLID)).toBeGreaterThan(scoreCell(b, rc(n)(3, 3), SOLID));
  });
});

describe('threat detection', () => {
  it('finds every cell that completes a five', () => {
    const n = 13;
    const b = mk(n, [[6, 3], [6, 4], [6, 5], [6, 6]]);
    expect(winningCells(b, SOLID)).toEqual([rc(n)(6, 2), rc(n)(6, 7)]);
    expect(winningCells(b, RING)).toEqual([]);
  });
  it('finds the gap in a split four and the cell that makes an overline', () => {
    const n = 13;
    expect(winningCells(mk(n, [[6, 3], [6, 4], [6, 6], [6, 7]]), SOLID)).toEqual([rc(n)(6, 5)]);
    expect(winningCells(mk(n, [[6, 1], [6, 2], [6, 3], [6, 5], [6, 6]]), SOLID)).toEqual([rc(n)(6, 4)]); // makes six
    expect(winningCells(mk(n, [[6, 5], [6, 6], [6, 7], [6, 8], [6, 10]]), SOLID)).toEqual([rc(n)(6, 4), rc(n)(6, 9)]);
  });
  it('finds winning cells in every direction', () => {
    for (let d = 0; d < 4; d++) {
      const n = 13;
      const cells = lineCells(n, d === 3 ? 3 : 3, d === 3 ? 9 : 3, d, 5);
      const b = fill(newBoard(n), cells, RING);
      const hole = cells[2];
      b[hole] = EMPTY;
      expect(winningCells(b, RING)).toEqual([hole]);
    }
  });
  it('a blocked end removes that winning cell', () => {
    const n = 13;
    const b = mk(n, [[6, 3], [6, 4], [6, 5], [6, 6]], [[6, 7]]);
    expect(winningCells(b, SOLID)).toEqual([rc(n)(6, 2)]);
  });
  it('lists open-four cells and keeps them apart from plain fours', () => {
    const n = 13;
    const open3 = mk(n, [[6, 4], [6, 5], [6, 6]]);
    expect(openFourCells(open3, SOLID)).toEqual([rc(n)(6, 3), rc(n)(6, 7)]);
    expect(winningCells(open3, SOLID)).toEqual([]);
    const closed = mk(n, [[6, 4], [6, 5], [6, 6]], [[6, 3]]);
    expect(openFourCells(closed, SOLID)).toEqual([]);
    expect(threats(open3, SOLID)).toEqual({ win: [], openFour: [rc(n)(6, 3), rc(n)(6, 7)] });
  });
  it('an open four leaves two winning cells', () => {
    const n = 13;
    const b = mk(n, [[6, 4], [6, 5], [6, 6], [6, 7]]);
    expect(winningCells(b, SOLID)).toEqual([rc(n)(6, 3), rc(n)(6, 8)]);
  });
});

describe('static evaluation', () => {
  it('is zero on an empty board and antisymmetric between the sides', () => {
    for (const n of SIZES) {
      expect(evaluate(newBoard(n), SOLID, SOLID)).toBe(0);
      const b = mk(n, [[4, 4], [4, 5]], [[5, 4]]);
      expect(evaluate(b, SOLID, SOLID)).toBe(-evaluate(b, RING, SOLID));
    }
  });
  it('rewards longer open lines and punishes the opponent having them', () => {
    const n = 13;
    const two = mk(n, [[6, 5], [6, 6]]);
    const three = mk(n, [[6, 5], [6, 6], [6, 7]]);
    expect(evaluate(three, SOLID, RING)).toBeGreaterThan(evaluate(two, SOLID, RING));
    expect(evaluate(three, RING, SOLID)).toBeLessThan(evaluate(two, RING, SOLID));
  });
  it('a blocked line is worth less than an open one', () => {
    const n = 13;
    const open = mk(n, [[6, 5], [6, 6], [6, 7]]);
    const blocked = mk(n, [[6, 5], [6, 6], [6, 7]], [[6, 4]]);
    expect(evaluate(open, SOLID, RING)).toBeGreaterThan(evaluate(blocked, SOLID, RING) + 1);
  });
  it('the side to move wins at once with a four, and loses against an open four', () => {
    const n = 13;
    const four = mk(n, [[6, 4], [6, 5], [6, 6], [6, 7]]);
    expect(evaluate(four, SOLID, SOLID)).toBeGreaterThan(400000);
    expect(evaluate(four, RING, SOLID)).toBeLessThan(-400000); // an open four, Ring to move cannot stop both ends
    expect(evaluate(four, RING, RING)).toBeLessThan(-400000);
    const closed = mk(n, [[6, 4], [6, 5], [6, 6], [6, 7]], [[6, 3]]);
    expect(evaluate(closed, RING, RING)).toBeGreaterThan(-400000); // one finishing cell: Ring can block it
  });
  it('a mover who can make an open four is scored as winning, unless they must first stop a four', () => {
    const n = 13;
    const open3 = mk(n, [[6, 4], [6, 5], [6, 6]], [[0, 0]]);
    expect(evaluate(open3, SOLID, SOLID)).toBeGreaterThan(400000);
    expect(evaluate(open3, RING, SOLID)).toBeLessThan(-400000);
    // Same three, but Ring to move and facing a four of Solid's elsewhere is not an automatic win for Ring.
    const withFour = mk(n, [[6, 4], [6, 5], [6, 6], [10, 4], [10, 5], [10, 6], [10, 7]], [[10, 3], [0, 0]]);
    expect(evaluate(withFour, RING, RING)).toBeLessThan(400000);
  });
  it('a bare open three is worse for the side that has to move against it than a bare two', () => {
    const n = 13;
    const two = mk(n, [[6, 5], [6, 6]], [[0, 0]]);
    const three = mk(n, [[6, 4], [6, 5], [6, 6]], [[0, 0]]);
    expect(evaluate(three, RING, RING)).toBeLessThan(evaluate(two, RING, RING));
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
    expect(asc(out)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

const LEVELS: Level[] = ['easy', 'medium', 'hard'];

describe('computer players: forced moves', () => {
  it('opens in the centre at every level on every size', () => {
    for (const n of SIZES) for (const level of LEVELS) expect(bestMove(newBoard(n), SOLID, level, mulberry32(1))).toBe(centerOf(n));
  });
  it('returns -1 on a full board', () => {
    for (const level of LEVELS) expect(bestMove(drawBoard(9), SOLID, level, mulberry32(1))).toBe(-1);
    expect(randomMove(drawBoard(9), mulberry32(1))).toBe(-1);
    expect(scoredMove(drawBoard(9), SOLID, mulberry32(1))).toBe(-1);
    expect(searchMove(drawBoard(9), SOLID, mulberry32(1))).toBe(-1);
  });

  // For each level, direction and orientation: the computer holds four of five and must finish.
  for (const level of LEVELS) {
    it(`${level}: always completes its own five when it holds a four (every direction, both ends, split fours)`, () => {
      const n = 13;
      for (let d = 0; d < 4; d++) {
        for (let hole = 0; hole < 5; hole++) {
          const cells = lineCells(n, d === 3 ? 4 : 4, d === 3 ? 9 : 3, d, 5);
          const b = fill(newBoard(n), cells, RING);
          b[cells[hole]] = EMPTY;
          // Plenty of distracting enemy stones elsewhere, none of which make a threat.
          fill(b, [rc(n)(10, 1), rc(n)(10, 5), rc(n)(1, 11), rc(n)(11, 11)], SOLID);
          const m = bestMove(b, RING, level, mulberry32(d * 10 + hole));
          // A four with free cells beyond it can be finished in more than one place; any finish wins.
          expect(winningCells(b, RING), `${level} d${d} hole${hole}`).toContain(m);
          expect(lineAt(placeStone(b, m, RING)!, m), `${level} d${d} hole${hole}`).not.toBeNull();
          if (hole >= 1 && hole <= 3) expect(m).toBe(cells[hole]); // an inside gap is the only finish
        }
      }
    });
    it(`${level}: completes an open four (picks either finishing end) and a four at the board edge`, () => {
      const n = 13;
      const open = mk(n, [[6, 4], [6, 5], [6, 6], [6, 7]], [[2, 2]]);
      expect([rc(n)(6, 3), rc(n)(6, 8)]).toContain(bestMove(open, SOLID, level, mulberry32(4)));
      const edge = mk(n, [[0, 4], [0, 5], [0, 6], [0, 7]], [[0, 3]]);
      expect(bestMove(edge, SOLID, level, mulberry32(5))).toBe(rc(n)(0, 8));
    });
    it(`${level}: makes an overline when that is the only way to win`, () => {
      const n = 13;
      const b = mk(n, [[6, 1], [6, 2], [6, 3], [6, 5], [6, 6]], [[2, 2]]);
      expect(bestMove(b, SOLID, level, mulberry32(6))).toBe(rc(n)(6, 4));
    });
    it(`${level}: blocks the opponent's four when it cannot win itself (every direction, split fours)`, () => {
      const n = 13;
      for (let d = 0; d < 4; d++) {
        for (let hole = 0; hole < 5; hole++) {
          const cells = lineCells(n, d === 3 ? 4 : 4, d === 3 ? 9 : 3, d, 5);
          const b = fill(newBoard(n), cells, SOLID);
          b[cells[hole]] = EMPTY;
          fill(b, [rc(n)(10, 1), rc(n)(10, 5)], RING);
          const wins = winningCells(b, SOLID);
          const m = bestMove(b, RING, level, mulberry32(d * 10 + hole + 100));
          // With an end four there are two ways to finish; the computer must take one of them.
          expect(wins, `${level} d${d} hole${hole}`).toContain(m);
        }
      }
    });
    it(`${level}: takes its own win in preference to blocking`, () => {
      const n = 13;
      const b = mk(n, [[2, 2], [2, 3], [2, 4], [2, 5]], [[8, 2], [8, 3], [8, 4], [8, 5]]);
      expect([rc(n)(2, 1), rc(n)(2, 6)]).toContain(bestMove(b, SOLID, level, mulberry32(7)));
      expect([rc(n)(8, 1), rc(n)(8, 6)]).toContain(bestMove(b, RING, level, mulberry32(8)));
    });
    it(`${level}: blocks one end of a plain four so the other is the only finish`, () => {
      const n = 13;
      const b = mk(n, [[6, 4], [6, 5], [6, 6], [6, 7]], [[1, 1]]);
      // Solid has an open four; Ring cannot stop both ends but must still pick a legal finishing cell.
      expect([rc(n)(6, 3), rc(n)(6, 8)]).toContain(bestMove(b, RING, level, mulberry32(9)));
    });
    it(`${level}: never plays an occupied cell, over many positions on every size`, () => {
      for (const n of SIZES) {
        for (let seed = 1; seed <= 6; seed++) {
          const rng = mulberry32(seed * 31 + n);
          let g = newGame(n);
          const stop = 4 + Math.floor(rng() * 25);
          while (g.status === 'playing' && g.moves.length < stop) {
            const empties: number[] = [];
            g.board.forEach((v, i) => { if (v === EMPTY) empties.push(i); });
            g = playMove(g, empties[Math.floor(rng() * empties.length)]) as Game;
          }
          if (g.status !== 'playing') continue;
          const m = bestMove(g.board, g.toMove, level, mulberry32(seed), 300);
          expect(m).toBeGreaterThanOrEqual(0);
          expect(g.board[m], `${level} n${n} seed${seed}`).toBe(EMPTY);
        }
      }
    });
  }
});

describe('computer players: behaviour of each level', () => {
  const midgame = (n: number, plies: number, seed: number): Game => {
    const rng = mulberry32(seed);
    let g = newGame(n);
    // Moves near the middle so the position looks like a real game.
    while (g.status === 'playing' && g.moves.length < plies) {
      const c = candidates(g.board, 2);
      g = playMove(g, c[Math.floor(rng() * c.length)]) as Game;
    }
    return g;
  };

  it('Easy only plays next to an existing stone', () => {
    const n = 13;
    for (let seed = 1; seed <= 20; seed++) {
      const g = midgame(n, 6, seed);
      if (g.status !== 'playing' || winningCells(g.board, SOLID).length || winningCells(g.board, RING).length) continue;
      const m = bestMove(g.board, g.toMove, 'easy', mulberry32(seed));
      expect(candidates(g.board, 1)).toContain(m);
    }
  });
  it('Easy varies with the seed and is repeatable for one seed', () => {
    const b = mk(13, [[6, 6]]);
    const seen = new Set<number>();
    for (let s = 1; s <= 60; s++) seen.add(bestMove(b, RING, 'easy', mulberry32(s)));
    expect(seen.size).toBeGreaterThan(4);
    expect(bestMove(b, RING, 'easy', mulberry32(5))).toBe(bestMove(b, RING, 'easy', mulberry32(5)));
  });
  it('Medium and Hard only consider cells within 2 of a stone', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = midgame(15, 8, seed);
      if (g.status !== 'playing') continue;
      const near = candidates(g.board, 2);
      expect(near).toContain(bestMove(g.board, g.toMove, 'medium', mulberry32(seed)));
      expect(near).toContain(bestMove(g.board, g.toMove, 'hard', mulberry32(seed), 400));
    }
  });
  it('Medium and Hard block an open three before it becomes an open four', () => {
    const n = 13;
    const b = mk(n, [[2, 2]], [[6, 5], [6, 6], [6, 7]]);
    const ends = [rc(n)(6, 4), rc(n)(6, 8)];
    for (const level of ['medium', 'hard'] as Level[]) {
      expect(ends, level).toContain(bestMove(b, SOLID, level, mulberry32(3)));
    }
  });
  it('Medium and Hard turn their own open three into an open four', () => {
    const n = 13;
    const b = mk(n, [[6, 5], [6, 6], [6, 7]], [[2, 2], [9, 9]]);
    for (const level of ['medium', 'hard'] as Level[]) {
      const m = bestMove(b, SOLID, level, mulberry32(11));
      const after = placeStone(b, m, SOLID)!;
      expect(winningCells(after, SOLID).length, level).toBeGreaterThanOrEqual(2);
    }
  });
  it('Hard plays out a four-three to a win: the four forces a block, then the open three becomes an open four', () => {
    const n = 13;
    // Solid: three across with Ring on one end, and two stones going down. A four at (6,6) also makes an open three.
    const b = mk(n, [[6, 3], [6, 4], [6, 5], [4, 6], [5, 6]], [[6, 2], [0, 0], [12, 12], [0, 12]]);
    const first = bestMove(b, SOLID, 'hard', mulberry32(2));
    const afterFirst = placeStone(b, first, SOLID)!;
    const forced = winningCells(afterFirst, SOLID);
    expect(forced).toHaveLength(1); // a four: Ring has exactly one block
    const afterBlock = placeStone(afterFirst, forced[0], RING)!;
    const second = bestMove(afterBlock, SOLID, 'hard', mulberry32(3));
    const afterSecond = placeStone(afterBlock, second, SOLID)!;
    expect(winningCells(afterSecond, SOLID).length).toBeGreaterThanOrEqual(2); // an open four: it cannot be stopped
    expect(winningCells(afterSecond, RING)).toEqual([]);
  });
  it('forcedWin finds a win by consecutive fours and refuses positions that have none', () => {
    const n = 13;
    const b = mk(n, [[6, 3], [6, 4], [6, 5], [4, 6], [5, 6]], [[6, 2], [0, 0], [12, 12], [0, 12]]);
    const m = forcedWin(b, SOLID);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(b[m]).toBe(EMPTY);
    // A lone open three is itself a forced win (the next stone makes an open four)...
    expect(forcedWin(mk(n, [[6, 4], [6, 5], [6, 6]], [[0, 0]]), SOLID)).toBeGreaterThanOrEqual(0);
    // ...but a lone two, or a three with both ends blocked, has none.
    expect(forcedWin(mk(n, [[6, 5], [6, 6]], [[0, 0]]), SOLID)).toBe(-1);
    expect(forcedWin(mk(n, [[6, 4], [6, 5], [6, 6]], [[6, 3], [6, 7]]), SOLID)).toBe(-1);
    // An empty board and a full board have none either.
    expect(forcedWin(newBoard(n), SOLID)).toBe(-1);
    expect(forcedWin(drawBoard(9), SOLID)).toBe(-1);
  });
  it('forcedWin does not count a line where the opponent can win first', () => {
    const n = 13;
    // Solid could make a four, but Ring already has a four of its own on the board and moves right after.
    const b = mk(n, [[6, 3], [6, 4], [6, 5], [4, 6], [5, 6]], [[6, 2], [9, 1], [9, 2], [9, 3], [9, 4]]);
    expect(forcedWin(b, SOLID)).toBe(-1);
  });
  it('forcedWin honours its deadline', () => {
    const b = mk(13, [[6, 3], [6, 4], [6, 5], [4, 6], [5, 6]], [[6, 2]]);
    expect(forcedWin(b, SOLID, 4, performance.now() - 1)).toBe(-1);
  });
  it('is deterministic for a seed at every level', () => {
    const g = midgame(13, 10, 9);
    for (const level of LEVELS) {
      expect(bestMove(g.board, g.toMove, level, mulberry32(77), 5000), level).toBe(bestMove(g.board, g.toMove, level, mulberry32(77), 5000));
    }
  });
  it('Medium and Hard vary with the seed when several moves tie', () => {
    const seen = new Set<number>();
    for (let s = 1; s <= 30; s++) seen.add(bestMove(mk(13, [[6, 6]]), RING, 'medium', mulberry32(s)));
    expect(seen.size).toBeGreaterThan(1);
  });
  it('exposes the documented search shape', () => {
    expect(HARD_DEPTH).toBe(3);
    expect(HARD_BREADTH).toBe(12);
    expect(FORCING_FOURS).toBe(4);
  });
});

describe('Hard answers within its time cap', () => {
  it('a one second cap is honoured from the opening to the late game on 15 x 15', () => {
    const rng = mulberry32(31);
    let g = newGame(15);
    let worst = 0;
    for (let ply = 0; ply < 60 && g.status === 'playing'; ply++) {
      if (ply % 6 === 0) {
        const t = performance.now();
        const m = bestMove(g.board, g.toMove, 'hard', rng, 1000);
        worst = Math.max(worst, performance.now() - t);
        expect(g.board[m]).toBe(EMPTY);
      }
      const c = candidates(g.board, 2);
      g = playMove(g, c[Math.floor(rng() * c.length)]) as Game;
    }
    expect(worst).toBeLessThan(1400);
  }, 60000);
  it('a tiny cap still returns a legal move quickly', () => {
    const rng = mulberry32(8);
    let g = newGame(15);
    for (let i = 0; i < 24; i++) {
      const c = candidates(g.board, 2);
      g = playMove(g, c[Math.floor(rng() * c.length)]) as Game;
      if (g.status !== 'playing') break;
    }
    for (const cap of [0, 1, 20]) {
      const t = performance.now();
      const m = bestMove(g.board, g.toMove, 'hard', mulberry32(1), cap);
      expect(performance.now() - t).toBeLessThan(cap + 250);
      expect(g.board[m]).toBe(EMPTY);
    }
  });
  it('typical Hard moves take well under the cap at the default depth', () => {
    const rng = mulberry32(12);
    let g = newGame(13);
    const times: number[] = [];
    for (let ply = 0; ply < 30 && g.status === 'playing'; ply++) {
      const t = performance.now();
      const m = bestMove(g.board, g.toMove, 'hard', rng, 1000);
      times.push(performance.now() - t);
      g = playMove(g, m) as Game;
    }
    expect(Math.max(...times)).toBeLessThan(1400);
  }, 60000);
});

describe('game state and undo', () => {
  it('starts empty with Solid to move', () => {
    const g = newGame(13);
    expect(g.toMove).toBe(SOLID);
    expect(g.moves).toEqual([]);
    expect(g.status).toBe('playing');
    expect(countStones(g.board).empty).toBe(169);
  });
  it('alternates sides, records moves and refuses a taken cell', () => {
    let g = newGame(9);
    g = playMove(g, 40)!;
    expect(g.toMove).toBe(RING);
    expect(g.board[40]).toBe(SOLID);
    expect(playMove(g, 40)).toBeNull();
    g = playMove(g, 41)!;
    expect(g.board[41]).toBe(RING);
    expect(g.moves).toEqual([40, 41]);
    expect(sideOfMove(0)).toBe(SOLID);
    expect(sideOfMove(1)).toBe(RING);
    expect(stonesOf(g, SOLID)).toBe(1);
    expect(stonesOf(g, RING)).toBe(1);
  });
  it('does not mutate the previous state', () => {
    const g = newGame(9);
    const snapshot = JSON.stringify([...g.board]);
    playMove(g, 5);
    expect(JSON.stringify([...g.board])).toBe(snapshot);
    expect(g.moves).toEqual([]);
  });
  it('ends on five, reports the line and the winner, and accepts no more moves', () => {
    const n = 13;
    let g = newGame(n);
    const solid = [0, 1, 2, 3, 4].map((c) => rc(n)(6, c));
    const ring = [0, 1, 2, 3].map((c) => rc(n)(8, c));
    for (let k = 0; k < 4; k++) { g = playMove(g, solid[k])!; g = playMove(g, ring[k])!; }
    expect(g.status).toBe('playing');
    g = playMove(g, solid[4])!;
    expect(g.status).toBe('won');
    expect(g.winner).toBe(SOLID);
    expect(g.line).toEqual(solid);
    expect(playMove(g, 100)).toBeNull();
    expect(describeResult(g, SOLID)).toBe('You win with five in a row in 5 moves.');
    expect(describeResult(g, RING)).toBe('The computer wins with five in a row.');
    expect(describeResult(g, null)).toBe('Solid wins with five in a row on move 9.');
  });
  it('reports an overline win honestly', () => {
    const n = 13;
    let g = newGame(n);
    const solid = [0, 1, 2, 4, 5, 3].map((c) => rc(n)(6, c));
    // Ring stones spread out so they never make a line themselves.
    const ringSafe = [rc(n)(8, 0), rc(n)(8, 2), rc(n)(8, 4), rc(n)(8, 6), rc(n)(8, 8)];
    for (let k = 0; k < 6; k++) {
      g = playMove(g, solid[k])!;
      if (k < 5) g = playMove(g, ringSafe[k])!;
    }
    expect(g.status).toBe('won');
    expect(g.line).toHaveLength(6);
    expect(describeResult(g, SOLID)).toContain('a line of 6');
  });
  it('replays a move list and rejects an illegal one', () => {
    const g = replay(9, [40, 41, 31, 32])!;
    expect(g.moves).toEqual([40, 41, 31, 32]);
    expect(replay(9, [40, 40])).toBeNull();
    expect(replay(9, [999])).toBeNull();
  });
  it('undo round trip: undoing k moves equals the state before them, for every k', () => {
    const rng = mulberry32(4);
    const full = randomGame(9, rng);
    for (let cut = 0; cut <= full.moves.length; cut++) {
      const g = replay(9, full.moves.slice(0, cut))!;
      for (let k = 0; k <= cut; k++) {
        const back = undoMoves(g, k);
        const expected = replay(9, full.moves.slice(0, cut - k))!;
        expect(back.moves).toEqual(expected.moves);
        expect(back.board).toEqual(expected.board);
        expect(back.toMove).toBe(expected.toMove);
        expect(back.status).toBe(expected.status);
        if (k > 0) expect(back.status).toBe('playing'); // any real take-back reopens a finished game
      }
    }
  });
  it('undoing past the start gives an empty board; undoing then replaying the same moves restores the state', () => {
    const g = replay(13, [84, 85, 71, 72, 58])!;
    expect(undoMoves(g, 99).moves).toEqual([]);
    expect(undoMoves(g, 0)).toEqual(g);
    const back = undoMoves(g, 3);
    let again = back;
    for (const m of g.moves.slice(back.moves.length)) again = playMove(again, m)!;
    expect(again).toEqual(g);
  });
  it('undoing the winning move reopens the game', () => {
    const n = 13;
    let g = newGame(n);
    const solid = [0, 1, 2, 3, 4].map((c) => rc(n)(6, c));
    const ring = [0, 1, 2, 3].map((c) => rc(n)(8, c));
    for (let k = 0; k < 4; k++) { g = playMove(g, solid[k])!; g = playMove(g, ring[k])!; }
    g = playMove(g, solid[4])!;
    expect(g.status).toBe('won');
    const back = undoMoves(g, 1);
    expect(back.status).toBe('playing');
    expect(back.winner).toBe(0);
    expect(back.line).toEqual([]);
    expect(back.toMove).toBe(SOLID);
  });
  it('against the computer, one undo takes back the human move and the reply', () => {
    // Human is Solid: moves 0 (human) 1 (computer) 2 (human) 3 (computer)
    const g = replay(9, [40, 41, 31, 32])!;
    expect(undoCountVsComputer(g, SOLID)).toBe(2);
    const back = undoMoves(g, undoCountVsComputer(g, SOLID));
    expect(back.moves).toEqual([40, 41]);
    expect(back.toMove).toBe(SOLID);
    // The human's turn right now (computer has not replied yet): only the human move comes back.
    const mid = replay(9, [40, 41, 31])!;
    expect(undoCountVsComputer(mid, SOLID)).toBe(1);
    // Human is Ring and the computer opened: moves 0 and 2 are the computer's. Ring has just moved (index 3).
    const ringGame = replay(9, [40, 41, 31, 32])!;
    expect(undoCountVsComputer(ringGame, RING)).toBe(1);
    expect(undoMoves(ringGame, 1).moves).toEqual([40, 41, 31]);
    // After the computer has replied as well, both come back and the opening move stays.
    const replied = replay(9, [40, 41, 31, 32, 22])!;
    expect(undoCountVsComputer(replied, RING)).toBe(2);
    expect(undoMoves(replied, 2).moves).toEqual([40, 41, 31]);
    expect(undoMoves(replied, 2).toMove).toBe(RING);
    // Human is Ring and has not moved: nothing to undo.
    expect(undoCountVsComputer(replay(9, [40])!, RING)).toBe(0);
    expect(undoCountVsComputer(newGame(9), SOLID)).toBe(0);
  });
});

describe('self-play fuzz', () => {
  it('random legal games on every size end in a win or a draw with consistent bookkeeping', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 25; seed++) {
        const g = randomGame(n, mulberry32(seed * 7 + n));
        expect(g.status === 'won' || g.status === 'draw', `n${n} seed${seed}`).toBe(true);
        expect(new Set(g.moves).size).toBe(g.moves.length);
        expect(g.moves.length).toBeLessThanOrEqual(n * n);
        const counts = countStones(g.board);
        expect(counts.solid + counts.ring).toBe(g.moves.length);
        expect(counts.solid - counts.ring).toBe(g.moves.length % 2); // Solid moves first
        const w = findWinner(g.board);
        if (g.status === 'won') {
          expect(w, `n${n} seed${seed}`).not.toBeNull();
          expect(w!.side).toBe(g.winner);
          expect(g.winner).toBe(sideOfMove(g.moves.length - 1)); // the last mover won
          expect(g.line.length).toBeGreaterThanOrEqual(5);
          expect(g.line.includes(g.moves[g.moves.length - 1])).toBe(true);
          for (const i of g.line) expect(g.board[i]).toBe(g.winner);
          // Nothing earlier was already a win: replaying all but the last move is still in play.
          expect(replay(n, g.moves.slice(0, -1))!.status).toBe('playing');
        } else {
          expect(w).toBeNull();
          expect(isFull(g.board)).toBe(true);
        }
      }
    }
  });
  it('every position of a random game agrees between lineAt on the last move and a full-board scan', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed);
      let g = newGame(9);
      while (g.status === 'playing') {
        const empties: number[] = [];
        g.board.forEach((v, i) => { if (v === EMPTY) empties.push(i); });
        const cell = empties[Math.floor(rng() * empties.length)];
        const next = playMove(g, cell)!;
        expect(!!lineAt(next.board, cell), `seed ${seed}`).toBe(findWinner(next.board) !== null);
        g = next;
      }
    }
  });
  it('computer-versus-computer games end legally at every pairing of levels', () => {
    const pairs: [Level, Level][] = [['easy', 'easy'], ['easy', 'medium'], ['medium', 'medium'], ['hard', 'easy'], ['hard', 'medium'], ['medium', 'hard']];
    for (const [a, b] of pairs) {
      for (const n of [9, 13]) {
        const rng = mulberry32(n * 100 + pairs.findIndex((p) => p[0] === a && p[1] === b));
        const g = playOut(n, (board, side) => bestMove(board, side, side === SOLID ? a : b, rng, 150));
        expect(g.status === 'won' || g.status === 'draw', `${a} vs ${b} n${n}`).toBe(true);
        expect(new Set(g.moves).size).toBe(g.moves.length);
      }
    }
  }, 120000);
});

describe('levels are ordered by strength', () => {
  const wins = (a: Level, b: Level, games: number, n: number, base: number): { a: number; b: number; draws: number } => {
    const out = { a: 0, b: 0, draws: 0 };
    for (let g = 0; g < games; g++) {
      const rng = mulberry32(base + g);
      const aSolid = g % 2 === 0;
      const game = playOut(n, (board, side) => bestMove(board, side, (side === SOLID) === aSolid ? a : b, rng, 1000));
      if (game.status === 'draw') out.draws++;
      else if ((game.winner === SOLID) === aSolid) out.a++;
      else out.b++;
    }
    return out;
  };

  it('Medium beats Easy in at least 9 of 10 seeded games (alternating who moves first)', () => {
    const r = wins('medium', 'easy', 10, 13, 100);
    expect(r.a).toBeGreaterThanOrEqual(9);
  }, 120000);
  it('Hard beats Easy in all of 16 seeded games', () => {
    const r = wins('hard', 'easy', 16, 13, 300);
    expect(r).toEqual({ a: 16, b: 0, draws: 0 });
  }, 120000);
  it('Hard beats Medium over 16 seeded games on 13 x 13 (alternating who moves first): 8 wins, 3 losses, 5 draws', () => {
    // These games are deterministic. The page and the content page quote this result, so it is pinned exactly.
    const r = wins('hard', 'medium', 16, 13, 300);
    expect(r).toEqual({ a: 8, b: 3, draws: 5 });
  }, 150000);
});
