/**
 * games-maze-dash.test.ts - the engine behind `maze-dash`.
 *
 * Pinned:
 *  - every generated maze (all six sizes, many seeds) is perfect: every cell reachable,
 *    n*n - 1 passages, exactly ONE simple route between start and goal (counted by an
 *    independent walk over the open sides, not by the engine's own search)
 *  - passages are symmetric and none leaves the board
 *  - the goal is a farthest cell from the start; the shortest route is the only route
 *  - the same seed gives the same maze; different seeds differ
 *  - steps respect walls; runs stop at walls, forks, dead ends, the goal; hints lead to the flag
 *  - the walked route stays the one simple route from the start however you wander
 *  - the wall outline path matches the open sides exactly (rebuilt cell by cell)
 *  - sanitisers and caps
 */
import { describe, it, expect, vi } from 'vitest';

// Machine load makes wall-clock limits flake: give every test a generous budget.
vi.setConfig({ testTimeout: 120_000 });
import {
  generateMaze, step, canMove, exits, neighbour, distances, shortestPath, runFrom, advanceRoute, hintDirection, goalDirectionWords, swipeDirection,
  wallPath, trailBucket, passageCount, rowOf, colOf, mulberry32, sanitiseBest, MAX_BEST_MOVES, formatTime, plural,
  SIZES, MAX_SIZE, MIN_SIZE, UP, RIGHT, DOWN, LEFT, DR, DC,
  type Maze,
} from '../src/components/apps-private/maze-dash/helpers';

// Independent adjacency, using its own bit values written out here (1 up, 2 right, 4 down, 8 left).
const refNeighbours = (m: Maze, cell: number): number[] => {
  const n = m.n;
  const r = Math.floor(cell / n);
  const c = cell % n;
  const out: number[] = [];
  if (m.open[cell] & 1) out.push((r - 1) * n + c);
  if (m.open[cell] & 2) out.push(r * n + c + 1);
  if (m.open[cell] & 4) out.push((r + 1) * n + c);
  if (m.open[cell] & 8) out.push(r * n + c - 1);
  return out;
};

/** Count simple paths from a to b by depth-first search with a visited-on-path set (fine for a tree). */
const countSimplePaths = (m: Maze, a: number, b: number, cap = 5): number => {
  const onPath = new Uint8Array(m.n * m.n);
  let count = 0;
  const walk = (cur: number): void => {
    if (count >= cap) return;
    if (cur === b) { count++; return; }
    onPath[cur] = 1;
    for (const nx of refNeighbours(m, cur)) if (!onPath[nx]) walk(nx);
    onPath[cur] = 0;
  };
  walk(a);
  return count;
};

const sizes = [...SIZES];

describe('generator: perfect mazes', () => {
  for (const n of sizes) {
    it(`${n}x${n}: 40 seeds are connected trees with one route start to goal`, () => {
      for (let s = 1; s <= 40; s++) {
        const m = generateMaze(n, mulberry32(s * 7919 + n));
        const N = n * n;
        expect(m.open).toHaveLength(N);
        // Symmetric, in bounds, and counted independently.
        let passages = 0;
        for (let cell = 0; cell < N; cell++) {
          const r = Math.floor(cell / n);
          const c = cell % n;
          if (r === 0) expect(m.open[cell] & 1).toBe(0);
          if (c === n - 1) expect(m.open[cell] & 2).toBe(0);
          if (r === n - 1) expect(m.open[cell] & 4).toBe(0);
          if (c === 0) expect(m.open[cell] & 8).toBe(0);
          for (const nx of refNeighbours(m, cell)) {
            expect(refNeighbours(m, nx), `symmetry ${cell}->${nx}`).toContain(cell);
            passages++;
          }
        }
        expect(passages / 2).toBe(N - 1);
        expect(passageCount(m)).toBe(N - 1);
        // Everything is reachable (independent flood fill).
        const seen = new Set<number>([0]);
        const q = [0];
        while (q.length) for (const nx of refNeighbours(m, q.pop()!)) if (!seen.has(nx)) { seen.add(nx); q.push(nx); }
        expect(seen.size).toBe(N);
        // Exactly one simple route between the start and the goal, and between a few other pairs.
        expect(m.start).toBe(0);
        expect(m.goal).not.toBe(m.start);
        expect(countSimplePaths(m, m.start, m.goal)).toBe(1);
        expect(countSimplePaths(m, N - 1, Math.floor(N / 2))).toBe(1);
      }
    });
  }
  it('the goal is a farthest cell from the start', () => {
    for (const n of sizes) {
      for (let s = 1; s <= 10; s++) {
        const m = generateMaze(n, mulberry32(s));
        const d = distances(m, m.start);
        expect(Math.min(...d)).toBe(0);
        expect(d[m.goal]).toBe(Math.max(...d));
        expect(d[m.goal]).toBeGreaterThanOrEqual(n - 1); // at least as far as a straight corridor along one side
      }
    }
  });
  it('is deterministic for a seed and varies across seeds', () => {
    const a = generateMaze(12, mulberry32(5));
    const b = generateMaze(12, mulberry32(5));
    expect(Array.from(a.open)).toEqual(Array.from(b.open));
    expect(a.goal).toBe(b.goal);
    const seen = new Set<string>();
    for (let s = 1; s <= 20; s++) seen.add(Array.from(generateMaze(8, mulberry32(s)).open).join(','));
    expect(seen.size).toBe(20);
  });
  it('rejects absurd sizes and survives the smallest and largest', () => {
    for (const bad of [0, 1, 1.5, NaN, -3, MAX_SIZE + 1, Infinity]) expect(() => generateMaze(bad, mulberry32(1))).toThrow(RangeError);
    expect(generateMaze(MIN_SIZE, mulberry32(1)).open).toHaveLength(4);
    expect(generateMaze(MAX_SIZE, mulberry32(1)).open).toHaveLength(MAX_SIZE * MAX_SIZE);
  });
  it('works with a degenerate rng', () => {
    for (const f of [() => 0, () => 0.999999]) {
      const m = generateMaze(10, f);
      expect(passageCount(m)).toBe(99);
      expect(distances(m, 0).every((v) => v >= 0)).toBe(true);
    }
  });
});

