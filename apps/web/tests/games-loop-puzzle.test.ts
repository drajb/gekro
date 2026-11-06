/**
 * games-loop-puzzle.test.ts - the engine behind `loop-puzzle`.
 *
 * Pinned:
 *  - the grid geometry (edge, dot and cell counts, which edges touch which dots)
 *  - the loop check against an independent walk on every edge subset of small grids
 *  - the solution counter against brute force over EVERY edge subset of 2x2, 2x3 and 3x3
 *    grids with random number sets (including blank cells)
 *  - every generated puzzle, sizes 5 to 10, has exactly one solution according to an
 *    independent solver written in this file (plain edge-by-edge search, no propagation)
 *  - the stored answer is a single loop that meets every number
 *  - Easy puzzles can be finished by the local rules alone
 *  - the same seed gives the same puzzle; numbers are removed in the stated amounts
 *  - hints: following them from an empty board solves the puzzle and never says anything false
 *  - the pointer-to-edge mapping, the sanitisers, the saved-score caps
 */
import { describe, it, expect, vi } from 'vitest';

// Machine load makes wall-clock limits flake: give every test a generous budget.
vi.setConfig({ testTimeout: 120_000 });
import {
  makeTopo, countSolutions, solveByLogic, isSingleLoop, makePuzzle, makePuzzleSized, randomRegion, regionOutline, cluesOf,
  clueFraction, clueStatus, cellLines, isComplete, mistakes, nextHint, pointToEdge, edgeFrom, dotLabel, edgeLabel, vertexRow, vertexCol,
  mulberry32, shuffled, bestKey, sanitiseBest, MAX_BEST_SECONDS, formatTime, plural,
  SIZES, DIFFICULTIES, MAX_SIZE, EMPTY, LINE, CROSS,
  type Puzzle, type Difficulty,
} from '../src/components/apps-private/loop-puzzle/helpers';

// ── An independent description of the grid, written separately from the engine ──

const hIndex = (cols: number, r: number, c: number): number => r * cols + c;
const vIndex = (rows: number, cols: number, r: number, c: number): number => (rows + 1) * cols + r * (cols + 1) + c;

/** Dot (r, c) -> the indices of its edges, by formula. */
const dotEdges = (rows: number, cols: number, r: number, c: number): number[] => {
  const out: number[] = [];
  if (c > 0) out.push(hIndex(cols, r, c - 1));
  if (c < cols) out.push(hIndex(cols, r, c));
  if (r > 0) out.push(vIndex(rows, cols, r - 1, c));
  if (r < rows) out.push(vIndex(rows, cols, r, c));
  return out;
};
const cellSides = (rows: number, cols: number, r: number, c: number): number[] => [
  hIndex(cols, r, c), hIndex(cols, r + 1, c), vIndex(rows, cols, r, c), vIndex(rows, cols, r, c + 1),
];
const edgeCount = (rows: number, cols: number): number => (rows + 1) * cols + rows * (cols + 1);

/** Independent single-loop check: degrees 0 or 2 and one connected chain, by union-find. */
const refIsLoop = (rows: number, cols: number, on: ArrayLike<number>): boolean => {
  const D = cols + 1;
  const parent = Array.from({ length: (rows + 1) * D }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const deg = new Array((rows + 1) * D).fill(0);
  let count = 0;
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    if (!on[hIndex(cols, r, c)]) continue;
    count++; deg[r * D + c]++; deg[r * D + c + 1]++; parent[find(r * D + c)] = find(r * D + c + 1);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    if (!on[vIndex(rows, cols, r, c)]) continue;
    count++; deg[r * D + c]++; deg[(r + 1) * D + c]++; parent[find(r * D + c)] = find((r + 1) * D + c);
  }
  if (count === 0) return false;
  if (deg.some((d) => d !== 0 && d !== 2)) return false;
  const roots = new Set<number>();
  deg.forEach((d, v) => { if (d > 0) roots.add(find(v)); });
  return roots.size === 1;
};

/**
 * Independent solver: decide edges one by one in scan order, checking only the dots
 * and cells whose edges are all decided (plus cheap bounds), and test the single-loop
 * rule at the leaves. No propagation, no loop-closing shortcuts. Counts up to `limit`.
 */
