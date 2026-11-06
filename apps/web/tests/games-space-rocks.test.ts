/**
 * games-space-rocks.test.ts - the engine behind `space-rocks`.
 *
 * Pinned: a fixed 1/60 s step; the ship turns at exactly 4.2 rad/s, thrusts at 190 units/s squared, loses
 * 35 percent of its speed a second when coasting and never exceeds 260; everything wraps on both axes and the
 * wrap-aware distance matches a brute-force check over the nine shifted copies; bullets live 0.85 s, fire
 * every 0.2 s and are capped per level; the swept bullet test agrees with a brute-force sampled path (and a
 * fast bullet cannot tunnel through a small rock); a hit rock scores 20 / 50 / 100 and splits into two of
 * the next size down (none for the smallest); new waves never appear within 120 units of the ship; a
 * crash costs a life, the ship returns untouchable and an extra life comes every 3000 points; 4000 random
 * input steps on every level never break an invariant; a simple turret pilot that only turns and fires
 * clears the opening waves; the clock plays the same run on any screen; best scores reject junk; and the
 * page keeps what it promises.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, begin, step, spawnWave, splitRock, sweptHit, wrap, wrapDelta, torusDist, segOriginDist2, makeShape, hitRadius, speedFactor, rocksInWave,
  keyToControl, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest, describeState, endMessage, shareText, plural, isLevel, mulberry32,
  centreShip,
  W, H, DT, SHIP_R, SHIP_HIT, TURN, THRUST, MAX_SPEED, DRAG, BULLET_SPEED, BULLET_LIFE, FIRE_COOLDOWN, RESPAWN_DELAY, INVULN, CLEAR_R, WAVE_DELAY, SAFE_RADIUS,
  MAX_LIVES, LIFE_EVERY, MAX_LARGE, ROCK_R, ROCK_POINTS, ROCK_SPEED, HIT_FACTOR, SHAPE_POINTS, SHAPE_MIN, PARAMS, SLOW_FACTOR, MAX_SCORE, LEVELS, SFX, PEAK_GAIN,
  NO_INPUT,
  type GameState, type Level, type Input, type Rock, type Bullet,
} from '../src/components/apps-private/space-rocks/helpers';
import calculatorSource from '../src/components/apps-private/space-rocks/Calculator.astro?raw';

const rock = (over: Partial<Rock> = {}): Rock => ({
  id: 900, x: 100, y: 100, vx: 0, vy: 0, size: 3, rot: 0, spin: 0, shape: new Array(SHAPE_POINTS).fill(1), ...over,
});

/** A running game with only the rocks, bullets and ship the test puts in. */
const scene = (over: Partial<GameState> = {}, level: Level = 'medium'): GameState => ({
  ...begin(newGame(level, false, mulberry32(1))), rocks: [], bullets: [], ...over,
});

const ship0 = centreShip();

