/**
 * games-garden-defence.test.ts - the engine behind `garden-defence`.
 *
 * Pinned: every number the guide page quotes (garden size, path length, the four plants and four
 * blobs, the ten waves and their counts, the three difficulties, seeds and lives); the path against
 * an independent distance-to-polyline rasteriser and a walk of the blobs along it; how long each
 * kind of blob takes to cross (with and without a slow); exactly what each plant does to what, in
 * hand-built scenes (damage, range edges, target choice, splash, slow, cooldown); placing, selling
 * and refunds; seeds growing back; lives lost and the game ending; that the same plants at the same
 * moments give the same game; that a sensible plan of plants wins each difficulty and no plants at
 * all lose each of them; 300 random games keep every invariant; the words, the tones and the saved
 * bests.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COLS, ROWS, DT, TPS, WAVES, MAX_SEEDS, REGROW_PER_SECOND, WAVE_BONUS, SELL_RATE, SLOW_FACTOR, SLOW_TICKS, FROST_TARGETS, PEAK_GAIN, MAX_BEST, MIN_SOUND_GAP_MS,
  DIFFICULTIES, DIFFICULTY, parseDifficulty, WAYPOINTS, PATH_LENGTH, pathPoint, PATH_CELLS, isPath, pathCellCount, cellIndex, inGarden,
  TOWERS, ENEMIES, WAVE_TABLE, WAVE_HP_GROWTH, waveCount, enemyHp, waveSchedule, newWorld, towerAt, enemiesLeft, canPlace, placeProblem, place, sellValue, sell,
  startWave, stepSpeed, step, wavesCleared, plural, waveSummary, towerLabel, cellLabel, towerDetail, overText, shareLine, placeTone, popTone, leakTone, waveTone,
  emptyStored, cleanBest, sanitiseStored, toStorable, recordBest,
  type World, type Difficulty, type GameEvent,
} from '../src/components/apps-private/garden-defence/helpers';

vi.setConfig({ testTimeout: 120_000 });

const EM_DASH = String.fromCharCode(0x2014);

/** A tiny deterministic generator for the fuzz test (not part of the game). */
const lcg = (seed: number) => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };

// ── scenes ──
const arena = (diff: Difficulty = 'medium'): World => { const w = newWorld(diff); w.phase = 'running'; w.wave = 1; w.seeds = 500; return w; };
const addEnemy = (w: World, kind: number, d: number, hp = 1000) => { const e = { id: w.nextId++, kind, d, hp, maxHp: hp, slow: 0 }; w.enemies.push(e); return e; };
const addTower = (w: World, kind: number, col: number, row: number) => { const t = { id: w.nextId++, kind, col, row, cd: 0 }; w.towers.push(t); return t; };
/** The distance along the path of the point (x, 1) on the first long stretch. */
const onRow1 = (x: number): number => x + 1;

describe('constants quoted on the guide page', () => {
  it('match the spec', () => {
    expect(COLS).toBe(8);
    expect(ROWS).toBe(6);
    expect(DT).toBe(0.05);
    expect(TPS).toBe(20);
    expect(WAVES).toBe(10);
    expect(MAX_SEEDS).toBe(999);
    expect(REGROW_PER_SECOND).toBe(1);
    expect(WAVE_BONUS).toBe(10);
    expect(SELL_RATE).toBe(0.6);
    expect(SLOW_FACTOR).toBe(0.5);
    expect(SLOW_TICKS).toBe(40);
    expect(FROST_TARGETS).toBe(3);
    expect(WAVE_HP_GROWTH).toBe(0.15);
    expect(MAX_BEST).toBe(10);
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    expect(MIN_SOUND_GAP_MS).toBeGreaterThanOrEqual(50);
    expect(DT * TPS).toBeCloseTo(1, 12);
  });
  it('the three difficulties', () => {
    expect([...DIFFICULTIES]).toEqual(['easy', 'medium', 'hard']);
    expect(DIFFICULTY.easy).toEqual({ label: 'Easy', lives: 15, seeds: 100, hpMult: 1 });
    expect(DIFFICULTY.medium).toEqual({ label: 'Medium', lives: 10, seeds: 80, hpMult: 1.4 });
    expect(DIFFICULTY.hard).toEqual({ label: 'Hard', lives: 7, seeds: 60, hpMult: 1.9 });
    for (const bad of ['', 'x', null, undefined, 3, {}, '__proto__']) expect(parseDifficulty(bad)).toBe('medium');
  });
  it('the four plants', () => {
    expect(TOWERS.map((t) => t.name)).toEqual(['Sprout', 'Bloom', 'Frost bud', 'Pepper pod']);
    expect(TOWERS.map((t) => t.cost)).toEqual([25, 50, 35, 75]);
    expect(TOWERS.map((t) => t.range)).toEqual([2.5, 2.2, 2.4, 3]);
    expect(TOWERS.map((t) => t.damage)).toEqual([6, 4, 1, 24]);
    expect(TOWERS.map((t) => t.splashRadius)).toEqual([0, 1, 0, 1.2]);
    expect(TOWERS.map((t) => t.splashDamage)).toEqual([0, 3, 0, 10]);
    expect(TOWERS.map((t) => t.cooldown)).toEqual([14, 22, 20, 60]);
    expect(TOWERS.map((t) => t.slows)).toEqual([false, false, true, false]);
    expect(new Set(TOWERS.map((t) => t.shape)).size).toBe(4);
    expect(new Set(TOWERS.map((t) => t.colour)).size).toBe(4);
  });
  it('the four blobs are round, plain and differ in size, speed and health', () => {
    expect(ENEMIES.map((e) => e.name)).toEqual(['small blob', 'quick blob', 'slow blob', 'giant blob']);
    expect(ENEMIES.map((e) => e.hp)).toEqual([14, 8, 40, 180]);
    expect(ENEMIES.map((e) => e.speed)).toEqual([1, 1.8, 0.7, 0.5]);
    expect(ENEMIES.map((e) => e.reward)).toEqual([1, 1, 2, 6]);
    expect(ENEMIES.map((e) => e.damage)).toEqual([1, 1, 1, 3]);
    expect(ENEMIES[3].size).toBeGreaterThan(ENEMIES[2].size);
    expect(ENEMIES[2].size).toBeGreaterThan(ENEMIES[0].size);
    expect(ENEMIES[0].size).toBeGreaterThan(ENEMIES[1].size);
  });
});

