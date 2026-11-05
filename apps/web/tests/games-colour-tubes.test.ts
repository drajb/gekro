/**
 * games-colour-tubes.test.ts - the engine behind `colour-tubes`.
 *
 * Pinned: the pour rule against a naive one-layer-at-a-time model, solved
 * detection, that every generated level is valid (4 layers of each colour,
 * never already solved, no finished tube, well mixed), solvable (the stored
 * solution replays to a solved state AND an independent breadth-first search
 * agrees), deterministic by seed, that the hint search agrees with exhaustive
 * search on small random positions (solved versus no solution), that every
 * hint move is legal, and the sanitisers.
 */
import { describe, it, expect } from 'vitest';
import {
  CAP, MIN_COLOURS, MAX_COLOURS, START_EMPTY, MAX_EXTRA, COLOUR_NAMES, SHAPE_NAMES, PATTERN_NAMES, tubeCount, mulberry32, clampColours,
  cloneTubes, topColour, topRun, room, isTubeDone, isSolved, runsIn, mixedTubes, touchingPairs, CANDIDATES, pourCount, pourProblem, pour, legalPours, isStuck, colourCounts,
  isValidTubes, solvedTubes, makeLevel, playPours, canonicalKey, solve, bestKey, sanitiseBest, MAX_BEST_MOVES, plural, describeTube, pourMessage,
  type Tubes,
} from '../src/components/apps-private/colour-tubes/helpers';

const t = (...rows: string[]): Tubes => rows.map((r) => (r === '.' ? [] : r.split('').map(Number)));

/** Naive model: move layers one at a time while the rule still allows it. Returns null when the first layer cannot move. */
const naivePour = (tubes: Tubes, from: number, to: number): Tubes | null => {
  if (from === to) return null;
  const out = tubes.map((x) => x.slice());
  const colour = out[from].length ? out[from][out[from].length - 1] : -1;
  let moved = 0;
  while (out[from].length && out[from][out[from].length - 1] === colour && out[to].length < CAP && (out[to].length === 0 || out[to][out[to].length - 1] === colour)) {
    out[to].push(out[from].pop()!);
    moved++;
  }
  return moved ? out : null;
};

/** Independent exhaustive search: is any solved position reachable? Breadth first over sorted-tube keys. */
const bfsSolvable = (start: Tubes, cap = 2_000_000): { solvable: boolean; depth: number } => {
  const solvedKey = (x: Tubes) => x.every((tube) => tube.length === 0 || (tube.length === CAP && tube.every((c) => c === tube[0])));
  if (solvedKey(start)) return { solvable: true, depth: 0 };
  const key = (x: Tubes) => x.map((tube) => tube.join('')).sort().join('|');
  let frontier: Tubes[] = [start];
  const seen = new Set<string>([key(start)]);
  let depth = 0;
  while (frontier.length) {
    depth++;
    const nextFrontier: Tubes[] = [];
    for (const s of frontier) {
      for (let a = 0; a < s.length; a++) {
        for (let b = 0; b < s.length; b++) {
          const n = naivePour(s, a, b);
          if (!n) continue;
          const k = key(n);
          if (seen.has(k)) continue;
          seen.add(k);
          if (solvedKey(n)) return { solvable: true, depth };
          nextFrontier.push(n);
        }
      }
    }
    if (seen.size > cap) throw new Error('search space too large for the test');
    frontier = nextFrontier;
  }
  return { solvable: false, depth };
};

describe('constants and tables', () => {
  it('are what the page says', () => {
    expect(CAP).toBe(4);
    expect(MIN_COLOURS).toBe(3);
    expect(MAX_COLOURS).toBe(8);
    expect(START_EMPTY).toBe(2);
    expect(MAX_EXTRA).toBe(1);
    expect(tubeCount(3)).toBe(5);
    expect(tubeCount(8)).toBe(10);
    expect(COLOUR_NAMES).toHaveLength(8);
    expect(new Set(COLOUR_NAMES).size).toBe(8);
    expect(new Set(SHAPE_NAMES).size).toBe(8);
    expect(new Set(PATTERN_NAMES).size).toBe(8);
  });
});

