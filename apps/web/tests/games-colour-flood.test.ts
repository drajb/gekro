/**
 * games-colour-flood.test.ts - the engine behind `colour-flood`.
 *
 * Pinned: the flood equals a second, differently written fill; picking the area's own
 * colour changes nothing; the area only ever grows; the greedy plan floods every board
 * in at most n*n - 1 moves and is never shorter than the true minimum (found by
 * exhaustive search on 3x3 and 4x4 boards); the move limit per level is the plan plus a
 * stated allowance and is therefore always beatable; boards are deterministic per seed,
 * never start flooded; storage is sanitised; messages have the right plurals.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, LEVELS, COLOURS, COLOUR_NAMES, COLOUR_SHAPES, MAX_SIZE, MAX_BEST_MOVES,
  mulberry32, makeGrid, regionOf, regionSize, flood, isFlooded, colourCounts, greedyPlan, extraMoves, moveLimit, hintColour,
  bestKey, sanitiseBest, plural, colourLabel, moveMessage,
  type Grid, type Level,
} from '../src/components/apps-private/colour-flood/helpers';

/**
 * Independent flood: no stack, no shared helper. Repeatedly sweep the whole board,
 * growing a set of "joined" squares one neighbour at a time until a full sweep adds
 * nothing, then recolour the set.
 */
const naiveFlood = (g: Grid, n: number, colour: number): Grid => {
  const old = g[0];
  const joined = new Set<number>([0]);
  let grew = true;
  while (grew) {
    grew = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        if (joined.has(i) || g[i] !== old) continue;
        const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        if (near.some(([rr, cc]) => rr >= 0 && rr < n && cc >= 0 && cc < n && joined.has(rr * n + cc))) { joined.add(i); grew = true; }
      }
    }
  }
  return g.map((v, i) => (joined.has(i) ? colour : v));
};

/** True minimum number of moves, by breadth-first search over whole boards (small boards only). */
const trueMinimum = (start: Grid, n: number): number => {
  if (start.every((v) => v === start[0])) return 0;
  let frontier = [start.join('')];
  const seen = new Set(frontier);
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next: string[] = [];
    for (const key of frontier) {
      const g = key.split('').map(Number);
      for (let c = 0; c < COLOURS; c++) {
        if (c === g[0]) continue;
        const h = naiveFlood(g, n, c);
        if (h.every((v) => v === h[0])) return depth;
        const hk = h.join('');
        if (!seen.has(hk)) { seen.add(hk); next.push(hk); }
      }
    }
    frontier = next;
  }
  throw new Error('unreachable: every board can be flooded');
};

const randomGrid = (n: number, rng: () => number): Grid => Array.from({ length: n * n }, () => Math.floor(rng() * COLOURS));

describe('constants the page relies on', () => {
  it('has six colours with unique names and unique shapes, and the sizes the page offers', () => {
    expect(COLOURS).toBe(6);
    expect(COLOUR_NAMES).toHaveLength(6);
    expect(new Set(COLOUR_NAMES).size).toBe(6);
    expect(COLOUR_SHAPES).toHaveLength(6);
    expect(new Set(COLOUR_SHAPES).size).toBe(6);
    expect([...SIZES]).toEqual([8, 12, 16]);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    expect(MAX_SIZE).toBe(16);
  });
});