describe('stepping and routes', () => {
  const m = generateMaze(12, mulberry32(21));
  it('step follows passages only, and matches the independent adjacency', () => {
    for (let cell = 0; cell < 144; cell++) {
      const want = refNeighbours(m, cell).sort((x, y) => x - y);
      const got: number[] = [];
      for (let d = 0; d < 4; d++) {
        const nx = step(m, cell, d);
        if (nx >= 0) {
          got.push(nx);
          expect(canMove(m, cell, d)).toBe(true);
          expect(nx).toBe(neighbour(12, cell, d));
        } else expect(canMove(m, cell, d)).toBe(false);
      }
      expect(got.sort((x, y) => x - y)).toEqual(want);
      expect(exits(m, cell).length).toBe(want.length);
    }
  });
  it('canMove and step reject junk input', () => {
    expect(canMove(m, -1, 0)).toBe(false);
    expect(canMove(m, 144, 0)).toBe(false);
    expect(canMove(m, 0, 4)).toBe(false);
    expect(canMove(m, 0, -1)).toBe(false);
    expect(canMove(m, NaN, 1)).toBe(false);
    expect(step(m, 0, UP)).toBe(-1);
    expect(step(m, 0, LEFT)).toBe(-1);
    expect(neighbour(12, 0, UP)).toBe(-1);
    expect(neighbour(12, 143, RIGHT)).toBe(-1);
    expect(neighbour(12, 143, DOWN)).toBe(-1);
  });
  it('row, column and direction offsets agree', () => {
    for (let cell = 0; cell < 144; cell += 7) {
      for (let d = 0; d < 4; d++) {
        const nx = neighbour(12, cell, d);
        if (nx >= 0) {
          expect(rowOf(12, nx)).toBe(rowOf(12, cell) + DR[d]);
          expect(colOf(12, nx)).toBe(colOf(12, cell) + DC[d]);
        }
      }
    }
    expect([UP, RIGHT, DOWN, LEFT]).toEqual([0, 1, 2, 3]);
  });
  it('shortestPath has the BFS length, takes legal steps and is the only route', () => {
    for (const n of [8, 16, 24]) {
      const mm = generateMaze(n, mulberry32(n));
      const d = distances(mm, mm.start);
      const p = shortestPath(mm, mm.start, mm.goal)!;
      expect(p).toHaveLength(d[mm.goal] + 1);
      expect(p[0]).toBe(mm.start);
      expect(p[p.length - 1]).toBe(mm.goal);
      for (let i = 1; i < p.length; i++) expect(refNeighbours(mm, p[i - 1])).toContain(p[i]);
      expect(new Set(p).size).toBe(p.length);
    }
    expect(shortestPath(m, 5, 5)).toEqual([5]);
  });
  it('shortestPath returns null when there is no route (a hand-built walled-off maze)', () => {
    const broken: Maze = { n: 2, open: new Uint8Array([2, 8, 2, 8]), start: 0, goal: 2 };
    expect(shortestPath(broken, 0, 2)).toBeNull();
    expect(hintDirection(broken, 0)).toBe(-1);
  });
});

