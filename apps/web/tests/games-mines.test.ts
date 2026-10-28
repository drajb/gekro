/**
 * games-mines.test.ts - the engine behind `mines`.
 *
 * Pinned: the mine count is exact, the first click and its neighbours are never
 * mines, adjacency counts agree with a brute-force recount, the iterative flood
 * fill agrees with a recursive reference on many random boards (with and without
 * flags), chording follows its rules (including losing on a wrong flag), win and
 * loss are detected, big boards do not overflow the stack, and everything is
 * deterministic for a seeded rng.
 */
import { describe, it, expect } from 'vitest';
import {
  LEVELS, getLevel, mulberry32, neighbours, placeMines, adjacencyCounts, newBoard, boardFromLayout, reveal, toggleFlag, chord,
  statusOf, minesLeft, adjacentFlags, cellKind, describeCell, formatTime, formatCount, HIDDEN, OPEN, FLAG,
  type Board,
} from '../src/components/apps-private/mines/helpers';

// ── Independent references (deliberately not using the engine's own helpers) ──

/** Neighbours by scanning every cell for Chebyshev distance 1. */
const bruteNeighbours = (w: number, h: number, i: number): number[] => {
  const r = Math.floor(i / w);
  const c = i % w;
  const out: number[] = [];
  for (let j = 0; j < w * h; j++) {
    const dr = Math.abs(Math.floor(j / w) - r);
    const dc = Math.abs((j % w) - c);
    if (Math.max(dr, dc) === 1) out.push(j);
  }
  return out;
};

const bruteCounts = (w: number, h: number, mine: ArrayLike<number>): number[] =>
  Array.from({ length: w * h }, (_, i) => bruteNeighbours(w, h, i).reduce((n, j) => n + (mine[j] ? 1 : 0), 0));

/** Recursive flood fill: the textbook version, fine at these sizes. */
const refFlood = (w: number, h: number, mine: ArrayLike<number>, flagged: Set<number>, start: number): Set<number> => {
  const counts = bruteCounts(w, h, mine);
  const out = new Set<number>();
  const go = (i: number): void => {
    if (out.has(i) || flagged.has(i)) return;
    out.add(i);
    if (counts[i] === 0) for (const n of bruteNeighbours(w, h, i)) go(n);
  };
  go(start);
  return out;
};

const minesOf = (b: Board): number[] => Array.from(b.mine).flatMap((v, i) => (v ? [i] : []));
const sum = (a: ArrayLike<number>): number => Array.from(a).reduce((s, v) => s + v, 0);
const openCells = (b: Board): number[] => Array.from(b.state).flatMap((v, i) => (v === OPEN ? [i] : []));

describe('levels', () => {
  it('has the three classic sizes', () => {
    expect(LEVELS.map((l) => [l.id, l.width, l.height, l.mines])).toEqual([
      ['beginner', 9, 9, 10],
      ['intermediate', 16, 16, 40],
      ['expert', 30, 16, 99],
    ]);
  });
  it('falls back to Beginner for an unknown id', () => {
    expect(getLevel('nonsense').id).toBe('beginner');
    expect(getLevel('expert').width).toBe(30);
  });
  it('every level leaves room for the first-click safe zone', () => {
    for (const l of LEVELS) expect(l.width * l.height - 9).toBeGreaterThanOrEqual(l.mines);
  });
});

describe('neighbours', () => {
  it('has 3 in a corner, 5 on an edge and 8 inside', () => {
    expect(neighbours(9, 9, 0)).toHaveLength(3);
    expect(neighbours(9, 9, 80)).toHaveLength(3);
    expect(neighbours(9, 9, 4)).toHaveLength(5);
    expect(neighbours(9, 9, 40)).toHaveLength(8);
  });
  it('agrees with a scan of the whole board, on a non-square board too', () => {
    for (const [w, h] of [[9, 9], [30, 16], [5, 1], [1, 5], [1, 1], [2, 2]]) {
      for (let i = 0; i < w * h; i++) expect(neighbours(w, h, i).sort((a, b) => a - b), `${w}x${h} @${i}`).toEqual(bruteNeighbours(w, h, i));
    }
  });
  it('does not wrap around the edges', () => {
    expect(neighbours(9, 9, 9)).not.toContain(8); // row 2 col 1 is not next to row 1 col 9
    expect(neighbours(9, 9, 8)).not.toContain(9);
  });
});

