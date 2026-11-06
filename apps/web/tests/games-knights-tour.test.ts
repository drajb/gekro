/**
 * games-knights-tour.test.ts - the engine behind `knights-tour`.
 *
 * Pinned: knight moves against a coordinate model and the 4(n-1)(n-2) count of moves on the board; which
 * squares a tour can start on (every square on 6 by 6 and 8 by 8; on 5 by 5 and 7 by 7 only the squares of
 * the corners' shade) with an exhaustive count of all 1728 tours on 5 by 5 as the oracle; the hint rule
 * (fewest onward moves) and the claim that following it finishes a tour from every square of 6 by 6 and
 * 8 by 8 (so from all four corners), from all 13 usable squares of 5 by 5 and 15 of the 25 on 7 by 7;
 * the doomed-position check, which must never say "doomed" about a position that has a completion
 * (checked against a plain search over thousands of random half-finished tours); the tour search against
 * that plain search; the node limit; the sanitisers; and the words.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_N, MAX_N, DEFAULT_N, SEARCH_LIMIT,
  cleanN, rowOf, colOf, cellName, isCell, knightTable, knightMoves, isKnightMove, shadeOf, startPossible, validPath, isComplete,
  legalNext, onwardCount, hintNext, hintWalk, isDoomed, findTour, squaresText, movesText, describeStep, describeDone, describeStuck, shareText,
} from '../src/components/apps-private/knights-tour/helpers';

// ── Independent oracles (coordinates and plain recursion, nothing shared with the engine) ──

const modelMoves = (n: number, i: number): number[] => {
  const out: number[] = [];
  const r = Math.floor(i / n);
  const c = i % n;
  for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) {
    const dr = Math.abs(rr - r);
    const dc = Math.abs(cc - c);
    if (dr * dc === 2) out.push(rr * n + cc);
  }
  return out;
};

/** Number of complete tours that continue the path, counting every one (plain recursion). Gives up at `cap` nodes (returns -1). */
const oracleCount = (n: number, path: number[], cap = Infinity, stopAtFirst = false): number => {
  const adj = Array.from({ length: n * n }, (_, i) => modelMoves(n, i));
  const seen = new Array<boolean>(n * n).fill(false);
  for (const c of path) seen[c] = true;
  let nodes = 0;
  let count = 0;
  let blown = false;
  const rec = (at: number, len: number): void => {
    if (blown) return;
    if (len === n * n) { count++; return; }
    for (const nx of adj[at]) {
      if (seen[nx]) continue;
      if (++nodes > cap) { blown = true; return; }
      seen[nx] = true;
      rec(nx, len + 1);
      seen[nx] = false;
      if (stopAtFirst && count > 0) return;
      if (blown) return;
    }
  };
  rec(path[path.length - 1], path.length);
  return blown ? -1 : count;
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A random half-finished tour: a random walk of up to `steps` knight moves over unvisited squares. */
const randomWalk = (n: number, steps: number, rng: () => number): number[] => {
  const start = Math.floor(rng() * n * n);
  const path = [start];
  const seen = new Set(path);
  for (let k = 0; k < steps; k++) {
    const opts = modelMoves(n, path[path.length - 1]).filter((c) => !seen.has(c));
    if (!opts.length) break;
    const pick = opts[Math.floor(rng() * opts.length)];
    path.push(pick);
    seen.add(pick);
  }
  return path;
};

describe('the board and the knight', () => {
  it('has sizes 5 to 8, default 6', () => {
    expect(MIN_N).toBe(5);
    expect(MAX_N).toBe(8);
    expect(DEFAULT_N).toBe(6);
  });

  it('moves like a knight: the same squares as a coordinate model on every board, and 4(n-1)(n-2) jumps in all', () => {
    for (let n = 5; n <= 8; n++) {
      let degrees = 0;
      for (let i = 0; i < n * n; i++) {
        expect(Array.from(knightMoves(n, i)), `n=${n} i=${i}`).toEqual(modelMoves(n, i));
        degrees += knightMoves(n, i).length;
        for (const j of knightMoves(n, i)) expect(knightMoves(n, j)).toContain(i);
      }
      expect(degrees / 2, `n=${n}`).toBe(4 * (n - 1) * (n - 2));
    }
    // 8 by 8: corners have 2 moves, the middle squares have 8.
    expect(knightMoves(8, 0)).toHaveLength(2);
    expect(knightMoves(8, 63)).toHaveLength(2);
    expect(knightMoves(8, 27)).toHaveLength(8);
    expect(knightMoves(8, 9)).toHaveLength(4);
    expect(isKnightMove(8, 0, 10)).toBe(true);
    expect(isKnightMove(8, 0, 9)).toBe(false);
    expect(isKnightMove(8, 0, 0)).toBe(false);
    expect(isKnightMove(8, 0, 64)).toBe(false);
    expect(knightTable(4)).toEqual([]);
    expect(knightMoves(3, 0)).toEqual([]);
    expect(knightMoves(8, -1)).toEqual([]);
    expect(knightMoves(8, 1.5)).toEqual([]);
  });

  it('names cells with 1-based row and column and says which shade a square has (corners are shade 0)', () => {
    expect(cellName(8, 0)).toBe('row 1, column 1');
    expect(cellName(6, 35)).toBe('row 6, column 6');
    expect(rowOf(6, 35)).toBe(5);
    expect(colOf(6, 35)).toBe(5);
    for (let n = 5; n <= 8; n++) for (const corner of [0, n - 1, n * (n - 1), n * n - 1]) {
      if (n % 2 === 1) expect(shadeOf(n, corner)).toBe(0);
    }
    expect(shadeOf(8, 1)).toBe(1);
  });
});

describe('where a tour can start', () => {
  it('every square on an even board; the corners\' shade only on an odd board', () => {
    for (const n of [6, 8]) for (let i = 0; i < n * n; i++) expect(startPossible(n, i)).toBe(true);
    for (const n of [5, 7]) {
      let count = 0;
      for (let i = 0; i < n * n; i++) {
        expect(startPossible(n, i)).toBe(shadeOf(n, i) === 0);
        if (startPossible(n, i)) count++;
      }
      expect(count).toBe((n * n + 1) / 2);
    }
    expect(startPossible(8, 64)).toBe(false);
    expect(startPossible(8, -1)).toBe(false);
  });

  it('5 by 5 has exactly 1728 tours (counted by plain recursion), from the 13 squares of the corners\' shade and from no other', () => {
    let total = 0;
    for (let s = 0; s < 25; s++) {
      const k = oracleCount(5, [s]);
      total += k;
      expect(k > 0, `start ${s}`).toBe(startPossible(5, s));
      // The engine agrees about whether a tour exists, and finds one when it does.
      const r = findTour(5, [s]);
      expect(r.status, `start ${s}`).toBe(k > 0 ? 'found' : 'none');
      if (k > 0) { expect(validPath(5, r.path)).toBe(true); expect(isComplete(5, r.path)).toBe(true); expect(r.path[0]).toBe(s); }
    }
    expect(total).toBe(1728);
  }, 120_000);

  it('the engine finds a tour from every legal start on 6 by 6, 7 by 7 and 8 by 8, and says none exists from the other 7 by 7 squares', () => {
    for (const n of [6, 7, 8]) {
      for (let s = 0; s < n * n; s++) {
        const r = findTour(n, [s]);
        if (startPossible(n, s)) {
          expect(r.status, `n=${n} s=${s}`).toBe('found');
          expect(r.path).toHaveLength(n * n);
          expect(validPath(n, r.path)).toBe(true);
          expect(r.path[0]).toBe(s);
          expect(r.nodes).toBeLessThan(SEARCH_LIMIT);
        } else {
          expect(r.status, `n=${n} s=${s}`).toBe('none');
          expect(r.nodes).toBe(0); // the shade count settles it with no search
        }
      }
    }
  }, 120_000);
});

describe('the hint (fewest onward moves first)', () => {
  it('is always a legal next square with the fewest onward moves among the legal ones, in 600 random half-finished tours', () => {
    const rng = mulberry32(3);
    for (let t = 0; t < 600; t++) {
      const n = 5 + Math.floor(rng() * 4);
      const path = randomWalk(n, Math.floor(rng() * (n * n)), rng);
      const legal = legalNext(n, path);
      const h = hintNext(n, path);
      if (!legal.length) { expect(h).toBeNull(); continue; }
      expect(legal).toContain(h);
      const seen = new Set(path);
      const deg = (c: number): number => modelMoves(n, c).filter((x) => !seen.has(x)).length;
      const best = Math.min(...legal.map(deg));
      expect(deg(h as number)).toBe(best);
      expect(onwardCount(n, path, h as number)).toBe(best);
    }
  });

  it('following the hint finishes a tour from all four corners of 8 by 8, and from every square of 6 by 6 and 8 by 8', () => {
    for (const s of [0, 7, 56, 63]) {
      const w = hintWalk(8, s);
      expect(w, `corner ${s}`).toHaveLength(64);
      expect(validPath(8, w)).toBe(true);
    }
    for (const n of [6, 8]) for (let s = 0; s < n * n; s++) expect(hintWalk(n, s), `n=${n} s=${s}`).toHaveLength(n * n);
  });

  it('pins how many starts the rule alone finishes: 13 of 13 usable squares on 5 by 5, 15 of 25 on 7 by 7 (the search takes over for the rest)', () => {
    const done = (n: number): number => { let k = 0; for (let s = 0; s < n * n; s++) if (hintWalk(n, s).length === n * n) k++; return k; };
    expect(done(5)).toBe(13);
    expect(done(7)).toBe(15);
    // Never finishes from a square where no tour exists.
    for (const n of [5, 7]) for (let s = 0; s < n * n; s++) if (!startPossible(n, s)) expect(hintWalk(n, s).length).toBeLessThan(n * n);
  });

  it('has no hint when the knight is stuck, or for a bad path', () => {
    // 5 by 5: walk a path that traps the knight in a corner region.
    const stuck = hintWalk(7, 1); // an unusable start: the walk ends before the board is full
    expect(stuck.length).toBeLessThan(49);
    expect(hintNext(7, stuck)).toBeNull();
    expect(legalNext(7, stuck)).toEqual([]);
    expect(hintNext(8, [])).toBeNull();
    expect(legalNext(8, [])).toEqual([]);
    expect(hintWalk(8, 99)).toEqual([]);
  });
});

describe('the doomed check never condemns a position that can be finished', () => {
  it('on 5 by 5 and 6 by 6, in thousands of random half-finished tours: doomed always means no completion exists', () => {
    const rng = mulberry32(2026);
    let doomed = 0;
    let finishable = 0;
    let checked = 0;
    let skipped = 0;
    for (let t = 0; t < 3000; t++) {
      const n = rng() < 0.5 ? 5 : 6;
      const steps = Math.floor(rng() * (n * n));
      const path = randomWalk(n, steps, rng);
      const d = isDoomed(n, path);
      const k = oracleCount(n, path, 400000, true);
      if (k < 0) { skipped++; continue; } // too big for the plain search to settle: leave it out
      checked++;
      if (d) { doomed++; expect(k, `n=${n} path=${path}`).toBe(0); } else if (k > 0) finishable++;
    }
    expect(checked).toBeGreaterThan(2000);
    expect(doomed).toBeGreaterThan(300); // it is not a check that never fires
    expect(finishable).toBeGreaterThan(100);
    expect(skipped).toBeLessThan(1000);
  }, 240_000);

  it('knows the plain dead ends: stuck knight, a square no one can reach, and shades that do not add up', () => {
    // A knight with no unvisited square to go to and squares left.
    const stuck = hintWalk(7, 1);
    expect(isDoomed(7, stuck)).toBe(true);
    // A start on the wrong shade of an odd board.
    expect(isDoomed(7, [1])).toBe(true);
    expect(isDoomed(5, [1])).toBe(true);
    expect(isDoomed(5, [0])).toBe(false);
    expect(isDoomed(8, [0])).toBe(false);
    // A complete tour is not doomed; junk is.
    const full = hintWalk(8, 0);
    expect(isDoomed(8, full)).toBe(false);
    expect(isDoomed(8, [0, 1])).toBe(true); // not a knight move
    expect(isDoomed(8, [])).toBe(true);
  });
});

describe('the tour search', () => {
  it('agrees with a plain search on 5 by 5: found exactly when some tour continues the path, and the tour keeps the path', () => {
    const rng = mulberry32(17);
    let found = 0;
    let none = 0;
    for (let t = 0; t < 400; t++) {
      const path = randomWalk(5, Math.floor(rng() * 14), rng);
      const k = oracleCount(5, path, 3000000, true);
      if (k < 0) continue;
      const r = findTour(5, path);
      expect(r.status, `path=${path}`).toBe(k > 0 ? 'found' : 'none');
      if (r.status === 'found') {
        found++;
        expect(r.path).toHaveLength(25);
        expect(validPath(5, r.path)).toBe(true);
        expect(r.path.slice(0, path.length)).toEqual(path);
      } else none++;
    }
    expect(found).toBeGreaterThan(50);
    expect(none).toBeGreaterThan(50);
  }, 240_000);

  it('continues from the middle of a tour on 8 by 8 and keeps what was played', () => {
    const rng = mulberry32(8);
    for (let t = 0; t < 12; t++) {
      const path = hintWalk(8, Math.floor(rng() * 64)).slice(0, 10 + Math.floor(rng() * 30));
      const r = findTour(8, path);
      expect(r.status).toBe('found');
      expect(r.path.slice(0, path.length)).toEqual(path);
      expect(validPath(8, r.path)).toBe(true);
      expect(isComplete(8, r.path)).toBe(true);
    }
  }, 120_000);

  it('stops at the node limit and says so; a complete or invalid path is handled', () => {
    expect(SEARCH_LIMIT).toBe(300000);
    // A start the hint walk gets stuck on forces some backtracking on 7 by 7, so a limit of 5 nodes is not enough.
    const first = [0];
    const tiny = findTour(7, first, 5);
    expect(['limit', 'found']).toContain(tiny.status);
    const t2 = findTour(8, [0], 1);
    expect(t2.status).toBe('limit');
    expect(t2.path).toEqual([]);
    expect(t2.nodes).toBeGreaterThan(0);
    const full = hintWalk(8, 0);
    expect(findTour(8, full)).toEqual({ status: 'found', path: full, nodes: 0 });
    expect(findTour(8, [0, 1]).status).toBe('none');
    expect(findTour(8, []).status).toBe('none');
    expect(findTour(8, [0], NaN).status).toBe('found'); // a junk limit falls back to the default
  });

  it('is fast: all 64 starts on 8 by 8 together take well under a few seconds', () => {
    const t0 = performance.now();
    for (let s = 0; s < 64; s++) findTour(8, [s]);
    expect(performance.now() - t0).toBeLessThan(20000);
  }, 60_000);
});

describe('input cleaning', () => {
  it('cleanN accepts 5 to 8 as numbers or one digit and falls back otherwise', () => {
    for (let n = 5; n <= 8; n++) { expect(cleanN(n)).toBe(n); expect(cleanN(String(n))).toBe(n); }
    for (const junk of [4, 9, 0, -6, 6.5, NaN, Infinity, '', ' 6', '6.0', '06', '66', 'x', '__proto__', null, undefined, true, [], {}, [6]]) {
      expect(cleanN(junk), String(junk)).toBe(6);
    }
    expect(cleanN('q', 8)).toBe(8);
  });
  it('validPath wants cells on the board, all different, each a knight move from the last', () => {
    expect(validPath(8, [0])).toBe(true);
    expect(validPath(8, [0, 10, 4])).toBe(true);
    expect(validPath(8, [0, 10, 0])).toBe(false);
    expect(validPath(8, [0, 1])).toBe(false);
    expect(validPath(8, [64])).toBe(false);
    expect(validPath(8, [-1])).toBe(false);
    expect(validPath(8, [1.5])).toBe(false);
    expect(validPath(8, ['0'])).toBe(false);
    expect(validPath(8, [])).toBe(false);
    expect(validPath(8, 'x')).toBe(false);
    expect(validPath(8, null)).toBe(false);
    expect(validPath(8, { length: 1, 0: 0 })).toBe(false);
    expect(validPath(5, Array.from({ length: 26 }, (_, i) => i))).toBe(false);
    expect(isCell(5, 24)).toBe(true);
    expect(isCell(5, 25)).toBe(false);
  });
});

describe('words', () => {
  it('pluralises and describes', () => {
    expect(squaresText(1)).toBe('1 square');
    expect(squaresText(2)).toBe('2 squares');
    expect(movesText(1)).toBe('1 move');
    expect(movesText(35)).toBe('35 moves');
    expect(describeStep(6, 8, 2)).toBe('Knight to row 2, column 3. 2 of 36 squares visited.');
    expect(describeDone(6)).toBe('Tour complete: the knight visited all 36 squares once, in 35 moves.');
    expect(describeStuck(6, 20)).toBe('The knight is stuck after 20 squares of 36: every square it can reach has been visited. Undo to try another route.');
    expect(describeStuck(5, 1)).toContain('1 square of 25');
    expect(shareText(6, 36, false)).toBe("Knight's Tour 6x6 - complete");
    expect(shareText(6, 36, true)).toBe("Knight's Tour 6x6 - complete with help");
    expect(shareText(6, 12, false)).toBe("Knight's Tour 6x6 - 12 of 36 squares");
  });
});
