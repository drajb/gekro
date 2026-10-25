/**
 * games-reversi.test.ts - the engine behind `reversi`.
 *
 * Pinned: the opening position and its four legal moves, flipping in all eight
 * directions (including several lines in one move), edges and corners, passes and
 * the end of the game, disc-count conservation, published perft node counts, the
 * three computer levels (legal, deterministic for a seed, alpha-beta agrees with
 * plain minimax and with exhaustive endgame search), and a self-play fuzz.
 */
import { describe, it, expect } from 'vitest';
import {
  initialBoard, parseBoard, boardToString, legalMoves, applyMove, flippedBy, canPlay, hasMoves, countMoves, isGameOver, advance,
  result, describeResult, perft, evaluate, terminalScore, negamax, randomMove, greedyMove, bestMove, chooseMove, countDiscs,
  mulberry32, shuffled, opponent, cellName, rowOf, colOf, RAYS, DIRS, CORNERS, EMPTY, DARK, LIGHT,
  type Board, type Player, type Level,
} from '../src/components/apps-private/reversi/helpers';

const rc = (r: number, c: number): number => r * 8 + c;
const sorted = (a: number[]): number[] => a.slice().sort((x, y) => x - y);

/** Play a whole game, asking `pick` for each move. Returns every position and move on the way. */
const playOut = (pick: (b: Board, p: Player, ply: number) => number, maxPlies = 200) => {
  let board = initialBoard();
  let player: Player = DARK;
  const moves: { player: Player; cell: number; flipped: number[] }[] = [];
  let passes = 0;
  for (let ply = 0; ply < maxPlies; ply++) {
    const cell = pick(board, player, ply);
    const r = applyMove(board, cell, player);
    if (!r) throw new Error(`illegal move ${cell} for ${player} at ply ${ply}`);
    moves.push({ player, cell, flipped: r.flipped });
    board = r.board;
    const adv = advance(board, player);
    if (adv.next === null) return { board, moves, passes };
    if (adv.passed !== null) passes++;
    player = adv.next;
  }
  throw new Error('game did not finish');
};

describe('geometry', () => {
  it('has 8 rays per cell and the right ray lengths at a corner and the centre', () => {
    expect(RAYS).toHaveLength(64);
    expect(RAYS.every((r) => r.length === 8)).toBe(true);
    expect(RAYS[0].reduce((n, r) => n + r.length, 0)).toBe(21); // 7 right, 7 down, 7 diagonal
    expect(RAYS[rc(3, 3)].reduce((n, r) => n + r.length, 0)).toBe(27);
    expect(DIRS).toHaveLength(8);
  });
  it('names a cell with 1-based row and column', () => {
    expect(cellName(0)).toBe('row 1, column 1');
    expect(cellName(63)).toBe('row 8, column 8');
    expect(rowOf(rc(5, 2))).toBe(5);
    expect(colOf(rc(5, 2))).toBe(2);
  });
});

describe('initial position', () => {
  const b = initialBoard();
  it('has two discs of each colour in the centre and 60 empty squares', () => {
    expect(countDiscs(b)).toEqual({ dark: 2, light: 2, empty: 60 });
    expect(b[rc(3, 3)]).toBe(LIGHT);
    expect(b[rc(4, 4)]).toBe(LIGHT);
    expect(b[rc(3, 4)]).toBe(DARK);
    expect(b[rc(4, 3)]).toBe(DARK);
  });
  it('gives the first player exactly 4 legal moves', () => {
    expect(legalMoves(b, DARK)).toEqual([rc(2, 3), rc(3, 2), rc(4, 5), rc(5, 4)]);
    expect(countMoves(b, DARK)).toBe(4);
  });
  it('gives the second player exactly 4 replies as well', () => {
    expect(legalMoves(b, LIGHT)).toEqual([rc(2, 4), rc(3, 5), rc(4, 2), rc(5, 3)]);
  });
  it('is not game over and each opening move flips exactly one disc', () => {
    expect(isGameOver(b)).toBe(false);
    for (const m of legalMoves(b, DARK)) expect(applyMove(b, m, DARK)!.flipped).toHaveLength(1);
  });
  it('round-trips through the text format', () => {
    expect(parseBoard(boardToString(b))).toEqual(b);
    expect(() => parseBoard('xo')).toThrow(RangeError);
  });
});

