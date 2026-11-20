/**
 * games-highway-dodge.test.ts - the engine behind `highway-dodge`.
 *
 * Pinned: a fixed 1/60 s step on a 320 x 480 world with 3, 4 or 5 lanes of 56 units; changing lane takes
 * 56 / 420 s; the road speeds up from the level's start speed to its top speed over 90 s (20 percent slower
 * with reduced motion); traffic comes in rows at least 210 units apart; the generator keeps a list of the
 * lanes the car could be in at each row and only makes a row in which every one of them has a free lane to
 * move into (checked against an independent enumeration of all paths); at top speed the free time between two
 * rows is at least twice a lane change; a fuel drop appears in every 4th or 5th row, always in a free lane that
 * is reachable; the crash test agrees with a brute-force box check; fuel falls at the level's rate, a drop
 * gives 30 up to 100, and empty ends the drive; a driver who only looks at the next row and moves into a
 * free lane never crashes on 30 seeds at every level, a planner that looks five rows ahead and goes for fuel
 * drives 300 s on 20 seeds without a bump or running dry, a driver who ignores fuel runs out of it, and one who
 * never changes lane crashes; random play never breaks an invariant; the clock plays the same drive on any
 * screen; best scores reject junk; and the page keeps what it promises.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, begin, step, makeRow, reachNext, everyLaneHasWayOn, rowGap, boxesHit, scoreOf, speedAt, paramsFor, roadLeft, laneX, clamp,
  keyToMove, swipeMove, tapMove, queueMove, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest, describeState, endMessage, shareText, plural, milestone, isLevel, mulberry32,
  W, H, DT, LANE_W, PLAYER_W, PLAYER_H, PLAYER_Y, LANE_SPEED, VEHICLES, STYLES, HIT_INSET, ROW_MIN, ROW_JITTER, FUEL_W, FUEL_H, FUEL_GAIN, FUEL_START, FUEL_DROP_POINTS, METRE,
  INVULN, RAMP_SECONDS, SLOW_ROAD, SPAWN_Y, KEEP_BELOW, MAX_QUEUE, SWIPE_PX, TAP_PX, PARAMS, LEVELS, MAX_SCORE, SFX, PEAK_GAIN, RETRIES,
  type GameState, type Level, type Row,
} from '../src/components/apps-private/highway-dodge/helpers';
import calculatorSource from '../src/components/apps-private/highway-dodge/Calculator.astro?raw';

const rng0 = () => 0.5;

/** A running game with exactly the rows the test puts in (and nothing generated while the highest row stays far above). */
const scene = (rows: Row[], over: Partial<GameState> = {}, level: Level = 'medium'): GameState => {
  const base = begin(newGame(level, false, mulberry32(1)));
  return { ...base, rows, lastY: -1e6, ...over };
};
const row = (id: number, y: number, lanes: number[], fuel = -1, kind = 0): Row => ({
  id, y, cars: lanes.map((lane) => ({ lane, kind, style: 0, dy: 0 })), fuel, fuelTaken: false,
});

