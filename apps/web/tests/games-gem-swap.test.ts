/**
 * games-gem-swap.test.ts - the engine behind `gem-swap`.
 *
 * Pinned: the board size, the six shapes and colours, 30 moves and 60 seconds, and every other
 * number the guide page quotes; that a board never starts with a line of three and always has a
 * move (checked on 3,000 seeds); line finding against a brute-force window oracle on thousands of
 * random boards; legal moves against a brute-force swap-and-look oracle; that a swap which makes
 * no line is refused and changes nothing; hand-built boards where the cleared cells, the score and
 * the cascade are known exactly (a three, a two-step cascade, a four that makes a row sweeper, a
 * five that makes a colour clear, a cross that makes a burst); sweepers, bursts and chains going
 * off; the colour clear on a swap and two together; that cascade scoring is 10 points a piece
 * times the step number up to 8; that a board with no moves is reshuffled without losing a piece;
 * that the same seed and swaps give the same game; 150 random games of 40 moves keep every
 * invariant (full board, no line at rest, a move available, pieces numbered uniquely); the words,
 * the tones and the saved bests.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  N, SIZE, TYPES, POINTS_PER_PIECE, MAX_MULTIPLIER, MOVES_START, TIME_START, MAX_BEST, PEAK_GAIN, MAX_WAVES, SP, PIECES, SPECIAL_NAMES, MODES, parseMode,
  mulberry32, plural, idx, rowOf, colOf, inBoard, cloneBoard, adjacent, findRuns, hasRuns, legalMoves, hasMove, newBoard, fixRuns, ensureMoves,
  multiplier, waveScore, swapPieces, findHint, newGame, play, tickTime, pieceName, cellLabel, moveMessage, overText, shareLine, waveTone, specialTone, refuseTone,
  emptyStored, cleanBest, sanitiseStored, toStorable, bestFor, recordScore,
  type Board, type MoveResult,
} from '../src/components/apps-private/gem-swap/helpers';

vi.setConfig({ testTimeout: 120_000 });

const EM_DASH = String.fromCharCode(0x2014);

// ── test tools ──

/** The pattern (c + 2r) mod 6: no line anywhere and no swap that makes one. A quiet background to build scenes on. */
const quiet = (): Board => {
  const b = newBoard(1);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { b.t[idx(r, c)] = (c + 2 * r) % 6; b.s[idx(r, c)] = 0; }
  return b;
};
const put = (b: Board, r: number, c: number, t: number, s = 0): void => { b.t[idx(r, c)] = t; b.s[idx(r, c)] = s; };
/** A generator that hands out these numbers first and then carries on with a proper seeded one. */
const scripted = (values: number[]) => { let k = 0; const rest = mulberry32(99); return () => (k < values.length ? values[k++] : rest()); };

/** An independent line finder: a cell is in a line if some window of three cells in a row or column holds equal pieces, none a colour clear. */
const oracleCells = (b: Board): Set<number> => {
  const out = new Set<number>();
  const ok = (i: number): boolean => b.t[i] >= 0 && b.s[i] !== SP.colour;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c + 2 < N) {
      const a = idx(r, c);
      if (ok(a) && ok(a + 1) && ok(a + 2) && b.t[a] === b.t[a + 1] && b.t[a] === b.t[a + 2]) { out.add(a); out.add(a + 1); out.add(a + 2); }
    }
    if (r + 2 < N) {
      const a = idx(r, c);
      if (ok(a) && ok(a + N) && ok(a + 2 * N) && b.t[a] === b.t[a + N] && b.t[a] === b.t[a + 2 * N]) { out.add(a); out.add(a + N); out.add(a + 2 * N); }
    }
  }
  return out;
};
const engineCells = (b: Board): Set<number> => new Set(findRuns(b).flatMap((r) => r.cells));
const randomBoard = (rng: () => number, kinds = TYPES, specials = false): Board => {
  const b = newBoard(1);
  for (let i = 0; i < SIZE; i++) { b.t[i] = Math.floor(rng() * kinds); b.s[i] = specials && rng() < 0.15 ? 1 + Math.floor(rng() * 4) : 0; }
  return b;
};
const key = (a: number, c: number): string => `${Math.min(a, c)}-${Math.max(a, c)}`;
const checkAtRest = (b: Board): void => {
  expect(b.t.every((t) => t >= 0 && t < TYPES)).toBe(true);
  expect(b.s.every((s) => s >= 0 && s <= 4)).toBe(true);
  expect(hasRuns(b)).toBe(false);
  expect(hasMove(b)).toBe(true);
  expect(new Set(b.id).size).toBe(SIZE);
  expect(b.id.every((i) => i >= 0 && i < b.nextId)).toBe(true);
};

