/**
 * games-sorting-race.test.ts - the engine behind `sorting-race`.
 *
 * Pinned: each of the six algorithms (bubble, insertion, selection, merge, quick, heap) sorts thousands of
 * random, sorted, reversed, repeated and tiny arrays exactly like Array.sort; replaying the steps it yields
 * on a fresh copy gives the sorted row; its comparison and move counters equal those of a second, separately
 * written version of the same algorithm and, where a closed form exists, the closed form (selection sort makes
 * n(n-1)/2 comparisons; bubble and insertion make as many swaps as the row has inversions); stepping a racer
 * in chunks ends exactly where running it to the end does; ranking handles ties. "Your turn": the fewest-swaps
 * figure equals a breadth-first search over every row of up to 7 bars, hints always lower it by exactly one,
 * and undo is an exact round trip. Numbers quoted on the guide page are asserted here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ALGOS, ALGO_NAME, ALGO_NOTE, sorter, applyStep, tallyStep, runAll, makeArray, makeRacer, advance, work, rankRacers, ordinal, isSorted, RACE_SIZES,
  RACE_SIZE_LABEL, sanitiseRaceSize, TURN_SIZES, TURN_SIZE_LABEL, sanitiseTurnSize, minSwaps, newTurn, swapBars, undoSwap, restartTurn, turnHint,
  markAided, BEST_KEYS, bestKey, sanitiseBest, sanitiseSeed, plural, mulberry32, pickIndex, type Algo, type Counters,
} from '../src/components/apps-private/sorting-race/helpers';
import calculatorSource from '../src/components/apps-private/sorting-race/Calculator.astro?raw';

vi.setConfig({ testTimeout: 60_000 });

// ── Independent reference versions (written separately: loops and recursion, not generators) ──────────────

interface Ref { a: number[]; cmp: number; mv: number }
const sw = (a: number[], i: number, j: number) => { const t = a[i]; a[i] = a[j]; a[j] = t; };

const refBubble = (input: readonly number[]): Ref => {
  const a = input.slice();
  let cmp = 0, mv = 0;
  let end = a.length - 1;
  let swapped = true;
  while (end > 0 && swapped) {
    swapped = false;
    for (let i = 0; i < end; i++) {
      cmp++;
      if (a[i] > a[i + 1]) { sw(a, i, i + 1); mv++; swapped = true; }
    }
    end--;
  }
  return { a, cmp, mv };
};

const refInsertion = (input: readonly number[]): Ref => {
  // Counted from the row, without running the algorithm: element i is passed by every earlier element that is bigger.
  const a = input.slice().sort((x, y) => x - y); // the sorted result
  let cmp = 0, mv = 0;
  for (let i = 1; i < input.length; i++) {
    let inv = 0;
    for (let j = 0; j < i; j++) if (input[j] > input[i]) inv++;
    cmp += inv + (inv < i ? 1 : 0);
    mv += inv;
  }
  return { a, cmp, mv };
};

const refSelection = (input: readonly number[]): Ref => {
  const a = input.slice();
  const n = a.length;
  let mv = 0;
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    for (let j = i + 1; j < n; j++) if (a[j] < a[m]) m = j;
    if (m !== i) { sw(a, i, m); mv++; }
  }
  return { a, cmp: n < 2 ? 0 : (n * (n - 1)) / 2, mv };
};

const refMerge = (input: readonly number[]): Ref => {
  let cmp = 0, mv = 0;
  const rec = (x: number[]): number[] => {
    if (x.length < 2) return x;
    const mid = x.length >> 1;
    const l = rec(x.slice(0, mid));
    const r = rec(x.slice(mid));
    const out: number[] = [];
    let i = 0, j = 0;
    while (i < l.length && j < r.length) {
      cmp++;
      if (l[i] <= r[j]) out.push(l[i++]); else out.push(r[j++]);
      mv++;
    }
    while (i < l.length) { out.push(l[i++]); mv++; }
    while (j < r.length) { out.push(r[j++]); mv++; }
    return out;
  };
  return { a: rec(input.slice()), cmp, mv };
};

const refQuick = (input: readonly number[]): Ref => {
  const a = input.slice();
  let cmp = 0, mv = 0;
  const stack: [number, number][] = [[0, a.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    if (lo >= hi) continue;
    const mid = (lo + hi) >> 1;
    if (mid !== hi) { sw(a, mid, hi); mv++; }
    const p = a[hi];
    let s = lo;
    for (let j = lo; j < hi; j++) {
      cmp++;
      if (a[j] < p) { if (s !== j) { sw(a, s, j); mv++; } s++; }
    }
    if (s !== hi) { sw(a, s, hi); mv++; }
    stack.push([s + 1, hi]);
    stack.push([lo, s - 1]);
  }
  return { a, cmp, mv };
};

const refHeap = (input: readonly number[]): Ref => {
  const a = input.slice();
  let cmp = 0, mv = 0;
  const sift = (root: number, end: number) => {
    for (;;) {
      const l = 2 * root + 1;
      if (l > end) return;
      let big = root;
      cmp++;
      if (a[big] < a[l]) big = l;
      const r = l + 1;
      if (r <= end) { cmp++; if (a[big] < a[r]) big = r; }
      if (big === root) return;
      sw(a, root, big);
      mv++;
      root = big;
    }
  };
  for (let s = Math.floor((a.length - 2) / 2); s >= 0; s--) sift(s, a.length - 1);
  for (let e = a.length - 1; e > 0; e--) { sw(a, 0, e); mv++; sift(0, e - 1); }
  return { a, cmp, mv };
};

const REF: Record<Algo, (x: readonly number[]) => Ref> = { bubble: refBubble, insertion: refInsertion, selection: refSelection, merge: refMerge, quick: refQuick, heap: refHeap };

const inversions = (a: readonly number[]): number => {
  let n = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) n++;
  return n;
};

/** A varied set of inputs: tiny, random, repeated values, sorted, reversed, all equal. */
const inputs = (seed: number, count: number): number[][] => {
  const rng = mulberry32(seed);
  const out: number[][] = [[], [1], [2, 1], [1, 2], [1, 1], [3, 1, 2], [1, 2, 3], [3, 2, 1], [2, 2, 1], [5, 5, 5, 5]];
  for (let n = 0; n <= 40; n++) {
    out.push(Array.from({ length: n }, (_, i) => i + 1));
    out.push(Array.from({ length: n }, (_, i) => n - i));
    out.push(new Array(n).fill(7));
  }
  for (let t = 0; t < count; t++) {
    const n = Math.floor(rng() * 50);
    const kind = rng();
    if (kind < 0.5) out.push(makeArray(n, rng));
    else if (kind < 0.8) out.push(Array.from({ length: n }, () => 1 + Math.floor(rng() * 6)));
    else out.push(Array.from({ length: n }, () => Math.floor(rng() * 1000) - 500));
  }
  return out;
};

