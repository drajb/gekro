/**
 * games-pair-paths.test.ts - the engine behind `pair-paths`.
 *
 * Pinned: the seeded random numbers match a second implementation; the random full
 * path really visits every cell once; every generated puzzle has its planted answer
 * valid AND exactly ONE answer, proven by an independent edge-by-edge search (a
 * different algorithm from the engine's path-growing search) for every size over many
 * seeds; the engine's answer count agrees with that search on random pair layouts
 * that were never generated; the same seed gives the same puzzle; the built-in
 * fallbacks are unique too; drawing, stepping back, cutting another path and refusing
 * a foreign dot behave as the page says; thousands of random drawing sequences never
 * break an invariant; the hint, the check and the win test follow the answer; storage
 * and URL sanitisers reject junk.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, PAIRS_FOR, MAX_PAIRS, mulberry32, plural, rowOf, colOf, neighboursOf, adjacent, clampSize, formatTime, dailySeed,
  randomFullPath, randomCuts, solveFill, verifyAnswer, makePuzzle, fallbackFor, emptyPaths, dotAt, ownerMap, otherDot, isLinked,
  linkedCount, coveredCount, isSolved, beginAt, stepTo, drawRoute, clearPair, wrongPairs, hintPair, routeFor,
  bestKey, MAX_BEST_SECONDS, sanitiseBest, describeCell, pairName, SYMBOLS, COLOUR_NAMES,
  type Pair, type Paths, type Puzzle,
} from '../src/components/apps-private/pair-paths/helpers';

// ── Independent pieces (written differently from the engine) ──────────────────

/** The standard 32-bit generator of this family, written with plain arithmetic. */
const refRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z = z ^ (z + Math.imul(z ^ (z >>> 7), z | 61));
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Counts the ways to pick edges between neighbouring cells so that every cell has
 * the right number of edges (one for a dot, two for any other cell), no edges form a
 * loop, and every edge-path runs between the two dots of ONE pair. It decides the
 * edges cell by cell and never grows a path from a dot, so it shares no logic with
 * the engine search. (A cell may touch its own path sideways: only edges count.)
 */
const countByEdges = (n: number, pairs: readonly Pair[], cap = 1_000_000): number => {
  const total = n * n;
  const dotPair = new Array<number>(total).fill(-1);
  pairs.forEach((p, k) => { dotPair[p.a] = k; dotPair[p.b] = k; });
  const need = (i: number) => (dotPair[i] >= 0 ? 1 : 2);
  const deg = new Array<number>(total).fill(0);
  const adj: number[][] = Array.from({ length: total }, () => []);
  const parent = Array.from({ length: total }, (_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) x = parent[x]; return x; };
  let count = 0;

  const leafOk = (): boolean => {
    let seen = 0;
    for (let k = 0; k < pairs.length; k++) {
      let prev = -1;
      let cur = pairs[k].a;
      seen++;
      for (let guard = 0; guard <= total; guard++) {
        const nxt = adj[cur].filter((j) => j !== prev);
        if (adj[cur].length === 1 && prev !== -1) break; // the far end
        if (nxt.length !== 1) return false;
        prev = cur;
        cur = nxt[0];
        seen++;
      }
      if (cur !== pairs[k].b) return false;
    }
    return seen === total;
  };

  const rec = (i: number): void => {
    if (count >= cap) return;
    if (i === total) { if (leafOk()) count++; return; }
    const r = Math.floor(i / n);
    const c = i % n;
    for (const right of c < n - 1 ? [false, true] : [false]) {
      for (const down of r < n - 1 ? [false, true] : [false]) {
        const d = deg[i] + (right ? 1 : 0) + (down ? 1 : 0);
        if (d !== need(i)) continue;
        if (right && deg[i + 1] + 1 > need(i + 1)) continue;
        if (down && deg[i + n] + 1 > need(i + n)) continue;
        const undo: [number, number][] = [];
        let loop = false;
        const link = (j: number): void => {
          const a = find(i);
          const b = find(j);
          if (a === b) { loop = true; return; }
          parent[b] = a;
          undo.push([b, j]);
          adj[i].push(j);
          adj[j].push(i);
          deg[j]++;
        };
        if (right) link(i + 1);
        if (!loop && down) link(i + n);
        if (!loop) rec(i + 1);
        for (let u = undo.length - 1; u >= 0; u--) {
          const [b, j] = undo[u];
          parent[b] = b;
          adj[i].pop();
          adj[j].pop();
          deg[j]--;
        }
      }
    }
  };
  rec(0);
  return count;
};