describe('the ten waves', () => {
  it('are in a fixed table with these counts', () => {
    expect(WAVE_TABLE).toHaveLength(10);
    expect(Array.from({ length: 10 }, (_, i) => waveCount(i + 1))).toEqual([6, 8, 10, 10, 10, 16, 24, 7, 22, 25]);
    expect(Array.from({ length: 10 }, (_, i) => waveCount(i + 1)).reduce((a, b) => a + b, 0)).toBe(138);
    expect(waveCount(0)).toBe(0);
    expect(waveCount(11)).toBe(0);
  });
  it('the schedule has one entry per blob, in time order, with whole-step times', () => {
    for (let wave = 1; wave <= WAVES; wave++) {
      const s = waveSchedule(wave);
      expect(s).toHaveLength(waveCount(wave));
      for (let i = 0; i < s.length; i++) {
        expect(Number.isInteger(s[i].tick)).toBe(true);
        expect(s[i].tick).toBeGreaterThanOrEqual(0);
        if (i) expect(s[i].tick).toBeGreaterThanOrEqual(s[i - 1].tick);
      }
    }
    expect(waveSchedule(1).map((x) => x.tick)).toEqual([0, 28, 56, 84, 112, 140]);
    expect(waveSchedule(3).filter((x) => x.kind === 1).map((x) => x.tick)).toEqual([180, 200, 220, 240]);
    expect(waveSchedule(8)[0]).toEqual({ tick: 0, kind: 3 });
    expect(waveSchedule(99)).toEqual([]);
  });
  it('the summary reads well', () => {
    expect(waveSummary(1)).toBe('6 small blobs');
    expect(waveSummary(3)).toBe('6 small blobs and 4 quick blobs');
    expect(waveSummary(8)).toBe('6 slow blobs and 1 giant blob');
    expect(waveSummary(10)).toBe('14 small blobs, 8 slow blobs and 3 giant blobs');
    expect(waveSummary(0)).toBe('nothing');
  });
  it('blob health: base x difficulty x (1 + 0.15 per wave after the first), rounded up', () => {
    expect(enemyHp(0, 1, 'medium')).toBe(20);
    expect(enemyHp(0, 1, 'easy')).toBe(14);
    expect(enemyHp(0, 1, 'hard')).toBe(27);
    expect(enemyHp(3, 10, 'hard')).toBe(804);
    expect(enemyHp(2, 5, 'medium')).toBe(90);
    for (let wave = 1; wave < 10; wave++) for (let k = 0; k < 4; k++) for (const d of DIFFICULTIES) expect(enemyHp(k, wave + 1, d)).toBeGreaterThanOrEqual(enemyHp(k, wave, d));
    for (let k = 0; k < 4; k++) { expect(enemyHp(k, 5, 'easy')).toBeLessThan(enemyHp(k, 5, 'medium')); expect(enemyHp(k, 5, 'medium')).toBeLessThan(enemyHp(k, 5, 'hard')); }
    expect(enemyHp(99, 3, 'easy')).toBe(1);
  });
});