describe('flipping', () => {
  // Target square (3, 3) in the middle of an otherwise empty board; for each direction,
  // an opponent disc next to it and one of our own beyond.
  for (const [dr, dc] of DIRS) {
    it(`flips one disc in direction (${dr}, ${dc})`, () => {
      const b = new Int8Array(64);
      b[rc(3 + dr, 3 + dc)] = LIGHT;
      b[rc(3 + 2 * dr, 3 + 2 * dc)] = DARK;
      const r = applyMove(b, rc(3, 3), DARK)!;
      expect(r.flipped).toEqual([rc(3 + dr, 3 + dc)]);
      expect(r.board[rc(3, 3)]).toBe(DARK);
      expect(r.board[rc(3 + dr, 3 + dc)]).toBe(DARK);
    });
  }
  it('flips a long run in a single direction', () => {
    const b = parseBoard(`
      ........
      ........
      ........
      xoooooo.
      ........
      ........
      ........
      ........`);
    const r = applyMove(b, rc(3, 7), DARK)!;
    expect(sorted(r.flipped)).toEqual([1, 2, 3, 4, 5, 6].map((c) => rc(3, c)));
  });
  it('flips several lines in one move, all eight directions at once', () => {
    const b = new Int8Array(64);
    for (const [dr, dc] of DIRS) {
      b[rc(3 + dr, 3 + dc)] = LIGHT;
      b[rc(3 + 2 * dr, 3 + 2 * dc)] = DARK;
    }
    const r = applyMove(b, rc(3, 3), DARK)!;
    expect(r.flipped).toHaveLength(8);
    expect(countDiscs(r.board).light).toBe(0);
    expect(countDiscs(r.board).dark).toBe(8 + 8 + 1);
  });
  it('flips lines of different lengths in different directions and ignores lines that are not closed', () => {
    const b = parseBoard(`
      ........
      ........
      ...x....
      ..o.oox.
      ...oo...
      ...x.o..
      ......o.
      .......x`);
    // From (3,3): east flips 2, south flips 1, south-east flips 3; west is not closed (empty beyond), north is our own disc.
    const r = applyMove(b, rc(3, 3), DARK)!;
    expect(sorted(r.flipped)).toEqual(sorted([rc(3, 4), rc(3, 5), rc(4, 3), rc(4, 4), rc(5, 5), rc(6, 6)]));
    expect(r.board[rc(3, 2)]).toBe(LIGHT);
    expect(r.board[rc(2, 3)]).toBe(DARK);
    expect(flippedBy(b, rc(3, 3), LIGHT)).toEqual([]); // light has no brackets from there
  });
  it('does not flip a run that is not closed by one of our own discs', () => {
    const b = parseBoard(`
      ........
      ........
      ........
      .ooo....
      ........
      ........
      ........
      ........`);
    expect(applyMove(b, rc(3, 0), DARK)).toBeNull(); // run ends in empty squares
    expect(applyMove(b, rc(3, 4), DARK)).toBeNull();
    const edge = parseBoard(`
      ........
      ........
      ........
      oooooo..
      ........
      ........
      ........
      ........`);
    expect(applyMove(edge, rc(3, 6), DARK)).toBeNull(); // the run reaches the edge of the board
    expect(applyMove(edge, rc(3, 6), LIGHT)).toBeNull(); // and own discs next to the move flip nothing
  });
  it('rejects a taken square and out-of-range input, and never mutates the board', () => {
    const b = initialBoard();
    const copy = b.slice();
    expect(applyMove(b, rc(3, 3), DARK)).toBeNull();
    expect(applyMove(b, -1, DARK)).toBeNull();
    expect(applyMove(b, 64, DARK)).toBeNull();
    expect(applyMove(b, 1.5, DARK)).toBeNull();
    expect(applyMove(b, rc(0, 0), DARK)).toBeNull(); // empty but flips nothing
    applyMove(b, rc(2, 3), DARK);
    expect(b).toEqual(copy);
    expect(flippedBy(b, rc(3, 3), DARK)).toEqual([]);
  });
  it('canPlay agrees with flippedBy on every square of every position in a game', () => {
    const rng = mulberry32(5);
    const g = playOut((b, p) => randomMove(b, p, rng));
    let b = initialBoard();
    for (const m of g.moves) {
      for (const p of [DARK, LIGHT] as Player[]) {
        for (let i = 0; i < 64; i++) expect(canPlay(b, i, p)).toBe(flippedBy(b, i, p).length > 0);
      }
      b = applyMove(b, m.cell, m.player)!.board;
    }
  });
});