describe('flood fill', () => {
  it('matches the independent fill on thousands of random boards of every size', () => {
    const rng = mulberry32(2026);
    let checked = 0;
    for (const n of [2, 3, 4, 5, 8, 12, 16]) {
      for (let t = 0; t < 60; t++) {
        const g = randomGrid(n, rng);
        for (let c = 0; c < COLOURS; c++) {
          const a = flood(g, n, c);
          if (c === g[0]) expect(a).toEqual(g);
          else expect(a).toEqual(naiveFlood(g, n, c));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });
  it('picking the area colour is a no-op and returns a copy', () => {
    const g = [0, 0, 1, 1];
    const out = flood(g, 2, 0);
    expect(out).toEqual(g);
    expect(out).not.toBe(g);
  });
  it('recolours exactly the area and absorbs matching neighbours', () => {
    //   0 0 1        2 2 1   (pick 2: the 0s turn 2, the 2 below joins)
    //   1 0 2   ->   1 2 2
    //   1 1 2        1 1 2
    const g = [0, 0, 1, 1, 0, 2, 1, 1, 2];
    const out = flood(g, 3, 2);
    expect(out).toEqual([2, 2, 1, 1, 2, 2, 1, 1, 2]);
    expect(regionOf(out, 3)).toEqual([0, 1, 4, 5, 8]);
  });
  it('does not wrap around the edges and does not join diagonals', () => {
    // Corner colour 0 sits at (0,0); the 0 at (1,1) touches it only diagonally, the 0 at (0,3) only across the edge.
    const g = [0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(regionOf(g, 4)).toEqual([0]);
    const g2 = [0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(regionOf(g2, 4)).toEqual([0]); // the 0 at index 3 is the far end of row 0, not joined
  });
  it('never modifies its input and keeps squares outside the area untouched', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 200; t++) {
      const n = 3 + (t % 6);
      const g = randomGrid(n, rng);
      const copy = g.slice();
      const area = new Set(regionOf(g, n));
      const c = Math.floor(rng() * COLOURS);
      const out = flood(g, n, c);
      expect(g).toEqual(copy);
      out.forEach((v, i) => { if (!area.has(i)) expect(v).toBe(g[i]); else expect(v).toBe(c); });
    }
  });
  it('the area never shrinks and always includes the corner', () => {
    const rng = mulberry32(77);
    for (let t = 0; t < 200; t++) {
      const n = 4 + (t % 9);
      let g = randomGrid(n, rng);
      for (let step = 0; step < 30; step++) {
        const before = regionSize(g, n);
        g = flood(g, n, Math.floor(rng() * COLOURS));
        const after = regionSize(g, n);
        expect(after).toBeGreaterThanOrEqual(before);
        expect(regionOf(g, n)).toContain(0);
      }
    }
  });
  it('rejects a bad colour, size or length', () => {
    const g = [0, 1, 1, 0];
    expect(() => flood(g, 2, -1)).toThrow(RangeError);
    expect(() => flood(g, 2, COLOURS)).toThrow(RangeError);
    expect(() => flood(g, 2, 1.5)).toThrow(RangeError);
    expect(() => flood(g, 2, NaN)).toThrow(RangeError);
    expect(() => flood(g, 3, 1)).toThrow(RangeError);
    expect(() => flood([0], 1, 1)).toThrow(RangeError);
    expect(() => flood([], 0, 1)).toThrow(RangeError);
    expect(() => regionOf(new Array(17 * 17).fill(0), 17)).toThrow(RangeError);
  });
  it('isFlooded and colourCounts read the board', () => {
    expect(isFlooded([2, 2, 2, 2])).toBe(true);
    expect(isFlooded([2, 2, 2, 3])).toBe(false);
    expect(isFlooded([])).toBe(false);
    expect(colourCounts([0, 0, 1, 5, 5, 5])).toEqual([2, 1, 0, 0, 0, 3]);
    expect(colourCounts([0, 7, -1, 2.5, NaN] as number[])).toEqual([1, 0, 0, 0, 0, 0]);
  });
});

describe('board generation', () => {
  it('is deterministic per seed and differs across seeds', () => {
    for (const n of SIZES) {
      expect(makeGrid(n, mulberry32(42))).toEqual(makeGrid(n, mulberry32(42)));
      expect(makeGrid(n, mulberry32(1))).not.toEqual(makeGrid(n, mulberry32(2)));
    }
  });
  it('makes the right length, only valid colours, and never a flooded board', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 100; seed++) {
        const g = makeGrid(n, mulberry32(seed));
        expect(g).toHaveLength(n * n);
        expect(g.every((v) => Number.isInteger(v) && v >= 0 && v < COLOURS)).toBe(true);
        expect(isFlooded(g)).toBe(false);
      }
    }
  });
  it('even a degenerate rng gives a board that is not flooded', () => {
    expect(isFlooded(makeGrid(8, () => 0))).toBe(false);
    expect(isFlooded(makeGrid(8, () => 0.999999))).toBe(false);
    expect(makeGrid(8, () => 0.999999).every((v) => v < COLOURS)).toBe(true);
  });
  it('uses all six colours on a typical board of every size', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 20; seed++) expect(colourCounts(makeGrid(n, mulberry32(seed))).every((k) => k > 0)).toBe(true);
    }
  });
});