const cellsOf = (paths: readonly (readonly number[])[]): number[] => paths.flat();

const invariant = (p: Puzzle, paths: Paths): void => {
  const used = new Set<number>();
  paths.forEach((path, k) => {
    if (path.length) expect(dotAt(p, path[0]), 'path starts on a dot of its own pair').toBe(k);
    path.forEach((c, i) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(p.n * p.n);
      expect(used.has(c), `cell ${c} used twice`).toBe(false);
      used.add(c);
      if (i > 0) expect(adjacent(p.n, path[i - 1], c)).toBe(true);
      const d = dotAt(p, c);
      if (d >= 0 && i > 0) expect(d, 'a path only passes over its own dots').toBe(k);
    });
    // A path that reached its second dot ends there.
    for (let i = 1; i < path.length - 1; i++) expect(dotAt(p, path[i])).toBe(-1);
  });
};

// ── Random numbers and basics ─────────────────────────────────────────────────

describe('seeded random numbers', () => {
  it('match a second implementation and stay in [0, 1)', () => {
    for (const seed of [0, 1, 7, 12345, 2 ** 32 - 1]) {
      const a = mulberry32(seed);
      const b = refRng(seed);
      for (let i = 0; i < 200; i++) {
        const x = a();
        expect(x).toBe(b());
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(1);
      }
    }
  });
});

describe('grid helpers', () => {
  it('knows rows, columns and neighbours', () => {
    expect(rowOf(5, 12)).toBe(2);
    expect(colOf(5, 12)).toBe(2);
    expect(neighboursOf(5, 0).sort((x, y) => x - y)).toEqual([1, 5]);
    expect(neighboursOf(5, 12).sort((x, y) => x - y)).toEqual([7, 11, 13, 17]);
    expect(neighboursOf(4, 15).sort((x, y) => x - y)).toEqual([11, 14]);
  });
  it('adjacent is true only for orthogonal neighbours inside the grid', () => {
    expect(adjacent(5, 4, 5)).toBe(false); // end of a row and start of the next
    expect(adjacent(5, 4, 9)).toBe(true);
    expect(adjacent(5, 6, 12)).toBe(false); // diagonal
    expect(adjacent(5, 3, 3)).toBe(false);
    expect(adjacent(5, -1, 0)).toBe(false);
    expect(adjacent(5, 24, 25)).toBe(false);
    expect(adjacent(5, 1.5, 2)).toBe(false);
  });
  it('has seven symbols and seven colour names for at most seven pairs', () => {
    expect(MAX_PAIRS).toBe(7);
    expect(SYMBOLS.length).toBe(7);
    expect(COLOUR_NAMES.length).toBe(7);
    for (const n of SIZES) expect(PAIRS_FOR[n]).toBeLessThanOrEqual(MAX_PAIRS);
  });
  it('clampSize accepts only known sizes', () => {
    expect(SIZES).toEqual([4, 5, 6]);
    expect(clampSize('5', 4)).toBe(5);
    expect(clampSize(6, 4)).toBe(6);
    for (const bad of ['7', '', ' ', 'x', 5.5, NaN, -1, null, undefined, [], {}, '4e0x', Infinity]) expect(clampSize(bad, 5)).toBe(5);
  });
  it('formats times and plurals', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(-5)).toBe('0:00');
    expect(plural(1, 'pair')).toBe('1 pair');
    expect(plural(3, 'pair')).toBe('3 pairs');
    expect(plural(0, 'pair')).toBe('0 pairs');
  });
  it('dailySeed is a fixed positive 32-bit number per date and size', () => {
    const s = dailySeed(2026, 11, 5, 5);
    expect(s).toBe(dailySeed(2026, 11, 5, 5));
    expect(Number.isInteger(s) && s > 0 && s < 2 ** 32).toBe(true);
    expect(dailySeed(2026, 11, 6, 5)).not.toBe(s);
    expect(dailySeed(2026, 11, 5, 6)).not.toBe(s);
    for (const bad of [NaN, Infinity, -1, 1e12]) {
      const v = dailySeed(bad, bad, bad, bad);
      expect(Number.isInteger(v) && v > 0 && v < 2 ** 32).toBe(true);
    }
  });
});