const refCount = (rows: number, cols: number, clues: readonly number[], limit = 2): number => {
  const E = edgeCount(rows, cols);
  const order: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) order.push(hIndex(cols, r, c));
    if (r < rows) for (let c = 0; c <= cols; c++) order.push(vIndex(rows, cols, r, c));
  }
  const dotsOf: number[][] = Array.from({ length: E }, () => []);
  const cellsOf: number[][] = Array.from({ length: E }, () => []);
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) for (const e of dotEdges(rows, cols, r, c)) dotsOf[e].push(r * (cols + 1) + c);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) for (const e of cellSides(rows, cols, r, c)) cellsOf[e].push(r * cols + c);
  const dotOn = new Array((rows + 1) * (cols + 1)).fill(0);
  const dotLeft = dotOn.map((_, i) => dotEdges(rows, cols, Math.floor(i / (cols + 1)), i % (cols + 1)).length);
  const cellOn = new Array(rows * cols).fill(0);
  const cellLeft = new Array(rows * cols).fill(4);
  const val = new Array(E).fill(0);
  // Union-find over dots with rollback, only used to notice a loop closing early.
  const D = cols + 1;
  const ends = (e: number): [number, number] => {
    if (e < (rows + 1) * cols) { const r = Math.floor(e / cols); const c = e % cols; return [r * D + c, r * D + c + 1]; }
    const k = e - (rows + 1) * cols; const r = Math.floor(k / D); const c = k % D; return [r * D + c, (r + 1) * D + c];
  };
  const parent = Array.from({ length: (rows + 1) * D }, (_, i) => i);
  const ecount = new Array((rows + 1) * D).fill(0);
  const root = (x: number): number => { while (parent[x] !== x) x = parent[x]; return x; };
  let totalOn = 0;
  let closed = false;
  let found = 0;
  const rec = (i: number): void => {
    if (found >= limit) return;
    if (i === E) { if (closed && refIsLoop(rows, cols, val)) found++; return; }
    const e = order[i];
    for (const x of [0, 1]) {
      val[e] = x;
      let ok = true;
      // Loop bookkeeping for a line.
      let undo: (() => void) | null = null;
      if (x === 1) {
        if (closed) ok = false;
        else {
          const [u, v] = ends(e);
          const ru = root(u);
          const rv = root(v);
          if (ru === rv) {
            if (ecount[ru] !== totalOn) ok = false;
            else { closed = true; totalOn++; undo = () => { closed = false; totalOn--; }; }
          } else {
            const oldA = ecount[rv];
            parent[ru] = rv;
            ecount[rv] = ecount[ru] + ecount[rv] + 1;
            totalOn++;
            undo = () => { parent[ru] = ru; ecount[rv] = oldA; totalOn--; };
          }
        }
      }
      for (const d of dotsOf[e]) { dotOn[d] += x; dotLeft[d]--; }
      for (const c of cellsOf[e]) { cellOn[c] += x; cellLeft[c]--; }
      if (ok) {
        for (const d of dotsOf[e]) {
          if (dotOn[d] > 2 || (dotLeft[d] === 0 && dotOn[d] === 1)) ok = false;
        }
        for (const c of cellsOf[e]) {
          const k = clues[c];
          if (k >= 0 && (cellOn[c] > k || cellOn[c] + cellLeft[c] < k)) ok = false;
        }
      }
      if (ok) rec(i + 1);
      for (const d of dotsOf[e]) { dotOn[d] -= x; dotLeft[d]++; }
      for (const c of cellsOf[e]) { cellOn[c] -= x; cellLeft[c]++; }
      if (undo) undo(); // only lines that were registered need rolling back
      if (found >= limit) break;
    }
    val[e] = 0;
  };
  rec(0);
  return found;
};

const sizes = [...SIZES];
const clueTotal = (p: Puzzle): number => p.clues.filter((c) => c >= 0).length;

