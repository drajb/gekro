/**
 * games-island-bridges.test.ts - the engine behind `island-bridges`.
 *
 * Pinned:
 *  - the set of possible bridges (links) against an independent pairwise scan, and the
 *    crossing relation against a cell-by-cell raster of the bridges
 *  - the solution counter against brute force over EVERY assignment of 0, 1 or 2 bridges
 *    on small random islands sets (zero, one and many solutions all occur)
 *  - every generated puzzle, sizes 7 to 11, all levels, has exactly one solution according
 *    to an independent solver written in this file (link-by-link search with sum pruning,
 *    cells raster for crossings, breadth-first connectivity)
 *  - the stored answer is a legal, connected, exactly-numbered arrangement
 *  - Easy puzzles are finished by the local rules alone
 *  - hints never contradict the answer and, followed one by one, finish the puzzle
 *  - tapping cycles 0, 1, 2 and back, crossings are refused, arrow navigation reaches every island
 *  - same seed same puzzle, sanitisers, caps
 */
import { describe, it, expect, vi } from 'vitest';

// Machine load makes wall-clock limits flake: give every test a generous budget.
vi.setConfig({ testTimeout: 120_000 });
import {
  linksOf, linksCross, buildModel, modelOf, countSolutions, solveByLogic, degrees, islandStatus, groupCount, isBlocked, isSolved, cycleLink,
  mistakes, nextHint, linkNearPoint, neighbourInDirection, linkInDirection, makePuzzle, islandTarget, sortIslands,
  mulberry32, shuffled, bestKey, sanitiseBest, MAX_BEST_SECONDS, formatTime, plural,
  SIZES, DIFFICULTIES, MAX_SIZE, MAX_BRIDGES,
  type Island, type Puzzle,
} from '../src/components/apps-private/island-bridges/helpers';

// ── Independent reference, written separately from the engine ──

interface RLink { a: number; b: number; cells: number[] }

/** Possible bridges by scanning every pair of islands. */
const refLinks = (size: number, islands: readonly Island[]): RLink[] => {
  const out: RLink[] = [];
  for (let i = 0; i < islands.length; i++) {
    for (let j = 0; j < islands.length; j++) {
      if (i === j) continue;
      const p = islands[i], q = islands[j];
      const sameRow = p.r === q.r && q.c > p.c + 1;
      const sameCol = p.c === q.c && q.r > p.r + 1;
      if (!sameRow && !sameCol) continue;
      const cells: number[] = [];
      let blocked = false;
      if (sameRow) for (let c = p.c + 1; c < q.c; c++) cells.push(p.r * size + c);
      else for (let r = p.r + 1; r < q.r; r++) cells.push(r * size + p.c);
      for (const k of islands) if (cells.includes(k.r * size + k.c)) blocked = true;
      if (!blocked) out.push({ a: i, b: j, cells });
    }
  }
  return out;
};

/**
 * Count solutions up to `limit`: assign 0/1/2 bridges link by link, track which cells
 * hold a bridge (so crossings are caught by overlap), prune on island sums, and check
 * connectivity at the end with a breadth-first search.
 */
const refCount = (size: number, islands: readonly Island[], limit = 2): number => {
  const links = refLinks(size, islands);
  const sum = islands.map(() => 0);
  const left = islands.map(() => 0);
  links.forEach((l) => { left[l.a] += 2; left[l.b] += 2; });
  const taken = new Set<number>();
  const val = links.map(() => 0);
  let found = 0;
  const connected = (): boolean => {
    const seen = new Set<number>([0]);
    const q = [0];
    while (q.length) {
      const x = q.pop()!;
      links.forEach((l, k) => {
        if (val[k] === 0) return;
        const y = l.a === x ? l.b : l.b === x ? l.a : -1;
        if (y >= 0 && !seen.has(y)) { seen.add(y); q.push(y); }
      });
    }
    return seen.size === islands.length;
  };
  const rec = (k: number): void => {
    if (found >= limit) return;
    if (k === links.length) {
      if (islands.every((isl, i) => sum[i] === isl.n) && connected()) found++;
      return;
    }
    const l = links[k];
    left[l.a] -= 2; left[l.b] -= 2;
    for (let v = 0; v <= 2; v++) {
      if (v > 0) { if (l.cells.some((c) => taken.has(c))) break; }
      sum[l.a] += v; sum[l.b] += v;
      const ok = sum[l.a] <= islands[l.a].n && sum[l.b] <= islands[l.b].n && sum[l.a] + left[l.a] >= islands[l.a].n && sum[l.b] + left[l.b] >= islands[l.b].n;
      if (ok) {
        if (v > 0) l.cells.forEach((c) => taken.add(c));
        val[k] = v;
        rec(k + 1);
        if (v > 0) l.cells.forEach((c) => taken.delete(c));
      }
      sum[l.a] -= v; sum[l.b] -= v;
      if (found >= limit) break;
    }
    val[k] = 0;
    left[l.a] += 2; left[l.b] += 2;
  };
  if (islands.length === 0) return 0;
  rec(0);
  return found;
};