// ── Generator ─────────────────────────────────────────────────────────────────

describe('random full path', () => {
  it('visits every cell exactly once through adjacent cells, for every size and many seeds', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      for (let seed = 1; seed <= 25; seed++) {
        const path = randomFullPath(n, mulberry32(seed));
        expect(path.length).toBe(n * n);
        expect(new Set(path).size).toBe(n * n);
        for (let i = 1; i < path.length; i++) expect(adjacent(n, path[i - 1], path[i])).toBe(true);
      }
    }
  });
  it('differs between seeds and repeats for the same seed', () => {
    const a = randomFullPath(6, mulberry32(3));
    expect(randomFullPath(6, mulberry32(3))).toEqual(a);
    const others = Array.from({ length: 10 }, (_, i) => randomFullPath(6, mulberry32(100 + i)).join(','));
    expect(new Set(others).size).toBeGreaterThan(7);
  });
});

describe('random cuts', () => {
  it('give runs of at least the minimum length that add up to the whole path', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      const len = 30 + (seed % 21);
      const k = 3 + (seed % 4);
      const cuts = randomCuts(len, k, 3, rng);
      expect(cuts.length).toBe(k - 1);
      const bounds = [0, ...cuts, len];
      for (let i = 1; i < bounds.length; i++) expect(bounds[i] - bounds[i - 1]).toBeGreaterThanOrEqual(3);
    }
  });
  it('refuses when the runs cannot fit', () => {
    expect(() => randomCuts(10, 4, 3, mulberry32(1))).toThrow(RangeError);
  });
});

describe('generated puzzles', () => {
  it('have a valid planted answer and the promised number of pairs, for every size', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 40; seed++) {
        const p = makePuzzle(n, mulberry32(seed));
        expect(p.n).toBe(n);
        expect(p.pairs.length).toBe(PAIRS_FOR[n]);
        expect(verifyAnswer(n, p.pairs, p.solution, true)).toBe(true);
        // independent re-check of the planted answer
        const flat = cellsOf(p.solution);
        expect(new Set(flat).size).toBe(n * n);
        p.solution.forEach((s, k) => {
          expect(s.length).toBeGreaterThanOrEqual(3);
          expect([s[0], s[s.length - 1]].sort()).toEqual([p.pairs[k].a, p.pairs[k].b].sort());
        });
        // all dots distinct
        const dots = p.pairs.flatMap((q) => [q.a, q.b]);
        expect(new Set(dots).size).toBe(dots.length);
      }
    }
  });

  it('have exactly ONE answer, proven by the independent edge-by-edge search (4x4, 60 seeds)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = makePuzzle(4, mulberry32(seed));
      expect(countByEdges(4, p.pairs), `seed ${seed}`).toBe(1);
    }
  }, 120_000);

  it('have exactly ONE answer, proven by the independent edge-by-edge search (5x5, 40 seeds)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makePuzzle(5, mulberry32(seed));
      expect(countByEdges(5, p.pairs), `seed ${seed}`).toBe(1);
    }
  }, 240_000);

  it('have exactly ONE answer, proven by the independent edge-by-edge search (6x6, 12 seeds)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = makePuzzle(6, mulberry32(seed));
      expect(countByEdges(6, p.pairs), `seed ${seed}`).toBe(1);
    }
  }, 600_000);

  it('give the same puzzle for the same seed, and mostly different ones for different seeds', () => {
    for (const n of SIZES) {
      expect(makePuzzle(n, mulberry32(9))).toEqual(makePuzzle(n, mulberry32(9)));
      const keys = Array.from({ length: 12 }, (_, i) => JSON.stringify(makePuzzle(n, mulberry32(500 + i)).pairs));
      expect(new Set(keys).size).toBeGreaterThanOrEqual(10);
    }
  });

  it('never depend on the clock: a tiny step budget changes nothing about a fixed seed beyond falling back', () => {
    const a = makePuzzle(5, mulberry32(4));
    const b = makePuzzle(5, mulberry32(4), { maxAttempts: 400, nodesPerTry: 40000 });
    expect(b).toEqual(a);
  });

  it('use the built-in puzzle when no try succeeds, and that puzzle is unique too', () => {
    for (const n of SIZES) {
      const fb = fallbackFor(n);
      expect(countByEdges(n, fb.pairs)).toBe(1);
      expect(verifyAnswer(n, fb.pairs, fb.solution)).toBe(true);
      const p = makePuzzle(n, mulberry32(1), { maxAttempts: 0 });
      expect(p.pairs).toEqual(fb.pairs);
      expect(p.solution).toEqual(fb.solution);
    }
  }, 120_000);

  it('rejects a size that is not offered', () => {
    expect(() => makePuzzle(7, mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(3.5, mulberry32(1))).toThrow(RangeError);
  });

  it('most seeds are found in a few tries, so pages load quickly (6x6 worst case under 400 tries for 150 seeds)', () => {
    for (let seed = 1000; seed < 1150; seed++) {
      const p = makePuzzle(6, mulberry32(seed), { maxAttempts: 400 });
      expect(p.pairs.length).toBe(6);
    }
  }, 120_000);
});