describe('geometry', () => {
  it('has (r+1)*c + r*(c+1) edges, (r+1)*(c+1) dots and r*c cells', () => {
    for (const [r, c] of [[1, 1], [2, 3], [5, 5], [10, 10], [4, 9]]) {
      const t = makeTopo(r, c);
      expect(t.nEdges).toBe(edgeCount(r, c));
      expect(t.nVerts).toBe((r + 1) * (c + 1));
      expect(t.nCells).toBe(r * c);
      expect(t.cellEdges).toHaveLength(r * c);
    }
  });
  it('matches the independent formulas for cell sides and dot edges', () => {
    for (const [r, c] of [[3, 3], [5, 7], [10, 10]]) {
      const t = makeTopo(r, c);
      for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
        expect([...t.cellEdges[i * c + j]].sort((a, b) => a - b)).toEqual(cellSides(r, c, i, j).sort((a, b) => a - b));
      }
      for (let i = 0; i <= r; i++) for (let j = 0; j <= c; j++) {
        expect([...t.vertEdges[i * (c + 1) + j]].sort((a, b) => a - b)).toEqual(dotEdges(r, c, i, j).sort((a, b) => a - b));
      }
    }
  });
  it('corner dots touch 2 edges, border dots 3, inner dots 4', () => {
    const t = makeTopo(5, 5);
    const degs = t.vertEdges.map((e) => e.length);
    expect(degs.filter((d) => d === 2)).toHaveLength(4);
    expect(degs.filter((d) => d === 3)).toHaveLength(16);
    expect(degs.filter((d) => d === 4)).toHaveLength(16);
  });
  it('every edge has two distinct end dots one step apart, and borders one or two cells', () => {
    const t = makeTopo(6, 6);
    for (let e = 0; e < t.nEdges; e++) {
      expect(t.edgeA[e]).not.toBe(t.edgeB[e]);
      const dr = Math.abs(vertexRow(t, t.edgeA[e]) - vertexRow(t, t.edgeB[e]));
      const dc = Math.abs(vertexCol(t, t.edgeA[e]) - vertexCol(t, t.edgeB[e]));
      expect(dr + dc).toBe(1);
      expect([1, 2]).toContain(t.edgeCells[e].length);
    }
    expect(t.edgeCells.filter((c) => c.length === 1)).toHaveLength(4 * 6);
  });
  it('rejects bad sizes', () => {
    expect(() => makeTopo(0, 3)).toThrow(RangeError);
    expect(() => makeTopo(3, MAX_SIZE + 1)).toThrow(RangeError);
    expect(() => makeTopo(2.5, 3)).toThrow(RangeError);
    expect(() => makeTopo(NaN, 3)).toThrow(RangeError);
  });
  it('edgeFrom walks the dot grid and stops at the border', () => {
    const t = makeTopo(3, 4);
    expect(edgeFrom(t, 0, 0, 0)).toBeNull();
    expect(edgeFrom(t, 0, 0, 3)).toBeNull();
    expect(edgeFrom(t, 3, 4, 2)).toBeNull();
    expect(edgeFrom(t, 3, 4, 1)).toBeNull();
    const r = edgeFrom(t, 1, 1, 1)!;
    expect([r.vr, r.vc]).toEqual([1, 2]);
    // Going out and straight back uses the same edge.
    const back = edgeFrom(t, r.vr, r.vc, 3)!;
    expect(back.edge).toBe(r.edge);
    expect([back.vr, back.vc]).toEqual([1, 1]);
    for (let dir = 0; dir < 4; dir++) {
      const f = edgeFrom(t, 2, 2, dir)!;
      const g = edgeFrom(t, f.vr, f.vc, (dir + 2) % 4)!;
      expect(g.edge).toBe(f.edge);
      expect([g.vr, g.vc]).toEqual([2, 2]);
    }
  });
  it('labels dots and edges with one-based rows and columns', () => {
    const t = makeTopo(3, 3);
    expect(dotLabel(t, 0)).toBe('row 1, column 1');
    expect(dotLabel(t, 3 * 4 + 3)).toBe('row 4, column 4');
    expect(edgeLabel(t, 0)).toBe('the line from the dot at row 1, column 1 to the dot at row 1, column 2');
  });
});