describe('the road and the levels', () => {
  it('is a 320 x 480 world with a fixed 1/60 s step, lanes of 56 and a car 26 x 46 at y 390', () => {
    expect([W, H, LANE_W, PLAYER_W, PLAYER_H, PLAYER_Y, LANE_SPEED]).toEqual([320, 480, 56, 26, 46, 390, 420]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect(VEHICLES).toEqual([{ w: 26, h: 46 }, { w: 28, h: 58 }, { w: 24, h: 40 }]);
    expect([STYLES, HIT_INSET, ROW_MIN, ROW_JITTER, FUEL_W, FUEL_H, FUEL_GAIN, FUEL_START, FUEL_DROP_POINTS, METRE, INVULN, RAMP_SECONDS, SLOW_ROAD]).toEqual([5, 3, 210, 8, 20, 28, 30, 100, 10, 12, 1.6, 90, 0.8]);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    expect(isLevel('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 2]) expect(isLevel(bad as unknown)).toBe(false);
    expect(paramsFor('nope' as Level)).toEqual(PARAMS.medium);
  });
  it('has 3, 4 and 5 lanes, centred on the road, and a road that always fits', () => {
    expect(LEVELS.map((l) => PARAMS[l].lanes)).toEqual([3, 4, 5]);
    expect([roadLeft(3), roadLeft(4), roadLeft(5)]).toEqual([76, 48, 20]);
    for (const l of LEVELS) {
      const n = PARAMS[l].lanes;
      expect(laneX(n, 0)).toBe(roadLeft(n) + 28);
      expect(laneX(n, n - 1) - laneX(n, 0)).toBe((n - 1) * LANE_W);
      expect(laneX(n, 0) - 28).toBeGreaterThan(0);
      expect(laneX(n, n - 1) + 28).toBeLessThan(W);
      expect((laneX(n, 0) + laneX(n, n - 1)) / 2).toBe(W / 2);
    }
  });
  it('gets harder level by level: more lanes, faster, quicker fuel use, more cars per row, fewer lives', () => {
    const order: Level[] = ['easy', 'medium', 'hard'];
    for (let i = 1; i < order.length; i++) {
      const a = PARAMS[order[i - 1]];
      const b = PARAMS[order[i]];
      expect(b.lanes).toBeGreaterThan(a.lanes);
      expect(b.v0).toBeGreaterThan(a.v0);
      expect(b.vMax).toBeGreaterThan(a.vMax);
      expect(b.drain).toBeGreaterThan(a.drain);
      expect(b.maxBlocked).toBeGreaterThan(a.maxBlocked);
      expect(b.lives).toBeLessThanOrEqual(a.lives);
    }
    for (const l of LEVELS) expect(PARAMS[l].maxBlocked).toBeLessThanOrEqual(PARAMS[l].lanes - 2);
  });
  it('the road speeds up from the start speed to the top speed over 90 s, 20 percent slower with reduced motion', () => {
    for (const l of LEVELS) {
      const p = PARAMS[l];
      expect(speedAt(l, false, 0)).toBe(p.v0);
      expect(speedAt(l, false, 45)).toBeCloseTo((p.v0 + p.vMax) / 2, 9);
      expect(speedAt(l, false, 90)).toBe(p.vMax);
      expect(speedAt(l, false, 1e6)).toBe(p.vMax);
      expect(speedAt(l, false, -3)).toBe(p.v0);
      expect(speedAt(l, true, 90)).toBeCloseTo(p.vMax * 0.8, 9);
    }
  });
});

describe('rows of traffic', () => {
  /** An independent check: enumerate every path through the rows, one lane at a time. */
  const pathsExist = (start: number, blockedRows: number[][], lanes: number): boolean => {
    let sets = new Set<number>([start]);
    for (const blocked of blockedRows) {
      const next = new Set<number>();
      for (const l of sets) for (const n of [l - 1, l, l + 1]) if (n >= 0 && n < lanes && !blocked.includes(n)) next.add(n);
      sets = next;
      if (sets.size === 0) return false;
    }
    return true;
  };
  it('reachNext keeps the free lanes within one lane of the lanes already reachable', () => {
    expect(reachNext([2], [], 5)).toEqual([1, 2, 3]);
    expect(reachNext([2], [2], 5)).toEqual([1, 3]);
    expect(reachNext([0], [0, 1], 5)).toEqual([]);
    expect(reachNext([0, 4], [1, 3], 5)).toEqual([0, 4]);
    // random cases against brute force
    const rng = mulberry32(3);
    for (let n = 0; n < 2000; n++) {
      const lanes = 3 + Math.floor(rng() * 3);
      const prev = Array.from({ length: lanes }, (_, i) => i).filter(() => rng() < 0.5);
      const blocked = Array.from({ length: lanes }, (_, i) => i).filter(() => rng() < 0.4);
      const want: number[] = [];
      for (let l = 0; l < lanes; l++) if (!blocked.includes(l) && prev.some((p) => p === l || p === l - 1 || p === l + 1)) want.push(l);
      expect(reachNext(prev, blocked, lanes)).toEqual(want);
    }
  });
  it('everyLaneHasWayOn is true exactly when each lane in the set has a free lane at, or next to, it', () => {
    expect(everyLaneHasWayOn([0], [0, 1], 5)).toBe(false);
    expect(everyLaneHasWayOn([0], [0], 5)).toBe(true);
    expect(everyLaneHasWayOn([0, 2, 4], [1, 3], 5)).toBe(true);
    expect(everyLaneHasWayOn([1], [0, 1, 2], 5)).toBe(false);
    expect(everyLaneHasWayOn([], [0, 1, 2], 5)).toBe(true);
    const rng = mulberry32(8);
    for (let n = 0; n < 2000; n++) {
      const lanes = 3 + Math.floor(rng() * 3);
      const prev = Array.from({ length: lanes }, (_, i) => i).filter(() => rng() < 0.5);
      const blocked = Array.from({ length: lanes }, (_, i) => i).filter(() => rng() < 0.5);
      const brute = prev.every((l) => [l - 1, l, l + 1].filter((m) => m >= 0 && m < lanes).some((m) => !blocked.includes(m)));
      expect(everyLaneHasWayOn(prev, blocked, lanes)).toBe(brute);
    }
  });
  const rowsOf = (level: Level, seed: number, n: number) => {
    const rng = mulberry32(seed);
    const p = PARAMS[level];
    const out: Row[] = [];
    let reach = [Math.floor(p.lanes / 2)];
    let since = 0;
    let y = 0;
    const reaches: number[][] = [];
    for (let i = 0; i < n; i++) {
      y -= rowGap(level, rng);
      const m = makeRow(level, i + 1, y, reach, since, rng);
      out.push(m.row);
      reaches.push(m.reach);
      reach = m.reach;
      since = m.rowsSinceDrop;
    }
    return { rows: out, reaches };
  };
  it('every row has a free lane, a way on from every lane that can be reached, and at most the level number of cars', () => {
    for (const l of LEVELS) for (let seed = 1; seed <= 25; seed++) {
      const p = PARAMS[l];
      const { rows, reaches } = rowsOf(l, seed * 17, 800);
      let prev = [Math.floor(p.lanes / 2)];
      rows.forEach((r, i) => {
        const blocked = r.cars.map((c) => c.lane);
        expect(new Set(blocked).size, `${l} ${seed} #${i}`).toBe(blocked.length);
        expect(blocked.length).toBeLessThanOrEqual(p.maxBlocked);
        expect(blocked.length).toBeLessThanOrEqual(p.lanes - 1);
        for (const b of blocked) { expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(p.lanes); }
        expect(everyLaneHasWayOn(prev, blocked, p.lanes), `${l} ${seed} #${i}`).toBe(true);
        expect(reaches[i].length).toBeGreaterThan(0);
        expect(reaches[i]).toEqual(reachNext(prev, blocked, p.lanes));
        prev = reaches[i];
      });
      // independent enumeration: a path through all 800 rows exists
      expect(pathsExist(Math.floor(p.lanes / 2), rows.map((r) => r.cars.map((c) => c.lane)), p.lanes)).toBe(true);
    }
  }, 120_000);
  it('rows are never an empty wall of cars, and most rows have cars', () => {
    for (const l of LEVELS) {
      const { rows } = rowsOf(l, 4, 1500);
      const withCars = rows.filter((r) => r.cars.length > 0).length;
      expect(withCars / rows.length).toBeGreaterThan(0.75);
      expect(rows.some((r) => r.cars.length === PARAMS[l].maxBlocked)).toBe(true);
    }
  });
  it('rows are 210 to the level limit apart', () => {
    const rng = mulberry32(5);
    for (const l of LEVELS) for (let i = 0; i < 2000; i++) {
      const g = rowGap(l, rng);
      expect(g).toBeGreaterThanOrEqual(ROW_MIN);
      expect(g).toBeLessThanOrEqual(PARAMS[l].rowMax);
    }
    expect(rowGap('hard', () => 0)).toBe(ROW_MIN);
  });
  it('at the top speed the free time between two rows is at least twice a lane change, at every level and pace', () => {
    const lane = LANE_W / LANE_SPEED;
    const biggest = Math.max(...VEHICLES.map((v) => v.h));
    // a car in the lane overlaps the player over this much travel, and two rows' jitter can close the gap
    const overlap = 2 * ((PLAYER_H + biggest) / 2 - HIT_INSET);
    const free = ROW_MIN - overlap - 2 * ROW_JITTER;
    for (const l of LEVELS) for (const calm of [false, true]) {
      const v = speedAt(l, calm, RAMP_SECONDS);
      expect(free / v, `${l} ${calm}`).toBeGreaterThanOrEqual(2 * lane);
    }
  });
  it('fuel drops come in every 4th or 5th row, in a lane that is free and reachable, and are never doubled in a lane with a car', () => {
    for (const l of LEVELS) {
      const p = PARAMS[l];
      const { rows, reaches } = rowsOf(l, 21, 600);
      let sinceLast = 0;
      rows.forEach((r, i) => {
        sinceLast++;
        if (r.fuel >= 0) {
          expect(sinceLast).toBe(p.dropEvery);
          sinceLast = 0;
          expect(r.cars.some((c) => c.lane === r.fuel)).toBe(false);
          expect(reaches[i]).toContain(r.fuel);
        }
      });
      expect(rows.filter((r) => r.fuel >= 0).length).toBe(Math.floor(600 / p.dropEvery));
    }
  });
  it('after RETRIES hopeless draws a row is empty rather than a trap', () => {
    // a rng that always asks for the most cars in a place that cannot work: the lane set has no way on
    let calls = 0;
    const m = makeRow('hard', 1, -300, [0], 0, () => { calls++; return 0.99; });
    expect(m.row.cars.length === 0 || everyLaneHasWayOn([0], m.row.cars.map((c) => c.lane), 5)).toBe(true);
    expect(m.reach.length).toBeGreaterThan(0);
    expect(RETRIES).toBe(12);
    expect(calls).toBeGreaterThan(0);
  });
  it('the same seed makes the same game, a different seed does not', () => {
    const a = newGame('medium', false, mulberry32(9));
    const b = newGame('medium', false, mulberry32(9));
    const c = newGame('medium', false, mulberry32(10));
    expect(a.rows).toEqual(b.rows);
    expect(a.rows).not.toEqual(c.rows);
    expect(a.lane).toBe(2);
    expect(a.px).toBe(laneX(4, 2));
    expect(a.rows[0].y).toBeLessThan(-150);
    expect(a.lastY).toBeLessThanOrEqual(SPAWN_Y - H);
  });
});

describe('driving: lanes, speed, fuel', () => {
  it('does nothing until the drive begins', () => {
    const s = newGame('easy', false, mulberry32(1));
    expect(s.status).toBe('ready');
    expect(step(s, 1, rng0)).toBe(s);
    expect(begin(s).status).toBe('running');
    expect(s.fuel).toBe(100);
    expect(s.lives).toBe(3);
  });
  it('a lane change takes 56 / 420 s, never leaves the road, and the lane is the one asked for at once', () => {
    let s = scene([], {}, 'medium');
    const x0 = s.px;
    s = step(s, -1, rng0);
    expect(s.lane).toBe(1);
    expect(s.px).toBeCloseTo(x0 - LANE_SPEED * DT, 9);
    let n = 1;
    while (Math.abs(s.px - laneX(4, 1)) > 1e-9 && n < 100) { s = step(s, 0, rng0); n++; }
    expect(n * DT).toBeCloseTo(LANE_W / LANE_SPEED, 1);
    expect(s.px).toBeCloseTo(laneX(4, 1), 9);
    // the edges hold
    let e = scene([], {}, 'medium');
    for (let i = 0; i < 10; i++) e = step(e, -1, rng0);
    expect(e.lane).toBe(0);
    for (let i = 0; i < 10; i++) e = step(e, 1, rng0);
    expect(e.lane).toBe(3);
    expect(step(scene([], {}, 'easy'), 7, rng0).lane).toBe(2);
  });
  it('rows come down the screen at the road speed', () => {
    const r = row(1, 0, [0]);
    let s = scene([r], {}, 'easy');
    for (let i = 0; i < 60; i++) s = step(s, 0, rng0);
    expect(s.rows[0].y).toBeCloseTo(PARAMS.easy.v0 * (1 + (PARAMS.easy.vMax - PARAMS.easy.v0) / PARAMS.easy.v0 * (0.5 / RAMP_SECONDS)), 0);
    expect(s.dist).toBeCloseTo(s.rows[0].y, 6);
    expect(s.t).toBeCloseTo(1, 9);
  });
  it('rows far below the view are dropped and new rows keep coming', () => {
    let s = scene([row(1, KEEP_BELOW - 1, [0])]);
    s = step(s, 0, rng0);
    expect(s.rows.length).toBe(0);
    const g = begin(newGame('hard', false, mulberry32(3)));
    let t = g;
    for (let i = 0; i < 3000 && t.status === 'running'; i++) t = step({ ...t, lane: 2, px: laneX(5, 2), invuln: 99, lives: 9, fuel: 100 }, 0, mulberry32(i + 1));
    expect(t.rows.length).toBeGreaterThan(3);
    expect(t.rows.length).toBeLessThan(12);
  });
  it('fuel falls at the level rate; a drop adds 30 up to 100 and scores 10; empty ends the drive', () => {
    for (const l of LEVELS) {
      let s = scene([], {}, l);
      for (let i = 0; i < 60 * 5; i++) s = step(s, 0, rng0);
      expect(s.fuel).toBeCloseTo(100 - PARAMS[l].drain * 5, 6);
    }
    const lane = 1;
    let s = scene([row(1, PLAYER_Y, [], lane)], { lane, px: laneX(4, lane), fuel: 50 });
    s = step(s, 0, rng0);
    expect(s.events).toContain('fuel');
    expect(s.fuel).toBeGreaterThan(79);
    expect(s.fuel).toBeLessThanOrEqual(80);
    expect(s.drops).toBe(1);
    expect(s.score).toBeGreaterThanOrEqual(FUEL_DROP_POINTS);
    // taken once only
    const again = step(s, 0, rng0);
    expect(again.drops).toBe(1);
    // capped at 100
    const full = step(scene([row(1, PLAYER_Y, [], lane)], { lane, px: laneX(4, lane), fuel: 95 }), 0, rng0);
    expect(full.fuel).toBe(100);
    // a drop in another lane is not picked up
    const miss = step(scene([row(1, PLAYER_Y, [], 3)], { lane, px: laneX(4, lane), fuel: 50 }), 0, rng0);
    expect(miss.drops).toBe(0);
    // empty
    const empty = step(scene([], { fuel: 0.01 }), 0, rng0);
    expect(empty.status).toBe('over');
    expect(empty.cause).toBe('fuel');
    expect(empty.fuel).toBe(0);
    expect(empty.events).toContain('empty');
    expect(step(empty, 1, rng0)).toBe(empty);
  });
  it('the score is distance in 12-unit steps plus 10 for each fuel drop, announced at every hundred', () => {
    expect(scoreOf(0, 0)).toBe(0);
    expect(scoreOf(119, 0)).toBe(9);
    expect(scoreOf(120, 0)).toBe(10);
    expect(scoreOf(1200, 3)).toBe(130);
    expect(scoreOf(-5, -1)).toBe(0);
    const s = step(scene([], { dist: 1198, score: 99 }), 0, rng0);
    expect(s.score).toBeGreaterThanOrEqual(100);
    expect(s.events).toContain('milestone');
    expect([0, 1, 99, 100, 101, 200].map(milestone)).toEqual([false, false, false, true, false, true]);
    expect(milestone(NaN)).toBe(false);
  });
});

describe('crashes', () => {
  it('the box test agrees with a brute-force check on 4000 random pairs', () => {
    const rng = mulberry32(2026);
    let hits = 0;
    for (let n = 0; n < 4000; n++) {
      const ax = rng() * 100;
      const ay = rng() * 100;
      const bx = ax + (rng() - 0.5) * 80;
      const by = ay + (rng() - 0.5) * 120;
      const aw = 20 + rng() * 10;
      const ah = 40 + rng() * 10;
      const bw = 20 + rng() * 10;
      const bh = 38 + rng() * 22;
      // brute force: shrink each box by the inset and look for a shared point on a fine grid
      const inset = HIT_INSET;
      let shared = false;
      const x0 = Math.max(ax - aw / 2 + inset / 2, bx - bw / 2 + inset / 2);
      const x1 = Math.min(ax + aw / 2 - inset / 2, bx + bw / 2 - inset / 2);
      const y0 = Math.max(ay - ah / 2 + inset / 2, by - bh / 2 + inset / 2);
      const y1 = Math.min(ay + ah / 2 - inset / 2, by + bh / 2 - inset / 2);
      if (x0 < x1 && y0 < y1) shared = true;
      const fast = boxesHit(ax, ay, aw, ah, bx, by, bw, bh, inset);
      if (fast) hits++;
      expect(fast, `pair ${n}`).toBe(shared);
    }
    expect(hits).toBeGreaterThan(200);
    expect(hits).toBeLessThan(3500);
  });
  it('hitting a car costs a life, removes the car, and gives 1.6 s of safety', () => {
    const lane = 1;
    const r = row(1, PLAYER_Y, [lane]);
    let s = scene([r], { lane, px: laneX(4, lane) });
    s = step(s, 0, rng0);
    expect(s.lives).toBe(PARAMS.medium.lives - 1);
    expect(s.events).toContain('crash');
    expect(s.invuln).toBeGreaterThan(INVULN - 0.05);
    expect(s.rows[0].cars.length).toBe(0);
    expect(s.status).toBe('running');
    // a second car in the same place during the safe time does nothing
    const t = step({ ...s, rows: [row(2, PLAYER_Y, [lane])] }, 0, rng0);
    expect(t.lives).toBe(s.lives);
    let n = 0;
    let u = s;
    while (u.invuln > 0 && n < 200) { u = step({ ...u, rows: [] }, 0, rng0); n++; }
    expect(n * DT).toBeGreaterThan(INVULN - 0.05);
    expect(n * DT).toBeLessThan(INVULN + 0.05);
  });
  it('a car in the next lane does not hit, a car that overlaps by more than the inset does', () => {
    const lane = 1;
    const x = laneX(4, lane);
    // neighbour lane: centres 56 apart, boxes 26 + 26 wide: no overlap
    expect(step(scene([row(1, PLAYER_Y, [2])], { lane, px: x }), 0, rng0).lives).toBe(3);
    // mid-slide between two lanes clips a car in the lane it is leaving
    const mid = scene([row(1, PLAYER_Y, [lane])], { lane: 2, px: x + 14 });
    expect(step(mid, 0, rng0).events).toContain('crash');
    // rows far above or below do not hit
    expect(step(scene([row(1, PLAYER_Y - 120, [lane])], { lane, px: x }), 0, rng0).lives).toBe(3);
    expect(step(scene([row(1, PLAYER_Y + 120, [lane])], { lane, px: x }), 0, rng0).lives).toBe(3);
  });
  it('losing the last life ends the drive', () => {
    const lane = 1;
    const s = step(scene([row(1, PLAYER_Y, [lane])], { lane, px: laneX(4, lane), lives: 1 }), 0, rng0);
    expect(s.status).toBe('over');
    expect(s.cause).toBe('crash');
    expect(s.lives).toBe(0);
    expect(step(s, 1, rng0)).toBe(s);
  });
  it('all three vehicle sizes can be hit', () => {
    for (let kind = 0; kind < VEHICLES.length; kind++) {
      const lane = 2;
      const s = step(scene([row(1, PLAYER_Y - (VEHICLES[kind].h + PLAYER_H) / 2 + HIT_INSET + 4, [lane], -1, kind)], { lane, px: laneX(4, lane) }), 0, rng0);
      expect(s.events, `kind ${kind}`).toContain('crash');
    }
  });
});

describe('every drive can be driven: pilots', () => {
  /** Looks only at the next row that has not passed: stay if the lane is free, else move to a free lane beside it. */
  const greedy = (s: GameState): -1 | 0 | 1 => {
    const L = paramsFor(s.level).lanes;
    const cur = s.lane;
    const rows = s.rows.filter((r) => r.y < PLAYER_Y + 75).sort((a, b) => b.y - a.y);
    const r0 = rows[0];
    if (!r0 || Math.abs(r0.y - PLAYER_Y) < 75) return 0;
    const free = (l: number) => !r0.cars.some((c) => c.lane === l);
    if (free(cur)) return 0;
    for (const n of [cur - 1, cur + 1]) if (n >= 0 && n < L && free(n)) return n < cur ? -1 : 1;
    return 0;
  };
  /** Looks five rows ahead, goes for fuel when it is below 85 percent, and never changes lane while a row is passing. */
  const planner = (s: GameState): -1 | 0 | 1 => {
    const L = paramsFor(s.level).lanes;
    const cur = s.lane;
    const rows = s.rows.filter((r) => r.y < PLAYER_Y + 75 && r.y > -300).sort((a, b) => b.y - a.y).slice(0, 5);
    if (rows.length === 0) return 0;
    const need = s.fuel < 85;
    const free = (r: Row, l: number) => !r.cars.some((c) => c.lane === l);
    const bonus = (r: Row, l: number) => (r.fuel === l && !r.fuelTaken ? (need ? 10 : 1) : 0);
    const K = rows.length;
    const val: number[][] = Array.from({ length: K + 1 }, () => new Array(L).fill(0));
    for (let j = K - 1; j >= 0; j--) for (let l = 0; l < L; l++) {
      if (!free(rows[j], l)) { val[j][l] = -1e9; continue; }
      let best = -1e9;
      for (let n = Math.max(0, l - 1); n <= Math.min(L - 1, l + 1); n++) best = Math.max(best, val[j + 1][n]);
      val[j][l] = bonus(rows[j], l) + best;
    }
    const passing = Math.abs(rows[0].y - PLAYER_Y) < 75;
    let bestL = cur;
    let bv = -Infinity;
    for (const l of [cur, cur - 1, cur + 1]) {
      if (l < 0 || l >= L) continue;
      if (passing && l !== cur) continue;
      if (val[0][l] > bv + 1e-9) { bv = val[0][l]; bestL = l; }
    }
    return bestL < cur ? -1 : bestL > cur ? 1 : 0;
  };
  const drive = (level: Level, calm: boolean, seed: number, pilot: (s: GameState) => -1 | 0 | 1, seconds: number): GameState => {
    const rng = mulberry32(seed * 977 + level.length);
    let s = begin(newGame(level, calm, rng));
    for (let i = 0; i < 60 * seconds && s.status === 'running'; i++) s = step(s, pilot(s), rng);
    return s;
  };
  for (const level of LEVELS) {
    for (const calm of [false, true]) {
      it(`a driver who looks one row ahead never crashes in 120 s on 30 seeds: ${level}${calm ? ' (reduced-motion pace)' : ''}`, () => {
        for (let seed = 1; seed <= 30; seed++) {
          const s = drive(level, calm, seed, greedy, 120);
          expect(s.lives, `${level} seed ${seed}`).toBe(PARAMS[level].lives);
          expect(s.cause).not.toBe('crash');
        }
      }, 60_000);
      it(`a planner that goes for fuel drives 300 s on 20 seeds without a bump or running dry: ${level}${calm ? ' (reduced-motion pace)' : ''}`, () => {
        let drops = 0;
        for (let seed = 1; seed <= 20; seed++) {
          const s = drive(level, calm, seed, planner, 300);
          expect(s.status, `${level} seed ${seed}: ${s.cause}`).toBe('running');
          expect(s.lives).toBe(PARAMS[level].lives);
          drops += s.drops;
        }
        expect(drops).toBeGreaterThan(20 * 300 / 12);
      }, 120_000);
    }
  }
  it('a driver who ignores fuel runs out of it, so the fuel drops matter (Medium and Hard, 300 s)', () => {
    for (const level of ['medium', 'hard'] as Level[]) {
      let out = 0;
      for (let seed = 1; seed <= 20; seed++) if (drive(level, false, seed, greedy, 300).cause === 'fuel') out++;
      expect(out, level).toBeGreaterThanOrEqual(15);
    }
  }, 120_000);
  it('a driver who never changes lane crashes or runs dry, on every level and seed', () => {
    for (const level of LEVELS) for (let seed = 1; seed <= 15; seed++) {
      const s = drive(level, false, seed, () => 0, 300);
      expect(s.status, `${level} ${seed}`).toBe('over');
    }
  });
  it('the same drive happens on a 60 Hz and a 144 Hz clock', () => {
    const fly = (hz: number) => {
      const rng = mulberry32(31);
      let s = begin(newGame('medium', false, rng));
      let acc = 0;
      for (let f = 0; f < hz * 20 && s.status === 'running'; f++) {
        const r = advanceClock(acc, 1000 / hz);
        acc = r.acc;
        for (let i = 0; i < r.steps && s.status === 'running'; i++) s = step(s, planner(s), rng);
      }
      return s;
    };
    const a = fly(60);
    const b = fly(144);
    expect(Math.abs(a.steps - b.steps)).toBeLessThanOrEqual(2);
    expect(a.status).toBe('running');
    expect(Math.abs(a.score - b.score)).toBeLessThanOrEqual(3);
  });
});

describe('purity, determinism and random play', () => {
  it('does not change the state it was given', () => {
    const s = begin(newGame('hard', false, mulberry32(3)));
    const before = JSON.stringify(s);
    step(s, 1, mulberry32(9));
    step(s, -1, mulberry32(9));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('the same seed and the same moves replay the same drive, a different seed does not', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let s = begin(newGame('medium', false, rng));
      const trace: string[] = [];
      for (let i = 0; i < 1500 && s.status === 'running'; i++) {
        s = step(s, i % 90 === 0 ? 1 : i % 90 === 45 ? -1 : 0, rng);
        trace.push(`${s.px.toFixed(5)}|${s.dist.toFixed(4)}|${s.fuel.toFixed(4)}|${s.lives}|${s.rows.length}`);
      }
      return trace;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77)).not.toEqual(play(78));
  });
  it('survives bad time steps', () => {
    for (const dt of [NaN, -1, 0, Infinity, 5]) {
      const t = step(begin(newGame('easy', false, mulberry32(1))), 1, rng0, dt);
      for (const v of [t.px, t.dist, t.fuel, t.t]) expect(Number.isFinite(v)).toBe(true);
    }
  });
  for (const level of LEVELS) {
    it(`5000 random steps at ${level} never break an invariant`, () => {
      const inRng = mulberry32(9 + level.length);
      const p = PARAMS[level];
      let total = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const rng = mulberry32(seed * 41 + level.length);
        let s = begin(newGame(level, seed % 2 === 0, rng));
        let lastScore = 0;
        for (let i = 0; i < 5000 && s.status === 'running'; i++) {
          s = step(s, inRng() < 0.04 ? (inRng() < 0.5 ? -1 : 1) : 0, rng);
          total++;
          for (const v of [s.px, s.dist, s.fuel, s.t]) expect(Number.isFinite(v)).toBe(true);
          expect(s.lane).toBeGreaterThanOrEqual(0);
          expect(s.lane).toBeLessThan(p.lanes);
          expect(s.px).toBeGreaterThanOrEqual(laneX(p.lanes, 0) - 1e-9);
          expect(s.px).toBeLessThanOrEqual(laneX(p.lanes, p.lanes - 1) + 1e-9);
          expect(s.fuel).toBeGreaterThanOrEqual(0);
          expect(s.fuel).toBeLessThanOrEqual(FUEL_START);
          expect(s.lives).toBeGreaterThanOrEqual(0);
          expect(s.lives).toBeLessThanOrEqual(p.lives);
          expect(s.score).toBeGreaterThanOrEqual(lastScore);
          expect(s.rows.length).toBeLessThan(14);
          for (const r of s.rows) expect(r.y).toBeLessThan(KEEP_BELOW);
          lastScore = s.score;
        }
      }
      expect(total).toBeGreaterThan(1000);
    }, 60_000);
  }
});

describe('input, keys and the clock', () => {
  it('maps keys to one lane and nothing else', () => {
    expect(keyToMove('ArrowLeft')).toBe(-1);
    expect(keyToMove('a')).toBe(-1);
    expect(keyToMove('ArrowRight')).toBe(1);
    expect(keyToMove('D')).toBe(1);
    for (const k of ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'p', 'Escape', 'x', '']) expect(keyToMove(k), k).toBe(0);
  });
  it('a swipe needs 28 pixels, mostly sideways', () => {
    expect(SWIPE_PX).toBe(28);
    expect(swipeMove(-30, 3)).toBe(-1);
    expect(swipeMove(40, -10)).toBe(1);
    expect(swipeMove(27, 0)).toBe(0);
    expect(swipeMove(-40, 60)).toBe(0);
    expect(swipeMove(NaN, 0)).toBe(0);
    expect(swipeMove(0, Infinity)).toBe(0);
  });
  it('a tap moves toward the side of the car that was tapped', () => {
    expect(TAP_PX).toBe(10);
    expect(tapMove(50, 160)).toBe(-1);
    expect(tapMove(250, 160)).toBe(1);
    expect(tapMove(160, 160)).toBe(0);
    expect(tapMove(NaN, 160)).toBe(0);
  });
  it('the move queue keeps the last few moves and ignores nonsense', () => {
    expect(MAX_QUEUE).toBe(3);
    expect(queueMove([], 1)).toEqual([1]);
    expect(queueMove([1, -1, 1], -1)).toEqual([-1, 1, -1]);
    expect(queueMove([1], 0)).toEqual([1]);
    expect(queueMove([1], NaN)).toEqual([1]);
    expect(queueMove([], -9)).toEqual([-1]);
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
  it('takes 60 physics steps a second on 30, 60, 75, 144 and 240 Hz screens', () => {
    for (const hz of [30, 60, 75, 144, 240]) expect(Math.abs(stepsOver(hz, 10) - 600), `${hz} Hz`).toBeLessThanOrEqual(2);
  });
  it('a long stall cannot fast-forward the drive, and bad numbers are safe', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe('best scores', () => {
  it('has one key per level and pace', () => {
    const keys = LEVELS.flatMap((l) => [bestKey(l, false), bestKey(l, true)]);
    expect(new Set(keys).size).toBe(6);
  });
  it('reads storage defensively', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('x')).toEqual({});
    expect(parseBests([1, 2])).toEqual({});
    expect(parseBests({ medium: 120, hard: '9', easy: 1.5, 'easy-calm': -3, nope: 4, 'hard-calm': MAX_SCORE + 1 })).toEqual({ medium: 120 });
    expect(parseBests(JSON.parse('{"__proto__":{"hard":50},"hard":7}'))).toEqual({ hard: 7 });
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('medium', false);
    let r = recordBest({}, k, 70);
    expect(r).toEqual({ bests: { [k]: 70 }, improved: true });
    expect(recordBest(r.bests, k, 70).improved).toBe(false);
    expect(recordBest(r.bests, k, 30).improved).toBe(false);
    r = recordBest(r.bests, k, 80);
    expect(r.bests[k]).toBe(80);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
});

describe('messages and sound', () => {
  const over = (score: number, drops: number, cause: 'crash' | 'fuel'): GameState => ({ ...newGame('medium', false, mulberry32(1)), status: 'over', score, drops, cause });
  it('say what happened and praise what the player did', () => {
    expect(endMessage(over(320, 4, 'fuel'))).toBe('The fuel ran out. You scored 320 and picked up 4 fuel drops.');
    expect(endMessage(over(110, 1, 'crash'))).toBe('The car had too many bumps. You scored 110 and picked up 1 fuel drop.');
    expect(endMessage(over(0, 0, 'crash'))).toBe('The car had too many bumps. No distance this time, so try again!');
    expect(endMessage(newGame('medium', false, mulberry32(1)))).toBe('');
  });
  it('builds a share line that is right before, during and after a drive', () => {
    expect(shareText('medium', null, 0)).toBe('Highway Dodge (Medium): no drive finished yet');
    expect(shareText('easy', { score: 0, drops: 0 }, 0)).toBe('Highway Dodge (Easy): 0 points, 0 fuel drops');
    expect(shareText('hard', { score: 140, drops: 1 }, 300)).toBe('Highway Dodge (Hard): 140 points, 1 fuel drop, best 300');
    for (const t of [shareText('easy', { score: 3, drops: 0 }, 3), describeState(newGame('hard', false, mulberry32(1)))]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(describeState(newGame('hard', false, mulberry32(1)))).toBe('Highway Dodge. Score 0, fuel 100 percent, 2 lives left, lane 3 of 5.');
    expect(describeState({ ...newGame('easy', false, mulberry32(1)), lives: 1 })).toBe('Highway Dodge. Score 0, fuel 100 percent, 1 life left, lane 2 of 3.');
    expect(plural(1, 'fuel drop', 'fuel drops')).toBe('1 fuel drop');
  });
  it('every sound is short, quiet and within hearing range', () => {
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    for (const [name, def] of Object.entries(SFX)) {
      expect(def.ms, name).toBeLessThanOrEqual(400);
      for (const f of def.freq) { expect(f, name).toBeGreaterThanOrEqual(60); expect(f, name).toBeLessThanOrEqual(2000); }
    }
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the lane buttons are at least 56 px and the how-it-works heading is a 32 px target', () => {
    const mv = src.match(/#hwd-app \.hwd-move \{([^}]*)\}/);
    expect(mv).not.toBeNull();
    expect(mv![1]).toContain('min-height: 3.5rem');
    expect(mv![1]).toContain('min-width: 3.5rem');
    const rule = src.match(/\.hwd-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect((src.match(/data-move="/g) ?? []).length).toBe(2);
  });
  it('one lane per press: no key repeat, one path for pointer buttons and one for keyboard activation', () => {
    expect(src).toContain('if (e.repeat) return;');
    expect(src).toContain('if (e.detail !== 0) return;');
    expect(src).toContain("addEventListener('pointerdown'");
  });
  it('pauses on Escape, P and a hidden tab, and honours reduced motion', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('reduced ? 0.5 :');
    expect(src).toContain('newGame(level, mq.matches, rng)');
  });
  it('does not trap keys when paused or finished with focus elsewhere', () => {
    expect(src).toContain('keyScope(phase, app.contains(document.activeElement))');
    expect(src).toContain("if (scope !== 'all') return;");
    expect(src).toContain('spaceIsNative(t.tagName)');
  });
  it('sound is off until the button is pressed', () => {
    expect(src).toContain('let soundOn = false;');
    expect(src).toContain('aria-pressed="false"');
    expect(src).not.toMatch(/^\s*(const|let)\s+actx\s*=\s*new/m);
  });
  it('starts on the first input, never on load, and a drive that is left still counts toward the best', () => {
    expect(src).toContain('begin(st)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
    expect(src).toContain('const settle = () =>');
  });
  it('the numbers the how-it-works text states are the engine numbers', () => {
    expect(ROW_MIN).toBe(210);
    expect([PARAMS.easy, PARAMS.medium, PARAMS.hard].map((p) => [p.v0, p.vMax])).toEqual([[140, 220], [170, 270], [200, 330]]);
    const flat = src.replace(/\s+/g, ' ');
    expect(flat).toContain('at least 210 units apart');
    expect(flat).toContain('from 140 to 220 units a second on Easy, 170 to 270 on Medium and 200 to 330 on Hard over the first 90 seconds');
    expect(flat).toContain('12-unit steps plus 10 for each fuel drop');
  });
});