describe('placeMines', () => {
  it('places exactly the requested number of distinct mines at every level', () => {
    for (const l of LEVELS) {
      for (const seed of [1, 2, 3]) {
        const m = placeMines(l.width, l.height, l.mines, Math.floor((l.width * l.height) / 2), mulberry32(seed));
        expect(m).toHaveLength(l.width * l.height);
        expect(sum(m), `${l.id} ${seed}`).toBe(l.mines);
        expect(Array.from(m).every((v) => v === 0 || v === 1)).toBe(true);
      }
    }
  });
  it('never puts a mine on the safe cell or any cell touching it, wherever the click lands', () => {
    for (const l of LEVELS) {
      const total = l.width * l.height;
      const cells = l.id === 'expert' ? Array.from({ length: 40 }, (_, k) => (k * 37) % total).concat([0, l.width - 1, total - l.width, total - 1]) : Array.from({ length: total }, (_, i) => i);
      for (const safe of cells) {
        const m = placeMines(l.width, l.height, l.mines, safe, mulberry32(safe + 11));
        expect(m[safe], `${l.id} safe ${safe}`).toBe(0);
        for (const n of neighbours(l.width, l.height, safe)) expect(m[n], `${l.id} safe ${safe} nbr ${n}`).toBe(0);
        expect(sum(m)).toBe(l.mines);
      }
    }
  });
  it('is deterministic for a seed and differs across seeds', () => {
    const a = placeMines(16, 16, 40, 100, mulberry32(5));
    const b = placeMines(16, 16, 40, 100, mulberry32(5));
    const c = placeMines(16, 16, 40, 100, mulberry32(6));
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });
  it('can put a mine on every cell outside the safe zone (no cell is unreachable)', () => {
    const seen = new Uint8Array(81);
    for (let seed = 1; seed <= 400; seed++) {
      const m = placeMines(9, 9, 10, 40, mulberry32(seed));
      for (let i = 0; i < 81; i++) if (m[i]) seen[i] = 1;
    }
    const zone = new Set([40, ...neighbours(9, 9, 40)]);
    for (let i = 0; i < 81; i++) expect(!!seen[i], `cell ${i}`).toBe(!zone.has(i));
  });
  it('works with rngs at the extremes of [0, 1)', () => {
    const lo = placeMines(9, 9, 10, 0, () => 0);
    const hi = placeMines(9, 9, 10, 0, () => 0.9999999999);
    expect(sum(lo)).toBe(10);
    expect(sum(hi)).toBe(10);
    expect(lo[0] + hi[0]).toBe(0);
  });
  it('clamps an impossible mine count to cells - 1 and keeps the clicked cell safe', () => {
    const m = placeMines(2, 2, 99, 0, mulberry32(1));
    expect(sum(m)).toBe(3);
    expect(m[0]).toBe(0);
    expect(sum(placeMines(3, 3, -4, 0, mulberry32(1)))).toBe(0);
    expect(sum(placeMines(3, 3, NaN, 0, mulberry32(1)))).toBe(0);
  });
  it('protects only the clicked cell when the board is too small to keep its neighbours clear', () => {
    const m = placeMines(3, 3, 8, 4, mulberry32(2));
    expect(sum(m)).toBe(8);
    expect(m[4]).toBe(0);
    const m2 = placeMines(3, 3, 5, 4, mulberry32(2));
    expect(sum(m2)).toBe(5);
    expect(m2[4]).toBe(0);
  });
  it('still places mines if the safe cell is out of range', () => {
    expect(sum(placeMines(9, 9, 10, -1, mulberry32(1)))).toBe(10);
    expect(sum(placeMines(9, 9, 10, 999, mulberry32(1)))).toBe(10);
  });
});