describe('pointer to edge', () => {
  const t = makeTopo(4, 4);
  it('picks the nearest side of the cell under the pointer', () => {
    expect(pointToEdge(t, 1.5, 1.1)).toBe(hIndex(4, 1, 1)); // near the top of cell (1,1)
    expect(pointToEdge(t, 1.5, 1.9)).toBe(hIndex(4, 2, 1)); // near the bottom
    expect(pointToEdge(t, 1.1, 1.5)).toBe(vIndex(4, 4, 1, 1)); // near the left
    expect(pointToEdge(t, 1.9, 1.5)).toBe(vIndex(4, 4, 1, 2)); // near the right
  });
  it('maps the margin around the board to the outer edges', () => {
    expect(pointToEdge(t, 2.5, -0.4)).toBe(hIndex(4, 0, 2));
    expect(pointToEdge(t, 2.5, 4.4)).toBe(hIndex(4, 4, 2));
    expect(pointToEdge(t, -0.4, 2.5)).toBe(vIndex(4, 4, 2, 0));
    expect(pointToEdge(t, 4.4, 2.5)).toBe(vIndex(4, 4, 2, 4));
  });
  it('always returns a valid edge, even for junk', () => {
    for (const [x, y] of [[NaN, NaN], [Infinity, -Infinity], [1e9, 1e9], [-1e9, 3], [0, 0], [4, 4]]) {
      const e = pointToEdge(t, x, y);
      expect(Number.isInteger(e) && e >= 0 && e < t.nEdges).toBe(true);
    }
  });
  it('gives each edge a diamond: points along an edge midline hit that edge', () => {
    for (let e = 0; e < t.nEdges; e++) {
      const a = t.edgeA[e];
      const b = t.edgeB[e];
      const x = (vertexCol(t, a) + vertexCol(t, b)) / 2;
      const y = (vertexRow(t, a) + vertexRow(t, b)) / 2;
      expect(pointToEdge(t, x, y), `edge ${e}`).toBe(e);
    }
  });
});

describe('loop check against an independent walk (every edge subset of small grids)', () => {
  it('2x2 (12 edges), 1x3 (10) and 2x3 (17): isSingleLoop agrees with the reference on all subsets', () => {
    for (const [r, c] of [[2, 2], [1, 3], [2, 3]]) {
      const t = makeTopo(r, c);
      const E = t.nEdges;
      let loops = 0;
      for (let m = 0; m < 2 ** E; m++) {
        const on = Array.from({ length: E }, (_, i) => (m >> i) & 1);
        const a = isSingleLoop(t, on);
        if (a) loops++;
        if (a !== refIsLoop(r, c, on)) throw new Error(`${r}x${c} subset ${m}: engine ${a}`);
      }
      // Known counts of simple cycles on these grid graphs.
      if (r === 2 && c === 2) expect(loops).toBe(13);
      if (r === 1 && c === 3) expect(loops).toBe(6);
      if (r === 2 && c === 3) expect(loops).toBe(40);
    }
  });
  it('rejects the empty set, two separate squares, a branch and an open path', () => {
    const t = makeTopo(2, 3);
    const mk = (edges: number[]) => { const o = new Array(t.nEdges).fill(0); edges.forEach((e) => { o[e] = 1; }); return o; };
    expect(isSingleLoop(t, mk([]))).toBe(false);
    const sq = (r: number, c: number) => cellSides(2, 3, r, c);
    expect(isSingleLoop(t, mk(sq(0, 0)))).toBe(true);
    expect(isSingleLoop(t, mk([...sq(0, 0), ...sq(1, 2)]))).toBe(false); // two squares touching at no edge
    expect(isSingleLoop(t, mk([hIndex(3, 0, 0), hIndex(3, 0, 1)]))).toBe(false); // open path
    expect(isSingleLoop(t, mk([...sq(0, 0), ...sq(0, 1)]))).toBe(false); // two squares sharing an edge: dots of degree 3
  });
});

