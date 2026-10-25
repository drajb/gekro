/**
 * games-merge-tiles.test.ts - the engine behind `merge-tiles`.
 *
 * Pinned: the line-sliding rules (including the cases people argue about:
 * [2,2,2,2], [2,2,4], no double merge), all four directions, score accounting,
 * spawn odds and placement, no spawn after a move that changes nothing, game
 * over detection, determinism for a seeded rng, and a long random-play fuzz that
 * checks board invariants after every move.
 */
import { describe, it, expect } from 'vitest';
import {
  slideLine, slide, move, spawn, newBoard, canMove, isGameOver, emptyCells, emptyBoard, mulberry32,
  tileCount, sumTiles, maxTile, hasWon, isValidBoard, keyToDir, dirFromSwipe, describeBoard, where,
  DIRS, CELLS, SIZE, WIN_TILE, FOUR_CHANCE, SWIPE_PX,
  type Board, type Dir,
} from '../src/components/apps-private/merge-tiles/helpers';

const boom = () => { throw new Error('rng must not be called'); };
const rows = (b: number[]): number[][] => [b.slice(0, 4), b.slice(4, 8), b.slice(8, 12), b.slice(12, 16)];
const transpose = (b: number[]): number[] => b.map((_, i) => b[(i % 4) * 4 + Math.floor(i / 4)]);
const reverseRows = (b: number[]): number[] => rows(b).flatMap((r) => r.slice().reverse());

describe('constants', () => {
  it('is a 4 x 4 board, wins at 2048, spawns a 4 one time in ten', () => {
    expect(SIZE).toBe(4);
    expect(CELLS).toBe(16);
    expect(WIN_TILE).toBe(2048);
    expect(FOUR_CHANCE).toBe(0.1);
    expect(SWIPE_PX).toBe(24);
    expect([...DIRS].sort()).toEqual(['down', 'left', 'right', 'up']);
  });
});

describe('slideLine', () => {
  it('slides tiles to the leading edge without changing their order', () => {
    expect(slideLine([0, 2, 0, 4]).line).toEqual([2, 4, 0, 0]);
    expect(slideLine([0, 0, 0, 8]).line).toEqual([8, 0, 0, 0]);
    expect(slideLine([2, 4, 8, 16]).line).toEqual([2, 4, 8, 16]);
  });
  it('merges one equal pair into a doubled tile', () => {
    const r = slideLine([2, 2, 0, 0]);
    expect(r.line).toEqual([4, 0, 0, 0]);
    expect(r.gained).toBe(4);
    expect(r.merges).toBe(1);
  });
  it('merges across gaps', () => {
    expect(slideLine([2, 0, 0, 2]).line).toEqual([4, 0, 0, 0]);
    expect(slideLine([0, 8, 0, 8]).line).toEqual([16, 0, 0, 0]);
  });
  it('[2,2,2,2] becomes [4,4,0,0], two merges worth 8', () => {
    const r = slideLine([2, 2, 2, 2]);
    expect(r.line).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(8);
    expect(r.merges).toBe(2);
  });
  it('[2,2,4] becomes [4,4,0], not [8]', () => {
    const r = slideLine([2, 2, 4, 0]);
    expect(r.line).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(4);
    expect(r.merges).toBe(1);
  });
  it('a merged tile never merges again in the same move', () => {
    expect(slideLine([4, 2, 2, 0]).line).toEqual([4, 4, 0, 0]);
    expect(slideLine([2, 2, 4, 8]).line).toEqual([4, 4, 8, 0]);
    expect(slideLine([8, 4, 2, 2]).line).toEqual([8, 4, 4, 0]);
  });
  it('merges the pair nearest the leading edge first when three are equal', () => {
    expect(slideLine([2, 2, 2, 0]).line).toEqual([4, 2, 0, 0]);
    expect(slideLine([0, 2, 2, 2]).line).toEqual([4, 2, 0, 0]);
    expect(slideLine([4, 4, 4, 4]).line).toEqual([8, 8, 0, 0]);
  });
  it('does not merge unequal neighbours or equal tiles that only touch after a merge', () => {
    expect(slideLine([2, 4, 2, 4]).line).toEqual([2, 4, 2, 4]);
    expect(slideLine([2, 2, 4, 4]).line).toEqual([4, 8, 0, 0]);
  });
  it('an empty line stays empty with no gain', () => {
    const r = slideLine([0, 0, 0, 0]);
    expect(r).toEqual({ line: [0, 0, 0, 0], gained: 0, merges: 0, sources: [] });
  });
  it('reports which input cells fed each output tile', () => {
    const r = slideLine([2, 0, 2, 4]);
    expect(r.line).toEqual([4, 4, 0, 0]);
    expect(r.sources).toEqual([[0, 2], [3]]);
  });
  it('does not mutate its input and keeps the length', () => {
    const src = [2, 2, 4, 0];
    slideLine(src);
    expect(src).toEqual([2, 2, 4, 0]);
    expect(slideLine([2, 2]).line).toHaveLength(2);
  });
  it('conserves the total value of a line', () => {
    const rng = mulberry32(5);
    for (let n = 0; n < 500; n++) {
      const line = Array.from({ length: 4 }, () => (rng() < 0.4 ? 0 : 2 ** (1 + Math.floor(rng() * 4))));
      const r = slideLine(line);
      expect(r.line.reduce((a, b) => a + b, 0)).toBe(line.reduce((a, b) => a + b, 0));
      expect(r.gained).toBeLessThanOrEqual(line.reduce((a, b) => a + b, 0));
    }
  });
});