describe('edges and corners', () => {
  it('a corner move flips along the edge and the diagonal together', () => {
    const c = parseBoard(`
      .oox....
      .o......
      ..o.....
      ...x....
      ........
      ........
      ........
      ........`);
    expect(sorted(applyMove(c, rc(0, 0), DARK)!.flipped)).toEqual([rc(0, 1), rc(0, 2), rc(1, 1), rc(2, 2)]);
  });
  it('a corner has only three lines to flip along', () => {
    const b = parseBoard(`
      ........
      ........
      ........
      ........
      ........
      ........
      ........
      ........`);
    expect(legalMoves(b, DARK)).toEqual([]);
    expect(RAYS[63].filter((r) => r.length > 0)).toHaveLength(3);
    expect(RAYS[0].filter((r) => r.length > 0)).toHaveLength(3);
    expect(RAYS[rc(0, 3)].filter((r) => r.length > 0)).toHaveLength(5);
  });
  it('corner discs can never be flipped: across 40 random games a corner disc never changes colour', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      const g = playOut((b, p) => randomMove(b, p, rng));
      for (const m of g.moves) {
        for (const f of m.flipped) expect(CORNERS.includes(f)).toBe(false);
      }
    }
  });
  it('a disc on the edge cannot be flipped across the edge', () => {
    const b = parseBoard(`
      .......x
      .......o
      ........
      ........
      ........
      ........
      ........
      ........`);
    // Light disc at (1,7); dark above it at (0,7). A dark disc at (2,7) flips it.
    expect(applyMove(b, rc(2, 7), DARK)!.flipped).toEqual([rc(1, 7)]);
    // But no move can flip the dark disc on row 0 vertically: nothing lies beyond the board.
    expect(applyMove(b, rc(0, 6), LIGHT)).toBeNull();
  });
});