describe('the path', () => {
  it('turns where the table says, and is 23 cells long', () => {
    expect(WAYPOINTS).toEqual([[-1, 1], [6, 1], [6, 3], [1, 3], [1, 5], [8, 5]]);
    expect(PATH_LENGTH).toBe(23);
  });
  it('a blob at each distance is where the walk says', () => {
    const at: [number, number, number][] = [[0, -1, 1], [4, 3, 1], [7, 6, 1], [8, 6, 2], [9, 6, 3], [12, 3, 3], [14, 1, 3], [15, 1, 4], [16, 1, 5], [20, 5, 5], [23, 8, 5]];
    for (const [d, x, y] of at) expect(pathPoint(d)).toEqual({ x, y });
    expect(pathPoint(-5)).toEqual({ x: -1, y: 1 });
    expect(pathPoint(99)).toEqual({ x: 8, y: 5 });
    expect(pathPoint(NaN)).toEqual({ x: -1, y: 1 });
    expect(pathPoint(Infinity)).toEqual({ x: -1, y: 1 });
  });
  it('is continuous: a small step along it is a small step on the garden, and every step is along the grid', () => {
    let prev = pathPoint(0);
    for (let d = 0.01; d <= PATH_LENGTH; d += 0.01) {
      const p = pathPoint(d);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThanOrEqual(0.0100001);
      expect(Math.abs(p.x - Math.round(p.x)) < 1e-9 || Math.abs(p.y - Math.round(p.y)) < 1e-9).toBe(true);
      prev = p;
    }
  });
  it('the cells it covers match an independent distance-to-the-line search', () => {
    const distToSegment = (px: number, py: number, a: readonly [number, number], b: readonly [number, number]): number => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
    };
    let count = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      let best = Infinity;
      for (let i = 1; i < WAYPOINTS.length; i++) best = Math.min(best, distToSegment(c, r, WAYPOINTS[i - 1], WAYPOINTS[i]));
      const onPath = best < 1e-9;
      expect(isPath(c, r), `${c},${r}`).toBe(onPath);
      expect(PATH_CELLS[cellIndex(c, r)]).toBe(onPath);
      if (onPath) count += 1;
    }
    expect(count).toBe(22);
    expect(pathCellCount()).toBe(22);
    expect(COLS * ROWS - pathCellCount()).toBe(26);
  });
  it('every point of the walk inside the garden is on a path cell, and nothing outside the garden is a cell', () => {
    for (let d = 0; d <= PATH_LENGTH; d += 0.05) {
      const p = pathPoint(d);
      const c = Math.round(p.x);
      const r = Math.round(p.y);
      if (inGarden(c, r)) expect(isPath(c, r)).toBe(true);
    }
    expect(isPath(-1, 1)).toBe(false);
    expect(isPath(8, 5)).toBe(false);
    expect(isPath(1.5, 1)).toBe(false);
    expect(inGarden(8, 0)).toBe(false);
    expect(inGarden(0, 6)).toBe(false);
  });
});

describe('walking the path', () => {
  const crossing = (kind: number, slowed = false): number => {
    const w = arena();
    w.queue = [];
    const e = addEnemy(w, kind, 0, 1e9);
    if (slowed) e.slow = 1e9;
    for (let t = 1; t < 100000; t++) {
      const ev = step(w);
      if (ev.some((x) => x.type === 'leak')) return t;
    }
    return -1;
  };
  it('each kind of blob takes exactly the time its speed implies to cross', () => {
    for (let k = 0; k < 4; k++) {
      const want = PATH_LENGTH / (ENEMIES[k].speed * DT);
      const got = crossing(k);
      expect(Math.abs(got - want), `kind ${k}: ${got} vs ${want}`).toBeLessThanOrEqual(1.01);
    }
    expect(crossing(0)).toBeGreaterThanOrEqual(459);
  });
  it('a slowed blob takes twice as long', () => {
    for (let k = 0; k < 4; k++) expect(Math.abs(crossing(k, true) - 2 * crossing(k))).toBeLessThanOrEqual(2);
  });
  it('with no plants, wave 1 sends its first blob through at about 23 seconds and each costs a life', () => {
    const w = newWorld('medium');
    startWave(w);
    let firstLeak = -1;
    let leaks = 0;
    for (let t = 1; t < 5000 && w.phase === 'running'; t++) {
      for (const ev of step(w)) if (ev.type === 'leak') { leaks += 1; if (firstLeak < 0) firstLeak = t; }
    }
    expect(firstLeak).toBeGreaterThanOrEqual(459);
    expect(firstLeak).toBeLessThanOrEqual(461);
    expect(leaks).toBe(6);
    expect(w.lives).toBe(4);
    expect(w.phase).toBe('build');
  });
  it('a giant blob that gets through takes three lives; the game is lost at zero and nothing changes after', () => {
    const w = arena();
    w.lives = 3;
    w.queue = [];
    addEnemy(w, 3, PATH_LENGTH - 0.01);
    const ev = step(w);
    expect(ev).toContainEqual({ type: 'leak', kind: 3, lives: 0 });
    expect(ev).toContainEqual({ type: 'lost' });
    expect(w.phase).toBe('lost');
    expect(w.lives).toBe(0);
    expect(w.enemies).toEqual([]);
    const snap = JSON.stringify(w);
    expect(step(w)).toEqual([]);
    expect(JSON.stringify(w)).toBe(snap);
    expect(startWave(w)).toBe(false);
  });
  it('stepSpeed is speed x 0.05 a step, halved while slowed', () => {
    const e = { id: 1, kind: 1, d: 0, hp: 5, maxHp: 5, slow: 0 };
    expect(stepSpeed(e)).toBeCloseTo(1.8 * 0.05, 12);
    e.slow = 3;
    expect(stepSpeed(e)).toBeCloseTo(1.8 * 0.05 * 0.5, 12);
  });
});