describe('constants quoted on the guide page', () => {
  it('match the spec', () => {
    expect(N).toBe(8);
    expect(SIZE).toBe(64);
    expect(TYPES).toBe(6);
    expect(POINTS_PER_PIECE).toBe(10);
    expect(MAX_MULTIPLIER).toBe(8);
    expect(MOVES_START).toBe(30);
    expect(TIME_START).toBe(60);
    expect(MAX_BEST).toBe(9_999_999);
    expect(MAX_WAVES).toBeGreaterThanOrEqual(50);
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    expect([...MODES]).toEqual(['moves', 'timed']);
    expect(SP).toEqual({ none: 0, row: 1, col: 2, burst: 3, colour: 4 });
  });
  it('the six pieces each have their own shape, colour word and name', () => {
    expect(PIECES).toHaveLength(6);
    expect(new Set(PIECES.map((p) => p.shape)).size).toBe(6);
    expect(new Set(PIECES.map((p) => p.colour)).size).toBe(6);
    expect(PIECES.map((p) => p.shape)).toEqual(['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star']);
    for (const p of PIECES) expect(p.name).toBe(`${p.colour} ${p.shape}`);
    expect(Object.values(SPECIAL_NAMES)).toEqual(['row sweeper', 'column sweeper', 'burst', 'colour clear']);
  });
  it('parseMode falls back to moves', () => {
    expect(parseMode('timed')).toBe('timed');
    for (const bad of ['', 'moves', 'x', null, undefined, 3, {}]) expect(parseMode(bad)).toBe('moves');
  });
});

describe('the cell helpers', () => {
  it('row, column and index agree, and neighbours share an edge', () => {
    for (let i = 0; i < SIZE; i++) expect(idx(rowOf(i), colOf(i))).toBe(i);
    expect(adjacent(0, 1)).toBe(true);
    expect(adjacent(0, 8)).toBe(true);
    expect(adjacent(7, 8)).toBe(false); // end of one row, start of the next
    expect(adjacent(0, 9)).toBe(false);
    expect(adjacent(0, 0)).toBe(false);
    expect(adjacent(-1, 0)).toBe(false);
    expect(adjacent(63, 64)).toBe(false);
    expect(inBoard(63)).toBe(true);
    expect(inBoard(64)).toBe(false);
    expect(inBoard(1.5)).toBe(false);
  });
});

describe('a new board', () => {
  it('never starts with a line of three and always has a move, on 3,000 seeds', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const b = newBoard(seed);
      expect(oracleCells(b).size, `seed ${seed}`).toBe(0);
      expect(findRuns(b)).toHaveLength(0);
      expect(hasMove(b), `seed ${seed}`).toBe(true);
      expect(b.t.every((t) => t >= 0 && t < TYPES)).toBe(true);
      expect(b.s.every((s) => s === 0)).toBe(true);
      expect(new Set(b.id).size).toBe(SIZE);
    }
  });
  it('is the same for the same seed, differs between seeds, and uses all six kinds', () => {
    expect(JSON.stringify(newBoard(42))).toBe(JSON.stringify(newBoard(42)));
    expect(JSON.stringify(newBoard(1))).not.toBe(JSON.stringify(newBoard(2)));
    expect(new Set(newBoard(7).t).size).toBe(6);
    for (const bad of [NaN, Infinity, -4, 1.5, 2 ** 40, 'x' as unknown as number]) {
      const b = newBoard(bad);
      expect(hasRuns(b)).toBe(false);
      expect(hasMove(b)).toBe(true);
    }
  });
});

describe('finding lines', () => {
  it('agrees with a brute-force window search on thousands of random boards (with and without colour clears)', () => {
    const rng = mulberry32(11);
    for (let n = 0; n < 4000; n++) {
      const kinds = 2 + Math.floor(rng() * 5);
      const b = randomBoard(rng, kinds, n % 3 === 0);
      expect([...engineCells(b)].sort((x, y) => x - y)).toEqual([...oracleCells(b)].sort((x, y) => x - y));
      for (const run of findRuns(b)) {
        expect(run.len).toBe(run.cells.length);
        expect(run.len).toBeGreaterThanOrEqual(3);
        expect(run.cells.every((c) => b.t[c] === run.type)).toBe(true);
      }
    }
  });
  it('a run is reported once, as its full length', () => {
    const b = quiet();
    for (const c of [0, 1, 2, 4]) put(b, 0, c, 3);
    const runs = findRuns(b);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ dir: 'h', len: 5, type: 3 });
  });
  it('a colour clear never takes part in a line', () => {
    const b = quiet();
    put(b, 0, 0, 5);
    put(b, 0, 1, 5, SP.colour);
    put(b, 0, 2, 5);
    expect(findRuns(b)).toHaveLength(0);
  });
});