describe('passing and the end of the game', () => {
  const stuck = parseBoard(`
    ox......
    ........
    ........
    ........
    ........
    ........
    ........
    ........`);
  it('detects a player with no legal move', () => {
    expect(hasMoves(stuck, DARK)).toBe(false);
    expect(hasMoves(stuck, LIGHT)).toBe(true);
    expect(legalMoves(stuck, LIGHT)).toEqual([rc(0, 2)]);
  });
  it('after a player moves, a stuck opponent passes and the mover goes again', () => {
    expect(advance(stuck, LIGHT)).toEqual({ next: LIGHT, passed: DARK });
    expect(advance(stuck, DARK)).toEqual({ next: LIGHT, passed: null });
  });
  it('ends the game when neither player can move', () => {
    const after = applyMove(stuck, rc(0, 2), LIGHT)!;
    expect(boardToString(after.board).slice(0, 4)).toBe('ooo.');
    expect(isGameOver(after.board)).toBe(true);
    expect(advance(after.board, LIGHT)).toEqual({ next: null, passed: null });
    expect(result(after.board)).toMatchObject({ dark: 0, light: 3, winner: 'light', margin: -3 });
  });
  it('ends on a wipe-out with empty squares left, and counts only discs', () => {
    const b = parseBoard('x' + '.'.repeat(63));
    expect(isGameOver(b)).toBe(true);
    expect(result(b)).toMatchObject({ dark: 1, light: 0, empty: 63, winner: 'dark', margin: 1 });
  });
  it('declares a draw on equal disc counts', () => {
    const b = parseBoard('x'.repeat(32) + 'o'.repeat(32));
    expect(isGameOver(b)).toBe(true);
    expect(result(b)).toMatchObject({ winner: 'draw', margin: 0, empty: 0 });
  });
  it('declares the side with more discs the winner on a full board', () => {
    const b = parseBoard('x'.repeat(40) + 'o'.repeat(24));
    expect(result(b)).toMatchObject({ dark: 40, light: 24, winner: 'dark', margin: 16 });
  });
  it('describes results for two players and for a player against the computer', () => {
    const win = result(parseBoard('x'.repeat(40) + 'o'.repeat(24)));
    expect(describeResult(win, null)).toBe('Dark wins 40 to 24.');
    expect(describeResult(win, DARK)).toBe('You win 40 to 24.');
    expect(describeResult(win, LIGHT)).toBe('The computer wins 40 to 24.');
    expect(describeResult(result(parseBoard('x'.repeat(32) + 'o'.repeat(32))), null)).toBe('Draw, 32 discs each.');
  });
  it('plays through real games that include passes', () => {
    let sawPass = false;
    for (let seed = 1; seed <= 300 && !sawPass; seed++) {
      const rng = mulberry32(seed);
      const g = playOut((b, p) => randomMove(b, p, rng));
      if (g.passes > 0) sawPass = true;
    }
    expect(sawPass).toBe(true);
  });
});

describe('disc-count conservation', () => {
  it('total discs = 4 + moves played, and each move moves exactly its flips from one colour to the other', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const rng = mulberry32(seed);
      let b = initialBoard();
      let p: Player = DARK;
      let played = 0;
      for (;;) {
        const m = randomMove(b, p, rng);
        const before = countDiscs(b);
        const r = applyMove(b, m, p)!;
        played++;
        const after = countDiscs(r.board);
        expect(after.dark + after.light).toBe(4 + played);
        const own = p === DARK ? 'dark' : 'light';
        const other = p === DARK ? 'light' : 'dark';
        expect(after[own]).toBe(before[own] + 1 + r.flipped.length);
        expect(after[other]).toBe(before[other] - r.flipped.length);
        expect(r.flipped.length).toBeGreaterThan(0);
        b = r.board;
        const adv = advance(b, p);
        if (adv.next === null) break;
        p = adv.next;
      }
      expect(played).toBeLessThanOrEqual(60);
    }
  });
});