/** Full brute force over all 3^E assignments with every rule checked directly (small E only). */
const bruteCount = (size: number, islands: readonly Island[]): number => {
  const links = refLinks(size, islands);
  const E = links.length;
  let count = 0;
  const val = new Array(E).fill(0);
  const total = 3 ** E;
  for (let m = 0; m < total; m++) {
    let x = m;
    for (let k = 0; k < E; k++) { val[k] = x % 3; x = Math.floor(x / 3); }
    const sum = islands.map(() => 0);
    const cellUse = new Map<number, number>();
    let ok = true;
    for (let k = 0; k < E && ok; k++) {
      if (!val[k]) continue;
      sum[links[k].a] += val[k]; sum[links[k].b] += val[k];
      for (const c of links[k].cells) { if (cellUse.has(c)) ok = false; cellUse.set(c, k); }
    }
    if (!ok || !islands.every((isl, i) => sum[i] === isl.n)) continue;
    const seen = new Set<number>([0]);
    const q = [0];
    while (q.length) {
      const a = q.pop()!;
      for (let k = 0; k < E; k++) {
        if (!val[k]) continue;
        const y = links[k].a === a ? links[k].b : links[k].b === a ? links[k].a : -1;
        if (y >= 0 && !seen.has(y)) { seen.add(y); q.push(y); }
      }
    }
    if (seen.size === islands.length) count++;
  }
  return count;
};

const sizes = [...SIZES];

describe('possible bridges (links)', () => {
  it('match an independent pairwise scan on random island sets', () => {
    const rng = mulberry32(3);
    for (let t = 0; t < 200; t++) {
      const size = 5 + Math.floor(rng() * 7);
      const cells = shuffled(Array.from({ length: size * size }, (_, i) => i), rng).slice(0, 4 + Math.floor(rng() * 14));
      const islands = sortIslands(cells.map((c) => ({ r: Math.floor(c / size), c: c % size, n: 1 })));
      const mine = linksOf(size, islands).map((l) => `${l.a}-${l.b}`).sort();
      const ref = refLinks(size, islands).map((l) => `${l.a}-${l.b}`).sort();
      // The engine names each pair once, with the left or upper island first.
      expect(mine).toEqual(ref);
    }
  });
  it('adjacent islands cannot be joined and an island in between hides the one behind it', () => {
    const isl = (r: number, c: number): Island => ({ r, c, n: 1 });
    expect(linksOf(5, sortIslands([isl(0, 0), isl(0, 1)]))).toEqual([]);
    const l = linksOf(5, sortIslands([isl(0, 0), isl(0, 2), isl(0, 4)]));
    expect(l).toHaveLength(2);
    expect(l.map((x) => [x.a, x.b])).toEqual([[0, 1], [1, 2]]);
  });
  it('crossings agree with a raster of the bridge cells', () => {
    const rng = mulberry32(8);
    for (let t = 0; t < 150; t++) {
      const size = 7 + Math.floor(rng() * 5);
      const cells = shuffled(Array.from({ length: size * size }, (_, i) => i), rng).slice(0, 10 + Math.floor(rng() * 15));
      const islands = sortIslands(cells.map((c) => ({ r: Math.floor(c / size), c: c % size, n: 2 })));
      const m = buildModel(size, islands);
      const raster = refLinks(size, islands);
      expect(raster).toHaveLength(m.links.length);
      for (let x = 0; x < m.links.length; x++) {
        for (let y = 0; y < m.links.length; y++) {
          if (x === y) continue;
          const rx = raster.find((r) => (r.a === m.links[x].a && r.b === m.links[x].b))!;
          const ry = raster.find((r) => (r.a === m.links[y].a && r.b === m.links[y].b))!;
          const overlap = rx.cells.some((c) => ry.cells.includes(c));
          expect(m.cross[x].includes(y), `links ${x},${y}`).toBe(overlap);
          expect(linksCross(m.islands, m.links[x], m.links[y])).toBe(overlap);
        }
      }
    }
  });
  it('caps a link at the smaller of its islands numbers and at two', () => {
    const m = buildModel(7, [{ r: 0, c: 0, n: 1 }, { r: 0, c: 3, n: 5 }, { r: 3, c: 3, n: 4 }]);
    expect(m.cap).toEqual([1, 2]);
    expect(MAX_BRIDGES).toBe(2);
  });
});