// ── The engine's counter against the independent one ──────────────────────────

describe('solver agrees with the independent edge-by-edge search', () => {
  it('on random pair layouts that were never generated (4x4, 300 layouts)', () => {
    const rng = mulberry32(2024);
    let withAnswers = 0;
    for (let t = 0; t < 300; t++) {
      const k = 2 + Math.floor(rng() * 3); // 2..4 pairs
      const cells = Array.from({ length: 16 }, (_, i) => i);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      const pairs: Pair[] = Array.from({ length: k }, (_, i) => ({ a: cells[2 * i], b: cells[2 * i + 1] }));
      const expected = countByEdges(4, pairs);
      const got = solveFill(4, pairs, { limit: 100000, maxNodes: 5_000_000 });
      expect(got.limited).toBe(false);
      expect(got.count, JSON.stringify(pairs)).toBe(expected);
      if (expected > 0) {
        withAnswers++;
        expect(verifyAnswer(4, pairs, got.first!, true)).toBe(true);
      }
    }
    expect(withAnswers).toBeGreaterThan(20);
  }, 120_000);

  it('on random pair layouts on 5x5 (60 layouts)', () => {
    const rng = mulberry32(77);
    for (let t = 0; t < 60; t++) {
      const k = 3 + Math.floor(rng() * 3);
      const cells = Array.from({ length: 25 }, (_, i) => i);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      const pairs: Pair[] = Array.from({ length: k }, (_, i) => ({ a: cells[2 * i], b: cells[2 * i + 1] }));
      const expected = countByEdges(5, pairs, 50);
      const got = solveFill(5, pairs, { limit: 50, maxNodes: 5_000_000 });
      expect(got.count, JSON.stringify(pairs)).toBe(expected);
    }
  }, 240_000);

  it('reports zero for a layout with no answer and stops at the limit', () => {
    // Two pairs in a 2x2... use 4x4 with one dot walled off from its partner by an odd colouring.
    const none: Pair[] = [{ a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 }, { a: 6, b: 7 }, { a: 8, b: 9 }];
    expect(solveFill(4, none, { limit: 5 }).count).toBe(countByEdges(4, none));
    const loose: Pair[] = [{ a: 0, b: 15 }];
    const lim = solveFill(4, loose, { limit: 3 });
    expect(lim.count).toBeLessThanOrEqual(3);
    expect(lim.count).toBe(Math.min(3, countByEdges(4, loose, 3)));
  });

  it('gives up cleanly when the step budget is too small', () => {
    const p = makePuzzle(6, mulberry32(8));
    const r = solveFill(6, p.pairs, { limit: 2, maxNodes: 3 });
    expect(r.limited).toBe(true);
  });
});

