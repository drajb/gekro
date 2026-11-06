/**
 * games-cloud-climb.test.ts - the engine behind `cloud-climb`.
 *
 * Pinned: a fixed 1/60 s step with gravity 1300, an ordinary bounce of 640 units/s (about 157 high) and a
 * spring bounce of 1000 (about 385 high), checked by flying them; the blob lands only while falling and only
 * when its feet cross a cloud's top (so it passes up through clouds), never tunnels at top fall speed, and
 * takes the highest cloud it crosses; crumbling clouds last 0.45 s after a landing; sliding clouds follow
 * a sine; the sides wrap; the score is the height climbed in tens; the generator never puts a gap above 120
 * (under four fifths of a bounce), never more than 2 crumbling clouds in a row, keeps the clouds that stay within
 * 133 units of each other, keeps every cloud on the screen and every sideways step within what the blob covers in the
 * air; a planner that simulates the engine finds a cloud above to land on at every one of thousands of landings and
 * survives, at every level, with and without sliding clouds; random steps never break an invariant; the clock
 * plays the same climb on any screen; best scores reject junk; and the page keeps what it promises.
 */
import { describe, it, expect } from 'vitest';
import {
  newGame, begin, step, nextPlatform, platX, gapAt, airTime, reachDx, wrap, wrapDelta,
  keyToDir, pointerDir, keyScope, spaceIsNative, advanceClock, bestKey, parseBests, recordBest, describeState, endMessage, shareText, plural, milestone, isLevel, mulberry32,
  W, H, DT, R, GRAVITY, JUMP_V, SPRING_V, MAX_FALL, SIDE_SPEED, SIDE_ACC, JUMP_H, SPRING_H, PLAT_H, END_SLACK, CAM_LINE, MOVE_AMP, MOVE_W, FADE_TIME, MIN_GAP,
  REACH_FACTOR, GAP_LIMIT, START_PLAT_Y, START_PLAT_W, LOOKAHEAD, RAMP, MAX_FADE_RUN, SOLID_GAP, SOLID_LIMIT, FALL_OUT, PARAMS, LEVELS, MAX_SCORE, SFX, PEAK_GAIN,
  type GameState, type Level, type Platform,
} from '../src/components/apps-private/cloud-climb/helpers';
import calculatorSource from '../src/components/apps-private/cloud-climb/Calculator.astro?raw';

const rng0 = () => 0.5;

/** A running game with exactly the clouds the test puts in (nothing new is made while the camera stays put). */
const scene = (platforms: Platform[], blob: { x: number; y: number; vx?: number; vy?: number }, over: Partial<GameState> = {}, level: Level = 'medium'): GameState => {
  const base = begin(newGame(level, false, mulberry32(1)));
  return {
    ...base, platforms, blob: { x: blob.x, y: blob.y, vx: blob.vx ?? 0, vy: blob.vy ?? 0 }, ...over,
    // generation is switched off by pretending the highest cloud made is far above
    lastY: -1e6, camTop: over.camTop ?? 0,
  };
};
const cloud = (id: number, x: number, y: number, over: Partial<Platform> = {}): Platform => ({ id, kind: 'cloud', x, y, w: 64, phase: 0, fade: -1, ...over });

describe('the world and the levels', () => {
  it('is a 320 wide world with a 480 tall view and a fixed 1/60 s step', () => {
    expect([W, H, R]).toEqual([320, 480, 13]);
    expect(DT).toBeCloseTo(1 / 60, 12);
    expect([GRAVITY, JUMP_V, SPRING_V, MAX_FALL, SIDE_SPEED, SIDE_ACC]).toEqual([1300, 640, 1000, 900, 220, 2400]);
    expect(JUMP_H).toBeCloseTo(157.5, 0);
    expect(SPRING_H).toBeCloseTo(384.6, 0);
    expect([MIN_GAP, FADE_TIME, MOVE_AMP, MOVE_W, MAX_FADE_RUN, GAP_LIMIT, SOLID_LIMIT, SOLID_GAP, REACH_FACTOR]).toEqual([48, 0.45, 44, 1.1, 2, 0.8, 0.85, 133, 0.55]);
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
    expect(isLevel('hard')).toBe(true);
    for (const bad of ['', 'HARD', null, undefined, 2]) expect(isLevel(bad as unknown)).toBe(false);
  });
  it('gets harder level by level: smaller clouds, bigger gaps, more moving and crumbling clouds', () => {
    const order: Level[] = ['easy', 'medium', 'hard'];
    for (let i = 1; i < order.length; i++) {
      const a = PARAMS[order[i - 1]];
      const b = PARAMS[order[i]];
      expect(b.w).toBeLessThan(a.w);
      expect(b.maxGap).toBeGreaterThan(a.maxGap);
      expect(b.moving).toBeGreaterThan(a.moving);
      expect(b.crumble).toBeGreaterThan(a.crumble);
    }
    for (const l of LEVELS) expect(PARAMS[l].maxGap).toBeLessThanOrEqual(GAP_LIMIT * JUMP_H);
  });
});