describe('what each plant does', () => {
  it('a Sprout hits the blob in reach for 6, and the blob then walks on', () => {
    const w = arena();
    addTower(w, 0, 3, 2);
    const e = addEnemy(w, 0, onRow1(3));
    const ev = step(w);
    expect(e.hp).toBe(994);
    expect(e.d).toBeCloseTo(onRow1(3) + 0.05, 12);
    expect(ev.filter((x) => x.type === 'shot')).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'shot', tower: w.towers[0].id, kind: 0, from: { x: 3, y: 2 }, to: { x: 3, y: 1 } });
    expect(w.towers[0].cd).toBe(14);
  });
  it('range is exact: just inside is hit, just outside is not (2.5 cells for a Sprout)', () => {
    const edge = 3 + Math.sqrt(2.5 * 2.5 - 1); // on row 1, exactly 2.5 cells from a plant at (3, 2)
    const inside = arena();
    addTower(inside, 0, 3, 2);
    const a = addEnemy(inside, 0, onRow1(edge - 1e-6));
    step(inside);
    expect(a.hp).toBe(994);
    const outside = arena();
    addTower(outside, 0, 3, 2);
    const b = addEnemy(outside, 0, onRow1(edge + 1e-6));
    expect(step(outside).filter((x) => x.type === 'shot')).toHaveLength(0);
    expect(b.hp).toBe(1000);
    expect(outside.towers[0].cd).toBe(0); // it did not fire, so it is ready
  });
  it('every plant reaches exactly as far as its range, tested with a blob walking past on the long straight', () => {
    for (let k = 0; k < 4; k++) {
      const range = TOWERS[k].range;
      const w = arena();
      addTower(w, k, 3, 2);
      const a = addEnemy(w, 0, onRow1(3 + Math.sqrt(range * range - 1) - 1e-6));
      const ev = step(w);
      expect(ev.filter((x) => x.type === 'shot').length, `kind ${k} inside`).toBeGreaterThan(0);
      expect(a.hp).toBeLessThan(1000);
      const v = arena();
      addTower(v, k, 3, 2);
      const b = addEnemy(v, 0, onRow1(3 + Math.sqrt(range * range - 1) + 1e-6));
      expect(step(v).filter((x) => x.type === 'shot'), `kind ${k} outside`).toHaveLength(0);
      expect(b.hp).toBe(1000);
    }
  });
  it('it aims at the blob that has walked farthest', () => {
    const w = arena();
    addTower(w, 0, 3, 2);
    const back = addEnemy(w, 0, onRow1(2));
    const front = addEnemy(w, 0, onRow1(4));
    const mid = addEnemy(w, 0, onRow1(3));
    step(w);
    expect(front.hp).toBe(994);
    expect(back.hp).toBe(1000);
    expect(mid.hp).toBe(1000);
  });
  it('a tie in distance goes to the older blob', () => {
    const w = arena();
    addTower(w, 0, 3, 2);
    const first = addEnemy(w, 0, onRow1(3));
    const second = addEnemy(w, 0, onRow1(3));
    step(w);
    expect(first.hp).toBe(994);
    expect(second.hp).toBe(1000);
  });
  it('shoots every 14 steps (0.7 s) and not before', () => {
    const w = arena();
    addTower(w, 0, 3, 2);
    const e = addEnemy(w, 0, onRow1(3), 1e6);
    const hits: number[] = [];
    let last = e.hp;
    for (let t = 1; t <= 43; t++) {
      step(w);
      if (e.hp < last) { hits.push(t); last = e.hp; }
    }
    expect(hits).toEqual([1, 15, 29, 43]);
  });
  it('a Bloom hits its target for 4 and blobs within 1 cell of it for 3, and nobody farther', () => {
    const w = arena();
    addTower(w, 1, 3, 2);
    const target = addEnemy(w, 0, onRow1(4));
    const near = addEnemy(w, 0, onRow1(3.5));
    const edge = addEnemy(w, 0, onRow1(3));
    const far = addEnemy(w, 0, onRow1(2.99));
    step(w);
    expect(target.hp).toBe(996);
    expect(near.hp).toBe(997);
    expect(edge.hp).toBe(997); // exactly 1 cell behind: splash includes the edge
    expect(far.hp).toBe(1000);
    expect(w.towers[0].cd).toBe(22);
  });
  it('a Frost bud slows the three blobs farthest along, hits each for 1, and leaves the fourth alone', () => {
    const w = arena();
    addTower(w, 2, 3, 2);
    const e1 = addEnemy(w, 0, onRow1(4));
    const e2 = addEnemy(w, 0, onRow1(3.5));
    const e3 = addEnemy(w, 0, onRow1(3));
    const e4 = addEnemy(w, 0, onRow1(2.5));
    const ev = step(w);
    expect(ev.filter((x) => x.type === 'shot')).toHaveLength(3);
    for (const e of [e1, e2, e3]) { expect(e.hp).toBe(999); expect(e.slow).toBe(39); }
    expect(e4.hp).toBe(1000);
    expect(e4.slow).toBe(0);
    expect(e1.d - onRow1(4)).toBeCloseTo(0.025, 12); // half speed
    expect(e4.d - onRow1(2.5)).toBeCloseTo(0.05, 12);
  });
  it('the slow lasts 40 steps (2 seconds) and then the blob speeds up again', () => {
    const w = arena();
    const t = addTower(w, 2, 3, 2);
    const e = addEnemy(w, 0, onRow1(3), 1e6);
    step(w);
    t.cd = 1e9; // no more frost
    let slowedSteps = 1;
    for (let k = 1; k < 60; k++) { const before = e.slow; step(w); if (before > 0) slowedSteps += 1; }
    expect(slowedSteps).toBe(40);
    expect(e.slow).toBe(0);
    expect(stepSpeed(e)).toBeCloseTo(0.05, 12);
  });
  it('a Pepper pod hits its target for 24, blobs within 1.2 cells for 10, and nobody farther', () => {
    const w = arena();
    addTower(w, 3, 3, 2);
    const target = addEnemy(w, 0, onRow1(5));
    const near = addEnemy(w, 0, onRow1(4.2));
    const far = addEnemy(w, 0, onRow1(3.7));
    step(w);
    expect(target.hp).toBe(976);
    expect(near.hp).toBe(990);
    expect(far.hp).toBe(1000);
    expect(w.towers[0].cd).toBe(60);
  });
  it('plants do not shoot at blobs that are already popped this step, and two plants can both fire', () => {
    const w = arena();
    addTower(w, 0, 3, 2);
    addTower(w, 0, 4, 2);
    const weak = addEnemy(w, 0, onRow1(4), 5);
    const spare = addEnemy(w, 0, onRow1(3.5), 1000);
    const ev = step(w);
    expect(weak.hp).toBeLessThanOrEqual(0);
    expect(spare.hp).toBe(994);
    expect(ev.filter((x) => x.type === 'shot')).toHaveLength(2);
    expect(ev.filter((x) => x.type === 'pop')).toHaveLength(1);
  });
  it('a popped blob gives its seeds and is counted, and the seeds grow back a little each step as well', () => {
    const w = arena();
    w.seeds = 100;
    addTower(w, 0, 3, 2);
    addEnemy(w, 2, onRow1(3), 5); // a slow blob: 2 seeds
    addEnemy(w, 0, onRow1(0), 1e9); // keeps the wave going
    const ev = step(w);
    expect(ev).toContainEqual({ type: 'pop', kind: 2, at: { x: 3, y: 1 } });
    expect(w.kills).toBe(1);
    expect(w.seeds).toBeCloseTo(100 + 2 + REGROW_PER_SECOND * DT, 9);
    expect(w.enemies).toHaveLength(1);
  });
});