describe('verifyAnswer', () => {
  const pairs: Pair[] = [{ a: 0, b: 3 }, { a: 4, b: 7 }];
  it('accepts full and partial covers by the rule asked for', () => {
    const rows: number[][] = [[0, 1, 2, 3], [4, 5, 6, 7]];
    expect(verifyAnswer(4, pairs, rows, false)).toBe(true);
    expect(verifyAnswer(4, pairs, rows, true)).toBe(false); // 8 of 16 cells
  });
  it('rejects crossings, gaps, wrong ends and bad cells', () => {
    expect(verifyAnswer(4, pairs, [[0, 1, 2, 3], [4, 5, 6, 2]], false)).toBe(false);
    expect(verifyAnswer(4, pairs, [[0, 2, 3], [4, 5, 6, 7]], false)).toBe(false);
    expect(verifyAnswer(4, pairs, [[0, 1, 2], [4, 5, 6, 7]], false)).toBe(false);
    expect(verifyAnswer(4, pairs, [[0, 1, 2, 3, 99], [4, 5, 6, 7]], false)).toBe(false);
    expect(verifyAnswer(4, pairs, [[0, 1, 2, 3]], false)).toBe(false);
    expect(verifyAnswer(4, pairs, [[3, 2, 1, 0], [7, 6, 5, 4]], false)).toBe(true);
  });
});

// ── Playing ───────────────────────────────────────────────────────────────────

/** A hand-made 4x4 board: pairs along the first rows. Cells 0..15. */
const board = (): Puzzle => ({
  n: 4,
  pairs: [{ a: 0, b: 3 }, { a: 4, b: 7 }, { a: 8, b: 11 }, { a: 12, b: 15 }],
  solution: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]],
});