describe('solution counter against brute force (every 0/1/2 assignment)', () => {
  it('2000 random small island sets: counts agree, and 0, 1 and several solutions all occur', () => {
    const rng = mulberry32(2026);
    let none = 0, one = 0, many = 0;
    for (let t = 0; t < 2000; t++) {
      const size = 5 + Math.floor(rng() * 3);
      // Grow a random sensible arrangement by dropping islands on a grid, then number them from a random bridge set.
      // Half the sets sit on a coarse lattice (every second row and column), which makes rectangles and so several solutions likely.
      const pool = Array.from({ length: size * size }, (_, i) => i).filter((i) => t % 2 === 0 || (Math.floor(i / size) % 2 === 0 && (i % size) % 2 === 0));
      const cells = shuffled(pool, rng).slice(0, 3 + Math.floor(rng() * 5));
      let islands = sortIslands(cells.map((c) => ({ r: Math.floor(c / size), c: c % size, n: 1 + Math.floor(rng() * 4) })));
      if (t % 3 !== 0) {
        // Number the islands from a random legal arrangement, so at least one solution exists (bridges tracked cell by cell).
        const rl = refLinks(size, islands);
        const taken = new Set<number>();
        const deg = islands.map(() => 0);
        for (const l of shuffled(rl, rng)) {
          if (rng() < 0.4 || l.cells.some((c) => taken.has(c))) continue;
          const v = 1 + Math.floor(rng() * 2);
          l.cells.forEach((c) => taken.add(c));
          deg[l.a] += v; deg[l.b] += v;
        }
        if (deg.some((d) => d === 0 || d > 8)) continue;
        islands = islands.map((isl, i) => ({ ...isl, n: deg[i] }));
      }
      if (refLinks(size, islands).length > 10) continue;
      const m = buildModel(size, islands);
      const want = bruteCount(size, islands);
      const got = countSolutions(m, 1e9, 1e9);
      expect(got.exhausted).toBe(false);
      if (got.count !== want) throw new Error(`island set ${JSON.stringify(islands)}: engine ${got.count}, brute force ${want}`);
      expect(refCount(size, islands, 1e9)).toBe(want);
      expect(countSolutions(m, 2, 1e9).count).toBe(Math.min(2, want));
      if (want === 0) none++; else if (want === 1) one++; else many++;
      const logic = solveByLogic(m);
      if (logic) expect(want).toBe(1);
      if (want >= 1) {
        // Every solution the engine reports is accepted by the rule checker.
        expect(isSolved(m, countSolutions(m, 1).solution!)).toBe(true);
      }
    }
    expect(none).toBeGreaterThan(5);
    expect(one).toBeGreaterThan(5);
    expect(many).toBeGreaterThan(5);
  }, 120_000);

  it('hand-made cases: a pair needing 2 bridges, a loop that cannot be a single group', () => {
    // Two islands of 2 in a row: exactly one solution (a double bridge).
    const two = buildModel(5, [{ r: 0, c: 0, n: 2 }, { r: 0, c: 3, n: 2 }]);
    expect(countSolutions(two).count).toBe(1);
    expect(countSolutions(two).solution).toEqual([2]);
    // Islands of 1: a single bridge.
    expect(countSolutions(buildModel(5, [{ r: 0, c: 0, n: 1 }, { r: 0, c: 3, n: 1 }])).solution).toEqual([1]);
    // Two pairs, each satisfied inside itself, never join: no solution.
    const split = buildModel(7, [
      { r: 0, c: 0, n: 1 }, { r: 0, c: 3, n: 1 },
      { r: 4, c: 0, n: 1 }, { r: 4, c: 3, n: 1 },
    ]);
    expect(countSolutions(split).count).toBe(0);
    // A square ring with every corner 2: one solution (four single bridges).
    const ring = buildModel(7, [{ r: 0, c: 0, n: 2 }, { r: 0, c: 3, n: 2 }, { r: 3, c: 0, n: 2 }, { r: 3, c: 3, n: 2 }]);
    const r = countSolutions(ring);
    expect(r.count).toBe(1);
    expect(r.solution).toEqual(ring.links.map(() => 1));
  });
});