describe('planting and digging up', () => {
  it('a plant goes on grass you can afford, and costs its price', () => {
    const w = newWorld('medium');
    expect(w.seeds).toBe(80);
    const id = place(w, 0, 3, 2);
    expect(id).toBeGreaterThan(0);
    expect(w.seeds).toBe(55);
    expect(towerAt(w, 3, 2)).toMatchObject({ id, kind: 0, col: 3, row: 2, cd: 0 });
  });
  it('is refused on the path, on another plant, outside the garden, for a bad kind, and without enough seeds', () => {
    const w = newWorld('medium');
    place(w, 0, 3, 2);
    const before = JSON.stringify(w);
    for (const [k, c, r] of [[0, 3, 1], [0, 0, 1], [0, 3, 2], [0, -1, 0], [0, 8, 0], [0, 0, 6], [0, 1.5, 2], [9, 4, 4], [-1, 4, 4], [3, 4, 4]] as const) {
      expect(canPlace(w, k, c, r), `${k} ${c},${r}`).toBe(false);
      expect(place(w, k, c, r)).toBe(-1);
    }
    expect(JSON.stringify(w)).toBe(before);
    expect(placeProblem(w, 0, 3, 1)).toMatch(/path/);
    expect(placeProblem(w, 0, 3, 2)).toMatch(/already/);
    expect(placeProblem(w, 3, 4, 4)).toBe('You need 20 more seeds for a Pepper pod.');
    expect(placeProblem(w, 0, 9, 9)).toMatch(/outside/);
    expect(placeProblem(w, 9, 4, 4)).toMatch(/Pick a plant/);
    expect(placeProblem(w, 0, 4, 4)).toBe('');
  });
  it('selling gives back 60 percent, rounded down, and the cell is free again', () => {
    expect([0, 1, 2, 3].map(sellValue)).toEqual([15, 30, 21, 45]);
    const w = newWorld('medium');
    const id = place(w, 2, 3, 2);
    expect(w.seeds).toBe(45);
    expect(sell(w, id)).toBe(21);
    expect(w.seeds).toBe(66);
    expect(towerAt(w, 3, 2)).toBeNull();
    expect(canPlace(w, 0, 3, 2)).toBe(true);
    expect(sell(w, id)).toBe(-1);
    expect(sell(w, 999)).toBe(-1);
  });
  it('seeds never pass the cap, and nothing can be planted or sold once the game is over', () => {
    const w = newWorld('medium');
    w.seeds = 998;
    const id = place(w, 3, 3, 2);
    w.seeds = 990;
    sell(w, id);
    expect(w.seeds).toBe(999);
    w.phase = 'lost';
    expect(canPlace(w, 0, 4, 4)).toBe(false);
    expect(placeProblem(w, 0, 4, 4)).toMatch(/over/);
    w.phase = 'won';
    expect(sell(w, 1)).toBe(-1);
  });
});