describe('flying: gravity, bounces and sideways speed', () => {
  it('an ordinary bounce rises about 157 units and takes about a second, a spring about 385', () => {
    const start = START_PLAT_Y - R;
    const rise = (kind: 'cloud' | 'spring') => {
      let s = scene([cloud(1, W / 2, START_PLAT_Y, { w: 200, kind })], { x: W / 2, y: start, vy: 200 });
      let top = start;
      let steps = 0;
      let landedAt = -1;
      for (let i = 0; i < 400 && landedAt < 0; i++) {
        s = step(s, 0, rng0);
        steps++;
        top = Math.min(top, s.blob.y);
        if (s.events.includes('bounce') || s.events.includes('spring')) {
          landedAt = i;
          // now fly the bounce
          let t = s;
          let apex = t.blob.y;
          let n = 0;
          while (t.blob.vy < 0 || n < 3) { t = step({ ...t, camTop: 0, platforms: t.platforms }, 0, rng0); apex = Math.min(apex, t.blob.y); n++; if (n > 500) break; }
          return { height: start - apex, seconds: n * DT };
        }
      }
      return { height: 0, seconds: 0 };
    };
    const a = rise('cloud');
    expect(a.height).toBeGreaterThan(JUMP_H - 6);
    expect(a.height).toBeLessThan(JUMP_H + 6);
    expect(a.seconds).toBeGreaterThan(0.45);
    expect(a.seconds).toBeLessThan(0.55);
    const b = rise('spring');
    expect(b.height).toBeGreaterThan(SPRING_H - 12);
    expect(b.height).toBeLessThan(SPRING_H + 12);
  });
  it('free fall matches the closed form for semi-implicit Euler and is capped at 900', () => {
    let s = scene([], { x: 100, y: 0, vy: 0 });
    const n = 20;
    for (let i = 0; i < n; i++) s = step(s, 0, rng0);
    expect(s.blob.vy).toBeCloseTo(n * GRAVITY * DT, 9);
    expect(s.blob.y).toBeCloseTo(GRAVITY * DT * DT * ((n * (n + 1)) / 2), 9);
    let f = scene([], { x: 100, y: 200, vy: 0 }, { camTop: 0 });
    for (let i = 0; i < 60; i++) { f = step(f, 0, rng0); expect(f.blob.vy).toBeLessThanOrEqual(MAX_FALL + 1e-9); }
    expect(f.blob.vy).toBe(MAX_FALL); // reached before the blob left the view and the run ended
  });
  it('sideways speed builds up at 2400 units/s^2 to 220 and stops the same way', () => {
    let s = scene([], { x: 100, y: 50, vy: -300 }, { camTop: -100 });
    s = step(s, 1, rng0);
    expect(s.blob.vx).toBeCloseTo(SIDE_ACC * DT, 9);
    for (let i = 0; i < 20; i++) s = step({ ...s, blob: { ...s.blob, y: 50, vy: -300 } }, 1, rng0);
    expect(s.blob.vx).toBe(SIDE_SPEED);
    for (let i = 0; i < 20; i++) s = step({ ...s, blob: { ...s.blob, y: 50, vy: -300 } }, -1, rng0);
    expect(s.blob.vx).toBe(-SIDE_SPEED);
    for (let i = 0; i < 20; i++) s = step({ ...s, blob: { ...s.blob, y: 50, vy: -300 } }, 0, rng0);
    expect(s.blob.vx).toBe(0);
  });
  it('the sides wrap around', () => {
    let s = scene([], { x: 2, y: 100, vx: -200, vy: -500 }, { camTop: -100 });
    s = step(s, -1, rng0);
    expect(s.blob.x).toBeGreaterThan(W - 10);
    let t = scene([], { x: W - 2, y: 100, vx: 200, vy: -500 }, { camTop: -100 });
    t = step(t, 1, rng0);
    expect(t.blob.x).toBeLessThan(10);
    expect(wrap(-1, W)).toBe(W - 1);
    expect(wrapDelta(5, 315, W)).toBeCloseTo(10, 9);
  });
  it('does nothing until the climb begins, and the first input starts it with a bounce', () => {
    const s = newGame('easy', false, mulberry32(1));
    expect(s.status).toBe('ready');
    expect(step(s, 1, rng0)).toBe(s);
    const b = begin(s);
    expect(b.status).toBe('running');
    expect(b.blob.vy).toBe(-JUMP_V);
    expect(s.blob.y).toBe(START_PLAT_Y - R);
    expect(START_PLAT_W).toBe(120);
  });
});

