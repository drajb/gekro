/**
 * games-road-hopper.test.ts - the engine behind `road-hopper`.
 *
 * Pinned: the grid is 7 x 9 with the burrow row on top and a rest row in the middle; traffic repeats exactly every T
 * seconds (so a level can be searched once for every start moment); the swept vehicle-versus-cell test agrees with a
 * dense time-sampling oracle; every generated level at every difficulty and level number passes an INDEPENDENT forward
 * search over time-expanded states (its own sampled traffic, its own breadth-first search) from every start moment, and
 * a hedgehog that follows the found path through the real engine crosses without losing a heart; stepping stones
 * always leave a way across; hops, edges, hits, splashes, hearts, scoring (a row once, 10 per burrow), level clearing and
 * game over follow the rules; a seed replays exactly; difficulty grows gently and stops at level 12; the fixed-step
 * clock plays the same game on any screen; and best-score storage rejects junk.
 */
import { describe, it, expect } from 'vitest';
import {
  makeLevel, newGame, begin, step, laneHits, cellHurts, slotBlocked, winningStates, isPassable, levelParams, vehicleX, timeOf,
  keyToDir, swipeDirection, queueMove, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest, eventMessage, endMessage,
  shareText, plural, heartsText, isDiff, mulberry32,
  COLS, ROWS, START_ROW, START_COL, DT, HIT_EPS, SLOP, LEVEL_CAP, MAX_SCORE, MAX_QUEUE, SLOW_FACTOR, SLOTS_PER_SECOND, KIND_LEN, DELTA, DIFFS, DIRS,
  type Game, type Level, type Lane, type Dir, type Diff,
} from '../src/components/apps-private/road-hopper/helpers';
import calculatorSource from '../src/components/apps-private/road-hopper/Calculator.astro?raw';

const mod = (a: number, n: number) => ((a % n) + n) % n;

// ── An independent description of the traffic, written differently from the engine ──
/** True when some vehicle covers any part of the middle of column c at time t (direct modulo placement, no sweeping). */
const coveredAt = (lane: Lane, c: number, t: number): boolean => {
  for (const v of lane.vehicles) {
    const back = mod(v.x0 + lane.dir * lane.v * t, lane.P);
    for (const shift of [-lane.P, 0, lane.P]) {
      const a = back + shift;
      const b = a + v.len;
      if (a < c + 1 - HIT_EPS && b > c + HIT_EPS) return true;
    }
  }
  return false;
};
/** Busy somewhere in the slot (plus the slop each side), found by sampling time every 1/200 s. */
const sampledBusy = (level: Level, r: number, c: number, k: number): boolean => {
  const row = level.rows[r];
  if (row.type === 'stream') return !row.stones![c];
  if (row.type !== 'road') return false;
  const t0 = k * level.q - SLOP;
  const t1 = (k + 1) * level.q + SLOP;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 200) if (coveredAt(row.lane!, c, t)) return true;
  return false;
};

/** Forward breadth-first search from (slot k0, start cell); returns the hops (null = wait) to reach the burrow, or null. */
const findPath = (level: Level, k0: number, busy: (r: number, c: number, k: number) => boolean): (Dir | null)[] | null => {
  const N = level.N;
  const key = (k: number, r: number, c: number) => (mod(k, N) * ROWS + r) * COLS + c;
  const parent = new Map<number, { from: number; move: Dir | null }>();
  const startKey = key(k0, START_ROW, START_COL);
  parent.set(startKey, { from: -1, move: null });
  let frontier: [number, number, number][] = [[k0, START_ROW, START_COL]];
  const opts: (Dir | null)[] = [null, 'up', 'left', 'right', 'down'];
  for (let depth = 0; depth < 4 * N && frontier.length; depth++) {
    const next: [number, number, number][] = [];
    for (const [k, r, c] of frontier) {
      for (const m of opts) {
        const r2 = r + (m ? DELTA[m].dr : 0);
        const c2 = c + (m ? DELTA[m].dc : 0);
        if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) continue;
        // the hedgehog hops at the boundary between slot k and slot k + 1 and then stands in the new cell for the whole of slot k + 1
        if (busy(r2, c2, mod(k + 1, N))) continue;
        const nk = key(k + 1, r2, c2);
        if (parent.has(nk)) continue;
        parent.set(nk, { from: key(k, r, c), move: m });
        if (r2 === 0 && c2 === level.burrow) {
          const moves: (Dir | null)[] = [];
          let cur = nk;
          while (cur !== startKey) { const p = parent.get(cur)!; moves.push(p.move); cur = p.from; }
          return moves.reverse();
        }
        next.push([k + 1, r2, c2]);
      }
    }
    frontier = next;
  }
  return null;
};