describe('the six algorithms', () => {
  it('names and one-line descriptions exist, in the order bubble, insertion, selection, merge, quick, heap', () => {
    expect([...ALGOS]).toEqual(['bubble', 'insertion', 'selection', 'merge', 'quick', 'heap']);
    expect(ALGOS.map((a) => ALGO_NAME[a])).toEqual(['Bubble sort', 'Insertion sort', 'Selection sort', 'Merge sort', 'Quick sort', 'Heap sort']);
    for (const a of ALGOS) expect(ALGO_NOTE[a].length).toBeGreaterThan(20);
  });

  for (const algo of ALGOS) {
    it(`${algo}: sorts like Array.sort, the replayed steps give the sorted row, and the counters equal an independent version (2,300+ arrays)`, () => {
      const all = inputs(algo.length * 101, 2200);
      expect(all.length).toBeGreaterThan(2300);
      for (const input of all) {
        const copy = input.slice();
        const want = input.slice().sort((a, b) => a - b);
        const r = runAll(algo, input);
        expect(input, 'input untouched').toEqual(copy);
        expect(r.sorted).toEqual(want);
        // Replay on a fresh copy, counting as we go.
        const arr = input.slice();
        const c: Counters = { cmp: 0, moves: 0 };
        for (const s of r.steps) {
          // Plain checks inside the hot loop (an expect() per step makes this test many times slower).
          let ok: boolean;
          if (s.k === 'put') ok = s.i >= 0 && s.i < input.length && want.includes(s.v);
          else ok = s.i >= 0 && s.j >= 0 && s.i < input.length && s.j < input.length && s.i !== s.j;
          if (!ok) throw new Error(`${algo}: bad step ${JSON.stringify(s)} for ${input.join(',')}`);
          applyStep(arr, s);
          tallyStep(c, s);
        }
        expect(arr).toEqual(want);
        expect(c.cmp).toBe(r.cmp);
        expect(c.moves).toBe(r.moves);
        expect(r.steps.length).toBe(r.cmp + r.moves);
        // The second, separately written version agrees exactly.
        const ref = REF[algo](input);
        expect(ref.a).toEqual(want);
        expect(r.cmp, `${algo} comparisons for ${input.join(',')}`).toBe(ref.cmp);
        expect(r.moves, `${algo} moves for ${input.join(',')}`).toBe(ref.mv);
      }
    }, 240_000);
  }

  it('closed forms: selection sort makes n(n-1)/2 comparisons; bubble and insertion make as many swaps as there are inversions; at most n-1 swaps for selection and heap sort stays within 2 n log n comparisons', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 600; t++) {
      const n = 2 + Math.floor(rng() * 60);
      const a = makeArray(n, rng);
      const inv = inversions(a);
      expect(runAll('selection', a).cmp).toBe((n * (n - 1)) / 2);
      expect(runAll('selection', a).moves).toBeLessThanOrEqual(n - 1);
      expect(runAll('bubble', a).moves).toBe(inv);
      expect(runAll('insertion', a).moves).toBe(inv);
      expect(runAll('merge', a).cmp).toBeLessThanOrEqual(n * Math.ceil(Math.log2(n)));
      expect(runAll('heap', a).cmp).toBeLessThanOrEqual(2 * n * Math.ceil(Math.log2(n)));
      expect(runAll('merge', a).moves).toBeLessThanOrEqual(n * Math.ceil(Math.log2(n)));
    }
  });

  it('an already sorted row of n bars: bubble and insertion make n-1 comparisons and no moves; selection still makes n(n-1)/2', () => {
    for (const n of [2, 5, 16, 32, 48]) {
      const a = Array.from({ length: n }, (_, i) => i + 1);
      expect(runAll('bubble', a)).toMatchObject({ cmp: n - 1, moves: 0 });
      expect(runAll('insertion', a)).toMatchObject({ cmp: n - 1, moves: 0 });
      expect(runAll('selection', a)).toMatchObject({ cmp: (n * (n - 1)) / 2, moves: 0 });
    }
  });

  it('a reversed row: bubble and insertion make n(n-1)/2 swaps, the worst case', () => {
    for (const n of [2, 5, 16, 32, 48]) {
      const a = Array.from({ length: n }, (_, i) => n - i);
      expect(runAll('bubble', a).moves).toBe((n * (n - 1)) / 2);
      expect(runAll('insertion', a).moves).toBe((n * (n - 1)) / 2);
    }
  });

  it('rejects an unknown algorithm', () => {
    expect(() => sorter('bogo' as Algo, [2, 1])).toThrow(RangeError);
  });

  it('comparison steps never change the row and every swap step trades two different bars', () => {
    const rng = mulberry32(14);
    for (const algo of ALGOS) {
      const a = makeArray(30, rng);
      const arr = a.slice();
      for (const s of sorter(algo, a)) {
        const before = arr.slice();
        applyStep(arr, s);
        if (s.k === 'cmp') expect(arr).toEqual(before);
        if (s.k === 'swap') expect(before[s.i]).toBe(arr[s.j]);
        // Merge sort rewrites slots from a copy, so the row may repeat a value between puts; every other step keeps the row a permutation.
        if (algo !== 'merge') expect([...arr].sort((x, y) => x - y)).toEqual(a.slice().sort((x, y) => x - y));
      }
    }
  });
});

