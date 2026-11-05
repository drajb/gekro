/**
 * games-traffic-jam.test.ts - the engine behind `traffic-jam`.
 *
 * Pinned: the sliding rules against a second implementation that works on a
 * letter grid, that every generated level is valid (vertical blue hero, exit in
 * the top or bottom edge, no overlaps, not already won), that the stated par is
 * the TRUE fewest moves (an independent breadth-first search over letter grids
 * agrees), that the stored solution plays legally to a win, that the hint is the
 * first move of a shortest solution, that every move can be undone exactly, that
 * a boxed-in hero is reported as having no solution, that harder difficulties
 * give higher pars on average, and the sanitisers.
 */
import { describe, it, expect } from 'vitest';
import {
  SIZES, DIFFICULTIES, HERO, MAX_VEHICLES, PARAMS, STATE_CAP, STATE_BUDGET, EXACT_LIMIT, fallbackLevel, LAYOUT_TRIES, mulberry32, cellsOf, inBounds, occupancy, isValidState, exitPos, isWon,
  isValidLevel, slideRange, legalMoves, applyMove, reverseMove, playMoves, solve, hintMove, makeLevel, COLOUR_NAMES, MARK_NAMES, lookOf, vehicleName,
  directionWord, plural, moveText, describeVehicle, bestKey, MAX_BEST_MOVES, sanitiseBest, clampSize, clampDifficulty,
  type Level, type State, type Difficulty,
} from '../src/components/apps-private/traffic-jam/helpers';

// ── Independent oracle: letter grids, one cell at a time ──────────────────────

type Grid = string[];
const letter = (v: number): string => (v === 0 ? 'H' : String.fromCharCode(96 + v)); // H, a, b, c ...

const toGrid = (level: Level, state: State): Grid => {
  const g: string[][] = Array.from({ length: level.n }, () => Array(level.n).fill('.'));
  level.vehicles.forEach((veh, v) => {
    for (let k = 0; k < veh.len; k++) {
      const r = veh.horiz ? veh.line : state[v] + k;
      const c = veh.horiz ? state[v] + k : veh.line;
      if (g[r][c] !== '.') throw new Error('overlap in test grid');
      g[r][c] = letter(v);
    }
  });
  return g.map((row) => row.join(''));
};

/** Every grid reachable by sliding one vehicle any distance, found by moving it one cell at a time. */
const oracleNext = (grid: Grid): Grid[] => {
  const n = grid.length;
  const letters = [...new Set(grid.join('').replace(/\./g, ''))];
  const out: Grid[] = [];
  for (const ch of letters) {
    const cells: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] === ch) cells.push([r, c]);
    const horiz = cells[0][0] === cells[1][0];
    for (const dir of [-1, 1]) {
      let cur = cells;
      for (;;) {
        const lead = dir === 1 ? cur[cur.length - 1] : cur[0];
        const nr = lead[0] + (horiz ? 0 : dir);
        const nc = lead[1] + (horiz ? dir : 0);
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || grid[nr][nc] !== '.') break;
        cur = cur.map(([r, c]) => [r + (horiz ? 0 : dir), c + (horiz ? dir : 0)] as [number, number]);
        const g = grid.map((row) => row.split(''));
        for (const [r, c] of cells) g[r][c] = '.';
        for (const [r, c] of cur) g[r][c] = ch;
        out.push(g.map((row) => row.join('')));
      }
    }
  }
  return out;
};

const oracleWon = (grid: Grid, exit: 'top' | 'bottom'): boolean => (exit === 'top' ? grid[0] : grid[grid.length - 1]).includes('H');

/** Fewest moves to a win, or null if none. Breadth first over letter grids. */
const oracleDistance = (level: Level, state: State, cap = 400000): number | null => {
  const start = toGrid(level, state).join('/');
  let frontier: Grid[] = [toGrid(level, state)];
  const seen = new Set<string>([start]);
  if (oracleWon(frontier[0], level.exit)) return 0;
  let d = 0;
  while (frontier.length) {
    d++;
    const next: Grid[] = [];
    for (const g of frontier) {
      for (const h of oracleNext(g)) {
        const k = h.join('/');
        if (seen.has(k)) continue;
        seen.add(k);
        if (oracleWon(h, level.exit)) return d;
        next.push(h);
      }
    }
    if (seen.size > cap) throw new Error('oracle space too large');
    frontier = next;
  }
  return null;
};