describe('reading a tube', () => {
  it('finds the top colour and run', () => {
    expect(topColour([])).toBe(-1);
    expect(topRun([])).toBe(0);
    expect(topColour([0, 1, 1])).toBe(1);
    expect(topRun([0, 1, 1])).toBe(2);
    expect(topRun([2, 2, 2, 2])).toBe(4);
    expect(topRun([0, 1, 0])).toBe(1);
    expect(room([0, 1])).toBe(2);
    expect(room([])).toBe(4);
  });
  it('counts runs and mixed tubes', () => {
    expect(runsIn([])).toBe(0);
    expect(runsIn([1, 1, 1, 1])).toBe(1);
    expect(runsIn([0, 1, 1, 0])).toBe(3);
    expect(mixedTubes(t('0011', '2222', '.'))).toBe(1);
  });
  it('a finished tube is full and one colour', () => {
    expect(isTubeDone([1, 1, 1, 1])).toBe(true);
    expect(isTubeDone([1, 1, 1])).toBe(false);
    expect(isTubeDone([1, 1, 1, 2])).toBe(false);
    expect(isTubeDone([])).toBe(false);
  });
});

describe('solved detection', () => {
  it('accepts full one-colour tubes plus empties and nothing else', () => {
    expect(isSolved(t('0000', '1111', '.', '.'))).toBe(true);
    expect(isSolved(solvedTubes(5))).toBe(true);
    expect(isSolved(t('0000', '111', '1', '.'))).toBe(false); // one colour split over two tubes
    expect(isSolved(t('0001', '1110', '.', '.'))).toBe(false);
    expect(isSolved(t('000', '111', '.'))).toBe(false); // not full
  });
  it('solvedTubes has k full tubes and the empties', () => {
    for (let k = MIN_COLOURS; k <= MAX_COLOURS; k++) {
      const s = solvedTubes(k);
      expect(s).toHaveLength(k + START_EMPTY);
      expect(isValidTubes(s, k)).toBe(true);
    }
  });
});