describe('sending waves', () => {
  it('only between waves, one after another, and not past the tenth', () => {
    const w = newWorld('easy');
    expect(w.phase).toBe('build');
    expect(startWave(w)).toBe(true);
    expect(w.wave).toBe(1);
    expect(w.phase).toBe('running');
    expect(enemiesLeft(w)).toBe(6);
    expect(startWave(w)).toBe(false);
    const x = newWorld('easy');
    x.wave = 10;
    expect(startWave(x)).toBe(false);
  });
  it('seeds grow back one a second and a cleared wave pays 10 more', () => {
    const w = newWorld('medium');
    startWave(w);
    for (let t = 0; t < 20; t++) step(w);
    expect(w.seeds).toBeCloseTo(81, 9);
    const v = arena();
    v.seeds = 50;
    v.wave = 3;
    v.queue = [];
    addEnemy(v, 0, PATH_LENGTH - 0.01);
    const ev = step(v);
    expect(ev).toContainEqual({ type: 'clear', wave: 3, bonus: 10 });
    expect(v.phase).toBe('build');
    expect(v.seeds).toBeCloseTo(50 + REGROW_PER_SECOND * DT + WAVE_BONUS, 9);
  });
  it('clearing wave 10 wins, and the game stops', () => {
    const w = arena();
    w.wave = 10;
    w.queue = [];
    addEnemy(w, 0, PATH_LENGTH - 0.01);
    const ev = step(w);
    expect(ev).toContainEqual({ type: 'won' });
    expect(w.phase).toBe('won');
    expect(w.lives).toBe(DIFFICULTY.medium.lives - 1);
    expect(step(w)).toEqual([]);
    expect(wavesCleared(w)).toBe(10);
  });
  it('waves cleared counts only finished waves', () => {
    const w = newWorld('medium');
    expect(wavesCleared(w)).toBe(0);
    w.wave = 4;
    w.phase = 'running';
    expect(wavesCleared(w)).toBe(3);
    w.phase = 'build';
    expect(wavesCleared(w)).toBe(4);
    w.phase = 'lost';
    expect(wavesCleared(w)).toBe(3);
  });
});