const stateKey = (level: Level, state: State): string => toGrid(level, state).join('/');
const apply = (level: Level, state: State, v: number, to: number): State => {
  const s = applyMove(level, state, v, to);
  if (!s) throw new Error('expected a legal move');
  return s;
};

/**
 * d.H..
 * d.H..
 * ..bbc
 * aa..c
 * ....c        (exit gap in the bottom edge of column 3)
 */
const SMALL: Level = {
  n: 5,
  exit: 'bottom',
  vehicles: [
    { len: 2, horiz: false, line: 2 }, // hero, column 3
    { len: 2, horiz: true, line: 3 }, // a: row 4
    { len: 2, horiz: true, line: 2 }, // b: row 3
    { len: 3, horiz: false, line: 4 }, // c: column 5, a truck
    { len: 2, horiz: false, line: 0 }, // d: column 1
  ],
};
const START: State = [0, 0, 2, 2, 0];

describe('geometry', () => {
  it('lists the cells a vehicle covers', () => {
    expect(toGrid(SMALL, START)).toEqual(['d.H..', 'd.H..', '..bbc', 'aa..c', '....c']);
    expect(cellsOf(SMALL, 0, 0)).toEqual([2, 7]);
    expect(cellsOf(SMALL, 1, 1)).toEqual([16, 17]);
    expect(cellsOf(SMALL, 3, 2)).toEqual([14, 19, 24]);
    expect(inBounds(SMALL, 3, 2)).toBe(true);
    expect(inBounds(SMALL, 3, 3)).toBe(false);
    expect(inBounds(SMALL, 0, -1)).toBe(false);
    expect(inBounds(SMALL, 0, 1.5)).toBe(false);
  });
  it('builds an occupancy grid and rejects overlaps, wrong lengths and vehicles off the board', () => {
    const occ = occupancy(SMALL, START)!;
    expect(occ).not.toBeNull();
    expect(occ[2]).toBe(0);
    expect(occ[12]).toBe(2);
    expect(occ[14]).toBe(3);
    expect(occ[10]).toBe(-1);
    expect(occupancy(SMALL, [0, 0, 2, 2, 0, 1])).toBeNull(); // too many entries
    expect(occupancy(SMALL, [0, 0])).toBeNull();
    expect(occupancy(SMALL, [1, 0, 1, 2, 0])).toBeNull(); // the hero and b both cover row 3, column 3
    expect(occupancy(SMALL, [4, 0, 2, 2, 0])).toBeNull(); // hero off the bottom
    expect(isValidState(SMALL, START)).toBe(true);
  });
  it('the exit gap is at the top or the bottom edge and the hero wins on reaching it', () => {
    expect(exitPos(SMALL)).toBe(3);
    expect(exitPos({ ...SMALL, exit: 'top' })).toBe(0);
    expect(isWon(SMALL, [3, 0, 0, 2, 0])).toBe(true);
    expect(isWon(SMALL, [2, 0, 0, 2, 0])).toBe(false);
    expect(isWon({ ...SMALL, exit: 'top' }, START)).toBe(true);
  });
  it('validates levels', () => {
    expect(isValidLevel(SMALL)).toBe(true);
    expect(isValidLevel({ ...SMALL, n: 4 })).toBe(false);
    expect(isValidLevel({ ...SMALL, exit: 'right' as unknown as 'top' })).toBe(false);
    expect(isValidLevel({ ...SMALL, vehicles: [{ len: 2, horiz: true, line: 0 }, SMALL.vehicles[1]] })).toBe(false); // hero must be vertical
    expect(isValidLevel({ ...SMALL, vehicles: [{ len: 3, horiz: false, line: 0 }, SMALL.vehicles[1]] })).toBe(false); // hero length 2
    expect(isValidLevel({ ...SMALL, vehicles: [SMALL.vehicles[0], { len: 4, horiz: true, line: 0 }] })).toBe(false);
    expect(isValidLevel({ ...SMALL, vehicles: [SMALL.vehicles[0]] })).toBe(false);
  });
});