describe('generator', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    for (const d of DIFFICULTIES) {
      expect(makePuzzle(8, d, mulberry32(11))).toEqual(makePuzzle(8, d, mulberry32(11)));
    }
    const seen = new Set<string>();
    for (let s = 1; s <= 12; s++) seen.add(JSON.stringify(makePuzzle(8, 'normal', mulberry32(s)).islands));
    expect(seen.size).toBeGreaterThan(9);
  });
  it('rejects absurd sizes', () => {
    expect(() => makePuzzle(2, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(MAX_SIZE + 1, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(7.5, 'easy', mulberry32(1))).toThrow(RangeError);
  });
  it('asks for more islands on bigger boards and harder levels', () => {
    for (const n of sizes) {
      expect(islandTarget(n, 'easy')).toBeLessThanOrEqual(islandTarget(n, 'normal'));
      expect(islandTarget(n, 'normal')).toBeLessThanOrEqual(islandTarget(n, 'hard'));
    }
    expect(islandTarget(11, 'hard')).toBeGreaterThan(islandTarget(7, 'hard'));
  });

  for (const n of sizes) {
    for (const d of DIFFICULTIES) {
      it(`${n}x${n} ${d}: 25 seeds are legal, have one solution (independent solver) and a valid stored answer`, () => {
        for (let s = 1; s <= 25; s++) {
          const p = makePuzzle(n, d, mulberry32(777 * n + s));
          const m = modelOf(p);
          // Islands are inside the board, distinct, never side by side, numbered 1 to 8.
          const seen = new Set<number>();
          for (const isl of p.islands) {
            expect(isl.r >= 0 && isl.r < n && isl.c >= 0 && isl.c < n).toBe(true);
            expect(seen.has(isl.r * n + isl.c)).toBe(false);
            seen.add(isl.r * n + isl.c);
            expect(isl.n).toBeGreaterThanOrEqual(1);
            expect(isl.n).toBeLessThanOrEqual(8);
          }
          for (const isl of p.islands) {
            if (isl.c + 1 < n) expect(seen.has(isl.r * n + isl.c + 1), 'islands touching').toBe(false);
            if (isl.r + 1 < n) expect(seen.has((isl.r + 1) * n + isl.c), 'islands touching').toBe(false);
          }
          expect(p.solution).toHaveLength(m.links.length);
          expect(isSolved(m, p.solution)).toBe(true);
          expect(degrees(m, p.solution)).toEqual(p.islands.map((i) => i.n));
          expect(refCount(n, p.islands), `${n} ${d} seed ${s}`).toBe(1);
          const mine = countSolutions(m, 2);
          expect(mine.count).toBe(1);
          expect(mine.solution).toEqual(p.solution);
        }
      }, 120_000);
    }
  }

  it('Easy puzzles are finished by the local rules alone and match the stored answer', () => {
    for (const n of sizes) {
      for (let s = 1; s <= 25; s++) {
        const p = makePuzzle(n, 'easy', mulberry32(31 * n + s));
        expect(solveByLogic(modelOf(p))).toEqual(p.solution);
      }
    }
  }, 60_000);

  it('every size and level builds in well under a second on average', () => {
    const t0 = Date.now();
    let k = 0;
    for (const n of sizes) for (const d of DIFFICULTIES) for (let s = 1; s <= 5; s++) { makePuzzle(n, d, mulberry32(900 + s)); k++; }
    expect((Date.now() - t0) / k).toBeLessThan(1000);
  }, 120_000);

  it('Hard puzzles use the full set of bridge counts: some double bridges appear', () => {
    let doubles = 0;
    for (let s = 1; s <= 10; s++) doubles += makePuzzle(9, 'hard', mulberry32(s)).solution.filter((v) => v === 2).length;
    expect(doubles).toBeGreaterThan(0);
  });
});