describe('slide (all four directions)', () => {
  // 2 . . 2 / . 4 4 . / 2 2 2 2 / 8 . . .
  const B: Board = [2, 0, 0, 2, 0, 4, 4, 0, 2, 2, 2, 2, 8, 0, 0, 0];
  it('left', () => {
    const s = slide(B, 'left');
    expect(rows(s.board)).toEqual([[4, 0, 0, 0], [8, 0, 0, 0], [4, 4, 0, 0], [8, 0, 0, 0]]);
    expect(s.moved).toBe(true);
    expect(s.gained).toBe(4 + 8 + 8);
    expect(s.merges).toBe(4);
  });
  it('right', () => {
    const s = slide(B, 'right');
    expect(rows(s.board)).toEqual([[0, 0, 0, 4], [0, 0, 0, 8], [0, 0, 4, 4], [0, 0, 0, 8]]);
    expect(s.gained).toBe(20);
  });
  it('up', () => {
    // columns: [2,0,2,8] [0,4,2,0] [0,4,2,0] [2,0,2,0]
    const s = slide(B, 'up');
    expect(rows(s.board)).toEqual([[4, 4, 4, 4], [8, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(s.gained).toBe(4 + 4);
    expect(s.merges).toBe(2);
  });
  it('down', () => {
    const s = slide(B, 'down');
    expect(rows(s.board)).toEqual([[0, 0, 0, 0], [0, 0, 0, 0], [4, 4, 4, 0], [8, 2, 2, 4]]);
    expect(s.gained).toBe(4 + 4);
    // and it agrees with flipping the board, sliding up, flipping back
    const flipped = rows(B).slice().reverse().flat();
    const viaUp = rows(slide(flipped, 'up').board).slice().reverse().flat();
    expect(s.board).toEqual(viaUp);
  });
  it('right equals left on a mirrored board', () => {
    const rng = mulberry32(11);
    for (let n = 0; n < 200; n++) {
      const b = Array.from({ length: 16 }, () => (rng() < 0.5 ? 0 : 2 ** (1 + Math.floor(rng() * 5))));
      expect(slide(b, 'right').board).toEqual(reverseRows(slide(reverseRows(b), 'left').board));
    }
  });
  it('up equals left on a transposed board', () => {
    const rng = mulberry32(12);
    for (let n = 0; n < 200; n++) {
      const b = Array.from({ length: 16 }, () => (rng() < 0.5 ? 0 : 2 ** (1 + Math.floor(rng() * 5))));
      expect(slide(b, 'up').board).toEqual(transpose(slide(transpose(b), 'left').board));
      expect(slide(b, 'down').board).toEqual(transpose(slide(transpose(b), 'right').board));
    }
  });
  it('does not mutate the input board', () => {
    const copy = B.slice();
    for (const d of DIRS) slide(B, d);
    expect(B).toEqual(copy);
  });
  it('an already packed board does not move in that direction', () => {
    const packed: Board = [2, 4, 8, 16, 4, 8, 16, 32, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(slide(packed, 'left').moved).toBe(false);
    expect(slide(packed, 'up').moved).toBe(false);
    expect(slide(packed, 'down').moved).toBe(true);
  });
  it('a move that only merges still counts as moved', () => {
    const full: Board = [2, 2, 4, 8, 16, 32, 64, 128, 2, 4, 8, 16, 32, 64, 128, 256];
    const s = slide(full, 'left');
    expect(s.moved).toBe(true);
    expect(s.board[0]).toBe(4);
  });
  it('lists every result tile with its sources', () => {
    const s = slide([2, 2, 0, 4, ...new Array(12).fill(0)], 'left');
    expect(s.cells).toEqual([
      { to: 0, value: 4, from: [0, 1] },
      { to: 1, value: 4, from: [3] },
    ]);
    expect(s.cells.length).toBe(tileCount(s.board));
  });
  it('source cells reach the right side when sliding right', () => {
    const s = slide([2, 2, 0, 4, ...new Array(12).fill(0)], 'right');
    expect(s.cells).toEqual([
      { to: 3, value: 4, from: [3] },
      { to: 2, value: 4, from: [1, 0] },
    ]);
  });
});

describe('spawn', () => {
  it('fills exactly one empty cell and leaves the input alone', () => {
    const b: Board = [2, 4, 8, 16, 2, 4, 8, 16, 2, 4, 8, 16, 2, 4, 8, 0];
    const r = spawn(b, mulberry32(1))!;
    expect(r.spawned.index).toBe(15);
    expect([2, 4]).toContain(r.spawned.value);
    expect(r.board[15]).toBe(r.spawned.value);
    expect(b[15]).toBe(0);
    expect(tileCount(r.board)).toBe(16);
  });
  it('picks among empty cells using the first rng value, then the value using the second', () => {
    const b = emptyBoard();
    expect(spawn(b, seq([0, 0]))!.spawned).toEqual({ index: 0, value: 2 });
    expect(spawn(b, seq([0.999999, 0]))!.spawned.index).toBe(15);
    expect(spawn(b, seq([0.5, 0]))!.spawned.index).toBe(8);
    // rng returning exactly 1 must not read past the end
    expect(spawn(b, seq([1, 0]))!.spawned.index).toBe(15);
  });
  it('makes a 2 below 0.9 and a 4 from 0.9 up', () => {
    expect(spawn(emptyBoard(), seq([0, 0.8999]))!.spawned.value).toBe(2);
    expect(spawn(emptyBoard(), seq([0, 0.9]))!.spawned.value).toBe(4);
    expect(spawn(emptyBoard(), seq([0, 0.99]))!.spawned.value).toBe(4);
  });
  it('about nine in ten spawned tiles are 2s', () => {
    const rng = mulberry32(2024);
    let fours = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (spawn(emptyBoard(), rng)!.spawned.value === 4) fours += 1;
    expect(fours / n).toBeGreaterThan(0.09);
    expect(fours / n).toBeLessThan(0.11);
  });
  it('is roughly uniform over empty cells', () => {
    const rng = mulberry32(77);
    const counts = new Array(16).fill(0);
    for (let i = 0; i < 16000; i++) counts[spawn(emptyBoard(), rng)!.spawned.index] += 1;
    for (const c of counts) { expect(c).toBeGreaterThan(800); expect(c).toBeLessThan(1200); }
  });
  it('never lands on an occupied cell', () => {
    const rng = mulberry32(3);
    const b: Board = [2, 0, 4, 0, 0, 8, 0, 16, 2, 0, 4, 0, 0, 8, 0, 16];
    for (let i = 0; i < 500; i++) expect(b[spawn(b, rng)!.spawned.index]).toBe(0);
  });
  it('returns null on a full board without touching rng', () => {
    expect(spawn(new Array(16).fill(2), boom)).toBeNull();
  });
  it('emptyCells lists indices in order', () => {
    expect(emptyCells([2, 0, 0, 4, ...new Array(12).fill(1)])).toEqual([1, 2]);
    expect(emptyCells(emptyBoard())).toHaveLength(16);
  });
});

describe('move', () => {
  it('slides, then adds exactly one tile', () => {
    const b: Board = [0, 0, 0, 2, ...new Array(12).fill(0)];
    const r = move(b, 'left', mulberry32(9));
    expect(r.moved).toBe(true);
    expect(r.board[0]).toBe(2);
    expect(tileCount(r.board)).toBe(2);
    expect(r.spawned).not.toBeNull();
    expect(r.board[r.spawned!.index]).toBe(r.spawned!.value);
    expect(r.spawned!.index).not.toBe(0);
  });
  it('does not spawn, and does not call rng, when nothing moved', () => {
    const b: Board = [2, 0, 0, 0, ...new Array(12).fill(0)];
    const r = move(b, 'left', boom);
    expect(r.moved).toBe(false);
    expect(r.spawned).toBeNull();
    expect(r.board).toEqual(b);
    expect(r.gained).toBe(0);
    expect(r.merges).toBe(0);
    expect(tileCount(r.board)).toBe(1);
  });
  it('a stuck move on a full board leaves it unchanged', () => {
    const stuck = checker();
    for (const d of DIRS) {
      const r = move(stuck, d, boom);
      expect(r.moved).toBe(false);
      expect(r.board).toEqual(stuck);
    }
  });
  it('reports the score gained and merge count of the slide', () => {
    const b: Board = [2, 2, 4, 4, 8, 8, 0, 0, ...new Array(8).fill(0)];
    const r = move(b, 'left', mulberry32(4));
    expect(r.gained).toBe(4 + 8 + 16);
    expect(r.merges).toBe(3);
  });
  it('can spawn into the cell a merge just freed', () => {
    const b: Board = [2, 2, 4, 8, 16, 32, 64, 128, 2, 4, 8, 16, 32, 64, 128, 256];
    const r = move(b, 'left', mulberry32(1));
    expect(r.moved).toBe(true);
    expect(r.spawned!.index).toBe(3);
    expect(tileCount(r.board)).toBe(16);
  });
  it('does not mutate its input', () => {
    const b: Board = [2, 2, 0, 0, ...new Array(12).fill(0)];
    const copy = b.slice();
    move(b, 'left', mulberry32(1));
    expect(b).toEqual(copy);
  });
});

describe('newBoard', () => {
  it('starts with two tiles, each a 2 or a 4', () => {
    for (let s = 1; s <= 50; s++) {
      const b = newBoard(mulberry32(s));
      expect(tileCount(b)).toBe(2);
      expect(isValidBoard(b)).toBe(true);
      expect(b.every((v) => v === 0 || v === 2 || v === 4)).toBe(true);
    }
  });
  it('is the same for the same seed and differs across seeds', () => {
    expect(newBoard(mulberry32(8))).toEqual(newBoard(mulberry32(8)));
    const distinct = new Set(Array.from({ length: 30 }, (_, s) => newBoard(mulberry32(s + 1)).join(',')));
    expect(distinct.size).toBeGreaterThan(20);
  });
});

describe('game over', () => {
  it('an empty cell always means a move exists', () => {
    expect(canMove(emptyBoard())).toBe(true);
    const b = checker(); b[7] = 0;
    expect(canMove(b)).toBe(true);
    expect(isGameOver(b)).toBe(false);
  });
  it('a full board with no equal neighbours has no move', () => {
    const b = checker();
    expect(canMove(b)).toBe(false);
    expect(isGameOver(b)).toBe(true);
  });
  it('a full board with one equal horizontal pair can still move', () => {
    const b = checker(); b[1] = b[0];
    expect(canMove(b)).toBe(true);
  });
  it('a full board with one equal vertical pair can still move', () => {
    const b = checker(); b[4] = b[0];
    expect(canMove(b)).toBe(true);
  });
  it('equal tiles in the last row and last column are noticed', () => {
    const a = checker(); a[14] = a[15];
    const c = checker(); c[11] = c[15];
    expect(canMove(a)).toBe(true);
    expect(canMove(c)).toBe(true);
  });
  it('diagonal neighbours do not count', () => {
    const b = checker();
    expect(b[0]).toBe(b[5]); // equal on the diagonal...
    expect(b[5]).toBe(b[10]);
    expect(canMove(b)).toBe(false); // ...and still no move
  });
  it('a full board is over exactly when every direction is stuck', () => {
    const rng = mulberry32(31);
    for (let n = 0; n < 400; n++) {
      const b = Array.from({ length: 16 }, () => 2 ** (1 + Math.floor(rng() * 3)));
      const stuck = DIRS.every((d) => !slide(b, d).moved);
      expect(canMove(b)).toBe(!stuck);
    }
  });
  it('a game played until canMove is false really has no moving direction', () => {
    const rng = mulberry32(2);
    let b = newBoard(rng);
    let guard = 0;
    while (canMove(b) && guard++ < 100000) b = move(b, DIRS[Math.floor(rng() * 4)], rng).board;
    expect(guard).toBeLessThan(100000);
    expect(DIRS.every((d) => !slide(b, d).moved)).toBe(true);
    expect(tileCount(b)).toBe(16);
  });
});

describe('win', () => {
  it('2048 or higher is a win, 1024 is not', () => {
    const b = emptyBoard();
    b[0] = 1024;
    expect(hasWon(b)).toBe(false);
    b[1] = 2048;
    expect(hasWon(b)).toBe(true);
    b[2] = 4096;
    expect(hasWon(b)).toBe(true);
  });
  it('two 1024s merge into the winning tile and the game can go on', () => {
    const b: Board = [1024, 1024, 0, 0, ...new Array(12).fill(0)];
    const r = move(b, 'left', mulberry32(1));
    expect(r.board[0]).toBe(WIN_TILE);
    expect(r.gained).toBe(2048);
    expect(hasWon(r.board)).toBe(true);
    expect(canMove(r.board)).toBe(true);
  });
  it('the engine allows tiles past 2048', () => {
    const r = slideLine([2048, 2048, 0, 0]);
    expect(r.line[0]).toBe(4096);
    expect(maxTile([4096, ...new Array(15).fill(0)])).toBe(4096);
  });
});

describe('determinism', () => {
  const play = (seed: number, steps: number) => {
    const rng = mulberry32(seed);
    const pick = mulberry32(seed ^ 0x9e3779b9);
    let b = newBoard(rng);
    let score = 0;
    for (let i = 0; i < steps; i++) {
      const r = move(b, DIRS[Math.floor(pick() * 4)], rng);
      b = r.board; score += r.gained;
    }
    return { b, score };
  };
  it('the same seed gives the same game', () => {
    expect(play(42, 300)).toEqual(play(42, 300));
  });
  it('different seeds give different games', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, s) => JSON.stringify(play(s + 100, 120))));
    expect(seen.size).toBeGreaterThan(8);
  });
});