describe('moves', () => {
  it('slide only along the vehicle axis, as far as the cells are free', () => {
    expect(slideRange(SMALL, START, 1)).toEqual({ back: 0, forward: 2 }); // a: free to column 4, then the truck
    expect(slideRange(SMALL, START, 2)).toEqual({ back: -2, forward: 0 }); // b: free to the left edge, truck on the right
    expect(slideRange(SMALL, START, 0)).toEqual({ back: 0, forward: 0 }); // hero: b is right below it
    expect(slideRange(SMALL, START, 3)).toEqual({ back: -2, forward: 0 }); // c: bottom edge below it, two free cells above
    expect(slideRange(SMALL, START, 4)).toEqual({ back: 0, forward: 1 }); // d: one cell down column 1, then a
    expect(legalMoves(SMALL, START).map((m) => `${m.v}:${m.from}>${m.to}`)).toEqual(['1:0>1', '1:0>2', '2:2>0', '2:2>1', '3:2>0', '3:2>1', '4:0>1']);
  });
  it('agrees with the letter-grid oracle on every position of 60 generated levels', () => {
    let compared = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const n = SIZES[seed % 3];
      const d = DIFFICULTIES[seed % 3];
      const g = makeLevel(n, d, mulberry32(seed * 11));
      let state = g.start;
      const rng = mulberry32(seed);
      for (let step = 0; step < 12; step++) {
        const mine = new Set(legalMoves(g.level, state).map((m) => stateKey(g.level, apply(g.level, state, m.v, m.to))));
        const theirs = new Set(oracleNext(toGrid(g.level, state)).map((x) => x.join('/')));
        expect(mine).toEqual(theirs);
        compared += mine.size;
        const moves = legalMoves(g.level, state);
        if (!moves.length) break;
        const m = moves[Math.floor(rng() * moves.length)];
        state = apply(g.level, state, m.v, m.to);
      }
    }
    expect(compared).toBeGreaterThan(500);
  }, 120_000);
  it('refuses to jump a vehicle, stay put, leave the board or use junk numbers', () => {
    expect(applyMove(SMALL, START, 0, 3)).toBeNull(); // the hero would pass through b
    expect(applyMove(SMALL, START, 1, 3)).toBeNull(); // a would run into the truck
    expect(applyMove(SMALL, START, 1, 0)).toBeNull(); // to === from
    expect(applyMove(SMALL, START, 1, 4)).toBeNull(); // off the board
    expect(applyMove(SMALL, START, 1, -1)).toBeNull();
    expect(applyMove(SMALL, START, 1, 0.5)).toBeNull();
    expect(applyMove(SMALL, START, 1, NaN)).toBeNull();
    expect(applyMove(SMALL, START, 9, 0)).toBeNull();
    expect(applyMove(SMALL, START, -1, 0)).toBeNull();
    expect(applyMove(SMALL, START, 4, 4)).toBeNull(); // d would leave the board
  });
  it('never modifies the state it is given and reports the new position', () => {
    const copy = START.slice();
    const next = applyMove(SMALL, START, 1, 2);
    expect(START).toEqual(copy);
    expect(next).toEqual([0, 2, 2, 2, 0]);
  });
  it('a two-move solution: b slides left, then the hero drives down', () => {
    expect(solve(SMALL, START)).toEqual({ status: 'solved', moves: [{ v: 2, from: 2, to: 0 }, { v: 0, from: 0, to: 3 }] });
    expect(oracleDistance(SMALL, START)).toBe(2);
  });
  it('every move can be undone exactly', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = makeLevel(5 + (seed % 3), DIFFICULTIES[seed % 3], mulberry32(seed * 5));
      for (const m of legalMoves(g.level, g.start)) {
        const there = apply(g.level, g.start, m.v, m.to);
        const back = applyMove(g.level, there, m.v, reverseMove(m).to);
        expect(back).toEqual(g.start);
        expect(playMoves(g.level, g.start, [m, reverseMove(m)])).toEqual(g.start);
      }
    }
  }, 60_000);
  it('playMoves stops at the first illegal or mismatched move', () => {
    expect(playMoves(SMALL, START, [{ v: 1, from: 0, to: 2 }])).toEqual([0, 2, 2, 2, 0]);
    expect(playMoves(SMALL, START, [{ v: 1, from: 1, to: 2 }])).toBeNull(); // wrong "from"
    expect(playMoves(SMALL, START, [{ v: 0, from: 0, to: 4 }])).toBeNull();
  });
});