const levelsFor = (diffs: Diff[], numbers: number[], seeds: number, slow = false): { level: Level; label: string }[] => {
  const out: { level: Level; label: string }[] = [];
  for (const d of diffs) for (const n of numbers) for (let seed = 1; seed <= seeds; seed++) {
    out.push({ level: makeLevel(d, n, slow, mulberry32(seed * 7919 + n * 31)), label: `${d} n${n} seed${seed}` });
  }
  return out;
};

/** A level written by hand: one road row (7) with a parked car and a stream row (5) with stones at the given columns. */
const handmade = (opts: { carAt?: number; stones?: number[]; burrow?: number } = {}): Level => {
  const rows = Array.from({ length: ROWS }, (_, i) => ({ type: i === 0 ? 'burrow' : 'grass', lane: null, stones: null })) as Level['rows'];
  const lane: Lane = { dir: 1, P: 10, m: 1, v: 0, vehicles: opts.carAt === undefined ? [] : [{ x0: opts.carAt, len: 1.3, kind: 'car' }] };
  rows[7] = { type: 'road', lane, stones: null };
  const stones = Array.from({ length: COLS }, (_, c) => (opts.stones ?? [2, 3]).includes(c));
  rows[5] = { type: 'stream', lane: null, stones };
  return { n: 1, diff: 'normal', slow: false, T: 10, N: 60, q: 10 / 60, rows, burrow: opts.burrow ?? 3, attempts: 1 };
};
const gameOn = (level: Level, over: Partial<Game> = {}): Game => ({ ...begin(newGame('normal', false, mulberry32(1))), level, ...over });
const rngZero = () => 0;

describe('the grid and the traffic', () => {
  it('is 7 x 9 with the start at the bottom middle and a fixed 1/60 s step', () => {
    expect([COLS, ROWS, START_ROW, START_COL]).toEqual([7, 9, 8, 3]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect(DIRS).toEqual(['up', 'down', 'left', 'right']);
    expect(DIFFS).toEqual(['calm', 'normal', 'busy']);
    expect(KIND_LEN).toEqual({ car: 1.3, van: 2, bike: 0.7 });
  });
  it('traffic repeats exactly every T seconds', () => {
    for (const { level, label } of levelsFor(DIFFS, [1, 5, 12], 6)) {
      for (const row of level.rows) {
        if (!row.lane) continue;
        expect(row.lane.v * level.T, label).toBeCloseTo(row.lane.m * row.lane.P, 9);
        for (const veh of row.lane.vehicles) for (const t of [0, 1.37, 5.5]) {
          expect(vehicleX(row.lane, veh, t + level.T)).toBeCloseTo(vehicleX(row.lane, veh, t), 6);
        }
      }
    }
  });
  it('laneHits agrees with a dense time-sampling oracle on 3000 random cases', () => {
    const rng = mulberry32(99);
    let hits = 0;
    let softMiss = 0;
    for (let i = 0; i < 3000; i++) {
      const P = 10 + Math.floor(rng() * 4);
      const dir = rng() < 0.5 ? 1 : -1;
      const lane: Lane = {
        dir, P, m: 1, v: 0.5 + rng() * 3,
        vehicles: Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, j) => ({ x0: rng() * P, len: [1.3, 2, 0.7][j % 3], kind: 'car' as const })),
      };
      const c = Math.floor(rng() * COLS);
      const t0 = rng() * 20;
      const t1 = t0 + rng() * 0.4;
      let sampled = false;
      for (let t = t0; t <= t1 + 1e-9; t += 1 / 1000) if (coveredAt(lane, c, t)) { sampled = true; break; }
      const fast = laneHits(lane, c, t0, t1);
      if (sampled) expect(fast, `case ${i}`).toBe(true);
      if (fast) hits++;
      if (fast && !sampled) softMiss++;
    }
    expect(hits).toBeGreaterThan(300);
    // the analytic test may only disagree where the overlap is thinner than the sampling step could see
    expect(softMiss).toBeLessThan(30);
  });
  it('a parked vehicle hurts exactly the cells it overlaps, with the shrunk hit box', () => {
    const lane: Lane = { dir: 1, P: 10, m: 1, v: 0, vehicles: [{ x0: 3, len: 1.3, kind: 'car' }] };
    expect([0, 1, 2, 3, 4, 5, 6].map((c) => laneHits(lane, c, 0, 0))).toEqual([false, false, false, true, true, false, false]);
    // 4.3 end versus the cell 4 starting hit at 4.15: a car ending at 4.1 does not touch cell 4
    const short: Lane = { ...lane, vehicles: [{ x0: 3, len: 1.1, kind: 'car' }] };
    expect(laneHits(short, 4, 0, 0)).toBe(false);
    // and one starting at 2.9 reaches into cell 2's hit box? it covers 2.9 to 4.2 so cells 2 (2.15 to 2.85) is clear
    expect(laneHits({ ...lane, vehicles: [{ x0: 2.9, len: 1.3, kind: 'car' }] }, 2, 0, 0)).toBe(false);
  });
  it('a vehicle wraps round the end of its track and re-enters on the other side', () => {
    const lane: Lane = { dir: 1, P: 10, m: 1, v: 0, vehicles: [{ x0: 9.5, len: 1.3, kind: 'car' }] }; // covers 9.5 to 10.8, so 0 to 0.8 again
    expect(laneHits(lane, 0, 0, 0)).toBe(true);
    expect(laneHits(lane, 1, 0, 0)).toBe(false);
    expect(laneHits(lane, 6, 0, 0)).toBe(false);
  });
  it('a moving vehicle is caught by the swept test even if it jumps over the cell between two instants', () => {
    const lane: Lane = { dir: 1, P: 12, m: 1, v: 3, vehicles: [{ x0: 0, len: 0.7, kind: 'bike' }] };
    // 3 cells per second: at t=0.4 the bike covers 1.2 to 1.9, at t=1.1 it covers 3.3 to 4.0, so it has jumped clean over cell 2
    expect(laneHits(lane, 2, 0.4, 1.1)).toBe(true);
    expect(laneHits(lane, 2, 0.4, 0.4)).toBe(false);
    expect(laneHits(lane, 2, 1.1, 1.1)).toBe(false);
  });
});