describe('score accounting', () => {
  it('the score of a slide equals the sum of the tiles created by merges', () => {
    const rng = mulberry32(6);
    for (let n = 0; n < 500; n++) {
      const b = Array.from({ length: 16 }, () => (rng() < 0.45 ? 0 : 2 ** (1 + Math.floor(rng() * 4))));
      for (const d of DIRS) {
        const s = slide(b, d);
        const fromCells = s.cells.filter((c) => c.from.length === 2);
        expect(s.gained).toBe(fromCells.reduce((a, c) => a + c.value, 0));
        expect(s.merges).toBe(fromCells.length);
        // each merged tile is worth double each of its two sources
        for (const c of fromCells) { expect(b[c.from[0]]).toBe(c.value / 2); expect(b[c.from[1]]).toBe(c.value / 2); }
      }
    }
  });
  it('a worked game: scores add up move by move', () => {
    const start: Board = [2, 2, 4, 4, ...new Array(12).fill(0)];
    const first = move(start, 'left', mulberry32(1)); // 2+2 -> 4, 4+4 -> 8
    expect(first.gained).toBe(12);
    expect(first.board.slice(0, 2)).toEqual([4, 8]);
    // put two 8s side by side below and merge them as well
    const next = first.board.slice();
    next.fill(0, 2);
    next[4] = 8; next[5] = 8;
    const second = move(next, 'left', mulberry32(2));
    expect(first.gained + second.gained).toBe(12 + 16);
  });
});