describe('a boxed-in hero', () => {
  it('is reported as unsolvable, and the independent search agrees', () => {
    // The hero must reach rows 4-5 of its column but a vertical truck lives there and can never leave the column.
    const level: Level = { n: 5, exit: 'bottom', vehicles: [{ len: 2, horiz: false, line: 2 }, { len: 2, horiz: false, line: 2 }] };
    const state: State = [0, 3];
    expect(isValidState(level, state)).toBe(true);
    expect(oracleDistance(level, state)).toBeNull();
    expect(solve(level, state)).toEqual({ status: 'none' });
    expect(hintMove(level, state)).toBeNull();
  });
  it('is already won when the hero is in the gap', () => {
    expect(solve(SMALL, [3, 0, 0, 2, 0])).toEqual({ status: 'solved', moves: [] });
    expect(hintMove(SMALL, [3, 0, 0, 2, 0])).toBeNull();
  });
  it('honours the state limit', () => {
    const g = makeLevel(6, 'hard', mulberry32(3));
    expect(solve(g.level, g.start, 2).status).toBe('limit');
  });
});

describe('generator', () => {
  it('makes valid levels with a vertical hero, an exit in the top or bottom edge, and a position that is not won', () => {
    const exits = new Set<string>();
    for (const n of SIZES) {
      for (const d of DIFFICULTIES) {
        for (let seed = 1; seed <= 8; seed++) {
          const g = makeLevel(n, d, mulberry32(seed * 977 + n));
          expect(isValidLevel(g.level), `${n} ${d} ${seed}`).toBe(true);
          expect(g.level.n).toBe(n);
          expect(g.level.vehicles[HERO].horiz).toBe(false);
          expect(g.level.vehicles[HERO].len).toBe(2);
          expect(g.level.vehicles.length).toBeLessThanOrEqual(MAX_VEHICLES);
          expect(isValidState(g.level, g.start)).toBe(true);
          expect(isWon(g.level, g.start)).toBe(false);
          expect(g.par).toBeGreaterThanOrEqual(1);
          exits.add(g.level.exit);
        }
      }
    }
    expect([...exits].sort()).toEqual(['bottom', 'top']);
  }, 120_000);
  it('is deterministic for a seed and differs between seeds', () => {
    const a = makeLevel(6, 'medium', mulberry32(42));
    const b = makeLevel(6, 'medium', mulberry32(42));
    expect(a).toEqual(b);
    const keys = new Set<string>();
    for (let s = 1; s <= 10; s++) {
      const g = makeLevel(6, 'medium', mulberry32(s));
      keys.add(stateKey(g.level, g.start) + g.level.exit);
    }
    expect(keys.size).toBeGreaterThanOrEqual(9);
  }, 60_000);
  it('rejects an unknown size or difficulty', () => {
    expect(() => makeLevel(4, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(8, 'easy', mulberry32(1))).toThrow(RangeError);
    expect(() => makeLevel(5, 'extreme' as Difficulty, mulberry32(1))).toThrow(RangeError);
  });
  it('the fallback level is valid, not already won and solvable, with the true par, for every size', () => {
    for (const n of SIZES) {
      const g = fallbackLevel(n);
      expect(isValidLevel(g.level), `${n}`).toBe(true);
      expect(isValidState(g.level, g.start)).toBe(true);
      expect(isWon(g.level, g.start)).toBe(false);
      expect(oracleDistance(g.level, g.start)).toBe(g.par);
      expect(g.par).toBe(2);
      const r = solve(g.level, g.start);
      expect(r.status).toBe('solved');
    }
  });
  it('the search budget is a count of positions, so a seed gives the same level however fast the device is', () => {
    expect(STATE_BUDGET).toBeLessThanOrEqual(100000);
    expect(EXACT_LIMIT).toBeGreaterThan(1000);
    for (const [n, d] of [[7, 'hard'], [7, 'medium'], [6, 'hard']] as const) {
      expect(makeLevel(n, d, mulberry32(77))).toEqual(makeLevel(n, d, mulberry32(77)));
    }
  }, 60_000);
  it('has sensible tuning numbers', () => {
    for (const n of SIZES) {
      const p = PARAMS[n];
      expect(p.easy.free).toBeGreaterThan(p.medium.free);
      expect(p.medium.free).toBeGreaterThan(p.hard.free);
      expect(p.easy.hi).toBeLessThan(p.medium.lo);
      expect(p.medium.hi).toBeLessThan(p.hard.lo);
    }
    expect(STATE_CAP).toBeGreaterThan(1000);
    expect(LAYOUT_TRIES).toBeGreaterThan(1);
    expect(STATE_BUDGET).toBeGreaterThan(STATE_CAP);
  });
});

describe('par is the true fewest moves', () => {
  it('an independent letter-grid search agrees with the stated par and the engine search on 5x5 levels of every difficulty', () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 12; seed++) {
        const g = makeLevel(5, d, mulberry32(seed * 31));
        expect(oracleDistance(g.level, g.start), `5 ${d} ${seed}`).toBe(g.par);
        const r = solve(g.level, g.start);
        expect(r.status).toBe('solved');
        if (r.status === 'solved') expect(r.moves.length).toBe(g.par);
      }
    }
  }, 120_000);
  it('also on 6x6 and 7x7 levels', () => {
    for (const n of [6, 7]) {
      for (let seed = 1; seed <= 5; seed++) {
        const g = makeLevel(n, DIFFICULTIES[seed % 3], mulberry32(seed * 57 + n));
        expect(oracleDistance(g.level, g.start), `${n} ${seed}`).toBe(g.par);
      }
    }
  }, 120_000);
  it('the solution is a list of legal moves that ends with the hero out', () => {
    for (const n of SIZES) {
      for (let seed = 1; seed <= 6; seed++) {
        const g = makeLevel(n, DIFFICULTIES[(seed + n) % 3], mulberry32(seed * 3 + n));
        const r = solve(g.level, g.start);
        if (r.status !== 'solved') throw new Error('unsolved');
        const end = playMoves(g.level, g.start, r.moves);
        expect(end).not.toBeNull();
        expect(isWon(g.level, end!)).toBe(true);
        expect(r.moves).toHaveLength(g.par);
        // no earlier position is already a win
        let cur = g.start;
        for (const m of r.moves.slice(0, -1)) {
          cur = apply(g.level, cur, m.v, m.to);
          expect(isWon(g.level, cur)).toBe(false);
        }
      }
    }
  }, 60_000);
  it('the hint is the first move of a shortest solution: after it, the independent search says par - 1', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = makeLevel(5 + (seed % 2), DIFFICULTIES[seed % 3], mulberry32(seed * 13));
      let state = g.start;
      let left = g.par;
      for (let step = 0; step < 4 && left > 0; step++) {
        const m = hintMove(g.level, state);
        expect(m).not.toBeNull();
        state = apply(g.level, state, m!.v, m!.to);
        left--;
        expect(oracleDistance(g.level, state), `seed ${seed} step ${step}`).toBe(left);
      }
    }
  }, 120_000);
  it('harder difficulties have higher average pars', () => {
    const mean = (n: number, d: Difficulty, count: number): number => {
      let sum = 0;
      for (let s = 1; s <= count; s++) sum += makeLevel(n, d, mulberry32(s * 101 + n)).par;
      return sum / count;
    };
    for (const n of [5, 6]) {
      const easy = mean(n, 'easy', 10);
      const medium = mean(n, 'medium', 10);
      const hard = mean(n, 'hard', 10);
      expect(easy, `${n}`).toBeLessThan(medium);
      expect(medium, `${n}`).toBeLessThan(hard);
    }
    expect(mean(7, 'easy', 6)).toBeLessThan(mean(7, 'hard', 6));
  }, 120_000);
  it('the slowest level of each size and difficulty is made inside a generous time budget', () => {
    for (const n of SIZES) {
      for (const d of DIFFICULTIES) {
        const t0 = Date.now();
        makeLevel(n, d, mulberry32(9));
        expect(Date.now() - t0, `${n} ${d}`).toBeLessThan(15_000);
      }
    }
  }, 120_000);
});