describe('greedy plan', () => {
  it('floods every board of every size, each step strictly grows the area, within n*n - 1 steps', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 40; seed++) {
        let g = makeGrid(n, mulberry32(seed));
        const plan = greedyPlan(g, n);
        expect(plan.length).toBeGreaterThan(0);
        expect(plan.length).toBeLessThanOrEqual(n * n - 1);
        for (const c of plan) {
          expect(c).not.toBe(g[0]);
          const before = regionSize(g, n);
          g = flood(g, n, c);
          expect(regionSize(g, n)).toBeGreaterThan(before);
        }
        expect(isFlooded(g)).toBe(true);
      }
    }
  });
  it('is deterministic and does not modify the board', () => {
    const g = makeGrid(12, mulberry32(9));
    const copy = g.slice();
    expect(greedyPlan(g, 12)).toEqual(greedyPlan(g, 12));
    expect(g).toEqual(copy);
  });
  it('is empty for a flooded board and short on a trivial one', () => {
    expect(greedyPlan([3, 3, 3, 3], 2)).toEqual([]);
    expect(greedyPlan([0, 1, 1, 1], 2)).toEqual([1]);
    expect(greedyPlan([0, 1, 2, 1], 2).length).toBe(2);
  });
  it('typical plan lengths per size, as quoted on the page (seeds 1 to 200)', () => {
    const stats: Record<number, { min: number; max: number; mean: number }> = {};
    for (const n of SIZES) {
      let min = Infinity;
      let max = 0;
      let sum = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const k = greedyPlan(makeGrid(n, mulberry32(seed)), n).length;
        min = Math.min(min, k); max = Math.max(max, k); sum += k;
      }
      stats[n] = { min, max, mean: sum / 200 };
    }
    // The figures quoted on the guide page.
    expect([stats[8].min, stats[8].max, stats[8].mean.toFixed(1)]).toEqual([12, 20, '15.5']);
    expect([stats[12].min, stats[12].max, stats[12].mean.toFixed(1)]).toEqual([16, 31, '22.7']);
    expect([stats[16].min, stats[16].max, stats[16].mean.toFixed(1)]).toEqual([24, 40, '30.0']);
  }, 60_000);
});

describe('against exhaustive search on small boards', () => {
  it('the greedy plan is never shorter than the true minimum, and the minimum is at least colours present minus one', () => {
    const rng = mulberry32(404);
    let gaps = 0;
    for (let t = 0; t < 120; t++) {
      const n = t % 2 ? 3 : 4;
      const g = randomGrid(n, rng);
      if (isFlooded(g)) continue;
      const min = trueMinimum(g, n);
      const plan = greedyPlan(g, n).length;
      const present = colourCounts(g).filter((k) => k > 0).length;
      expect(plan).toBeGreaterThanOrEqual(min);
      expect(min).toBeGreaterThanOrEqual(present - 1);
      if (plan > min) gaps++;
    }
    // Greedy is a plan, not the optimum: on these seeded small boards it loses a move on some of them (48 of 120).
    expect(gaps).toBe(48);
  }, 60_000);
  it('the true minimum of hand-made boards is what you expect', () => {
    expect(trueMinimum([0, 1, 1, 1], 2)).toBe(1);
    expect(trueMinimum([0, 1, 2, 1], 2)).toBe(2);
    expect(trueMinimum([0, 1, 0, 1], 2)).toBe(1);
    // A stripe board 0 1 0 1 / 0 1 0 1 ... needs 3 moves: 1, 0, 1 (or similar) across 4 stripes.
    expect(trueMinimum([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], 4)).toBe(3);
  });
});

describe('move limits', () => {
  it('the allowance per level is the one stated on the page', () => {
    expect(extraMoves(10, 'hard')).toBe(0);
    expect(extraMoves(100, 'hard')).toBe(0);
    expect(extraMoves(10, 'medium')).toBe(2);
    expect(extraMoves(20, 'medium')).toBe(4);
    expect(extraMoves(21, 'medium')).toBe(5); // 20% rounded up
    expect(extraMoves(2, 'medium')).toBe(2); // never fewer than 2 extra
    expect(extraMoves(10, 'easy')).toBe(5);
    expect(extraMoves(20, 'easy')).toBe(10);
    expect(extraMoves(21, 'easy')).toBe(11); // 50% rounded up
    expect(extraMoves(2, 'easy')).toBe(5); // never fewer than 5 extra
  });
  it('limit is plan length plus the allowance, so hard equals the plan exactly and every limit is beatable', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 15; seed++) {
        const g = makeGrid(n, mulberry32(seed));
        const plan = greedyPlan(g, n);
        const lim: Record<Level, number> = { easy: moveLimit(g, n, 'easy'), medium: moveLimit(g, n, 'medium'), hard: moveLimit(g, n, 'hard') };
        expect(lim.hard).toBe(plan.length);
        expect(lim.medium).toBe(plan.length + extraMoves(plan.length, 'medium'));
        expect(lim.easy).toBe(plan.length + extraMoves(plan.length, 'easy'));
        expect(lim.easy).toBeGreaterThan(lim.medium);
        expect(lim.medium).toBeGreaterThan(lim.hard);
        // Playing the plan really finishes inside the limit.
        let h = g;
        for (const c of plan) h = flood(h, n, c);
        expect(isFlooded(h)).toBe(true);
        expect(plan.length).toBeLessThanOrEqual(lim.hard);
      }
    }
  });
});