describe('the world and the levels', () => {
  it('is a 480 x 360 world with a fixed 1/60 s step', () => {
    expect([W, H]).toEqual([480, 360]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect([SHIP_R, SHIP_HIT, TURN, THRUST, MAX_SPEED, DRAG]).toEqual([11, 8, 4.2, 190, 260, 0.35]);
    expect([BULLET_SPEED, BULLET_LIFE, FIRE_COOLDOWN, RESPAWN_DELAY, INVULN, WAVE_DELAY, SAFE_RADIUS, LIFE_EVERY, MAX_LIVES]).toEqual([340, 0.85, 0.2, 1.4, 2.2, 1.6, 120, 3000, 9]);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
  });
  it('gets harder level by level: fewer lives, faster rocks, more rocks', () => {
    expect(PARAMS.easy.lives).toBe(5);
    expect(PARAMS.medium.lives).toBe(3);
    expect(PARAMS.hard.lives).toBe(3);
    expect(PARAMS.easy.rockSpeed).toBeLessThan(PARAMS.medium.rockSpeed);
    expect(PARAMS.medium.rockSpeed).toBeLessThan(PARAMS.hard.rockSpeed);
    expect(PARAMS.easy.baseRocks).toBeLessThan(PARAMS.hard.baseRocks);
    expect(PARAMS.easy.maxBullets).toBeGreaterThanOrEqual(PARAMS.hard.maxBullets);
  });
  it('rock sizes score 20, 50 and 100 and shrink 30, 18, 10', () => {
    expect(ROCK_POINTS).toEqual({ 3: 20, 2: 50, 1: 100 });
    expect(ROCK_R).toEqual({ 3: 30, 2: 18, 1: 10 });
    expect(HIT_FACTOR).toBe(0.9);
    expect(hitRadius(rock({ size: 2 }))).toBeCloseTo(16.2, 9);
    expect(SHAPE_MIN).toBe(0.76);
  });
  it('reduced motion slows rocks by 20 percent and changes nothing else', () => {
    expect(SLOW_FACTOR).toBe(0.8);
    for (const l of LEVELS) expect(speedFactor(l, true, 1)).toBeCloseTo(speedFactor(l, false, 1) * 0.8, 9);
    expect(isLevel('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 3]) expect(isLevel(bad as unknown)).toBe(false);
  });
  it('rocks speed up with the waves, by at most 50 percent, and the wave size is capped', () => {
    expect(speedFactor('medium', false, 1)).toBe(1);
    expect(speedFactor('medium', false, 6)).toBeCloseTo(1.2, 9);
    expect(speedFactor('medium', false, 500)).toBeCloseTo(1.5, 9);
    expect(rocksInWave('easy', 1)).toBe(3);
    expect(rocksInWave('medium', 3)).toBe(6);
    expect(rocksInWave('hard', 999)).toBe(MAX_LARGE);
  });
});

describe('wrapping geometry', () => {
  it('wrap puts every number in [0, size)', () => {
    for (const v of [-1000.5, -480, -1, 0, 1, 479.99, 480, 481, 1e6]) {
      const r = wrap(v, 480);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(480);
    }
    expect(wrap(-1, 480)).toBe(479);
    expect(wrap(481, 480)).toBe(1);
  });
  it('wrapDelta is the shortest signed distance, checked against a brute force over the shifted copies', () => {
    const rng = mulberry32(5);
    for (let n = 0; n < 3000; n++) {
      const a = rng() * 480;
      const b = rng() * 480;
      let best = Infinity;
      for (const k of [-1, 0, 1]) { const d = a - b + k * 480; if (Math.abs(d) < Math.abs(best)) best = d; }
      expect(wrapDelta(a, b, 480)).toBeCloseTo(best, 9);
    }
    expect(wrapDelta(5, 475, 480)).toBeCloseTo(10, 9);
    expect(wrapDelta(475, 5, 480)).toBeCloseTo(-10, 9);
  });
  it('torusDist sees across the edge', () => {
    expect(torusDist(2, 2, 478, 358)).toBeCloseTo(Math.hypot(4, 4), 9);
    expect(torusDist(0, 0, 240, 180)).toBeCloseTo(Math.hypot(240, 180), 9);
  });
  it('segOriginDist2 is the squared distance from the origin to a segment', () => {
    expect(segOriginDist2(-5, 3, 5, 3)).toBeCloseTo(9, 9);
    expect(segOriginDist2(2, 0, 6, 0)).toBeCloseTo(4, 9);
    expect(segOriginDist2(1, 1, 1, 1)).toBeCloseTo(2, 9);
  });
});

describe('the ship', () => {
  const rng = () => 0.5;
  it('does nothing until the run begins', () => {
    const s = newGame('medium', false, mulberry32(1));
    expect(s.status).toBe('ready');
    expect(step(s, { ...NO_INPUT, thrust: true }, rng)).toBe(s);
    expect(begin(s).status).toBe('running');
  });
  it('turns at exactly 4.2 radians a second, either way', () => {
    let s = scene({ ship: { ...ship0, invuln: 99 } });
    for (let i = 0; i < 60; i++) s = step(s, { ...NO_INPUT, right: true }, rng);
    expect(s.ship.a).toBeCloseTo(4.2, 6);
    let t = scene({ ship: { ...ship0, invuln: 99 } });
    for (let i = 0; i < 60; i++) t = step(t, { ...NO_INPUT, left: true }, rng);
    expect(t.ship.a).toBeCloseTo(2 * Math.PI - 4.2, 6);
    // both keys cancel out
    let u = scene({ ship: { ...ship0 } });
    u = step(u, { ...NO_INPUT, left: true, right: true }, rng);
    expect(u.ship.a).toBe(0);
  });
  it('thrust adds 190 units/s^2 along the nose, drag removes 35 percent of the speed a second', () => {
    let s = scene({ ship: { ...ship0 } });
    s = step(s, { ...NO_INPUT, thrust: true }, rng);
    expect(s.ship.vx).toBeCloseTo(0, 9);
    expect(s.ship.vy).toBeCloseTo(-THRUST * DT * Math.exp(-DRAG * DT), 9);
    expect(s.ship.thrusting).toBe(true);
    // pointing right
    let r = scene({ ship: { ...ship0, a: Math.PI / 2 } });
    r = step(r, { ...NO_INPUT, thrust: true }, rng);
    expect(r.ship.vx).toBeGreaterThan(0);
    expect(Math.abs(r.ship.vy)).toBeLessThan(1e-9);
    // coasting
    let c = scene({ ship: { ...ship0, vx: 100, vy: 0 } });
    for (let i = 0; i < 60; i++) c = step(c, NO_INPUT, rng);
    expect(c.ship.vx).toBeCloseTo(100 * Math.exp(-DRAG), 6);
    expect(c.ship.thrusting).toBe(false);
  });
  it('never goes faster than 260, however long the thrust', () => {
    let s = scene({ ship: { ...ship0 } });
    let top = 0;
    for (let i = 0; i < 1200; i++) {
      s = step({ ...s, ship: { ...s.ship, invuln: 99 } }, { ...NO_INPUT, thrust: true }, rng);
      top = Math.max(top, Math.hypot(s.ship.vx, s.ship.vy));
    }
    expect(top).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    expect(top).toBeGreaterThan(MAX_SPEED * 0.8);
  });
  it('wraps around both edges', () => {
    let s = scene({ ship: { ...ship0, x: 479, y: 1, vx: 120, vy: -120, invuln: 99 } });
    s = step(s, NO_INPUT, rng);
    expect(s.ship.x).toBeLessThan(5);
    expect(s.ship.y).toBeGreaterThan(355);
  });
  it('a dead ship does not move, turn or shoot', () => {
    let s = scene({ ship: { ...ship0, alive: false, respawn: 5 } });
    s = step(s, { left: true, right: false, thrust: true, fire: true }, rng);
    expect(s.ship.a).toBe(0);
    expect(s.bullets.length).toBe(0);
    expect(s.ship.alive).toBe(false);
  });
});

describe('shooting', () => {
  const rng = () => 0.5;
  it('a shot leaves the nose at 340 units/s plus the ship speed and lives 0.85 s', () => {
    let s = scene({ ship: { ...ship0, vx: 30, invuln: 99 } });
    s = step(s, { ...NO_INPUT, fire: true }, rng);
    expect(s.bullets.length).toBe(1);
    expect(s.events).toContain('fire');
    const b = s.bullets[0];
    expect(b.vx).toBeCloseTo(30 * Math.exp(-DRAG * DT), 6);
    expect(b.vy).toBeCloseTo(-BULLET_SPEED, 6);
    expect(b.life).toBeCloseTo(BULLET_LIFE - DT, 9);
    let t = s;
    let steps = 1;
    while (t.bullets.length > 0 && steps < 200) { t = step(t, NO_INPUT, rng); steps++; }
    expect(steps * DT).toBeGreaterThanOrEqual(BULLET_LIFE - 2 * DT);
    expect(steps * DT).toBeLessThanOrEqual(BULLET_LIFE + 2 * DT);
  });
  it('fires at most once every 0.2 s, even with the button held', () => {
    let s = scene({ ship: { ...ship0, invuln: 99 } });
    let shots = 0;
    for (let i = 0; i < 120; i++) { s = step(s, { ...NO_INPUT, fire: true }, rng); if (s.events.includes('fire')) shots++; }
    expect(shots).toBeGreaterThanOrEqual(9);
    expect(shots).toBeLessThanOrEqual(11);
  });
  it('is capped per level on shots in the air', () => {
    for (const l of LEVELS) {
      let s = scene({ ship: { ...ship0, invuln: 99 } }, l);
      let most = 0;
      for (let i = 0; i < 300; i++) { s = step(s, { ...NO_INPUT, fire: true }, rng); most = Math.max(most, s.bullets.length); }
      expect(most, l).toBeLessThanOrEqual(PARAMS[l].maxBullets);
      expect(most, l).toBeGreaterThanOrEqual(3);
    }
  });
  it('bullets wrap around the screen', () => {
    const b: Bullet = { x: 1, y: 100, vx: -300, vy: 0, life: 0.5 };
    const s = step(scene({ bullets: [b], ship: { ...ship0, invuln: 99 } }), NO_INPUT, rng);
    expect(s.bullets[0].x).toBeGreaterThan(470);
  });
});

describe('bullets against rocks', () => {
  it('sweptHit matches a brute-force sampled path on 3000 random cases', () => {
    const rng = mulberry32(77);
    let hits = 0;
    for (let n = 0; n < 3000; n++) {
      const r = rock({ x: rng() * W, y: rng() * H, vx: (rng() - 0.5) * 160, vy: (rng() - 0.5) * 160, size: (1 + Math.floor(rng() * 3)) as 1 | 2 | 3 });
      const ang = rng() * Math.PI * 2;
      const sp = 150 + rng() * 300;
      const b: Bullet = { x: wrap(r.x + (rng() - 0.5) * 40, W), y: wrap(r.y + (rng() - 0.5) * 40, H), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1 };
      const rad = hitRadius(r);
      // sample the relative path finely
      let brute = false;
      const ex = wrapDelta(b.x, r.x, W);
      const ey = wrapDelta(b.y, r.y, H);
      const mx = (b.vx - r.vx) * DT;
      const my = (b.vy - r.vy) * DT;
      for (let k = 0; k <= 400; k++) {
        const f = k / 400;
        if (Math.hypot(ex - mx * (1 - f), ey - my * (1 - f)) <= rad) { brute = true; break; }
      }
      const fast = sweptHit(b, r, rad, DT);
      if (fast) hits++;
      if (brute) expect(fast).toBe(true);
      if (fast && !brute) {
        // a graze between two samples: the path comes within a hair of the circle
        const px = ex - mx * 0.5;
        const py = ey - my * 0.5;
        expect(Math.hypot(px, py)).toBeLessThan(rad + Math.hypot(mx, my));
      }
    }
    expect(hits).toBeGreaterThan(150);
    expect(hits).toBeLessThan(2500);
  });
  it('a fast bullet cannot tunnel through the smallest rock', () => {
    // a bullet crossing a small rock head on at top speed moves 8.7 units a step; the rock is 18 wide
    const rng = () => 0.5;
    for (let off = -8; off <= 8; off += 1) {
      const r = rock({ size: 1, x: 200, y: 100 + off, vx: 0, vy: 0 });
      let s = scene({ rocks: [r], bullets: [{ x: 150, y: 100, vx: 520, vy: 0, life: 0.9 }], ship: { ...ship0, invuln: 99 } });
      let hit = false;
      for (let i = 0; i < 30 && !hit; i++) { s = step(s, NO_INPUT, rng); if (s.kills > 0) hit = true; }
      expect(hit, `offset ${off}`).toBe(true);
    }
  });
  it('a hit scores by size, removes the bullet and splits the rock into two of the next size down', () => {
    const rng = mulberry32(3);
    for (const size of [3, 2, 1] as const) {
      const r = rock({ size, x: 200, y: 100, vx: 10, vy: 0 });
      let s = scene({ rocks: [r], bullets: [{ x: 196, y: 100, vx: 0, vy: 0, life: 0.5 }], ship: { ...ship0, invuln: 99 } });
      s = step(s, NO_INPUT, rng);
      expect(s.score).toBe(ROCK_POINTS[size]);
      expect(s.kills).toBe(1);
      expect(s.bullets.length).toBe(0);
      expect(s.events).toContain(`boom${size}`);
      if (size === 1) expect(s.rocks.length).toBe(0);
      else {
        expect(s.rocks.length).toBe(2);
        for (const k of s.rocks) expect(k.size).toBe(size - 1);
        expect(new Set(s.rocks.map((k) => k.id)).size).toBe(2);
      }
    }
  });
  it('one bullet breaks one rock, and a rock breaks only once', () => {
    const a = rock({ id: 1, x: 200, y: 100, size: 1 });
    const b = rock({ id: 2, x: 203, y: 100, size: 1 });
    let s = scene({ rocks: [a, b], bullets: [{ x: 201, y: 100, vx: 0, vy: 0, life: 0.5 }], ship: { ...ship0, invuln: 99 } });
    s = step(s, NO_INPUT, () => 0.5);
    expect(s.kills).toBe(1);
    expect(s.rocks.length).toBe(1);
    // two bullets on one rock still break it once
    s = scene({ rocks: [rock({ size: 1, x: 200, y: 100 })], bullets: [{ x: 199, y: 100, vx: 0, vy: 0, life: 0.5 }, { x: 201, y: 100, vx: 0, vy: 0, life: 0.5 }], ship: { ...ship0, invuln: 99 } });
    s = step(s, NO_INPUT, () => 0.5);
    expect(s.kills).toBe(1);
    expect(s.score).toBe(100);
    expect(s.bullets.length).toBe(1);
  });
  it('splitRock gives two rocks that fly apart, each a plausible speed for its size', () => {
    const rng = mulberry32(9);
    for (let n = 0; n < 200; n++) {
      const size = (2 + (n % 2)) as 2 | 3;
      const parent = rock({ size, vx: (rng() - 0.5) * 80, vy: (rng() - 0.5) * 80 });
      const kids = splitRock(parent, 1, 10, rng);
      expect(kids.length).toBe(2);
      const down = (size - 1) as 1 | 2;
      for (const k of kids) {
        expect(k.size).toBe(down);
        const sp = Math.hypot(k.vx, k.vy);
        expect(sp).toBeGreaterThanOrEqual(ROCK_SPEED[down] * 0.8 - 1e-9);
        expect(sp).toBeLessThanOrEqual(ROCK_SPEED[down] * 1.3 + 1e-9);
      }
      expect(kids[0].id).toBe(10);
      expect(kids[1].id).toBe(11);
      // the two go different ways
      expect(Math.abs(Math.atan2(kids[0].vy, kids[0].vx) - Math.atan2(kids[1].vy, kids[1].vx))).toBeGreaterThan(0.3);
    }
    expect(splitRock(rock({ size: 1 }), 1, 1, rng)).toEqual([]);
  });
  it('rock outlines are blobby: ten vertices, each between 76 and 100 percent of the nominal radius', () => {
    const rng = mulberry32(2);
    for (let n = 0; n < 100; n++) {
      const sh = makeShape(rng);
      expect(sh.length).toBe(SHAPE_POINTS);
      for (const v of sh) { expect(v).toBeGreaterThanOrEqual(SHAPE_MIN); expect(v).toBeLessThanOrEqual(1); }
      // never a regular polygon
      expect(Math.max(...sh) - Math.min(...sh)).toBeGreaterThan(0.04);
    }
  });
});

describe('waves', () => {
  it('starts with wave 1 on the screen, ready to play, with no rock near the ship', () => {
    for (const l of LEVELS) for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(l, false, mulberry32(seed));
      expect(s.wave).toBe(1);
      expect(s.rocks.length).toBe(PARAMS[l].baseRocks);
      expect(s.lives).toBe(PARAMS[l].lives);
      for (const r of s.rocks) { expect(r.size).toBe(3); expect(torusDist(W / 2, H / 2, r.x, r.y)).toBeGreaterThanOrEqual(SAFE_RADIUS - 1e-6); }
    }
  });
  it('spawnWave keeps SAFE_RADIUS from a ship anywhere on the screen', () => {
    const rng = mulberry32(8);
    for (let n = 0; n < 500; n++) {
      const cx = rng() * W;
      const cy = rng() * H;
      const wave = 1 + Math.floor(rng() * 12);
      const rocks = spawnWave('hard', false, wave, cx, cy, rng, 1);
      expect(rocks.length).toBe(rocksInWave('hard', wave));
      for (const r of rocks) expect(torusDist(cx, cy, r.x, r.y)).toBeGreaterThanOrEqual(SAFE_RADIUS - 1e-6);
    }
  });
  it('an empty sky brings the next wave after 1.6 s, bigger and faster', () => {
    let s = scene({ rocks: [], wave: 1, waveTimer: -1, ship: { ...ship0, invuln: 99 } });
    const rng = mulberry32(4);
    let sawClear = false;
    let n = 0;
    while (s.wave === 1 && n < 400) { s = step(s, NO_INPUT, rng); if (s.events.includes('clear')) sawClear = true; n++; }
    expect(sawClear).toBe(true);
    expect(s.wave).toBe(2);
    expect(Math.abs(n * DT - WAVE_DELAY)).toBeLessThan(0.1);
    expect(s.rocks.length).toBe(rocksInWave('medium', 2));
    expect(s.events).toContain('wave');
  });
});

describe('losing and winning lives', () => {
  const rng = () => 0.5;
  it('a rock hitting the ship costs a life, breaks the rock and removes the ship for a moment', () => {
    const s0 = scene({ rocks: [rock({ size: 2, x: W / 2 + 12, y: H / 2 })], ship: { ...ship0 } });
    const s = step(s0, NO_INPUT, mulberry32(1));
    expect(s.lives).toBe(PARAMS.medium.lives - 1);
    expect(s.ship.alive).toBe(false);
    expect(s.events).toContain('lost');
    expect(s.score).toBe(0);
    expect(s.rocks.length).toBe(2); // the medium rock split into two small ones
    expect(s.status).toBe('running');
  });
  it('a rock just out of reach does not', () => {
    const reach = hitRadius(rock({ size: 2 })) + SHIP_HIT;
    expect(step(scene({ rocks: [rock({ size: 2, x: W / 2 + reach + 2, y: H / 2 })] }), NO_INPUT, rng).ship.alive).toBe(true);
    expect(step(scene({ rocks: [rock({ size: 2, x: W / 2 + reach - 2, y: H / 2 })] }), NO_INPUT, rng).ship.alive).toBe(false);
  });
  it('the returning ship cannot be hit for 2.2 s', () => {
    const r = rock({ size: 3, x: W / 2, y: H / 2 });
    let s = scene({ rocks: [r], ship: { ...ship0, invuln: INVULN } });
    for (let i = 0; i < Math.floor(INVULN / DT) - 2; i++) s = step({ ...s, rocks: [{ ...r }] }, NO_INPUT, rng);
    expect(s.ship.alive).toBe(true);
    expect(s.lives).toBe(PARAMS.medium.lives);
    s = step({ ...s, ship: { ...s.ship, invuln: 0 }, rocks: [{ ...r }] }, NO_INPUT, rng);
    expect(s.ship.alive).toBe(false);
  });
  it('after 1.4 s the ship comes back to the middle, untouchable, once the middle is clear', () => {
    let s = scene({ ship: { ...ship0, alive: false, respawn: RESPAWN_DELAY, x: 10, y: 10 }, lives: 2, rocks: [] });
    let n = 0;
    while (!s.ship.alive && n < 300) { s = step(s, NO_INPUT, rng); n++; }
    expect(Math.abs(n * DT - RESPAWN_DELAY)).toBeLessThan(0.05);
    expect(s.ship.x).toBe(W / 2);
    expect(s.ship.y).toBe(H / 2);
    expect(s.ship.invuln).toBeGreaterThan(INVULN - 0.1);
    expect(s.events).toContain('return');
  });
  it('waits for room, then returns anyway after 3 more seconds (it is untouchable)', () => {
    const blocker = rock({ size: 3, x: W / 2 + 20, y: H / 2, vx: 0, vy: 0 });
    let s = scene({ ship: { ...ship0, alive: false, respawn: RESPAWN_DELAY }, lives: 2, rocks: [blocker] });
    let n = 0;
    while (!s.ship.alive && n < 2000) { s = step({ ...s, rocks: [{ ...blocker }] }, NO_INPUT, rng); n++; }
    expect(n * DT).toBeGreaterThan(RESPAWN_DELAY + 2.5);
    expect(n * DT).toBeLessThan(RESPAWN_DELAY + 3.5);
    expect(s.ship.alive).toBe(true);
    expect(s.ship.invuln).toBeGreaterThan(0);
    expect(CLEAR_R).toBe(70);
  });
  it('losing the last life ends the run', () => {
    const s = step(scene({ lives: 1, rocks: [rock({ size: 1, x: W / 2, y: H / 2 })] }), NO_INPUT, mulberry32(1));
    expect(s.status).toBe('over');
    expect(s.lives).toBe(0);
    expect(step(s, { ...NO_INPUT, fire: true }, rng)).toBe(s);
  });
  it('an extra life comes at every 3000 points, up to 9 lives, and only once per threshold', () => {
    let s = scene({ score: 2990, nextLife: LIFE_EVERY, lives: 3, rocks: [rock({ size: 3, x: 200, y: 100 })], bullets: [{ x: 199, y: 100, vx: 0, vy: 0, life: 0.5 }], ship: { ...ship0, invuln: 99 } });
    s = step(s, NO_INPUT, mulberry32(1));
    expect(s.score).toBe(3010);
    expect(s.lives).toBe(4);
    expect(s.nextLife).toBe(6000);
    expect(s.events).toContain('life');
    const t = step(scene({ score: 2990, nextLife: LIFE_EVERY, lives: MAX_LIVES, rocks: [rock({ size: 3, x: 200, y: 100 })], bullets: [{ x: 199, y: 100, vx: 0, vy: 0, life: 0.5 }], ship: { ...ship0, invuln: 99 } }), NO_INPUT, mulberry32(1));
    expect(t.lives).toBe(MAX_LIVES);
    expect(t.nextLife).toBe(6000);
  });
});

describe('purity and determinism', () => {
  it('does not change the state it was given', () => {
    const s = scene({ rocks: newGame('hard', false, mulberry32(2)).rocks, bullets: [{ x: 50, y: 50, vx: 100, vy: 0, life: 0.5 }] });
    const before = JSON.stringify(s);
    step(s, { left: true, right: false, thrust: true, fire: true }, mulberry32(9));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('the same seed and the same keys replay the same run, a different seed does not', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let s = begin(newGame('medium', false, rng));
      const trace: string[] = [];
      for (let i = 0; i < 900; i++) {
        s = step(s, { left: i % 70 < 20, right: false, thrust: i % 90 < 30, fire: i % 7 === 0 }, rng);
        trace.push(`${s.ship.x.toFixed(5)}|${s.rocks.length}|${s.score}|${s.rocks[0]?.x.toFixed(4)}`);
      }
      return trace;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77)).not.toEqual(play(78));
  });
  it('survives bad time steps', () => {
    const s = scene({ ship: { ...ship0, invuln: 99 } });
    for (const dt of [NaN, -1, 0, Infinity, 5]) {
      const t = step(s, { ...NO_INPUT, thrust: true }, () => 0.5, dt);
      expect(Number.isFinite(t.ship.x)).toBe(true);
      expect(Number.isFinite(t.ship.vy)).toBe(true);
    }
  });
});

describe('4000 random steps on every level never break an invariant', () => {
  for (const level of LEVELS) {
    it(level, () => {
      const rng = mulberry32(level.length * 31);
      const inRng = mulberry32(1234 + level.length);
      let s = begin(newGame(level, level === 'hard', rng));
      let lastScore = 0;
      let hold: Input = { ...NO_INPUT };
      for (let i = 0; i < 4000 && s.status === 'running'; i++) {
        if (i % 12 === 0) hold = { left: inRng() < 0.3, right: inRng() < 0.3, thrust: inRng() < 0.5, fire: inRng() < 0.7 };
        s = step(s, hold, rng);
        for (const v of [s.ship.x, s.ship.y, s.ship.vx, s.ship.vy, s.ship.a, s.score, s.lives]) expect(Number.isFinite(v)).toBe(true);
        expect(s.ship.x).toBeGreaterThanOrEqual(0);
        expect(s.ship.x).toBeLessThan(W);
        expect(s.ship.y).toBeGreaterThanOrEqual(0);
        expect(s.ship.y).toBeLessThan(H);
        expect(s.bullets.length).toBeLessThanOrEqual(PARAMS[level].maxBullets);
        expect(s.score).toBeGreaterThanOrEqual(lastScore);
        expect(s.lives).toBeGreaterThanOrEqual(0);
        expect(s.lives).toBeLessThanOrEqual(MAX_LIVES);
        expect(s.rocks.length).toBeLessThanOrEqual(MAX_LARGE * 4);
        for (const r of s.rocks) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.x).toBeLessThan(W);
          expect([1, 2, 3]).toContain(r.size);
        }
        expect(new Set(s.rocks.map((r) => r.id)).size).toBe(s.rocks.length);
        lastScore = s.score;
      }
      expect(s.steps).toBeGreaterThan(300);
    }, 60_000);
  }
});