describe('landing on clouds', () => {
  it('lands when falling onto a cloud from above and bounces with an ordinary jump', () => {
    const c = cloud(1, 100, 200);
    let s = scene([c], { x: 100, y: 200 - R - 4, vy: 300 });
    s = step(s, 0, rng0);
    expect(s.events).toContain('bounce');
    expect(s.blob.vy).toBeLessThan(0);
    expect(s.blob.y).toBe(200 - R);
    expect(s.bounces).toBe(1);
  });
  it('a spring cloud flings the blob at 1000', () => {
    let s = scene([cloud(1, 100, 200, { kind: 'spring' })], { x: 100, y: 200 - R - 4, vy: 300 });
    s = step(s, 0, rng0);
    expect(s.events).toContain('spring');
    expect(s.blob.vy).toBe(-SPRING_V);
  });
  it('passes up through a cloud when rising, never lands', () => {
    let s = scene([cloud(1, 100, 200)], { x: 100, y: 200 + 10, vy: -400 });
    for (let i = 0; i < 6; i++) s = step(s, 0, rng0);
    expect(s.bounces).toBe(0);
    expect(s.blob.y).toBeLessThan(200 - 10);
  });
  it('misses a cloud its edge does not reach, and lands within 40 percent of the radius beyond the end', () => {
    const c = cloud(1, 100, 200, { w: 64 });
    const reach = 32 + R * END_SLACK;
    const inside = step(scene([c], { x: 100 + reach - 0.5, y: 200 - R - 4, vy: 300 }), 0, rng0);
    expect(inside.events).toContain('bounce');
    const outside = step(scene([c], { x: 100 + reach + 0.5, y: 200 - R - 4, vy: 300 }), 0, rng0);
    expect(outside.events).not.toContain('bounce');
    // left side too
    expect(step(scene([c], { x: 100 - reach + 0.5, y: 200 - R - 4, vy: 300 }), 0, rng0).events).toContain('bounce');
  });
  it('cannot tunnel through a cloud at top fall speed: 3000 random falls agree with a continuous crossing check', () => {
    const rng = mulberry32(6);
    let hits = 0;
    for (let n = 0; n < 3000; n++) {
      const cy = 100 + rng() * 300;
      const vy0 = 300 + rng() * 600;
      const startFeet = cy - rng() * 40;
      const x = 100 + (rng() - 0.5) * 120;
      const c = cloud(1, 100, cy, { w: 64 });
      let s = scene([c], { x, y: startFeet - R, vx: 0, vy: vy0 });
      // oracle: the feet cross the top within the next step iff prevFeet <= top < feet, and x is within the cloud's reach
      const vyNext = Math.min(MAX_FALL, vy0 + GRAVITY * DT);
      const feetNext = startFeet + vyNext * DT;
      const crosses = startFeet <= cy && feetNext >= cy && Math.abs(x - 100) <= 32 + R * END_SLACK;
      s = step(s, 0, rng0);
      expect(s.events.includes('bounce'), `fall ${n}`).toBe(crosses);
      if (crosses) hits++;
    }
    expect(hits).toBeGreaterThan(300);
  });
  it('takes the highest cloud when it crosses two in one step', () => {
    const lo = cloud(1, 100, 205);
    const hi = cloud(2, 100, 200);
    const s = step(scene([lo, hi], { x: 100, y: 200 - R - 1, vy: 800 }), 0, rng0);
    expect(s.blob.y).toBe(200 - R);
  });
  it('a crumbling cloud lasts 0.45 s after a landing and then goes, and can be landed on again before that', () => {
    const c = cloud(1, 100, 200, { kind: 'crumble' });
    let s = scene([c], { x: 100, y: 200 - R - 4, vy: 300 });
    s = step(s, 0, rng0);
    const first = s.platforms.find((p) => p.id === 1);
    expect(first).toBeDefined();
    expect(first!.fade).toBeGreaterThan(0);
    expect(first!.fade).toBeLessThanOrEqual(FADE_TIME);
    let n = 0;
    while (s.platforms.some((p) => p.id === 1) && n < 100) { s = step({ ...s, blob: { ...s.blob, y: 0, vy: -400 } }, 0, rng0); n++; }
    expect(n * DT).toBeGreaterThan(FADE_TIME - 0.05);
    expect(n * DT).toBeLessThan(FADE_TIME + 0.05);
    // a second landing before it is gone still bounces
    let t = scene([{ ...c, fade: 0.2 }], { x: 100, y: 200 - R - 4, vy: 300 });
    t = step(t, 0, rng0);
    expect(t.events).toContain('bounce');
  });
  it('a sliding cloud follows x + 44 sin(phase + 1.1 t) and stays inside its slide', () => {
    const p: Platform = { id: 1, kind: 'moving', x: 150, y: 0, w: 64, phase: 0.7, fade: -1 };
    for (const steps of [0, 10, 60, 123, 900, 5000]) expect(platX(p, steps)).toBeCloseTo(150 + 44 * Math.sin(0.7 + 1.1 * steps * DT), 9);
    let lo = 1e9;
    let hi = -1e9;
    for (let i = 0; i < 2000; i++) { const x = platX(p, i); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    expect(hi - lo).toBeGreaterThan(87);
    expect(hi - lo).toBeLessThanOrEqual(88.0001);
    expect(platX({ ...p, kind: 'cloud' }, 77)).toBe(150);
  });
});

describe('the camera, the score and falling out', () => {
  it('the camera only goes up, once the blob passes 40 percent of the view', () => {
    expect(CAM_LINE).toBe(0.4);
    let s = scene([], { x: 100, y: 300, vy: -300 }, { camTop: 0 });
    s = step(s, 0, rng0);
    expect(s.camTop).toBe(0);
    s = scene([], { x: 100, y: 100, vy: -300 }, { camTop: 0 });
    s = step(s, 0, rng0);
    expect(s.camTop).toBeCloseTo(s.blob.y - H * CAM_LINE, 9);
    const before = s.camTop;
    s = step({ ...s, blob: { ...s.blob, y: s.blob.y + 200, vy: 0 } }, 0, rng0);
    expect(s.camTop).toBe(before);
  });
  it('the score is the height climbed in tens, and never goes down', () => {
    let s = scene([], { x: 100, y: START_PLAT_Y - R - 255, vy: -10 }, { startY: START_PLAT_Y - R, topY: START_PLAT_Y - R, camTop: START_PLAT_Y - R - 255 - 200 });
    s = step(s, 0, rng0);
    expect(s.score).toBe(25);
    expect(s.topY).toBeLessThan(START_PLAT_Y - R - 254);
    const high = s.score;
    s = step({ ...s, blob: { ...s.blob, y: START_PLAT_Y - R, vy: 0 } }, 0, rng0);
    expect(s.score).toBe(high);
  });
  it('milestones are announced at every hundred', () => {
    let s = scene([], { x: 100, y: START_PLAT_Y - R - 999, vy: -300 }, { startY: START_PLAT_Y - R, topY: START_PLAT_Y - R, score: 99, camTop: START_PLAT_Y - R - 999 - 200 });
    s = step(s, 0, rng0);
    expect(s.score).toBe(100);
    expect(s.events).toContain('milestone');
    expect([0, 1, 99, 100, 101, 200].map(milestone)).toEqual([false, false, false, true, false, true]);
    expect(milestone(NaN)).toBe(false);
  });
  it('falling below the view ends the run', () => {
    expect(FALL_OUT).toBe(30);
    const s = step(scene([], { x: 100, y: H + 60, vy: 100 }, { camTop: 0 }), 0, rng0);
    expect(s.status).toBe('over');
    expect(s.events).toContain('fall');
    expect(step(s, 1, rng0)).toBe(s);
  });
});

describe('the cloud generator', () => {
  const tower = (level: Level, calm: boolean, seed: number, n: number) => {
    const rng = mulberry32(seed);
    const startY = START_PLAT_Y - R;
    const out: { p: Platform; gap: number; dx: number; solidGap: number }[] = [];
    let y = START_PLAT_Y;
    let x = W / 2;
    let run = 0;
    let solid = START_PLAT_Y;
    for (let i = 0; i < n; i++) {
      const g = nextPlatform(level, calm, y, x, run, solid, startY, i + 1, rng);
      out.push({ p: g.plat, gap: y - g.plat.y, dx: g.plat.x - x, solidGap: solid - g.plat.y });
      // the gap from the last cloud that stays to the next cloud that stays
      y = g.plat.y;
      x = g.plat.x;
      run = g.fadeRun;
      solid = g.solidY;
    }
    return out;
  };
  it('never puts a gap below 48 or above the level limit, and the limit is under four fifths of a bounce', () => {
    for (const l of LEVELS) for (const calm of [false, true]) for (let seed = 1; seed <= 8; seed++) {
      const t = tower(l, calm, seed * 31 + l.length, 1500);
      t.forEach((e, i) => {
        expect(e.gap, `${l} #${i}`).toBeGreaterThanOrEqual(MIN_GAP - 1e-9);
        expect(e.gap, `${l} #${i}`).toBeLessThanOrEqual(PARAMS[l].maxGap + 1e-9);
        expect(e.gap).toBeLessThanOrEqual(GAP_LIMIT * JUMP_H);
      });
    }
  });
  it('gaps start small and grow with height up to the level limit', () => {
    expect(gapAt('hard', 0)).toBe(66);
    expect(gapAt('hard', RAMP)).toBe(120);
    expect(gapAt('hard', 10 * RAMP)).toBe(120);
    expect(gapAt('hard', -50)).toBe(66);
    for (const l of LEVELS) expect(gapAt(l, RAMP / 2)).toBeGreaterThan(gapAt(l, 0));
    const t = tower('hard', false, 4, 3000);
    const early = Math.max(...t.slice(0, 5).map((e) => e.gap));
    const late = Math.max(...t.slice(-300).map((e) => e.gap));
    expect(early).toBeLessThanOrEqual(75);
    expect(late).toBeGreaterThan(100);
  });
  it('keeps every cloud on the screen, and every sliding cloud inside it for its whole slide', () => {
    for (const l of LEVELS) for (let seed = 1; seed <= 6; seed++) {
      for (const e of tower(l, false, seed, 1500)) {
        expect(e.p.w).toBe(PARAMS[l].w);
        expect(e.p.x - e.p.w / 2).toBeGreaterThanOrEqual(-1e-9);
        expect(e.p.x + e.p.w / 2).toBeLessThanOrEqual(W + 1e-9);
        if (e.p.kind === 'moving') {
          expect(e.p.x - MOVE_AMP - e.p.w / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(e.p.x + MOVE_AMP + e.p.w / 2).toBeLessThanOrEqual(W + 1e-9);
        }
      }
    }
  });
  it('never more than 2 crumbling clouds in a row, and the clouds that stay are never more than 133 apart', () => {
    for (const l of LEVELS) for (const calm of [false, true]) for (let seed = 1; seed <= 8; seed++) {
      const t = tower(l, calm, seed * 7 + 1, 2500);
      let run = 0;
      let lastSolid = START_PLAT_Y;
      let crumbles = 0;
      for (const e of t) {
        if (e.p.kind === 'crumble') { run++; crumbles++; } else run = 0;
        expect(run).toBeLessThanOrEqual(MAX_FADE_RUN);
        if (e.p.kind !== 'crumble') {
          expect(lastSolid - e.p.y, `${l}`).toBeLessThanOrEqual(SOLID_GAP + 1e-9);
          lastSolid = e.p.y;
        }
      }
      if (l === 'hard') expect(crumbles).toBeGreaterThan(100);
    }
  });
  it('every sideways step is within what the blob covers in the air (plus the slide of a sliding cloud)', () => {
    for (const l of LEVELS) for (let seed = 1; seed <= 6; seed++) {
      for (const e of tower(l, false, seed * 13, 1500)) {
        const lim = reachDx(e.gap);
        expect(Math.abs(e.dx), `${l} gap ${e.gap.toFixed(0)}`).toBeLessThanOrEqual(lim + MOVE_AMP + 1e-9);
        if (e.p.kind !== 'moving') expect(Math.abs(e.dx)).toBeLessThanOrEqual(lim + 1e-9);
      }
    }
    expect(airTime(0)).toBeCloseTo(JUMP_V / GRAVITY + Math.sqrt((2 * JUMP_H) / GRAVITY), 9);
    expect(reachDx(120)).toBeLessThan(reachDx(48));
    expect(reachDx(120)).toBeGreaterThan(70);
  });
  it('a calm run (reduced motion) has no sliding clouds, a normal one has them', () => {
    for (const l of LEVELS) {
      expect(tower(l, true, 3, 2000).some((e) => e.p.kind === 'moving')).toBe(false);
      expect(tower(l, false, 3, 2000).some((e) => e.p.kind === 'moving')).toBe(true);
    }
  });
  it('special clouds ramp in: none of the sliding or crumbling kind at the very start, many by 2500 units', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const first = tower('hard', false, seed, 1)[0].p.kind;
      expect(first === 'moving' || first === 'crumble', `seed ${seed}`).toBe(false);
    }
    const t = tower('medium', false, 5, 3000);
    const late = t.slice(-500);
    const share = late.filter((e) => e.p.kind !== 'cloud').length / late.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.8);
  });
  it('the same seed makes the same game, a different seed does not, and bad levels fall back to medium', () => {
    const a = newGame('medium', false, mulberry32(9));
    const b = newGame('medium', false, mulberry32(9));
    const c = newGame('medium', false, mulberry32(10));
    expect(a.platforms).toEqual(b.platforms);
    expect(a.platforms).not.toEqual(c.platforms);
    expect(newGame('nope' as Level, false, mulberry32(1)).level).toBe('medium');
    expect(a.platforms[0]).toEqual({ id: 0, kind: 'cloud', x: W / 2, y: START_PLAT_Y, w: START_PLAT_W, phase: 0, fade: -1 });
    expect(a.platforms[a.platforms.length - 1].y).toBeLessThan(-LOOKAHEAD + 1);
  });
});