describe('legal moves', () => {
  it('match a brute-force swap-and-look search on boards at rest and mid-game', () => {
    const rng = mulberry32(21);
    for (let n = 0; n < 400; n++) {
      const g = newGame(n, 'moves');
      for (let k = 0; k < (n % 5); k++) { const lm = legalMoves(g.board); const [a, c] = lm[Math.floor(rng() * lm.length)]; play(g, a, c, rng); }
      const b = g.board;
      const expected = new Set<string>();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr;
          const c2 = c + dc;
          if (r2 >= N || c2 >= N) continue;
          const i = idx(r, c);
          const j = idx(r2, c2);
          const t = cloneBoard(b);
          [t.t[i], t.t[j]] = [t.t[j], t.t[i]];
          [t.s[i], t.s[j]] = [t.s[j], t.s[i]];
          const cells = oracleCells(t);
          if (b.s[i] === SP.colour || b.s[j] === SP.colour || cells.has(i) || cells.has(j)) expected.add(key(i, j));
        }
      }
      const got = new Set(legalMoves(b).map(([i, j]) => key(i, j)));
      expect([...got].sort()).toEqual([...expected].sort());
    }
  });
  it('the quiet pattern has no move at all', () => {
    expect(legalMoves(quiet())).toEqual([]);
    expect(hasMove(quiet())).toBe(false);
  });
});

describe('a swap that does nothing', () => {
  it('is refused and leaves the board exactly as it was', () => {
    const b = quiet();
    const before = JSON.stringify(b);
    const res = swapPieces(b, 0, 1, mulberry32(1));
    expect(res).toMatchObject({ ok: false, reason: 'nomatch', score: 0, steps: [] });
    expect(JSON.stringify(b)).toBe(before);
  });
  it('is refused for cells that are not neighbours, not on the board, or the same cell', () => {
    const b = newBoard(5);
    const before = JSON.stringify(b);
    expect(swapPieces(b, 0, 9, mulberry32(1))).toMatchObject({ ok: false, reason: 'far' });
    expect(swapPieces(b, 7, 8, mulberry32(1))).toMatchObject({ ok: false, reason: 'far' });
    for (const [a, c] of [[0, 0], [-1, 0], [0, 64], [1.5, 2], [NaN, 1]]) expect(swapPieces(b, a, c, mulberry32(1))).toMatchObject({ ok: false, reason: 'bounds' });
    expect(JSON.stringify(b)).toBe(before);
  });
});

describe('a line of three', () => {
  const scene = (): Board => {
    const b = quiet();
    put(b, 0, 0, 5);
    put(b, 0, 1, 5);
    put(b, 1, 2, 5);
    return b;
  };
  it('the scene is quiet before the swap, and the swap is a legal move', () => {
    const b = scene();
    expect(hasRuns(b)).toBe(false);
    expect(legalMoves(b).map(([i, j]) => key(i, j))).toContain(key(2, 10));
  });
  it('clears exactly the three, scores 30, and nothing falls because they are at the top', () => {
    const b = scene();
    const res = swapPieces(b, 2, 10, scripted([0.2, 0.4, 0.7]));
    expect(res.ok).toBe(true);
    expect(res.steps).toHaveLength(1);
    const s = res.steps[0];
    expect(s.wave).toBe(1);
    expect(s.cleared).toEqual([0, 1, 2]);
    expect(s.created).toEqual([]);
    expect(s.activated).toEqual([]);
    expect(s.score).toBe(30);
    expect(res.score).toBe(30);
    expect(res.cleared).toBe(3);
    expect(res.chain).toBe(1);
    // the new pieces are the ones the generator handed out, in column order
    expect(s.board.t.slice(0, 3)).toEqual([1, 2, 4]);
    // the rest of the board is untouched
    expect(s.board.t[10]).toBe(2); // the piece that was swapped down
    expect(s.board.t[3]).toBe(3);
    checkAtRest(b);
  });
  it('the step carries a snapshot of the board after the fall, so the page can show it', () => {
    const b = scene();
    const res = swapPieces(b, 2, 10, scripted([0.2, 0.4, 0.7]));
    expect(res.steps[0].board.t).toEqual(b.t);
    expect(res.steps[0].board).not.toBe(b);
  });
});