describe('playing helpers', () => {
  const p: Puzzle = makePuzzle(8, 'normal', mulberry32(42));
  const m = modelOf(p);
  const zero = (): number[] => m.links.map(() => 0);

  it('an empty board is not solved; the answer is; one bridge too many or too few is not', () => {
    expect(isSolved(m, zero())).toBe(false);
    expect(isSolved(m, p.solution)).toBe(true);
    const more = p.solution.slice();
    const k = more.findIndex((v) => v === 0 && !isBlocked(m, more, more.indexOf(0)));
    if (k >= 0) { more[k] = 1; expect(isSolved(m, more)).toBe(false); }
    const less = p.solution.slice();
    less[less.findIndex((v) => v > 0)] -= 1;
    expect(isSolved(m, less)).toBe(false);
    expect(isSolved(m, p.solution.map((v) => v + 0.5))).toBe(false);
  });
  it('islandStatus: ok, over, open', () => {
    const c = zero();
    expect(m.islands.every((_, i) => islandStatus(m, c, i) === 'open')).toBe(true);
    expect(m.islands.every((_, i) => islandStatus(m, p.solution, i) === 'ok')).toBe(true);
    const k = p.solution.findIndex((v) => v === 2);
    if (k >= 0) {
      const over = p.solution.slice();
      over[k] = 2;
      const j = zero();
      j[k] = 2;
      const a = m.links[k].a;
      expect(islandStatus(m, j, a)).toBe(m.islands[a].n === 2 ? 'ok' : m.islands[a].n < 2 ? 'over' : 'open');
    }
  });
  it('groupCount: every island alone at first, one group when solved', () => {
    expect(groupCount(m, zero())).toBe(m.islands.length);
    expect(groupCount(m, p.solution)).toBe(1);
  });
  it('cycleLink goes 0, 1, 2, 0 and refuses a crossing', () => {
    let c = zero();
    const k = 0;
    const seq = [];
    for (let i = 0; i < 4; i++) { const n = cycleLink(m, c, k); expect(n).not.toBeNull(); c = n!; seq.push(c[k]); }
    expect(seq).toEqual([1, 2, 0, 1]);
    // Find a crossing pair in some puzzle and test the refusal.
    for (let s = 1; s <= 40; s++) {
      const q = modelOf(makePuzzle(9, 'hard', mulberry32(s)));
      const x = q.cross.findIndex((list) => list.length > 0);
      if (x < 0) continue;
      const y = q.cross[x][0];
      const base = q.links.map(() => 0);
      base[x] = 1;
      expect(isBlocked(q, base, y)).toBe(true);
      expect(cycleLink(q, base, y)).toBeNull();
      expect(cycleLink(q, base, x)).not.toBeNull(); // the link already carrying a bridge can still change
      return;
    }
    throw new Error('no crossing pair found in 40 puzzles');
  });
  it('mistakes lists links with more bridges than the answer', () => {
    const c = zero();
    expect(mistakes(p.solution, c)).toEqual([]);
    expect(mistakes(p.solution, p.solution)).toEqual([]);
    const z = p.solution.findIndex((v) => v === 0);
    if (z >= 0) { c[z] = 1; expect(mistakes(p.solution, c)).toEqual([z]); }
  });
  it('following hints from an empty board always finishes the puzzle, and no hint is false', () => {
    for (const d of DIFFICULTIES) {
      const q = makePuzzle(9, d, mulberry32(5));
      const mm = modelOf(q);
      let counts = mm.links.map(() => 0);
      let steps = 0;
      const kinds = new Set<string>();
      for (;;) {
        const h = nextHint(mm, q.solution, counts);
        if (!h) break;
        kinds.add(h.kind);
        expect(h.kind).not.toBe('wrong');
        expect(h.value).toBe(q.solution[h.link]);
        expect(counts[h.link]).not.toBe(h.value);
        counts = counts.slice();
        counts[h.link] = h.value;
        if (++steps > 200) throw new Error('hints do not end');
      }
      expect(isSolved(mm, counts)).toBe(true);
      if (d === 'easy') expect(kinds.has('reveal')).toBe(false);
    }
  });
  it('a wrong link is reported first with the right value', () => {
    const z = p.solution.findIndex((v) => v === 0);
    const c = zero();
    c[z] = 2;
    const h = nextHint(m, p.solution, c)!;
    expect(h).toEqual({ link: z, kind: 'wrong', value: 0 });
    expect(nextHint(m, p.solution, p.solution)).toBeNull();
  });
  it('fuzz: random bridge sets never throw in the helpers', () => {
    const rng = mulberry32(1);
    for (let t = 0; t < 300; t++) {
      const c = m.links.map(() => Math.floor(rng() * 3));
      isSolved(m, c);
      groupCount(m, c);
      nextHint(m, p.solution, c);
      m.islands.forEach((_, i) => islandStatus(m, c, i));
    }
  });
});