describe('whole games', () => {
  // A sensible layout: [kind, column, row] in the order a player would buy them.
  const PLAN: [number, number, number][] = [
    [0, 3, 2], [2, 2, 2], [1, 4, 2], [0, 3, 4], [3, 5, 4], [0, 2, 4], [1, 4, 4], [3, 2, 0], [0, 5, 2], [2, 4, 4], [0, 1, 2], [1, 6, 4], [3, 3, 0], [0, 7, 4], [3, 5, 0],
  ];
  const play = (diff: Difficulty, plan: [number, number, number][]): { w: World; events: GameEvent[]; steps: number } => {
    const w = newWorld(diff);
    const events: GameEvent[] = [];
    let steps = 0;
    while (w.phase !== 'won' && w.phase !== 'lost' && steps < 200000) {
      for (const [k, c, r] of plan) {
        if (towerAt(w, c, r)) continue;
        if (canPlace(w, k, c, r)) place(w, k, c, r); else break;
      }
      if (w.phase === 'build') startWave(w);
      events.push(...step(w));
      steps += 1;
    }
    return { w, events, steps };
  };
  it('the same plants at the same moments give exactly the same game', () => {
    const a = play('medium', PLAN);
    const b = play('medium', PLAN);
    expect(JSON.stringify(a.w)).toBe(JSON.stringify(b.w));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.steps).toBe(b.steps);
  });
  it('a sensible layout wins on every difficulty, clearing all ten waves exactly once each', () => {
    for (const d of DIFFICULTIES) {
      const { w, events } = play(d, PLAN);
      expect(w.phase, d).toBe('won');
      expect(w.lives, d).toBeGreaterThan(0);
      expect(w.kills + w.leaks).toBe(138);
      expect(events.filter((e) => e.type === 'clear').map((e) => (e as { wave: number }).wave)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
      expect(events.filter((e) => e.type === 'pop')).toHaveLength(w.kills);
      expect(events.filter((e) => e.type === 'leak')).toHaveLength(w.leaks);
    }
  });
  it('with no plants at all, every difficulty is lost within a few waves', () => {
    for (const d of DIFFICULTIES) {
      const { w, events } = play(d, []);
      expect(w.phase, d).toBe('lost');
      expect(w.lives).toBe(0);
      expect(w.wave).toBeLessThanOrEqual(3);
      expect(events.filter((e) => e.type === 'lost')).toHaveLength(1);
    }
  });
  it('the plants matter: Sprouts alone, in the same places, lose the last wave on Hard', () => {
    const sprouts = PLAN.map(([, c, r]) => [0, c, r] as [number, number, number]);
    expect(play('hard', sprouts).w.phase).toBe('lost');
    expect(play('easy', sprouts).w.phase).toBe('won');
  });
  /** Check every rule about a world and say which one is broken ('' when none is). One cheap call per check keeps the fuzz fast. */
  const problem = (w: World): string => {
    if (!(w.seeds >= 0 && w.seeds <= MAX_SEEDS)) return `seeds ${w.seeds}`;
    if (!(Number.isInteger(w.lives) && w.lives >= 0 && w.lives <= DIFFICULTY[w.diff].lives)) return `lives ${w.lives}`;
    const cells = new Set<number>();
    const ids = new Set<number>();
    for (const t of w.towers) {
      if (!inGarden(t.col, t.row) || isPath(t.col, t.row)) return `plant on ${t.col},${t.row}`;
      if (cells.has(cellIndex(t.col, t.row))) return `two plants on ${t.col},${t.row}`;
      cells.add(cellIndex(t.col, t.row));
      if (!(t.cd >= 0 && t.cd <= TOWERS[t.kind].cooldown)) return `cooldown ${t.cd}`;
      if (ids.has(t.id)) return `id ${t.id}`;
      ids.add(t.id);
    }
    for (const e of w.enemies) {
      if (!(e.hp > 0)) return `blob hp ${e.hp}`;
      if (!(Number.isFinite(e.d) && e.d >= 0 && e.d < PATH_LENGTH)) return `blob at ${e.d}`;
      if (!(e.slow >= 0)) return `slow ${e.slow}`;
      if (ids.has(e.id)) return `id ${e.id}`;
      ids.add(e.id);
    }
    for (let i = 1; i < w.queue.length; i++) if (w.queue[i].tick < w.queue[i - 1].tick) return 'queue order';
    return '';
  };
  it('300 random games of random plants, sales and waves keep every invariant', () => {
    const rnd = lcg(99);
    for (let g = 0; g < 300; g++) {
      const w = newWorld(DIFFICULTIES[g % 3]);
      for (let op = 0; op < 400 && w.phase !== 'won' && w.phase !== 'lost'; op++) {
        const r = rnd();
        if (r < 0.1) place(w, Math.floor(rnd() * 5), Math.floor(rnd() * 9) - 1, Math.floor(rnd() * 7) - 1);
        else if (r < 0.14 && w.towers.length) sell(w, w.towers[Math.floor(rnd() * w.towers.length)].id);
        else if (r < 0.2) startWave(w);
        else for (let k = 0; k < 1 + Math.floor(rnd() * 20); k++) step(w);
        const bad = problem(w);
        if (bad) expect(bad).toBe('');
      }
    }
  });
});

describe('words, tones and the copy line', () => {
  it('say the right thing', () => {
    const w = newWorld('medium');
    place(w, 1, 3, 2);
    expect(plural(1, 'plant')).toBe('1 plant');
    expect(plural(2, 'plant')).toBe('2 plants');
    expect(cellLabel(w, 3, 2)).toBe('Row 3, column 4: Bloom');
    expect(cellLabel(w, 3, 1)).toBe('Row 2, column 4: path');
    expect(cellLabel(w, 0, 0)).toBe('Row 1, column 1: grass');
    expect(towerLabel(w.towers[0])).toBe('Bloom at row 3, column 4');
    expect(towerDetail(0)).toBe('Sprout: costs 25 seeds, reaches 2.5 cells, hits for 6 every 0.7 seconds.');
    expect(towerDetail(1)).toBe('Bloom: costs 50 seeds, reaches 2.2 cells, hits for 4 every 1.1 seconds. Also hits blobs within 1 cell for 3.');
    expect(towerDetail(2)).toBe('Frost bud: costs 35 seeds, reaches 2.4 cells, hits for 1 every 1 second. Slows blobs to half speed for 2 seconds.');
    expect(towerDetail(3)).toBe('Pepper pod: costs 75 seeds, reaches 3 cells, hits for 24 every 3 seconds. Also hits blobs within 1.2 cells for 10.');
    expect(towerDetail(9)).toBe('');
  });
  it('the end text and the copy line read right', () => {
    const w = newWorld('medium');
    w.phase = 'won';
    w.wave = 10;
    w.lives = 1;
    expect(overText(w)).toBe('You kept the garden safe through all 10 waves with 1 life left.');
    w.phase = 'lost';
    w.wave = 5;
    w.lives = 0;
    expect(overText(w)).toBe('The blobs got through on wave 5. You cleared 4 waves. Try again with the plants in different places.');
    expect(shareLine('medium', 10, true, 7)).toBe('Garden Defence (Medium): all 10 waves cleared with 7 lives left');
    expect(shareLine('hard', 4, false, 0)).toBe('Garden Defence (Hard): 4 of 10 waves cleared');
    expect(shareLine('easy', 0, false, 0)).toBe('Garden Defence (Easy): no waves cleared yet');
    for (const s of [shareLine('x' as Difficulty, NaN, false, NaN), shareLine('easy', -4, true, Infinity), overText(newWorld('hard'))]) {
      expect(s).not.toMatch(/NaN|undefined|null|Infinity/);
      expect(s.includes(EM_DASH)).toBe(false);
    }
  });
  it('tones are short and quiet', () => {
    for (const t of [placeTone(), leakTone(), waveTone(), ...[0, 1, 2, 3, 9, NaN].map(popTone)]) {
      expect(t.gain).toBeLessThanOrEqual(0.15);
      expect(t.ms).toBeLessThanOrEqual(200);
      expect(t.freq).toBeGreaterThan(100);
    }
  });
});