describe('adjacency counts', () => {
  it('match a brute-force recount on random boards of several shapes', () => {
    const rng = mulberry32(42);
    for (const [w, h] of [[9, 9], [16, 16], [30, 16], [7, 3], [1, 8]]) {
      for (let rep = 0; rep < 6; rep++) {
        const density = 0.05 + rng() * 0.5;
        const mine = Uint8Array.from({ length: w * h }, () => (rng() < density ? 1 : 0));
        expect(Array.from(adjacencyCounts(w, h, mine)), `${w}x${h}`).toEqual(bruteCounts(w, h, mine));
      }
    }
  });
  it('gives a hand-checked small case', () => {
    // 3x3 with mines in two opposite corners.
    const c = adjacencyCounts(3, 3, Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 1]));
    expect(Array.from(c)).toEqual([0, 1, 0, 1, 2, 1, 0, 1, 0]);
  });
  it('a placed board always has counts that agree with its mines', () => {
    for (const l of LEVELS) {
      const b = newBoard(l.width, l.height, l.mines);
      reveal(b, 0, mulberry32(9));
      expect(Array.from(b.counts)).toEqual(bruteCounts(l.width, l.height, b.mine));
    }
  });
});

describe('first reveal', () => {
  it('is never a mine, has no mined neighbour, and opens a region (every cell, every level size)', () => {
    for (const l of LEVELS) {
      const total = l.width * l.height;
      const step = l.id === 'expert' ? 7 : 1;
      for (let i = 0; i < total; i += step) {
        const b = newBoard(l.width, l.height, l.mines);
        const changed = reveal(b, i, mulberry32(i * 31 + 7));
        expect(b.mine[i], `${l.id} ${i}`).toBe(0);
        expect(b.counts[i]).toBe(0);
        expect(sum(b.mine)).toBe(l.mines);
        expect(changed.length).toBeGreaterThanOrEqual(1 + neighbours(l.width, l.height, i).length);
        for (const n of neighbours(l.width, l.height, i)) expect(b.state[n]).toBe(OPEN);
        expect(statusOf(b)).toBe('playing');
      }
    }
  });
  it('places nothing until the first reveal', () => {
    const b = newBoard(9, 9, 10);
    expect(b.placed).toBe(false);
    expect(sum(b.mine)).toBe(0);
    expect(statusOf(b)).toBe('ready');
    toggleFlag(b, 3);
    expect(b.placed).toBe(false);
    reveal(b, 40, mulberry32(1));
    expect(b.placed).toBe(true);
  });
  it('ignores a first click on a flagged cell, and out-of-range cells', () => {
    const b = newBoard(9, 9, 10);
    toggleFlag(b, 40);
    expect(reveal(b, 40, mulberry32(1))).toEqual([]);
    expect(b.placed).toBe(false);
    expect(reveal(b, -1, mulberry32(1))).toEqual([]);
    expect(reveal(b, 81, mulberry32(1))).toEqual([]);
    expect(reveal(b, 1.5, mulberry32(1))).toEqual([]);
    expect(statusOf(b)).toBe('ready');
  });
  it('clamps the mine count of a board that cannot hold it', () => {
    const b = newBoard(3, 3, 50);
    expect(b.mineCount).toBe(8);
    expect(b.safeTotal).toBe(1);
  });
});