describe('fuzz', () => {
  it('random legal moves never throw, never overlap, and keep every vehicle on its line', () => {
    const rng = mulberry32(2718);
    for (let run = 0; run < 30; run++) {
      const g = makeLevel(SIZES[run % 3], DIFFICULTIES[run % 3], mulberry32(run + 1));
      let state = g.start;
      const trail: State[] = [state];
      for (let step = 0; step < 150; step++) {
        const moves = legalMoves(g.level, state);
        if (!moves.length) break;
        const m = moves[Math.floor(rng() * moves.length)];
        const next = applyMove(g.level, state, m.v, m.to)!;
        expect(next).not.toBeNull();
        expect(isValidState(g.level, next)).toBe(true);
        expect(next.filter((p, i) => p !== state[i])).toHaveLength(1);
        state = next;
        trail.push(state);
      }
      // walk back to the start with reversed moves: exact round trip
      for (let i = trail.length - 1; i > 0; i--) {
        const v = trail[i].findIndex((p, k) => p !== trail[i - 1][k]);
        expect(applyMove(g.level, trail[i], v, trail[i - 1][v])).toEqual(trail[i - 1]);
      }
    }
  }, 60_000);
});

describe('names, text and sanitisers', () => {
  it('gives every vehicle up to 35 a different colour and roof mark pair', () => {
    expect(COLOUR_NAMES).toHaveLength(7);
    expect(MARK_NAMES).toHaveLength(5);
    const seen = new Set<string>();
    for (let v = 1; v <= 35; v++) {
      const l = lookOf(v);
      seen.add(`${l.colour}-${l.mark}`);
    }
    expect(seen.size).toBe(35);
    expect(MAX_VEHICLES).toBeLessThanOrEqual(35);
  });
  it('names vehicles, directions and moves', () => {
    expect(vehicleName(SMALL, 0)).toBe('Blue car with a star');
    expect(vehicleName(SMALL, 1)).toBe('Yellow car with a dot');
    expect(vehicleName(SMALL, 2)).toBe('Green car with a bar');
    expect(vehicleName(SMALL, 3)).toBe('Red truck with a ring');
    expect(directionWord(true, -1)).toBe('left');
    expect(directionWord(true, 2)).toBe('right');
    expect(directionWord(false, -1)).toBe('up');
    expect(directionWord(false, 3)).toBe('down');
    expect(moveText(SMALL, { v: 1, from: 0, to: 2 })).toBe('Yellow car with a dot slides right 2 cells.');
    expect(moveText(SMALL, { v: 0, from: 1, to: 0 })).toBe('Blue car with a star slides up 1 cell.');
    expect(describeVehicle(SMALL, START, 2)).toBe('Green car with a bar, slides left and right, row 3, columns 3 to 4');
    expect(describeVehicle(SMALL, START, 3)).toBe('Red truck with a ring, slides up and down, column 5, rows 3 to 5');
    expect(describeVehicle(SMALL, START, 0)).toBe('Blue car with a star, slides up and down, column 3, rows 1 to 2');
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
  });
  it('every vehicle name reads as a sentence ("with a pair of dots", never "with a two dots")', () => {
    const lv: Level = { n: 7, exit: 'top', vehicles: [{ len: 2, horiz: false, line: 0 }] };
    for (let v = 1; v <= 17; v++) lv.vehicles.push({ len: 2, horiz: true, line: 1 });
    for (let v = 1; v <= 17; v++) expect(vehicleName(lv, v)).not.toMatch(/with an? two/);
    expect(vehicleName(lv, 5)).toBe('Orange car with a pair of dots');
  });
  it('sanitiseBest keeps only known keys with whole numbers in range, in a fresh object', () => {
    expect(sanitiseBest({ '5-easy': 12, '7-hard': MAX_BEST_MOVES })).toEqual({ '5-easy': 12, '7-hard': MAX_BEST_MOVES });
    expect(sanitiseBest({ '5-easy': 0, '6-easy': -1, '6-hard': 1.5, '7-easy': NaN, '7-medium': MAX_BEST_MOVES + 1 })).toEqual({});
    expect(sanitiseBest({ '5-easy': '12' as unknown as number, '4-easy': 5, '5-extreme': 5 })).toEqual({});
    expect(sanitiseBest(null)).toEqual({});
    expect(sanitiseBest([1])).toEqual({});
    expect(sanitiseBest('5-easy')).toEqual({});
    expect(sanitiseBest(JSON.parse('{"__proto__":{"5-easy":3},"6-hard":7}'))).toEqual({ '6-hard': 7 });
    const raw = { '5-easy': 4 };
    expect(sanitiseBest(raw)).not.toBe(raw);
    expect(bestKey(6, 'medium')).toBe('6-medium');
  });
  it('clampSize and clampDifficulty accept only the offered values', () => {
    expect(clampSize('6', 5)).toBe(6);
    expect(clampSize(7, 5)).toBe(7);
    expect(clampSize('4', 5)).toBe(5);
    expect(clampSize('8', 5)).toBe(5);
    expect(clampSize('6.5', 5)).toBe(5);
    expect(clampSize('', 5)).toBe(5);
    expect(clampSize(NaN, 5)).toBe(5);
    expect(clampDifficulty('hard', 'easy')).toBe('hard');
    expect(clampDifficulty('HARD', 'easy')).toBe('easy');
    expect(clampDifficulty(3, 'easy')).toBe('easy');
    expect(clampDifficulty('__proto__', 'medium')).toBe('medium');
  });
});