describe('a simple pilot can play it', () => {
  /** Knows only where the nearest rock is: turn toward it and fire when lined up. Never thrusts. */
  const turret = (s: GameState): Input => {
    const sh = s.ship;
    if (!sh.alive || s.rocks.length === 0) return NO_INPUT;
    let best: Rock | null = null;
    let bd = Infinity;
    for (const r of s.rocks) { const d = torusDist(sh.x, sh.y, r.x, r.y); if (d < bd) { bd = d; best = r; } }
    if (!best) return NO_INPUT;
    const dx = wrapDelta(best.x, sh.x, W);
    const dy = wrapDelta(best.y, sh.y, H);
    const want = Math.atan2(dx, -dy);
    const diff = wrapDelta(want, sh.a, Math.PI * 2);
    return { left: diff < -0.04, right: diff > 0.04, thrust: false, fire: Math.abs(diff) < 0.12 };
  };

  it('a turret pilot clears wave 1 on most seeds at every level, so no wave is a trap', () => {
    for (const level of LEVELS) {
      let cleared = 0;
      const seeds = 20;
      for (let seed = 1; seed <= seeds; seed++) {
        const rng = mulberry32(seed * 977 + level.length);
        let s = begin(newGame(level, false, rng));
        for (let i = 0; i < 60 * 150 && s.status === 'running' && s.wave === 1; i++) s = step(s, turret(s), rng);
        if (s.wave >= 2) cleared++;
      }
      expect(cleared, `${level}: ${cleared} of ${seeds}`).toBeGreaterThanOrEqual(level === 'hard' ? 12 : 15);
    }
  }, 120_000);

  it('the same pilot with no shooting scores nothing and does not clear a wave', () => {
    const rng = mulberry32(5);
    let s = begin(newGame('medium', false, rng));
    for (let i = 0; i < 60 * 30 && s.status === 'running'; i++) s = step(s, NO_INPUT, rng);
    expect(s.score).toBe(0);
    expect(s.wave).toBe(1);
  });
});