describe('every cloud can be reached: a planner that tries the engine itself', () => {
  const dummy = () => 0.5;
  const steer = (s: GameState, c: Platform): number => {
    const d = wrapDelta(platX(c, s.steps), s.blob.x, W);
    return Math.abs(d) < 2 ? 0 : d > 0 ? 1 : -1;
  };
  /** Where plain steering toward cloud c would land the blob, found by running the engine ahead. */
  const landing = (s0: GameState, c: Platform): Platform | null => {
    let t = s0;
    for (let i = 0; i < 150 && t.status === 'running'; i++) {
      t = step(t, steer(t, c), dummy);
      if (t.events.includes('bounce') || t.events.includes('spring')) return t.platforms.find((p) => Math.abs(p.y - (t.blob.y + R)) < 0.01) ?? null;
    }
    return null;
  };
  /** The cloud to steer for: the one whose simulated landing is highest, and higher than where we stand. Null if none works. */
  const plan = (s: GameState): Platform | null => {
    const feet = s.blob.y + R;
    let best: Platform | null = null;
    let bestY = feet - 5;
    for (const c of s.platforms.filter((p) => p.y < feet - 5 && p.y > feet - 420 && p.fade !== 0)) {
      const l = landing(s, c);
      if (l && l.y < bestY) { bestY = l.y; best = c; }
    }
    return best;
  };
  for (const level of LEVELS) {
    for (const calm of [false, true]) {
      it(`${level}${calm ? ' (reduced motion, no sliding clouds)' : ''}: a way up from every landing, and the planner never falls`, () => {
        let landings = 0;
        let noPlan = 0;
        let lowest = 1e9;
        const seeds = 12;
        for (let seed = 1; seed <= seeds; seed++) {
          const rng = mulberry32(seed * 7919 + level.length);
          let s = begin(newGame(level, calm, rng));
          let target: Platform | null = null;
          for (let i = 0; i < 60 * 40 && s.status === 'running'; i++) {
            if (i === 0 || s.events.includes('bounce') || s.events.includes('spring')) {
              landings++;
              target = plan(s);
              if (!target) noPlan++;
            }
            s = step(s, target ? steer(s, target) : 0, rng);
          }
          expect(s.status, `${level} seed ${seed}`).toBe('running');
          lowest = Math.min(lowest, s.score);
        }
        expect(landings).toBeGreaterThan(400);
        expect(noPlan, `${noPlan} of ${landings} landings had no way up`).toBe(0);
        expect(lowest).toBeGreaterThan(350);
      }, 120_000);
    }
  }
  it('a blob that is never steered does not fall and does not get far', () => {
    const rng = mulberry32(2);
    let s = begin(newGame('medium', false, rng));
    for (let i = 0; i < 60 * 30 && s.status === 'running'; i++) s = step(s, 0, rng);
    expect(s.status).toBe('running');
    expect(s.score).toBeLessThan(300);
  });
});