describe('runs', () => {
  it('stop at walls, forks, dead ends, the start and the goal, and follow plain corners', () => {
    let longest = 0;
    for (const n of [8, 12, 24]) {
      for (let s = 1; s <= 8; s++) {
        const mm = generateMaze(n, mulberry32(s + 100 * n));
        for (let cell = 0; cell < n * n; cell += 3) {
          for (let d = 0; d < 4; d++) {
            const cells = runFrom(mm, cell, d);
            if (!canMove(mm, cell, d)) { expect(cells).toEqual([]); continue; }
            expect(cells.length).toBeGreaterThan(0);
            longest = Math.max(longest, cells.length);
            let prev = cell;
            for (const c of cells) { expect(refNeighbours(mm, prev)).toContain(c); prev = c; }
            // No cell inside the run (except the last) is a fork, dead end, start or goal.
            for (let i = 0; i < cells.length - 1; i++) {
              expect(cells[i]).not.toBe(mm.goal);
              expect(cells[i]).not.toBe(mm.start);
              expect(refNeighbours(mm, cells[i]).length).toBe(2);
            }
            // The last cell is a reason to stop.
            const last = cells[cells.length - 1];
            const deg = refNeighbours(mm, last).length;
            expect(last === mm.goal || last === mm.start || deg !== 2).toBe(true);
            // A run never revisits a cell.
            expect(new Set(cells).size).toBe(cells.length);
          }
        }
      }
    }
    expect(longest).toBeGreaterThan(3);
  });
  it('a run that ends with a legal step can always be undone by walking back', () => {
    const mm = generateMaze(16, mulberry32(3));
    const cells = runFrom(mm, mm.start, exits(mm, mm.start)[0]);
    let route: number[] = [mm.start];
    for (const c of cells) route = advanceRoute(route, c);
    for (let i = cells.length - 2; i >= 0; i--) route = advanceRoute(route, cells[i]);
    route = advanceRoute(route, mm.start);
    expect(route).toEqual([mm.start]);
  });
});

describe('the walked route', () => {
  it('stays the one simple route from the start to where you are, over random wandering', () => {
    for (const n of [8, 16]) {
      const mm = generateMaze(n, mulberry32(n * 3));
      const rng = mulberry32(99);
      let route = [mm.start];
      let pos = mm.start;
      for (let t = 0; t < 3000; t++) {
        const ex = exits(mm, pos);
        const d = ex[Math.floor(rng() * ex.length)];
        pos = step(mm, pos, d);
        expect(pos).toBeGreaterThanOrEqual(0);
        route = advanceRoute(route, pos);
        expect(route[route.length - 1]).toBe(pos);
        expect(new Set(route).size).toBe(route.length);
        if (t % 50 === 0) expect(route).toEqual(shortestPath(mm, mm.start, pos));
      }
    }
  });
  it('advanceRoute does not modify its input', () => {
    const r = [0, 1, 2];
    advanceRoute(r, 1);
    advanceRoute(r, 3);
    expect(r).toEqual([0, 1, 2]);
  });
});

describe('hints', () => {
  it('following the hint from anywhere reaches the flag in exactly the distance', () => {
    const mm = generateMaze(16, mulberry32(7));
    const toGoal = distances(mm, mm.goal);
    for (let cell = 0; cell < 256; cell += 5) {
      let cur = cell;
      let steps = 0;
      while (cur !== mm.goal) {
        const d = hintDirection(mm, cur);
        expect(d).toBeGreaterThanOrEqual(0);
        cur = step(mm, cur, d);
        expect(cur).toBeGreaterThanOrEqual(0);
        if (++steps > 600) throw new Error('hint loop');
      }
      expect(steps).toBe(toGoal[cell]);
    }
    expect(hintDirection(mm, mm.goal)).toBe(-1);
  });
  it('describes where the flag is in plain words', () => {
    const mm: Maze = { n: 8, open: new Uint8Array(64), start: 0, goal: 63 };
    expect(goalDirectionWords(mm, 0)).toBe('The flag is down and to the right.');
    expect(goalDirectionWords(mm, 63)).toBe('You are on the flag.');
    expect(goalDirectionWords(mm, 7)).toBe('The flag is down.');
    expect(goalDirectionWords(mm, 56)).toBe('The flag is right.');
    expect(goalDirectionWords({ ...mm, goal: 0 }, 63)).toBe('The flag is up and to the left.');
  });
});

describe('swipes', () => {
  it('map to the dominant axis and ignore short or junk movements', () => {
    expect(swipeDirection(50, 5)).toBe(RIGHT);
    expect(swipeDirection(-50, 5)).toBe(LEFT);
    expect(swipeDirection(5, 50)).toBe(DOWN);
    expect(swipeDirection(5, -50)).toBe(UP);
    expect(swipeDirection(10, 10)).toBe(-1);
    expect(swipeDirection(NaN, 50)).toBe(-1);
    expect(swipeDirection(Infinity, 0)).toBe(-1);
    expect(swipeDirection(30, 0, 40)).toBe(-1);
  });
});