describe('geometry for the page', () => {
  const p = makePuzzle(9, 'normal', mulberry32(21));
  const m = modelOf(p);
  it('linkNearPoint finds a link from a point on its open ground and nothing far from every link', () => {
    m.links.forEach((l, k) => {
      const a = m.islands[l.a], b = m.islands[l.b];
      const x = (a.c + b.c) / 2 + 0.5, y = (a.r + b.r) / 2 + 0.5;
      expect(linkNearPoint(m, x, y)).toBe(k);
    });
    expect(linkNearPoint(m, NaN, 1)).toBe(-1);
    expect(linkNearPoint(m, -50, -50)).toBe(-1);
  });
  it('arrow navigation goes the right way and reaches every island', () => {
    const N = m.islands.length;
    const seen = new Set<number>([0]);
    const q = [0];
    while (q.length) {
      const x = q.pop()!;
      for (let dir = 0; dir < 4; dir++) {
        const y = neighbourInDirection(m, x, dir);
        if (y < 0) continue;
        const dr = m.islands[y].r - m.islands[x].r, dc = m.islands[y].c - m.islands[x].c;
        if (dir === 0) expect(dr).toBeLessThan(0);
        if (dir === 2) expect(dr).toBeGreaterThan(0);
        if (dir === 1) expect(dc).toBeGreaterThan(0);
        if (dir === 3) expect(dc).toBeLessThan(0);
        if (!seen.has(y)) { seen.add(y); q.push(y); }
      }
    }
    expect(seen.size).toBe(N);
  });
  it('linkInDirection agrees with the links', () => {
    m.links.forEach((l, k) => {
      expect(linkInDirection(m, l.a, l.horiz ? 1 : 2)).toBe(k);
      expect(linkInDirection(m, l.b, l.horiz ? 3 : 0)).toBe(k);
    });
  });
});

describe('saved best times', () => {
  it('keeps whole positive times for known sizes and levels and drops everything else', () => {
    expect(bestKey(7, 'normal')).toBe('7-normal');
    expect(sanitiseBest({ '7-normal': 120, '11-hard': 3600 })).toEqual({ '7-normal': 120, '11-hard': 3600 });
    expect(sanitiseBest({ '7-normal': 12, '6-easy': 3, '7-wild': 3, x: 1, '12-easy': 5 })).toEqual({ '7-normal': 12 });
    expect(sanitiseBest({ '7-normal': 0, '8-easy': -3, '9-easy': 1.5, '9-hard': NaN, '10-easy': Infinity })).toEqual({});
    expect(sanitiseBest({ '7-normal': '12', '8-easy': true, '9-easy': [12], '9-hard': null })).toEqual({});
    expect(sanitiseBest({ '7-easy': MAX_BEST_SECONDS })).toEqual({ '7-easy': MAX_BEST_SECONDS });
    expect(sanitiseBest({ '7-easy': MAX_BEST_SECONDS + 1 })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"polluted": 1}, "7-easy": 9}'));
    expect(out).toEqual({ '7-easy': 9 });
    expect(({} as any).polluted).toBeUndefined();
  });
  it('formats time and plurals', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(NaN)).toBe('0:00');
    expect(plural(1, 'island')).toBe('1 island');
    expect(plural(3, 'island')).toBe('3 islands');
  });
  it('the page quotes sizes 7 to 11', () => {
    expect(sizes).toEqual([7, 8, 9, 10, 11]);
  });
});