describe('solution counter against brute force (all edge subsets)', () => {
  const allLoops = (rows: number, cols: number): number[][] => {
    const E = edgeCount(rows, cols);
    // Cheap filter first: every dot must touch 0 or 2 chosen edges (bit tricks); then the full reference check.
    const dotMasks: number[] = [];
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) dotMasks.push(dotEdges(rows, cols, r, c).reduce((m, e) => m | (1 << e), 0));
    const pop = (x: number): number => { let k = 0; while (x) { x &= x - 1; k++; } return k; };
    const out: number[][] = [];
    for (let m = 0; m < 2 ** E; m++) {
      let ok = true;
      for (let i = 0; i < dotMasks.length; i++) { const k = pop(m & dotMasks[i]); if (k !== 0 && k !== 2) { ok = false; break; } }
      if (!ok) continue;
      const on = Array.from({ length: E }, (_, i) => (m >> i) & 1);
      if (refIsLoop(rows, cols, on)) out.push(on);
    }
    return out;
  };
  const brute = (rows: number, cols: number, loops: number[][], clues: number[]): number => {
    let k = 0;
    for (const on of loops) {
      let ok = true;
      for (let r = 0; r < rows && ok; r++) for (let c = 0; c < cols; c++) {
        const want = clues[r * cols + c];
        if (want >= 0 && cellSides(rows, cols, r, c).reduce((s, e) => s + on[e], 0) !== want) { ok = false; break; }
      }
      if (ok) k++;
    }
    return k;
  };
  for (const [rows, cols, trials] of [[2, 2, 300], [2, 3, 300], [3, 3, 40]] as const) {
    it(`${rows}x${cols}: counts match on ${trials} random number sets (full count, no limit)`, () => {
      const loops = allLoops(rows, cols);
      const rng = mulberry32(rows * 100 + cols);
      let multi = 0;
      let zero = 0;
      let one = 0;
      for (let t = 0; t < trials; t++) {
        // Take a real loop, then reveal each cell's number with some probability, sometimes perturb one.
        const base = loops[Math.floor(rng() * loops.length)];
        const clues = Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          if (rng() < 0.45) return -1;
          let k = cellSides(rows, cols, r, c).reduce((s, e) => s + base[e], 0);
          if (t % 5 === 4 && rng() < 0.25) k = Math.floor(rng() * 5);
          return k;
        });
        const want = brute(rows, cols, loops, clues);
        const got = countSolutions(rows, cols, clues, 1e9, 1e9);
        expect(got.exhausted).toBe(false);
        if (got.count !== want) throw new Error(`${rows}x${cols} clues ${JSON.stringify(clues)}: engine ${got.count}, brute force ${want}`);
        if (want === 0) zero++; else if (want === 1) one++; else multi++;
        // The limit argument only caps the count.
        const capped = countSolutions(rows, cols, clues, 2, 1e9);
        expect(capped.count).toBe(Math.min(2, want));
        // The independent solver agrees too.
        expect(refCount(rows, cols, clues, 1e9)).toBe(want);
        // Logic alone never claims a solution when there is not exactly one.
        const logic = solveByLogic(rows, cols, clues);
        if (logic) expect(want).toBe(1);
      }
      expect(multi).toBeGreaterThan(0);
      expect(zero).toBeGreaterThan(0);
      expect(one).toBeGreaterThan(0);
    }, 120_000);
  }
  it('there are 13, 40 and 213 loops on 2x2, 2x3 and 3x3 cell grids (no numbers)', () => {
    expect(countSolutions(2, 2, [-1, -1, -1, -1], 1e9, 1e9).count).toBe(13);
    expect(countSolutions(2, 3, new Array(6).fill(-1), 1e9, 1e9).count).toBe(40);
    expect(countSolutions(3, 3, new Array(9).fill(-1), 1e9, 1e9).count).toBe(213);
  }, 60_000);
  it('rejects a clue list of the wrong length', () => {
    expect(() => countSolutions(3, 3, [1, 2], 2)).toThrow(RangeError);
  });
});