describe('hint', () => {
  it('is the first colour of the plan, a different colour from the area, and null once flooded', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = makeGrid(8, mulberry32(seed));
      const h = hintColour(g, 8);
      expect(h).toBe(greedyPlan(g, 8)[0]);
      expect(h).not.toBe(g[0]);
    }
    expect(hintColour([4, 4, 4, 4], 2)).toBeNull();
  });
  it('following the hint repeatedly floods the board', () => {
    // Following the hint every time plays out the computer's plan exactly, so it always fits the Hard limit.
    for (const seed of [3, 4, 5]) {
      let g = makeGrid(12, mulberry32(seed));
      const plan = greedyPlan(g, 12);
      let used = 0;
      for (let h = hintColour(g, 12); h !== null && used < 300; h = hintColour(g, 12)) { g = flood(g, 12, h); used++; }
      expect(isFlooded(g)).toBe(true);
      expect(used).toBe(plan.length);
      expect(used).toBeLessThanOrEqual(moveLimit(makeGrid(12, mulberry32(seed)), 12, 'hard'));
    }
  });
});

describe('fuzz', () => {
  it('random legal play on random boards never throws and keeps its invariants', () => {
    const rng = mulberry32(31337);
    for (let t = 0; t < 3000; t++) {
      const n = 2 + Math.floor(rng() * 15);
      let g = randomGrid(n, rng);
      let size = regionSize(g, n);
      const steps = 1 + Math.floor(rng() * 40);
      for (let s = 0; s < steps; s++) {
        const c = Math.floor(rng() * COLOURS);
        const out = flood(g, n, c);
        expect(out).toHaveLength(n * n);
        expect(out[0]).toBe(c);
        const now = regionSize(out, n);
        expect(now).toBeGreaterThanOrEqual(size);
        size = now;
        g = out;
        if (isFlooded(g)) break;
      }
    }
  }, 60_000);
});

describe('saved best move counts', () => {
  it('keys are size and level', () => {
    expect(bestKey(12, 'medium')).toBe('12-medium');
  });
  it('keeps whole positive move counts for known sizes and levels and drops everything else', () => {
    expect(sanitiseBest({ '8-easy': 9, '12-medium': 21, '16-hard': 40 })).toEqual({ '8-easy': 9, '12-medium': 21, '16-hard': 40 });
    expect(sanitiseBest({ '8-easy': 9, '9-easy': 3, '8-wild': 3, x: 1 })).toEqual({ '8-easy': 9 });
    expect(sanitiseBest({ '8-easy': 0, '12-easy': -3, '16-easy': 1.5, '8-hard': NaN, '12-hard': Infinity })).toEqual({});
  });
  it('rejects numeric strings, booleans, arrays, null and objects', () => {
    expect(sanitiseBest({ '8-easy': '12', '12-easy': true, '16-easy': [12], '8-hard': null, '12-hard': { a: 1 } })).toEqual({});
  });
  it('caps the count at a sane limit', () => {
    expect(sanitiseBest({ '8-easy': MAX_BEST_MOVES })).toEqual({ '8-easy': MAX_BEST_MOVES });
    expect(sanitiseBest({ '8-easy': MAX_BEST_MOVES + 1, '12-easy': 1e300 })).toEqual({});
  });
  it('survives storage that is not an object and never copies unknown or prototype keys', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"8-easy": 5}, "constructor": 3, "8-easy": 4}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({ '8-easy': 4 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['8-easy']).toBeUndefined();
  });
});

describe('text', () => {
  it('plural handles one and many', () => {
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
    expect(plural(2, 'square')).toBe('2 squares');
  });
  it('colourLabel pairs the name with its shape and survives a bad index', () => {
    expect(colourLabel(0)).toBe('Sky (circle)');
    expect(colourLabel(5)).toBe('Orange (plus)');
    expect(colourLabel(9)).toBe('Colour (shape)');
  });
  it('move messages say what happened with correct singular and plural', () => {
    expect(moveMessage(2, 10, 14, 64, 7)).toBe('Amber (triangle). Your area grew by 4 squares to 14 of 64. 7 moves left.');
    expect(moveMessage(1, 10, 11, 64, 1)).toBe('Green (square). Your area grew by 1 square to 11 of 64. 1 move left.');
    expect(moveMessage(3, 10, 10, 64, 4)).toBe('Rose (diamond). No new squares joined. Your area stays at 10 of 64. 4 moves left.');
    expect(moveMessage(4, 10, 20, 64, 0)).toBe('Violet (hexagon). Your area grew by 10 squares to 20 of 64. No moves left.');
  });
});