describe('the pour rule', () => {
  it('moves the whole top run, limited by room', () => {
    expect(pour(t('0011', '01', '.'), 0, 1)).toEqual(t('00', '0111', '.'));
    expect(pourCount(t('0011', '10', '.'), 0, 1)).toBe(0); // top of tube 2 is 0, not 1
    expect(pourCount(t('0011', '01', '.'), 0, 1)).toBe(2);
    expect(pourCount(t('0011', '011', '.'), 0, 1)).toBe(1); // room for only one
    expect(pourCount(t('0011', '.', '.'), 0, 1)).toBe(2);
    expect(pourCount(t('0011', '0111', '.'), 0, 1)).toBe(0); // full target
  });
  it('rejects the same tube, empty source, out-of-range and junk indices', () => {
    const s = t('0011', '.', '01');
    expect(pourCount(s, 0, 0)).toBe(0);
    expect(pourCount(s, 1, 0)).toBe(0);
    expect(pourCount(s, -1, 0)).toBe(0);
    expect(pourCount(s, 0, 9)).toBe(0);
    expect(pourCount(s, 0.5, 1)).toBe(0);
    expect(pourCount(s, NaN, 1)).toBe(0);
    expect(pour(s, 1, 0)).toBeNull();
  });
  it('has a plain reason for every refusal', () => {
    const s = t('0011', '.', '01', '0111');
    expect(pourProblem(s, 0, 2)).toBeNull();
    expect(pourProblem(s, 0, 0)).toMatch(/same tube/);
    expect(pourProblem(s, 1, 0)).toMatch(/empty/);
    expect(pourProblem(s, 0, 3)).toMatch(/full/);
    expect(pourProblem(s, 2, 0)).toMatch(/full/);
    expect(pourProblem(t('01', '10', '.'), 0, 1)).toMatch(/different/);
    expect(pourProblem(s, 0, 40)).toMatch(/no such tube/);
  });
  it('agrees with the naive one-layer-at-a-time model on random positions', () => {
    const rng = mulberry32(4242);
    let checked = 0;
    for (let trial = 0; trial < 400; trial++) {
      const k = 3 + Math.floor(rng() * 4);
      const s = makeLevel(k, rng).tubes;
      for (let from = 0; from < s.length; from++) {
        for (let to = 0; to < s.length; to++) {
          const a = pour(s, from, to);
          const b = naivePour(s, from, to);
          expect(a).toEqual(b);
          if (a) checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
  it('never changes its input and never loses a layer', () => {
    const rng = mulberry32(11);
    const s = makeLevel(5, rng).tubes;
    const copy = cloneTubes(s);
    for (const m of legalPours(s)) {
      const n = pour(s, m.from, m.to)!;
      expect(s).toEqual(copy);
      expect(colourCounts(n)).toEqual(colourCounts(s));
      expect(n.every((x) => x.length <= CAP)).toBe(true);
    }
  });
  it('legalPours lists exactly the pairs with a positive count', () => {
    const s = t('0011', '01', '.', '2222');
    const listed = legalPours(s).map((m) => `${m.from}-${m.to}`);
    const expected: string[] = [];
    for (let a = 0; a < s.length; a++) for (let b = 0; b < s.length; b++) if (pourCount(s, a, b) > 0) expected.push(`${a}-${b}`);
    expect(listed).toEqual(expected);
  });
  it('isStuck is true only when nothing can move and the level is not solved', () => {
    expect(isStuck(t('0101', '1010'))).toBe(true);
    expect(isStuck(t('0101', '1010', '.'))).toBe(false);
    expect(isStuck(t('0000', '1111'))).toBe(false); // solved is not stuck
  });
});

describe('generator', () => {
  it('makes valid, unsolved, mixed levels with a known solution, for every colour count', () => {
    for (let k = MIN_COLOURS; k <= MAX_COLOURS; k++) {
      for (let seed = 1; seed <= 150; seed++) {
        const lv = makeLevel(k, mulberry32(seed * 7919 + k));
        expect(lv.tubes).toHaveLength(tubeCount(k));
        expect(isValidTubes(lv.tubes, k), `k=${k} seed=${seed}`).toBe(true);
        expect(isSolved(lv.tubes)).toBe(false);
        expect(lv.tubes.some(isTubeDone), `finished tube k=${k} seed=${seed}`).toBe(false);
        expect(mixedTubes(lv.tubes), `k=${k} seed=${seed}`).toBeGreaterThanOrEqual(Math.max(2, k - 1));
        const end = playPours(lv.tubes, lv.solution);
        expect(end, `stored solution replays k=${k} seed=${seed}`).not.toBeNull();
        expect(isSolved(end!)).toBe(true);
      }
    }
  });
  it('is deterministic for a seed and differs between seeds', () => {
    const a = makeLevel(6, mulberry32(99));
    const b = makeLevel(6, mulberry32(99));
    expect(a).toEqual(b);
    const keys = new Set<string>();
    for (let s = 1; s <= 30; s++) keys.add(canonicalKey(makeLevel(6, mulberry32(s)).tubes));
    expect(keys.size).toBeGreaterThanOrEqual(28);
  });
  it('rejects a bad colour count', () => {
    expect(() => makeLevel(2, mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(9, mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(3.5, mulberry32(1))).toThrow(RangeError);
  });
  it('keeps the tangled candidate: more colours need more pours, and few neighbouring layers match', () => {
    expect(CANDIDATES).toBe(12);
    const mean = (k: number) => {
      let sum = 0;
      for (let s = 1; s <= 30; s++) sum += makeLevel(k, mulberry32(s * 13 + k)).solution.length;
      return sum / 30;
    };
    const m3 = mean(3);
    const m6 = mean(6);
    const m8 = mean(8);
    expect(m3).toBeGreaterThan(4);
    expect(m6).toBeGreaterThan(m3 + 3);
    expect(m8).toBeGreaterThan(m6 + 1);
    for (let k = MIN_COLOURS; k <= MAX_COLOURS; k++) {
      let touching = 0;
      for (let s = 1; s <= 30; s++) touching += touchingPairs(makeLevel(k, mulberry32(s * 17 + k)).tubes);
      expect(touching / 30, `k=${k}`).toBeLessThan(k + 1); // a solved colour has 3 touching pairs per tube, so 3k when solved
    }
  });
  it('touchingPairs counts neighbouring equal layers', () => {
    expect(touchingPairs(solvedTubes(4))).toBe(12);
    expect(touchingPairs(t('0101', '0011', '.'))).toBe(2);
  });
});

describe('solvability by independent exhaustive search', () => {
  it('every generated 3-colour level is solvable and the stored solution is no shorter than the true minimum', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const lv = makeLevel(3, mulberry32(seed));
      const r = bfsSolvable(lv.tubes);
      expect(r.solvable, `seed ${seed}`).toBe(true);
      expect(r.depth).toBeLessThanOrEqual(lv.solution.length);
    }
  }, 120_000);
  it('the hint search agrees with exhaustive search on random small positions (solved versus no solution)', () => {
    const rng = mulberry32(777);
    let solvable = 0;
    let unsolvable = 0;
    for (let trial = 0; trial < 60; trial++) {
      // 3 colours in 4 tubes of 4 (tight, so some positions are dead) or in 5 tubes
      const tubeTotal = trial % 2 ? 4 : 5;
      const layers: number[] = [];
      for (let c = 0; c < 3; c++) for (let i = 0; i < CAP; i++) layers.push(c);
      for (let i = layers.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [layers[i], layers[j]] = [layers[j], layers[i]];
      }
      const tubes: Tubes = Array.from({ length: tubeTotal }, () => []);
      for (const c of layers) {
        const open = tubes.map((_, i) => i).filter((i) => tubes[i].length < CAP);
        tubes[open[Math.floor(rng() * open.length)]].push(c);
      }
      expect(isValidTubes(tubes, 3)).toBe(true);
      const truth = bfsSolvable(tubes);
      const mine = solve(tubes, 400_000);
      if (truth.solvable) {
        solvable++;
        expect(mine.status, JSON.stringify(tubes)).toBe('solved');
        if (mine.status === 'solved') {
          const end = playPours(tubes, mine.moves);
          expect(end).not.toBeNull();
          expect(isSolved(end!)).toBe(true);
        }
      } else {
        unsolvable++;
        expect(mine.status, JSON.stringify(tubes)).toBe('none');
      }
    }
    expect(solvable).toBeGreaterThan(5);
    expect(unsolvable).toBeGreaterThan(0); // the test really covers dead positions
  }, 120_000);
  it('reports no solution for a position with no legal pour', () => {
    expect(bfsSolvable(t('0101', '1010')).solvable).toBe(false);
    expect(solve(t('0101', '1010')).status).toBe('none');
  });
  it('returns no moves for a solved position', () => {
    expect(solve(solvedTubes(4))).toEqual({ status: 'solved', moves: [] });
  });
  it('honours the node limit', () => {
    const lv = makeLevel(8, mulberry32(3));
    expect(solve(lv.tubes, 1).status).toBe('limit');
  });
});

describe('the hint search on generated levels', () => {
  it('finds a legal, solving move list for most levels at every size, within the default limit', () => {
    const rng = mulberry32(2024);
    for (let k = MIN_COLOURS; k <= MAX_COLOURS; k++) {
      let ok = 0;
      const total = 12;
      for (let i = 0; i < total; i++) {
        const lv = makeLevel(k, rng);
        const r = solve(lv.tubes);
        if (r.status === 'solved') {
          ok++;
          const end = playPours(lv.tubes, r.moves);
          expect(end, `legal k=${k}`).not.toBeNull();
          expect(isSolved(end!)).toBe(true);
        } else {
          expect(r.status).not.toBe('none'); // a generated level is never unsolvable
        }
      }
      expect(ok, `k=${k}`).toBeGreaterThanOrEqual(total - 2);
    }
  }, 120_000);
  it('also solves from the middle of a game', () => {
    const lv = makeLevel(5, mulberry32(8));
    const mid = playPours(lv.tubes, lv.solution.slice(0, 6))!;
    const r = solve(mid);
    expect(r.status).toBe('solved');
  });
  it('worst case stays inside a generous time budget', () => {
    const t0 = Date.now();
    for (let s = 1; s <= 5; s++) solve(makeLevel(8, mulberry32(s)).tubes);
    expect(Date.now() - t0).toBeLessThan(20_000);
  }, 30_000);
});

describe('fuzz', () => {
  it('random legal pours never throw and keep the layer counts', () => {
    const rng = mulberry32(31337);
    for (let run = 0; run < 40; run++) {
      const k = 3 + (run % 6);
      let s = makeLevel(k, rng).tubes;
      for (let step = 0; step < 150; step++) {
        const moves = legalPours(s);
        if (!moves.length) break;
        const m = moves[Math.floor(rng() * moves.length)];
        const n = pour(s, m.from, m.to)!;
        expect(n).not.toBeNull();
        expect(isValidTubes(n, k)).toBe(true);
        s = n;
      }
    }
  });
});

describe('sanitisers and text', () => {
  it('clampColours accepts only whole numbers in range', () => {
    expect(clampColours('5', 4)).toBe(5);
    expect(clampColours(8, 4)).toBe(8);
    expect(clampColours('9', 4)).toBe(4);
    expect(clampColours('2', 4)).toBe(4);
    expect(clampColours('4.5', 4)).toBe(4);
    expect(clampColours('', 4)).toBe(4);
    expect(clampColours('abc', 4)).toBe(4);
    expect(clampColours(NaN, 4)).toBe(4);
    expect(clampColours(null, 4)).toBe(4);
    expect(clampColours([5], 4)).toBe(4);
  });
  it('sanitiseBest keeps only known keys with whole numbers in range, in a fresh object', () => {
    const good = sanitiseBest({ c3: 20, c8: 99, c5: MAX_BEST_MOVES });
    expect(good).toEqual({ c3: 20, c8: 99, c5: MAX_BEST_MOVES });
    expect(sanitiseBest({ c3: 0, c4: -2, c5: 1.5, c6: NaN, c7: Infinity, c8: MAX_BEST_MOVES + 1 })).toEqual({});
    expect(sanitiseBest({ c3: '20' as unknown as number })).toEqual({});
    expect(sanitiseBest({ c2: 5, c9: 5, x: 1 })).toEqual({});
    expect(sanitiseBest(null)).toEqual({});
    expect(sanitiseBest([1, 2, 3])).toEqual({});
    expect(sanitiseBest('c3')).toEqual({});
    expect(sanitiseBest(JSON.parse('{"__proto__":{"c3":5},"c4":7}'))).toEqual({ c4: 7 });
    const raw = { c3: 4 };
    expect(sanitiseBest(raw)).not.toBe(raw);
    expect(bestKey(6)).toBe('c6');
  });
  it('uses singular and plural correctly', () => {
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(2, 'move')).toBe('2 moves');
    expect(plural(0, 'move')).toBe('0 moves');
    expect(pourMessage(t('00', '000'), 0, 1, 1)).toBe('Poured 1 layer of blue from tube 1 to tube 2.');
    expect(pourMessage(t('0', '000'), 0, 1, 2)).toBe('Poured 2 layers of blue from tube 1 to tube 2.');
  });
  it('describes a tube for a screen reader', () => {
    expect(describeTube([], 0)).toBe('Tube 1: empty, room for 4');
    expect(describeTube([0, 0, 1], 1)).toBe('Tube 2: from the bottom 2 blue, then 1 yellow, room for 1');
    expect(describeTube([2, 2, 2, 2], 2)).toBe('Tube 3: from the bottom 4 red, finished');
    expect(describeTube([0, 1, 0, 1], 3)).toBe('Tube 4: from the bottom 1 blue, then 1 yellow, then 1 blue, then 1 yellow, full');
  });
});