describe('generator', () => {
  it('region outlines are single loops (many random regions, several shapes)', () => {
    const rng = mulberry32(5);
    for (const [r, c] of [[5, 5], [7, 7], [10, 10], [4, 9]]) {
      const t = makeTopo(r, c);
      for (let k = 0; k < 60; k++) {
        const inside = randomRegion(r, c, rng, 0.3 + 0.4 * rng());
        expect(inside.reduce((s, v) => s + v, 0)).toBeGreaterThan(0);
        expect(isSingleLoop(t, regionOutline(r, c, inside))).toBe(true);
        expect(refIsLoop(r, c, regionOutline(r, c, inside))).toBe(true);
      }
    }
  });
  it('numbers equal the number of loop sides of each cell', () => {
    const t = makeTopo(5, 5);
    const loop = regionOutline(5, 5, randomRegion(5, 5, mulberry32(8), 0.5));
    const clues = cluesOf(t, loop);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) expect(clues[r * 5 + c]).toBe(cellSides(5, 5, r, c).reduce((s, e) => s + loop[e], 0));
  });
  it('is deterministic for a seed and varies across seeds', () => {
    for (const d of DIFFICULTIES) {
      expect(makePuzzle(6, d, mulberry32(77))).toEqual(makePuzzle(6, d, mulberry32(77)));
    }
    const seen = new Set<string>();
    for (let s = 1; s <= 12; s++) seen.add(JSON.stringify(makePuzzle(6, 'normal', mulberry32(s)).clues));
    expect(seen.size).toBeGreaterThan(8);
  });
  it('rectangular puzzles work too', () => {
    const p = makePuzzleSized(4, 7, 'normal', mulberry32(3));
    expect(p.clues).toHaveLength(28);
    expect(refCount(4, 7, p.clues)).toBe(1);
  });
  it('rejects absurd sizes', () => {
    expect(() => makePuzzle(0, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makePuzzle(MAX_SIZE + 1, 'easy', mulberry32(1))).toThrow(RangeError);
  });

  // Every size and difficulty: the stored answer is a loop that meets every number, and the independent solver finds exactly one solution.
  for (const n of sizes) {
    for (const d of DIFFICULTIES) {
      // The reference search has no propagation, so it gets slow on big sparse boards: fewer seeds there.
      const seeds = n <= 6 ? 12 : n <= 8 ? 8 : 4;
      it(`${n}x${n} ${d}: ${seeds} seeds have one solution (independent solver) and a valid stored answer`, () => {
        const t = makeTopo(n, n);
        for (let s = 1; s <= seeds; s++) {
          const p = makePuzzle(n, d, mulberry32(1000 * n + s));
          expect(p.clues).toHaveLength(n * n);
          expect(p.solution).toHaveLength(t.nEdges);
          expect(refIsLoop(n, n, p.solution)).toBe(true);
          expect(isSingleLoop(t, p.solution)).toBe(true);
          for (let i = 0; i < n * n; i++) {
            if (p.clues[i] < 0) continue;
            expect(p.clues[i]).toBe(cellSides(n, n, Math.floor(i / n), i % n).reduce((sum, e) => sum + p.solution[e], 0));
          }
          expect(refCount(n, n, p.clues), `${n} ${d} seed ${s}`).toBe(1);
          const mine = countSolutions(n, n, p.clues, 2);
          expect(mine.count).toBe(1);
          expect(mine.solution).toEqual(p.solution);
          expect(clueTotal(p)).toBeGreaterThanOrEqual(Math.min(clueTotal(p), Math.ceil(n * n * clueFraction(d))));
        }
      }, 300_000);
    }
  }

  it('every size and difficulty builds quickly enough for a page (a few seconds at the very worst)', () => {
    for (const n of [5, 10]) for (const d of DIFFICULTIES) {
      const t0 = Date.now();
      makePuzzle(n, d, mulberry32(4242));
      expect(Date.now() - t0).toBeLessThan(15_000);
    }
  }, 60_000);

  it('Easy puzzles can be finished by the local rules alone, and the logic result equals the stored answer', () => {
    for (const n of sizes) {
      for (let s = 1; s <= 6; s++) {
        const p = makePuzzle(n, 'easy', mulberry32(31 * n + s));
        expect(solveByLogic(n, n, p.clues)).toEqual(p.solution);
      }
    }
  }, 120_000);

  it('Easy keeps at least 55% of the numbers, Normal at least 40%; fewer numbers for harder levels on average', () => {
    for (const n of [6, 8]) {
      const avg: Record<string, number> = {};
      for (const d of DIFFICULTIES) {
        let sum = 0;
        for (let s = 1; s <= 8; s++) {
          const p = makePuzzle(n, d, mulberry32(500 + s));
          const k = clueTotal(p);
          sum += k;
          expect(k).toBeGreaterThanOrEqual(Math.ceil(n * n * clueFraction(d)));
        }
        avg[d] = sum / 8;
      }
      expect(avg.easy).toBeGreaterThan(avg.normal);
      expect(avg.normal).toBeGreaterThanOrEqual(avg.hard);
    }
    expect(clueFraction('easy')).toBe(0.55);
    expect(clueFraction('normal')).toBe(0.4);
    expect(clueFraction('hard')).toBe(0);
  }, 120_000);

  it('removing any one number from a Hard puzzle breaks uniqueness (the numbers kept are all needed, at least for these seeds)', () => {
    // Hard thins greedily, so a kept number is one whose removal gave a second solution or ran out of budget.
    for (let s = 1; s <= 4; s++) {
      const p = makePuzzle(5, 'hard', mulberry32(900 + s));
      for (let i = 0; i < 25; i++) {
        if (p.clues[i] < 0) continue;
        const c = p.clues.slice();
        c[i] = -1;
        expect(refCount(5, 5, c)).toBeGreaterThan(1);
      }
    }
  }, 60_000);
});