describe('wall outline', () => {
  /** Expand an SVG path made of "M x yH x2" and "M x yV y2" runs into the unit segments it covers. */
  const segments = (d: string, unit: number): Set<string> => {
    const set = new Set<string>();
    const re = /M(\d+) (\d+)([HV])(\d+)/g;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(d))) {
      const x = Number(mt[1]) / unit, y = Number(mt[2]) / unit, end = Number(mt[4]) / unit;
      if (mt[3] === 'H') for (let k = x; k < end; k++) set.add(`H${k},${y}`);
      else for (let k = y; k < end; k++) set.add(`V${x},${k}`);
    }
    return set;
  };
  it('has exactly the walls the open sides imply: border plus every closed side between cells', () => {
    for (const n of [2, 8, 12, 24]) {
      const mm = generateMaze(n, mulberry32(n));
      const got = segments(wallPath(mm, 100), 100);
      const want = new Set<string>();
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cell = r * n + c;
          if (r === 0 || !(mm.open[cell] & 1)) want.add(`H${c},${r}`);
          if (r === n - 1) want.add(`H${c},${n}`);
          if (c === 0 || !(mm.open[cell] & 8)) want.add(`V${c},${r}`);
          if (c === n - 1) want.add(`V${n},${r}`);
        }
      }
      expect(got).toEqual(want);
      expect(got.size).toBe(4 * n + (n - 1) ** 2); // border plus (n-1)^2 inner walls in a perfect maze
    }
  });
  it('merges runs: far fewer path pieces than wall segments on a big maze', () => {
    const mm = generateMaze(24, mulberry32(1));
    const pieces = (wallPath(mm).match(/M/g) ?? []).length;
    expect(pieces).toBeLessThan(4 * 24 + 23 * 23);
  });
  it('scales with the unit', () => {
    const mm = generateMaze(8, mulberry32(2));
    expect(segments(wallPath(mm, 10), 10)).toEqual(segments(wallPath(mm, 100), 100));
  });
});

describe('trail colours', () => {
  it('buckets run from 0 to 7 and survive junk', () => {
    expect(trailBucket(0, 50)).toBe(0);
    expect(trailBucket(50, 50)).toBe(7);
    expect(trailBucket(25, 50)).toBe(4);
    expect(trailBucket(9999, 50)).toBe(7);
    expect(trailBucket(-3, 50)).toBe(0);
    expect(trailBucket(NaN, 50)).toBe(0);
    expect(trailBucket(5, 0)).toBe(0);
    expect(trailBucket(5, Infinity)).toBe(0);
  });
});

describe('fuzz: random legal play never breaks an invariant', () => {
  it('3000 random moves, steps and runs on every size', () => {
    for (const n of sizes) {
      const mm = generateMaze(n, mulberry32(n + 1));
      const rng = mulberry32(n);
      let pos = mm.start;
      let route = [pos];
      for (let t = 0; t < 3000; t++) {
        const d = Math.floor(rng() * 4);
        const cells = rng() < 0.5 ? runFrom(mm, pos, d) : (step(mm, pos, d) >= 0 ? [step(mm, pos, d)] : []);
        for (const c of cells) {
          expect(refNeighbours(mm, pos)).toContain(c);
          pos = c;
          route = advanceRoute(route, c);
        }
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(n * n);
      }
      expect(route).toEqual(shortestPath(mm, mm.start, pos));
    }
  });
});

describe('saved bests and text', () => {
  it('keeps whole positive move counts for the known sizes only', () => {
    expect(sanitiseBest({ '8': 40, '24': 200 })).toEqual({ '8': 40, '24': 200 });
    expect(sanitiseBest({ '8': 40, '9': 3, x: 1, '30': 4 })).toEqual({ '8': 40 });
    expect(sanitiseBest({ '8': 0, '10': -3, '12': 1.5, '16': NaN, '20': Infinity })).toEqual({});
    expect(sanitiseBest({ '8': '12', '10': true, '12': [3], '16': null })).toEqual({});
    expect(sanitiseBest({ '8': MAX_BEST_MOVES })).toEqual({ '8': MAX_BEST_MOVES });
    expect(sanitiseBest({ '8': MAX_BEST_MOVES + 1 })).toEqual({});
    for (const raw of [null, undefined, 5, 'text', true, [1, 2]]) expect(sanitiseBest(raw)).toEqual({});
    const out = sanitiseBest(JSON.parse('{"__proto__": {"polluted": 1}, "8": 9}'));
    expect(out).toEqual({ '8': 9 });
    expect(({} as any).polluted).toBeUndefined();
  });
  it('formats time and plurals', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(-1)).toBe('0:00');
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
  });
  it('the page quotes sizes 8 to 24', () => {
    expect(sizes).toEqual([8, 10, 12, 16, 20, 24]);
  });
});