describe('a cascade', () => {
  // Column 2 gets a vertical three at rows 3 to 5; when it clears, the piece above falls into row 5 and lines up with two waiting beside it.
  const scene = (): Board => {
    const b = quiet();
    put(b, 3, 2, 1);
    put(b, 4, 2, 1);
    put(b, 2, 2, 3);
    put(b, 5, 0, 3);
    put(b, 5, 1, 3);
    return b;
  };
  it('the scene is quiet and the swap is a legal move', () => {
    const b = scene();
    expect(hasRuns(b)).toBe(false);
    expect(legalMoves(b).map(([i, j]) => key(i, j))).toContain(key(idx(5, 2), idx(5, 3)));
  });
  it('clears the vertical three, then the three that fall into line, and pays 10 x pieces x step', () => {
    const b = scene();
    const res = swapPieces(b, idx(5, 2), idx(5, 3), scripted([0.05, 0.2, 0.9, 0.1, 0.25, 0.55]));
    expect(res.ok).toBe(true);
    expect(res.steps.length).toBeGreaterThanOrEqual(2);
    expect(res.steps[0].cleared).toEqual([idx(3, 2), idx(4, 2), idx(5, 2)]);
    expect(res.steps[0].score).toBe(30);
    expect(res.steps[1].wave).toBe(2);
    expect(res.steps[1].cleared).toEqual([idx(5, 0), idx(5, 1), idx(5, 2)]);
    expect(res.steps[1].score).toBe(60);
    // however long the chain runs, every step pays 10 x pieces x its number (capped at 8)
    res.steps.forEach((s, i) => {
      expect(s.wave).toBe(i + 1);
      expect(s.score).toBe(10 * s.cleared.length * Math.min(i + 1, 8));
    });
    expect(res.score).toBe(res.steps.reduce((n, s) => n + s.score, 0));
    expect(res.cleared).toBe(res.steps.reduce((n, s) => n + s.cleared.length, 0));
    expect(res.chain).toBe(res.steps.length);
    checkAtRest(b);
  });
  it('the multiplier is the step number up to 8', () => {
    expect([1, 2, 3, 7, 8, 9, 20, 200].map(multiplier)).toEqual([1, 2, 3, 7, 8, 8, 8, 8]);
    expect(waveScore(3, 1)).toBe(30);
    expect(waveScore(3, 2)).toBe(60);
    expect(waveScore(5, 9)).toBe(400);
    expect(waveScore(0, 3)).toBe(0);
    expect(waveScore(NaN, 3)).toBe(0);
    expect(multiplier(NaN)).toBe(1);
    expect(multiplier(0)).toBe(1);
  });
});

describe('special pieces are made', () => {
  it('a line of four makes a row sweeper where you swapped, and clears the other three', () => {
    const b = quiet();
    for (const c of [0, 1, 3]) put(b, 0, c, 5);
    put(b, 1, 2, 5);
    expect(hasRuns(b)).toBe(false);
    const res = swapPieces(b, 2, 10, scripted([0.2, 0.01, 0.4]));
    const s = res.steps[0];
    expect(s.cleared).toEqual([0, 1, 3]);
    expect(s.created).toEqual([{ index: 2, special: SP.row }]);
    expect(s.score).toBe(30);
    expect(s.board.s[2]).toBe(SP.row);
    expect(s.board.t[2]).toBe(5);
    checkAtRest(b);
  });
  it('a vertical four makes a column sweeper', () => {
    const b = quiet();
    // column 0, rows 0 to 3, with the swap partner (already a 5) beside the gap
    for (const r of [0, 1, 3]) put(b, r, 0, 5);
    expect(hasRuns(b)).toBe(false);
    const res = swapPieces(b, idx(2, 0), idx(2, 1), mulberry32(3));
    expect(res.ok).toBe(true);
    expect(res.steps[0].created).toEqual([{ index: idx(2, 0), special: SP.col }]);
    expect(res.steps[0].cleared).toEqual([idx(0, 0), idx(1, 0), idx(3, 0)]);
  });
  it('a line of five makes a colour clear', () => {
    const b = quiet();
    for (const c of [0, 1, 3, 4]) put(b, 0, c, 3);
    put(b, 1, 2, 3);
    expect(hasRuns(b)).toBe(false);
    const res = swapPieces(b, 2, 10, mulberry32(9));
    const s = res.steps[0];
    expect(s.cleared).toEqual([0, 1, 3, 4]);
    expect(s.created).toEqual([{ index: 2, special: SP.colour }]);
    expect(s.score).toBe(40);
    expect(s.board.s[2]).toBe(SP.colour);
  });
  it('a cross or corner of two lines makes a burst where they meet', () => {
    const b = quiet();
    for (const [r, c] of [[0, 1], [0, 3], [0, 4], [1, 2], [2, 2]] as const) put(b, r, c, 0);
    expect(hasRuns(b)).toBe(false);
    const res = swapPieces(b, 1, 2, mulberry32(4));
    expect(res.ok).toBe(true);
    const s = res.steps[0];
    expect(s.created).toEqual([{ index: 2, special: SP.burst }]);
    expect(s.cleared).toEqual([3, 4, 10, 18]);
    expect(s.score).toBe(40);
    expect(s.board.s[18]).toBe(SP.burst); // it sits in the top row, so it falls two places when the cells below it clear
  });
});