describe('random-play fuzz', () => {
  it('keeps every invariant across thousands of moves and several restarts', () => {
    const rng = mulberry32(20261022);
    const pick = mulberry32(99);
    let b = newBoard(rng);
    let score = 0;
    let steps = 0;
    let games = 1;
    let sawMerge = false;
    let sawNoOp = false;
    let largest = 0;
    while (steps < 12000) {
      steps += 1;
      if (!canMove(b)) { b = newBoard(rng); score = 0; games += 1; continue; }
      const dir = DIRS[Math.floor(pick() * 4)];
      const before = b;
      const snapshot = before.slice();
      const sumBefore = sumTiles(before);
      const countBefore = tileCount(before);
      const r = move(before, dir, rng);
      expect(before).toEqual(snapshot); // the input is never mutated

      expect(isValidBoard(r.board)).toBe(true);
      expect(r.gained).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(r.gained)).toBe(true);

      if (r.moved) {
        expect(r.spawned).not.toBeNull();
        expect([2, 4]).toContain(r.spawned!.value);
        // the new tile lands in a cell that was empty after sliding
        expect(slide(before, dir).board[r.spawned!.index]).toBe(0);
        // total value only grows, and only by the spawned tile
        expect(sumTiles(r.board)).toBe(sumBefore + r.spawned!.value);
        // tile count: merges remove one tile each, the spawn adds one
        expect(tileCount(r.board)).toBe(countBefore - r.merges + 1);
        if (r.merges) sawMerge = true;
      } else {
        sawNoOp = true;
        expect(r.spawned).toBeNull();
        expect(r.board).toEqual(before);
        expect(sumTiles(r.board)).toBe(sumBefore);
        expect(r.gained).toBe(0);
      }
      score += r.gained;
      largest = Math.max(largest, maxTile(r.board));
      b = r.board;
    }
    expect(games).toBeGreaterThan(5);
    expect(sawMerge).toBe(true);
    expect(sawNoOp).toBe(true);
    expect(largest).toBeGreaterThanOrEqual(64);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('score never decreases within a game and matches the tile values on the board', () => {
    // Every tile's value was created by merges or a spawn: sum(board) = spawned total, and
    // score = sum over merges. Check the relation  sum(board) = 2*spawns... via replay.
    const rng = mulberry32(5150);
    const pick = mulberry32(7);
    let b = newBoard(rng);
    let spawnedTotal = sumTiles(b);
    let score = 0;
    for (let i = 0; i < 4000 && canMove(b); i++) {
      const r = move(b, DIRS[Math.floor(pick() * 4)], rng);
      const prev = score;
      score += r.gained;
      expect(score).toBeGreaterThanOrEqual(prev);
      if (r.spawned) spawnedTotal += r.spawned.value;
      b = r.board;
      expect(sumTiles(b)).toBe(spawnedTotal);
    }
  });
});

describe('input mapping', () => {
  it('maps arrows and WASD in either case', () => {
    expect(keyToDir('ArrowLeft')).toBe('left');
    expect(keyToDir('ArrowRight')).toBe('right');
    expect(keyToDir('ArrowUp')).toBe('up');
    expect(keyToDir('ArrowDown')).toBe('down');
    expect(keyToDir('a')).toBe('left');
    expect(keyToDir('D')).toBe('right');
    expect(keyToDir('w')).toBe('up');
    expect(keyToDir('S')).toBe('down');
  });
  it('ignores every other key', () => {
    for (const k of ['Enter', ' ', 'Tab', 'x', '1', 'Escape', '']) expect(keyToDir(k)).toBeNull();
  });
  it('a swipe needs 24 px, then follows the dominant axis', () => {
    expect(dirFromSwipe(23, 0)).toBeNull();
    expect(dirFromSwipe(0, -23)).toBeNull();
    expect(dirFromSwipe(24, 0)).toBe('right');
    expect(dirFromSwipe(-24, 0)).toBe('left');
    expect(dirFromSwipe(0, 24)).toBe('down');
    expect(dirFromSwipe(0, -24)).toBe('up');
    expect(dirFromSwipe(40, 10)).toBe('right');
    expect(dirFromSwipe(10, -40)).toBe('up');
    expect(dirFromSwipe(30, 30)).toBe('down');
  });
  it('survives non-finite input', () => {
    expect(dirFromSwipe(NaN, 50)).toBeNull();
    expect(dirFromSwipe(Infinity, 0)).toBeNull();
  });
});

describe('text helpers', () => {
  it('describes the board row by row', () => {
    const b: Board = [2, 0, 4, 8, ...new Array(12).fill(0)];
    const t = describeBoard(b);
    expect(t.startsWith('Row 1: 2, empty, 4, 8.')).toBe(true);
    expect(t).toContain('Row 4: empty, empty, empty, empty.');
    expect(t).not.toMatch(/NaN|undefined|null/);
  });
  it('names cells 1-based', () => {
    expect(where(0)).toBe('row 1, column 1');
    expect(where(15)).toBe('row 4, column 4');
    expect(where(6)).toBe('row 2, column 3');
  });
  it('validates boards', () => {
    expect(isValidBoard(emptyBoard())).toBe(true);
    expect(isValidBoard([2, ...new Array(15).fill(0)])).toBe(true);
    expect(isValidBoard([3, ...new Array(15).fill(0)])).toBe(false);
    expect(isValidBoard([1, ...new Array(15).fill(0)])).toBe(false);
    expect(isValidBoard([2, 0, 0])).toBe(false);
    expect(isValidBoard([-2, ...new Array(15).fill(0)])).toBe(false);
  });
});

/** Returns the given values in turn, then 0 forever. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

/** A full board with no equal orthogonal neighbours, so no move exists. */
function checker(): Board {
  return [
    2, 4, 2, 4,
    4, 2, 4, 2,
    2, 4, 2, 4,
    4, 2, 4, 2,
  ];
}