describe('what is saved: the most waves cleared on each difficulty', () => {
  it('reads good data and ignores junk', () => {
    expect(sanitiseStored(JSON.stringify({ easy: 10, medium: 6, hard: 2 }))).toEqual({ easy: 10, medium: 6, hard: 2 });
    expect(sanitiseStored({ medium: 3 })).toEqual({ easy: 0, medium: 3, hard: 0 });
    for (const bad of ['', 'not json', '[]', '"x"', 'null', null, undefined, 5, true, [], [1, 2], '{"easy":-1}', '{"easy":1.5}', '{"easy":"9"}', '{"easy":11}', '{"easy":null,"hard":NaN}']) {
      expect(sanitiseStored(bad as unknown)).toEqual(emptyStored());
    }
    expect(sanitiseStored({ easy: 11, medium: 10 })).toEqual({ easy: 0, medium: 10, hard: 0 });
  });
  it('is not fooled by __proto__ and extra keys, and returns a fresh object', () => {
    const evil = JSON.parse('{"__proto__":{"easy":9},"constructor":{"x":1},"easy":4,"extra":123}');
    const out = sanitiseStored(evil);
    expect(out).toEqual({ easy: 4, medium: 0, hard: 0 });
    expect(Object.keys(out).sort()).toEqual(['easy', 'hard', 'medium']);
    expect(({} as Record<string, unknown>).easy).toBeUndefined();
    const input = { easy: 1, medium: 2, hard: 3 };
    expect(sanitiseStored(input)).not.toBe(input);
    expect(cleanBest(0)).toBe(0);
    expect(cleanBest(10)).toBe(10);
  });
  it('records a better result only, keeps the difficulties apart and caps at ten', () => {
    let s = emptyStored();
    let r = recordBest(s, 'medium', 4);
    expect(r.newBest).toBe(true);
    s = r.stored;
    expect(s).toEqual({ easy: 0, medium: 4, hard: 0 });
    expect(recordBest(s, 'medium', 3)).toMatchObject({ newBest: false, stored: { medium: 4 } });
    expect(recordBest(s, 'medium', 4).newBest).toBe(false);
    expect(recordBest(s, 'hard', 2).stored).toEqual({ easy: 0, medium: 4, hard: 2 });
    expect(recordBest(s, 'medium', 99).stored.medium).toBe(4); // more than ten waves is not a real result
    expect(recordBest(s, 'medium', 10).stored.medium).toBe(10);
    expect(recordBest(s, 'medium', NaN).stored.medium).toBe(4);
    expect(recordBest(s, 'x' as Difficulty, 6).stored.medium).toBe(6);
    expect(sanitiseStored(JSON.stringify(toStorable({ easy: 3, medium: 2, hard: 1 })))).toEqual({ easy: 3, medium: 2, hard: 1 });
  });
});

describe('source hygiene and layout guards', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), 'src/components/apps-private/garden-defence', f), 'utf8');
  it('no Math.random anywhere in the game, and the engine does not read the clock', () => {
    for (const f of ['helpers.ts', 'Calculator.astro']) expect(read(f).includes('Math' + '.random'), f).toBe(false);
    expect(read('helpers.ts')).not.toMatch(/Date\.now|new Date|performance\.now/);
  });
  it('the buttons are at least 56 px (3.5rem) tall, the garden squares at least 28 px, and the rules summary is at least 2rem', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/\.gdf-btn \{[^}]*min-height: 3\.5rem;/);
    expect(text).toMatch(/\.gdf-cell \{[^}]*min-width: 1\.75rem;/);
    expect(text).toMatch(/#gdf-app \.gdf-how > summary \{[^}]*min-height: 2rem;/);
  });
  it('sound starts off, the game can be paused and slowed', () => {
    const text = read('Calculator.astro');
    expect(text).toMatch(/let soundOn = false;/);
    expect(text).toMatch(/id="gdf-pause"/);
    expect(text).toMatch(/id="gdf-speed"/);
  });
});