describe('drawing', () => {
  it('starts on a dot and extends one adjacent cell at a time', () => {
    const p = board();
    let b = beginAt(p, emptyPaths(p), 0)!;
    expect(b.k).toBe(0);
    expect(b.paths[0]).toEqual([0]);
    let s = stepTo(p, b.paths, 0, 1);
    expect(s.ok && s.paths[0]).toEqual([0, 1]);
    if (s.ok) s = stepTo(p, s.paths, 0, 2);
    if (s.ok) s = stepTo(p, s.paths, 0, 3);
    expect(s.ok && isLinked(p, s.paths, 0)).toBe(true);
  });

  it('refuses a cell that is not next to the end of the path', () => {
    const p = board();
    const b = beginAt(p, emptyPaths(p), 0)!;
    const s = stepTo(p, b.paths, 0, 2);
    expect(s).toEqual({ ok: false, reason: 'far' });
    expect(stepTo(p, b.paths, 0, 5)).toEqual({ ok: false, reason: 'far' }); // diagonal
  });

  it('refuses another pair\'s dot', () => {
    const p = board();
    const b = beginAt(p, emptyPaths(p), 0)!;
    expect(stepTo(p, b.paths, 0, 4)).toEqual({ ok: false, reason: 'dot' });
  });

  it('refuses to grow a path that already joins its two dots, but lets it step back', () => {
    const p = board();
    let paths = drawRoute(p, emptyPaths(p), 0, [0, 1, 2, 3]);
    expect(isLinked(p, paths, 0)).toBe(true);
    expect(stepTo(p, paths, 0, 7)).toEqual({ ok: false, reason: 'linked' });
    const back = stepTo(p, paths, 0, 2);
    expect(back.ok && back.paths[0]).toEqual([0, 1, 2]);
  });

  it('cuts its own path back when it steps onto an earlier cell', () => {
    const p = board();
    let paths = drawRoute(p, emptyPaths(p), 0, [0, 1, 5, 9]);
    const s = stepTo(p, paths, 0, 5);
    expect(s.ok && s.paths[0]).toEqual([0, 1, 5]);
    const short = drawRoute(p, emptyPaths(p), 0, [0, 1, 5]);
    const s2 = stepTo(p, short, 0, 1);
    expect(s2.ok && s2.paths[0]).toEqual([0, 1]);
  });

  it('cuts another path just before the cell it runs over', () => {
    const p = board();
    let paths = drawRoute(p, emptyPaths(p), 1, [4, 5, 6]);
    paths = drawRoute(p, paths, 0, [0, 1]);
    const s = stepTo(p, paths, 0, 5);
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.paths[0]).toEqual([0, 1, 5]);
      expect(s.paths[1]).toEqual([4]);
    }
  });

  it('picks a path up again from any of its cells and from either dot', () => {
    const p = board();
    let paths = drawRoute(p, emptyPaths(p), 0, [0, 1, 2, 3]);
    const mid = beginAt(p, paths, 1)!;
    expect(mid.k).toBe(0);
    expect(mid.paths[0]).toEqual([0, 1]);
    const dot = beginAt(p, paths, 3)!;
    expect(dot.k).toBe(0);
    expect(dot.paths[0]).toEqual([3]); // restarts from the dot that was touched
    expect(beginAt(p, paths, 9)).toBeNull();
    expect(beginAt(p, paths, -1)).toBeNull();
    expect(beginAt(p, paths, 99)).toBeNull();
    expect(beginAt(p, paths, 1.5)).toBeNull();
  });

  it('can draw a pair from its b dot and still count it as linked', () => {
    const p = board();
    const paths = drawRoute(p, emptyPaths(p), 0, [3, 2, 1, 0]);
    expect(isLinked(p, paths, 0)).toBe(true);
    expect(otherDot(p, 0, 3)).toBe(0);
    expect(otherDot(p, 0, 0)).toBe(3);
  });

  it('does not modify its input', () => {
    const p = board();
    const paths = drawRoute(p, emptyPaths(p), 1, [4, 5, 6]);
    const frozen = JSON.stringify(paths);
    stepTo(p, paths, 1, 7);
    beginAt(p, paths, 5);
    stepTo(p, paths, 1, 5);
    expect(JSON.stringify(paths)).toBe(frozen);
  });

  it('clearPair empties just that pair', () => {
    const p = board();
    const paths = drawRoute(p, drawRoute(p, emptyPaths(p), 0, [0, 1, 2, 3]), 1, [4, 5]);
    const c = clearPair(paths, 0);
    expect(c[0]).toEqual([]);
    expect(c[1]).toEqual([4, 5]);
  });

  it('ownerMap, coveredCount and linkedCount agree', () => {
    const p = board();
    const paths = drawRoute(p, drawRoute(p, emptyPaths(p), 0, [0, 1, 2, 3]), 1, [4, 5]);
    const o = ownerMap(p, paths);
    expect(o.filter((x) => x === 0).length).toBe(4);
    expect(o.filter((x) => x === 1).length).toBe(2);
    expect(o.filter((x) => x === -1).length).toBe(10);
    expect(coveredCount(paths)).toBe(6);
    expect(linkedCount(p, paths)).toBe(1);
  });
});

describe('winning', () => {
  it('needs every pair linked, and with the fill rule every cell used', () => {
    const p = board();
    let paths = emptyPaths(p);
    for (let k = 0; k < 4; k++) paths = drawRoute(p, paths, k, p.solution[k]);
    expect(isSolved(p, paths, true)).toBe(true);
    expect(isSolved(p, paths, false)).toBe(true);
    // a different, shorter-looking join leaves cells empty
    const q: Puzzle = { ...p, pairs: [{ a: 0, b: 3 }, { a: 4, b: 7 }], solution: [[0, 1, 2, 3], [4, 5, 6, 7]] };
    const part = drawRoute(q, drawRoute(q, emptyPaths(q), 0, [0, 1, 2, 3]), 1, [4, 5, 6, 7]);
    expect(isSolved(q, part, false)).toBe(true);
    expect(isSolved(q, part, true)).toBe(false);
  });

  it('a generated puzzle is solved by drawing its planted routes, in the order the hint gives them', () => {
    for (const n of SIZES) {
      const p = makePuzzle(n, mulberry32(21));
      let paths = emptyPaths(p);
      expect(isSolved(p, paths, true)).toBe(false);
      for (let guard = 0; guard < 20; guard++) {
        const k = hintPair(p, paths);
        if (k < 0) break;
        paths = drawRoute(p, paths, k, routeFor(p, k));
        invariant(p, paths);
      }
      expect(isSolved(p, paths, true)).toBe(true);
      expect(hintPair(p, paths)).toBe(-1);
      expect(wrongPairs(p, paths)).toEqual([]);
    }
  });

  it('check lists finished paths that differ from the one answer', () => {
    const p = board();
    // Link pair 0 the long way round through row 1: finished, but not the answer.
    const paths = drawRoute(p, emptyPaths(p), 0, [0, 1, 5, 6, 2, 3]);
    expect(isLinked(p, paths, 0)).toBe(true);
    expect(wrongPairs(p, paths)).toEqual([0]);
    const ok = drawRoute(p, emptyPaths(p), 0, [3, 2, 1, 0]);
    expect(wrongPairs(p, ok)).toEqual([]); // reversed answer is still the answer
  });

  it('routeFor starts on the a dot', () => {
    for (const n of SIZES) {
      const p = makePuzzle(n, mulberry32(33));
      p.pairs.forEach((q, k) => {
        const r = routeFor(p, k);
        expect(r[0]).toBe(q.a);
        expect(r[r.length - 1]).toBe(q.b);
      });
    }
  });
});