describe('input, keys and the clock', () => {
  it('maps keys to controls and nothing else', () => {
    expect(keyToControl('ArrowLeft')).toBe('left');
    expect(keyToControl('a')).toBe('left');
    expect(keyToControl('ArrowRight')).toBe('right');
    expect(keyToControl('D')).toBe('right');
    expect(keyToControl('ArrowUp')).toBe('thrust');
    expect(keyToControl('w')).toBe('thrust');
    expect(keyToControl(' ')).toBe('fire');
    for (const k of ['Enter', 'ArrowDown', 's', 'p', 'Escape', 'x', '', 'Tab']) expect(keyToControl(k), k).toBeNull();
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
  it('a long stall cannot fast-forward the run, and bad numbers are safe', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(r.acc).toBeLessThan(1000 / 60);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
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
    expect(parseBests({ medium: 1200, hard: '9', easy: 1.5, 'easy-slow': -3, nope: 4, 'hard-slow': MAX_SCORE + 1 })).toEqual({ medium: 1200 });
    expect(parseBests(JSON.parse('{"__proto__":{"hard":50},"hard":7}'))).toEqual({ hard: 7 });
  });
  it('only a whole, positive, possible score can set a best, and only if higher', () => {
    const k = bestKey('medium', false);
    let r = recordBest({}, k, 700);
    expect(r).toEqual({ bests: { [k]: 700 }, improved: true });
    expect(recordBest(r.bests, k, 700).improved).toBe(false);
    expect(recordBest(r.bests, k, 300).improved).toBe(false);
    r = recordBest(r.bests, k, 800);
    expect(r.bests[k]).toBe(800);
    for (const bad of [0, -1, 2.5, NaN, Infinity, MAX_SCORE + 1]) expect(recordBest({}, k, bad).improved, String(bad)).toBe(false);
    expect(recordBest({}, 'bogus', 5).improved).toBe(false);
  });
});

describe('messages and sound', () => {
  const over = (score: number, kills: number, wave: number): GameState => ({ ...newGame('medium', false, mulberry32(1)), status: 'over', score, kills, wave, lives: 0 });
  it('say what happened and praise what the player did', () => {
    expect(endMessage(over(1240, 17, 3))).toBe('The ship is out of lives. You scored 1240 and broke up 17 rocks in 3 waves.');
    expect(endMessage(over(100, 1, 1))).toBe('The ship is out of lives. You scored 100 and broke up 1 rock in 1 wave.');
    expect(endMessage(over(0, 0, 1))).toBe('The ship is out of lives. No rocks this time, so try again!');
    expect(endMessage(newGame('medium', false, mulberry32(1)))).toBe('');
  });
  it('builds a share line that is right before, during and after a run', () => {
    expect(shareText('medium', null, 0)).toBe('Space Rocks (Medium): no run finished yet');
    expect(shareText('easy', { score: 0, wave: 1 }, 0)).toBe('Space Rocks (Easy): 0 points, wave 1');
    expect(shareText('hard', { score: 900, wave: 2 }, 1500)).toBe('Space Rocks (Hard): 900 points, wave 2, best 1500');
    for (const t of [shareText('easy', { score: 3, wave: 1 }, 3), describeState(newGame('hard', false, mulberry32(1)))]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
  });
  it('describes the sky for a screen reader with plurals that are right', () => {
    const s = newGame('easy', false, mulberry32(1));
    expect(describeState(s)).toBe('Space Rocks. Score 0, 5 lives left, wave 1, 3 rocks in the sky.');
    expect(describeState({ ...s, lives: 1, rocks: s.rocks.slice(0, 1) })).toBe('Space Rocks. Score 0, 1 life left, wave 1, 1 rock in the sky.');
    expect(plural(1, 'rock', 'rocks')).toBe('1 rock');
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
  it('the touch buttons are at least 56 px and the how-it-works heading is a 32 px target', () => {
    const hold = src.match(/#srk-app \.srk-hold \{([^}]*)\}/);
    expect(hold).not.toBeNull();
    expect(hold![1]).toContain('min-height: 3.5rem');
    expect(hold![1]).toContain('min-width: 3.5rem');
    const rule = src.match(/\.srk-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect((src.match(/data-ctl="/g) ?? []).length).toBe(4);
  });
  it('pauses on Escape, P and a hidden tab, and honours reduced motion', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('if (mq.matches) return;'); // no sparks
  });
  it('does not trap keys when paused or finished with focus elsewhere, and ignores key repeat', () => {
    expect(src).toContain('keyScope(phase, app.contains(document.activeElement))');
    expect(src).toContain("if (scope !== 'all') return;");
    expect(src).toContain('if (e.repeat) return;');
    expect(src).toContain('spaceIsNative(t.tagName)');
  });
  it('sound is off until the button is pressed and the audio context is only created then', () => {
    expect(src).toContain('let soundOn = false;');
    expect(src).toContain('aria-pressed="false"');
    expect(src).not.toMatch(/^\s*(const|let)\s+actx\s*=\s*new/m);
    expect(src).toContain('PEAK_GAIN');
  });
  it('starts on the first input, never on load, and a run that is left still counts toward the best', () => {
    expect(src).toContain('begin(st)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
    expect(src).toContain('const settle = () =>');
  });
  it('draws filled shapes, not line art: rocks and the ship are filled with gradients', () => {
    expect(src).toContain('createRadialGradient');
    expect(src).toContain('c.fill();');
    expect(src).toContain('quadraticCurveTo');
  });
});