describe('flood fill', () => {
  it('matches a recursive reference on many random boards', () => {
    const rng = mulberry32(2026);
    let checked = 0;
    for (let rep = 0; rep < 120; rep++) {
      const w = 3 + Math.floor(rng() * 28);
      const h = 3 + Math.floor(rng() * 14);
      const density = 0.02 + rng() * 0.3;
      const mineCells: number[] = [];
      for (let i = 0; i < w * h; i++) if (rng() < density) mineCells.push(i);
      const b = boardFromLayout(w, h, mineCells);
      const safe = Array.from({ length: w * h }, (_, i) => i).filter((i) => !b.mine[i]);
      if (!safe.length) continue;
      const start = safe[Math.floor(rng() * safe.length)];
      const expected = refFlood(w, h, b.mine, new Set(), start);
      const changed = reveal(b, start, rng);
      expect(new Set(changed).size, 'changed has no duplicates').toBe(changed.length);
      const won = statusOf(b) === 'won';
      // On a win the engine also reports the auto-flagged mines; compare only the opened cells.
      const opened = new Set(changed.filter((i) => b.state[i] === OPEN));
      expect([...opened].sort((a, c) => a - c), `${w}x${h} d=${density.toFixed(2)} @${start}`).toEqual([...expected].sort((a, c) => a - c));
      expect(openCells(b).sort((a, c) => a - c)).toEqual([...expected].sort((a, c) => a - c));
      expect(b.opened).toBe(expected.size);
      expect(won).toBe(expected.size === b.safeTotal);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('matches the reference when random flags are in the way', () => {
    const rng = mulberry32(77);
    for (let rep = 0; rep < 80; rep++) {
      const w = 5 + Math.floor(rng() * 20);
      const h = 5 + Math.floor(rng() * 12);
      const mineCells: number[] = [];
      for (let i = 0; i < w * h; i++) if (rng() < 0.08) mineCells.push(i);
      const b = boardFromLayout(w, h, mineCells);
      const safe = Array.from({ length: w * h }, (_, i) => i).filter((i) => !b.mine[i]);
      const start = safe[Math.floor(rng() * safe.length)];
      const flagged = new Set<number>();
      for (let i = 0; i < w * h; i++) if (i !== start && rng() < 0.15) { toggleFlag(b, i); flagged.add(i); }
      const expected = refFlood(w, h, b.mine, flagged, start);
      reveal(b, start, rng);
      expect(openCells(b).sort((a, c) => a - c), `${w}x${h} @${start}`).toEqual([...expected].sort((a, c) => a - c));
      for (const f of flagged) if (statusOf(b) !== 'won') expect(b.state[f]).toBe(FLAG); // flags survive the flood
    }
  });
  it('reports exactly the cells that changed', () => {
    const b = boardFromLayout(9, 9, [0, 10, 20, 30, 40, 50, 60, 70, 80, 5]);
    const before = Array.from(b.state);
    const changed = reveal(b, 8, mulberry32(1));
    const diff = Array.from(b.state).flatMap((v, i) => (v !== before[i] ? [i] : []));
    expect(changed.slice().sort((a, c) => a - c)).toEqual(diff);
  });
  it('opens a number without spreading', () => {
    const b = boardFromLayout(5, 1, [1]);
    expect(reveal(b, 0, mulberry32(1))).toEqual([0]);
    expect(b.counts[0]).toBe(1);
  });
  it('does not overflow the stack on a 160 000 cell empty board', () => {
    const b = newBoard(400, 400, 0);
    const changed = reveal(b, 0, mulberry32(1));
    expect(changed).toHaveLength(160000);
    expect(b.opened).toBe(160000);
    expect(statusOf(b)).toBe('won');
  });
  it('does not overflow the stack on a wide empty board with a single mine in the corner', () => {
    const b = boardFromLayout(300, 300, [89999]);
    reveal(b, 0, mulberry32(1));
    expect(b.opened).toBe(89999);
    expect(statusOf(b)).toBe('won');
  });
  it('opens the whole expert board when it has no mines', () => {
    const b = newBoard(30, 16, 0);
    reveal(b, 100, mulberry32(1));
    expect(b.opened).toBe(480);
    expect(statusOf(b)).toBe('won');
  });
});

describe('flags', () => {
  it('toggles on and off and keeps the count and the mines-left counter', () => {
    const b = newBoard(9, 9, 10);
    expect(minesLeft(b)).toBe(10);
    expect(toggleFlag(b, 3)).toEqual([3]);
    expect(b.state[3]).toBe(FLAG);
    expect(b.flags).toBe(1);
    expect(minesLeft(b)).toBe(9);
    expect(toggleFlag(b, 3)).toEqual([3]);
    expect(b.state[3]).toBe(HIDDEN);
    expect(minesLeft(b)).toBe(10);
  });
  it('lets the counter go negative when over-flagged', () => {
    const b = newBoard(3, 3, 1);
    toggleFlag(b, 0); toggleFlag(b, 1); toggleFlag(b, 2);
    expect(minesLeft(b)).toBe(-2);
    expect(formatCount(minesLeft(b))).toBe('-02');
  });
  it('cannot flag an open cell, and cannot change flags once the game is over', () => {
    const b = boardFromLayout(5, 1, [1]);
    reveal(b, 0, mulberry32(1));
    expect(toggleFlag(b, 0)).toEqual([]);
    expect(b.flags).toBe(0);
    reveal(b, 1, mulberry32(1)); // lose
    expect(statusOf(b)).toBe('lost');
    expect(toggleFlag(b, 4)).toEqual([]);
  });
  it('a flagged cell is not opened by a reveal', () => {
    const b = boardFromLayout(5, 1, [4]);
    toggleFlag(b, 2);
    expect(reveal(b, 2, mulberry32(1))).toEqual([]);
    expect(b.state[2]).toBe(FLAG);
  });
  it('rejects out-of-range cells', () => {
    const b = newBoard(9, 9, 10);
    expect(toggleFlag(b, -1)).toEqual([]);
    expect(toggleFlag(b, 81)).toEqual([]);
    expect(b.flags).toBe(0);
  });
});

describe('chording', () => {
  // 3x3, mines at the two opposite corners 0 and 8. Counts: [M,1,0 / 1,2,1 / 0,1,M].
  const setup = (): Board => {
    const b = boardFromLayout(3, 3, [0, 8]);
    reveal(b, 4, mulberry32(1)); // opens only the centre "2"
    return b;
  };
  it('does nothing when the flag count is too low, too high, or wrong in number', () => {
    const b = setup();
    expect(b.counts[4]).toBe(2);
    expect(chord(b, 4)).toEqual([]);
    toggleFlag(b, 0);
    expect(adjacentFlags(b, 4)).toBe(1);
    expect(chord(b, 4)).toEqual([]);
    toggleFlag(b, 1); toggleFlag(b, 8); // now 3 flags around a "2"
    expect(chord(b, 4)).toEqual([]);
    expect(b.opened).toBe(1);
    expect(statusOf(b)).toBe('playing');
  });
  it('opens all unflagged neighbours when the flags match, and can finish the game', () => {
    const b = setup();
    toggleFlag(b, 0); toggleFlag(b, 8);
    const changed = chord(b, 4);
    expect(changed.slice().sort((a, c) => a - c)).toEqual([1, 2, 3, 5, 6, 7]);
    expect(statusOf(b)).toBe('won');
    expect(b.opened).toBe(7);
  });
  it('loses when a flag is in the wrong place, opening the safe neighbours and the exploded mine', () => {
    const b = setup();
    toggleFlag(b, 0); toggleFlag(b, 1); // 1 is safe, 8 is a mine
    const changed = chord(b, 4);
    expect(statusOf(b)).toBe('lost');
    expect(b.exploded).toBe(8);
    expect(changed).toContain(8); // the mine that went off
    expect(changed).toContain(1); // the wrong flag is reported so it can be marked
    expect(cellKind(b, 8)).toBe('boom');
    expect(cellKind(b, 1)).toBe('wrong');
    expect(cellKind(b, 0)).toBe('flag');
    expect(new Set(changed).size).toBe(changed.length);
  });
  it('does nothing on hidden, flagged, zero-count or out-of-range cells', () => {
    const b = setup();
    expect(chord(b, 1)).toEqual([]); // hidden
    toggleFlag(b, 1);
    expect(chord(b, 1)).toEqual([]); // flagged
    expect(chord(b, 99)).toEqual([]);
    const z = boardFromLayout(4, 1, [3]);
    reveal(z, 0, mulberry32(1)); // counts are [0, 0, 1, mine]; the zero at the left end has nothing to chord
    expect(chord(z, 0)).toEqual([]);
  });
  it('does nothing before the game starts or after it ends', () => {
    const fresh = newBoard(9, 9, 10);
    expect(chord(fresh, 0)).toEqual([]);
    const b = setup();
    toggleFlag(b, 0); toggleFlag(b, 8);
    chord(b, 4);
    expect(chord(b, 4)).toEqual([]);
  });
  it('cascades through a zero opened by the chord', () => {
    // 1x7 strip with a mine at 0: counts [M,1,0,0,0,0,0]. Open 1, flag 0, chord 1 opens 2 and floods the rest.
    const b = boardFromLayout(7, 1, [0]);
    reveal(b, 1, mulberry32(1));
    toggleFlag(b, 0);
    chord(b, 1);
    expect(b.opened).toBe(6);
    expect(statusOf(b)).toBe('won');
  });
});

describe('win and loss', () => {
  it('wins when every safe cell is open, then flags the remaining mines', () => {
    const b = newBoard(9, 9, 10);
    reveal(b, 40, mulberry32(3));
    for (let i = 0; i < b.total; i++) if (!b.mine[i] && b.state[i] === HIDDEN) reveal(b, i, mulberry32(3));
    expect(statusOf(b)).toBe('won');
    expect(b.opened).toBe(b.safeTotal);
    expect(b.flags).toBe(10);
    expect(minesLeft(b)).toBe(0);
    for (const m of minesOf(b)) { expect(b.state[m]).toBe(FLAG); expect(cellKind(b, m)).toBe('flag'); }
  });
  it('reports the auto-flagged mines as changed cells on the winning move', () => {
    const b = boardFromLayout(5, 1, [1]);
    reveal(b, 4, mulberry32(1)); // opens 4, 3 (3 is a zero, 2 is a 1)
    const changed = reveal(b, 0, mulberry32(1));
    expect(statusOf(b)).toBe('won');
    expect(changed).toEqual([0, 1]); // the opened cell, then the mine now flagged
  });
  it('does not win while a safe cell is still hidden', () => {
    const b = boardFromLayout(5, 1, [1]);
    reveal(b, 4, mulberry32(1));
    expect(statusOf(b)).toBe('playing');
  });
  it('loses on a mine, shows every unflagged mine, marks wrong flags and leaves right flags alone', () => {
    const b = boardFromLayout(5, 2, [0, 4, 7]);
    toggleFlag(b, 4); // right
    toggleFlag(b, 2); // wrong
    const changed = reveal(b, 0, mulberry32(1));
    expect(statusOf(b)).toBe('lost');
    expect(b.exploded).toBe(0);
    expect(cellKind(b, 0)).toBe('boom');
    expect(cellKind(b, 7)).toBe('mine');
    expect(cellKind(b, 4)).toBe('flag');
    expect(cellKind(b, 2)).toBe('wrong');
    expect(cellKind(b, 1)).toBe('hidden');
    expect(changed.slice().sort((a, c) => a - c)).toEqual([0, 2, 7]);
  });
  it('ignores reveals and chords after the game ends', () => {
    const lost = boardFromLayout(5, 1, [1]);
    reveal(lost, 1, mulberry32(1));
    expect(reveal(lost, 3, mulberry32(1))).toEqual([]);
    const won = boardFromLayout(3, 1, [1]);
    reveal(won, 0, mulberry32(1));
    reveal(won, 2, mulberry32(1));
    expect(statusOf(won)).toBe('won');
    expect(reveal(won, 1, mulberry32(1))).toEqual([]);
  });
  it('does not reopen an open cell', () => {
    const b = boardFromLayout(5, 1, [1]);
    reveal(b, 0, mulberry32(1));
    expect(reveal(b, 0, mulberry32(1))).toEqual([]);
    expect(b.opened).toBe(1);
  });
  it('a full game on the expert board can be played to a win', () => {
    const b = newBoard(30, 16, 99);
    const rng = mulberry32(123);
    reveal(b, 0, rng);
    for (let i = 0; i < b.total; i++) if (!b.mine[i]) reveal(b, i, rng);
    expect(statusOf(b)).toBe('won');
    expect(b.flags).toBe(99);
    expect(b.opened).toBe(480 - 99);
  });
});

describe('determinism', () => {
  it('the same seed and the same clicks give the same game', () => {
    const play = (seed: number): { mines: number[]; state: number[]; status: string } => {
      const rng = mulberry32(seed);
      const b = newBoard(16, 16, 40);
      reveal(b, 120, rng);
      for (const i of [3, 77, 200, 255]) { toggleFlag(b, i); reveal(b, i + 1, rng); }
      return { mines: minesOf(b), state: Array.from(b.state), status: statusOf(b) };
    };
    expect(play(9)).toEqual(play(9));
    expect(play(9).mines).not.toEqual(play(10).mines);
  });
});

describe('cell descriptions', () => {
  it('names hidden, flagged, empty and numbered cells the way a screen reader should hear them', () => {
    const b = boardFromLayout(5, 1, [1]);
    expect(describeCell(b, 0)).toBe('Row 1, column 1, hidden');
    toggleFlag(b, 1);
    expect(describeCell(b, 1)).toBe('Row 1, column 2, flagged');
    reveal(b, 0, mulberry32(1));
    expect(describeCell(b, 0)).toBe('Row 1, column 1, 1 adjacent mine');
    reveal(b, 4, mulberry32(1));
    expect(describeCell(b, 4)).toBe('Row 1, column 5, empty');
    expect(describeCell(b, 2)).toBe('Row 1, column 3, 1 adjacent mine');
  });
  it('uses the plural for two or more and names the end-of-game states', () => {
    const b = boardFromLayout(3, 3, [0, 8]);
    reveal(b, 4, mulberry32(1));
    expect(describeCell(b, 4)).toBe('Row 2, column 2, 2 adjacent mines');
    toggleFlag(b, 1);
    reveal(b, 0, mulberry32(1));
    expect(describeCell(b, 0)).toBe('Row 1, column 1, mine, exploded');
    expect(describeCell(b, 8)).toBe('Row 3, column 3, mine');
    expect(describeCell(b, 1)).toBe('Row 1, column 2, flagged, not a mine');
  });
  it('reads the column from the board width on a wide board', () => {
    const b = newBoard(30, 16, 99);
    expect(describeCell(b, 29)).toBe('Row 1, column 30, hidden');
    expect(describeCell(b, 30)).toBe('Row 2, column 1, hidden');
    expect(describeCell(b, 479)).toBe('Row 16, column 30, hidden');
  });
});

describe('formatting', () => {
  it('formats times and survives bad input', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
  it('formats the mines counter without NaN or undefined', () => {
    expect(formatCount(10)).toBe('010');
    expect(formatCount(0)).toBe('000');
    expect(formatCount(99)).toBe('099');
    expect(formatCount(-1)).toBe('-01');
    expect(formatCount(NaN)).toBe('000');
    expect(formatCount(Infinity)).toBe('000');
  });
});