describe('purity, determinism and random play', () => {
  it('does not change the state it was given', () => {
    const s = begin(newGame('hard', false, mulberry32(3)));
    const before = JSON.stringify(s);
    step(s, 1, mulberry32(9));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('the same seed and the same steering replay the same climb, a different seed does not', () => {
    const play = (seed: number) => {
      const rng = mulberry32(seed);
      let s = begin(newGame('medium', false, rng));
      const trace: string[] = [];
      for (let i = 0; i < 900 && s.status === 'running'; i++) {
        s = step(s, i % 120 < 60 ? 1 : -1, rng);
        trace.push(`${s.blob.x.toFixed(5)}|${s.blob.y.toFixed(5)}|${s.score}|${s.platforms.length}`);
      }
      return trace;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(77)).not.toEqual(play(78));
  });
  it('survives bad time steps', () => {
    const s = begin(newGame('easy', false, mulberry32(1)));
    for (const dt of [NaN, -1, 0, Infinity, 5]) {
      const t = step(s, 1, rng0, dt);
      for (const v of [t.blob.x, t.blob.y, t.blob.vx, t.blob.vy, t.camTop]) expect(Number.isFinite(v)).toBe(true);
    }
  });
  for (const level of LEVELS) {
    it(`5000 random steps at ${level} never break an invariant`, () => {
      const rng = mulberry32(level.length * 11);
      const inRng = mulberry32(5 + level.length);
      let s = begin(newGame(level, level === 'hard', rng));
      let dir = 0;
      let lastCam = 0;
      let lastScore = 0;
      for (let i = 0; i < 5000 && s.status === 'running'; i++) {
        if (i % 20 === 0) dir = Math.floor(inRng() * 3) - 1;
        s = step(s, dir, rng);
        for (const v of [s.blob.x, s.blob.y, s.blob.vx, s.blob.vy, s.camTop]) expect(Number.isFinite(v)).toBe(true);
        expect(s.blob.x).toBeGreaterThanOrEqual(0);
        expect(s.blob.x).toBeLessThan(W);
        expect(s.blob.vy).toBeLessThanOrEqual(MAX_FALL);
        expect(Math.abs(s.blob.vx)).toBeLessThanOrEqual(SIDE_SPEED + 1e-9);
        expect(s.camTop).toBeLessThanOrEqual(lastCam);
        expect(s.score).toBeGreaterThanOrEqual(lastScore);
        expect(s.platforms.length).toBeLessThan(60);
        expect(new Set(s.platforms.map((p) => p.id)).size).toBe(s.platforms.length);
        for (const p of s.platforms) expect(p.y).toBeLessThan(s.camTop + H + 60);
        lastCam = s.camTop;
        lastScore = s.score;
      }
      expect(s.steps).toBeGreaterThan(100);
    }, 60_000);
  }
});

describe('keys, pointers and the clock', () => {
  it('maps keys to steering and nothing else', () => {
    expect(keyToDir('ArrowLeft')).toBe(-1);
    expect(keyToDir('a')).toBe(-1);
    expect(keyToDir('A')).toBe(-1);
    expect(keyToDir('ArrowRight')).toBe(1);
    expect(keyToDir('d')).toBe(1);
    for (const k of ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'p', 'Escape', 'x', '']) expect(keyToDir(k), k).toBe(0);
  });
  it('the left half of the sky steers left, the right half right', () => {
    expect(pointerDir(0)).toBe(-1);
    expect(pointerDir(159)).toBe(-1);
    expect(pointerDir(160)).toBe(1);
    expect(pointerDir(320)).toBe(1);
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
  it('a long stall cannot fast-forward the climb, and bad numbers are safe', () => {
    const r = advanceClock(0, 60_000);
    expect(r.steps).toBeLessThanOrEqual(4);
    expect(advanceClock(NaN, NaN)).toEqual({ steps: 0, acc: 0 });
    expect(advanceClock(-3, -50)).toEqual({ steps: 0, acc: 0 });
  });
  it('the same steering gives the same climb on a 60 Hz and a 144 Hz clock', () => {
    const fly = (hz: number) => {
      const rng = mulberry32(31);
      let s = begin(newGame('medium', false, rng));
      let acc = 0;
      for (let f = 0; f < hz * 4 && s.status === 'running'; f++) {
        const r = advanceClock(acc, 1000 / hz);
        acc = r.acc;
        for (let i = 0; i < r.steps && s.status === 'running'; i++) s = step(s, 1, rng);
      }
      return s;
    };
    const a = fly(60);
    const b = fly(144);
    expect(Math.abs(a.steps - b.steps)).toBeLessThanOrEqual(2);
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
  it('only a whole, positive, possible height can set a best, and only if higher', () => {
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
  const over = (score: number, bounces: number): GameState => ({ ...newGame('medium', false, mulberry32(1)), status: 'over', score, bounces });
  it('say what happened and praise what the player did', () => {
    expect(endMessage(over(120, 40))).toBe('The blob slipped off a cloud. You climbed to a height of 120, with 40 bounces.');
    expect(endMessage(over(3, 1))).toBe('The blob slipped off a cloud. You climbed to a height of 3, with 1 bounce.');
    expect(endMessage(over(0, 0))).toBe('The blob slipped past the clouds. Try again!');
    expect(endMessage(newGame('medium', false, mulberry32(1)))).toBe('');
  });
  it('builds a share line that is right before, during and after a climb', () => {
    expect(shareText('medium', null, 0)).toBe('Cloud Climb (Medium): no climb finished yet');
    expect(shareText('easy', { score: 0 }, 0)).toBe('Cloud Climb (Easy): climbed to a height of 0');
    expect(shareText('hard', { score: 140 }, 300)).toBe('Cloud Climb (Hard): climbed to a height of 140, best 300');
    for (const t of [shareText('easy', { score: 3 }, 3), describeState(newGame('hard', false, mulberry32(1)))]) expect(t).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(describeState(newGame('hard', false, mulberry32(1)))).toBe('Cloud Climb. Height 0.');
    expect(plural(1, 'bounce', 'bounces')).toBe('1 bounce');
  });
  it('every sound is short, quiet and within hearing range', () => {
    expect(PEAK_GAIN).toBeLessThanOrEqual(0.15);
    for (const [name, def] of Object.entries(SFX)) {
      expect(def.ms, name).toBeLessThanOrEqual(400);
      for (const f of def.freq) { expect(f, name).toBeGreaterThanOrEqual(60); expect(f, name).toBeLessThanOrEqual(2000); }
    }
  });
  it('the platform height constant is the thickness the art uses', () => {
    expect(PLAT_H).toBe(14);
  });
});

describe('what the page promises', () => {
  const src = calculatorSource;
  it('the steering buttons are at least 56 px and the how-it-works heading is a 32 px target', () => {
    const hold = src.match(/#ccl-app \.ccl-hold \{([^}]*)\}/);
    expect(hold).not.toBeNull();
    expect(hold![1]).toContain('min-height: 3.5rem');
    expect(hold![1]).toContain('min-width: 3.5rem');
    const rule = src.match(/\.ccl-how > summary \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('min-height: 2rem');
    expect(rule![1]).toContain('box-sizing: border-box');
    expect((src.match(/data-dir="/g) ?? []).length).toBe(2);
  });
  it('pauses on Escape, P and a hidden tab, and honours reduced motion', () => {
    expect(src).toContain("e.key === 'Escape'");
    expect(src).toContain("e.key === 'p' || e.key === 'P'");
    expect(src).toContain('document.hidden');
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(src).toContain('const par = reduced ? 0 : st.camTop * -0.25;');
    expect(src).toContain('reduced ? 0 : squash');
    expect(src).toContain('newGame(level, mq.matches, rng)');
  });
  it('does not trap keys when paused or finished with focus elsewhere, and ignores key repeat', () => {
    expect(src).toContain('keyScope(phase, app.contains(document.activeElement))');
    expect(src).toContain("if (scope !== 'all') return;");
    expect(src).toContain('if (e.repeat) return;');
    expect(src).toContain('spaceIsNative(t.tagName)');
  });
  it('sound is off until the button is pressed', () => {
    expect(src).toContain('let soundOn = false;');
    expect(src).toContain('aria-pressed="false"');
    expect(src).not.toMatch(/^\s*(const|let)\s+actx\s*=\s*new/m);
  });
  it('starts on the first input, never on load, and a climb that is left still counts toward the best', () => {
    expect(src).toContain('begin(st)');
    expect(src).not.toMatch(/^\s*requestAnimationFrame\(/m);
    expect(src).toContain('const settle = () =>');
  });
  it('the numbers the how-it-works text states are the engine numbers', () => {
    expect(PARAMS.hard.maxGap).toBe(120);
    expect(Math.round(JUMP_H)).toBe(158);
    expect(Math.round(SPRING_H)).toBe(385);
    expect(SOLID_GAP).toBe(133);
    expect(src).toContain('about 158 units');
    expect(src).toContain('133 units apart');
  });
});