describe('the race', () => {
  it('stepping a racer in random chunk sizes ends exactly where running to the end does', () => {
    const rng = mulberry32(8);
    for (const algo of ALGOS) {
      for (let t = 0; t < 40; t++) {
        const a = makeArray(8 + Math.floor(rng() * 40), rng);
        const full = runAll(algo, a);
        const r = makeRacer(algo, a);
        let guard = 0;
        while (!r.done && guard++ < 100000) advance(r, 1 + Math.floor(rng() * 9));
        expect(r.done).toBe(true);
        expect(r.arr).toEqual(full.sorted);
        expect(r.cmp).toBe(full.cmp);
        expect(r.moves).toBe(full.moves);
        expect(work(r)).toBe(full.steps.length);
        expect(advance(r, 5)).toBe(0);
        expect(r.last).toEqual(full.steps[full.steps.length - 1] ?? null);
      }
    }
  });
  it('advance returns the steps taken, caps at what is left, and ignores bad counts', () => {
    const r = makeRacer('bubble', [3, 2, 1]);
    expect(advance(r, 0)).toBe(0);
    expect(advance(r, -4)).toBe(0);
    expect(advance(r, NaN)).toBe(0);
    expect(advance(r, Infinity)).toBe(0);
    expect(advance(r, 2.9)).toBe(2);
    expect(r.cmp + r.moves).toBe(2);
    expect(advance(r, 1000)).toBe(runAll('bubble', [3, 2, 1]).steps.length - 2);
    expect(r.done).toBe(true);
    const empty = makeRacer('merge', []);
    expect(advance(empty, 3)).toBe(0);
    expect(empty.done).toBe(true);
  });
  it('all six racers on one row end sorted, and the shared row is never changed', () => {
    const rng = mulberry32(2);
    for (const n of RACE_SIZES) {
      const a = makeArray(n, rng);
      const copy = a.slice();
      const racers = ALGOS.map((al) => makeRacer(al, a));
      let guard = 0;
      while (racers.some((r) => !r.done) && guard++ < 100000) for (const r of racers) advance(r, 7);
      for (const r of racers) expect(isSorted(r.arr)).toBe(true);
      expect(a).toEqual(copy);
    }
  });
  it('rankRacers ranks by total work, shares a rank on ties (1, 2, 2, 4) and breaks ties in the order of the list', () => {
    const r = rankRacers([
      { algo: 'bubble', cmp: 10, moves: 10 },
      { algo: 'insertion', cmp: 5, moves: 5 },
      { algo: 'selection', cmp: 8, moves: 2 },
      { algo: 'merge', cmp: 3, moves: 3 },
      { algo: 'quick', cmp: 1, moves: 1 },
      { algo: 'heap', cmp: 5, moves: 5 },
    ]);
    expect(r.map((x) => `${x.algo}:${x.rank}:${x.work}`)).toEqual(['quick:1:2', 'merge:2:6', 'insertion:3:10', 'selection:3:10', 'heap:3:10', 'bubble:6:20']);
    expect(rankRacers([])).toEqual([]);
  });
  it('ordinals read correctly', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });
  it('sizes and their labels are as the page says', () => {
    expect([...RACE_SIZES]).toEqual([16, 32, 48]);
    expect(RACE_SIZES.map((n) => RACE_SIZE_LABEL[n])).toEqual(['Small: 16 bars', 'Middle: 32 bars', 'Big: 48 bars']);
    expect(sanitiseRaceSize('48')).toBe(48);
    expect(sanitiseRaceSize(16)).toBe(16);
    for (const bad of ['', '33', '0', '-16', '1e2', 'abc', NaN, null, undefined, {}, [], 'x16']) expect(sanitiseRaceSize(bad)).toBe(32);
  });
  it('makeArray is a permutation of 1 to n, deterministic for a seed, and survives a degenerate rng', () => {
    for (const n of [0, 1, 2, 16, 48]) {
      const a = makeArray(n, mulberry32(n + 1));
      expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
    expect(makeArray(20, mulberry32(4))).toEqual(makeArray(20, mulberry32(4)));
    expect(makeArray(20, mulberry32(4))).not.toEqual(makeArray(20, mulberry32(5)));
    for (const rng of [() => 0, () => 0.999999, () => NaN]) expect([...makeArray(10, rng)].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('the work done by each algorithm on a typical 32-bar row is in the order the guide page describes (selection does the most comparisons, merge and quick the least work)', () => {
    let sel = 0, bub = 0, mer = 0, qui = 0;
    const rng = mulberry32(99);
    for (let t = 0; t < 100; t++) {
      const a = makeArray(32, rng);
      const w = (al: Algo) => { const r = runAll(al, a); return r.cmp + r.moves; };
      sel += runAll('selection', a).cmp;
      bub += w('bubble');
      mer += w('merge');
      qui += w('quick');
    }
    expect(sel / 100).toBe(496);
    expect(bub / 100).toBeGreaterThan(sel / 100);
    expect(mer / 100).toBeLessThan(sel / 100);
    expect(qui / 100).toBeLessThan(sel / 100);
  });
});

describe('your turn', () => {
  /** Breadth-first search from the sorted row over every swap of two positions: the exact fewest swaps for every row of n bars. */
  const bfs = (n: number): Map<string, number> => {
    const start = Array.from({ length: n }, (_, i) => i + 1);
    const dist = new Map<string, number>([[start.join(','), 0]]);
    let frontier = [start];
    while (frontier.length) {
      const next: number[][] = [];
      for (const row of frontier) {
        const d = dist.get(row.join(','))!;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const r = row.slice();
          sw(r, i, j);
          const k = r.join(',');
          if (!dist.has(k)) { dist.set(k, d + 1); next.push(r); }
        }
      }
      frontier = next;
    }
    return dist;
  };

  it('minSwaps equals a breadth-first search for every row of 1 to 7 bars (5,913 rows)', () => {
    let rows = 0;
    for (let n = 1; n <= 7; n++) {
      const dist = bfs(n);
      expect(dist.size).toBe([1, 1, 2, 6, 24, 120, 720, 5040][n]);
      for (const [k, d] of dist) {
        expect(minSwaps(k.split(',').map(Number)), k).toBe(d);
        rows++;
      }
    }
    expect(rows).toBe(1 + 2 + 6 + 24 + 120 + 720 + 5040);
  }, 120_000);
  it('minSwaps works on any distinct numbers, not only 1 to n', () => {
    expect(minSwaps([10, 30, 20])).toBe(1);
    expect(minSwaps([-5, 100, 7, 3])).toBe(minSwaps([1, 4, 3, 2]));
    expect(minSwaps([])).toBe(0);
    expect(minSwaps([4])).toBe(0);
  });
  it('a new puzzle is a shuffled, unsorted row with the right fewest-swaps figure, the same for a seed', () => {
    for (const n of TURN_SIZES) {
      for (let s = 1; s <= 200; s++) {
        const t = newTurn(n, mulberry32(s * 17));
        expect(t.n).toBe(n);
        expect([...t.row].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(isSorted(t.row)).toBe(false);
        expect(t.par).toBe(minSwaps(t.row));
        expect(t.par).toBeGreaterThanOrEqual(1);
        expect(t.par).toBeLessThanOrEqual(n - 1);
        expect(t.moves).toEqual([]);
        expect(t.done || t.aided).toBe(false);
      }
      expect(newTurn(n, mulberry32(3))).toEqual(newTurn(n, mulberry32(3)));
    }
    for (const rng of [() => 0, () => 0.999999, () => NaN]) expect(isSorted(newTurn(8, rng).row)).toBe(false);
    expect(() => newTurn(9, mulberry32(1))).toThrow(RangeError);
  });
  it('swapping two bars records the swap, finishes at the sorted row, ignores nonsense and never changes the old object', () => {
    const t = newTurn(8, mulberry32(1));
    const row = t.row.slice();
    const s = swapBars(t, 0, 3);
    expect(t.row).toEqual(row);
    expect(s.row[0]).toBe(row[3]);
    expect(s.row[3]).toBe(row[0]);
    expect(s.moves).toEqual([[0, 3]]);
    for (const [i, j] of [[0, 0], [-1, 2], [2, 8], [1.5, 2], [NaN, 1]] as [number, number][]) expect(swapBars(t, i, j)).toBe(t);
    expect(swapBars(t, '1', 2)).toBe(t);
    expect(swapBars(t, null, 2)).toBe(t);
    // Solve it by following the hints; the last swap finishes the row.
    let g = t;
    while (!g.done) { const h = turnHint(g)!; g = swapBars(g, h.i, h.j); }
    expect(g.done).toBe(true);
    expect(isSorted(g.row)).toBe(true);
    expect(swapBars(g, 0, 1)).toBe(g);
  });
  it('hints: every hint lowers the fewest-swaps figure by exactly one, and following them finishes in exactly par swaps (all sizes, 600 puzzles)', () => {
    for (const n of TURN_SIZES) {
      for (let s = 1; s <= 200; s++) {
        let g = newTurn(n, mulberry32(s * 31));
        const par = g.par;
        let swaps = 0;
        while (!g.done && swaps < 50) {
          const before = minSwaps(g.row);
          const h = turnHint(g)!;
          expect(h).not.toBeNull();
          expect(h.i).not.toBe(h.j);
          g = swapBars(g, h.i, h.j);
          expect(minSwaps(g.row)).toBe(before - 1);
          swaps++;
        }
        expect(g.done).toBe(true);
        expect(swaps).toBe(par);
        expect(g.moves.length).toBe(par);
        expect(turnHint(g)).toBeNull();
      }
    }
  });
  it('hints from a row reached by random swaps still lower the figure by one', () => {
    const rng = mulberry32(12);
    for (let t = 0; t < 400; t++) {
      let g = newTurn(TURN_SIZES[t % 3], rng);
      for (let k = 0; k < 6 && !g.done; k++) g = swapBars(g, pickIndex(g.n, rng), pickIndex(g.n, rng));
      if (g.done) continue;
      const h = turnHint(g)!;
      expect(minSwaps(swapBars(g, h.i, h.j).row)).toBe(minSwaps(g.row) - 1);
    }
  });
  it('undo is an exact round trip, does nothing at the start and is blocked once sorted; restart keeps the same row', () => {
    const t = newTurn(10, mulberry32(9));
    expect(undoSwap(t)).toBe(t);
    const a = swapBars(t, 0, 1);
    const b = swapBars(a, 2, 5);
    expect(undoSwap(b)).toEqual(a);
    expect(undoSwap(undoSwap(b))).toEqual(t);
    let g = b;
    while (!g.done) { const h = turnHint(g)!; g = swapBars(g, h.i, h.j); }
    expect(undoSwap(g)).toBe(g);
    const r = restartTurn(g);
    expect(r.row).toEqual(t.row);
    expect(r.moves).toEqual([]);
    expect(r.done).toBe(false);
    expect(r.aided).toBe(false);
    expect(r.par).toBe(t.par);
    // A hint stays on the record through a restart.
    expect(restartTurn(markAided(b)).aided).toBe(true);
    expect(markAided(t).aided).toBe(true);
    expect(markAided(markAided(t))).toEqual(markAided(t));
  });
  it('fuzz: 3,000 random swaps and undos keep the row a permutation of 1 to n and the move list in step', () => {
    const rng = mulberry32(777);
    for (let t = 0; t < 60; t++) {
      let g = newTurn(TURN_SIZES[t % 3], rng);
      for (let k = 0; k < 50 && !g.done; k++) {
        g = rng() < 0.25 ? undoSwap(g) : swapBars(g, pickIndex(g.n, rng), pickIndex(g.n, rng));
        expect([...g.row].sort((a, b) => a - b)).toEqual(Array.from({ length: g.n }, (_, i) => i + 1));
        // Replaying the recorded swaps on the start row gives the current row.
        const replay = g.start.slice();
        for (const [i, j] of g.moves) sw(replay, i, j);
        expect(replay).toEqual([...g.row]);
        expect(g.done).toBe(isSorted(g.row));
      }
    }
  });
  it('sizes, labels and sanitisers', () => {
    expect([...TURN_SIZES]).toEqual([8, 10, 12]);
    expect(TURN_SIZES.map((n) => TURN_SIZE_LABEL[n])).toEqual(['Small: 8 bars', 'Middle: 10 bars', 'Big: 12 bars']);
    expect(sanitiseTurnSize('12')).toBe(12);
    for (const bad of ['', '9', '0', '-8', 'abc', NaN, null, undefined, {}, []]) expect(sanitiseTurnSize(bad)).toBe(8);
    expect([...BEST_KEYS]).toEqual(['t8', 't10', 't12']);
    expect(TURN_SIZES.map(bestKey)).toEqual([...BEST_KEYS]);
  });
});

describe('saved record and helpers', () => {
  it('sanitiseBest keeps whole numbers 1 to 999 for the three keys only and returns a fresh object', () => {
    expect(sanitiseBest({ t8: 3, t10: 999, t12: 1 })).toEqual({ t8: 3, t10: 999, t12: 1 });
    expect(sanitiseBest({ t8: 0, t10: -3, t12: 1.5 })).toEqual({});
    expect(sanitiseBest({ t8: NaN, t10: Infinity, t12: 1000 })).toEqual({});
    expect(sanitiseBest({ t8: '5', t10: true, t12: [5] })).toEqual({});
    expect(sanitiseBest({ x: 5, t8: 2, t9: 3 })).toEqual({ t8: 2 });
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"t8": 5}, "constructor": 3}'));
    expect(out).toEqual({});
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    const raw = { t8: 4 };
    expect(sanitiseBest(raw)).not.toBe(raw);
  });
  it('sanitiseSeed accepts only whole numbers from 1 to 2^32 - 1', () => {
    expect(sanitiseSeed(1)).toBe(1);
    expect(sanitiseSeed('4294967295')).toBe(4294967295);
    for (const bad of [0, -1, 4294967296, 1.5, NaN, '0', '-1', '1.5', '1e3', ' 5', '', 'abc', '99999999999', null, undefined, {}, [], true]) {
      expect(sanitiseSeed(bad), String(bad)).toBe(0);
    }
  });
  it('plural and pickIndex', () => {
    expect(plural(1, 'swap')).toBe('1 swap');
    expect(plural(0, 'swap')).toBe('0 swaps');
    expect(plural(2, 'swap')).toBe('2 swaps');
    expect(pickIndex(5, () => 0.999999)).toBe(4);
    expect(pickIndex(5, () => NaN)).toBe(0);
  });
});

describe('the page', () => {
  it('announces results, keeps scores under the right key and uses the shell events', () => {
    expect(calculatorSource).toMatch(/aria-live="polite"/);
    expect(calculatorSource).toMatch(/gk:game:sorting-race/);
    expect(calculatorSource).toMatch(/_srtrInit/);
    expect(calculatorSource).toMatch(/id="srtr-app"/);
  });
});