describe('special pieces go off', () => {
  const scene = (special: number): Board => {
    const b = quiet();
    put(b, 0, 0, 5);
    put(b, 0, 1, 5, special);
    put(b, 1, 2, 5);
    return b;
  };
  it('a row sweeper in a line clears its whole row', () => {
    const b = scene(SP.row);
    const res = swapPieces(b, 2, 10, mulberry32(2));
    const s = res.steps[0];
    expect(s.cleared).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(s.activated).toEqual([1]);
    expect(s.score).toBe(80);
  });
  it('a column sweeper in a line clears its whole column and the line it was in', () => {
    const b = scene(SP.col);
    const res = swapPieces(b, 2, 10, mulberry32(2));
    const s = res.steps[0];
    expect(s.cleared).toEqual([0, 1, 2, 9, 17, 25, 33, 41, 49, 57]);
    expect(s.activated).toEqual([1]);
    expect(s.score).toBe(100);
  });
  it('a burst clears the 3 by 3 around it', () => {
    const b = scene(SP.burst);
    const res = swapPieces(b, 2, 10, mulberry32(2));
    const s = res.steps[0];
    expect(s.cleared).toEqual([0, 1, 2, 8, 9, 10]);
    expect(s.activated).toEqual([1]);
  });
  it('a special hit by another special goes off too (a chain)', () => {
    const b = scene(SP.row);
    put(b, 0, 6, 2, SP.col);
    const res = swapPieces(b, 2, 10, mulberry32(2));
    const s = res.steps[0];
    expect(s.activated).toEqual([1, 6]);
    expect(s.cleared).toHaveLength(8 + 7); // all of row 0, then column 6 below it
    expect(s.cleared).toContain(idx(7, 6));
  });
  it('after anything goes off the board is full again and at rest', () => {
    for (const sp of [SP.row, SP.col, SP.burst]) {
      const b = scene(sp);
      swapPieces(b, 2, 10, mulberry32(8));
      checkAtRest(b);
    }
  });
});

describe('the colour clear', () => {
  it('swapped with a neighbour it clears every piece of that kind, and itself', () => {
    const b = quiet();
    put(b, 0, 0, 0, SP.colour);
    const probe = cloneBoard(b);
    [probe.t[0], probe.t[1]] = [probe.t[1], probe.t[0]];
    [probe.s[0], probe.s[1]] = [probe.s[1], probe.s[0]];
    const kind = probe.t[0]; // the neighbour's kind, now at cell 0
    const expected = [1, ...probe.t.map((t, i) => (t === kind ? i : -1)).filter((i) => i >= 0)].sort((x, y) => x - y);
    expect(legalMoves(b).map(([i, j]) => key(i, j))).toEqual([key(0, 1), key(0, 8)]);
    const res = swapPieces(b, 0, 1, mulberry32(3));
    expect(res.ok).toBe(true);
    expect(res.steps[0].cleared).toEqual(expected);
    expect(res.steps[0].activated).toContain(1);
    expect(res.steps[0].score).toBe(10 * expected.length);
    checkAtRest(b);
  });
  it('two colour clears swapped together clear the whole board', () => {
    const b = quiet();
    put(b, 0, 0, 0, SP.colour);
    put(b, 0, 1, 1, SP.colour);
    const res = swapPieces(b, 0, 1, mulberry32(3));
    expect(res.ok).toBe(true);
    expect(res.steps[0].cleared).toHaveLength(64);
    expect(res.steps[0].score).toBe(640);
    checkAtRest(b);
  });
  it('a colour clear swap is always allowed, even with no line', () => {
    const b = quiet();
    put(b, 3, 3, 2, SP.colour);
    expect(swapPieces(b, idx(3, 3), idx(3, 4), mulberry32(1)).ok).toBe(true);
  });
});