describe('perft from the starting position', () => {
  // Published node counts for Reversi; none of these depths can contain a pass.
  const EXPECTED = [4, 12, 56, 244, 1396];
  EXPECTED.forEach((n, i) => {
    it(`depth ${i + 1} = ${n}`, () => {
      expect(perft(initialBoard(), DARK, i + 1)).toBe(n);
    });
  });
  it('depth 0 is one node and a finished game is one node', () => {
    expect(perft(initialBoard(), DARK, 0)).toBe(1);
    expect(perft(parseBoard('x'.repeat(64)), DARK, 3)).toBe(1);
  });
  it('is symmetric: Light moving first gives the same counts on the mirrored position', () => {
    const b = initialBoard();
    for (let d = 1; d <= 4; d++) expect(perft(b, LIGHT, d)).toBe(perft(b, DARK, d));
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
    expect(sorted(out)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('computer players', () => {
  const midgame = (seed: number, plies: number): { board: Board; player: Player } => {
    const rng = mulberry32(seed);
    let board = initialBoard();
    let player: Player = DARK;
    for (let i = 0; i < plies; i++) {
      const m = randomMove(board, player, rng);
      if (m < 0) break;
      board = applyMove(board, m, player)!.board;
      const adv = advance(board, player);
      if (adv.next === null) break;
      player = adv.next;
    }
    return { board, player };
  };

  it('every level returns -1 when there is no legal move', () => {
    const stuck = parseBoard('ox' + '.'.repeat(62));
    for (const level of ['easy', 'medium', 'hard'] as Level[]) expect(chooseMove(stuck, DARK, level, mulberry32(1))).toBe(-1);
    expect(bestMove(stuck, DARK, 3, mulberry32(1))).toBe(-1);
  });
  it('returns the only legal move without searching', () => {
    const stuck = parseBoard('ox' + '.'.repeat(62));
    for (const level of ['easy', 'medium', 'hard'] as Level[]) expect(chooseMove(stuck, LIGHT, level, mulberry32(1))).toBe(rc(0, 2));
  });
  it('never plays an illegal move, at any level, over many positions', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (const plies of [0, 1, 5, 12, 25, 40, 55]) {
        const { board, player } = midgame(seed, plies);
        if (!hasMoves(board, player)) continue;
        const legal = new Set(legalMoves(board, player));
        const rng = mulberry32(seed * 100 + plies);
        expect(legal.has(randomMove(board, player, rng))).toBe(true);
        expect(legal.has(greedyMove(board, player, rng))).toBe(true);
        expect(legal.has(bestMove(board, player, 3, rng))).toBe(true);
      }
    }
  });
  it('Hard never plays an illegal move at full depth', () => {
    for (const seed of [21, 22, 23]) {
      const { board, player } = midgame(seed, 20);
      expect(legalMoves(board, player)).toContain(chooseMove(board, player, 'hard', mulberry32(seed)));
    }
  });
  it('is deterministic for a seed at every level', () => {
    const { board, player } = midgame(9, 14);
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      const a = chooseMove(board, player, level, mulberry32(77));
      const b = chooseMove(board, player, level, mulberry32(77));
      expect(a).toBe(b);
    }
  });
  it('Easy varies with the seed', () => {
    const b = initialBoard();
    const seen = new Set<number>();
    for (let s = 1; s <= 40; s++) seen.add(randomMove(b, DARK, mulberry32(s)));
    expect(seen.size).toBe(4);
  });
  it('Medium takes an available corner even when another move flips more', () => {
    const b = parseBoard(`
      .ox.....
      ........
      ........
      ........
      ..ooox..
      ........
      ........
      ........`);
    // Dark at (0,0) flips one disc; dark at (4,1) flips three.
    expect(applyMove(b, rc(0, 0), DARK)!.flipped).toHaveLength(1);
    expect(applyMove(b, rc(4, 1), DARK)!.flipped).toHaveLength(3);
    for (let s = 1; s <= 10; s++) expect(greedyMove(b, DARK, mulberry32(s))).toBe(rc(0, 0));
  });
  it('Medium otherwise takes the move that flips the most', () => {
    const b = parseBoard(`
      ........
      ........
      ........
      ..o.....
      .ooox...
      ...o....
      ........
      ........`);
    const moves = legalMoves(b, DARK);
    const most = Math.max(...moves.map((m) => applyMove(b, m, DARK)!.flipped.length));
    for (let s = 1; s <= 10; s++) {
      const m = greedyMove(b, DARK, mulberry32(s));
      expect(applyMove(b, m, DARK)!.flipped.length).toBe(most);
    }
  });
  it('Hard takes a free corner and avoids handing one over', () => {
    const b = parseBoard(`
      .ox.....
      ........
      ........
      ........
      ........
      ........
      ........
      ........`);
    expect(bestMove(b, DARK, 4, mulberry32(1))).toBe(rc(0, 0));
  });

  it('alpha-beta returns exactly what plain minimax returns (depth 3, full window)', () => {
    const plain = (b: Board, p: Player, depth: number): number => {
      const moves = legalMoves(b, p);
      if (!moves.length) {
        if (!hasMoves(b, opponent(p))) return terminalScore(b, p);
        return -plain(b, opponent(p), depth);
      }
      if (depth <= 0) return evaluate(b, p);
      let best = -Infinity;
      for (const m of moves) best = Math.max(best, -plain(applyMove(b, m, p)!.board, opponent(p), depth - 1));
      return best;
    };
    for (const [seed, plies] of [[1, 6], [2, 10], [3, 18], [4, 26], [5, 34], [6, 44]]) {
      const { board, player } = midgame(seed, plies);
      for (const depth of [1, 2, 3]) {
        expect(negamax(board, player, depth, -Infinity, Infinity), `seed ${seed} depth ${depth}`).toBe(plain(board, player, depth));
      }
    }
  });

  it('in the endgame Hard plays a move with the best exact final margin', () => {
    // Exhaustive search of the rest of the game, margin from the mover's side.
    const exact = (b: Board, p: Player): number => {
      const moves = legalMoves(b, p);
      if (!moves.length) {
        if (!hasMoves(b, opponent(p))) {
          const c = countDiscs(b);
          return p === DARK ? c.dark - c.light : c.light - c.dark;
        }
        return -exact(b, opponent(p));
      }
      let best = -Infinity;
      for (const m of moves) best = Math.max(best, -exact(applyMove(b, m, p)!.board, opponent(p)));
      return best;
    };
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 8; seed++) {
      // Play random moves until 6 squares are left.
      const rng = mulberry32(seed);
      let b = initialBoard();
      let p: Player = DARK;
      let ok = true;
      while (countDiscs(b).empty > 6) {
        const m = randomMove(b, p, rng);
        if (m < 0) { ok = false; break; }
        b = applyMove(b, m, p)!.board;
        const adv = advance(b, p);
        if (adv.next === null) { ok = false; break; }
        p = adv.next;
      }
      if (!ok || !hasMoves(b, p)) continue;
      const values = legalMoves(b, p).map((m) => ({ m, v: -exact(applyMove(b, m, p)!.board, opponent(p)) }));
      const top = Math.max(...values.map((x) => x.v));
      const chosen = bestMove(b, p, 8, mulberry32(seed));
      expect(values.find((x) => x.m === chosen)!.v, `seed ${seed}`).toBe(top);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('Hard beats Easy: across 10 seeded games (alternating colours) Hard wins at least 9', () => {
    let hardWins = 0;
    for (let g = 0; g < 10; g++) {
      const rng = mulberry32(1000 + g);
      const hardIsDark = g % 2 === 0;
      const out = playOut((b, p) => (p === (hardIsDark ? DARK : LIGHT) ? bestMove(b, p, 5, rng) : randomMove(b, p, rng)));
      const r = result(out.board);
      if (r.winner === (hardIsDark ? 'dark' : 'light')) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(9);
  }, 60000);

  it('Hard beats Medium: across 10 seeded games (alternating colours) Hard wins at least 9', () => {
    let wins = 0;
    for (let g = 0; g < 10; g++) {
      const rng = mulberry32(7000 + g);
      const hardIsDark = g % 2 === 0;
      const out = playOut((b, p) => (p === (hardIsDark ? DARK : LIGHT) ? bestMove(b, p, 5, rng) : greedyMove(b, p, rng)));
      if (result(out.board).winner === (hardIsDark ? 'dark' : 'light')) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(9);
  }, 60000);

  it('Medium beats Easy: across 20 seeded games (alternating colours) Medium wins more than 12', () => {
    let wins = 0;
    for (let g = 0; g < 20; g++) {
      const rng = mulberry32(2000 + g);
      const medDark = g % 2 === 0;
      const out = playOut((b, p) => (p === (medDark ? DARK : LIGHT) ? greedyMove(b, p, rng) : randomMove(b, p, rng)));
      if (result(out.board).winner === (medDark ? 'dark' : 'light')) wins++;
    }
    expect(wins).toBeGreaterThan(12);
  });
});

describe('Hard answers quickly', () => {
  it('depth 5 takes well under 1.5 s per move from the opening, the middle and the late game', () => {
    const rng = mulberry32(31);
    let board = initialBoard();
    let player: Player = DARK;
    let worst = 0;
    for (let ply = 0; ply < 70; ply++) {
      if (ply % 4 === 0) {
        const t = performance.now();
        const m = bestMove(board, player, 5, rng);
        const dt = performance.now() - t;
        worst = Math.max(worst, dt);
        expect(legalMoves(board, player)).toContain(m);
      }
      const m = randomMove(board, player, rng);
      board = applyMove(board, m, player)!.board;
      const adv = advance(board, player);
      if (adv.next === null) break;
      player = adv.next;
    }
    expect(worst).toBeLessThan(1500);
  }, 60000);
});

describe('self-play fuzz', () => {
  it('300 random games all end legally with conserved disc counts', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      const g = playOut((b, p) => randomMove(b, p, rng));
      expect(isGameOver(g.board), `seed ${seed}`).toBe(true);
      const c = countDiscs(g.board);
      expect(c.dark + c.light).toBe(4 + g.moves.length);
      expect(c.dark + c.light).toBeLessThanOrEqual(64);
      expect(g.moves.length).toBeLessThanOrEqual(60);
      expect(g.moves[0].player).toBe(DARK);
      expect(g.moves.every((m) => m.flipped.length > 0)).toBe(true);
      // Nothing is ever placed on an occupied square.
      expect(new Set(g.moves.map((m) => m.cell)).size).toBe(g.moves.length);
    }
  });
  it('mixed-level games (Easy, Medium, Hard at depth 2) also end legally', () => {
    const levels: Level[] = ['easy', 'medium', 'hard'];
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed + 500);
      const g = playOut((b, p, ply) => {
        const level = levels[(seed + (p === DARK ? 0 : 1)) % 3];
        return level === 'hard' ? bestMove(b, p, 2, rng) : chooseMove(b, p, level, rng);
      });
      expect(isGameOver(g.board)).toBe(true);
    }
  });
});

describe('evaluation sanity', () => {
  it('is zero-sum between the two sides on the opening position', () => {
    const b = initialBoard();
    expect(evaluate(b, DARK) + evaluate(b, LIGHT)).toBe(0);
    expect(evaluate(b, DARK)).toBe(0); // symmetric position
  });
  it('rewards owning a corner', () => {
    const own = parseBoard('x' + '.'.repeat(63));
    const none = parseBoard('.'.repeat(27) + 'x' + '.'.repeat(36));
    expect(evaluate(own, DARK)).toBeGreaterThan(evaluate(none, DARK));
  });
  it('scores a won game above any heuristic score and by margin', () => {
    expect(terminalScore(parseBoard('x'.repeat(40) + 'o'.repeat(24)), DARK)).toBeGreaterThan(9000);
    expect(terminalScore(parseBoard('x'.repeat(40) + 'o'.repeat(24)), LIGHT)).toBeLessThan(-9000);
    expect(terminalScore(parseBoard('x'.repeat(32) + 'o'.repeat(32)), DARK)).toBe(0);
    expect(terminalScore(parseBoard('x'.repeat(50) + 'o'.repeat(14)), DARK)).toBeGreaterThan(terminalScore(parseBoard('x'.repeat(40) + 'o'.repeat(24)), DARK));
  });
  it('a board constant EMPTY is zero', () => {
    expect(EMPTY).toBe(0);
  });
});