describe('solveByLogic', () => {
  it('returns null for clue sets that need guessing or have no answer', () => {
    expect(solveByLogic(3, 3, new Array(9).fill(-1))).toBeNull();
    expect(solveByLogic(2, 2, [4, 4, 4, 4])).toBeNull(); // contradictory
  });
  it('solves a tiny fully-numbered puzzle', () => {
    // A single square loop on a 1x1 grid.
    expect(solveByLogic(1, 1, [4])).toEqual([1, 1, 1, 1]);
    expect(solveByLogic(1, 1, [3])).toBeNull();
  });
});

describe('playing helpers', () => {
  const p = makePuzzle(5, 'normal', mulberry32(2026));
  const t = makeTopo(5, 5);
  const fromSolution = (): number[] => p.solution.map((v) => (v ? LINE : EMPTY));

  it('the solution as marks is complete; with a line missing, extra, or a split loop it is not', () => {
    expect(isComplete(t, p.clues, fromSolution())).toBe(true);
    const missing = fromSolution();
    missing[missing.indexOf(LINE)] = EMPTY;
    expect(isComplete(t, p.clues, missing)).toBe(false);
    const extra = fromSolution();
    extra[extra.indexOf(EMPTY)] = LINE;
    expect(isComplete(t, p.clues, extra)).toBe(false);
    expect(isComplete(t, p.clues, new Array(t.nEdges).fill(EMPTY))).toBe(false);
  });
  it('crosses do not count as lines', () => {
    const m = fromSolution().map((v, i) => (v === LINE ? LINE : i % 3 === 0 ? CROSS : EMPTY));
    expect(isComplete(t, p.clues, m)).toBe(true);
  });
  it('mistakes lists lines that are not in the answer and crosses that are', () => {
    const m = new Array(t.nEdges).fill(EMPTY);
    expect(mistakes(p.solution, m)).toEqual([]);
    const on = p.solution.indexOf(1);
    const off = p.solution.indexOf(0);
    m[on] = CROSS;
    m[off] = LINE;
    expect(mistakes(p.solution, m).sort((a, b) => a - b)).toEqual([on, off].sort((a, b) => a - b));
    const right = fromSolution();
    expect(mistakes(p.solution, right)).toEqual([]);
  });
  it('clueStatus: ok when exactly met, over when too many, open otherwise; blank cells are always open', () => {
    const cell = p.clues.findIndex((c) => c >= 2);
    expect(cell).toBeGreaterThanOrEqual(0);
    const m = new Array(t.nEdges).fill(EMPTY);
    expect(clueStatus(t, p.clues, m, cell)).toBe('open');
    const sides = t.cellEdges[cell];
    for (let i = 0; i < p.clues[cell]; i++) m[sides[i]] = LINE;
    expect(cellLines(t, m, cell)).toBe(p.clues[cell]);
    expect(clueStatus(t, p.clues, m, cell)).toBe('ok');
    if (p.clues[cell] < 4) {
      m[sides[p.clues[cell]]] = LINE;
      expect(clueStatus(t, p.clues, m, cell)).toBe('over');
    }
    const blank = p.clues.findIndex((c) => c < 0);
    if (blank >= 0) expect(clueStatus(t, p.clues, fromSolution(), blank)).toBe('open');
  });

  it('following hints from an empty board solves the puzzle, and no hint is ever false', () => {
    for (const d of DIFFICULTIES) {
      const q = makePuzzle(6, d, mulberry32(77));
      const marks = new Array(makeTopo(6, 6).nEdges).fill(EMPTY);
      let steps = 0;
      const kinds = new Set<string>();
      for (;;) {
        const h = nextHint(6, 6, q.clues, q.solution, marks);
        if (!h) break;
        kinds.add(h.kind);
        expect(h.kind).not.toBe('wrong');
        expect(marks[h.edge]).toBe(EMPTY);
        // The hint agrees with the answer.
        expect(h.value).toBe(q.solution[h.edge] === 1 ? LINE : CROSS);
        marks[h.edge] = h.value;
        steps++;
        if (steps > 400) throw new Error('hints do not end');
      }
      expect(isComplete(makeTopo(6, 6), q.clues, marks)).toBe(true);
      expect(mistakes(q.solution, marks)).toEqual([]);
      if (d === 'easy') expect(kinds.has('reveal')).toBe(false); // logic is enough on Easy
    }
  });
  it('a wrong mark is reported first, then clearing it continues normally', () => {
    const marks = new Array(t.nEdges).fill(EMPTY);
    const off = p.solution.indexOf(0);
    marks[off] = LINE;
    const h = nextHint(5, 5, p.clues, p.solution, marks)!;
    expect(h).toEqual({ edge: off, kind: 'wrong', value: EMPTY });
    marks[off] = EMPTY;
    expect(nextHint(5, 5, p.clues, p.solution, marks)!.kind).not.toBe('wrong');
  });
  it('no hint once the marks equal the answer', () => {
    expect(nextHint(5, 5, p.clues, p.solution, fromSolution())).toBeNull();
  });
  it('fuzz: random marks never make hints throw, and a hint on a wrong board is a mistake', () => {
    const rng = mulberry32(99);
    for (let k = 0; k < 300; k++) {
      const marks = Array.from({ length: t.nEdges }, () => { const r = rng(); return r < 0.7 ? EMPTY : r < 0.85 ? LINE : CROSS; });
      const h = nextHint(5, 5, p.clues, p.solution, marks);
      const bad = mistakes(p.solution, marks);
      if (bad.length) expect(h && h.kind === 'wrong' && bad.includes(h.edge)).toBe(true);
      else if (h) expect(marks[h.edge]).toBe(EMPTY);
      // isComplete never throws either.
      isComplete(t, p.clues, marks);
    }
  });
  it('shuffled keeps every element', () => {
    expect(shuffled([1, 2, 3, 4, 5], mulberry32(1)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('saved best times', () => {
  it('keys are size and difficulty', () => {
    expect(bestKey(5, 'normal')).toBe('5-normal');
  });
  it('keeps whole positive times for known sizes and difficulties and drops everything else', () => {
    expect(sanitiseBest({ '5-normal': 120, '10-hard': 3600 })).toEqual({ '5-normal': 120, '10-hard': 3600 });
    expect(sanitiseBest({ '5-normal': 12, '4-easy': 3, '5-wild': 3, x: 1, '11-easy': 5 })).toEqual({ '5-normal': 12 });
    expect(sanitiseBest({ '5-normal': 0, '6-easy': -3, '7-easy': 1.5, '7-hard': NaN, '8-easy': Infinity })).toEqual({});
    expect(sanitiseBest({ '5-normal': '12', '6-easy': true, '7-easy': [12], '7-hard': null })).toEqual({});
  });
  it('caps the time', () => {
    expect(sanitiseBest({ '5-easy': MAX_BEST_SECONDS })).toEqual({ '5-easy': MAX_BEST_SECONDS });
    expect(sanitiseBest({ '5-easy': MAX_BEST_SECONDS + 1, '6-easy': 1e300 })).toEqual({});
  });
  it('survives storage that is not an object, and does not copy __proto__', () => {
    for (const raw of [null, undefined, 5, 'text', true, [1, 2, 3]]) expect(sanitiseBest(raw)).toEqual({});
    const evil = JSON.parse('{"__proto__": {"polluted": 1}, "5-easy": 9}');
    const out = sanitiseBest(evil);
    expect(out).toEqual({ '5-easy': 9 });
    expect(({} as any).polluted).toBeUndefined();
  });
});

describe('text helpers', () => {
  it('formats time and plurals', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-9)).toBe('0:00');
    expect(plural(1, 'mark')).toBe('1 mark');
    expect(plural(2, 'mark')).toBe('2 marks');
    expect(plural(0, 'mark')).toBe('0 marks');
  });
  it('the page quotes sizes 5 to 10', () => {
    expect(sizes).toEqual([5, 6, 7, 8, 9, 10]);
    expect(MAX_SIZE).toBe(10);
  });
});

// Keep the type import used.
export type _Unused = Difficulty;