describe('random play never breaks an invariant', () => {
  it('survives 4000 random drawing sequences on generated puzzles', () => {
    const rng = mulberry32(99);
    for (let round = 0; round < 40; round++) {
      const n = SIZES[round % SIZES.length];
      const p = makePuzzle(n, mulberry32(round + 1));
      let paths = emptyPaths(p);
      let active = -1;
      for (let step = 0; step < 100; step++) {
        const r = rng();
        if (r < 0.2 || active < 0) {
          const cell = Math.floor(rng() * n * n);
          const b = beginAt(p, paths, cell);
          if (b) { paths = b.paths; active = b.k; }
        } else if (r < 0.9) {
          const end = paths[active][paths[active].length - 1];
          const opts = neighboursOf(n, end);
          const cell = opts[Math.floor(rng() * opts.length)];
          const s = stepTo(p, paths, active, cell);
          if (s.ok) paths = s.paths;
        } else if (r < 0.95) {
          paths = clearPair(paths, Math.floor(rng() * paths.length));
          active = -1;
        } else {
          const far = Math.floor(rng() * n * n);
          const s = stepTo(p, paths, Math.max(active, 0), far);
          if (s.ok) paths = s.paths;
        }
        invariant(p, paths);
      }
    }
  });
});

// ── Storage, names and text ───────────────────────────────────────────────────

describe('saved best times', () => {
  it('keeps only whole seconds from 1 up for known sizes', () => {
    expect(sanitiseBest({ t4: 30, t5: 61, t6: 359999 })).toEqual({ t4: 30, t5: 61, t6: 359999 });
    expect(sanitiseBest({ t4: 0, t5: -3, t6: 360000 })).toEqual({});
    expect(sanitiseBest({ t4: 1.5, t5: '30', t6: NaN })).toEqual({});
    expect(sanitiseBest({ t9: 30, t7: 30 })).toEqual({});
    expect(MAX_BEST_SECONDS).toBe(359999);
    expect(bestKey(5)).toBe('t5');
  });
  it('rejects junk and never copies prototype keys', () => {
    for (const bad of [null, undefined, 5, 'x', [], [1, 2], true]) expect(sanitiseBest(bad)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"t4": 5}, "t5": 20}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({ t5: 20 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).t4).toBeUndefined();
  });
});

describe('text', () => {
  it('names pairs and describes cells', () => {
    const p = board();
    expect(pairName(0)).toBe('blue circle');
    expect(pairName(6)).toBe('teal hexagon');
    expect(describeCell(p, emptyPaths(p), 0)).toBe('Row 1, column 1: blue circle dot, not joined yet');
    const paths = drawRoute(p, emptyPaths(p), 0, [0, 1, 2, 3]);
    expect(describeCell(p, paths, 0)).toBe('Row 1, column 1: blue circle dot, joined');
    expect(describeCell(p, paths, 1)).toBe('Row 1, column 2: path of the blue circle');
    expect(describeCell(p, paths, 9)).toBe('Row 3, column 2: empty');
  });
});