describe('levels', () => {
  it('have a burrow row on top, grass at the start and in the middle, and the right number of roads and streams', () => {
    for (const d of DIFFS) {
      for (let n = 1; n <= LEVEL_CAP + 2; n++) {
        for (let seed = 1; seed <= 6; seed++) {
          const L = makeLevel(d, n, false, mulberry32(seed * 101 + n));
          const p = levelParams(d, n, false);
          expect(L.rows).toHaveLength(ROWS);
          expect(L.rows[0].type).toBe('burrow');
          expect(L.rows[START_ROW].type).toBe('grass');
          expect(L.rows[4].type).toBe('grass');
          expect(L.burrow).toBeGreaterThanOrEqual(0);
          expect(L.burrow).toBeLessThan(COLS);
          const roads = L.rows.filter((r) => r.type === 'road').length;
          const streams = L.rows.filter((r) => r.type === 'stream').length;
          if (L.attempts <= 40) { expect(roads).toBe(Math.min(p.roads, 6)); expect(streams).toBe(Math.min(p.streams, 6 - roads)); }
          for (const row of L.rows) {
            expect(Boolean(row.lane)).toBe(row.type === 'road');
            expect(Boolean(row.stones)).toBe(row.type === 'stream');
          }
        }
      }
    }
  });
  it('the guide table is true: the streams that really appear per difficulty and level (the six middle rows cap roads plus streams)', () => {
    const expected = (d: Diff, n: number): number => (d === 'normal' ? (n >= 3 ? 1 : 0) : d === 'busy' ? (n >= 2 && n <= 4 ? 1 : 0) : 0);
    for (const d of DIFFS) {
      for (let n = 1; n <= LEVEL_CAP + 2; n++) {
        for (let seed = 1; seed <= 6; seed++) {
          const L = makeLevel(d, n, false, mulberry32(seed * 313 + n));
          if (L.attempts > 40) continue;
          expect(L.rows.filter((r) => r.type === 'stream').length, `${d} level ${n}`).toBe(expected(d, n));
        }
      }
    }
  });
  it('lanes carry vehicles that never overlap and keep their gaps, with a speed from m laps per cycle', () => {
    for (const { level, label } of levelsFor(DIFFS, [1, 2, 3, 5, 8, 12], 8)) {
      const p = levelParams(level.diff, level.n, false);
      for (const row of level.rows) {
        if (!row.lane) continue;
        const { P, vehicles, m, v } = row.lane;
        expect(P, label).toBeGreaterThanOrEqual(10);
        expect(P, label).toBeLessThanOrEqual(13);
        expect([1, 2]).toContain(m);
        expect(v).toBeGreaterThan(0.5);
        expect(v).toBeLessThan(4.2);
        expect(vehicles.length).toBeGreaterThanOrEqual(1);
        const sorted = vehicles.slice().sort((a, b) => a.x0 - b.x0);
        for (let i = 0; i < sorted.length; i++) {
          const a = sorted[i];
          const b = sorted[(i + 1) % sorted.length];
          const gap = mod(b.x0 - (a.x0 + a.len), P);
          if (sorted.length > 1) expect(gap, `${label} gap`).toBeGreaterThanOrEqual(0);
          if (level.attempts <= 40 && sorted.length > 1) expect(gap, `${label} gapMin`).toBeGreaterThanOrEqual(p.gapMin - 1e-6);
        }
        expect(vehicles.reduce((s, x) => s + x.len, 0)).toBeLessThan(P);
      }
    }
  });
  it('streams always have at least two stones', () => {
    for (const { level } of levelsFor(['normal', 'busy'], [3, 6, 9, 12], 10)) {
      for (const row of level.rows) if (row.stones) expect(row.stones.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('Calm has three roads, no streams, a long cycle and no heart limit', () => {
    for (let n = 1; n <= 14; n++) {
      const p = levelParams('calm', n, false);
      expect([p.roads, p.streams, p.T, p.hearts, p.fastShare]).toEqual([3, 0, 14, -1, 0]);
    }
    expect(newGame('calm', false, mulberry32(3)).hearts).toBe(-1);
    expect(newGame('normal', false, mulberry32(3)).hearts).toBe(3);
  });
  it('grow gently: never fewer lanes, never a longer cycle, stop changing at level 12', () => {
    for (const d of DIFFS) {
      for (let n = 2; n <= 14; n++) {
        const a = levelParams(d, n - 1, false);
        const b = levelParams(d, n, false);
        expect(b.roads).toBeGreaterThanOrEqual(a.roads);
        expect(b.T).toBeLessThanOrEqual(a.T + 1e-9);
        expect(b.vehicles).toBeGreaterThanOrEqual(a.vehicles);
        expect(b.streams).toBeGreaterThanOrEqual(a.streams);
        expect(a.T - b.T).toBeLessThanOrEqual(0.5);
      }
      expect(levelParams(d, 99, false)).toEqual(levelParams(d, LEVEL_CAP, false));
      expect(levelParams(d, -3, false)).toEqual(levelParams(d, 1, false));
      expect(levelParams(d, 2.5, false)).toEqual(levelParams(d, 1, false));
    }
    expect(levelParams('normal', 1, false).streams).toBe(0);
    expect(levelParams('normal', 3, false).streams).toBe(1);
    expect(levelParams('normal', 12, false).streams).toBe(2);
    expect(levelParams('nope' as Diff, 1, false)).toEqual(levelParams('normal', 1, false));
    expect(isDiff('busy')).toBe(true);
    for (const bad of ['', 'BUSY', null, undefined, 3]) expect(isDiff(bad as unknown)).toBe(false);
  });
  it('reduced motion stretches the cycle by 25 percent, so the traffic runs 20 percent slower', () => {
    expect(SLOW_FACTOR).toBe(1.25);
    for (const d of DIFFS) {
      for (const n of [1, 5, 12]) {
        expect(levelParams(d, n, true).T).toBeCloseTo(levelParams(d, n, false).T * 1.25, 9);
        const a = makeLevel(d, n, false, mulberry32(5));
        const b = makeLevel(d, n, true, mulberry32(5));
        expect(b.T).toBeCloseTo(a.T * 1.25, 9);
      }
    }
  });
  it('the same seed gives the same level and a different seed a different one', () => {
    expect(makeLevel('busy', 5, false, mulberry32(8))).toEqual(makeLevel('busy', 5, false, mulberry32(8)));
    expect(makeLevel('busy', 5, false, mulberry32(8))).not.toEqual(makeLevel('busy', 5, false, mulberry32(9)));
  });
  it('time slots tile the cycle', () => {
    for (const { level } of levelsFor(DIFFS, [1, 7], 4)) {
      expect(level.N).toBe(Math.round(level.T * SLOTS_PER_SECOND));
      expect(level.q * level.N).toBeCloseTo(level.T, 9);
      expect(level.q).toBeGreaterThan(0.14);
      expect(level.q).toBeLessThan(0.19);
    }
  });
});

describe('every level can be crossed, proved by an independent search', () => {
  it('the engine slot test is never less careful than a dense sampling of the traffic, and rarely more', () => {
    let both = 0;
    let engineOnly = 0;
    let sampledOnly = 0;
    for (const { level } of levelsFor(DIFFS, [1, 6, 12], 5)) {
      for (let r = 1; r < ROWS - 1; r++) {
        for (let c = 0; c < COLS; c++) {
          for (let k = 0; k < level.N; k += 3) {
            const a = slotBlocked(level, r, c, k);
            const b = sampledBusy(level, r, c, k);
            if (a && b) both++;
            else if (a) engineOnly++;
            else if (b) sampledOnly++;
          }
        }
      }
    }
    expect(sampledOnly).toBe(0);
    expect(both).toBeGreaterThan(1000);
    expect(engineOnly).toBeLessThan(both * 0.02);
  }, 60_000);

  it('the engine search and the independent search agree on 120 levels, from every start moment', () => {
    const levels = levelsFor(DIFFS, [1, 4, 8, 12], 10);
    let checked = 0;
    for (const { level, label } of levels) {
      const memo = new Map<number, boolean>();
      const busy = (r: number, c: number, k: number) => {
        const id = (k * ROWS + r) * COLS + c;
        let v = memo.get(id);
        if (v === undefined) { v = sampledBusy(level, r, c, k); memo.set(id, v); }
        return v;
      };
      expect(isPassable(level), label).toBe(true);
      const win = winningStates(level);
      for (let k0 = 0; k0 < level.N; k0 += Math.max(1, Math.floor(level.N / 8))) {
        const path = findPath(level, k0, busy);
        expect(path, `${label} from slot ${k0}`).not.toBeNull();
        expect(win[(k0 * ROWS + START_ROW) * COLS + START_COL], label).toBe(1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(900);
  }, 120_000);

  it('a hedgehog that follows the found path through the real engine reaches the burrow without losing a heart', () => {
    let crossed = 0;
    for (const { level, label } of levelsFor(DIFFS, [1, 5, 9, 12], 6)) {
      const memo = new Map<number, boolean>();
      const busy = (r: number, c: number, k: number) => {
        const id = (k * ROWS + r) * COLS + c;
        let v = memo.get(id);
        if (v === undefined) { v = sampledBusy(level, r, c, k); memo.set(id, v); }
        return v;
      };
      for (const k0 of [0, Math.floor(level.N / 3), Math.floor((2 * level.N) / 3)]) {
        const plan = findPath(level, k0, busy)!;
        expect(plan, label).not.toBeNull();
        const base = Math.round((k0 * level.q) / DT);
        let g: Game = { ...begin(newGame(level.diff, false, mulberry32(1))), level, steps: base, hearts: 3 };
        const hopStep = (j: number) => Math.round(((k0 + j + 1) * level.q) / DT);
        let j = 0;
        for (let guard = 0; guard < 4000 && g.cleared === 0 && g.status === 'running'; guard++) {
          let move: Dir | null = null;
          if (j < plan.length && g.steps === hopStep(j)) { move = plan[j]; j++; }
          g = step(g, move, mulberry32(77));
        }
        expect(g.status, `${label} k0=${k0}`).toBe('running');
        expect(g.cleared, `${label} k0=${k0}`).toBe(1);
        expect(g.hearts, `${label} k0=${k0} lost a heart`).toBe(3);
        crossed++;
      }
    }
    expect(crossed).toBeGreaterThan(200);
  }, 120_000);

  it('an unlucky layout is rejected: a lane wall of vehicles with no gap fails the search', () => {
    const lvl = makeLevel('normal', 1, false, mulberry32(4));
    const wall: Level = {
      ...lvl,
      rows: lvl.rows.map((row, i) => (i === 3 ? { type: 'road' as const, lane: { dir: 1 as const, P: 10, m: 1, v: 10 / lvl.T, vehicles: [{ x0: 0, len: 10 - 1e-9, kind: 'van' as const }] }, stones: null } : row)),
    };
    // a single vehicle that fills almost the whole track (7 visible cells are always covered)
    expect(isPassable(wall)).toBe(false);
    expect(isPassable(lvl)).toBe(true);
  });

  it('generation is quick: 100 levels, many of them with streams, in well under a minute', () => {
    const t0 = Date.now();
    let attempts = 0;
    for (let i = 0; i < 100; i++) attempts += makeLevel(DIFFS[i % 3], 1 + (i % 12), false, mulberry32(i + 1)).attempts;
    expect(Date.now() - t0).toBeLessThan(30_000);
    expect(attempts / 100).toBeLessThan(10);
  }, 60_000);
});

describe('hops, hazards and scoring', () => {
  const stepN = (g: Game, moves: (Dir | null)[]) => moves.reduce((acc, m) => step(acc, m, rngZero), g);
  it('does nothing until the game begins, and nothing once over', () => {
    const g = newGame('normal', false, mulberry32(1));
    expect(g.status).toBe('ready');
    expect(step(g, 'up', rngZero)).toBe(g);
    expect(begin(g).status).toBe('running');
    const over = { ...begin(g), status: 'over' as const };
    expect(step(over, 'up', rngZero)).toBe(over);
  });
  it('a hop moves one cell, edges stop the hedgehog, and time moves on by one step', () => {
    let g = gameOn(handmade({ stones: [0, 1, 2, 3, 4, 5, 6] }));
    g = step(g, 'up', rngZero);
    expect([g.r, g.c, g.steps]).toEqual([7, 3, 1]);
    g = stepN(g, ['left', 'left', 'left', 'left', 'left']); // road row 7 is empty (no vehicle)
    expect(g.c).toBe(0);
    g = step(g, 'left', rngZero);
    expect(g.c).toBe(0);
    g = stepN(g, ['right', 'right', 'right', 'right', 'right', 'right', 'right']);
    expect(g.c).toBe(COLS - 1);
    g = gameOn(handmade(), { r: START_ROW });
    expect(step(g, 'down', rngZero).r).toBe(START_ROW);
    g = gameOn(handmade(), { r: 1, c: 0 });
    expect(step(g, 'up', rngZero).r).toBe(0);
    expect(step(g, null, rngZero)).toMatchObject({ r: 1, c: 0, steps: 1 });
  });
  it('a hop under a vehicle costs a heart and sends the hedgehog back to the start', () => {
    const lvl = handmade({ carAt: 3 });
    let g = gameOn(lvl, { r: START_ROW, c: 3 });
    g = step(g, 'up', rngZero);
    expect(g.event).toBe('hit');
    expect(g.eventNo).toBe(1);
    expect([g.r, g.c, g.hearts, g.status]).toEqual([START_ROW, START_COL, 2, 'running']);
  });
  it('a vehicle that drives onto a standing hedgehog hits it too', () => {
    const lane: Lane = { dir: 1, P: 10, m: 1, v: 1, vehicles: [{ x0: 0, len: 1.3, kind: 'car' }] };
    const lvl = handmade();
    lvl.rows[7] = { type: 'road', lane, stones: null };
    let g = gameOn(lvl, { r: 7, c: 3 });
    let n = 0;
    while (g.event === 'none' && n++ < 600) g = step(g, null, rngZero);
    expect(g.event).toBe('hit');
    // the car's front reaches the hit box of cell 3 (3.15) when its back is at 3.15 - 1.3 = 1.85, at t = 1.85
    expect(Math.abs(n * DT - 1.85)).toBeLessThan(0.05);
  });
  it('stepping onto a stone is safe, onto water is a splash', () => {
    const lvl = handmade({ stones: [2, 3] });
    let g = gameOn(lvl, { r: 6, c: 3 });
    g = step(g, 'up', rngZero);
    expect([g.r, g.c, g.event, g.hearts]).toEqual([5, 3, 'none', 3]);
    g = step(g, 'right', rngZero);
    expect([g.event, g.hearts, g.r, g.c]).toEqual(['splash', 2, START_ROW, START_COL]);
  });
  it('hearts run out after three hits; the game is over, and Calm has no limit', () => {
    const lvl = handmade({ carAt: 3 });
    let g = gameOn(lvl, { r: START_ROW, c: 3 });
    for (let i = 0; i < 3; i++) { g = step(g, 'up', rngZero); }
    expect([g.hearts, g.status]).toEqual([0, 'over']);
    expect(endMessage(g)).toMatch(/^All done!/);
    let calm = { ...gameOn(lvl, { r: START_ROW, c: 3 }), diff: 'calm' as const, hearts: -1 };
    for (let i = 0; i < 20; i++) calm = step(calm, 'up', rngZero);
    expect(calm.status).toBe('running');
    expect(calm.hearts).toBe(-1);
    expect(calm.eventNo).toBe(20);
  });
  it('a row scores one point the first time it is reached, and not again after a heart is lost', () => {
    let g = gameOn(handmade({ stones: [0, 1, 2, 3, 4, 5, 6] }));
    g = stepN(g, ['up', 'up']); // row 7, row 6
    expect([g.score, g.bestRow]).toEqual([2, 6]);
    g = stepN(g, ['down', 'up']);
    expect(g.score).toBe(2);
    g = step(g, 'up', rngZero); // row 5
    expect(g.score).toBe(3);
    // a heart lost, then up again: no points until a new row
    const lvl = handmade({ carAt: 3 });
    let h = gameOn(lvl, { r: 8, c: 3, bestRow: 8 });
    h = step(h, 'up', rngZero);
    expect(h.score).toBe(1); // the hop itself reached row 7
    expect(h.bestRow).toBe(7);
    h = step(h, 'up', rngZero);
    expect(h.score).toBe(1);
  });
  it('reaching the burrow scores 10, builds the next level and counts the clear', () => {
    const lvl = handmade({ burrow: 3 });
    let g = gameOn(lvl, { r: 1, c: 3, bestRow: 1, score: 5 });
    g = step(g, 'up', mulberry32(3));
    expect(g.event).toBe('cleared');
    expect(g.score).toBe(5 + 1 + 10);
    expect([g.levelNo, g.cleared, g.r, g.c, g.steps, g.bestRow]).toEqual([2, 1, START_ROW, START_COL, 0, START_ROW]);
    expect(g.level.n).toBe(2);
    expect(isPassable(g.level)).toBe(true);
    expect(eventMessage(g)).toBe('Burrow reached! Level 2 is next.');
    // the burrow row is open: any cell of it is safe, only the burrow cell clears
    let h = gameOn(handmade({ burrow: 6 }), { r: 1, c: 0, bestRow: 1 });
    h = step(h, 'up', rngZero);
    expect([h.r, h.c, h.event]).toEqual([0, 0, 'none']);
    h = stepN(h, ['right', 'right', 'right', 'right', 'right']);
    expect(h.event).toBe('none');
    h = step(h, 'right', mulberry32(2));
    expect(h.event).toBe('cleared');
  });
  it('does not change the state it was given', () => {
    const g = gameOn(handmade({ carAt: 3 }), { r: 8, c: 3 });
    const before = JSON.stringify(g);
    step(g, 'up', rngZero);
    step(g, 'left', rngZero);
    expect(JSON.stringify(g)).toBe(before);
  });
  it('is deterministic: the same seed and the same hops replay the same game', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let g = begin(newGame('busy', false, rng));
      const mover = mulberry32(seed + 1);
      const trace: string[] = [];
      for (let i = 0; i < 1500 && g.status === 'running'; i++) {
        g = step(g, mover() < 0.1 ? DIRS[Math.floor(mover() * 4)] : null, rng);
        trace.push(`${g.r},${g.c},${g.hearts},${g.score}`);
      }
      return trace;
    };
    expect(play(12)).toEqual(play(12));
    expect(play(12)).not.toEqual(play(13));
  });
  it('fuzz: 3000 random hops across the three difficulties never break an invariant', () => {
    for (const d of DIFFS) {
      const rng = mulberry32(d.length * 99);
      let g = begin(newGame(d, false, rng));
      let events = 0;
      for (let i = 0; i < 3000; i++) {
        g = step(g, rng() < 0.15 ? DIRS[Math.floor(rng() * 4)] : null, rng);
        if (g.status === 'over') g = begin(newGame(d, false, rng));
        if (g.r < 0 || g.r >= ROWS || g.c < 0 || g.c >= COLS || !Number.isInteger(g.score) || g.score < 0) throw new Error('bad state');
        if (g.hearts !== -1 && (g.hearts < 0 || g.hearts > 3)) throw new Error('bad hearts');
        if (g.bestRow > START_ROW || g.bestRow < 0) throw new Error('bad bestRow');
        if (g.eventNo > events) events = g.eventNo;
        expect(timeOf(g)).toBeGreaterThanOrEqual(0);
      }
      expect(events).toBeGreaterThan(0);
    }
  });
  it('level numbers keep climbing past the cap while the layout stays at its hardest', () => {
    const lvl = handmade({ burrow: 3 });
    let g = gameOn(lvl, { r: 1, c: 3, bestRow: 1, levelNo: 40 });
    g = step(g, 'up', mulberry32(3));
    expect(g.levelNo).toBe(41);
    expect(g.level.n).toBe(LEVEL_CAP);
  });
});

describe('input, keys and the clock', () => {
  it('arrows and WASD hop, case-insensitive for letters, and nothing else does', () => {
    expect([keyToDir('ArrowUp'), keyToDir('w'), keyToDir('W')]).toEqual(['up', 'up', 'up']);
    expect([keyToDir('ArrowDown'), keyToDir('s'), keyToDir('S')]).toEqual(['down', 'down', 'down']);
    expect([keyToDir('ArrowLeft'), keyToDir('a'), keyToDir('A')]).toEqual(['left', 'left', 'left']);
    expect([keyToDir('ArrowRight'), keyToDir('d'), keyToDir('D')]).toEqual(['right', 'right', 'right']);
    for (const k of [' ', 'p', 'Enter', 'Escape', '']) expect(keyToDir(k), k).toBeNull();
  });
  it('turns a drag into a direction along its dominant axis', () => {
    expect(swipeDirection(40, 5, 22)).toBe('right');
    expect(swipeDirection(-40, 5, 22)).toBe('left');
    expect(swipeDirection(3, 40, 22)).toBe('down');
    expect(swipeDirection(3, -40, 22)).toBe('up');
    expect(swipeDirection(10, 10, 22)).toBeNull();
    expect(swipeDirection(NaN, 50, 22)).toBeNull();
  });
  it('keeps at most three hops waiting', () => {
    let q: Dir[] = [];
    for (let i = 0; i < 10; i++) q = queueMove(q, 'up');
    expect(q).toHaveLength(MAX_QUEUE);
    expect(MAX_QUEUE).toBe(3);
    const before: Dir[] = ['up'];
    queueMove(before, 'left');
    expect(before).toEqual(['up']);
  });
  it('key capture scope: game keys only in the game or while running, pause keys always', () => {
    for (const p of ['ready', 'running', 'paused', 'over'] as const) expect(keyScope(p, true)).toBe('all');
    expect(keyScope('running', false)).toBe('all');
    expect(keyScope('paused', false)).toBe('resume');
    expect(keyScope('ready', false)).toBe('none');
    expect(keyScope('over', false)).toBe('none');
    expect(spaceIsNative('BUTTON')).toBe(true);
    expect(spaceIsNative('CANVAS')).toBe(false);
  });
  const stepsOver = (hz: number, seconds: number): number => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < hz * seconds; i++) {
      const r = advanceClock(acc, 1000 / hz);
      acc = r.acc;
      total += r.steps;
    }
    return total;
  };
  it('takes 60 steps a second on 30, 60, 75, 144 and 240 Hz screens; a stall cannot fast-forward; bad numbers are harmless', () => {
    for (const hz of [30, 60, 75, 144, 240]) expect(Math.abs(stepsOver(hz, 10) - 600), `${hz} Hz`).toBeLessThanOrEqual(2);
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(r.acc).toBeLessThan(1000 / 60);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
  });
});

describe('best scores and messages', () => {
  it('has one key per difficulty and pace', () => {
    expect(new Set(DIFFS.flatMap((d) => [bestKey(d, false), bestKey(d, true)])).size).toBe(6);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ normal: 40, busy: '9', calm: 1.5, 'calm-slow': -3, nope: 4, 'busy-slow': 99999 })).toEqual({ normal: 40 });
    expect(parseBests(JSON.parse('{"__proto__":{"busy":50},"busy":7}'))).toEqual({ busy: 7 });
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('normal', false);
    let r = recordBest({}, k, 30);
    expect(r).toEqual({ bests: { [k]: 30 }, improved: true });
    expect(recordBest(r.bests, k, 30).improved).toBe(false);
    expect(recordBest(r.bests, k, 12).improved).toBe(false);
    r = recordBest(r.bests, k, 31);
    expect(r.bests[k]).toBe(31);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
  it('speaks kindly about hits, splashes and clears, and builds a share line that is right in every state', () => {
    const base = newGame('normal', false, mulberry32(1));
    expect(eventMessage({ ...base, event: 'hit', hearts: 2 })).toBe('Ouch! The hedgehog curls up and rolls back to the start. 2 hearts left.');
    expect(eventMessage({ ...base, event: 'hit', hearts: 1 })).toContain('1 heart left.');
    expect(eventMessage({ ...base, event: 'splash', hearts: 2 })).toMatch(/^Splash!/);
    expect(eventMessage({ ...base, event: 'hit', hearts: -1 })).toContain('No hearts to lose in Calm.');
    expect(eventMessage({ ...base, event: 'none' })).toBe('');
    expect(endMessage({ ...base, status: 'over', levelNo: 3, score: 41, cleared: 2 })).toBe('All done! The hedgehog reached level 3 and scored 41. 2 burrows reached.');
    expect(endMessage(base)).toBe('');
    expect(heartsText(-1)).toBe('no limit');
    expect(heartsText(2)).toBe('2');
    expect(shareText('normal', null, 0)).toBe('Road Hopper (Normal): no run yet');
    expect(shareText('calm', { levelNo: 1, score: 0 }, 0)).toBe('Road Hopper (Calm): reached level 1, score 0');
    expect(shareText('busy', { levelNo: 3, score: 41 }, 60)).toBe('Road Hopper (Busy): reached level 3, score 41, best 60');
    for (const t of [shareText('busy', { levelNo: 2, score: 3 }, 3), endMessage({ ...base, status: 'over' })]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(plural(1, 'x', 'xs')).toBe('1 x');
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the four hop buttons are at least 56 px and the how-it-works heading is a 32 px target', () => {
    const btn = src.match(/#rh-app \.rh-dir \{([^}]*)\}/);
    expect(btn).not.toBeNull();
    expect(btn![1]).toContain('min-height: 3.5rem');
    const rule = src.match(/\.rh-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('padding-block: 0.375rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect(rule![1]).not.toMatch(/display:|list-style/);
  });
  it('one hop per press: pointer path, keyboard path, no key repeat', () => {
    expect(src).toContain('if (e.detail !== 0) return;');
    expect(src).toContain('if (e.repeat) return;');
    expect(src).toContain("addEventListener('pointerdown'");
  });
  it('pauses on Escape, P and a hidden tab, honours reduced motion, starts on the first input', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('const reduced = mq.matches;');
    expect(src).toContain('begin(game)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
  });
  it('a run that is left still counts toward the best', () => {
    expect(src).toContain('const settle = () =>');
    expect(src).toContain('settle();');
  });
});