describe('a board with no moves', () => {
  it('is reshuffled, keeping every piece and special, and ends with a move and no line', () => {
    const rng = mulberry32(6);
    for (let n = 0; n < 40; n++) {
      const b = quiet();
      put(b, 7, 7, b.t[63], SP.row); // a special riding along
      const before = b.t.map((t, i) => `${t}:${b.s[i]}:${b.id[i]}`).sort();
      expect(hasMove(b)).toBe(false);
      expect(ensureMoves(b, rng)).toBe(true);
      expect(hasRuns(b)).toBe(false);
      expect(hasMove(b)).toBe(true);
      expect(b.t.map((t, i) => `${t}:${b.s[i]}:${b.id[i]}`).sort()).toEqual(before);
    }
  });
  it('does nothing when there is already a move', () => {
    const b = newBoard(3);
    const before = JSON.stringify(b);
    expect(ensureMoves(b, mulberry32(1))).toBe(false);
    expect(JSON.stringify(b)).toBe(before);
  });
  it('a move that leaves no moves reports the reshuffle and the board is playable again', () => {
    // play random games until a reshuffle happens (it does within a few thousand moves) and check the result then
    let seen = 0;
    for (let seed = 0; seed < 300 && seen < 3; seed++) {
      const g = newGame(seed, 'moves');
      const rng = mulberry32(seed + 500);
      for (let m = 0; m < 30 && !g.over; m++) {
        const lm = legalMoves(g.board);
        const [a, c] = lm[Math.floor(rng() * lm.length)];
        const res = play(g, a, c, rng);
        if (res.reshuffled) {
          seen += 1; checkAtRest(g.board); expect(moveMessage(res)).toMatch(/shuffled/);
          // The last step snapshot is taken before the shuffle, so the page must paint game.board at the end of a move.
          const last = res.steps[res.steps.length - 1].board;
          expect(last.id.some((id, i) => id !== g.board.id[i])).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('fixing a stuck cascade', () => {
  it('removes any line left on the board', () => {
    const rng = mulberry32(1);
    for (let n = 0; n < 100; n++) {
      const b = randomBoard(rng, 3);
      fixRuns(b, rng);
      expect(hasRuns(b)).toBe(false);
    }
  });
});

describe('whole games', () => {
  it('150 random games of 40 moves keep every invariant', () => {
    for (let seed = 0; seed < 150; seed++) {
      const g = newGame(seed, 'moves');
      const rng = mulberry32(seed + 1000);
      let total = 0;
      for (let m = 0; m < 40 && !g.over; m++) {
        const lm = legalMoves(g.board);
        expect(lm.length).toBeGreaterThan(0);
        const [a, c] = lm[Math.floor(rng() * lm.length)];
        const before = g.score;
        const res: MoveResult = play(g, a, c, rng);
        expect(res.ok).toBe(true);
        expect(res.chain).toBeGreaterThanOrEqual(1);
        res.steps.forEach((s, i) => {
          expect(s.wave).toBe(i + 1);
          expect(s.cleared.length).toBeGreaterThanOrEqual(3);
          expect(s.score).toBe(waveScore(s.cleared.length, i + 1));
          expect(new Set(s.cleared).size).toBe(s.cleared.length);
        });
        expect(g.score - before).toBe(res.score);
        total += res.score;
        checkAtRest(g.board);
      }
      expect(g.score).toBe(total);
    }
  });
  it('the same seed and swaps give the same game', () => {
    const run = (): string => {
      const g = newGame(77, 'moves');
      const rng = mulberry32(5);
      const picker = mulberry32(6);
      for (let m = 0; m < 30 && !g.over; m++) { const lm = legalMoves(g.board); const [a, c] = lm[Math.floor(picker() * lm.length)]; play(g, a, c, rng); }
      return JSON.stringify(g);
    };
    expect(run()).toBe(run());
  });
  it('a moves game ends after exactly 30 moves; the board and score then stop changing', () => {
    const g = newGame(3, 'moves');
    expect(g.movesLeft).toBe(30);
    const rng = mulberry32(1);
    for (let m = 0; m < 30; m++) {
      expect(g.over).toBe(false);
      const lm = legalMoves(g.board);
      play(g, lm[0][0], lm[0][1], rng);
      expect(g.movesLeft).toBe(29 - m);
    }
    expect(g.over).toBe(true);
    expect(g.moves).toBe(30);
    const snap = JSON.stringify(g);
    expect(play(g, 0, 1, rng)).toMatchObject({ ok: false, reason: 'over' });
    expect(JSON.stringify(g)).toBe(snap);
  });
  it('a refused swap costs no move', () => {
    const g = newGame(3, 'moves');
    g.board = quiet();
    expect(play(g, 0, 1, mulberry32(1)).ok).toBe(false);
    expect(g.movesLeft).toBe(30);
    expect(g.moves).toBe(0);
  });
  it('a timed game has 60 seconds, unlimited moves, and ends when the clock runs out', () => {
    const g = newGame(3, 'timed');
    expect(g.timeLeft).toBe(60);
    expect(g.movesLeft).toBe(0);
    const rng = mulberry32(1);
    for (let m = 0; m < 60; m++) { const lm = legalMoves(g.board); play(g, lm[0][0], lm[0][1], rng); }
    expect(g.over).toBe(false);
    expect(g.moves).toBe(60);
    for (let s = 0; s < 59; s++) tickTime(g, 1);
    expect(g.timeLeft).toBe(1);
    expect(g.over).toBe(false);
    tickTime(g, 1);
    expect(g.timeLeft).toBe(0);
    expect(g.over).toBe(true);
    tickTime(g, 5);
    expect(g.timeLeft).toBe(0);
    const h = newGame(3, 'moves');
    tickTime(h, 100);
    expect(h.over).toBe(false);
    const k = newGame(3, 'timed');
    for (const bad of [NaN, -3, Infinity, 'x' as unknown as number]) tickTime(k, bad);
    expect(k.timeLeft).toBe(60);
    tickTime(k, 500);
    expect(k.timeLeft).toBe(59); // one tick never counts for more than a second
  });
  it('the longest chain is remembered', () => {
    const g = newGame(1, 'moves');
    g.board = (() => {
      const b = quiet();
      put(b, 3, 2, 1); put(b, 4, 2, 1); put(b, 2, 2, 3); put(b, 5, 0, 3); put(b, 5, 1, 3);
      return b;
    })();
    play(g, idx(5, 2), idx(5, 3), scripted([0.05, 0.2, 0.9, 0.1, 0.25, 0.55]));
    expect(g.bestChain).toBeGreaterThanOrEqual(2);
  });
});

describe('hints', () => {
  it('suggest a legal swap that clears the most in its first step (brute force)', () => {
    const rng = mulberry32(31);
    for (let n = 0; n < 300; n++) {
      const b = newBoard(n);
      const hint = findHint(b);
      expect(hint).not.toBeNull();
      const lm = legalMoves(b).map(([i, j]) => key(i, j));
      expect(lm).toContain(key(hint![0], hint![1]));
      const size = (i: number, j: number): number => {
        const t = cloneBoard(b);
        [t.t[i], t.t[j]] = [t.t[j], t.t[i]];
        return oracleCells(t).size;
      };
      const best = Math.max(...legalMoves(b).map(([i, j]) => size(i, j)));
      expect(size(hint![0], hint![1])).toBe(best);
      void rng;
    }
    expect(findHint(quiet())).toBeNull();
  });
});

describe('words, tones and the copy line', () => {
  it('describe a cell, with the shape as well as the colour, and any special', () => {
    const b = quiet();
    expect(plural(1, 'piece')).toBe('1 piece');
    expect(plural(3, 'piece')).toBe('3 pieces');
    expect(cellLabel(b, 0)).toBe('Row 1, column 1: blue circle');
    expect(cellLabel(b, 10)).toBe('Row 2, column 3: purple hexagon');
    put(b, 0, 0, 2, SP.burst);
    expect(cellLabel(b, 0)).toBe('Row 1, column 1: pink triangle with a burst');
    expect(cellLabel(b, 99)).toBe('Empty');
    expect(pieceName(b, 99)).toBe('empty');
    for (let t = 0; t < 6; t++) expect(PIECES[t].name).toMatch(/^[a-z]+ [a-z]+$/);
  });
  it('say what a move did', () => {
    const b = quiet();
    put(b, 0, 0, 5); put(b, 0, 1, 5); put(b, 1, 2, 5);
    const res = swapPieces(b, 2, 10, scripted([0.2, 0.4, 0.7]));
    const calm = (m: string): string => m.replace(' No moves were left, so the board was shuffled.', '');
    expect(calm(moveMessage(res))).toBe('3 pieces cleared. +30 points.');
    const four = quiet();
    for (const c of [0, 1, 3]) put(four, 0, c, 5);
    put(four, 1, 2, 5);
    expect(calm(moveMessage(swapPieces(four, 2, 10, scripted([0.2, 0.01, 0.4]))))).toBe('3 pieces cleared. You made a row sweeper. +30 points.');
    expect(moveMessage({ ok: false, reason: 'nomatch', steps: [], score: 0, cleared: 0, chain: 0, reshuffled: false })).toMatch(/does not make a line/);
    expect(moveMessage({ ok: false, reason: 'far', steps: [], score: 0, cleared: 0, chain: 0, reshuffled: false })).toMatch(/next to/);
    expect(moveMessage({ ok: false, reason: 'over', steps: [], score: 0, cleared: 0, chain: 0, reshuffled: false })).toBe('');
  });
  it('the end text and the copy line read right', () => {
    const g = newGame(1, 'moves');
    g.score = 1240; g.moves = 30; g.bestChain = 4;
    expect(overText(g, false)).toBe('You scored 1240 points in 30 moves. Your longest chain was 4.');
    expect(overText(g, true)).toBe('You scored 1240 points in 30 moves. Your longest chain was 4. That is a new best!');
    g.aided = true;
    expect(overText(g, true)).toMatch(/used a hint/);
    const t = newGame(1, 'timed');
    t.score = 500; t.moves = 12; t.bestChain = 2;
    expect(overText(t, false)).toBe('You scored 500 points in 60 seconds with 12 moves. Your longest chain was 2.');
    expect(shareLine(0, 'moves', 0, false)).toBe('Gem Swap (30 moves): no points yet');
    expect(shareLine(1240, 'moves', 4, false)).toBe('Gem Swap (30 moves): 1240 points, longest chain 4');
    expect(shareLine(500, 'timed', 2, true)).toBe('Gem Swap (60 seconds): 500 points, longest chain 2, with a hint');
    for (const s of [shareLine(NaN, 'moves', NaN, false), shareLine(-5, 'x' as never, Infinity, false)]) {
      expect(s).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(s.includes(EM_DASH)).toBe(false);
    }
  });
  it('tones are short and quiet, and a chain climbs', () => {
    for (let w = 0; w <= 12; w++) {
      const t = waveTone(w);
      expect(t.gain).toBeLessThanOrEqual(0.15);
      expect(t.ms).toBeLessThanOrEqual(200);
      expect(t.freq).toBeGreaterThan(100);
      expect(t.freq).toBeLessThan(2500);
    }
    expect(waveTone(3).freq).toBeGreaterThan(waveTone(1).freq);
    expect(waveTone(NaN).freq).toBe(waveTone(1).freq);
    for (const t of [specialTone(), refuseTone()]) { expect(t.gain).toBeLessThanOrEqual(0.15); expect(t.ms).toBeLessThanOrEqual(200); }
  });
});

describe('what is saved: the best score in each mode', () => {
  it('reads good data and ignores junk', () => {
    expect(sanitiseStored(JSON.stringify({ moves: 1200, timed: 800 }))).toEqual({ moves: 1200, timed: 800 });
    expect(sanitiseStored({ moves: 5 })).toEqual({ moves: 5, timed: 0 });
    for (const bad of ['', 'not json', '[]', '"x"', 'null', null, undefined, 5, true, [], [1, 2], '{"moves":-1}', '{"moves":1.5}', '{"moves":"9"}', '{"moves":1e9}', '{"moves":null,"timed":NaN}']) {
      expect(sanitiseStored(bad as unknown)).toEqual(emptyStored());
    }
    expect(sanitiseStored({ moves: 10_000_000, timed: 9_999_999 })).toEqual({ moves: 0, timed: 9_999_999 });
  });
  it('is not fooled by __proto__ and extra keys, and returns a fresh object', () => {
    const evil = JSON.parse('{"__proto__":{"moves":99},"constructor":{"x":1},"moves":4,"extra":123}');
    const out = sanitiseStored(evil);
    expect(out).toEqual({ moves: 4, timed: 0 });
    expect(Object.keys(out).sort()).toEqual(['moves', 'timed']);
    expect(({} as Record<string, unknown>).moves).toBeUndefined();
    const input = { moves: 5, timed: 6 };
    expect(sanitiseStored(input)).not.toBe(input);
    expect(cleanBest(0)).toBe(0);
    expect(cleanBest(7)).toBe(7);
  });
  it('records a better score only, keeps the modes apart, and never counts a hinted game', () => {
    let s = emptyStored();
    let r = recordScore(s, 'moves', 900, false);
    expect(r).toMatchObject({ newBest: true });
    s = r.stored;
    expect(s).toEqual({ moves: 900, timed: 0 });
    expect(recordScore(s, 'moves', 800, false)).toMatchObject({ newBest: false, stored: { moves: 900, timed: 0 } });
    expect(recordScore(s, 'moves', 900, false).newBest).toBe(false);
    expect(recordScore(s, 'moves', 5000, true)).toMatchObject({ newBest: false, stored: { moves: 900, timed: 0 } });
    r = recordScore(s, 'timed', 300, false);
    expect(r.stored).toEqual({ moves: 900, timed: 300 });
    expect(bestFor(r.stored, 'timed')).toBe(300);
    expect(bestFor(r.stored, 'moves')).toBe(900);
    expect(recordScore(s, 'moves', 1e12, false).stored.moves).toBe(9_999_999);
    expect(recordScore(s, 'moves', NaN, false).stored.moves).toBe(900);
    expect(sanitiseStored(JSON.stringify(toStorable({ moves: 3, timed: 2 })))).toEqual({ moves: 3, timed: 2 });
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/gem-swap', f), 'utf8');
  it('no Math.random anywhere in the game', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
  });
  it('the buttons are at least 56 px (3.5rem) tall, the pieces at least 28 px, and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.gsw-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.gsw-cell \{[^}]*min-width: 1\.75rem;/);
    expect(text).toMatch(/#gsw-app \.gsw-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('sound starts off, and no piece art uses candy or gem pictures', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/let soundOn = false;/);
    expect(text).not.toMatch(/\u{1F36C}|\u{1F36D}|\u{1F48E}|\u{1F31F}/u);
  });
});
